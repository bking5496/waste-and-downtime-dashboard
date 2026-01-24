import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  closeOnOverlay = true,
  showCloseButton = true,
}) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="mc-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeOnOverlay ? onClose : undefined}
        >
          {/* Scanline effect overlay */}
          <div className="mc-modal-scanlines" />

          <motion.div
            className={`mc-modal mc-modal--${size}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Corner accents */}
            <div className="mc-modal__corner mc-modal__corner--tl" />
            <div className="mc-modal__corner mc-modal__corner--tr" />
            <div className="mc-modal__corner mc-modal__corner--bl" />
            <div className="mc-modal__corner mc-modal__corner--br" />

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="mc-modal__header">
                <div className="mc-modal__header-content">
                  {title && (
                    <div className="mc-modal__title-group">
                      <h2 className="mc-modal__title">{title}</h2>
                      {subtitle && <p className="mc-modal__subtitle">{subtitle}</p>}
                    </div>
                  )}
                </div>
                {showCloseButton && (
                  <button className="mc-modal__close" onClick={onClose} aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="mc-modal__body">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="mc-modal__footer">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Convenience component for confirm dialogs
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  loading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="mc-modal__actions">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      }
    >
      <p className="mc-modal__message">{message}</p>
    </Modal>
  );
};
