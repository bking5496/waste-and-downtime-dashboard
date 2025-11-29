import React from 'react';

interface ShiftInfoProps {
  dateTime: Date;
  shift: string;
}

const ShiftInfo: React.FC<ShiftInfoProps> = ({ dateTime, shift }) => {
  return (
    <div className="col-md-6">
      <div className="mb-3">
        <label className="form-label">Date</label>
        <input type="text" className="form-control" value={dateTime.toLocaleDateString()} readOnly />
      </div>
      <div className="mb-3">
        <label className="form-label">Shift</label>
        <input type="text" className="form-control" value={shift} readOnly />
      </div>
    </div>
  );
};

export default ShiftInfo;
