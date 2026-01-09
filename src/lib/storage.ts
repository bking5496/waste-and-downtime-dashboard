import { ShiftData, Machine, MACHINES } from '../types';
import {
  fetchMachines,
  upsertMachine,
  removeMachine,
  syncMachinesToSupabase,
  subscribeMachineChanges,
  MachineRecord,
  submitShiftData,
  isSupabaseConfigured
} from './supabase';

const STORAGE_KEY = 'waste_downtime_history';
const MACHINES_KEY = 'machines_data';
const MACHINES_SYNC_KEY = 'machines_last_sync';
const FAILED_SUBMISSIONS_KEY = 'failed_submissions_queue';
const HISTORY_MAX_DAYS = 90; // Keep history for 90 days
const HISTORY_MAX_ENTRIES = 1000; // Maximum entries to keep

// ==========================================
// FAILED SUBMISSIONS RETRY QUEUE
// ==========================================

interface FailedSubmission {
  id: string;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  data: {
    shiftData: any;
    wasteEntries: any[];
    downtimeEntries: any[];
    speedEntries?: any[];
    sachetMassEntries?: any[];
    looseCasesEntries?: any[];
    palletScanEntries?: any[];
  };
  error: string;
}

// Get failed submissions queue
export const getFailedSubmissions = (): FailedSubmission[] => {
  const stored = localStorage.getItem(FAILED_SUBMISSIONS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

// Add a failed submission to the retry queue
export const addFailedSubmission = (
  data: FailedSubmission['data'],
  error: string
): void => {
  const queue = getFailedSubmissions();
  const newEntry: FailedSubmission = {
    id: `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 3,
    data,
    error,
  };
  queue.push(newEntry);
  localStorage.setItem(FAILED_SUBMISSIONS_KEY, JSON.stringify(queue));
};

// Remove a submission from the failed queue
export const removeFailedSubmission = (id: string): void => {
  const queue = getFailedSubmissions();
  const filtered = queue.filter(s => s.id !== id);
  localStorage.setItem(FAILED_SUBMISSIONS_KEY, JSON.stringify(filtered));
};

// Retry all failed submissions
export const retryFailedSubmissions = async (): Promise<{
  succeeded: number;
  failed: number;
  remaining: number;
}> => {
  if (!isSupabaseConfigured) {
    return { succeeded: 0, failed: 0, remaining: getFailedSubmissions().length };
  }

  const queue = getFailedSubmissions();
  let succeeded = 0;
  let failed = 0;

  for (const submission of queue) {
    if (submission.retryCount >= submission.maxRetries) {
      // Max retries reached, keep in queue but don't retry
      failed++;
      continue;
    }

    try {
      await submitShiftData(
        submission.data.shiftData,
        submission.data.wasteEntries,
        submission.data.downtimeEntries,
        submission.data.speedEntries,
        submission.data.sachetMassEntries,
        submission.data.looseCasesEntries,
        submission.data.palletScanEntries
      );
      removeFailedSubmission(submission.id);
      succeeded++;
    } catch (e) {
      // Update retry count
      const updatedQueue = getFailedSubmissions().map(s =>
        s.id === submission.id
          ? { ...s, retryCount: s.retryCount + 1, error: String(e) }
          : s
      );
      localStorage.setItem(FAILED_SUBMISSIONS_KEY, JSON.stringify(updatedQueue));
      failed++;
    }
  }

  return {
    succeeded,
    failed,
    remaining: getFailedSubmissions().length,
  };
};

// Clear all failed submissions (manual clear)
export const clearFailedSubmissions = (): void => {
  localStorage.removeItem(FAILED_SUBMISSIONS_KEY);
};

// ==========================================
// LOCALSTORAGE CLEANUP
// ==========================================

// Clean up old history entries
export const cleanupOldHistory = (): { removed: number; remaining: number } => {
  const history = getShiftHistory();
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - HISTORY_MAX_DAYS * 24 * 60 * 60 * 1000);

  // Filter out entries older than cutoff date
  let cleaned = history.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= cutoffDate;
  });

  // Also limit to max entries (keep most recent)
  if (cleaned.length > HISTORY_MAX_ENTRIES) {
    cleaned = cleaned.slice(0, HISTORY_MAX_ENTRIES);
  }

  const removed = history.length - cleaned.length;

  if (removed > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    console.log(`Cleaned up ${removed} old history entries`);
  }

  return { removed, remaining: cleaned.length };
};

// Get localStorage usage stats
export const getStorageStats = (): {
  historyCount: number;
  failedCount: number;
  totalSizeKB: number;
  oldestEntry: string | null;
} => {
  const history = getShiftHistory();
  const failed = getFailedSubmissions();

  // Estimate total localStorage size
  let totalSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      totalSize += key.length + value.length;
    }
  }

  const oldestEntry = history.length > 0
    ? history[history.length - 1].date
    : null;

  return {
    historyCount: history.length,
    failedCount: failed.length,
    totalSizeKB: Math.round(totalSize / 1024),
    oldestEntry,
  };
};

// Run cleanup on app startup (debounced to run once per day)
export const maybeRunCleanup = (): void => {
  const lastCleanupKey = 'last_storage_cleanup';
  const lastCleanup = localStorage.getItem(lastCleanupKey);
  const now = new Date();

  if (lastCleanup) {
    const lastDate = new Date(lastCleanup);
    const hoursSinceCleanup = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCleanup < 24) {
      return; // Already cleaned up today
    }
  }

  // Run cleanup
  const result = cleanupOldHistory();
  localStorage.setItem(lastCleanupKey, now.toISOString());

  if (result.removed > 0) {
    console.log(`Storage cleanup: removed ${result.removed} entries, ${result.remaining} remaining`);
  }
};

// Flag to track if we're using Supabase
let useSupabase = true;
let machinesCache: Machine[] | null = null;
let machinesListeners: ((machines: Machine[]) => void)[] = [];

// Convert Supabase record to local Machine type
const toLocalMachine = (record: MachineRecord): Machine => ({
  id: record.id,
  name: record.name,
  status: record.status,
  currentOperator: record.current_operator,
  currentOrder: record.current_order,
  currentShift: record.current_shift,
  lastSubmission: record.last_submission,
  todayWaste: record.today_waste,
  todayDowntime: record.today_downtime,
  subMachineCount: record.sub_machine_count,
});

// Convert local Machine to Supabase record
const toSupabaseRecord = (machine: Machine): MachineRecord => ({
  id: machine.id,
  name: machine.name,
  status: machine.status,
  current_operator: machine.currentOperator,
  current_order: machine.currentOrder,
  current_shift: machine.currentShift,
  last_submission: machine.lastSubmission,
  today_waste: machine.todayWaste,
  today_downtime: machine.todayDowntime,
  sub_machine_count: machine.subMachineCount,
});

// Initialize machines from Supabase
export const initializeMachines = async (): Promise<Machine[]> => {
  try {
    const records = await fetchMachines();

    if (records.length > 0) {
      machinesCache = records.map(toLocalMachine);
      // Also save to localStorage as backup
      localStorage.setItem(MACHINES_KEY, JSON.stringify(machinesCache));
      localStorage.setItem(MACHINES_SYNC_KEY, new Date().toISOString());
      return machinesCache;
    } else {
      // No machines in Supabase, sync default machines
      console.log('No machines in Supabase, syncing defaults...');
      const defaultMachines = MACHINES.map(toSupabaseRecord);
      await syncMachinesToSupabase(defaultMachines);
      machinesCache = MACHINES;
      localStorage.setItem(MACHINES_KEY, JSON.stringify(MACHINES));
      return MACHINES;
    }
  } catch (error) {
    console.error('Failed to initialize from Supabase, using localStorage:', error);
    useSupabase = false;
    return getMachinesDataLocal();
  }
};

// Subscribe to real-time machine updates - OPTIMIZED
export const subscribeToMachineUpdates = (callback: (machines: Machine[]) => void) => {
  machinesListeners.push(callback);

  // Provide current machines getter for optimized real-time updates
  const getCurrentMachines = (): MachineRecord[] => {
    const current = machinesCache || getMachinesDataLocal();
    return current.map(toSupabaseRecord);
  };

  // Set up Supabase real-time subscription with optimized handler
  const unsubscribe = subscribeMachineChanges(
    (records) => {
      machinesCache = records.map(toLocalMachine);
      localStorage.setItem(MACHINES_KEY, JSON.stringify(machinesCache));

      // Notify all listeners
      machinesListeners.forEach(listener => listener(machinesCache!));
    },
    getCurrentMachines
  );

  // Return cleanup function
  return () => {
    machinesListeners = machinesListeners.filter(l => l !== callback);
    if (machinesListeners.length === 0) {
      unsubscribe();
    }
  };
};

// Get machines from localStorage (fallback)
const getMachinesDataLocal = (): Machine[] => {
  const stored = localStorage.getItem(MACHINES_KEY);
  if (!stored) {
    localStorage.setItem(MACHINES_KEY, JSON.stringify(MACHINES));
    return MACHINES;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return MACHINES;
  }
};

// Save shift data to local storage
export const saveShiftData = (data: ShiftData): void => {
  const existing = getShiftHistory();
  existing.unshift(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  // Update machine data
  updateMachineLastSubmission(data.machine, data.submittedAt.toISOString());
};

// Get all shift history
export const getShiftHistory = (): ShiftData[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return parsed.map((item: any) => ({
      ...item,
      submittedAt: new Date(item.submittedAt),
      wasteEntries: item.wasteEntries.map((w: any) => ({
        ...w,
        timestamp: new Date(w.timestamp),
      })),
      downtimeEntries: item.downtimeEntries.map((d: any) => ({
        ...d,
        timestamp: new Date(d.timestamp),
      })),
    }));
  } catch {
    return [];
  }
};

// Get shift history for a specific date range
export const getShiftHistoryByDateRange = (startDate: Date, endDate: Date): ShiftData[] => {
  const history = getShiftHistory();
  return history.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= startDate && itemDate <= endDate;
  });
};

// Get shift history for a specific machine
export const getShiftHistoryByMachine = (machineName: string): ShiftData[] => {
  const history = getShiftHistory();
  return history.filter(item => item.machine === machineName);
};

// Get today's statistics
export const getTodayStats = () => {
  const today = new Date().toISOString().split('T')[0];
  const history = getShiftHistory();
  const todayData = history.filter(item => item.date === today);

  const totalWaste = todayData.reduce((sum, item) => sum + item.totalWaste, 0);
  const totalDowntime = todayData.reduce((sum, item) => sum + item.totalDowntime, 0);
  const submissionCount = todayData.length;

  return { totalWaste, totalDowntime, submissionCount };
};

// Update machine last submission
export const updateMachineLastSubmission = (machineName: string, timestamp: string): void => {
  const machines = getMachinesData();
  const machineIndex = machines.findIndex(m => m.name === machineName);
  if (machineIndex !== -1) {
    machines[machineIndex].lastSubmission = getTimeAgo(new Date(timestamp));
  }
  localStorage.setItem(MACHINES_KEY, JSON.stringify(machines));
};

// Get machines data with local modifications
export const getMachinesData = (): Machine[] => {
  // Return cache if available
  if (machinesCache) {
    return machinesCache;
  }

  // Otherwise return from localStorage
  return getMachinesDataLocal();
};

// Update a single machine
export const updateMachine = async (machineId: string, updates: Partial<Machine>): Promise<void> => {
  const machines = getMachinesData();
  const index = machines.findIndex(m => m.id === machineId);
  if (index !== -1) {
    machines[index] = { ...machines[index], ...updates };
    machinesCache = machines;
    localStorage.setItem(MACHINES_KEY, JSON.stringify(machines));

    // Sync to Supabase
    if (useSupabase) {
      try {
        await upsertMachine(toSupabaseRecord(machines[index]));
      } catch (error) {
        console.error('Failed to sync machine update to Supabase:', error);
      }
    }
  }
};

// Add a new machine
export const addMachine = async (machine: Machine): Promise<void> => {
  const machines = getMachinesData();
  machines.push(machine);
  machinesCache = machines;
  localStorage.setItem(MACHINES_KEY, JSON.stringify(machines));

  // Sync to Supabase
  if (useSupabase) {
    try {
      await upsertMachine(toSupabaseRecord(machine));
    } catch (error) {
      console.error('Failed to sync new machine to Supabase:', error);
    }
  }
};

// Delete a machine
export const deleteMachine = async (machineId: string): Promise<void> => {
  const machines = getMachinesData();
  const filtered = machines.filter(m => m.id !== machineId);
  machinesCache = filtered;
  localStorage.setItem(MACHINES_KEY, JSON.stringify(filtered));

  // Sync to Supabase
  if (useSupabase) {
    try {
      await removeMachine(machineId);
    } catch (error) {
      console.error('Failed to delete machine from Supabase:', error);
    }
  }
};

// Reset machines to default
export const resetMachines = async (): Promise<void> => {
  machinesCache = MACHINES;
  localStorage.setItem(MACHINES_KEY, JSON.stringify(MACHINES));

  // Sync to Supabase
  if (useSupabase) {
    try {
      await syncMachinesToSupabase(MACHINES.map(toSupabaseRecord));
    } catch (error) {
      console.error('Failed to reset machines in Supabase:', error);
    }
  }
};

// Helper function to format time ago
export const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

// Export data to CSV
export const exportToCSV = (data: ShiftData[], filename: string): void => {
  const headers = [
    'Date',
    'Shift',
    'Operator',
    'Machine',
    'Order Number',
    'Product',
    'Batch Number',
    'Entry Type',
    'Waste Type',
    'Waste (kg)',
    'Downtime Reason',
    'Downtime (min)',
    'Submitted At',
  ];

  const rows: string[][] = [];

  data.forEach(item => {
    const baseRow = [
      item.date,
      item.shift,
      item.operatorName,
      item.machine,
      item.orderNumber,
      item.product,
      item.batchNumber,
    ];
    const submittedAt = new Date(item.submittedAt).toLocaleString();

    // Add a row for each waste entry
    if (item.wasteEntries && item.wasteEntries.length > 0) {
      item.wasteEntries.forEach(w => {
        rows.push([
          ...baseRow,
          'Waste',
          w.wasteType,
          w.waste.toFixed(2),
          '',
          '',
          submittedAt,
        ]);
      });
    }

    // Add a row for each downtime entry
    if (item.downtimeEntries && item.downtimeEntries.length > 0) {
      item.downtimeEntries.forEach(d => {
        rows.push([
          ...baseRow,
          'Downtime',
          '',
          '',
          d.downtimeReason,
          d.downtime.toString(),
          submittedAt,
        ]);
      });
    }

    // If no entries at all, still add one summary row
    if ((!item.wasteEntries || item.wasteEntries.length === 0) &&
      (!item.downtimeEntries || item.downtimeEntries.length === 0)) {
      rows.push([
        ...baseRow,
        'Summary',
        '',
        item.totalWaste.toFixed(2),
        '',
        item.totalDowntime.toString(),
        submittedAt,
      ]);
    }
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Clean up the object URL to prevent memory leak
  URL.revokeObjectURL(url);
};

// Clear all history (for testing)
export const clearHistory = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MACHINES_KEY);
};
