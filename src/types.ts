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
  lastSubmission?: string;
  todayWaste?: number;
  todayDowntime?: number;
  subMachineCount?: number; // Number of sub-machines (e.g., 4 for "Universal 2")
}

export const OPERATORS = [
  'John Doe',
  'Jane Smith',
  'Mike Johnson',
  'Sarah Williams',
  'David Brown',
];

export const MACHINES: Machine[] = [
  { id: 'machine-a', name: 'Machine A', status: 'running', currentOperator: 'John Doe' },
  { id: 'machine-b', name: 'Machine B', status: 'idle' },
  { id: 'machine-c', name: 'Machine C', status: 'running', currentOperator: 'Jane Smith' },
  { id: 'machine-d', name: 'Machine D', status: 'maintenance' },
  { id: 'machine-e', name: 'Machine E', status: 'running', currentOperator: 'Mike Johnson' },
  { id: 'machine-f', name: 'Machine F', status: 'idle' },
];

export const WASTE_TYPES = [
  'Powder',
  'Corro',
  'Reel',
  'Label',
  'Display',
  'Tray',
];

export const PLANNED_DOWNTIME_REASONS = [
  'PPM',
  'Training',
  'Meeting',
  'ChangeOver',
  'Cleaning/CIP',
  'Lunch/Tea Break',
  'SetUp',
];

export const UNPLANNED_DOWNTIME_REASONS = [
  'Absenteeism',
  'Compressed Air',
  'Electrical',
  'Mechanical',
  'Packaging Material',
  'Power',
  'Quality Control',
  'Raw Material',
  'Room Condition',
  'Set-Up',
  'Steam',
  'Stock Count',
  'Strike',
  'Water',
];

// Combined for backwards compatibility
export const DOWNTIME_REASONS = [...PLANNED_DOWNTIME_REASONS, ...UNPLANNED_DOWNTIME_REASONS];

export const ORDER_NUMBERS = [
  'ORD-001',
  'ORD-002',
  'ORD-003',
  'ORD-004',
  'ORD-005',
];

export const PRODUCTS = [
  'Product X',
  'Product Y',
  'Product Z',
  'Product W',
];

export const BATCH_NUMBERS = [
  'BATCH-100',
  'BATCH-101',
  'BATCH-102',
  'BATCH-103',
];
