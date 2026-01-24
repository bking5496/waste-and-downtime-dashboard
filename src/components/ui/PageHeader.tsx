import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  showBack = true,
  backPath = '/',
  onBack,
  actions,
  badge,
  className = '',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(backPath);
    }
  };

  return (
    <header className={`mc-header ${className}`}>
      <div className="mc-header__left">
        {showBack && (
          <motion.button
            className="mc-header__back"
            onClick={handleBack}
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </motion.button>
        )}
        <div className="mc-header__title-group">
          <h1 className="mc-header__title">{title}</h1>
          {subtitle && <p className="mc-header__subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="mc-header__right">
        {badge && <div className="mc-header__badge">{badge}</div>}
        {actions && <div className="mc-header__actions">{actions}</div>}
      </div>

      {/* Decorative bottom border with glow */}
      <div className="mc-header__border" />
    </header>
  );
};

// Shift badge component for headers
interface ShiftBadgeProps {
  shift: 'Day' | 'Night';
}

export const ShiftBadge: React.FC<ShiftBadgeProps> = ({ shift }) => {
  return (
    <div className={`mc-shift-badge mc-shift-badge--${shift.toLowerCase()}`}>
      <span className="mc-shift-badge__icon">{shift === 'Day' ? '◐' : '◑'}</span>
      <span className="mc-shift-badge__text">{shift} Shift</span>
    </div>
  );
};
