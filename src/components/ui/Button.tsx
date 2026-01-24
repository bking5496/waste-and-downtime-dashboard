import React from 'react';
import './Button.css';

export type ButtonVariant =
  | 'primary'    // Cyan - main actions
  | 'success'    // Green - positive/running
  | 'warning'    // Amber - caution/pause
  | 'danger'     // Red - destructive/stop
  | 'ghost'      // Transparent with border
  | 'secondary'; // Muted gray

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`mc-btn mc-btn--${variant} mc-btn--${size} ${fullWidth ? 'mc-btn--full' : ''} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <span className="mc-btn__loader">
          <span className="mc-btn__loader-dot"></span>
          <span className="mc-btn__loader-dot"></span>
          <span className="mc-btn__loader-dot"></span>
        </span>
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span className="mc-btn__icon">{icon}</span>
      )}
      <span className="mc-btn__text">{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <span className="mc-btn__icon">{icon}</span>
      )}
    </button>
  );
};
