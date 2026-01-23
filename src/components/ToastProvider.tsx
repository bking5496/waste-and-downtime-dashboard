/**
 * Global Toast Notification Provider
 * Displays toast notifications from the error monitoring service
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToToasts, ToastNotification } from '../lib/errorMonitoring';

interface ToastWithTimer extends ToastNotification {
  timerId?: NodeJS.Timeout;
}

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastWithTimer[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      if (toast?.timerId) {
        clearTimeout(toast.timerId);
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const addToast = useCallback((toast: ToastNotification) => {
    // Remove existing toast with same ID if any
    setToasts(prev => prev.filter(t => t.id !== toast.id));

    // Set up auto-dismiss timer if duration is specified
    let timerId: NodeJS.Timeout | undefined;
    if (toast.duration && toast.duration > 0) {
      timerId = setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);
    }

    setToasts(prev => [...prev, { ...toast, timerId }]);
  }, [removeToast]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts(addToast);
    return () => {
      unsubscribe();
      // Clear all timers on unmount
      toasts.forEach(t => {
        if (t.timerId) clearTimeout(t.timerId);
      });
    };
  }, [addToast, toasts]);

  const getIcon = (type: ToastNotification['type']) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '!';
      case 'warning': return '⚠';
      case 'info': return 'i';
      default: return '';
    }
  };

  return (
    <>
      {children}

      {/* Toast Container */}
      <div className="global-toast-container">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`global-toast ${toast.type}`}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              layout
            >
              <span className="toast-icon">{getIcon(toast.type)}</span>
              <span className="toast-message">{toast.message}</span>
              {toast.action && (
                <button
                  className="toast-action"
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button
                className="toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Toast Styles */}
      <style>{`
        .global-toast-container {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-width: 400px;
          pointer-events: none;
        }

        .global-toast {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border-radius: 8px;
          background: #1a1a2e;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          font-size: 0.9rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          pointer-events: auto;
        }

        .global-toast.success {
          border-left: 4px solid #20C997;
          background: linear-gradient(90deg, rgba(32, 201, 151, 0.1), #1a1a2e);
        }

        .global-toast.error {
          border-left: 4px solid #dc3545;
          background: linear-gradient(90deg, rgba(220, 53, 69, 0.1), #1a1a2e);
        }

        .global-toast.warning {
          border-left: 4px solid #ffc107;
          background: linear-gradient(90deg, rgba(255, 193, 7, 0.1), #1a1a2e);
        }

        .global-toast.info {
          border-left: 4px solid #17a2b8;
          background: linear-gradient(90deg, rgba(23, 162, 184, 0.1), #1a1a2e);
        }

        .global-toast .toast-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          font-size: 0.8rem;
          font-weight: bold;
          flex-shrink: 0;
        }

        .global-toast.success .toast-icon {
          background: rgba(32, 201, 151, 0.2);
          color: #20C997;
        }

        .global-toast.error .toast-icon {
          background: rgba(220, 53, 69, 0.2);
          color: #dc3545;
        }

        .global-toast.warning .toast-icon {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
        }

        .global-toast.info .toast-icon {
          background: rgba(23, 162, 184, 0.2);
          color: #17a2b8;
        }

        .global-toast .toast-message {
          flex: 1;
          line-height: 1.4;
        }

        .global-toast .toast-action {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          color: #fff;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .global-toast .toast-action:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .global-toast .toast-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0 0.25rem;
          line-height: 1;
          transition: color 0.2s;
        }

        .global-toast .toast-close:hover {
          color: #fff;
        }

        @media (max-width: 480px) {
          .global-toast-container {
            left: 1rem;
            right: 1rem;
            max-width: none;
          }
        }
      `}</style>
    </>
  );
};

export default ToastProvider;
