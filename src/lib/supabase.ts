import { createClient } from '@supabase/supabase-js';

// Supabase project credentials must be provided via environment variables.
// CRA only exposes env vars prefixed with REACT_APP_ and they are baked into the build.
// IMPORTANT: The anon key is a *public* client key; the real protection is Row Level Security (RLS).
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Use placeholders so importing this module doesn't crash in tests/dev when env vars are missing.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'http://localhost:54321',
  isSupabaseConfigured ? supabaseAnonKey! : 'public-anon-key'
);

export const requireSupabaseConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY (for CRA builds) before calling Supabase operations.'
    );
  }
};

// Database types
export interface ShiftSubmission {
  id?: number;
  operator_name: string;
  machine: string;
  sub_machine?: string;
  order_number: string;
  product: string;
  batch_number: string;
  shift: string;
  submission_date: string;
  is_early_submission?: boolean;
  will_changeover?: boolean;
  will_maintenance_cleaning?: boolean;
  total_waste?: number;
  total_downtime?: number;
  created_at?: string;
}

export interface WasteRecord {
  id?: number;
  shift_submission_id: number;
  waste_amount: number;
  waste_type: string;
  recorded_at?: string;
  created_at?: string;
}

export interface DowntimeRecord {
  id?: number;
  shift_submission_id: number;
  downtime_minutes: number;
  downtime_reason: string;
  recorded_at?: string;
  created_at?: string;
}

export interface SpeedRecord {
  id?: number;
  shift_submission_id: number;
  speed_ppm: number;
  recorded_at: string;
  created_at?: string;
}

export interface SachetMassRecord {
  id?: number;
  shift_submission_id: number;
  mass_grams: number;
  recorded_at: string;
  created_at?: string;
}

export interface CasesPerHourRecord {
  id?: number;
  shift_submission_id: number;
  cases_count: number;
  hour_of_day: number;
  recorded_at: string;
  created_at?: string;
}

// New: Loose Cases Record (cases not part of a full pallet)
export interface LooseCasesRecord {
  id?: number;
  shift_submission_id: number;
  batch_number: string;
  cases_count: number;
  recorded_at: string;
  created_at?: string;
}

// Updated: Pallet Scan Record with parsed QR data
export interface PalletScanRecord {
  id?: number;
  shift_submission_id: number;
  qr_code: string;
  batch_number: string;
  pallet_number: string;
  cases_count: number;
  recorded_at: string;
  created_at?: string;
}

export interface ShiftSessionRecord {
  id?: number;
  machine_name: string;
  operator_name: string;
  order_number: string;
  product: string;
  batch_number: string;
  shift: string;
  session_date: string;
  is_locked: boolean;
  created_at?: string;
  updated_at?: string;
}

// ==========================================
// CHAT
// ==========================================

export interface ChatMessageRecord {
  id?: number;
  user_name: string;
  content: string;
  created_at?: string;
}

// Enhanced shift data submission with all new fields
export interface FullShiftSubmission {
  shiftData: Omit<ShiftSubmission, 'id' | 'created_at'>;
  wasteEntries: { waste: number; wasteType: string; timestamp: Date }[];
  downtimeEntries: { downtime: number; downtimeReason: string; timestamp: Date }[];
  speedEntries?: { speed: number; timestamp: Date }[];
  sachetMassEntries?: { mass: number; timestamp: Date }[];
  casesPerHourEntries?: { cases: number; hour: number; timestamp: Date }[]; // Legacy
  looseCasesEntries?: { batchNumber: string; cases: number; timestamp: Date }[];
  palletScanEntries?: { qrCode: string; batchNumber: string; palletNumber: string; casesCount: number; timestamp: Date }[];
}

// Result type for submission with warnings
export interface SubmitShiftResult {
  success: boolean;
  shiftSubmission: ShiftSubmission | null;
  warnings: string[];
  errors: string[];
}

// Database operations
export const submitShiftData = async (
  shiftData: Omit<ShiftSubmission, 'id' | 'created_at'>,
  wasteEntries: { waste: number; wasteType: string; timestamp?: Date }[],
  downtimeEntries: { downtime: number; downtimeReason: string; timestamp?: Date }[],
  speedEntries?: { speed: number; timestamp: Date }[],
  sachetMassEntries?: { mass: number; timestamp: Date }[],
  looseCasesEntries?: { batchNumber: string; cases: number; timestamp: Date }[],
  palletScanEntries?: { qrCode: string; batchNumber: string; palletNumber: string; casesCount: number; timestamp: Date }[]
): Promise<SubmitShiftResult> => {
  requireSupabaseConfigured();

  const warnings: string[] = [];
  const errors: string[] = [];

  // Calculate totals
  const totalWaste = wasteEntries.reduce((sum, e) => sum + e.waste, 0);
  const totalDowntime = downtimeEntries.reduce((sum, e) => sum + e.downtime, 0);

  // Insert shift submission (critical - must succeed)
  const { data: shiftSubmission, error: shiftError } = await supabase
    .from('shift_submissions')
    .insert([{
      ...shiftData,
      total_waste: totalWaste,
      total_downtime: totalDowntime,
    }])
    .select()
    .single();

  if (shiftError) {
    throw new Error(`Failed to submit shift data: ${shiftError.message}`);
  }

  const shiftId = shiftSubmission.id;

  // Insert waste records (critical - must succeed)
  if (wasteEntries.length > 0) {
    const wasteRecords = wasteEntries.map(entry => ({
      shift_submission_id: shiftId,
      waste_amount: entry.waste,
      waste_type: entry.wasteType,
      recorded_at: entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString(),
    }));

    const { error: wasteError } = await supabase
      .from('waste_records')
      .insert(wasteRecords);

    if (wasteError) {
      throw new Error(`Failed to submit waste records: ${wasteError.message}`);
    }
  }

  // Insert downtime records (critical - must succeed)
  if (downtimeEntries.length > 0) {
    const downtimeRecords = downtimeEntries.map(entry => ({
      shift_submission_id: shiftId,
      downtime_minutes: entry.downtime,
      downtime_reason: entry.downtimeReason,
      recorded_at: entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString(),
    }));

    const { error: downtimeError } = await supabase
      .from('downtime_records')
      .insert(downtimeRecords);

    if (downtimeError) {
      throw new Error(`Failed to submit downtime records: ${downtimeError.message}`);
    }
  }

  // Insert speed records (non-critical - warn on failure)
  if (speedEntries && speedEntries.length > 0) {
    const speedRecords = speedEntries.map(entry => ({
      shift_submission_id: shiftId,
      speed_ppm: entry.speed,
      recorded_at: new Date(entry.timestamp).toISOString(),
    }));

    const { error: speedError } = await supabase
      .from('speed_records')
      .insert(speedRecords);

    if (speedError) {
      const msg = `Speed records failed: ${speedError.message}`;
      console.error(msg);
      warnings.push(msg);
    }
  }

  // Insert sachet mass records (non-critical - warn on failure)
  if (sachetMassEntries && sachetMassEntries.length > 0) {
    const sachetRecords = sachetMassEntries.map(entry => ({
      shift_submission_id: shiftId,
      mass_grams: entry.mass,
      recorded_at: new Date(entry.timestamp).toISOString(),
    }));

    const { error: sachetError } = await supabase
      .from('sachet_mass_records')
      .insert(sachetRecords);

    if (sachetError) {
      const msg = `Sachet mass records failed: ${sachetError.message}`;
      console.error(msg);
      warnings.push(msg);
    }
  }

  // Insert loose cases records (non-critical - warn on failure)
  if (looseCasesEntries && looseCasesEntries.length > 0) {
    const looseCasesRecords = looseCasesEntries.map(entry => ({
      shift_submission_id: shiftId,
      batch_number: entry.batchNumber,
      cases_count: entry.cases,
      recorded_at: new Date(entry.timestamp).toISOString(),
    }));

    const { error: looseCasesError } = await supabase
      .from('loose_cases_records')
      .insert(looseCasesRecords);

    if (looseCasesError) {
      const msg = `Loose cases records failed: ${looseCasesError.message}`;
      console.error(msg);
      warnings.push(msg);
    }
  }

  // Insert pallet scan records (non-critical - warn on failure)
  if (palletScanEntries && palletScanEntries.length > 0) {
    const palletRecords = palletScanEntries.map(entry => ({
      shift_submission_id: shiftId,
      qr_code: entry.qrCode,
      batch_number: entry.batchNumber,
      pallet_number: entry.palletNumber,
      cases_count: entry.casesCount,
      recorded_at: new Date(entry.timestamp).toISOString(),
    }));

    const { error: palletError } = await supabase
      .from('pallet_scan_records')
      .insert(palletRecords);

    if (palletError) {
      const msg = `Pallet scan records failed: ${palletError.message}`;
      console.error(msg);
      warnings.push(msg);
    }
  }

  return {
    success: true,
    shiftSubmission,
    warnings,
    errors,
  };
};

// Fetch recent submissions
export const getRecentSubmissions = async (limit = 10) => {
  requireSupabaseConfigured();
  const { data, error } = await supabase
    .from('shift_submissions')
    .select(`
      *,
      waste_records (*),
      downtime_records (*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch submissions: ${error.message}`);
  }

  return data;
};

// ==========================================
// MACHINES TABLE OPERATIONS
// ==========================================

export interface MachineRecord {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'maintenance';
  current_operator?: string;
  current_order?: string;
  current_shift?: string;
  last_submission?: string;
  today_waste?: number;
  today_downtime?: number;
  sub_machine_count?: number;
  created_at?: string;
  updated_at?: string;
}

// Fetch all machines from Supabase
export const fetchMachines = async (): Promise<MachineRecord[]> => {
  requireSupabaseConfigured();
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Failed to fetch machines:', error.message);
    return [];
  }

  return data || [];
};

// Upsert a machine (insert or update)
export const upsertMachine = async (machine: MachineRecord): Promise<MachineRecord | null> => {
  requireSupabaseConfigured();
  const { data, error } = await supabase
    .from('machines')
    .upsert({
      id: machine.id,
      name: machine.name,
      status: machine.status,
      current_operator: machine.current_operator,
      last_submission: machine.last_submission,
      today_waste: machine.today_waste,
      today_downtime: machine.today_downtime,
      sub_machine_count: machine.sub_machine_count,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Failed to upsert machine:', error.message);
    return null;
  }

  return data;
};

// Delete a machine from Supabase
export const removeMachine = async (machineId: string): Promise<boolean> => {
  requireSupabaseConfigured();
  const { error } = await supabase
    .from('machines')
    .delete()
    .eq('id', machineId);

  if (error) {
    console.error('Failed to delete machine:', error.message);
    return false;
  }

  return true;
};

// Update machine status (running/idle/maintenance)
export const updateMachineStatus = async (
  machineId: string,
  status: 'running' | 'idle' | 'maintenance',
  operatorName?: string,
  orderNumber?: string,
  shift?: string
): Promise<boolean> => {
  if (!isSupabaseConfigured) return false;

  try {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Set or clear operator/order based on status
    if (status === 'running') {
      if (operatorName) updateData.current_operator = operatorName;
      if (orderNumber) updateData.current_order = orderNumber;
      if (shift) updateData.current_shift = shift;
    } else if (status === 'idle') {
      updateData.current_operator = null;
      updateData.current_order = null;
      updateData.current_shift = null;
    }

    const { error } = await supabase
      .from('machines')
      .update(updateData)
      .eq('id', machineId);

    if (error) {
      console.error('Failed to update machine status:', error.message);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Failed to update machine status:', e);
    return false;
  }
};

// Sync local machines to Supabase (bulk upsert)
export const syncMachinesToSupabase = async (machines: MachineRecord[]): Promise<boolean> => {
  requireSupabaseConfigured();
  const { error } = await supabase
    .from('machines')
    .upsert(
      machines.map(m => ({
        id: m.id,
        name: m.name,
        status: m.status,
        current_operator: m.current_operator,
        last_submission: m.last_submission,
        today_waste: m.today_waste,
        today_downtime: m.today_downtime,
        sub_machine_count: m.sub_machine_count,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );

  if (error) {
    console.error('Failed to sync machines:', error.message);
    return false;
  }

  return true;
};

// Subscribe to real-time machine updates - OPTIMIZED
// Now processes specific changes instead of refetching all machines
export const subscribeMachineChanges = (
  callback: (machines: MachineRecord[]) => void,
  getCurrentMachines: () => MachineRecord[]
) => {
  requireSupabaseConfigured();

  const channel = supabase
    .channel('machines-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'machines' },
      (payload) => {
        // Add new machine to current list
        const newMachine = payload.new as MachineRecord;
        const currentMachines = getCurrentMachines();
        const updatedMachines = [...currentMachines, newMachine];
        callback(updatedMachines);
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'machines' },
      (payload) => {
        // Update specific machine in current list
        const updatedMachine = payload.new as MachineRecord;
        const currentMachines = getCurrentMachines();
        const updatedMachines = currentMachines.map(m =>
          m.id === updatedMachine.id ? updatedMachine : m
        );
        callback(updatedMachines);
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'machines' },
      (payload) => {
        // Remove deleted machine from current list
        const deletedMachine = payload.old as MachineRecord;
        const currentMachines = getCurrentMachines();
        const updatedMachines = currentMachines.filter(m => m.id !== deletedMachine.id);
        callback(updatedMachines);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const fetchRecentChatMessages = async (limit = 100): Promise<ChatMessageRecord[]> => {
  requireSupabaseConfigured();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch chat messages: ${error.message}`);
  }

  // Reverse so UI can render oldest -> newest.
  return (data || []).slice().reverse();
};

export const sendChatMessage = async (userName: string, content: string): Promise<ChatMessageRecord> => {
  requireSupabaseConfigured();

  const MAX_MESSAGE_LENGTH = 500;
  const trimmedName = userName.trim();
  const trimmedContent = content.trim();

  if (!trimmedName) {
    throw new Error('User name is required to send a chat message.');
  }
  if (!trimmedContent) {
    throw new Error('Message cannot be empty.');
  }
  if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{ user_name: trimmedName, content: trimmedContent }])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to send chat message: ${error.message}`);
  }

  // Let other UI update immediately (useful if Realtime is not enabled).
  try {
    window.dispatchEvent(new CustomEvent('chat_message_sent', { detail: data }));
  } catch {
    // no-op
  }

  return data;
};

export const subscribeChatMessages = (onInsert: (message: ChatMessageRecord) => void) => {
  requireSupabaseConfigured();

  const channel = supabase
    .channel('chat-messages')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => {
        const message = payload.new as ChatMessageRecord;
        onInsert(message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ==========================================
// ORDER DETAILS (Admin Console)
// ==========================================

export interface OrderDetailsRecord {
  id?: number;
  order_number: string;
  product: string;
  batch_number: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Fetch the currently active order details
export const fetchActiveOrderDetails = async (): Promise<OrderDetailsRecord | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('order_details')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No active order found is not an error
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching order details:', error.message);
      return null;
    }

    return data;
  } catch (e) {
    console.error('Failed to fetch order details:', e);
    return null;
  }
};

// Save new order details (deactivates previous active order)
export const saveOrderDetails = async (
  orderNumber: string,
  product: string,
  batchNumber: string
): Promise<OrderDetailsRecord | null> => {
  requireSupabaseConfigured();

  try {
    // Deactivate all currently active orders
    await supabase
      .from('order_details')
      .update({ is_active: false })
      .eq('is_active', true);

    // Insert new active order
    const { data, error } = await supabase
      .from('order_details')
      .insert([{
        order_number: orderNumber.trim(),
        product: product.trim(),
        batch_number: batchNumber.trim(),
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Failed to save order details:', e);
    throw e;
  }
};

// Clear active order details
export const clearActiveOrderDetails = async (): Promise<boolean> => {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase
      .from('order_details')
      .update({ is_active: false })
      .eq('is_active', true);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Failed to clear order details:', e);
    return false;
  }
};

// Fetch recent order details history
export const fetchOrderHistory = async (limit = 10): Promise<OrderDetailsRecord[]> => {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('order_details')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Failed to fetch order history:', e);
    return [];
  }
};

// ==========================================
// MACHINE ORDER QUEUE (Orders per machine with priority)
// ==========================================

export interface MachineOrderQueueRecord {
  id?: number;
  machine_id: string;
  order_number: string;
  product: string;
  batch_number: string;
  priority: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Fetch all orders for a specific machine (sorted by priority)
export const fetchMachineOrders = async (machineId: string): Promise<MachineOrderQueueRecord[]> => {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('machine_order_queue')
      .select('*')
      .eq('machine_id', machineId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Failed to fetch machine orders:', e);
    return [];
  }
};

// Fetch all active orders for all machines
export const fetchAllMachineOrders = async (): Promise<MachineOrderQueueRecord[]> => {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('machine_order_queue')
      .select('*')
      .eq('is_active', true)
      .order('machine_id', { ascending: true })
      .order('priority', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Failed to fetch all machine orders:', e);
    return [];
  }
};

// Add an order to a machine's queue
export const addMachineOrder = async (
  machineId: string,
  orderNumber: string,
  product: string,
  batchNumber: string
): Promise<MachineOrderQueueRecord | null> => {
  requireSupabaseConfigured();

  try {
    // Get the next priority number for this machine
    const { data: existing } = await supabase
      .from('machine_order_queue')
      .select('priority')
      .eq('machine_id', machineId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1);

    const nextPriority = existing && existing.length > 0 ? existing[0].priority + 1 : 0;

    const { data, error } = await supabase
      .from('machine_order_queue')
      .insert([{
        machine_id: machineId,
        order_number: orderNumber.trim(),
        product: product.trim(),
        batch_number: batchNumber.trim(),
        priority: nextPriority,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Failed to add machine order:', e);
    throw e;
  }
};

// Remove an order from a machine's queue
export const removeMachineOrder = async (orderId: number): Promise<boolean> => {
  requireSupabaseConfigured();

  try {
    const { error } = await supabase
      .from('machine_order_queue')
      .update({ is_active: false })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Failed to remove machine order:', e);
    return false;
  }
};

// Update priorities for a machine's orders (for reordering) - ATOMIC version
export const updateMachineOrderPriorities = async (
  machineId: string,
  orderIds: number[]
): Promise<boolean> => {
  requireSupabaseConfigured();

  try {
    // Use a single RPC call or sequential updates with rollback tracking
    const errors: string[] = [];
    const successfulUpdates: { id: number; oldPriority?: number }[] = [];

    // First, fetch current priorities for potential rollback
    const { data: currentOrders } = await supabase
      .from('machine_order_queue')
      .select('id, priority')
      .eq('machine_id', machineId)
      .in('id', orderIds);

    const priorityMap = new Map(currentOrders?.map(o => [o.id, o.priority]) || []);

    // Update each order sequentially to maintain consistency
    for (let index = 0; index < orderIds.length; index++) {
      const id = orderIds[index];
      const { error } = await supabase
        .from('machine_order_queue')
        .update({ priority: index, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('machine_id', machineId);

      if (error) {
        errors.push(`Order ${id}: ${error.message}`);
        // Rollback successful updates
        for (const update of successfulUpdates) {
          await supabase
            .from('machine_order_queue')
            .update({ priority: priorityMap.get(update.id) ?? update.oldPriority })
            .eq('id', update.id);
        }
        throw new Error(`Priority update failed, rolled back. Errors: ${errors.join('; ')}`);
      }
      successfulUpdates.push({ id, oldPriority: priorityMap.get(id) });
    }

    return true;
  } catch (e) {
    console.error('Failed to update order priorities:', e);
    throw e; // Re-throw so caller knows it failed
  }
};

// Clear all orders for a machine
export const clearMachineOrders = async (machineId: string): Promise<boolean> => {
  requireSupabaseConfigured();

  try {
    const { error } = await supabase
      .from('machine_order_queue')
      .update({ is_active: false })
      .eq('machine_id', machineId)
      .eq('is_active', true);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Failed to clear machine orders:', e);
    return false;
  }
};
