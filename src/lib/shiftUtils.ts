/**
 * Shared utilities for shift-related calculations
 *
 * Shift Schedule (GMT+2):
 * - Day Shift: 06:00 - 18:00
 * - Night Shift: 18:00 - 06:00
 */

// GMT offset for the facility (South Africa = GMT+2)
export const GMT_OFFSET = 2;

// Shift boundaries in hours (24-hour format)
export const DAY_SHIFT_START = 6;  // 06:00
export const DAY_SHIFT_END = 18;   // 18:00

/**
 * Get the current shift based on time
 * @param date - Optional date to check (defaults to now)
 * @returns 'Day' or 'Night'
 */
export const getCurrentShift = (date: Date = new Date()): 'Day' | 'Night' => {
  const hours = date.getUTCHours() + GMT_OFFSET;
  return hours >= DAY_SHIFT_START && hours < DAY_SHIFT_END ? 'Day' : 'Night';
};

/**
 * Get the local hours adjusted for GMT offset
 * @param date - Optional date (defaults to now)
 * @returns Hours in 24-hour format
 */
export const getLocalHours = (date: Date = new Date()): number => {
  return date.getUTCHours() + GMT_OFFSET;
};

/**
 * Check if currently within submission window (15 min before/after shift end)
 * @param date - Optional date to check (defaults to now)
 * @returns Object with isInWindow and timeToWindow
 */
export const checkSubmissionWindow = (date: Date = new Date()): {
  isInWindow: boolean;
  timeToWindow: string;
  shiftEndMinutes: number;
} => {
  const hours = getLocalHours(date);
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // Day shift ends at 18:00 (1080 min), Night shift ends at 06:00 (360 min)
  const dayShiftEnd = DAY_SHIFT_END * 60; // 1080
  const nightShiftEnd = DAY_SHIFT_START * 60; // 360
  const windowSize = 15; // 15 minutes before/after

  // Determine which shift end we're closest to
  const currentShift = getCurrentShift(date);
  const shiftEndMinutes = currentShift === 'Day' ? dayShiftEnd : nightShiftEnd;

  // Calculate if within window
  let minutesToEnd: number;
  if (currentShift === 'Day') {
    minutesToEnd = dayShiftEnd - totalMinutes;
  } else {
    // Night shift - handle midnight crossing
    if (totalMinutes >= DAY_SHIFT_END * 60) {
      minutesToEnd = (24 * 60 - totalMinutes) + nightShiftEnd;
    } else {
      minutesToEnd = nightShiftEnd - totalMinutes;
    }
  }

  const isInWindow = minutesToEnd <= windowSize && minutesToEnd >= -windowSize;

  // Format time to window
  let timeToWindow = '';
  if (minutesToEnd > windowSize) {
    const hoursToWindow = Math.floor((minutesToEnd - windowSize) / 60);
    const minsToWindow = (minutesToEnd - windowSize) % 60;
    if (hoursToWindow > 0) {
      timeToWindow = `${hoursToWindow}h ${minsToWindow}m until submission window`;
    } else {
      timeToWindow = `${minsToWindow}m until submission window`;
    }
  } else if (minutesToEnd < -windowSize) {
    timeToWindow = 'Submission window closed';
  } else {
    timeToWindow = 'In submission window';
  }

  return { isInWindow, timeToWindow, shiftEndMinutes };
};

/**
 * Get today's date string in ISO format (YYYY-MM-DD)
 * @returns Date string
 */
export const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Generate session key for localStorage
 * @param machineName - Name of the machine
 * @param shift - Current shift ('Day' or 'Night')
 * @param date - Date string (YYYY-MM-DD)
 * @returns Session key string
 */
export const getSessionKey = (machineName: string, shift: string, date: string): string => {
  return `shift_session_${machineName}_${shift}_${date}`;
};
