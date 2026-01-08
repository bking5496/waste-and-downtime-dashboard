import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import ShiftInfo from '../components/ShiftInfo';
import ConfirmDialog from '../components/ConfirmDialog';
import { WasteEntry, DowntimeEntry, ShiftData, ShiftSession, OPERATORS, WASTE_TYPES, DOWNTIME_REASONS } from '../types';
import { submitShiftData } from '../lib/supabase';
import { saveShiftData } from '../lib/storage';

// Storage key for shift session
const getSessionKey = (machineName: string, shift: string, date: string) =>
    `shift_session_${machineName}_${shift}_${date}`;

// Interface for per-machine data
interface MachineData {
    machineName: string;
    operatorName: string;
    speed: number | '';
}

const MultiCaptureScreen: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Get machine names from navigation state
    const machineNames = (location.state as { machineNames?: string[] })?.machineNames || [];
    const parentGroup = (location.state as { parentGroup?: string })?.parentGroup || '';
    const isMultiMachine = (location.state as { isMultiMachine?: boolean })?.isMultiMachine || false;

    // Extract machine numbers for display (e.g., "1, 2" from "Canline - Machine 1, Canline - Machine 2")
    const machineNumbers = machineNames.map(name => name.split(' - Machine ')[1] || '?').join(', ');

    // Redirect if no machines selected
    useEffect(() => {
        if (!isMultiMachine || machineNames.length === 0) {
            navigate('/');
        }
    }, [isMultiMachine, machineNames, navigate]);

    // Track current machine(s) for chat widget location context
    useEffect(() => {
        if (parentGroup && machineNumbers) {
            localStorage.setItem('chat_current_machine', `${parentGroup} - Machine ${machineNumbers}`);
        }
        return () => {
            localStorage.removeItem('chat_current_machine');
        };
    }, [parentGroup, machineNumbers]);


    const [dateTime, setDateTime] = useState(new Date());
    const [shift, setShift] = useState('');

    // Loading and feedback states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Per-machine data: operator and speed for each machine
    const [machineDataList, setMachineDataList] = useState<MachineData[]>(
        machineNames.map(name => ({ machineName: name, operatorName: '', speed: '' }))
    );

    // Shared order details
    const [orderNumber, setOrderNumber] = useState('');
    const [product, setProduct] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [isSessionLocked, setIsSessionLocked] = useState(false);

    // Shared waste and downtime entries (apply to all machines)
    const [wasteEntries, setWasteEntries] = useState<WasteEntry[]>([]);
    const [downtimeEntries, setDowntimeEntries] = useState<DowntimeEntry[]>([]);

    // Modal states
    const [showWasteModal, setShowWasteModal] = useState(false);
    const [showDowntimeModal, setShowDowntimeModal] = useState(false);
    const [waste, setWaste] = useState<number | ''>('');
    const [wasteType, setWasteType] = useState('');
    const [downtime, setDowntime] = useState<number | ''>('');
    const [downtimeReason, setDowntimeReason] = useState('');

    // Toast notification
    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Update shift and time
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setDateTime(now);
        }, 1000);

        const hours = dateTime.getUTCHours() + 2;
        setShift(hours >= 6 && hours < 18 ? 'Day' : 'Night');

        return () => clearInterval(timer);
    }, [dateTime]);

    // Update a specific machine's data
    const updateMachineData = (index: number, field: keyof MachineData, value: string | number) => {
        setMachineDataList(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Check if all machines have operators assigned
    const allMachinesHaveOperators = machineDataList.every(m => m.operatorName !== '');
    const canLockSession = allMachinesHaveOperators && orderNumber && product && batchNumber;

    // Lock session
    const handleLockSession = () => {
        if (!canLockSession) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        // Save session for each machine
        const currentDate = new Date().toISOString().split('T')[0];
        const hours = new Date().getUTCHours() + 2;
        const currentShift = hours >= 6 && hours < 18 ? 'Day' : 'Night';

        machineDataList.forEach(machineData => {
            const sessionKey = getSessionKey(machineData.machineName, currentShift, currentDate);
            const session: ShiftSession = {
                machineName: machineData.machineName,
                operatorName: machineData.operatorName,
                orderNumber,
                product,
                batchNumber,
                shift: currentShift,
                date: currentDate,
                locked: true,
                wasteEntries,
                downtimeEntries,
                speedEntries: machineData.speed ? [{ id: uuidv4(), speed: Number(machineData.speed), timestamp: new Date() }] : [],
            };
            localStorage.setItem(sessionKey, JSON.stringify(session));
        });

        setIsSessionLocked(true);
        showToast('Sessions locked for all machines', 'success');
    };

    // Handle Waste Entry
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

    // Handle Downtime Entry
    const handleDowntimeSubmit = () => {
        if (downtime && downtimeReason) {
            const newEntry: DowntimeEntry = {
                id: uuidv4(),
                downtime: Number(downtime),
                downtimeReason,
                timestamp: new Date()
            };
            setDowntimeEntries([...downtimeEntries, newEntry]);
            setDowntime('');
            setDowntimeReason('');
            setShowDowntimeModal(false);
            showToast('Downtime entry added', 'success');
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

    // Submit all machines
    const handleSubmitClick = () => {
        if (!isSessionLocked) {
            showToast('Please lock session details first', 'error');
            return;
        }

        if (wasteEntries.length === 0 && downtimeEntries.length === 0) {
            showToast('Please add at least one waste or downtime entry', 'error');
            return;
        }

        setShowConfirmDialog(true);
    };

    const handleConfirmedSubmit = async () => {
        setShowConfirmDialog(false);
        setIsSubmitting(true);

        const totalWaste = wasteEntries.reduce((sum, e) => sum + e.waste, 0);
        const totalDowntime = downtimeEntries.reduce((sum, e) => sum + e.downtime, 0);

        try {
            // Submit for each machine
            for (const machineData of machineDataList) {
                const shiftData: ShiftData = {
                    id: uuidv4(),
                    operatorName: machineData.operatorName,
                    machine: machineData.machineName,
                    orderNumber,
                    product,
                    batchNumber,
                    shift,
                    date: dateTime.toISOString().split('T')[0],
                    wasteEntries,
                    downtimeEntries,
                    speedEntries: machineData.speed ? [{ id: uuidv4(), speed: Number(machineData.speed), timestamp: new Date() }] : [],
                    totalWaste,
                    totalDowntime,
                    submittedAt: new Date()
                };

                // Save to local storage
                saveShiftData(shiftData);

                // Submit to Supabase
                await submitShiftData(
                    {
                        operator_name: machineData.operatorName,
                        machine: machineData.machineName,
                        order_number: orderNumber,
                        product,
                        batch_number: batchNumber,
                        shift,
                        submission_date: dateTime.toISOString().split('T')[0],
                        is_early_submission: false,
                    },
                    wasteEntries.map(e => ({ waste: e.waste, wasteType: e.wasteType, timestamp: e.timestamp })),
                    downtimeEntries.map(e => ({ downtime: e.downtime, downtimeReason: e.downtimeReason, timestamp: e.timestamp })),
                    machineData.speed ? [{ speed: Number(machineData.speed), timestamp: new Date() }] : [],
                    [],
                    [],
                    []
                );
            }

            showToast(`Submitted for ${machineDataList.length} machines`, 'success');

            // Clear sessions
            const currentDate = new Date().toISOString().split('T')[0];
            const hours = new Date().getUTCHours() + 2;
            const currentShift = hours >= 6 && hours < 18 ? 'Day' : 'Night';
            machineDataList.forEach(m => {
                localStorage.removeItem(getSessionKey(m.machineName, currentShift, currentDate));
            });

            setTimeout(() => navigate('/'), 2000);
        } catch (error) {
            console.error('Submission error:', error);
            showToast('Saved locally. Database sync failed.', 'error');
            setTimeout(() => navigate('/'), 2000);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBack = () => {
        navigate('/');
    };

    // Calculate totals
    const totalWaste = wasteEntries.reduce((sum, e) => sum + e.waste, 0);
    const totalDowntime = downtimeEntries.reduce((sum, e) => sum + e.downtime, 0);

    return (
        <motion.div
            className="capture-screen-v2 multi-capture"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            {/* Loading Overlay */}
            {isSubmitting && (
                <div className="spinner-overlay-v2">
                    <div className="spinner-v2"></div>
                    <p>Submitting for {machineDataList.length} machines...</p>
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

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={showConfirmDialog}
                title="Submit for All Machines?"
                message={`This will submit data for ${machineDataList.length} machines:\n${machineDataList.map(m => m.machineName).join(', ')}`}
                onConfirm={handleConfirmedSubmit}
                onCancel={() => setShowConfirmDialog(false)}
            />

            {/* Header */}
            <header className="capture-header-v2">
                <button className="back-btn-v2" onClick={handleBack}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="capture-title-v2">
                    <h1>{parentGroup} — Machine {machineNumbers}</h1>
                    <span className="capture-subtitle">Recording for {machineDataList.length} machines</span>
                </div>
                <div className={`shift-badge-v2 ${shift.toLowerCase()}`}>
                    <span className="shift-icon">{shift === 'Day' ? '◐' : '◑'}</span>
                    {shift} Shift
                </div>
            </header>

            <main className="capture-main multi-capture-main">
                {/* Left Column - Machine-Specific Data */}
                <div className="capture-form-column">
                    <section className="form-section">
                        <h2 className="section-heading">
                            Machine Assignments
                            {isSessionLocked && <span className="locked-badge">🔒 Locked</span>}
                        </h2>

                        <div className="multi-machine-grid">
                            {machineDataList.map((machineData, index) => (
                                <div key={machineData.machineName} className="machine-card">
                                    <div className="machine-card-header">
                                        <span className="machine-number">{index + 1}</span>
                                        <span className="machine-card-name">
                                            {machineData.machineName.split(' - ')[1] || machineData.machineName}
                                        </span>
                                        <span className="machine-parent">
                                            {machineData.machineName.split(' - ')[0]}
                                        </span>
                                    </div>

                                    <div className="machine-card-fields">
                                        <div className="form-field">
                                            <label className="form-label">Operator</label>
                                            <select
                                                className="form-select"
                                                value={machineData.operatorName}
                                                onChange={e => updateMachineData(index, 'operatorName', e.target.value)}
                                                disabled={isSessionLocked}
                                            >
                                                <option value="">Select Operator</option>
                                                {OPERATORS.map(op => (
                                                    <option key={op} value={op}>{op}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Speed (PPM)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                placeholder="Enter speed"
                                                value={machineData.speed}
                                                onChange={e => updateMachineData(index, 'speed', e.target.value ? Number(e.target.value) : '')}
                                                disabled={isSessionLocked}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Shared Order Details */}
                    <section className="form-section">
                        <h2 className="section-heading">Shared Order Details</h2>
                        <div className="form-grid">
                            <div className="form-field">
                                <label className="form-label">Order Number</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter order number"
                                    value={orderNumber}
                                    onChange={e => setOrderNumber(e.target.value)}
                                    disabled={isSessionLocked}
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Product</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter product"
                                    value={product}
                                    onChange={e => setProduct(e.target.value)}
                                    disabled={isSessionLocked}
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Batch Number</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter batch"
                                    value={batchNumber}
                                    onChange={e => setBatchNumber(e.target.value)}
                                    disabled={isSessionLocked}
                                />
                            </div>
                            <ShiftInfo dateTime={dateTime} shift={shift} />
                        </div>

                        {!isSessionLocked && canLockSession && (
                            <button
                                className="lock-session-btn"
                                onClick={handleLockSession}
                            >
                                🔒 Lock All Machine Sessions
                            </button>
                        )}
                    </section>
                </div>

                {/* Right Column - Recording */}
                <div className="capture-entries-column">
                    {/* Waste Section */}
                    <section className="form-section capture-section compact-capture waste-section">
                        <h2 className="section-heading">
                            <span className="section-icon">🗑️</span>
                            Record Waste (applies to all)
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
                                    <strong>{totalWaste.toFixed(1)} kg</strong>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Downtime Section */}
                    <section className="form-section capture-section compact-capture downtime-section">
                        <h2 className="section-heading">
                            <span className="section-icon">⏱️</span>
                            Record Downtime (applies to all)
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
                                    <strong>{Math.floor(totalDowntime / 60)}h {totalDowntime % 60}m</strong>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Submit Button */}
                    <button
                        className="submit-all-btn"
                        onClick={handleSubmitClick}
                        disabled={!isSessionLocked || isSubmitting}
                    >
                        Submit for All {machineDataList.length} Machines
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </main>

            {/* Waste Modal */}
            <AnimatePresence>
                {showWasteModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowWasteModal(false)}
                    >
                        <motion.div
                            className="modal-content"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3>Record Waste</h3>
                            <div className="modal-form">
                                <div className="form-field">
                                    <label className="form-label">Amount (kg)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={waste}
                                        onChange={e => setWaste(e.target.value ? Number(e.target.value) : '')}
                                        placeholder="Enter waste amount"
                                        autoFocus
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="form-label">Waste Type</label>
                                    <select
                                        className="form-select"
                                        value={wasteType}
                                        onChange={e => setWasteType(e.target.value)}
                                    >
                                        <option value="">Select Type</option>
                                        {WASTE_TYPES.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button className="modal-cancel" onClick={() => setShowWasteModal(false)}>Cancel</button>
                                <button className="modal-confirm" onClick={handleWasteSubmit} disabled={!waste || !wasteType}>
                                    Add Entry
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
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowDowntimeModal(false)}
                    >
                        <motion.div
                            className="modal-content"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3>Record Downtime</h3>
                            <div className="modal-form">
                                <div className="form-field">
                                    <label className="form-label">Duration (minutes)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={downtime}
                                        onChange={e => setDowntime(e.target.value ? Number(e.target.value) : '')}
                                        placeholder="Enter duration"
                                        autoFocus
                                    />
                                </div>
                                <div className="form-field">
                                    <label className="form-label">Reason</label>
                                    <select
                                        className="form-select"
                                        value={downtimeReason}
                                        onChange={e => setDowntimeReason(e.target.value)}
                                    >
                                        <option value="">Select Reason</option>
                                        {DOWNTIME_REASONS.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button className="modal-cancel" onClick={() => setShowDowntimeModal(false)}>Cancel</button>
                                <button className="modal-confirm" onClick={handleDowntimeSubmit} disabled={!downtime || !downtimeReason}>
                                    Add Entry
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default MultiCaptureScreen;
