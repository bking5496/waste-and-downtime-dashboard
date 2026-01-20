/**
 * Session Manager
 * Handles session locking to prevent concurrent edits and production timer persistence
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { getFacilitySettings } from './facilitySettings';
import { logError, showWarning, showInfo } from './errorMonitoring';

// ==========================================
// SESSION LOCKING
// ==========================================

export interface ActiveSession {
  id: string;
  machine_name: string;
  operator_name: string;
  shift: string;
  session_date: string;
  browser_id: string;
  started_at: string;
  last_heartbeat: string;
  is_active: boolean;
}

// Generate unique browser ID (persisted in sessionStorage)
const getBrowserId = (): string => {
  let browserId = sessionStorage.getItem('browser_session_id');
  if (!browserId) {
    browserId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('browser_session_id', browserId);
  }
  return browserId;
};

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
// Session considered stale after 2 minutes without heartbeat
const SESSION_STALE_THRESHOLD = 2 * 60 * 1000;

// Active heartbeat timers
const heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Check if another session is actively using this machine/shift
 */
export const checkForActiveSession = async (
  machineName: string,
  shift: string,
  sessionDate: string
): Promise<{ hasConflict: boolean; activeSession?: ActiveSession; isOwnSession?: boolean }> => {
  if (!isSupabaseConfigured) {
    return { hasConflict: false };
  }

  const settings = getFacilitySettings();
  if (!settings.sessionLockingEnabled) {
    return { hasConflict: false };
  }

  try {
    const { data: sessions, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('machine_name', machineName)
      .eq('shift', shift)
      .eq('session_date', sessionDate)
      .eq('is_active', true);

    if (error) {
      logError('Failed to check active sessions', { context: error.message, showToast: false });
      return { hasConflict: false }; // Fail open
    }

    if (!sessions || sessions.length === 0) {
      return { hasConflict: false };
    }

    const browserId = getBrowserId();
    const now = Date.now();

    // Check each session
    for (const session of sessions) {
      const lastHeartbeat = new Date(session.last_heartbeat).getTime();
      const isStale = (now - lastHeartbeat) > SESSION_STALE_THRESHOLD;

      if (session.browser_id === browserId) {
        // This is our own session
        return { hasConflict: false, activeSession: session, isOwnSession: true };
      }

      if (!isStale) {
        // Another browser has an active session
        return { hasConflict: true, activeSession: session, isOwnSession: false };
      }
    }

    return { hasConflict: false };
  } catch (e) {
    logError('Error checking session lock', { context: String(e), showToast: false });
    return { hasConflict: false }; // Fail open
  }
};

/**
 * Acquire session lock
 */
export const acquireSessionLock = async (
  machineName: string,
  operatorName: string,
  shift: string,
  sessionDate: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured) {
    return { success: true }; // Offline mode - no locking
  }

  const settings = getFacilitySettings();
  if (!settings.sessionLockingEnabled) {
    return { success: true };
  }

  const browserId = getBrowserId();
  const now = new Date().toISOString();

  try {
    // First check for conflicts
    const { hasConflict, activeSession } = await checkForActiveSession(machineName, shift, sessionDate);

    if (hasConflict && activeSession) {
      return {
        success: false,
        error: `Machine is being used by ${activeSession.operator_name} (started at ${new Date(activeSession.started_at).toLocaleTimeString()})`,
      };
    }

    // Clean up any stale sessions for this machine
    await supabase
      .from('active_sessions')
      .delete()
      .eq('machine_name', machineName)
      .eq('shift', shift)
      .eq('session_date', sessionDate)
      .lt('last_heartbeat', new Date(Date.now() - SESSION_STALE_THRESHOLD).toISOString());

    // Upsert our session
    const { error } = await supabase
      .from('active_sessions')
      .upsert({
        machine_name: machineName,
        operator_name: operatorName,
        shift,
        session_date: sessionDate,
        browser_id: browserId,
        started_at: now,
        last_heartbeat: now,
        is_active: true,
      }, {
        onConflict: 'machine_name,shift,session_date,browser_id',
      });

    if (error) {
      logError('Failed to acquire session lock', { context: error.message });
      return { success: false, error: 'Failed to acquire session lock' };
    }

    // Start heartbeat
    startHeartbeat(machineName, shift, sessionDate, browserId);

    return { success: true };
  } catch (e) {
    logError('Error acquiring session lock', { context: String(e) });
    return { success: false, error: 'Failed to acquire session lock' };
  }
};

/**
 * Release session lock
 */
export const releaseSessionLock = async (
  machineName: string,
  shift: string,
  sessionDate: string
): Promise<void> => {
  if (!isSupabaseConfigured) return;

  const browserId = getBrowserId();
  const sessionKey = `${machineName}_${shift}_${sessionDate}`;

  // Stop heartbeat
  const timer = heartbeatTimers.get(sessionKey);
  if (timer) {
    clearInterval(timer);
    heartbeatTimers.delete(sessionKey);
  }

  try {
    await supabase
      .from('active_sessions')
      .delete()
      .eq('machine_name', machineName)
      .eq('shift', shift)
      .eq('session_date', sessionDate)
      .eq('browser_id', browserId);
  } catch (e) {
    logError('Error releasing session lock', { context: String(e), showToast: false });
  }
};

/**
 * Start heartbeat to maintain session lock
 */
const startHeartbeat = (
  machineName: string,
  shift: string,
  sessionDate: string,
  browserId: string
): void => {
  const sessionKey = `${machineName}_${shift}_${sessionDate}`;

  // Clear existing heartbeat if any
  const existing = heartbeatTimers.get(sessionKey);
  if (existing) {
    clearInterval(existing);
  }

  const timer = setInterval(async () => {
    try {
      const { error } = await supabase
        .from('active_sessions')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('machine_name', machineName)
        .eq('shift', shift)
        .eq('session_date', sessionDate)
        .eq('browser_id', browserId);

      if (error) {
        logError('Heartbeat failed', { context: error.message, showToast: false });
      }
    } catch (e) {
      // Silently fail - will be detected on next check
    }
  }, HEARTBEAT_INTERVAL);

  heartbeatTimers.set(sessionKey, timer);
};

/**
 * Subscribe to session conflicts (real-time)
 */
export const subscribeToSessionConflicts = (
  machineName: string,
  shift: string,
  sessionDate: string,
  onConflict: (session: ActiveSession) => void
): (() => void) => {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const browserId = getBrowserId();

  const channel = supabase
    .channel(`session_${machineName}_${shift}_${sessionDate}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'active_sessions',
        filter: `machine_name=eq.${machineName}`,
      },
      (payload) => {
        const session = payload.new as ActiveSession;
        if (session.browser_id !== browserId && session.shift === shift && session.session_date === sessionDate) {
          showWarning(`Another user (${session.operator_name}) is accessing this machine`);
          onConflict(session);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ==========================================
// PRODUCTION TIMER PERSISTENCE
// ==========================================

export interface ProductionTimerState {
  isRunning: boolean;
  startTime: string | null;  // ISO string
  pausedAt: string | null;   // ISO string
  totalRunTimeMs: number;
  lastResumedAt: string | null; // ISO string
  pauseHistory: Array<{
    pausedAt: string;
    resumedAt: string;
    durationMs: number;
    reason?: string;
  }>;
}

const TIMER_STORAGE_KEY_PREFIX = 'production_timer_';

/**
 * Get timer storage key
 */
const getTimerKey = (machineName: string, shift: string, date: string): string => {
  return `${TIMER_STORAGE_KEY_PREFIX}${machineName}_${shift}_${date}`;
};

/**
 * Save production timer state
 */
export const saveProductionTimer = (
  machineName: string,
  shift: string,
  date: string,
  state: ProductionTimerState
): void => {
  const key = getTimerKey(machineName, shift, date);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    logError('Failed to save production timer', { context: String(e), showToast: false });
  }

  // Also sync to Supabase if configured
  if (isSupabaseConfigured) {
    syncTimerToSupabase(machineName, shift, date, state);
  }
};

/**
 * Load production timer state
 */
export const loadProductionTimer = async (
  machineName: string,
  shift: string,
  date: string
): Promise<ProductionTimerState | null> => {
  const key = getTimerKey(machineName, shift, date);

  // First try localStorage
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    logError('Failed to load production timer from localStorage', { context: String(e), showToast: false });
  }

  // Fallback to Supabase
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('production_timer')
        .eq('machine_name', machineName)
        .eq('shift', shift)
        .eq('session_date', date)
        .single();

      if (!error && data?.production_timer) {
        return data.production_timer as ProductionTimerState;
      }
    } catch (e) {
      // Supabase fetch failed - return null
    }
  }

  return null;
};

/**
 * Clear production timer
 */
export const clearProductionTimer = (
  machineName: string,
  shift: string,
  date: string
): void => {
  const key = getTimerKey(machineName, shift, date);
  localStorage.removeItem(key);
};

/**
 * Sync timer to Supabase
 */
const syncTimerToSupabase = async (
  machineName: string,
  shift: string,
  date: string,
  state: ProductionTimerState
): Promise<void> => {
  try {
    await supabase
      .from('live_sessions')
      .update({ production_timer: state })
      .eq('machine_name', machineName)
      .eq('shift', shift)
      .eq('session_date', date);
  } catch (e) {
    // Silently fail - localStorage is the primary source
  }
};

/**
 * Calculate current run time from timer state
 */
export const calculateCurrentRunTime = (state: ProductionTimerState): number => {
  if (!state.isRunning || !state.lastResumedAt) {
    return state.totalRunTimeMs;
  }

  const now = Date.now();
  const lastResumed = new Date(state.lastResumedAt).getTime();
  return state.totalRunTimeMs + (now - lastResumed);
};

/**
 * Format milliseconds as HH:MM:SS
 */
export const formatRunTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// ==========================================
// CLEANUP
// ==========================================

/**
 * Clean up old timer data (called periodically)
 */
export const cleanupOldTimerData = (retentionDays: number = 7): number => {
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  let removed = 0;

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(TIMER_STORAGE_KEY_PREFIX)) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const state = JSON.parse(data);
          const startTime = state.startTime ? new Date(state.startTime).getTime() : 0;
          if (startTime < cutoff) {
            localStorage.removeItem(key);
            removed++;
          }
        }
      } catch {
        // Invalid data - remove it
        localStorage.removeItem(key);
        removed++;
      }
    }
  }

  if (removed > 0) {
    showInfo(`Cleaned up ${removed} old timer records`);
  }

  return removed;
};

/**
 * Release all session locks on page unload
 */
export const setupUnloadHandler = (): void => {
  window.addEventListener('beforeunload', () => {
    // Clear all heartbeat timers
    heartbeatTimers.forEach((timer) => clearInterval(timer));
    heartbeatTimers.clear();

    // Note: We can't reliably do async cleanup on unload
    // Stale sessions will be cleaned up by the timeout mechanism
  });
};
