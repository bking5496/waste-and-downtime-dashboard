import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    isSupabaseConfigured,
    fetchAllMachineOrders,
    addMachineOrder,
    removeMachineOrder,
    updateMachineOrderPriorities,
    clearMachineOrders,
    MachineOrderQueueRecord
} from '../lib/supabase';
import { getMachinesData } from '../lib/storage';
import { Machine } from '../types';
import {
    getFacilitySettings,
    saveFacilitySettings,
    resetFacilitySettings,
    FacilitySettings,
    formatShiftTimes
} from '../lib/facilitySettings';
import { showSuccess, showError } from '../lib/errorMonitoring';

// Parsed order from bulk paste
interface ParsedOrder {
    machineName: string;
    machineId: string;
    orderNumber: string;
    product: string;
    batchNumber: string;
    valid: boolean;
    error?: string;
}

const AdminConsole: React.FC = () => {
    const navigate = useNavigate();

    // Form state for adding new orders
    const [selectedMachine, setSelectedMachine] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [product, setProduct] = useState('');
    const [batchNumber, setBatchNumber] = useState('');

    // Bulk paste state
    const [bulkPasteText, setBulkPasteText] = useState('');
    const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
    const [showBulkPreview, setShowBulkPreview] = useState(false);
    const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('bulk');

    // Data state
    const [machines, setMachines] = useState<Machine[]>([]);
    const [machineOrders, setMachineOrders] = useState<Record<string, MachineOrderQueueRecord[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Facility settings state
    const [facilitySettings, setFacilitySettings] = useState<FacilitySettings>(getFacilitySettings());
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Handle facility settings save
    const handleSaveSettings = () => {
        try {
            const updated = saveFacilitySettings(facilitySettings);
            setFacilitySettings(updated);
            showSuccess('Facility settings saved');
            setShowSettingsPanel(false);
        } catch (e) {
            showError('Failed to save settings');
        }
    };

    // Handle facility settings reset
    const handleResetSettings = () => {
        if (window.confirm('Reset all facility settings to defaults?')) {
            const defaults = resetFacilitySettings();
            setFacilitySettings(defaults);
            showSuccess('Settings reset to defaults');
        }
    };

    // Load machines and orders
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load machines from storage
            const machinesData = getMachinesData();
            setMachines(machinesData);

            if (machinesData.length > 0 && !selectedMachine) {
                setSelectedMachine(machinesData[0].id);
            }

            // Load orders from Supabase
            if (isSupabaseConfigured) {
                const allOrders = await fetchAllMachineOrders();
                // Group orders by machine
                const grouped: Record<string, MachineOrderQueueRecord[]> = {};
                machinesData.forEach(m => {
                    grouped[m.id] = allOrders.filter(o => o.machine_id === m.id);
                });
                setMachineOrders(grouped);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Failed to load data', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedMachine]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Find machine by name (case-insensitive, partial match)
    const findMachine = useCallback((name: string): Machine | undefined => {
        const normalizedName = name.trim().toLowerCase();
        return machines.find(m =>
            m.name.toLowerCase() === normalizedName ||
            m.name.toLowerCase().includes(normalizedName) ||
            normalizedName.includes(m.name.toLowerCase())
        );
    }, [machines]);

    // Parse bulk paste text
    const parseBulkText = useCallback((text: string): ParsedOrder[] => {
        if (!text.trim()) return [];

        const lines = text.split('\n').filter(line => line.trim());
        const orders: ParsedOrder[] = [];

        for (const line of lines) {
            // Try to split by tab first, then comma
            let parts = line.split('\t');
            if (parts.length < 4) {
                parts = line.split(',');
            }

            // Clean up parts
            parts = parts.map(p => p.trim());

            if (parts.length >= 4) {
                const [machineName, orderNum, prod, batch] = parts;
                const machine = findMachine(machineName);

                orders.push({
                    machineName: machineName,
                    machineId: machine?.id || '',
                    orderNumber: orderNum,
                    product: prod,
                    batchNumber: batch,
                    valid: !!machine && !!orderNum && !!prod && !!batch,
                    error: !machine ? `Machine "${machineName}" not found` :
                           !orderNum ? 'Missing order number' :
                           !prod ? 'Missing product' :
                           !batch ? 'Missing batch' : undefined
                });
            } else if (parts.length > 0 && parts[0]) {
                // Invalid line format
                orders.push({
                    machineName: parts[0] || 'Unknown',
                    machineId: '',
                    orderNumber: parts[1] || '',
                    product: parts[2] || '',
                    batchNumber: parts[3] || '',
                    valid: false,
                    error: 'Invalid format. Expected: Machine, Order, Product, Batch'
                });
            }
        }

        return orders;
    }, [findMachine]);

    // Handle bulk text change
    const handleBulkTextChange = (text: string) => {
        setBulkPasteText(text);
        const parsed = parseBulkText(text);
        setParsedOrders(parsed);
        setShowBulkPreview(parsed.length > 0);
    };

    // Import all valid orders
    const handleBulkImport = async () => {
        const validOrders = parsedOrders.filter(o => o.valid);
        if (validOrders.length === 0) {
            showToast('No valid orders to import', 'error');
            return;
        }

        setIsSaving(true);
        try {
            // Group orders by machine to maintain priority within each machine
            const ordersByMachine: Record<string, ParsedOrder[]> = {};
            validOrders.forEach(order => {
                if (!ordersByMachine[order.machineId]) {
                    ordersByMachine[order.machineId] = [];
                }
                ordersByMachine[order.machineId].push(order);
            });

            // Add orders for each machine in sequence
            for (const machineId of Object.keys(ordersByMachine)) {
                const machineOrders = ordersByMachine[machineId];
                for (const order of machineOrders) {
                    await addMachineOrder(
                        order.machineId,
                        order.orderNumber,
                        order.product,
                        order.batchNumber
                    );
                }
            }

            await loadData();
            showToast(`Successfully imported ${validOrders.length} orders`, 'success');

            // Clear the form
            setBulkPasteText('');
            setParsedOrders([]);
            setShowBulkPreview(false);
        } catch (error) {
            console.error('Error importing orders:', error);
            showToast('Failed to import orders', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddOrder = async () => {
        if (!selectedMachine) {
            showToast('Please select a machine', 'error');
            return;
        }
        if (!orderNumber.trim() || !product.trim() || !batchNumber.trim()) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        setIsSaving(true);
        try {
            if (isSupabaseConfigured) {
                await addMachineOrder(selectedMachine, orderNumber, product, batchNumber);
                await loadData();
                showToast('Order added successfully', 'success');
                // Clear form
                setOrderNumber('');
                setProduct('');
                setBatchNumber('');
            } else {
                showToast('Supabase not configured', 'error');
            }
        } catch (error) {
            console.error('Error adding order:', error);
            showToast('Failed to add order', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveOrder = async (orderId: number) => {
        if (!window.confirm('Remove this order from the queue?')) return;

        try {
            await removeMachineOrder(orderId);
            await loadData();
            showToast('Order removed', 'success');
        } catch (error) {
            console.error('Error removing order:', error);
            showToast('Failed to remove order', 'error');
        }
    };

    const handleMoveOrder = async (machineId: string, orderId: number, direction: 'up' | 'down') => {
        const orders = machineOrders[machineId] || [];
        const currentIndex = orders.findIndex(o => o.id === orderId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= orders.length) return;

        // Swap orders
        const newOrders = [...orders];
        [newOrders[currentIndex], newOrders[newIndex]] = [newOrders[newIndex], newOrders[currentIndex]];

        // Update local state immediately for responsiveness
        setMachineOrders(prev => ({
            ...prev,
            [machineId]: newOrders
        }));

        // Update priorities in database
        try {
            const orderIds = newOrders.map(o => o.id!);
            await updateMachineOrderPriorities(machineId, orderIds);
        } catch (error) {
            console.error('Error updating order priorities:', error);
            // Reload data to restore correct state
            await loadData();
            showToast('Failed to reorder', 'error');
        }
    };

    const handleClearMachineOrders = async (machineId: string) => {
        const machine = machines.find(m => m.id === machineId);
        if (!window.confirm(`Clear all orders for ${machine?.name || machineId}?`)) return;

        try {
            await clearMachineOrders(machineId);
            await loadData();
            showToast('Orders cleared', 'success');
        } catch (error) {
            console.error('Error clearing orders:', error);
            showToast('Failed to clear orders', 'error');
        }
    };

    // Count valid and invalid orders
    const validCount = parsedOrders.filter(o => o.valid).length;
    const invalidCount = parsedOrders.filter(o => !o.valid).length;

    if (isLoading) {
        return (
            <div className="admin-console loading">
                <div className="spinner-v2"></div>
                <p>Loading order queues...</p>
            </div>
        );
    }

    return (
        <motion.div
            className="admin-console"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
        >
            {/* Toast */}
            <AnimatePresence>
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
            </AnimatePresence>

            {/* Header */}
            <header className="admin-header">
                <button className="back-btn-v2" onClick={() => navigate('/')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="admin-title">
                    <h1>Admin Console</h1>
                    <span className="admin-subtitle">Machine Order Queues</span>
                </div>
            </header>

            <main className="admin-main">
                {/* Add Order Section with Tabs */}
                <section className="admin-form-section">
                    <div className="admin-tabs">
                        <button
                            className={`admin-tab ${activeTab === 'bulk' ? 'active' : ''}`}
                            onClick={() => setActiveTab('bulk')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Bulk Import
                        </button>
                        <button
                            className={`admin-tab ${activeTab === 'single' ? 'active' : ''}`}
                            onClick={() => setActiveTab('single')}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            Single Order
                        </button>
                    </div>

                    {activeTab === 'bulk' ? (
                        <div className="admin-form bulk-form">
                            <div className="form-field">
                                <label className="form-label">
                                    Paste Orders (one per line)
                                    <span className="form-hint">Format: Machine, Order Number, Product, Batch Number</span>
                                </label>
                                <textarea
                                    className="form-textarea"
                                    placeholder={`Example:\nCanline, ORD-001, Product A, BATCH001\nSachet Line, ORD-002, Product B, BATCH002\nCanline, ORD-003, Product C, BATCH003`}
                                    value={bulkPasteText}
                                    onChange={e => handleBulkTextChange(e.target.value)}
                                    rows={8}
                                />
                            </div>

                            {/* Preview */}
                            {showBulkPreview && (
                                <div className="bulk-preview">
                                    <div className="preview-header">
                                        <h3>Preview ({validCount} valid, {invalidCount} invalid)</h3>
                                    </div>
                                    <div className="preview-list">
                                        {parsedOrders.map((order, index) => (
                                            <div
                                                key={index}
                                                className={`preview-item ${order.valid ? 'valid' : 'invalid'}`}
                                            >
                                                <span className="preview-priority">{index + 1}</span>
                                                <div className="preview-details">
                                                    <span className="preview-machine">{order.machineName}</span>
                                                    <span className="preview-order">{order.orderNumber}</span>
                                                    <span className="preview-product">{order.product}</span>
                                                    <span className="preview-batch">{order.batchNumber}</span>
                                                </div>
                                                {!order.valid && (
                                                    <span className="preview-error">{order.error}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="admin-actions">
                                <button
                                    className="admin-save-btn"
                                    onClick={handleBulkImport}
                                    disabled={isSaving || validCount === 0}
                                >
                                    {isSaving ? 'Importing...' : `Import ${validCount} Orders`}
                                </button>
                                {bulkPasteText && (
                                    <button
                                        className="admin-clear-btn"
                                        onClick={() => {
                                            setBulkPasteText('');
                                            setParsedOrders([]);
                                            setShowBulkPreview(false);
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="admin-form">
                            <div className="form-field">
                                <label className="form-label">Machine</label>
                                <select
                                    className="form-input"
                                    value={selectedMachine}
                                    onChange={e => setSelectedMachine(e.target.value)}
                                >
                                    <option value="">Select a machine...</option>
                                    {machines.map(machine => (
                                        <option key={machine.id} value={machine.id}>
                                            {machine.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-field">
                                <label className="form-label">Order Number</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter order number"
                                    value={orderNumber}
                                    onChange={e => setOrderNumber(e.target.value)}
                                />
                            </div>

                            <div className="form-field">
                                <label className="form-label">Product</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter product name"
                                    value={product}
                                    onChange={e => setProduct(e.target.value)}
                                />
                            </div>

                            <div className="form-field">
                                <label className="form-label">Batch Number</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter batch number"
                                    value={batchNumber}
                                    onChange={e => setBatchNumber(e.target.value)}
                                />
                            </div>

                            <div className="admin-actions">
                                <button
                                    className="admin-save-btn"
                                    onClick={handleAddOrder}
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Adding...' : 'Add to Queue'}
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Machine Order Queues */}
                <section className="admin-queues-section">
                    <h2 className="section-heading">
                        <span className="section-icon">#</span>
                        Order Queues by Machine
                    </h2>

                    {machines.length === 0 ? (
                        <div className="info-card">
                            <span className="info-icon">!</span>
                            <p>No machines configured. Add machines in Machine Settings first.</p>
                        </div>
                    ) : (
                        <div className="machine-queues-grid">
                            {machines.map(machine => {
                                const orders = machineOrders[machine.id] || [];
                                return (
                                    <div key={machine.id} className="machine-queue-card">
                                        <div className="machine-queue-header">
                                            <h3>{machine.name}</h3>
                                            <span className="queue-count">{orders.length} orders</span>
                                            {orders.length > 0 && (
                                                <button
                                                    className="clear-queue-btn"
                                                    onClick={() => handleClearMachineOrders(machine.id)}
                                                    title="Clear all orders"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>

                                        {orders.length === 0 ? (
                                            <div className="empty-queue">
                                                <p>No orders in queue</p>
                                            </div>
                                        ) : (
                                            <div className="queue-list">
                                                {orders.map((order, index) => (
                                                    <motion.div
                                                        key={order.id}
                                                        className="queue-item"
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                    >
                                                        <div className="queue-item-priority">
                                                            {index + 1}
                                                        </div>
                                                        <div className="queue-item-details">
                                                            <div className="queue-order-number">{order.order_number}</div>
                                                            <div className="queue-product">{order.product}</div>
                                                            <div className="queue-batch">Batch: {order.batch_number}</div>
                                                        </div>
                                                        <div className="queue-item-actions">
                                                            <button
                                                                className="queue-move-btn"
                                                                onClick={() => handleMoveOrder(machine.id, order.id!, 'up')}
                                                                disabled={index === 0}
                                                                title="Move up"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                                    <path d="M18 15l-6-6-6 6" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className="queue-move-btn"
                                                                onClick={() => handleMoveOrder(machine.id, order.id!, 'down')}
                                                                disabled={index === orders.length - 1}
                                                                title="Move down"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                                    <path d="M6 9l6 6 6-6" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className="queue-remove-btn"
                                                                onClick={() => handleRemoveOrder(order.id!)}
                                                                title="Remove order"
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                                                    <path d="M18 6L6 18M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="admin-info-section">
                    <div className="info-card">
                        <span className="info-icon">i</span>
                        <p>
                            <strong>Bulk Import:</strong> Paste from Excel or CSV. Each line: Machine, Order, Product, Batch.
                            Top to bottom = priority order (1st line = highest priority).
                        </p>
                    </div>
                </section>

                {/* Facility Settings Section */}
                <section className="admin-settings-section">
                    <div className="settings-header" onClick={() => setShowSettingsPanel(!showSettingsPanel)}>
                        <h2 className="section-heading">
                            <span className="section-icon">&#9881;</span>
                            Facility Settings
                        </h2>
                        <span className={`expand-icon ${showSettingsPanel ? 'expanded' : ''}`}>
                            {showSettingsPanel ? '−' : '+'}
                        </span>
                    </div>

                    <AnimatePresence>
                        {showSettingsPanel && (
                            <motion.div
                                className="settings-panel"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="settings-grid">
                                    {/* Shift Configuration */}
                                    <div className="settings-group">
                                        <h3>Shift Times</h3>
                                        <div className="settings-row">
                                            <label>Day Shift Start</label>
                                            <select
                                                value={facilitySettings.dayShiftStart}
                                                onChange={(e) => setFacilitySettings(prev => ({
                                                    ...prev,
                                                    dayShiftStart: parseInt(e.target.value)
                                                }))}
                                            >
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="settings-row">
                                            <label>Day Shift End</label>
                                            <select
                                                value={facilitySettings.dayShiftEnd}
                                                onChange={(e) => setFacilitySettings(prev => ({
                                                    ...prev,
                                                    dayShiftEnd: parseInt(e.target.value)
                                                }))}
                                            >
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="settings-preview">
                                            Current: Day {formatShiftTimes().day}, Night {formatShiftTimes().night}
                                        </div>
                                    </div>

                                    {/* Timezone */}
                                    <div className="settings-group">
                                        <h3>Timezone</h3>
                                        <div className="settings-row">
                                            <label>UTC Offset</label>
                                            <select
                                                value={facilitySettings.timezoneOffset}
                                                onChange={(e) => setFacilitySettings(prev => ({
                                                    ...prev,
                                                    timezoneOffset: parseInt(e.target.value)
                                                }))}
                                            >
                                                {Array.from({ length: 25 }, (_, i) => i - 12).map(offset => (
                                                    <option key={offset} value={offset}>
                                                        UTC{offset >= 0 ? '+' : ''}{offset}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Submission Window */}
                                    <div className="settings-group">
                                        <h3>Submission Window</h3>
                                        <div className="settings-row">
                                            <label>Window Size (minutes)</label>
                                            <input
                                                type="number"
                                                min="5"
                                                max="60"
                                                value={facilitySettings.submissionWindowMinutes}
                                                onChange={(e) => setFacilitySettings(prev => ({
                                                    ...prev,
                                                    submissionWindowMinutes: parseInt(e.target.value) || 15
                                                }))}
                                            />
                                        </div>
                                        <div className="settings-hint">
                                            Time before/after shift end when submissions are allowed
                                        </div>
                                    </div>

                                    {/* Session Locking */}
                                    <div className="settings-group">
                                        <h3>Session Locking</h3>
                                        <div className="settings-row checkbox-row">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={facilitySettings.sessionLockingEnabled}
                                                    onChange={(e) => setFacilitySettings(prev => ({
                                                        ...prev,
                                                        sessionLockingEnabled: e.target.checked
                                                    }))}
                                                />
                                                Enable session locking
                                            </label>
                                        </div>
                                        <div className="settings-hint">
                                            Prevents multiple users from editing the same shift
                                        </div>
                                    </div>

                                    {/* Facility Info */}
                                    <div className="settings-group">
                                        <h3>Facility Info</h3>
                                        <div className="settings-row">
                                            <label>Name</label>
                                            <input
                                                type="text"
                                                value={facilitySettings.facilityName}
                                                onChange={(e) => setFacilitySettings(prev => ({
                                                    ...prev,
                                                    facilityName: e.target.value
                                                }))}
                                            />
                                        </div>
                                        <div className="settings-row">
                                            <label>Location</label>
                                            <input
                                                type="text"
                                                value={facilitySettings.facilityLocation}
                                                onChange={(e) => setFacilitySettings(prev => ({
                                                    ...prev,
                                                    facilityLocation: e.target.value
                                                }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-actions">
                                    <button className="admin-save-btn" onClick={handleSaveSettings}>
                                        Save Settings
                                    </button>
                                    <button className="admin-clear-btn" onClick={handleResetSettings}>
                                        Reset to Defaults
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </main>

            {/* Settings Panel Styles */}
            <style>{`
                .admin-settings-section {
                    margin-top: 2rem;
                    background: #1a1a2e;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                }

                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.5rem;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .settings-header:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .settings-header .section-heading {
                    margin: 0;
                    font-size: 1.1rem;
                }

                .expand-icon {
                    font-size: 1.5rem;
                    color: #20C997;
                    transition: transform 0.2s;
                }

                .expand-icon.expanded {
                    transform: rotate(180deg);
                }

                .settings-panel {
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 1.5rem;
                    overflow: hidden;
                }

                .settings-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1.5rem;
                }

                .settings-group {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 1rem;
                    border-radius: 8px;
                }

                .settings-group h3 {
                    margin: 0 0 1rem 0;
                    font-size: 0.9rem;
                    color: #20C997;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .settings-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .settings-row label {
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 0.9rem;
                }

                .settings-row select,
                .settings-row input[type="number"],
                .settings-row input[type="text"] {
                    background: #16213e;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    padding: 0.5rem;
                    color: #fff;
                    min-width: 100px;
                }

                .settings-row select:focus,
                .settings-row input:focus {
                    outline: none;
                    border-color: #20C997;
                }

                .checkbox-row label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                }

                .checkbox-row input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    accent-color: #20C997;
                }

                .settings-preview {
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.5);
                    margin-top: 0.5rem;
                }

                .settings-hint {
                    font-size: 0.75rem;
                    color: rgba(255, 255, 255, 0.4);
                    margin-top: 0.25rem;
                }

                .settings-actions {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }
            `}</style>
        </motion.div>
    );
};

export default AdminConsole;
