import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { FormField } from './FormField';
import { addMachineOrder } from '../../lib/supabase';
import './AddOrderModal.css';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: string;
  machineName: string;
  onOrderAdded: (order: { orderNumber: string; product: string; batchNumber: string }) => void;
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  isOpen,
  onClose,
  machineId,
  machineName,
  onOrderAdded,
}) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [product, setProduct] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    // Validation
    if (!orderNumber.trim()) {
      setError('Order number is required');
      return;
    }
    if (!product.trim()) {
      setError('Product is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Add to machine order queue
      await addMachineOrder(
        machineId,
        orderNumber.trim(),
        product.trim(),
        batchNumber.trim() || ''
      );

      // Notify parent and close
      onOrderAdded({
        orderNumber: orderNumber.trim(),
        product: product.trim(),
        batchNumber: batchNumber.trim(),
      });

      // Reset form
      setOrderNumber('');
      setProduct('');
      setBatchNumber('');
      onClose();
    } catch (err) {
      console.error('Failed to add order:', err);
      setError('Failed to add order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOrderNumber('');
    setProduct('');
    setBatchNumber('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Order"
      subtitle={machineName}
      size="md"
      footer={
        <div className="mc-add-order__actions">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleSubmit} loading={loading}>
            Add Order & Start
          </Button>
        </div>
      }
    >
      <div className="mc-add-order">
        <p className="mc-add-order__description">
          Create a new order for this machine. The order will be added to the queue and automatically selected.
        </p>

        {error && (
          <div className="mc-add-order__error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            {error}
          </div>
        )}

        <div className="mc-add-order__form">
          <FormField
            label="Order Number"
            id="order-number"
            value={orderNumber}
            onChange={setOrderNumber}
            placeholder="e.g., ORD-2024-001"
            required
            disabled={loading}
          />

          <FormField
            label="Product"
            id="product"
            value={product}
            onChange={setProduct}
            placeholder="e.g., Product A"
            required
            disabled={loading}
          />

          <FormField
            label="Batch Number"
            id="batch-number"
            value={batchNumber}
            onChange={setBatchNumber}
            placeholder="e.g., BATCH-001 (optional)"
            disabled={loading}
          />
        </div>

        <div className="mc-add-order__hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>Orders can also be added in bulk from the Admin Console.</span>
        </div>
      </div>
    </Modal>
  );
};
