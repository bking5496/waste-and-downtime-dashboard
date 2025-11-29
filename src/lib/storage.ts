import { ShiftData, Machine, MACHINES } from '../types';
import { 
  fetchMachines, 
  upsertMachine, 
  removeMachine, 
  syncMachinesToSupabase,
  subscribeMachineChanges,
  MachineRecord 
} from './supabase';

const STORAGE_KEY = 'waste_downtime_history';
const MACHINES_KEY = 'machines_data';
const MACHINES_SYNC_KEY = 'machines_last_sync';

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

// Subscribe to real-time machine updates
export const subscribeToMachineUpdates = (callback: (machines: Machine[]) => void) => {
  machinesListeners.push(callback);
  
  // Set up Supabase real-time subscription
  const unsubscribe = subscribeMachineChanges((records) => {
    machinesCache = records.map(toLocalMachine);
    localStorage.setItem(MACHINES_KEY, JSON.stringify(machinesCache));
    
    // Notify all listeners
    machinesListeners.forEach(listener => listener(machinesCache!));
  });
  
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
    'Total Waste (kg)',
    'Total Downtime (min)',
    'Submitted At',
  ];
  
  const rows = data.map(item => [
    item.date,
    item.shift,
    item.operatorName,
    item.machine,
    item.orderNumber,
    item.product,
    item.batchNumber,
    item.totalWaste.toFixed(2),
    item.totalDowntime.toString(),
    new Date(item.submittedAt).toLocaleString(),
  ]);
  
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
};

// Clear all history (for testing)
export const clearHistory = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MACHINES_KEY);
};
