import React, { useState } from 'react';
import { DowntimeEntry, PLANNED_DOWNTIME_REASONS, UNPLANNED_DOWNTIME_REASONS } from '../types';

interface DowntimeSectionProps {
  downtime: number | '';
  setDowntime: (value: number | '') => void;
  downtimeReason: string;
  setDowntimeReason: (value: string) => void;
  handleDowntimeSubmit: (notes?: string) => void;
  downtimeEntries: DowntimeEntry[];
  onDeleteEntry?: (id: string) => void;
}

const DowntimeSection: React.FC<DowntimeSectionProps> = ({
  downtime,
  setDowntime,
  downtimeReason,
  setDowntimeReason,
  handleDowntimeSubmit,
  downtimeEntries,
  onDeleteEntry,
}) => {
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [pendingNotes, setPendingNotes] = useState('');
  
  const totalDowntime = downtimeEntries.reduce((sum, entry) => sum + entry.downtime, 0);
  const hours = Math.floor(totalDowntime / 60);
  const minutes = totalDowntime % 60;

  const handleAddClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (downtime && downtimeReason) {
      setShowNotesModal(true);
      setPendingNotes('');
    }
  };

  const handleConfirmWithNotes = () => {
    handleDowntimeSubmit(pendingNotes || undefined);
    setShowNotesModal(false);
    setPendingNotes('');
  };

  const handleSkipNotes = () => {
    handleDowntimeSubmit(undefined);
    setShowNotesModal(false);
    setPendingNotes('');
  };

  return (
    <div className="downtime-section-content">
      <div className="downtime-input-group">
        <input 
          type="number" 
          className="form-control" 
          id="downtime" 
          value={downtime} 
          onChange={e => setDowntime(Number(e.target.value))} 
          placeholder="min"
          inputMode="numeric"
        />
        <select className="form-select" id="downtimeReason" value={downtimeReason} onChange={e => setDowntimeReason(e.target.value)}>
          <option value="">Reason</option>
          <optgroup label="⏱ Planned">
            {PLANNED_DOWNTIME_REASONS.map(reason => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </optgroup>
          <optgroup label="⚠️ Unplanned">
            {UNPLANNED_DOWNTIME_REASONS.map(reason => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </optgroup>
        </select>
        <button className="btn btn-warning" onClick={handleAddClick}>+</button>
      </div>

      {downtimeEntries.length > 0 && (
        <>
          <div className="entries-header">
            <span className="entries-count">{downtimeEntries.length} entries</span>
            <span className="entries-total total-downtime">
              {hours > 0 ? `${hours}h ` : ''}{minutes}m
            </span>
          </div>
          <div className="entries-list">
            {downtimeEntries.map((entry, index) => (
              <div key={entry.id || index} className="entry-row has-notes">
                <span className="entry-value">{entry.downtime} min</span>
                <span className="entry-type">{entry.downtimeReason}</span>
                {entry.notes && <span className="entry-notes" title={entry.notes}>📝</span>}
                {onDeleteEntry && entry.id && (
                  <button 
                    className="entry-delete"
                    onClick={() => onDeleteEntry(entry.id!)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Notes Popup Modal */}
      {showNotesModal && (
        <div className="notes-modal-overlay" onClick={handleSkipNotes}>
          <div className="notes-modal" onClick={e => e.stopPropagation()}>
            <div className="notes-modal-header">
              <h4>📝 Add Notes</h4>
              <span className="notes-modal-subtitle">
                {downtime} min - {downtimeReason}
              </span>
            </div>
            <textarea
              className="form-control notes-textarea"
              value={pendingNotes}
              onChange={e => setPendingNotes(e.target.value)}
              placeholder="Enter any additional details about this downtime..."
              rows={3}
              autoFocus
            />
            <div className="notes-modal-actions">
              <button className="btn btn-outline-secondary" onClick={handleSkipNotes}>
                Skip
              </button>
              <button className="btn btn-warning" onClick={handleConfirmWithNotes}>
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DowntimeSection;
