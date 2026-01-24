import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Machine } from '../types';
import { getMachinesData, updateMachine, addMachine, deleteMachine } from '../lib/storage';

interface MachineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMachinesUpdated: () => void;
}

const MachineSettingsModal: React.FC<MachineSettingsModalProps> = ({ 
  isOpen, 
  onClose,
  onMachinesUpdated 
}) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [, setIsAddingNew] = useState(false); // Used in setIsAddingNew(false) after add
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineStatus, setNewMachineStatus] = useState<Machine['status']>('idle');
  const [newMachineSubCount, setNewMachineSubCount] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'machines' | 'add'>('machines');
  const [, setIsSaving] = useState(false); // Used for loading state

  useEffect(() => {
    if (isOpen) {
      loadMachines();
      setActiveTab('machines');
    }
  }, [isOpen]);

  const loadMachines = () => {
    const data = getMachinesData();
    setMachines(data);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateMachine = async (machine: Machine) => {
    setIsSaving(true);
    try {
      await updateMachine(machine.id, machine);
      loadMachines();
      setEditingMachine(null);
      onMachinesUpdated();
      showToast(`${machine.name} updated successfully`, 'success');
    } catch (error) {
      showToast('Failed to update machine', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMachine = async () => {
    if (!newMachineName.trim()) {
      showToast('Please enter a machine name', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const newMachine: Machine = {
        id: `machine-${uuidv4().slice(0, 8)}`,
        name: newMachineName.trim(),
        status: newMachineStatus,
        subMachineCount: newMachineSubCount > 0 ? newMachineSubCount : undefined,
      };

      await addMachine(newMachine);
      loadMachines();
      setIsAddingNew(false);
      setNewMachineName('');
      setNewMachineStatus('idle');
      setNewMachineSubCount(0);
      setActiveTab('machines');
      onMachinesUpdated();
      showToast(`${newMachine.name} added successfully`, 'success');
    } catch (error) {
      showToast('Failed to add machine', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMachine = async (machine: Machine) => {
    if (window.confirm(`Are you sure you want to delete "${machine.name}"? This cannot be undone.`)) {
      setIsSaving(true);
      try {
        await deleteMachine(machine.id);
        loadMachines();
        onMachinesUpdated();
        showToast(`${machine.name} deleted`, 'success');
      } catch (error) {
        showToast('Failed to delete machine', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleStatusChange = async (machineId: string, newStatus: Machine['status']) => {
    const machine = machines.find(m => m.id === machineId);
    if (machine) {
      try {
        await updateMachine(machineId, { status: newStatus });
        loadMachines();
        onMachinesUpdated();
      } catch (error) {
        showToast('Failed to update status', 'error');
      }
    }
  };

  const getStatusColor = (status: Machine['status']) => {
    switch (status) {
      case 'running': return '#00ff88';
      case 'idle': return '#00f5ff';
      case 'maintenance': return '#ff4757';
    }
  };

  const getStatusIcon = (status: Machine['status']) => {
    switch (status) {
      case 'running': return '▶';
      case 'idle': return '◼';
      case 'maintenance': return '⚠';
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="settings-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="settings-modal-container"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="settings-modal-header">
            <div className="settings-header-content">
              <div className="settings-icon-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
              </div>
              <div className="settings-title-group">
                <h2>Machine Settings</h2>
                <span className="settings-subtitle">{machines.length} machines configured</span>
              </div>
            </div>
            <button className="settings-close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="settings-tabs">
            <button 
              className={`settings-tab ${activeTab === 'machines' ? 'active' : ''}`}
              onClick={() => setActiveTab('machines')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
              <span>Machines</span>
            </button>
            <button 
              className={`settings-tab ${activeTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveTab('add')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
              <span>Add New</span>
            </button>
          </div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div 
                className={`settings-toast-v2 ${toast.type}`}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <span className="toast-icon">
                  {toast.type === 'success' ? '✓' : '✕'}
                </span>
                {toast.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content Area */}
          <div className="settings-content">
            {activeTab === 'machines' ? (
              /* Machine List */
              <div className="machine-list-v2">
                {machines.length === 0 ? (
                  <div className="empty-machines">
                    <div className="empty-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <path d="M8 21h8M12 17v4"/>
                      </svg>
                    </div>
                    <p>No machines configured</p>
                    <button className="empty-add-btn" onClick={() => setActiveTab('add')}>
                      Add your first machine
                    </button>
                  </div>
                ) : (
                  machines.map((machine, index) => (
                    <motion.div
                      key={machine.id}
                      className={`machine-card ${editingMachine?.id === machine.id ? 'editing' : ''}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      {editingMachine?.id === machine.id ? (
                        /* Edit Mode */
                        <div className="machine-edit-mode">
                          <div className="edit-section">
                            <label className="edit-label">Machine Name</label>
                            <input
                              type="text"
                              className="edit-input"
                              value={editingMachine.name}
                              onChange={e => setEditingMachine({ ...editingMachine, name: e.target.value })}
                              autoFocus
                            />
                          </div>
                          
                          <div className="edit-row">
                            <div className="edit-section">
                              <label className="edit-label">Status</label>
                              <div className="status-select-group">
                                {(['running', 'idle', 'maintenance'] as const).map(status => (
                                  <button
                                    key={status}
                                    className={`status-select-btn ${status} ${editingMachine.status === status ? 'selected' : ''}`}
                                    onClick={() => setEditingMachine({ ...editingMachine, status })}
                                  >
                                    <span className="status-select-icon">{getStatusIcon(status)}</span>
                                    <span className="status-select-text">
                                      {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="edit-section">
                            <label className="edit-label">Sub-machines (for machine groups)</label>
                            <select
                              className="edit-select"
                              value={editingMachine.subMachineCount || 0}
                              onChange={e => setEditingMachine({ 
                                ...editingMachine, 
                                subMachineCount: parseInt(e.target.value) || undefined 
                              })}
                            >
                              <option value="0">None - Single machine</option>
                              <option value="2">2 sub-machines</option>
                              <option value="3">3 sub-machines</option>
                              <option value="4">4 sub-machines</option>
                              <option value="5">5 sub-machines</option>
                              <option value="6">6 sub-machines</option>
                              <option value="8">8 sub-machines</option>
                              <option value="10">10 sub-machines</option>
                            </select>
                          </div>

                          <div className="edit-actions">
                            <button className="edit-save-btn" onClick={() => handleUpdateMachine(editingMachine)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <path d="M20 6L9 17l-5-5"/>
                              </svg>
                              Save Changes
                            </button>
                            <button className="edit-cancel-btn" onClick={() => setEditingMachine(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <>
                          <div className="machine-card-header">
                            <div className="machine-identity">
                              <div 
                                className="machine-status-dot"
                                style={{ backgroundColor: getStatusColor(machine.status) }}
                              >
                                <span className="status-pulse"></span>
                              </div>
                              <div className="machine-name-info">
                                <span className="machine-card-name">{machine.name}</span>
                                {machine.subMachineCount && machine.subMachineCount > 0 && (
                                  <span className="machine-group-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                                      <path d="M8 21h8M12 17v4"/>
                                    </svg>
                                    {machine.subMachineCount} machines
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="machine-card-actions">
                              <button 
                                className="card-action-btn edit"
                                onClick={() => setEditingMachine(machine)}
                                title="Edit machine"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button 
                                className="card-action-btn delete"
                                onClick={() => handleDeleteMachine(machine)}
                                title="Delete machine"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          <div className="machine-quick-status">
                            <span className="quick-status-label">Quick Status:</span>
                            <div className="quick-status-buttons">
                              <button 
                                className={`quick-btn running ${machine.status === 'running' ? 'active' : ''}`}
                                onClick={() => handleStatusChange(machine.id, 'running')}
                              >
                                ▶ Run
                              </button>
                              <button 
                                className={`quick-btn idle ${machine.status === 'idle' ? 'active' : ''}`}
                                onClick={() => handleStatusChange(machine.id, 'idle')}
                              >
                                ◼ Idle
                              </button>
                              <button 
                                className={`quick-btn maintenance ${machine.status === 'maintenance' ? 'active' : ''}`}
                                onClick={() => handleStatusChange(machine.id, 'maintenance')}
                              >
                                ⚠ Maint
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            ) : (
              /* Add New Machine Form */
              <div className="add-machine-form-v2">
                <div className="form-section">
                  <label className="form-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Machine Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Universal 2, CNC Mill 1..."
                    value={newMachineName}
                    onChange={e => setNewMachineName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-section">
                  <label className="form-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    Initial Status
                  </label>
                  <div className="status-picker">
                    {(['running', 'idle', 'maintenance'] as const).map(status => (
                      <button
                        key={status}
                        className={`status-picker-btn ${status} ${newMachineStatus === status ? 'selected' : ''}`}
                        onClick={() => setNewMachineStatus(status)}
                      >
                        <span className="picker-icon">{getStatusIcon(status)}</span>
                        <span className="picker-label">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-section">
                  <label className="form-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                      <path d="M8 21h8M12 17v4"/>
                    </svg>
                    Sub-machines (Optional)
                  </label>
                  <p className="form-hint">If this is a group name for multiple machines, select how many.</p>
                  <select
                    className="form-select"
                    value={newMachineSubCount}
                    onChange={e => setNewMachineSubCount(parseInt(e.target.value))}
                  >
                    <option value="0">None - This is a single machine</option>
                    <option value="2">2 sub-machines</option>
                    <option value="3">3 sub-machines</option>
                    <option value="4">4 sub-machines</option>
                    <option value="5">5 sub-machines</option>
                    <option value="6">6 sub-machines</option>
                    <option value="8">8 sub-machines</option>
                    <option value="10">10 sub-machines</option>
                  </select>
                </div>

                <div className="form-actions">
                  <button className="form-submit-btn" onClick={handleAddMachine}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8v8M8 12h8"/>
                    </svg>
                    Add Machine
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="settings-modal-footer">
            <button className="settings-done-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MachineSettingsModal;
