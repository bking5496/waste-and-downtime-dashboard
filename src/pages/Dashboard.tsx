import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell
} from 'recharts';
import { getMachinesData, getTodayStats, getShiftHistory, initializeMachines, subscribeToMachineUpdates, maybeRunCleanup, retryFailedSubmissions, getFailedSubmissions } from '../lib/storage';
import { fetchActiveSessions, subscribeToSessionChanges, LiveSession } from '../lib/liveSession';
import { fetchSubmachinesForParent, isSupabaseConfigured, supabase, MachineRecord } from '../lib/supabase';
import { Machine, ShiftData } from '../types';
import MachineSettingsModal from '../components/MachineSettingsModal';
import SubMachineModal from '../components/SubMachineModal';

// Animated number component
const AnimatedNumber: React.FC<{ value: number; decimals?: number; suffix?: string }> = ({
  value, decimals = 0, suffix = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue.toFixed(decimals)}{suffix}</>;
};

// Pulse animation for live indicator
const PulseIndicator: React.FC<{ color: string }> = ({ color }) => (
  <span className="pulse-indicator">
    <span className="pulse-dot" style={{ backgroundColor: color }}></span>
    <span className="pulse-ring" style={{ borderColor: color }}></span>
  </span>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shift, setShift] = useState('');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [todayStats, setTodayStats] = useState({ totalWaste: 0, totalDowntime: 0, submissionCount: 0 });
  const [recentHistory, setRecentHistory] = useState<ShiftData[]>([]);
  const [selectedView, setSelectedView] = useState<'grid' | 'list'>('grid');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMachineForSub, setSelectedMachineForSub] = useState<Machine | null>(null);
  const [, setIsLoading] = useState(true); // Used only for setting, UI shows content after load
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [activeSessions, setActiveSessions] = useState<LiveSession[]>([]);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const LONG_PRESS_DURATION = 500; // ms

  // Track submachine statuses from machines table (for cross-browser sync)
  // Map of parentMachineId -> Set of active submachine numbers
  const [submachineStatuses, setSubmachineStatuses] = useState<Map<string, Set<number>>>(new Map());

  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Helper function to detect active sub-machine sessions from multiple sources
  // Priority: 1. Supabase live_sessions, 2. Supabase machines table, 3. localStorage fallback
  const getActiveSubMachines = useCallback((machineName: string, subMachineCount: number, machineId?: string): Set<number> => {
    const activeSet = new Set<number>();

    // Check Supabase live_sessions first
    for (let i = 1; i <= subMachineCount; i++) {
      const fullName = `${machineName} - Machine ${i}`;
      const isActive = activeSessions.some(s => s.machine_name === fullName && s.is_locked);
      if (isActive) {
        activeSet.add(i);
      }
    }

    // Also check submachine statuses from machines table (cross-browser sync)
    if (machineId && submachineStatuses.has(machineId)) {
      const machineTableActive = submachineStatuses.get(machineId)!;
      machineTableActive.forEach(num => activeSet.add(num));
    }

    // If no Supabase data, fallback to localStorage (offline mode)
    if (activeSet.size === 0) {
      const today = new Date().toISOString().split('T')[0];
      const hours = new Date().getUTCHours() + 2;
      const currentShift = hours >= 6 && hours < 18 ? 'Day' : 'Night';

      for (let i = 1; i <= subMachineCount; i++) {
        const fullName = `${machineName} - Machine ${i}`;
        const sessionKey = `shift_session_${fullName}_${currentShift}_${today}`;
        const session = localStorage.getItem(sessionKey);
        if (session) {
          try {
            const parsed = JSON.parse(session);
            if (parsed.locked) activeSet.add(i);
          } catch (e) {
            console.warn(`Invalid session data for ${fullName}:`, e);
          }
        }
      }
    }

    return activeSet;
  }, [activeSessions, submachineStatuses]);

  const loadData = useCallback(() => {
    const machineData = getMachinesData();
    setMachines(machineData);

    const stats = getTodayStats();
    setTodayStats(stats);

    const history = getShiftHistory().slice(0, 7);
    setRecentHistory(history);
  }, []);

  // Helper to fetch submachine statuses from machines table
  const fetchAllSubmachineStatuses = useCallback(async (machineList: Machine[]) => {
    if (!isSupabaseConfigured) return;

    const statusMap = new Map<string, Set<number>>();

    // For each parent machine with subMachineCount > 0, fetch submachine statuses
    for (const machine of machineList) {
      if (machine.subMachineCount && machine.subMachineCount > 0) {
        try {
          const submachines = await fetchSubmachinesForParent(machine.id);
          const activeSet = new Set<number>();

          for (const sub of submachines) {
            if (sub.status === 'running') {
              // Extract submachine number from ID (e.g., "machine-4-sub-2" -> 2)
              const match = sub.id.match(/-sub-(\d+)$/);
              if (match) {
                activeSet.add(parseInt(match[1], 10));
              }
            }
          }

          if (activeSet.size > 0) {
            statusMap.set(machine.id, activeSet);
          }
        } catch (e) {
          console.warn(`Failed to fetch submachines for ${machine.name}:`, e);
        }
      }
    }

    setSubmachineStatuses(statusMap);
  }, []);

  // Initialize machines from Supabase on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        // Run daily cleanup if needed
        maybeRunCleanup();

        const machineData = await initializeMachines();
        setMachines(machineData);

        const stats = getTodayStats();
        setTodayStats(stats);

        const history = getShiftHistory().slice(0, 7);
        setRecentHistory(history);

        // Fetch active sessions from Supabase for cross-browser sync
        const sessions = await fetchActiveSessions();
        setActiveSessions(sessions);

        // Fetch submachine statuses from machines table
        await fetchAllSubmachineStatuses(machineData);

        // Retry any failed submissions in background
        const failedCount = getFailedSubmissions().length;
        if (failedCount > 0) {
          console.log(`Retrying ${failedCount} failed submissions...`);
          retryFailedSubmissions().then(result => {
            if (result.succeeded > 0) {
              console.log(`Successfully synced ${result.succeeded} previously failed submissions`);
            }
            if (result.remaining > 0) {
              console.warn(`${result.remaining} submissions still pending retry`);
            }
          });
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
        loadData(); // Fallback to localStorage
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Subscribe to real-time machine updates
    const unsubscribeMachines = subscribeToMachineUpdates((updatedMachines) => {
      console.log('Real-time update received:', updatedMachines.length, 'machines');
      setMachines(updatedMachines);
    });

    // Subscribe to real-time session updates for cross-browser sync
    const unsubscribeSessions = subscribeToSessionChanges((sessions) => {
      console.log('🔄 Session update received:', sessions.length, 'active sessions', sessions.map(s => s.machine_name));
      setActiveSessions(sessions);
    });

    // Subscribe to submachine status changes (machines with parent_machine_id set)
    let unsubscribeSubmachines = () => {};
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('submachine-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'machines', filter: 'parent_machine_id=not.is.null' },
          (payload) => {
            console.log('🔄 Submachine update received:', payload);
            // Refetch submachine statuses when any submachine changes
            // Use a ref to access current machines state
            setMachines(current => {
              fetchAllSubmachineStatuses(current);
              return current;
            });
          }
        )
        .subscribe();

      unsubscribeSubmachines = () => supabase.removeChannel(channel);
    }

    return () => {
      unsubscribeMachines();
      unsubscribeSessions();
      unsubscribeSubmachines();
    };
  }, [loadData, fetchAllSubmachineStatuses]);

  // Update time every second - no dependencies to avoid infinite recreation
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      // Update shift based on current time
      const hours = now.getUTCHours() + 2;
      setShift(hours >= 6 && hours < 18 ? 'Day' : 'Night');
    }, 1000);

    // Set initial shift
    const initialHours = new Date().getUTCHours() + 2;
    setShift(initialHours >= 6 && initialHours < 18 ? 'Day' : 'Night');

    return () => clearInterval(timer);
  }, []);

  const handleMachineClick = (machine: Machine) => {
    if (machine.status === 'maintenance') return;

    // If machine has sub-machines, show the selection modal
    if (machine.subMachineCount && machine.subMachineCount > 0) {
      setSelectedMachineForSub(machine);
    } else {
      navigate(`/capture/${machine.id}`, { state: { machineName: machine.name } });
    }
  };

  const handleSubMachineSelect = (machine: Machine, subMachineNumber: number, isActive: boolean) => {
    const fullName = `${machine.name} - Machine ${subMachineNumber}`;

    // Note: isActive is for visual display only - machine is still clickable to continue session

    if (multiSelectMode) {
      // Only allow selection from the same parent group
      if (selectedMachines.length > 0) {
        const firstSelectedParent = selectedMachines[0].split(' - ')[0];
        if (machine.name !== firstSelectedParent) {
          // Different group - don't allow
          return;
        }
      }

      // Toggle selection
      setSelectedMachines(prev =>
        prev.includes(fullName)
          ? prev.filter(m => m !== fullName)
          : [...prev, fullName]
      );
    } else {
      // Direct navigation - use submachine ID for proper status tracking
      const subMachineId = `${machine.id}-sub-${subMachineNumber}`;
      navigate(`/capture/${subMachineId}`, {
        state: {
          machineName: fullName,
          parentMachine: machine.name,
          parentMachineId: machine.id,
          subMachineNumber: subMachineNumber,
          subMachineId: subMachineId
        }
      });
    }
    setSelectedMachineForSub(null);
  };

  const handleStartMultiCapture = () => {
    if (selectedMachines.length === 0) return;

    // Extract parent group from first selected machine
    const parentGroup = selectedMachines[0].split(' - ')[0];

    navigate(`/capture/multi`, {
      state: {
        machineNames: selectedMachines,
        parentGroup: parentGroup,
        isMultiMachine: true
      }
    });
  };

  // Long-press handlers for entering multi-select mode
  const handleLongPressStart = (machine: Machine, subMachineNumber: number, isActive: boolean) => {
    // isActive is kept for future use but doesn't block interaction
    const fullName = `${machine.name} - Machine ${subMachineNumber}`;

    longPressTimerRef.current = setTimeout(() => {
      // Enter multi-select mode and select this machine
      setMultiSelectMode(true);
      setSelectedMachines([fullName]);
    }, LONG_PRESS_DURATION);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const cancelMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedMachines([]);
  };

  // Get the parent group of currently selected machines (for highlighting)
  const selectedParentGroup = selectedMachines.length > 0
    ? selectedMachines[0].split(' - ')[0]
    : null;


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#10b981';
      case 'idle': return '#f59e0b';
      case 'maintenance': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusGradient = (status: string) => {
    switch (status) {
      case 'running': return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      case 'idle': return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      case 'maintenance': return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      default: return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
    }
  };

  // Calculate efficiency (mock calculation - running / total * 100)
  const efficiency = useMemo(() => {
    const running = machines.filter(m => m.status === 'running').length;
    const total = machines.filter(m => m.status !== 'maintenance').length;
    return total > 0 ? Math.round((running / total) * 100) : 0;
  }, [machines]);

  // Chart data
  const trendData = useMemo(() => {
    return recentHistory.map((item) => ({
      name: format(new Date(item.date), 'EEE'),
      waste: item.totalWaste,
      downtime: item.totalDowntime / 60, // convert to hours
    })).reverse();
  }, [recentHistory]);

  const statusData = useMemo(() => [
    { name: 'Running', value: machines.filter(m => m.status === 'running').length, color: '#10b981' },
    { name: 'Idle', value: machines.filter(m => m.status === 'idle').length, color: '#f59e0b' },
    { name: 'Maintenance', value: machines.filter(m => m.status === 'maintenance').length, color: '#ef4444' },
  ].filter(d => d.value > 0), [machines]);

  const runningCount = machines.filter(m => m.status === 'running').length;
  const idleCount = machines.filter(m => m.status === 'idle').length;
  const maintenanceCount = machines.filter(m => m.status === 'maintenance').length;

  return (
    <div className="dashboard-v2">
      {/* Top Navigation Bar */}
      <header className="top-nav">
        <div className="nav-brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">Production Control</span>
            <span className="brand-subtitle">Waste & Downtime Tracking</span>
          </div>
        </div>

        <div className="nav-center">
          <div className="live-clock">
            <PulseIndicator color="#10b981" />
            <span className="clock-time">{format(currentTime, 'HH:mm:ss')}</span>
            <span className="clock-date">{format(currentTime, 'dd MMM yyyy')}</span>
          </div>
        </div>

        <div className="nav-actions">
          <div className={`shift-indicator ${shift.toLowerCase()}`}>
            <span className="shift-icon">{shift === 'Day' ? '◐' : '◑'}</span>
            <span className="shift-text">{shift} Shift</span>
          </div>
          <button className="nav-btn admin-btn" onClick={() => navigate('/admin')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Admin
          </button>
          <button className="nav-btn" onClick={() => navigate('/history')}>
            History
          </button>
          <button className="nav-btn settings-btn" onClick={() => setShowSettings(true)}>
            <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            <span className="settings-text">Settings</span>
          </button>
        </div>
      </header>

      {/* Machine Settings Modal */}
      <MachineSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onMachinesUpdated={loadData}
      />

      {/* Sub-Machine Selection Modal */}
      <SubMachineModal
        isOpen={!!selectedMachineForSub}
        machine={selectedMachineForSub}
        onClose={() => setSelectedMachineForSub(null)}
        onSelectSubMachine={handleSubMachineSelect}
        activeSubMachines={selectedMachineForSub ? getActiveSubMachines(selectedMachineForSub.name, selectedMachineForSub.subMachineCount || 0, selectedMachineForSub.id) : new Set()}
      />

      <main className="dashboard-main">
        {/* Left Panel - Stats */}
        <aside className="stats-panel">
          {/* Efficiency Gauge */}
          <div className="efficiency-card">
            <div className="efficiency-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" className="ring-bg" />
                <circle
                  cx="60" cy="60" r="50"
                  className="ring-progress"
                  strokeDasharray={`${efficiency * 3.14} 314`}
                  style={{ stroke: efficiency > 70 ? '#10b981' : efficiency > 40 ? '#f59e0b' : '#ef4444' }}
                />
              </svg>
              <div className="efficiency-value">
                <AnimatedNumber value={efficiency} suffix="%" />
              </div>
            </div>
            <span className="efficiency-label">Line Efficiency</span>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-item running">
              <div className="stat-indicator"></div>
              <div className="stat-info">
                <span className="stat-value">{runningCount}</span>
                <span className="stat-label">Running</span>
              </div>
            </div>
            <div className="stat-item idle">
              <div className="stat-indicator"></div>
              <div className="stat-info">
                <span className="stat-value">{idleCount}</span>
                <span className="stat-label">Idle</span>
              </div>
            </div>
            <div className="stat-item maintenance">
              <div className="stat-indicator"></div>
              <div className="stat-info">
                <span className="stat-value">{maintenanceCount}</span>
                <span className="stat-label">Maintenance</span>
              </div>
            </div>
          </div>

          {/* Today's Metrics */}
          <div className="metrics-section">
            <h3 className="section-title">Today's Performance</h3>
            <div className="metric-block waste">
              <div className="metric-header">
                <span className="metric-icon">◆</span>
                <span>Total Waste</span>
              </div>
              <div className="metric-value">
                <AnimatedNumber value={todayStats.totalWaste} decimals={1} suffix=" kg" />
              </div>
              <div className="metric-bar">
                <div className="bar-fill" style={{ width: `${Math.min(todayStats.totalWaste / 100 * 100, 100)}%` }}></div>
              </div>
            </div>
            <div className="metric-block downtime">
              <div className="metric-header">
                <span className="metric-icon">◇</span>
                <span>Total Downtime</span>
              </div>
              <div className="metric-value">
                {Math.floor(todayStats.totalDowntime / 60)}h {todayStats.totalDowntime % 60}m
              </div>
              <div className="metric-bar">
                <div className="bar-fill" style={{ width: `${Math.min(todayStats.totalDowntime / 480 * 100, 100)}%` }}></div>
              </div>
            </div>
            <div className="metric-block entries">
              <div className="metric-header">
                <span className="metric-icon">◈</span>
                <span>Submissions</span>
              </div>
              <div className="metric-value">
                <AnimatedNumber value={todayStats.submissionCount} suffix=" entries" />
              </div>
            </div>
          </div>

          {/* Mini Chart */}
          {trendData.length > 0 && (
            <div className="trend-chart">
              <h3 className="section-title">7-Day Trend</h3>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="wasteGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area type="monotone" dataKey="waste" stroke="#ef4444" fill="url(#wasteGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </aside>

        {/* Main Content - Machine Grid */}
        <section className={`machines-section ${multiSelectMode ? 'multi-select-mode' : ''}`}>
          <div className="section-header">
            <h2>
              Production Lines
              {multiSelectMode && <span className="multi-select-hint"> — Hold to select machines</span>}
            </h2>
            <div className="header-actions">
              {multiSelectMode && (
                <button
                  className="cancel-select-btn"
                  onClick={cancelMultiSelect}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              )}
              <div className="view-toggle">
                <button
                  className={selectedView === 'grid' ? 'active' : ''}
                  onClick={() => setSelectedView('grid')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                <button
                  className={selectedView === 'list' ? 'active' : ''}
                  onClick={() => setSelectedView('list')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <rect x="3" y="4" width="18" height="4" rx="1" />
                    <rect x="3" y="10" width="18" height="4" rx="1" />
                    <rect x="3" y="16" width="18" height="4" rx="1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {selectedView === 'grid' ? (
              <motion.div
                key="grid"
                className="machines-grid-v2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {machines.map((machine, index) => {
                  // Machine is running if status is 'running' OR has a current order
                  const isRunning = machine.status === 'running' || !!machine.currentOrder;
                  const isBlocked = isRunning || machine.status === 'maintenance';
                  const displayStatus = isRunning ? 'running' : machine.status;
                  const activeSubMachines = machine.subMachineCount && machine.subMachineCount > 0
                    ? getActiveSubMachines(machine.name, machine.subMachineCount, machine.id)
                    : new Set<number>();

                  const handleTileClick = () => {
                    if (machine.subMachineCount && machine.subMachineCount > 0) return;
                    // Allow access to running machines (to continue session)
                    handleMachineClick(machine);
                  };

                  return (
                    <motion.div
                      key={machine.id}
                      className={`machine-tile ${displayStatus} ${isBlocked ? 'disabled' : ''} ${machine.subMachineCount && machine.subMachineCount > 0 ? 'has-sub-machines' : ''}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={handleTileClick}
                      whileHover={!isBlocked && !(machine.subMachineCount && machine.subMachineCount > 0) ? { scale: 1.02, y: -4 } : {}}
                      whileTap={!isBlocked && !(machine.subMachineCount && machine.subMachineCount > 0) ? { scale: 0.98 } : {}}
                    >
                      <div
                        className="tile-glow"
                        style={{ background: getStatusGradient(displayStatus) }}
                      />
                      <div className="tile-content">
                        <div className="tile-header">
                          <span className="tile-name">{machine.name}</span>
                          <div className="tile-status">
                            <PulseIndicator color={getStatusColor(displayStatus)} />
                          </div>
                        </div>

                        <div className="tile-status-text">
                          {isRunning ? 'Running' : machine.status.charAt(0).toUpperCase() + machine.status.slice(1)}
                          {machine.subMachineCount && machine.subMachineCount > 0 && (
                            <span className="sub-count-badge">
                              {activeSubMachines.size > 0
                                ? `${activeSubMachines.size}/${machine.subMachineCount} active`
                                : `${machine.subMachineCount} units`}
                            </span>
                          )}
                        </div>

                        {/* Show current order if running */}
                        {isRunning && machine.currentOrder && (
                          <div className="tile-order">Order: {machine.currentOrder}</div>
                        )}

                        {machine.currentOperator && (
                          <div className="tile-operator">{machine.currentOperator}</div>
                        )}

                        {/* Today's Stats - Waste & Downtime */}
                        <div className="tile-stats">
                          <div className="tile-stat waste">
                            <span className="stat-icon">🗑️</span>
                            <span className="stat-value">{machine.todayWaste?.toFixed(1) || '0.0'}</span>
                            <span className="stat-unit">kg</span>
                          </div>
                          <div className="tile-stat downtime">
                            <span className="stat-icon">⏱️</span>
                            <span className="stat-value">{machine.todayDowntime || 0}</span>
                            <span className="stat-unit">min</span>
                          </div>
                        </div>

                        {/* Inline sub-machine selection */}
                        {machine.subMachineCount && machine.subMachineCount > 0 && machine.status !== 'maintenance' ? (
                          <div className="sub-machine-inline-grid">
                            {Array.from({ length: machine.subMachineCount }, (_, i) => i + 1).map(num => {
                              const fullName = `${machine.name} - Machine ${num}`;
                              const isActive = activeSubMachines.has(num);
                              const isSelected = selectedMachines.includes(fullName);
                              const isOtherGroup = Boolean(multiSelectMode && selectedParentGroup && selectedParentGroup !== machine.name);
                              // Only disable for other-group, NOT for isActive (reserved machines are still clickable)
                              const isDisabled = isOtherGroup;

                              return (
                                <motion.button
                                  key={num}
                                  className={`sub-machine-inline-btn ${isActive ? 'busy' : ''} ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSubMachineSelect(machine, num, isActive);
                                  }}
                                  onMouseDown={() => handleLongPressStart(machine, num, isActive)}
                                  onMouseUp={handleLongPressEnd}
                                  onMouseLeave={handleLongPressEnd}
                                  onTouchStart={() => handleLongPressStart(machine, num, isActive)}
                                  onTouchEnd={handleLongPressEnd}
                                  whileHover={!isDisabled ? { scale: 1.1 } : {}}
                                  whileTap={!isDisabled ? { scale: 0.95 } : {}}
                                  title={isActive ? 'In Use - Click to continue' : (isOtherGroup ? 'Different group' : (multiSelectMode ? 'Tap to select' : 'Hold to multi-select'))}
                                  disabled={isDisabled}
                                >
                                  {num}
                                  {isActive && <span className="status-dot busy" />}
                                  {isSelected && <span className="check-mark">✓</span>}
                                </motion.button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="tile-footer">
                            <span className="tile-time">{machine.lastSubmission || 'No entries'}</span>
                            {machine.status !== 'maintenance' && (
                              <span className="tile-action">Record →</span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                className="machines-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {machines.map((machine, index) => (
                  <motion.div
                    key={machine.id}
                    className={`machine-row ${machine.status} ${machine.status === 'maintenance' ? 'disabled' : ''}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleMachineClick(machine)}
                  >
                    <div className="row-indicator" style={{ background: getStatusGradient(machine.status) }} />
                    <div className="row-name">{machine.name}</div>
                    <div className="row-status">
                      <PulseIndicator color={getStatusColor(machine.status)} />
                      <span>{machine.status.charAt(0).toUpperCase() + machine.status.slice(1)}</span>
                    </div>
                    <div className="row-operator">{machine.currentOperator || '—'}</div>
                    <div className="row-time">{machine.lastSubmission || 'No entries'}</div>
                    {machine.status !== 'maintenance' && (
                      <button className="row-action">Record</button>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Multi-Select Floating Action Bar */}
          <AnimatePresence>
            {multiSelectMode && selectedMachines.length > 0 && (
              <motion.div
                className="multi-select-bar"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
              >
                <div className="selection-info">
                  <span className="selection-parent-group">{selectedParentGroup}</span>
                  <span className="selection-divider">—</span>
                  <span className="selection-machines">
                    {selectedMachines.map(m => m.split(' - Machine ')[1]).join(', ')}
                  </span>
                </div>
                <button
                  className="start-capture-btn"
                  onClick={handleStartMultiCapture}
                >
                  Start Recording ({selectedMachines.length})
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Right Panel - Status Overview */}
        <aside className="overview-panel">
          <div className="status-donut">
            <h3 className="section-title">Machine Status</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-legend">
              {statusData.map((item, index) => (
                <div key={index} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="recent-activity">
            <h3 className="section-title">Recent Submissions</h3>
            <div className="activity-list">
              {recentHistory.slice(0, 5).map((item, index) => (
                <motion.div
                  key={item.id || index}
                  className="activity-item"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="activity-icon">
                    <span className="icon-dot"></span>
                  </div>
                  <div className="activity-details">
                    <span className="activity-machine">{item.machine}</span>
                    <span className="activity-meta">
                      {item.totalWaste.toFixed(1)}kg waste · {item.totalDowntime}m downtime
                    </span>
                  </div>
                  <div className="activity-time">
                    {format(new Date(item.submittedAt), 'HH:mm')}
                  </div>
                </motion.div>
              ))}
              {recentHistory.length === 0 && (
                <div className="activity-empty">No recent activity</div>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default Dashboard;
