import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { getMachinesData, getTodayStats, getShiftHistory, initializeMachines, subscribeToMachineUpdates, maybeRunCleanup, retryFailedSubmissions, getFailedSubmissions } from '../lib/storage';
import { fetchActiveSessions, subscribeToSessionChanges, LiveSession } from '../lib/liveSession';
import { isSupabaseConfigured, getRecentSubmissions } from '../lib/supabase';
import { Machine, ShiftData } from '../types';
import MachineSettingsModal from '../components/MachineSettingsModal';
import SubMachineModal from '../components/SubMachineModal';

// Type for recent submissions from Supabase
interface RecentSubmission {
  id: number;
  order_number: string;
  machine: string;
  sub_machine?: string;
  product: string;
  batch_number: string;
  total_waste: number;
  total_downtime: number;
  created_at: string;
  waste_records?: { recorded_at: string }[];
  downtime_records?: { recorded_at: string }[];
}

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
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const LONG_PRESS_DURATION = 500; // ms

  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Helper function to detect active sub-machine sessions
  // live_sessions is the source of truth for cross-browser sync
  // localStorage is only used as offline fallback
  const getActiveSubMachines = useCallback((machineName: string, subMachineCount: number, _machineId?: string): Set<number> => {
    const activeSet = new Set<number>();

    // Check Supabase live_sessions - this is the source of truth
    for (let i = 1; i <= subMachineCount; i++) {
      const fullName = `${machineName} - Machine ${i}`;
      const isActive = activeSessions.some(s => s.machine_name === fullName && s.is_locked);
      if (isActive) {
        activeSet.add(i);
      }
    }

    // If no Supabase data, fallback to localStorage (offline mode only)
    if (activeSet.size === 0 && !isSupabaseConfigured) {
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
  }, [activeSessions]);

  const loadData = useCallback(() => {
    const machineData = getMachinesData();
    setMachines(machineData);

    const stats = getTodayStats();
    setTodayStats(stats);

    const history = getShiftHistory().slice(0, 7);
    setRecentHistory(history);
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

        // Fetch recent submissions from Supabase for the activity feed
        if (isSupabaseConfigured) {
          try {
            const submissions = await getRecentSubmissions(10);
            setRecentSubmissions(submissions || []);
          } catch (err) {
            console.warn('Failed to fetch recent submissions:', err);
          }
        }

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

    return () => {
      unsubscribeMachines();
      unsubscribeSessions();
    };
  }, [loadData]);

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
      case 'running': return '#00ff88';
      case 'idle': return '#00f5ff';
      case 'maintenance': return '#ff4757';
      default: return '#00f5ff';
    }
  };

  const getStatusGradient = (status: string) => {
    switch (status) {
      case 'running': return 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)';
      case 'idle': return 'linear-gradient(135deg, #00f5ff 0%, #00c4cc 100%)';
      case 'maintenance': return 'linear-gradient(135deg, #ff4757 0%, #cc3945 100%)';
      default: return 'linear-gradient(135deg, #00f5ff 0%, #00c4cc 100%)';
    }
  };

  // Calculate efficiency (running / total * 100) - considering group machines with active sub-machines
  const efficiency = useMemo(() => {
    let running = 0;
    let total = 0;

    machines.forEach(machine => {
      if (machine.status !== 'maintenance') {
        total++;
        // Check if group machine has any active sub-machines
        const hasActiveSubMachines = machine.subMachineCount && machine.subMachineCount > 0
          ? getActiveSubMachines(machine.name, machine.subMachineCount, machine.id).size > 0
          : false;

        if (machine.status === 'running' || hasActiveSubMachines) {
          running++;
        }
      }
    });

    return total > 0 ? Math.round((running / total) * 100) : 0;
  }, [machines, getActiveSubMachines]);

  // Calculate running/idle counts considering group machines with active sub-machines
  const machineStatusCounts = useMemo(() => {
    let running = 0;
    let idle = 0;
    let maintenance = 0;

    machines.forEach(machine => {
      if (machine.status === 'maintenance') {
        maintenance++;
      } else {
        // Check if group machine has any active sub-machines
        const hasActiveSubMachines = machine.subMachineCount && machine.subMachineCount > 0
          ? getActiveSubMachines(machine.name, machine.subMachineCount, machine.id).size > 0
          : false;

        if (machine.status === 'running' || hasActiveSubMachines) {
          running++;
        } else {
          idle++;
        }
      }
    });

    return { running, idle, maintenance };
  }, [machines, getActiveSubMachines]);

  const runningCount = machineStatusCounts.running;
  const idleCount = machineStatusCounts.idle;
  const maintenanceCount = machineStatusCounts.maintenance;

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
                  // Get active sub-machines first (needed for status calculation)
                  const activeSubMachines = machine.subMachineCount && machine.subMachineCount > 0
                    ? getActiveSubMachines(machine.name, machine.subMachineCount, machine.id)
                    : new Set<number>();

                  // Machine is running if:
                  // - status is 'running' OR has a current order
                  // - OR for group machines: any sub-machine is active
                  const hasActiveSubMachines = activeSubMachines.size > 0;
                  const isRunning = machine.status === 'running' || !!machine.currentOrder || hasActiveSubMachines;
                  const isBlocked = isRunning || machine.status === 'maintenance';
                  const displayStatus = isRunning ? 'running' : machine.status;

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

                        {/* For group machines: show info for each active member */}
                        {machine.subMachineCount && machine.subMachineCount > 0 && activeSubMachines.size > 0 ? (
                          <div className="active-members-info">
                            {Array.from(activeSubMachines).sort((a, b) => a - b).map(num => {
                              const memberName = `${machine.name} - Machine ${num}`;
                              const memberSession = activeSessions.find(s => s.machine_name === memberName);
                              return (
                                <div key={num} className="member-info">
                                  <span className="member-label">M{num}:</span>
                                  {memberSession ? (
                                    <>
                                      <span className="member-order">{memberSession.order_number}</span>
                                      <span className="member-operator">({memberSession.operator_name})</span>
                                    </>
                                  ) : (
                                    <span className="member-order">Active</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            {/* Show current order if running (single machine) */}
                            {isRunning && machine.currentOrder && (
                              <div className="tile-order">Order: {machine.currentOrder}</div>
                            )}
                            {machine.currentOperator && (
                              <div className="tile-operator">{machine.currentOperator}</div>
                            )}
                          </>
                        )}

                        {/* Today's Stats - Waste & Downtime */}
                        {machine.subMachineCount && machine.subMachineCount > 0 && activeSubMachines.size > 0 ? (
                          <div className="members-stats">
                            {Array.from(activeSubMachines).sort((a, b) => a - b).map(num => {
                              const memberName = `${machine.name} - Machine ${num}`;
                              const memberSession = activeSessions.find(s => s.machine_name === memberName);
                              const memberWaste = memberSession?.total_waste || 0;
                              const memberDowntime = memberSession?.total_downtime || 0;
                              return (
                                <div key={num} className="member-stats-row">
                                  <span className="member-label">M{num}:</span>
                                  <div className="tile-stat waste">
                                    <span className="stat-icon">🗑️</span>
                                    <span className="stat-value">{memberWaste.toFixed(1)}</span>
                                    <span className="stat-unit">kg</span>
                                  </div>
                                  <div className="tile-stat downtime">
                                    <span className="stat-icon">⏱️</span>
                                    <span className="stat-value">{memberDowntime}</span>
                                    <span className="stat-unit">min</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
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
                        )}

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
                {machines.map((machine, index) => {
                  // Calculate actual status considering active sub-machines
                  const activeSubMachines = machine.subMachineCount && machine.subMachineCount > 0
                    ? getActiveSubMachines(machine.name, machine.subMachineCount, machine.id)
                    : new Set<number>();
                  const hasActiveSubMachines = activeSubMachines.size > 0;
                  const isRunning = machine.status === 'running' || hasActiveSubMachines;
                  const displayStatus = isRunning ? 'running' : machine.status;

                  return (
                    <motion.div
                      key={machine.id}
                      className={`machine-row ${displayStatus} ${machine.status === 'maintenance' ? 'disabled' : ''}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleMachineClick(machine)}
                    >
                      <div className="row-indicator" style={{ background: getStatusGradient(displayStatus) }} />
                      <div className="row-name">{machine.name}</div>
                      <div className="row-status">
                        <PulseIndicator color={getStatusColor(displayStatus)} />
                        <span>{displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}</span>
                      </div>
                      <div className="row-operator">{machine.currentOperator || '—'}</div>
                      <div className="row-time">{machine.lastSubmission || 'No entries'}</div>
                      {machine.status !== 'maintenance' && (
                        <button className="row-action">Record</button>
                      )}
                    </motion.div>
                  );
                })}
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

        {/* Right Panel - Recent Activity */}
        <aside className="overview-panel">
          {/* Recent Activity */}
          <div className="recent-activity">
            <h3 className="section-title">Recent Submissions</h3>
            <div className="activity-list">
              {recentSubmissions.length > 0 ? (
                recentSubmissions.slice(0, 5).map((item, index) => {
                  // Calculate start time from earliest record
                  const allTimestamps = [
                    ...(item.waste_records || []).map(r => r.recorded_at),
                    ...(item.downtime_records || []).map(r => r.recorded_at),
                  ].filter(Boolean).map(t => new Date(t).getTime());
                  const startTime = allTimestamps.length > 0
                    ? new Date(Math.min(...allTimestamps))
                    : null;
                  const finishTime = new Date(item.created_at);
                  const machineName = item.sub_machine || item.machine;

                  // Calculate runtime in minutes
                  const runtimeMinutes = startTime
                    ? Math.round((finishTime.getTime() - startTime.getTime()) / 60000)
                    : null;
                  const runtimeHours = runtimeMinutes ? Math.floor(runtimeMinutes / 60) : 0;
                  const runtimeMins = runtimeMinutes ? runtimeMinutes % 60 : 0;
                  const runtimeDisplay = runtimeMinutes
                    ? (runtimeHours > 0 ? `${runtimeHours}h ${runtimeMins}m` : `${runtimeMins}m`)
                    : '—';

                  return (
                    <motion.div
                      key={item.id}
                      className="activity-item enhanced"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="activity-header">
                        <span className="activity-order">#{item.order_number}</span>
                        <span className="activity-machine-name">{machineName}</span>
                      </div>
                      <div className="activity-product-info">
                        <span className="product-name">{item.product}</span>
                        <span className="batch-number">Batch: {item.batch_number}</span>
                      </div>
                      <div className="activity-stats">
                        <span className="activity-stat waste">
                          <span className="stat-icon">🗑️</span>
                          {(item.total_waste || 0).toFixed(1)}kg
                        </span>
                        <span className="activity-stat downtime">
                          <span className="stat-icon">⏱️</span>
                          {item.total_downtime || 0}m
                        </span>
                        <span className="activity-stat runtime">
                          <span className="stat-icon">⏲️</span>
                          {runtimeDisplay}
                        </span>
                      </div>
                      <div className="activity-times">
                        <span className="time-label">Start:</span>
                        <span className="time-value">{startTime ? format(startTime, 'HH:mm') : '—'}</span>
                        <span className="time-label">End:</span>
                        <span className="time-value">{format(finishTime, 'HH:mm')}</span>
                      </div>
                    </motion.div>
                  );
                })
              ) : recentHistory.length > 0 ? (
                // Fallback to localStorage data if Supabase data not available
                recentHistory.slice(0, 5).map((item, index) => (
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
                ))
              ) : (
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
