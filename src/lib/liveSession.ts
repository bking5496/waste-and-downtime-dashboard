import { supabase, isSupabaseConfigured } from './supabase';

// ==========================================
// LIVE SESSIONS - Cross-device sync with offline fallback
// ==========================================

export interface LiveSession {
    id: string; // Format: "machineName_shift_date"
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

// Generate session ID from components
export const getLiveSessionId = (machineName: string, shift: string, date: string): string => {
    return `${machineName}_${shift}_${date}`;
};

// Cache for active sessions (used when offline or for quick lookups)
let sessionsCache: Map<string, LiveSession> = new Map();
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache

// ==========================================
// UPSERT SESSION (Save/Update)
// ==========================================
export const upsertLiveSession = async (session: {
    machineName: string;
    operatorName: string;
    orderNumber: string;
    product: string;
    batchNumber: string;
    shift: string;
    date: string;
    locked: boolean;
}): Promise<boolean> => {
    const sessionId = getLiveSessionId(session.machineName, session.shift, session.date);

    const liveSession: LiveSession = {
        id: sessionId,
        machine_name: session.machineName,
        operator_name: session.operatorName,
        order_number: session.orderNumber,
        product: session.product,
        batch_number: session.batchNumber,
        shift: session.shift,
        session_date: session.date,
        is_locked: session.locked,
        updated_at: new Date().toISOString(),
    };

    // Always update local cache first
    sessionsCache.set(sessionId, liveSession);

    // Try to sync to Supabase
    if (isSupabaseConfigured) {
        try {
            const { error } = await supabase
                .from('live_sessions')
                .upsert({
                    id: sessionId,
                    machine_name: session.machineName,
                    operator_name: session.operatorName,
                    order_number: session.orderNumber,
                    product: session.product,
                    batch_number: session.batchNumber,
                    shift: session.shift,
                    session_date: session.date,
                    is_locked: session.locked,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });

            if (error) {
                console.error('Failed to upsert live session:', error.message);
                return false;
            }
            console.log('✅ Live session synced to Supabase:', sessionId);
            return true;
        } catch (e) {
            console.error('Failed to upsert live session:', e);
            return false;
        }
    }

    // Offline - cached locally, will sync later
    return true;
};

// ==========================================
// DELETE SESSION (When submitted or cleared)
// ==========================================
export const deleteLiveSession = async (
    machineName: string,
    shift: string,
    date: string
): Promise<boolean> => {
    const sessionId = getLiveSessionId(machineName, shift, date);

    // Remove from local cache
    sessionsCache.delete(sessionId);

    // Try to delete from Supabase
    if (isSupabaseConfigured) {
        try {
            const { error } = await supabase
                .from('live_sessions')
                .delete()
                .eq('id', sessionId);

            if (error) {
                console.error('Failed to delete live session:', error.message);
                return false;
            }
            return true;
        } catch (e) {
            console.error('Failed to delete live session:', e);
            return false;
        }
    }

    return true;
};

// ==========================================
// FETCH ACTIVE SESSIONS (For Dashboard)
// ==========================================
export const fetchActiveSessions = async (): Promise<LiveSession[]> => {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // Return cache if fresh and online fetch fails
    const shouldUseCache = now - lastFetchTime < CACHE_TTL_MS;

    if (isSupabaseConfigured) {
        try {
            const { data, error } = await supabase
                .from('live_sessions')
                .select('*')
                .eq('session_date', today)
                .eq('is_locked', true);

            if (error) {
                console.error('Failed to fetch live sessions:', error.message);
                // Fall back to cache
                return Array.from(sessionsCache.values()).filter(
                    s => s.session_date === today && s.is_locked
                );
            }

            // Update cache with fetched data
            sessionsCache.clear();
            (data || []).forEach(session => {
                sessionsCache.set(session.id, session);
            });
            lastFetchTime = now;

            console.log('📋 Fetched active sessions from Supabase:', (data || []).length, data?.map(s => s.machine_name));
            return data || [];
        } catch (e) {
            console.error('Failed to fetch live sessions:', e);
            // Fall back to cache
            return Array.from(sessionsCache.values()).filter(
                s => s.session_date === today && s.is_locked
            );
        }
    }

    // Offline - return cached sessions
    if (shouldUseCache) {
        return Array.from(sessionsCache.values()).filter(
            s => s.session_date === today && s.is_locked
        );
    }

    return [];
};

// ==========================================
// FETCH SESSION BY MACHINE NAME
// ==========================================
export const fetchLiveSessionByMachine = async (
    machineName: string,
    shift: string,
    date: string
): Promise<LiveSession | null> => {
    const sessionId = getLiveSessionId(machineName, shift, date);

    // Check cache first
    if (sessionsCache.has(sessionId)) {
        return sessionsCache.get(sessionId) || null;
    }

    if (!isSupabaseConfigured) {
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('live_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('is_locked', true)
            .maybeSingle();

        if (error) {
            console.error('Failed to fetch session:', error.message);
            return null;
        }

        if (data) {
            // Update cache
            sessionsCache.set(sessionId, data);
            console.log('📋 Restored session from Supabase:', machineName);
        }

        return data;
    } catch (e) {
        console.error('Failed to fetch session by machine:', e);
        return null;
    }
};

// ==========================================
// GET ACTIVE SUB-MACHINES (Replacement for localStorage check)
// ==========================================
export const getActiveSubMachinesFromSupabase = async (
    parentMachineName: string,
    subMachineCount: number
): Promise<Set<number>> => {
    const activeSet = new Set<number>();
    const sessions = await fetchActiveSessions();

    for (let i = 1; i <= subMachineCount; i++) {
        const fullName = `${parentMachineName} - Machine ${i}`;
        const isActive = sessions.some(s => s.machine_name === fullName && s.is_locked);
        if (isActive) {
            activeSet.add(i);
        }
    }

    return activeSet;
};

// ==========================================
// SUBSCRIBE TO SESSION CHANGES (Real-time)
// ==========================================
export const subscribeToSessionChanges = (
    onUpdate: (sessions: LiveSession[]) => void
) => {
    if (!isSupabaseConfigured) {
        return () => { }; // No-op unsubscribe
    }

    const today = new Date().toISOString().split('T')[0];

    const channel = supabase
        .channel('live-sessions-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'live_sessions' },
            async (payload) => {
                console.log('🔄 Real-time session update received:', payload.eventType);
                // Refetch all sessions on any change
                const sessions = await fetchActiveSessions();
                onUpdate(sessions);
            }
        )
        .subscribe((status) => {
            console.log('📡 Session subscription status:', status);
        });

    return () => {
        supabase.removeChannel(channel);
    };
};

// ==========================================
// SYNC PENDING SESSIONS (On reconnection)
// ==========================================
export const syncPendingSessions = async (): Promise<void> => {
    if (!isSupabaseConfigured) return;

    // Any sessions in cache that might not be synced yet
    for (const session of Array.from(sessionsCache.values())) {
        try {
            await supabase
                .from('live_sessions')
                .upsert({
                    id: session.id,
                    machine_name: session.machine_name,
                    operator_name: session.operator_name,
                    order_number: session.order_number,
                    product: session.product,
                    batch_number: session.batch_number,
                    shift: session.shift,
                    session_date: session.session_date,
                    is_locked: session.is_locked,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
        } catch (e) {
            console.error('Failed to sync session:', session.id, e);
        }
    }
};
