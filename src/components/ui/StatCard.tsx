import React from 'react';
import { motion } from 'framer-motion';
import './StatCard.css';

type StatVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  variant?: StatVariant;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  unit?: string;
  compact?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  icon,
  variant = 'default',
  trend,
  unit,
  compact = false,
  className = '',
}) => {
  return (
    <motion.div
      className={`mc-stat mc-stat--${variant} ${compact ? 'mc-stat--compact' : ''} ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mc-stat__indicator" />

      <div className="mc-stat__content">
        {icon && <div className="mc-stat__icon">{icon}</div>}

        <div className="mc-stat__data">
          <div className="mc-stat__value-row">
            <span className="mc-stat__value">{value}</span>
            {unit && <span className="mc-stat__unit">{unit}</span>}
          </div>
          <span className="mc-stat__label">{label}</span>
        </div>

        {trend && (
          <div className={`mc-stat__trend mc-stat__trend--${trend.direction}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {trend.direction === 'up' ? (
                <path d="M7 17l5-5 5 5M7 7l5 5 5-5" />
              ) : (
                <path d="M7 7l5 5 5-5M7 17l5-5 5-5" />
              )}
            </svg>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      {/* Glow effect */}
      <div className="mc-stat__glow" />
    </motion.div>
  );
};

// Quick stats row component
interface QuickStatsProps {
  stats: Array<{
    value: string | number;
    label: string;
    variant?: StatVariant;
  }>;
  className?: string;
}

export const QuickStats: React.FC<QuickStatsProps> = ({ stats, className = '' }) => {
  return (
    <div className={`mc-quick-stats ${className}`}>
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          value={stat.value}
          label={stat.label}
          variant={stat.variant}
          compact
        />
      ))}
    </div>
  );
};
