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

const AdminConsole: React.FC = () => {
    const navigate = useNavigate();

    // Form state for adding new orders
    const [selectedMachine, setSelectedMachine] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [product, setProduct] = useState('');
    const [batchNumber, setBatchNumber] = useState('');

    // Data state
    const [machines, setMachines] = useState<Machine[]>([]);
    const [machineOrders, setMachineOrders] = useState<Record<string, MachineOrderQueueRecord[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
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
                {/* Add Order Form */}
                <section className="admin-form-section">
                    <h2 className="section-heading">
                        <span className="section-icon">+</span>
                        Add Order to Queue
                    </h2>

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
                            Orders are displayed in priority order (1 = highest priority).
                            Use the arrows to reorder, or remove orders as they are completed.
                        </p>
                    </div>
                </section>
            </main>
        </motion.div>
    );
};

export default AdminConsole;
