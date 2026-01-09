import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import ShiftInfo from '../components/ShiftInfo';
import MainForm from '../components/MainForm';
import DashboardCharts from '../components/DashboardCharts';
import ConfirmDialog from '../components/ConfirmDialog';
import QRScanner from '../components/QRScanner';
import { WasteEntry, DowntimeEntry, ShiftData, SpeedEntry, SachetMassEntry, LooseCasesEntry, PalletScanEntry, ShiftSession, ProductionState, WASTE_TYPES, DOWNTIME_REASONS } from '../types';
import { submitShiftData, fetchMachineOrders, MachineOrderQueueRecord, updateMachineStatus } from '../lib/supabase';
import { saveShiftData, addFailedSubmission } from '../lib/storage';
import { upsertLiveSession, deleteLiveSession } from '../lib/liveSession';

// Storage key for shift session
const getSessionKey = (machineName: string, shift: string, date: string) =>
  `shift_session_${machineName}_${shift}_${date}`;

const CaptureScreen: React.FC = () => {
  const { machineId } = useParams<{ machineId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const machineName = (location.state as { machineName?: string })?.machineName || machineId || '';

  // Track current machine for chat widget location context
  useEffect(() => {
    if (machineName) {
      localStorage.setItem('chat_current_machine', machineName);
    }
    return () => {
      localStorage.removeItem('chat_current_machine');
    };
  }, [machineName]);

  const [dateTime, setDateTime] = useState(new Date());
  const [shift, setShift] = useState('');

  // Loading and feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // State for the main form
  const [operatorName, setOperatorName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [product, setProduct] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [isSessionLocked, setIsSessionLocked] = useState(false);

  // State for waste and downtime inputs
  const [waste, setWaste] = useState<number | ''>('');
  const [wasteType, setWasteType] = useState('');
  const [downtime, setDowntime] = useState<number | ''>('');
  const [downtimeReason, setDowntimeReason] = useState('');

  // State for storing submitted entries
  const [wasteEntries, setWasteEntries] = useState<WasteEntry[]>([]);
  const [downtimeEntries, setDowntimeEntries] = useState<DowntimeEntry[]>([]);

  // New states for Machine Speed, Sachet Mass, Loose Cases, Pallet Scans
  const [speedEntries, setSpeedEntries] = useState<SpeedEntry[]>([]);
  const [sachetMassEntries, setSachetMassEntries] = useState<SachetMassEntry[]>([]);
  const [looseCasesEntries, setLooseCasesEntries] = useState<LooseCasesEntry[]>([]);
  const [palletScanEntries, setPalletScanEntries] = useState<PalletScanEntry[]>([]);

  // Modal states for new entries
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showSachetModal, setShowSachetModal] = useState(false);
  const [showLooseCasesModal, setShowLooseCasesModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showDowntimeModal, setShowDowntimeModal] = useState(false);
  const [speedInput, setSpeedInput] = useState<number | ''>('');
  const [sachetMassInput, setSachetMassInput] = useState<number | ''>('');
  const [looseCasesBatchInput, setLooseCasesBatchInput] = useState('');
  const [looseCasesQuantityInput, setLooseCasesQuantityInput] = useState<number | ''>('');

  // Submission window state
  const [isInSubmissionWindow, setIsInSubmissionWindow] = useState(false);
  const [, setTimeToWindow] = useState(''); // Time display for submission window

  // Order queue state
  const [availableOrders, setAvailableOrders] = useState<MachineOrderQueueRecord[]>([]);
  const [showOrderSelect, setShowOrderSelect] = useState(false);

  // Shift change detection
  const [lastKnownShift, setLastKnownShift] = useState<string | null>(null);
  const [showShiftChangeModal, setShowShiftChangeModal] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');

  // Changeover dialog state (shown when submitting outside window)
  const [showChangeoverDialog, setShowChangeoverDialog] = useState(false);
  const [willChangeover, setWillChangeover] = useState<boolean | null>(null);
  const [willMaintenance, setWillMaintenance] = useState<boolean | null>(null);

  // Production Timer state
  const [productionState, setProductionState] = useState<ProductionState>({
    isRunning: false,
    startTime: null,
    pausedAt: null,
    totalRunTimeMs: 0,
    lastResumedAt: null,
  });
  const [displayRunTime, setDisplayRunTime] = useState<string>('00:00:00');
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [pauseDowntimeReason, setPauseDowntimeReason] = useState('');

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Handle order selection from queue
  const handleOrderSelect = (order: MachineOrderQueueRecord) => {
    setOrderNumber(order.order_number);
    setProduct(order.product);
    setBatchNumber(order.batch_number);
    setShowOrderSelect(false);
    showToast(`Selected order: ${order.order_number}`, 'success');
  };

  // Check if within submission window (15 min before/after shift end)
  const checkSubmissionWindow = useCallback((currentDateTime: Date) => {
    const hours = currentDateTime.getUTCHours() + 2; // GMT+2
    const minutes = currentDateTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Day shift ends at 18:00 (1080 min), Night shift ends at 06:00 (360 min)
    const dayShiftEnd = 18 * 60; // 1080
    const nightShiftEnd = 6 * 60; // 360

    // Check if within 15 minutes of shift end
    const dayWindowStart = dayShiftEnd - 15;
    const dayWindowEnd = dayShiftEnd + 15;
    const nightWindowStart = nightShiftEnd - 15;
    const nightWindowEnd = nightShiftEnd + 15;

    let inWindow = false;
    let minutesToWindow = 0;

    if (totalMinutes >= dayWindowStart && totalMinutes <= dayWindowEnd) {
      inWindow = true;
    } else if (totalMinutes >= nightWindowStart && totalMinutes <= nightWindowEnd) {
      inWindow = true;
    } else if (totalMinutes >= (24 * 60 - 15)) {
      // Handle night shift window that wraps around midnight
      inWindow = true;
    } else {
      // Calculate time to next window
      if (totalMinutes < nightWindowStart) {
        minutesToWindow = nightWindowStart - totalMinutes;
      } else if (totalMinutes < dayWindowStart) {
        minutesToWindow = dayWindowStart - totalMinutes;
      } else {
        minutesToWindow = (24 * 60 - 15) - totalMinutes;
      }
    }

    setIsInSubmissionWindow(inWindow);

    if (!inWindow && minutesToWindow > 0) {
      const hoursTo = Math.floor(minutesToWindow / 60);
      const minsTo = minutesToWindow % 60;
      setTimeToWindow(hoursTo > 0 ? `${hoursTo}h ${minsTo}m` : `${minsTo}m`);
    } else {
      setTimeToWindow('');
    }
  }, []);

  // Load saved session data
  const loadSession = useCallback(() => {
    const currentDate = new Date().toISOString().split('T')[0];
    const hours = new Date().getUTCHours() + 2;
    const currentShift = hours >= 6 && hours < 18 ? 'Day' : 'Night';
    const sessionKey = getSessionKey(machineName, currentShift, currentDate);

    const savedSession = localStorage.getItem(sessionKey);
    if (savedSession) {
      try {
        const session: ShiftSession = JSON.parse(savedSession);
        if (session.locked) {
          setOperatorName(session.operatorName);
          setOrderNumber(session.orderNumber);
          setProduct(session.product);
          setBatchNumber(session.batchNumber);
          setIsSessionLocked(true);

          // Restore entry arrays
          if (session.wasteEntries) setWasteEntries(session.wasteEntries);
          if (session.downtimeEntries) setDowntimeEntries(session.downtimeEntries);
          if (session.speedEntries) setSpeedEntries(session.speedEntries);
          if (session.sachetMassEntries) setSachetMassEntries(session.sachetMassEntries);
          if (session.looseCasesEntries) setLooseCasesEntries(session.looseCasesEntries);
          if (session.palletScanEntries) setPalletScanEntries(session.palletScanEntries);
        }
      } catch (e) {
        console.error('Failed to load session:', e);
      }
    } else {
      // No session - try to load admin order details from database
      const loadAdminOrderDetails = async () => {
        try {
          // Import dynamically to avoid circular dependency
          const { fetchActiveOrderDetails } = await import('../lib/supabase');
          const activeOrder = await fetchActiveOrderDetails();
          if (activeOrder) {
            setOrderNumber(activeOrder.order_number);
            setProduct(activeOrder.product);
            setBatchNumber(activeOrder.batch_number);
            return;
          }
        } catch (e) {
          console.error('Failed to load from database:', e);
        }

        // Fall back to localStorage
        const adminOrderDetails = localStorage.getItem('admin_order_details');
        if (adminOrderDetails) {
          try {
            const details = JSON.parse(adminOrderDetails);
            if (details.orderNumber) setOrderNumber(details.orderNumber);
            if (details.product) setProduct(details.product);
            if (details.batchNumber) setBatchNumber(details.batchNumber);
          } catch (e) {
            console.error('Failed to load admin order details:', e);
          }
        }
      };
      loadAdminOrderDetails();
    }
  }, [machineName]);

  // Save session data
  const saveSession = useCallback((showMessage = true) => {
    if (!operatorName || !orderNumber || !product || !batchNumber) return;

    const currentDate = new Date().toISOString().split('T')[0];
    // Calculate shift consistently (don't rely on state which may not be set yet)
    const hours = new Date().getUTCHours() + 2;
    const currentShift = hours >= 6 && hours < 18 ? 'Day' : 'Night';
    const sessionKey = getSessionKey(machineName, currentShift, currentDate);

    const session: ShiftSession = {
      machineName,
      operatorName,
      orderNumber,
      product,
      batchNumber,
      shift: currentShift,
      date: currentDate,
      locked: true,
      // Persist entry arrays
      wasteEntries,
      downtimeEntries,
      speedEntries,
      sachetMassEntries,
      looseCasesEntries,
      palletScanEntries,
    };

    localStorage.setItem(sessionKey, JSON.stringify(session));

    // Sync to Supabase for cross-browser visibility
    upsertLiveSession({
      machineName,
      operatorName,
      orderNumber,
      product,
      batchNumber,
      shift: currentShift,
      date: currentDate,
      locked: true,
    });

    if (!isSessionLocked) {
      setIsSessionLocked(true);
      // Update machine status to 'running' in Supabase
      if (machineId) {
        updateMachineStatus(machineId, 'running', operatorName, orderNumber, currentShift);
      }
      if (showMessage) showToast('Shift details locked for this session', 'success');
    }
  }, [machineName, operatorName, orderNumber, product, batchNumber, wasteEntries, downtimeEntries, speedEntries, sachetMassEntries, looseCasesEntries, palletScanEntries, isSessionLocked, machineId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Load available orders from machine queue
  useEffect(() => {
    const loadMachineOrders = async () => {
      if (!machineId) return;
      try {
        const orders = await fetchMachineOrders(machineId);
        setAvailableOrders(orders);
      } catch (e) {
        console.error('Failed to load machine orders:', e);
      }
    };
    loadMachineOrders();
  }, [machineId]);

  // Auto-save entries when they change (if session is locked)
  useEffect(() => {
    if (isSessionLocked && operatorName && orderNumber && product && batchNumber) {
      const currentDate = new Date().toISOString().split('T')[0];
      const hours = new Date().getUTCHours() + 2;
      const currentShift = hours >= 6 && hours < 18 ? 'Day' : 'Night';
      const sessionKey = getSessionKey(machineName, currentShift, currentDate);

      const session: ShiftSession = {
        machineName,
        operatorName,
        orderNumber,
        product,
        batchNumber,
        shift: currentShift,
        date: currentDate,
        locked: true,
        wasteEntries,
        downtimeEntries,
        speedEntries,
        sachetMassEntries,
        looseCasesEntries,
        palletScanEntries,
      };

      localStorage.setItem(sessionKey, JSON.stringify(session));
    }
  }, [wasteEntries, downtimeEntries, speedEntries, sachetMassEntries, looseCasesEntries, palletScanEntries, isSessionLocked, machineName, operatorName, orderNumber, product, batchNumber]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setDateTime(now);
      checkSubmissionWindow(now);
    }, 1000);

    // Set the shift
    const hours = dateTime.getUTCHours() + 2; // GMT+2
    const newShift = hours >= 6 && hours < 18 ? 'Day' : 'Night';

    // Detect shift change
    if (lastKnownShift !== null && lastKnownShift !== newShift && isSessionLocked) {
      // Shift has changed while session is active - prompt for new operator
      setShowShiftChangeModal(true);
    }

    setShift(newShift);
    setLastKnownShift(newShift);

    return () => clearInterval(timer);
  }, [dateTime, checkSubmissionWindow, lastKnownShift, isSessionLocked]);

  // Production Timer - Update display every second when running
  useEffect(() => {
    if (!productionState.isRunning || !productionState.lastResumedAt) return;

    const timerInterval = setInterval(() => {
      const now = Date.now();
      const currentSessionMs = now - productionState.lastResumedAt!.getTime();
      const totalMs = productionState.totalRunTimeMs + currentSessionMs;

      // Format as HH:MM:SS
      const totalSeconds = Math.floor(totalMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setDisplayRunTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [productionState.isRunning, productionState.lastResumedAt, productionState.totalRunTimeMs]);

  // Start production timer (called when session is locked)
  const handleStartProduction = useCallback(() => {
    const now = new Date();
    setProductionState({
      isRunning: true,
      startTime: now,
      pausedAt: null,
      totalRunTimeMs: 0,
      lastResumedAt: now,
    });
    setDisplayRunTime('00:00:00');
  }, []);

  // Pause production - record pause start time
  const handlePauseProduction = useCallback(() => {
    if (!productionState.isRunning) return;

    const now = new Date();
    // Calculate run time accumulated so far
    const currentSessionMs = productionState.lastResumedAt
      ? now.getTime() - productionState.lastResumedAt.getTime()
      : 0;

    setProductionState(prev => ({
      ...prev,
      isRunning: false,
      pausedAt: now,
      totalRunTimeMs: prev.totalRunTimeMs + currentSessionMs,
    }));
    showToast('Production paused - timer stopped', 'success');
  }, [productionState.isRunning, productionState.lastResumedAt, showToast]);

  // Continue production - show modal to get reason, then record downtime
  const handleContinueProduction = useCallback(() => {
    if (!pauseDowntimeReason) {
      showToast('Please select a downtime reason', 'error');
      return;
    }

    if (!productionState.pausedAt) return;

    const now = new Date();
    const pauseDurationMs = now.getTime() - productionState.pausedAt.getTime();
    const pauseDurationMinutes = Math.ceil(pauseDurationMs / 60000); // Round up to nearest minute

    // Create downtime entry automatically
    const newDowntimeEntry: DowntimeEntry = {
      id: uuidv4(),
      downtime: pauseDurationMinutes,
      downtimeReason: pauseDowntimeReason,
      notes: 'Auto-recorded from production pause',
      timestamp: productionState.pausedAt,
    };
    setDowntimeEntries(prev => [...prev, newDowntimeEntry]);

    // Resume production
    setProductionState(prev => ({
      ...prev,
      isRunning: true,
      pausedAt: null,
      lastResumedAt: now,
    }));

    // Reset modal state
    setShowContinueModal(false);
    setPauseDowntimeReason('');
    showToast(`Production resumed. ${pauseDurationMinutes} min downtime recorded.`, 'success');
  }, [pauseDowntimeReason, productionState.pausedAt, showToast]);

  // Handle Waste Entry from Modal
  const handleWasteSubmit = () => {
    if (waste && wasteType) {
      const newEntry: WasteEntry = {
        id: uuidv4(),
        waste: Number(waste),
        wasteType,
        timestamp: new Date()
      };
      setWasteEntries([...wasteEntries, newEntry]);
      setWaste('');
      setWasteType('');
      setShowWasteModal(false);
      showToast('Waste entry added', 'success');
    }
  };

  const handleDeleteWasteEntry = (id: string) => {
    setWasteEntries(wasteEntries.filter(entry => entry.id !== id));
    showToast('Entry removed', 'success');
  };

  const handleDeleteDowntimeEntry = (id: string) => {
    setDowntimeEntries(downtimeEntries.filter(entry => entry.id !== id));
    showToast('Entry removed', 'success');
  };

  // Handle Downtime Entry from Modal
  const handleDowntimeSubmit = () => {
    if (downtime && downtimeReason) {
      const newEntry: DowntimeEntry = {
        id: uuidv4(),
        downtime: Number(downtime),
        downtimeReason,
        notes: undefined,
        timestamp: new Date()
      };
      setDowntimeEntries([...downtimeEntries, newEntry]);
      setDowntime('');
      setDowntimeReason('');
      setShowDowntimeModal(false);
      showToast('Downtime entry added', 'success');
    }
  };

  const handleSubmitClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // Validation
    if (!operatorName || !orderNumber || !product || !batchNumber) {
      showToast('Please fill in all shift details', 'error');
      return;
    }

    if (wasteEntries.length === 0 && downtimeEntries.length === 0) {
      showToast('Please add at least one waste or downtime entry', 'error');
      return;
    }

    // If outside submission window, show changeover dialog first
    if (!isInSubmissionWindow) {
      setWillChangeover(null);
      setWillMaintenance(null);
      setShowChangeoverDialog(true);
    } else {
      // Within window, go directly to confirmation
      setShowConfirmDialog(true);
    }
  };

  const handleChangeoverConfirm = () => {
    if (willChangeover === null || willMaintenance === null) {
      showToast('Please answer both questions', 'error');
      return;
    }
    setShowChangeoverDialog(false);
    setShowConfirmDialog(true);
  };

  // Handle shift change confirmation - update operator for new shift
  const handleShiftChangeConfirm = () => {
    if (!newOperatorName.trim()) {
      showToast('Please enter the new operator name/number', 'error');
      return;
    }

    // Update the operator name for the new shift
    setOperatorName(newOperatorName.trim());
    setShowShiftChangeModal(false);
    setNewOperatorName('');

    // Update machine status with new operator
    if (machineId) {
      updateMachineStatus(machineId, 'running', newOperatorName.trim(), orderNumber, shift);
    }

    // Update the session with new operator
    const currentDate = new Date().toISOString().split('T')[0];
    const sessionKey = getSessionKey(machineName, shift, currentDate);

    const session: ShiftSession = {
      machineName,
      operatorName: newOperatorName.trim(),
      orderNumber,
      product,
      batchNumber,
      shift,
      date: currentDate,
      locked: true,
      wasteEntries,
      downtimeEntries,
      speedEntries,
      sachetMassEntries,
      looseCasesEntries,
      palletScanEntries,
    };

    localStorage.setItem(sessionKey, JSON.stringify(session));
    showToast(`Operator changed to ${newOperatorName.trim()} for ${shift} shift`, 'success');
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);

    // Calculate totals
    const totalWaste = wasteEntries.reduce((sum, e) => sum + e.waste, 0);
    const totalDowntime = downtimeEntries.reduce((sum, e) => sum + e.downtime, 0);

    // Create shift data object
    const shiftData: ShiftData = {
      id: uuidv4(),
      operatorName,
      machine: machineName,
      orderNumber,
      product,
      batchNumber,
      shift,
      date: dateTime.toISOString().split('T')[0],
      wasteEntries,
      downtimeEntries,
      speedEntries,
      sachetMassEntries,
      looseCasesEntries,
      palletScanEntries,
      totalWaste,
      totalDowntime,
      submittedAt: new Date()
    };

    // Prepare submission data for potential retry queue
    const submissionPayload = {
      shiftData: {
        operator_name: operatorName,
        machine: machineName,
        order_number: orderNumber,
        product,
        batch_number: batchNumber,
        shift,
        submission_date: dateTime.toISOString().split('T')[0],
        is_early_submission: !isInSubmissionWindow,
        will_changeover: willChangeover ?? undefined,
        will_maintenance_cleaning: willMaintenance ?? undefined,
      },
      wasteEntries: wasteEntries.map(e => ({ waste: e.waste, wasteType: e.wasteType, timestamp: e.timestamp })),
      downtimeEntries: downtimeEntries.map(e => ({ downtime: e.downtime, downtimeReason: e.downtimeReason, timestamp: e.timestamp })),
      speedEntries: speedEntries.map(e => ({ speed: e.speed, timestamp: e.timestamp })),
      sachetMassEntries: sachetMassEntries.map(e => ({ mass: e.mass, timestamp: e.timestamp })),
      looseCasesEntries: looseCasesEntries.map(e => ({ batchNumber: e.batchNumber, cases: e.cases, timestamp: e.timestamp })),
      palletScanEntries: palletScanEntries.map(e => ({ qrCode: e.qrCode, batchNumber: e.batchNumber, palletNumber: e.palletNumber, casesCount: e.casesCount, timestamp: e.timestamp })),
    };

    try {
      // Save to local storage first
      saveShiftData(shiftData);

      // Try to submit to Supabase with all data including changeover info
      const result = await submitShiftData(
        submissionPayload.shiftData,
        submissionPayload.wasteEntries,
        submissionPayload.downtimeEntries,
        submissionPayload.speedEntries,
        submissionPayload.sachetMassEntries,
        submissionPayload.looseCasesEntries,
        submissionPayload.palletScanEntries
      );

      // Show success with any warnings
      if (result.warnings.length > 0) {
        showToast(`Submitted with warnings: ${result.warnings.join(', ')}`, 'success');
      } else {
        showToast('Shift data submitted successfully', 'success');
      }

      // Reset form for new submission
      // Unlock shift details
      setIsSessionLocked(false);

      // Update machine status to 'idle' since order is complete
      if (machineId) {
        updateMachineStatus(machineId, 'idle');
      }

      // Clear all entries
      setWasteEntries([]);
      setDowntimeEntries([]);
      setSpeedEntries([]);
      setSachetMassEntries([]);
      setLooseCasesEntries([]);
      setPalletScanEntries([]);

      // Reset changeover state
      setWillChangeover(null);
      setWillMaintenance(false);

      // Clear session storage so new details can be entered
      sessionStorage.removeItem(`session_${machineId}`);

      // Clear the localStorage session key as well
      const currentDate = new Date().toISOString().split('T')[0];
      const sessionKey = getSessionKey(machineName, shift, currentDate);
      localStorage.removeItem(sessionKey);

      // Delete from Supabase live_sessions so other browsers see it as available
      deleteLiveSession(machineName, shift, currentDate);

      // Keep operator name but clear order-specific fields for new order
      setOrderNumber('');
      setProduct('');
      setBatchNumber('');

    } catch (error) {
      console.error('Submission error:', error);

      // Add to failed submissions queue for retry
      addFailedSubmission(submissionPayload, String(error));

      // Still saved locally, show partial success with retry info
      showToast('Saved locally. Will retry sync automatically.', 'error');

      // Clear form since data is saved locally
      setIsSessionLocked(false);

      // Update machine status to 'idle' since order is "complete" (saved locally)
      if (machineId) {
        updateMachineStatus(machineId, 'idle');
      }

      // Clear the localStorage session key
      const currentDate = new Date().toISOString().split('T')[0];
      const sessionKey = getSessionKey(machineName, shift, currentDate);
      localStorage.removeItem(sessionKey);

      // Also delete from Supabase live_sessions
      deleteLiveSession(machineName, shift, currentDate);

      setWasteEntries([]);
      setDowntimeEntries([]);
      setSpeedEntries([]);
      setSachetMassEntries([]);
      setLooseCasesEntries([]);
      setPalletScanEntries([]);
      setWillChangeover(null);
      setWillMaintenance(false);
      setOrderNumber('');
      setProduct('');
      setBatchNumber('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    // Only warn if session is NOT locked (entries won't be auto-saved)
    const hasEntries = wasteEntries.length > 0 || downtimeEntries.length > 0 ||
      speedEntries.length > 0 || sachetMassEntries.length > 0 ||
      looseCasesEntries.length > 0 || palletScanEntries.length > 0;

    if (hasEntries && !isSessionLocked) {
      if (window.confirm('You have entries that are not saved to a session. Are you sure you want to go back? Lock your shift details first to save entries.')) {
        navigate('/');
      }
    } else {
      // Session is locked = entries are auto-saved, safe to go back
      navigate('/');
    }
  };

  // Handle Speed Entry
  const handleSpeedSubmit = () => {
    if (speedInput && speedInput > 0) {
      const newEntry: SpeedEntry = {
        id: uuidv4(),
        speed: Number(speedInput),
        timestamp: new Date()
      };
      setSpeedEntries([...speedEntries, newEntry]);
      setSpeedInput('');
      setShowSpeedModal(false);
      showToast('Machine speed recorded', 'success');
    }
  };

  // Speed entry deletion (available for future UI enhancement)
  const _handleDeleteSpeedEntry = (id: string) => {
    setSpeedEntries(speedEntries.filter(entry => entry.id !== id));
    showToast('Speed entry removed', 'success');
  };
  // Suppress unused variable warning
  void _handleDeleteSpeedEntry;

  // Handle Sachet Mass Entry
  const handleSachetMassSubmit = () => {
    if (sachetMassInput && sachetMassInput > 0) {
      const newEntry: SachetMassEntry = {
        id: uuidv4(),
        mass: Number(sachetMassInput),
        timestamp: new Date()
      };
      setSachetMassEntries([...sachetMassEntries, newEntry]);
      setSachetMassInput('');
      setShowSachetModal(false);
      showToast('Sachet mass recorded', 'success');
    }
  };

  const handleToggleSachetIgnore = (id: string) => {
    setSachetMassEntries(sachetMassEntries.map(entry =>
      entry.id === id ? { ...entry, ignored: !entry.ignored } : entry
    ));
  };

  // Handle Loose Cases Entry (cases not part of a full pallet)
  const handleLooseCasesSubmit = () => {
    if (looseCasesBatchInput && looseCasesBatchInput.length === 5 && looseCasesQuantityInput && looseCasesQuantityInput > 0) {
      const newEntry: LooseCasesEntry = {
        id: uuidv4(),
        batchNumber: looseCasesBatchInput,
        cases: Number(looseCasesQuantityInput),
        timestamp: new Date()
      };
      setLooseCasesEntries([...looseCasesEntries, newEntry]);
      setLooseCasesBatchInput('');
      setLooseCasesQuantityInput('');
      setShowLooseCasesModal(false);
      showToast('Loose cases recorded', 'success');
    } else if (looseCasesBatchInput.length !== 5) {
      showToast('Batch number must be 5 digits', 'error');
    }
  };

  const handleToggleLooseCasesIgnore = (id: string) => {
    setLooseCasesEntries(looseCasesEntries.map(entry =>
      entry.id === id ? { ...entry, ignored: !entry.ignored } : entry
    ));
  };

  // Parse 13-digit QR code: BBBBBPPPPCCCC
  // B = batch (5 digits), P = pallet number (4 digits), C = cases count (4 digits)
  const parsePalletQRCode = (qrData: string): { batchNumber: string; palletNumber: string; casesCount: number } | null => {
    // Remove any whitespace
    const cleaned = qrData.trim();

    // Check if it's exactly 13 digits
    if (!/^\d{13}$/.test(cleaned)) {
      return null;
    }

    const casesCount = parseInt(cleaned.substring(9, 13), 10);

    // Extra safety check for NaN (shouldn't happen given regex validation)
    if (Number.isNaN(casesCount)) {
      return null;
    }

    return {
      batchNumber: cleaned.substring(0, 5),    // First 5 digits
      palletNumber: cleaned.substring(5, 9),   // Next 4 digits
      casesCount
    };
  };

  // Handle QR Code Pallet Scan
  const handlePalletScan = (qrData: string) => {
    const parsed = parsePalletQRCode(qrData);

    if (!parsed) {
      showToast('Invalid QR code format. Expected 13 digits: BBBBBPPPPCCCC', 'error');
      return;
    }

    // Check for duplicate pallet scan (same QR code already scanned)
    const isDuplicate = palletScanEntries.some(entry => entry.qrCode === qrData);
    if (isDuplicate) {
      showToast(`Pallet ${parsed.palletNumber} has already been scanned!`, 'error');
      return;
    }

    const newEntry: PalletScanEntry = {
      id: uuidv4(),
      qrCode: qrData,
      batchNumber: parsed.batchNumber,
      palletNumber: parsed.palletNumber,
      casesCount: parsed.casesCount,
      timestamp: new Date()
    };
    setPalletScanEntries([...palletScanEntries, newEntry]);
    showToast(`Pallet ${parsed.palletNumber} scanned (${parsed.casesCount} cases)`, 'success');
  };

  const handleTogglePalletIgnore = (id: string) => {
    setPalletScanEntries(palletScanEntries.map(entry =>
      entry.id === id ? { ...entry, ignored: !entry.ignored } : entry
    ));
  };

  // Format timestamp for pallet scans
  const formatScanTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate totals for preview
  const totalWaste = wasteEntries.reduce((sum, e) => sum + e.waste, 0);
  const totalDowntime = downtimeEntries.reduce((sum, e) => sum + e.downtime, 0);

  return (
    <motion.div
      className="capture-screen-v2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="spinner-overlay-v2">
          <div className="spinner-v2"></div>
          <p>Submitting shift data...</p>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <motion.div
          className="toast-container-v2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className={`toast-message-v2 ${toast.type}`}>
            <span className="toast-icon">{toast.type === 'success' ? '✓' : '!'}</span>
            {toast.message}
          </div>
        </motion.div>
      )}

      {/* Header */}
      <header className="capture-header-v2">
        <button className="back-btn-v2" onClick={handleBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="capture-title-v2">
          <h1>{machineName}</h1>
          <span className="capture-subtitle">Recording Waste & Downtime</span>
        </div>
        <div className={`shift-badge-v2 ${shift.toLowerCase()}`}>
          <span className="shift-icon">{shift === 'Day' ? '◐' : '◑'}</span>
          {shift} Shift
        </div>
      </header>

      <main className="capture-main">
        {/* Left Column - Form */}
        <div className="capture-form-column">
          <section className="form-section">
            <h2 className="section-heading">
              Shift Details
              {isSessionLocked && <span className="locked-badge">🔒 Locked</span>}
            </h2>

            {/* Order Queue Selection */}
            {!isSessionLocked && availableOrders.length > 0 && (
              <div className="order-queue-select">
                <button
                  className="select-order-btn"
                  onClick={() => setShowOrderSelect(true)}
                >
                  <span className="btn-icon">📋</span>
                  Select from Order Queue ({availableOrders.length} available)
                </button>
                {orderNumber && (
                  <span className="current-order-badge">
                    Current: {orderNumber}
                  </span>
                )}
              </div>
            )}

            <div className="form-grid">
              <MainForm
                operatorName={operatorName}
                setOperatorName={isSessionLocked ? () => { } : setOperatorName}
                machine={machineName}
                setMachine={() => { }}
                orderNumber={orderNumber}
                setOrderNumber={isSessionLocked ? () => { } : setOrderNumber}
                product={product}
                setProduct={isSessionLocked ? () => { } : setProduct}
                batchNumber={batchNumber}
                setBatchNumber={isSessionLocked ? () => { } : setBatchNumber}
                hideMachine={true}
                disabled={isSessionLocked}
              />
              <ShiftInfo dateTime={dateTime} shift={shift} />
            </div>

            {/* Machine Speed in Shift Details */}
            <div className="speed-setting">
              <div className="speed-display">
                <span className="speed-label">⚡ Machine Speed</span>
                <span className="speed-value">
                  {speedEntries.length > 0
                    ? `${speedEntries[speedEntries.length - 1].speed} PPM`
                    : 'Not Set'}
                </span>
                {speedEntries.length > 1 && (
                  <span className="speed-history-count" title="Speed change history">
                    ({speedEntries.length} changes)
                  </span>
                )}
              </div>
              <button
                className="speed-change-btn"
                onClick={() => setShowSpeedModal(true)}
              >
                {speedEntries.length > 0 ? 'Change' : 'Set Speed'}
              </button>
            </div>

            {!isSessionLocked && operatorName && orderNumber && product && batchNumber && (
              <button
                className="lock-session-btn"
                onClick={() => {
                  saveSession(true);
                  handleStartProduction();
                }}
              >
                🔒 Lock Shift Details & Start Production
              </button>
            )}
          </section>

          {/* Machine Details Section - Production Timer */}
          {isSessionLocked && (
            <section className="form-section machine-details-section">
              <h2 className="section-heading">
                <span className="section-icon">⚙️</span>
                Machine Details
                <span className={`production-status-badge ${productionState.isRunning ? 'running' : 'paused'}`}>
                  {productionState.isRunning ? '● Running' : '◉ Paused'}
                </span>
              </h2>

              <div className="machine-details-grid">
                {/* Production Start Time */}
                <div className="detail-card">
                  <span className="detail-label">Production Started</span>
                  <span className="detail-value">
                    {productionState.startTime
                      ? productionState.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '--:--'}
                  </span>
                </div>

                {/* Run Time Timer */}
                <div className="detail-card timer-card">
                  <span className="detail-label">Run Time</span>
                  <span className="detail-value timer-value">{displayRunTime}</span>
                </div>

                {/* Pause/Continue Button */}
                <div className="detail-card action-card">
                  {productionState.isRunning ? (
                    <button
                      className="pause-continue-btn pause"
                      onClick={handlePauseProduction}
                    >
                      <span className="btn-icon">⏸</span>
                      Pause Production
                    </button>
                  ) : (
                    <button
                      className="pause-continue-btn continue"
                      onClick={() => setShowContinueModal(true)}
                    >
                      <span className="btn-icon">▶</span>
                      Continue Production
                    </button>
                  )}
                </div>
              </div>

              {/* Pause Duration Display */}
              {productionState.pausedAt && (
                <div className="pause-duration-display">
                  <span className="pause-icon">⏱️</span>
                  Paused since {productionState.pausedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </section>
          )}

          {/* Waste Section - Button Based */}
          <section className="form-section capture-section compact-capture waste-section">
            <h2 className="section-heading">
              <span className="section-icon">🗑️</span>
              Record Waste
              {wasteEntries.length > 0 && (
                <span className="entry-count-badge waste-badge">{wasteEntries.length}</span>
              )}
            </h2>
            <div className="capture-section-content">
              <button
                className="capture-add-btn waste-btn"
                onClick={() => setShowWasteModal(true)}
              >
                <span className="btn-icon">+</span>
                Record Waste
              </button>
              {wasteEntries.length > 0 && (
                <div className="capture-entries-list">
                  {wasteEntries.slice().reverse().map((entry, index) => (
                    <div key={entry.id} className={`capture-entry-item waste-entry ${index === 0 ? 'latest' : ''}`}>
                      <div className="entry-main">
                        <span className="entry-value">{entry.waste}</span>
                        <span className="entry-unit">kg</span>
                      </div>
                      <span className="entry-type">{entry.wasteType}</span>
                      <span className="entry-time">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="entry-delete-btn"
                        onClick={() => handleDeleteWasteEntry(entry.id)}
                        title="Delete this entry"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {wasteEntries.length > 0 && (
                <div className="section-total">
                  <span>Total Waste:</span>
                  <strong>{wasteEntries.reduce((sum, e) => sum + e.waste, 0).toFixed(1)} kg</strong>
                </div>
              )}
            </div>
          </section>

          {/* Downtime Section - Button Based */}
          <section className="form-section capture-section compact-capture downtime-section">
            <h2 className="section-heading">
              <span className="section-icon">⏱️</span>
              Record Downtime
              {downtimeEntries.length > 0 && (
                <span className="entry-count-badge downtime-badge">{downtimeEntries.length}</span>
              )}
            </h2>
            <div className="capture-section-content">
              <button
                className="capture-add-btn downtime-btn"
                onClick={() => setShowDowntimeModal(true)}
              >
                <span className="btn-icon">+</span>
                Record Downtime
              </button>
              {downtimeEntries.length > 0 && (
                <div className="capture-entries-list">
                  {downtimeEntries.slice().reverse().map((entry, index) => (
                    <div key={entry.id} className={`capture-entry-item downtime-entry ${index === 0 ? 'latest' : ''}`}>
                      <div className="entry-main">
                        <span className="entry-value">{entry.downtime}</span>
                        <span className="entry-unit">min</span>
                      </div>
                      <span className="entry-reason">{entry.downtimeReason}</span>
                      <span className="entry-time">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className="entry-delete-btn"
                        onClick={() => handleDeleteDowntimeEntry(entry.id)}
                        title="Delete this entry"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {downtimeEntries.length > 0 && (
                <div className="section-total">
                  <span>Total Downtime:</span>
                  <strong>{Math.floor(downtimeEntries.reduce((sum, e) => sum + e.downtime, 0) / 60)}h {downtimeEntries.reduce((sum, e) => sum + e.downtime, 0) % 60}m</strong>
                </div>
              )}
            </div>
          </section>

          {/* Sachet Mass Section */}
          <section className="form-section capture-section compact-capture">
            <h2 className="section-heading">
              <span className="section-icon">⚖️</span>
              Sachet Mass
            </h2>
            <div className="capture-section-content">
              <button
                className="capture-add-btn"
                onClick={() => setShowSachetModal(true)}
              >
                <span className="btn-icon">+</span>
                Record
              </button>
              {sachetMassEntries.length > 0 && (
                <div className="capture-entries-list">
                  {sachetMassEntries.map(entry => (
                    <div key={entry.id} className={`capture-entry-item ${entry.ignored ? 'ignored' : ''}`}>
                      <div className="entry-main">
                        <span className="entry-value">{entry.mass}</span>
                        <span className="entry-unit">g</span>
                      </div>
                      <span className="entry-time">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        className={`entry-ignore-btn ${entry.ignored ? 'ignored' : ''}`}
                        onClick={() => handleToggleSachetIgnore(entry.id)}
                        title={entry.ignored ? 'Include this entry' : 'Ignore this entry'}
                      >
                        {entry.ignored ? '↩' : '⊘'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Product Confirmation Section - Pallets and Loose Cases */}
          <section className="form-section capture-section product-confirmation-section">
            <h2 className="section-heading">
              <span className="section-icon">📦</span>
              Product Confirmation
              {(palletScanEntries.length > 0 || looseCasesEntries.length > 0) && (
                <span className="entry-count-badge">
                  {palletScanEntries.filter(e => !e.ignored).reduce((sum, e) => sum + e.casesCount, 0) +
                    looseCasesEntries.filter(e => !e.ignored).reduce((sum, e) => sum + e.cases, 0)} cases
                </span>
              )}
            </h2>

            {/* Action Buttons */}
            <div className="product-action-buttons">
              <button
                className="capture-add-btn scan-btn"
                onClick={() => setShowQRScanner(true)}
              >
                <span className="btn-icon">📷</span>
                Scan Pallet
              </button>
              <button
                className="capture-add-btn loose-cases-btn"
                onClick={() => setShowLooseCasesModal(true)}
              >
                <span className="btn-icon">+</span>
                Add Loose Cases
              </button>
            </div>

            {/* Pallet Scans List */}
            {palletScanEntries.length > 0 && (
              <div className="product-entries-section">
                <h4 className="entries-subheading">Scanned Pallets ({palletScanEntries.filter(e => !e.ignored).length})</h4>
                <div className="capture-entries-list pallet-list">
                  {palletScanEntries.slice().reverse().map((entry, index) => (
                    <div key={entry.id} className={`capture-entry-item pallet-entry ${entry.ignored ? 'ignored' : ''} ${index === 0 ? 'latest' : ''}`}>
                      <div className="entry-main">
                        <span className="pallet-badge">P{entry.palletNumber}</span>
                        <div className="pallet-details">
                          <span className="pallet-batch">Batch: {entry.batchNumber}</span>
                          <span className="pallet-cases">{entry.casesCount} cases</span>
                        </div>
                      </div>
                      <span className="entry-time">
                        {formatScanTime(entry.timestamp)}
                      </span>
                      <button
                        className={`entry-ignore-btn ${entry.ignored ? 'ignored' : ''}`}
                        onClick={() => handleTogglePalletIgnore(entry.id)}
                        title={entry.ignored ? 'Include this pallet' : 'Ignore this pallet'}
                      >
                        {entry.ignored ? '↩' : '⊘'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loose Cases List */}
            {looseCasesEntries.length > 0 && (
              <div className="product-entries-section">
                <h4 className="entries-subheading">Loose Cases ({looseCasesEntries.filter(e => !e.ignored).length})</h4>
                <div className="capture-entries-list loose-cases-list">
                  {looseCasesEntries.slice().reverse().map((entry, index) => (
                    <div key={entry.id} className={`capture-entry-item loose-entry ${entry.ignored ? 'ignored' : ''}`}>
                      <div className="entry-main">
                        <span className="loose-badge">LC</span>
                        <div className="loose-details">
                          <span className="loose-batch">Batch: {entry.batchNumber}</span>
                          <span className="loose-cases">{entry.cases} cases</span>
                        </div>
                      </div>
                      <span className="entry-time">
                        {formatScanTime(entry.timestamp)}
                      </span>
                      <button
                        className={`entry-ignore-btn ${entry.ignored ? 'ignored' : ''}`}
                        onClick={() => handleToggleLooseCasesIgnore(entry.id)}
                        title={entry.ignored ? 'Include this entry' : 'Ignore this entry'}
                      >
                        {entry.ignored ? '↩' : '⊘'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {(palletScanEntries.length > 0 || looseCasesEntries.length > 0) && (
              <div className="product-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Pallets:</span>
                  <span className="summary-value">{palletScanEntries.filter(e => !e.ignored).length}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Total Cases:</span>
                  <span className="summary-value">
                    {palletScanEntries.filter(e => !e.ignored).reduce((sum, e) => sum + e.casesCount, 0) +
                      looseCasesEntries.filter(e => !e.ignored).reduce((sum, e) => sum + e.cases, 0)}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column - Summary & Charts */}
        <div className="capture-summary-column">
          {/* Live Stats */}
          <div className="live-stats-card">
            <h3>Session Totals</h3>
            <div className="stats-grid">
              <div className="stat-box waste">
                <span className="stat-number">{totalWaste.toFixed(1)}</span>
                <span className="stat-unit">kg waste</span>
              </div>
              <div className="stat-box downtime">
                <span className="stat-number">{totalDowntime}</span>
                <span className="stat-unit">min downtime</span>
              </div>
              <div className="stat-box cases">
                <span className="stat-number">
                  {palletScanEntries.filter(e => !e.ignored).reduce((sum, e) => sum + e.casesCount, 0) +
                    looseCasesEntries.filter(e => !e.ignored).reduce((sum, e) => sum + e.cases, 0)}
                </span>
                <span className="stat-unit">cases</span>
              </div>
              <div className="stat-box pallets">
                <span className="stat-number">{palletScanEntries.filter(e => !e.ignored).length}</span>
                <span className="stat-unit">pallets</span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-card">
            <h3>Visual Summary</h3>
            <DashboardCharts wasteEntries={wasteEntries} downtimeEntries={downtimeEntries} />
          </div>

          {/* Submission Preview */}
          {(wasteEntries.length > 0 || downtimeEntries.length > 0) && (
            <motion.div
              className="submission-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <h3>Ready to Submit</h3>
              <div className="submission-details">
                <div className="detail-row">
                  <span>Operator</span>
                  <strong>{operatorName || '—'}</strong>
                </div>
                <div className="detail-row">
                  <span>Machine</span>
                  <strong>{machineName}</strong>
                </div>
                <div className="detail-row">
                  <span>Order</span>
                  <strong>{orderNumber || '—'}</strong>
                </div>
                <div className="detail-row highlight waste">
                  <span>Total Waste</span>
                  <strong>{totalWaste.toFixed(1)} kg</strong>
                </div>
                <div className="detail-row highlight downtime">
                  <span>Total Downtime</span>
                  <strong>{Math.floor(totalDowntime / 60)}h {totalDowntime % 60}m</strong>
                </div>
              </div>
              <button
                className={`submit-btn-v2 ${!isInSubmissionWindow ? 'early-submit' : ''}`}
                onClick={handleSubmitClick}
                disabled={isSubmitting || !operatorName || !orderNumber || !product || !batchNumber}
              >
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner"></span>
                    Submitting...
                  </>
                ) : (
                  'Finalize Submission'
                )}
              </button>
              {!isInSubmissionWindow && (
                <p className="submission-window-note">
                  ⚠️ Submitting early - you'll be asked about changeover
                </p>
              )}
            </motion.div>
          )}
        </div>
      </main>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Confirm Submission"
        message={`You are about to submit ${wasteEntries.length} waste entries and ${downtimeEntries.length} downtime entries for ${machineName}.${willChangeover !== null ? ` Changeover: ${willChangeover ? 'Yes' : 'No'}. Maintenance/Cleaning: ${willMaintenance ? 'Yes' : 'No'}.` : ''} This action cannot be undone.`}
        confirmText="Submit"
        cancelText="Review"
        type="success"
        onConfirm={handleConfirmedSubmit}
        onCancel={() => setShowConfirmDialog(false)}
      />

      {/* Changeover Dialog (shown when submitting outside window) */}
      <AnimatePresence>
        {showChangeoverDialog && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="capture-modal changeover-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">⚠️</span>
                Early Submission
              </h3>
              <p className="changeover-intro">
                You are submitting before the end of shift window. Please answer the following:
              </p>

              <div className="changeover-question">
                <label className="question-label">
                  Will there be a changeover to a new product and order?
                </label>
                <div className="question-options">
                  <button
                    className={`option-btn ${willChangeover === true ? 'selected yes' : ''}`}
                    onClick={() => setWillChangeover(true)}
                  >
                    ✓ Yes
                  </button>
                  <button
                    className={`option-btn ${willChangeover === false ? 'selected no' : ''}`}
                    onClick={() => setWillChangeover(false)}
                  >
                    ✗ No
                  </button>
                </div>
              </div>

              <div className="changeover-question">
                <label className="question-label">
                  Will there be maintenance or cleaning before next production start?
                </label>
                <div className="question-options">
                  <button
                    className={`option-btn ${willMaintenance === true ? 'selected yes' : ''}`}
                    onClick={() => setWillMaintenance(true)}
                  >
                    ✓ Yes
                  </button>
                  <button
                    className={`option-btn ${willMaintenance === false ? 'selected no' : ''}`}
                    onClick={() => setWillMaintenance(false)}
                  >
                    ✗ No
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => setShowChangeoverDialog(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm"
                  onClick={handleChangeoverConfirm}
                  disabled={willChangeover === null || willMaintenance === null}
                >
                  Continue to Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shift Change Modal */}
      <AnimatePresence>
        {showShiftChangeModal && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="capture-modal shift-change-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">🔄</span>
                Shift Change Detected
              </h3>
              <p className="modal-description">
                The shift has changed to <strong>{shift}</strong> shift.
                Please enter the new operator's name or number.
              </p>
              <div className="modal-form">
                <label className="modal-label">New Operator Name/Number</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Enter operator name or number..."
                  value={newOperatorName}
                  onChange={e => setNewOperatorName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="shift-change-info">
                <p><strong>Current Order:</strong> {orderNumber}</p>
                <p><strong>Previous Operator:</strong> {operatorName}</p>
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn confirm"
                  onClick={handleShiftChangeConfirm}
                  disabled={!newOperatorName.trim()}
                >
                  Confirm Operator Change
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Machine Speed Modal */}
      <AnimatePresence>
        {showSpeedModal && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSpeedModal(false)}
          >
            <motion.div
              className="capture-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">⚡</span>
                Record Machine Speed
              </h3>
              <div className="modal-form">
                <label className="modal-label">Speed (PPM - Packs Per Minute)</label>
                <input
                  type="number"
                  className="modal-input"
                  placeholder="Enter speed..."
                  value={speedInput}
                  onChange={e => setSpeedInput(e.target.value ? Number(e.target.value) : '')}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => { setShowSpeedModal(false); setSpeedInput(''); }}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm"
                  onClick={handleSpeedSubmit}
                  disabled={!speedInput || speedInput <= 0}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sachet Mass Modal */}
      <AnimatePresence>
        {showSachetModal && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSachetModal(false)}
          >
            <motion.div
              className="capture-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">⚖️</span>
                Record Sachet Mass
              </h3>
              <div className="modal-form">
                <label className="modal-label">Mass (grams)</label>
                <input
                  type="number"
                  step="0.1"
                  className="modal-input"
                  placeholder="Enter mass in grams..."
                  value={sachetMassInput}
                  onChange={e => setSachetMassInput(e.target.value ? Number(e.target.value) : '')}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => { setShowSachetModal(false); setSachetMassInput(''); }}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm"
                  onClick={handleSachetMassSubmit}
                  disabled={!sachetMassInput || sachetMassInput <= 0}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waste Modal */}
      <AnimatePresence>
        {showWasteModal && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWasteModal(false)}
          >
            <motion.div
              className="capture-modal waste-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">🗑️</span>
                Record Waste
              </h3>
              <div className="modal-form">
                <div className="form-row">
                  <label className="modal-label">Waste Type</label>
                  <select
                    className="modal-select"
                    value={wasteType}
                    onChange={e => setWasteType(e.target.value)}
                  >
                    <option value="">Select waste type...</option>
                    {WASTE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="modal-label">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="modal-input"
                    placeholder="Enter weight in kg..."
                    value={waste}
                    onChange={e => setWaste(e.target.value ? Number(e.target.value) : '')}
                    min={0}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowWasteModal(false);
                    setWaste('');
                    setWasteType('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm waste-confirm"
                  onClick={handleWasteSubmit}
                  disabled={!waste || waste <= 0 || !wasteType}
                >
                  Add Waste Entry
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Downtime Modal */}
      <AnimatePresence>
        {showDowntimeModal && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDowntimeModal(false)}
          >
            <motion.div
              className="capture-modal downtime-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">⏱️</span>
                Record Downtime
              </h3>
              <div className="modal-form">
                <div className="form-row">
                  <label className="modal-label">Downtime Reason</label>
                  <select
                    className="modal-select"
                    value={downtimeReason}
                    onChange={e => setDowntimeReason(e.target.value)}
                  >
                    <option value="">Select reason...</option>
                    {DOWNTIME_REASONS.map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label className="modal-label">Duration (minutes)</label>
                  <input
                    type="number"
                    className="modal-input"
                    placeholder="Enter minutes..."
                    value={downtime}
                    onChange={e => setDowntime(e.target.value ? Number(e.target.value) : '')}
                    min={1}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowDowntimeModal(false);
                    setDowntime('');
                    setDowntimeReason('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm downtime-confirm"
                  onClick={handleDowntimeSubmit}
                  disabled={!downtime || downtime <= 0 || !downtimeReason}
                >
                  Add Downtime Entry
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue Production Modal */}
      <AnimatePresence>
        {showContinueModal && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowContinueModal(false)}
          >
            <motion.div
              className="capture-modal continue-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">▶</span>
                Continue Production
              </h3>
              <div className="modal-form">
                <div className="pause-info">
                  <span className="pause-duration-label">Paused Duration:</span>
                  <span className="pause-duration-value">
                    {productionState.pausedAt
                      ? `${Math.ceil((Date.now() - productionState.pausedAt.getTime()) / 60000)} minutes`
                      : '0 minutes'}
                  </span>
                </div>
                <div className="form-row">
                  <label className="modal-label">What was the reason for this downtime?</label>
                  <select
                    className="modal-select"
                    value={pauseDowntimeReason}
                    onChange={e => setPauseDowntimeReason(e.target.value)}
                    autoFocus
                  >
                    <option value="">Select reason...</option>
                    {DOWNTIME_REASONS.map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowContinueModal(false);
                    setPauseDowntimeReason('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm continue-confirm"
                  onClick={handleContinueProduction}
                  disabled={!pauseDowntimeReason}
                >
                  Record & Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loose Cases Modal */}
      <AnimatePresence>
        {showLooseCasesModal && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLooseCasesModal(false)}
          >
            <motion.div
              className="capture-modal loose-cases-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">📦</span>
                Add Loose Cases
              </h3>
              <p className="modal-description">
                Enter cases that are not part of a full pallet scan
              </p>
              <div className="modal-form">
                <div className="form-row">
                  <label className="modal-label">Batch Number (5 digits)</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="e.g., 12345"
                    value={looseCasesBatchInput}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setLooseCasesBatchInput(value);
                    }}
                    maxLength={5}
                    autoFocus
                  />
                </div>
                <div className="form-row">
                  <label className="modal-label">Number of Cases</label>
                  <input
                    type="number"
                    className="modal-input"
                    placeholder="Enter quantity..."
                    value={looseCasesQuantityInput}
                    onChange={e => setLooseCasesQuantityInput(e.target.value ? Number(e.target.value) : '')}
                    min={1}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => {
                    setShowLooseCasesModal(false);
                    setLooseCasesBatchInput('');
                    setLooseCasesQuantityInput('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn confirm"
                  onClick={handleLooseCasesSubmit}
                  disabled={looseCasesBatchInput.length !== 5 || !looseCasesQuantityInput || looseCasesQuantityInput <= 0}
                >
                  Add Cases
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Scanner for Pallet Scans */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handlePalletScan}
        recentScans={palletScanEntries.map(e => e.qrCode)}
      />

      {/* Order Queue Selection Modal */}
      <AnimatePresence>
        {showOrderSelect && (
          <motion.div
            className="capture-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowOrderSelect(false)}
          >
            <motion.div
              className="capture-modal order-select-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="modal-title">
                <span className="modal-icon">📋</span>
                Select Order
              </h3>
              <p className="modal-description">
                Choose an order from the queue (sorted by priority)
              </p>
              <div className="order-queue-list">
                {availableOrders.map((order, index) => (
                  <button
                    key={order.id}
                    className={`order-queue-item ${orderNumber === order.order_number ? 'selected' : ''}`}
                    onClick={() => handleOrderSelect(order)}
                  >
                    <span className="order-priority">#{index + 1}</span>
                    <div className="order-details">
                      <span className="order-number">{order.order_number}</span>
                      <span className="order-product">{order.product}</span>
                      <span className="order-batch">Batch: {order.batch_number}</span>
                    </div>
                    {orderNumber === order.order_number && (
                      <span className="order-selected-badge">✓</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => setShowOrderSelect(false)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CaptureScreen;
