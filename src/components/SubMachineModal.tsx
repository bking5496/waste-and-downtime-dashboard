import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Machine } from '../types';

interface SubMachineModalProps {
  isOpen: boolean;
  machine: Machine | null;
  onClose: () => void;
  onSelectSubMachine: (machine: Machine, subMachineNumber: number, isActive: boolean) => void;
  activeSubMachines?: Set<number>; // Optional set of active sub-machine numbers
}

const SubMachineModal: React.FC<SubMachineModalProps> = ({
  isOpen,
  machine,
  onClose,
  onSelectSubMachine,
  activeSubMachines = new Set(),
}) => {
  if (!isOpen || !machine || !machine.subMachineCount) return null;

  const subMachines = Array.from({ length: machine.subMachineCount }, (_, i) => i + 1);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="sub-machine-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="sub-machine-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sub-machine-header">
              <div className="sub-machine-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <div>
                  <h2>{machine.name}</h2>
                  <span className="sub-machine-subtitle">Select a machine</span>
                </div>
              </div>
              <button className="sub-machine-close" onClick={onClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="sub-machine-grid">
              {subMachines.map((num) => {
                const isActive = activeSubMachines.has(num);
                return (
                  <motion.button
                    key={num}
                    className={`sub-machine-btn ${isActive ? 'busy' : ''}`}
                    onClick={() => onSelectSubMachine(machine, num, isActive)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    title={isActive ? 'In Use - Click to continue' : 'Available'}
                  >
                    <div className="sub-machine-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                        <rect x="3" y="4" width="18" height="12" rx="2" />
                        <path d="M7 20h10" />
                        <path d="M9 16v4" />
                        <path d="M15 16v4" />
                        <circle cx="12" cy="10" r="2" />
                      </svg>
                    </div>
                    <div className="sub-machine-info">
                      <span className="sub-machine-name">Machine {num}</span>
                      <span className="sub-machine-label">{machine.name}</span>
                    </div>
                    <div className="sub-machine-arrow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="sub-machine-footer">
              <button className="sub-machine-cancel" onClick={onClose}>
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SubMachineModal;
