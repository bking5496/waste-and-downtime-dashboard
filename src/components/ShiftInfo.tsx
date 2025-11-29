import React from 'react';
import { format } from 'date-fns';

interface ShiftInfoProps {
  dateTime: Date;
  shift: string;
}

const ShiftInfo: React.FC<ShiftInfoProps> = ({ dateTime, shift }) => {
  return (
    <div className="shift-info-card">
      <div className="shift-info-header">
        <span className="info-label">Current Date</span>
        <span className="info-value date">{format(dateTime, 'EEEE,')}</span>
        <span className="info-value">{format(dateTime, 'MMM d, yyyy')}</span>
      </div>
      <div className="shift-info-time">
        <span className="info-label">Current Time</span>
        <span className="time-display">{format(dateTime, 'HH:mm:ss')}</span>
      </div>
    </div>
  );
};

export default ShiftInfo;
