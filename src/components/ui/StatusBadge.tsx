import React from 'react';
import './StatusBadge.css';

type StatusType = 'running' | 'idle' | 'maintenance' | 'offline' | 'warning' | 'error';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusLabels: Record<StatusType, string> = {
  running: 'Running',
  idle: 'Idle',
  maintenance: 'Maintenance',
  offline: 'Offline',
  warning: 'Warning',
  error: 'Error',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  pulse = true,
  size = 'md',
  className = '',
}) => {
  return (
    <div className={`mc-status mc-status--${status} mc-status--${size} ${className}`}>
      <span className={`mc-status__dot ${pulse ? 'mc-status__dot--pulse' : ''}`} />
      <span className="mc-status__label">{label || statusLabels[status]}</span>
    </div>
  );
};

// Status indicator dot only (no label)
interface StatusDotProps {
  status: StatusType;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  pulse = true,
  size = 'md',
  className = '',
}) => {
  return (
    <span
      className={`mc-status-dot mc-status-dot--${status} mc-status-dot--${size} ${pulse ? 'mc-status-dot--pulse' : ''} ${className}`}
      title={statusLabels[status]}
    />
  );
};
