import React from 'react';
import { WasteEntry, WASTE_TYPES } from '../types';

interface WasteSectionProps {
  waste: number | '';
  setWaste: (value: number | '') => void;
  wasteType: string;
  setWasteType: (value: string) => void;
  handleWasteSubmit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  wasteEntries: WasteEntry[];
  onDeleteEntry?: (id: string) => void;
}

const WasteSection: React.FC<WasteSectionProps> = ({
  waste,
  setWaste,
  wasteType,
  setWasteType,
  handleWasteSubmit,
  wasteEntries,
  onDeleteEntry,
}) => {
  const totalWaste = wasteEntries.reduce((sum, entry) => sum + entry.waste, 0);

  return (
    <div className="waste-section-content">
      <div className="waste-input-group">
        <input 
          type="number" 
          className="form-control" 
          id="waste" 
          value={waste} 
          onChange={e => setWaste(Number(e.target.value))} 
          placeholder="kg"
          inputMode="decimal"
        />
        <select className="form-select" id="wasteType" value={wasteType} onChange={e => setWasteType(e.target.value)}>
          <option value="">Type</option>
          {WASTE_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <button className="btn btn-success" onClick={handleWasteSubmit}>+</button>
      </div>

      {wasteEntries.length > 0 && (
        <>
          <div className="entries-header">
            <span className="entries-count">{wasteEntries.length} entries</span>
            <span className="entries-total total-waste">{totalWaste.toFixed(1)} kg</span>
          </div>
          <div className="entries-list">
            {wasteEntries.map((entry, index) => (
              <div key={entry.id || index} className="entry-row">
                <span className="entry-value">{entry.waste} kg</span>
                <span className="entry-type">{entry.wasteType}</span>
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
    </div>
  );
};

export default WasteSection;
