import React from 'react';
import { DowntimeEntry } from '../types';

interface DowntimeSectionProps {
  downtime: number | '';
  setDowntime: (value: number | '') => void;
  downtimeReason: string;
  setDowntimeReason: (value: string) => void;
  handleDowntimeSubmit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  downtimeEntries: DowntimeEntry[];
}

const DowntimeSection: React.FC<DowntimeSectionProps> = ({
  downtime,
  setDowntime,
  downtimeReason,
  setDowntimeReason,
  handleDowntimeSubmit,
  downtimeEntries,
}) => {
  return (
    <div className="col-md-6">
      <h3>Downtime</h3>
      <div className="card mb-3">
        <div className="card-body">
          <div className="mb-3">
            <label htmlFor="downtime" className="form-label">Downtime (minutes)</label>
            <input type="number" className="form-control" id="downtime" value={downtime} onChange={e => setDowntime(Number(e.target.value))} />
          </div>
          <div className="mb-3">
            <label htmlFor="downtimeReason" className="form-label">Downtime Reason</label>
            <input type="text" className="form-control" id="downtimeReason" value={downtimeReason} onChange={e => setDowntimeReason(e.target.value)} />
          </div>
          <div className="d-grid">
            <button className="btn btn-secondary" onClick={handleDowntimeSubmit}>Submit Downtime</button>
          </div>
        </div>
      </div>

      <h4>Submitted Downtime</h4>
      <table className="table table-striped">
        <thead>
          <tr>
            <th>Downtime (minutes)</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {downtimeEntries.map((entry, index) => (
            <tr key={index}>
              <td>{entry.downtime}</td>
              <td>{entry.downtimeReason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DowntimeSection;
