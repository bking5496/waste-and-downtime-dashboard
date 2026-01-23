/**
 * Facility Settings Management
 * Configurable settings for shift times, timezone, and other facility-specific options
 * Settings are stored in localStorage and can be managed via Admin Console
 */

const FACILITY_SETTINGS_KEY = 'facility_settings';

// Default facility settings
export interface FacilitySettings {
  // Timezone offset from UTC (e.g., 2 for GMT+2)
  timezoneOffset: number;

  // Shift configuration (24-hour format)
  dayShiftStart: number;  // Hour when day shift starts (e.g., 6 for 06:00)
  dayShiftEnd: number;    // Hour when day shift ends (e.g., 18 for 18:00)

  // Submission window configuration
  submissionWindowMinutes: number;  // Minutes before/after shift end to allow submission

  // Facility info
  facilityName: string;
  facilityLocation: string;

  // Session settings
  sessionLockingEnabled: boolean;
  maxConcurrentSessions: number;

  // Data retention
  historyRetentionDays: number;

  // Last updated
  updatedAt?: string;
}

// Default values (South Africa facility)
export const DEFAULT_SETTINGS: FacilitySettings = {
  timezoneOffset: 2,           // GMT+2 (South Africa)
  dayShiftStart: 6,            // 06:00
  dayShiftEnd: 18,             // 18:00
  submissionWindowMinutes: 15,  // 15 min before/after shift end
  facilityName: 'Production Facility',
  facilityLocation: 'South Africa',
  sessionLockingEnabled: true,
  maxConcurrentSessions: 1,
  historyRetentionDays: 90,
};

/**
 * Get current facility settings
 * Returns stored settings merged with defaults
 */
export const getFacilitySettings = (): FacilitySettings => {
  try {
    const stored = localStorage.getItem(FACILITY_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load facility settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
};

/**
 * Save facility settings
 * @param settings - Partial settings to update
 */
export const saveFacilitySettings = (settings: Partial<FacilitySettings>): FacilitySettings => {
  const current = getFacilitySettings();
  const updated: FacilitySettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(FACILITY_SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save facility settings:', e);
  }

  return updated;
};

/**
 * Reset facility settings to defaults
 */
export const resetFacilitySettings = (): FacilitySettings => {
  const defaults = { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(FACILITY_SETTINGS_KEY, JSON.stringify(defaults));
  } catch (e) {
    console.error('Failed to reset facility settings:', e);
  }
  return defaults;
};

// ==========================================
// SHIFT CALCULATION UTILITIES
// ==========================================

/**
 * Get local hours adjusted for facility timezone
 */
export const getLocalHours = (date: Date = new Date()): number => {
  const settings = getFacilitySettings();
  return date.getUTCHours() + settings.timezoneOffset;
};

/**
 * Get current shift based on facility settings
 */
export const getCurrentShift = (date: Date = new Date()): 'Day' | 'Night' => {
  const settings = getFacilitySettings();
  const hours = getLocalHours(date);
  return hours >= settings.dayShiftStart && hours < settings.dayShiftEnd ? 'Day' : 'Night';
};

/**
 * Check if within submission window
 */
export const checkSubmissionWindow = (date: Date = new Date()): {
  isInWindow: boolean;
  timeToWindow: string;
  minutesToShiftEnd: number;
} => {
  const settings = getFacilitySettings();
  const hours = getLocalHours(date);
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const dayShiftEndMinutes = settings.dayShiftEnd * 60;
  const nightShiftEndMinutes = settings.dayShiftStart * 60;
  const windowSize = settings.submissionWindowMinutes;

  const currentShift = getCurrentShift(date);

  // Calculate minutes to shift end
  let minutesToEnd: number;
  if (currentShift === 'Day') {
    minutesToEnd = dayShiftEndMinutes - totalMinutes;
  } else {
    // Night shift - handle midnight crossing
    if (totalMinutes >= settings.dayShiftEnd * 60) {
      minutesToEnd = (24 * 60 - totalMinutes) + nightShiftEndMinutes;
    } else {
      minutesToEnd = nightShiftEndMinutes - totalMinutes;
    }
  }

  const isInWindow = minutesToEnd <= windowSize && minutesToEnd >= -windowSize;

  // Format time to window
  let timeToWindow = '';
  if (minutesToEnd > windowSize) {
    const hoursToWindow = Math.floor((minutesToEnd - windowSize) / 60);
    const minsToWindow = (minutesToEnd - windowSize) % 60;
    if (hoursToWindow > 0) {
      timeToWindow = `${hoursToWindow}h ${minsToWindow}m until window`;
    } else {
      timeToWindow = `${minsToWindow}m until window`;
    }
  } else if (minutesToEnd < -windowSize) {
    timeToWindow = 'Window closed';
  } else {
    timeToWindow = 'In submission window';
  }

  return { isInWindow, timeToWindow, minutesToShiftEnd: minutesToEnd };
};

/**
 * Get shift end time as a Date object
 */
export const getShiftEndTime = (shift: 'Day' | 'Night', date: Date = new Date()): Date => {
  const settings = getFacilitySettings();
  const result = new Date(date);

  if (shift === 'Day') {
    result.setUTCHours(settings.dayShiftEnd - settings.timezoneOffset, 0, 0, 0);
  } else {
    // Night shift ends next day at dayShiftStart
    result.setUTCHours(settings.dayShiftStart - settings.timezoneOffset, 0, 0, 0);
    if (date.getUTCHours() + settings.timezoneOffset >= settings.dayShiftEnd) {
      result.setDate(result.getDate() + 1);
    }
  }

  return result;
};

/**
 * Format shift times for display
 */
export const formatShiftTimes = (): { day: string; night: string } => {
  const settings = getFacilitySettings();
  const formatHour = (h: number) => h.toString().padStart(2, '0') + ':00';

  return {
    day: `${formatHour(settings.dayShiftStart)} - ${formatHour(settings.dayShiftEnd)}`,
    night: `${formatHour(settings.dayShiftEnd)} - ${formatHour(settings.dayShiftStart)}`,
  };
};
