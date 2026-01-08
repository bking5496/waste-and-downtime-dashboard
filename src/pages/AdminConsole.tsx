import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Storage key for order details
const ORDER_DETAILS_KEY = 'admin_order_details';

interface OrderDetails {
    id?: number;
    order_number: string;
    product: string;
    batch_number: string;
    is_active: boolean;
    created_at?: string;
}

const AdminConsole: React.FC = () => {
    const navigate = useNavigate();

    const [orderNumber, setOrderNumber] = useState('');
    const [product, setProduct] = useState('');
    const [batchNumber, setBatchNumber] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [activeOrders, setActiveOrders] = useState<OrderDetails[]>([]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Load active order details
    useEffect(() => {
        const loadOrderDetails = async () => {
            setIsLoading(true);
            try {
                if (isSupabaseConfigured) {
                    // Try to fetch from database
                    const { data, error } = await supabase
                        .from('order_details')
                        .select('*')
                        .eq('is_active', true)
                        .order('created_at', { ascending: false });

                    if (!error && data) {
                        setActiveOrders(data);
                        if (data.length > 0) {
                            // Pre-fill with latest active order
                            setOrderNumber(data[0].order_number);
                            setProduct(data[0].product);
                            setBatchNumber(data[0].batch_number);
                        }
                    }
                } else {
                    // Fall back to localStorage
                    const saved = localStorage.getItem(ORDER_DETAILS_KEY);
                    if (saved) {
                        const details = JSON.parse(saved);
                        setOrderNumber(details.orderNumber || '');
                        setProduct(details.product || '');
                        setBatchNumber(details.batchNumber || '');
                    }
                }
            } catch (error) {
                console.error('Error loading order details:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadOrderDetails();
    }, []);

    const handleSave = async () => {
        if (!orderNumber.trim() || !product.trim() || !batchNumber.trim()) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        setIsSaving(true);
        try {
            if (isSupabaseConfigured) {
                // Deactivate any existing active orders
                await supabase
                    .from('order_details')
                    .update({ is_active: false })
                    .eq('is_active', true);

                // Insert new active order
                const { error } = await supabase
                    .from('order_details')
                    .insert([{
                        order_number: orderNumber.trim(),
                        product: product.trim(),
                        batch_number: batchNumber.trim(),
                        is_active: true
                    }]);

                if (error) throw error;
            }

            // Also save to localStorage for offline access
            localStorage.setItem(ORDER_DETAILS_KEY, JSON.stringify({
                orderNumber: orderNumber.trim(),
                product: product.trim(),
                batchNumber: batchNumber.trim()
            }));

            showToast('Order details saved successfully', 'success');
            setTimeout(() => navigate('/'), 1500);
        } catch (error) {
            console.error('Error saving order details:', error);
            showToast('Failed to save to database. Saved locally.', 'error');
            // Still save locally
            localStorage.setItem(ORDER_DETAILS_KEY, JSON.stringify({
                orderNumber: orderNumber.trim(),
                product: product.trim(),
                batchNumber: batchNumber.trim()
            }));
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearOrder = async () => {
        try {
            if (isSupabaseConfigured) {
                await supabase
                    .from('order_details')
                    .update({ is_active: false })
                    .eq('is_active', true);
            }
            localStorage.removeItem(ORDER_DETAILS_KEY);
            setOrderNumber('');
            setProduct('');
            setBatchNumber('');
            setActiveOrders([]);
            showToast('Order details cleared', 'success');
        } catch (error) {
            console.error('Error clearing order:', error);
            showToast('Failed to clear order', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="admin-console loading">
                <div className="spinner-v2"></div>
                <p>Loading order details...</p>
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
            <header className="admin-header">
                <button className="back-btn-v2" onClick={() => navigate('/')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
                <div className="admin-title">
                    <h1>Admin Console</h1>
                    <span className="admin-subtitle">Set Order Details for Production</span>
                </div>
            </header>

            <main className="admin-main">
                <section className="admin-form-section">
                    <h2 className="section-heading">
                        <span className="section-icon">📋</span>
                        Current Order Details
                    </h2>

                    <div className="admin-form">
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
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save & Apply'}
                            </button>

                            {(orderNumber || product || batchNumber) && (
                                <button
                                    className="admin-clear-btn"
                                    onClick={handleClearOrder}
                                >
                                    Clear Order
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {activeOrders.length > 0 && (
                    <section className="admin-history-section">
                        <h2 className="section-heading">
                            <span className="section-icon">📜</span>
                            Recent Orders
                        </h2>
                        <div className="order-history-list">
                            {activeOrders.slice(0, 5).map((order, index) => (
                                <div key={order.id || index} className={`order-history-item ${index === 0 ? 'active' : ''}`}>
                                    <div className="order-meta">
                                        <span className="order-number">{order.order_number}</span>
                                        {index === 0 && <span className="active-badge">Active</span>}
                                    </div>
                                    <div className="order-details">
                                        <span>{order.product}</span>
                                        <span className="separator">•</span>
                                        <span>Batch: {order.batch_number}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="admin-info-section">
                    <div className="info-card">
                        <span className="info-icon">ℹ️</span>
                        <p>
                            These order details will be shared across all machines during production.
                            Operators can then capture data for individual machines.
                        </p>
                    </div>
                </section>
            </main>
        </motion.div>
    );
};

export default AdminConsole;
