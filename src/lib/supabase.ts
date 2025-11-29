import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
// You can find these in your Supabase project settings > API
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://inmrzpmuzwcltionxzcl.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubXJ6cG11endjbHRpb254emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDcwOTgsImV4cCI6MjA3OTY4MzA5OH0._h4OM9Xblj-N3A9F_jMcUfLrASE6VCGvBfnN04ZhiNI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export interface PalletScanRecord {
  id?: number;
  shift_submission_id: number;
  qr_code: string;
  pallet_id?: string;
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

// Enhanced shift data submission with all new fields
export interface FullShiftSubmission {
  shiftData: Omit<ShiftSubmission, 'id' | 'created_at'>;
  wasteEntries: { waste: number; wasteType: string; timestamp: Date }[];
  downtimeEntries: { downtime: number; downtimeReason: string; timestamp: Date }[];
  speedEntries?: { speed: number; timestamp: Date }[];
  sachetMassEntries?: { mass: number; timestamp: Date }[];
  casesPerHourEntries?: { cases: number; hour: number; timestamp: Date }[];
  palletScanEntries?: { qrCode: string; palletId?: string; timestamp: Date }[];
}

// Database operations
export const submitShiftData = async (
  shiftData: Omit<ShiftSubmission, 'id' | 'created_at'>,
  wasteEntries: { waste: number; wasteType: string; timestamp?: Date }[],
  downtimeEntries: { downtime: number; downtimeReason: string; timestamp?: Date }[],
  speedEntries?: { speed: number; timestamp: Date }[],
  sachetMassEntries?: { mass: number; timestamp: Date }[],
  casesPerHourEntries?: { cases: number; hour: number; timestamp: Date }[],
  palletScanEntries?: { qrCode: string; palletId?: string; timestamp: Date }[]
) => {
  // Calculate totals
  const totalWaste = wasteEntries.reduce((sum, e) => sum + e.waste, 0);
  const totalDowntime = downtimeEntries.reduce((sum, e) => sum + e.downtime, 0);

  // Insert shift submission
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

  // Insert waste records
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

  // Insert downtime records
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

  // Insert speed records
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
      console.error('Failed to submit speed records:', speedError.message);
    }
  }

  // Insert sachet mass records
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
      console.error('Failed to submit sachet mass records:', sachetError.message);
    }
  }

  // Insert cases per hour records
  if (casesPerHourEntries && casesPerHourEntries.length > 0) {
    const casesRecords = casesPerHourEntries.map(entry => ({
      shift_submission_id: shiftId,
      cases_count: entry.cases,
      hour_of_day: entry.hour,
      recorded_at: new Date(entry.timestamp).toISOString(),
    }));

    const { error: casesError } = await supabase
      .from('cases_per_hour_records')
      .insert(casesRecords);

    if (casesError) {
      console.error('Failed to submit cases per hour records:', casesError.message);
    }
  }

  // Insert pallet scan records
  if (palletScanEntries && palletScanEntries.length > 0) {
    const palletRecords = palletScanEntries.map(entry => ({
      shift_submission_id: shiftId,
      qr_code: entry.qrCode,
      pallet_id: entry.palletId || null,
      recorded_at: new Date(entry.timestamp).toISOString(),
    }));

    const { error: palletError } = await supabase
      .from('pallet_scan_records')
      .insert(palletRecords);

    if (palletError) {
      console.error('Failed to submit pallet scan records:', palletError.message);
    }
  }

  return shiftSubmission;
};

// Fetch recent submissions
export const getRecentSubmissions = async (limit = 10) => {
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
  last_submission?: string;
  today_waste?: number;
  today_downtime?: number;
  sub_machine_count?: number;
  created_at?: string;
  updated_at?: string;
}

// Fetch all machines from Supabase
export const fetchMachines = async (): Promise<MachineRecord[]> => {
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

// Sync local machines to Supabase (bulk upsert)
export const syncMachinesToSupabase = async (machines: MachineRecord[]): Promise<boolean> => {
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

// Subscribe to real-time machine updates
export const subscribeMachineChanges = (callback: (machines: MachineRecord[]) => void) => {
  const channel = supabase
    .channel('machines-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'machines' },
      async () => {
        // Fetch all machines when any change occurs
        const machines = await fetchMachines();
        callback(machines);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
