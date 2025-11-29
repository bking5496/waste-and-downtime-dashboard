import React from 'react';
import { WasteEntry } from '../types';

interface WasteSectionProps {
  waste: number | '';
  setWaste: (value: number | '') => void;
  wasteType: string;
  setWasteType: (value: string) => void;
  handleWasteSubmit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  wasteEntries: WasteEntry[];
}

const WasteSection: React.FC<WasteSectionProps> = ({
  waste,
  setWaste,
  wasteType,
  setWasteType,
  handleWasteSubmit,
  wasteEntries,
}) => {
  return (
    <div className="col-md-6">
      <h3>Waste</h3>
      <div className="card mb-3">
        <div className="card-body">
          <div className="mb-3">
            <label htmlFor="waste" className="form-label">Waste (kg)</label>
            <input type="number" className="form-control" id="waste" value={waste} onChange={e => setWaste(Number(e.target.value))} />
          </div>
          <div className="mb-3">
            <label htmlFor="wasteType" className="form-label">Waste Type</label>
            <select className="form-select" id="wasteType" value={wasteType} onChange={e => setWasteType(e.target.value)}>
              <option value="">Select Waste Type</option>
              <option value="Powder">Powder</option>
              <option value="Corro">Corro</option>
              <option value="Reel">Reel</option>
              <option value="Label">Label</option>
              <option value="Display">Display</option>
              <option value="Tray">Tray</option>
            </select>
          </div>
          <div className="d-grid">
            <button className="btn btn-secondary" onClick={handleWasteSubmit}>Submit Waste</button>
          </div>
        </div>
      </div>

      <h4>Submitted Waste</h4>
      <table className="table table-striped">
        <thead>
          <tr>
            <th>Waste (kg)</th>
            <th>Waste Type</th>
          </tr>
        </thead>
        <tbody>
          {wasteEntries.map((entry, index) => (
            <tr key={index}>
              <td>{entry.waste}</td>
              <td>{entry.wasteType}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WasteSection;
