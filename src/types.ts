export interface WasteEntry {
  id: string;
  waste: number;
  wasteType: string;
  timestamp: Date;
}

export interface DowntimeEntry {
  id: string;
  downtime: number;
  downtimeReason: string;
  notes?: string;
  timestamp: Date;
}

// Production timer state for tracking run time and pauses
export interface ProductionState {
  isRunning: boolean;
  startTime: Date | null;       // When production started
  pausedAt: Date | null;        // When current pause began
  totalRunTimeMs: number;       // Accumulated run time in milliseconds
  lastResumedAt: Date | null;   // When last resumed from pause
}

export interface SpeedEntry {
  id: string;
  speed: number;
  timestamp: Date;
}

export interface SachetMassEntry {
  id: string;
  mass: number; // in grams
  timestamp: Date;
  ignored?: boolean; // Can be set to ignore but not deleted
}

// Loose cases entry - for cases not part of a full pallet
export interface LooseCasesEntry {
  id: string;
  batchNumber: string; // 5-digit batch number
  cases: number; // number of loose cases
  timestamp: Date;
  ignored?: boolean;
}

// Pallet Scan entry - QR code is 13 digits: BBBBBPPPPCCCC
// B = batch number (5 digits), P = pallet number (4 digits), C = cases count (4 digits)
export interface PalletScanEntry {
  id: string;
  qrCode: string; // Full 13-digit QR code
  batchNumber: string; // Extracted: first 5 digits
  palletNumber: string; // Extracted: digits 6-9 (4 digits)
  casesCount: number; // Extracted: last 4 digits
  timestamp: Date;
  ignored?: boolean;
}

// Legacy CasesPerHourEntry - kept for backwards compatibility
export interface CasesPerHourEntry {
  id: string;
  cases: number;
  hour: number;
  timestamp: Date;
  ignored?: boolean;
}

export interface ShiftData {
  id: string;
  operatorName: string;
  machine: string;
  subMachine?: string; // For machines that are groups (e.g., "Universal 2 - Machine 1")
  orderNumber: string;
  product: string;
  batchNumber: string;
  shift: string;
  date: string;
  wasteEntries: WasteEntry[];
  downtimeEntries: DowntimeEntry[];
  speedEntries?: SpeedEntry[];
  sachetMassEntries?: SachetMassEntry[];
  casesPerHourEntries?: CasesPerHourEntry[]; // Legacy - kept for backwards compatibility
  looseCasesEntries?: LooseCasesEntry[]; // New: loose cases with batch number
  palletScanEntries?: PalletScanEntry[];
  submittedAt: Date;
  totalWaste: number;
  totalDowntime: number;
}

export interface ShiftSession {
  machineName: string;
  operatorName: string;
  orderNumber: string;
  product: string;
  batchNumber: string;
  shift: string;
  date: string;
  locked: boolean; // Once set, these values are locked for the shift
  // Entry data persisted with session
  wasteEntries?: WasteEntry[];
  downtimeEntries?: DowntimeEntry[];
  speedEntries?: SpeedEntry[];
  sachetMassEntries?: SachetMassEntry[];
  casesPerHourEntries?: CasesPerHourEntry[]; // Legacy
  looseCasesEntries?: LooseCasesEntry[]; // New
  palletScanEntries?: PalletScanEntry[];
}

export interface Machine {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'maintenance';
  currentOperator?: string;
  currentOrder?: string;
  currentShift?: string;
  lastSubmission?: string;
  todayWaste?: number;
  todayDowntime?: number;
  subMachineCount?: number; // Number of sub-machines (e.g., 4 for "Universal 2")
}

// ==============================================
// DEFAULT DATA
// ==============================================

export const OPERATORS: string[] = [];
export const MACHINES: Machine[] = [];

// Waste Types - common manufacturing waste categories
export const WASTE_TYPES: string[] = [
  'Start-up Waste',
  'Changeover Waste',
  'Defective Product',
  'Material Spillage',
];

// Downtime Reasons - categorized by planned vs unplanned
export const PLANNED_DOWNTIME_REASONS: string[] = [
  'Scheduled Maintenance',
  'Changeover',
];

export const UNPLANNED_DOWNTIME_REASONS: string[] = [
  'Machine Breakdown',
  'Material Shortage',
];

// Combined downtime reasons for selection
export const DOWNTIME_REASONS: string[] = [
  'Machine Breakdown',
  'Scheduled Maintenance',
  'Changeover',
  'Material Shortage',
];

export const ORDER_NUMBERS: string[] = [];
export const PRODUCTS: string[] = [];
export const BATCH_NUMBERS: string[] = [];

