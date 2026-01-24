import React from 'react';
import './FormField.css';

interface FormFieldProps {
  label: string;
  id: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'search';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  hint,
  icon,
  className = '',
}) => {
  return (
    <div className={`mc-field ${error ? 'mc-field--error' : ''} ${disabled ? 'mc-field--disabled' : ''} ${className}`}>
      <label htmlFor={id} className="mc-field__label">
        {label}
        {required && <span className="mc-field__required">*</span>}
      </label>
      <div className="mc-field__input-wrapper">
        {icon && <span className="mc-field__icon">{icon}</span>}
        <input
          type={type}
          id={id}
          className={`mc-field__input ${icon ? 'mc-field__input--with-icon' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
        />
        <div className="mc-field__glow" />
      </div>
      {error && <span className="mc-field__error">{error}</span>}
      {hint && !error && <span className="mc-field__hint">{hint}</span>}
    </div>
  );
};

interface SelectFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  required = false,
  error,
  hint,
  className = '',
}) => {
  return (
    <div className={`mc-field ${error ? 'mc-field--error' : ''} ${disabled ? 'mc-field--disabled' : ''} ${className}`}>
      <label htmlFor={id} className="mc-field__label">
        {label}
        {required && <span className="mc-field__required">*</span>}
      </label>
      <div className="mc-field__input-wrapper">
        <select
          id={id}
          className="mc-field__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="mc-field__select-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        <div className="mc-field__glow" />
      </div>
      {error && <span className="mc-field__error">{error}</span>}
      {hint && !error && <span className="mc-field__hint">{hint}</span>}
    </div>
  );
};

interface TextAreaFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  rows?: number;
  className?: string;
}

export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  label,
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  hint,
  rows = 4,
  className = '',
}) => {
  return (
    <div className={`mc-field ${error ? 'mc-field--error' : ''} ${disabled ? 'mc-field--disabled' : ''} ${className}`}>
      <label htmlFor={id} className="mc-field__label">
        {label}
        {required && <span className="mc-field__required">*</span>}
      </label>
      <div className="mc-field__input-wrapper">
        <textarea
          id={id}
          className="mc-field__textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          rows={rows}
        />
        <div className="mc-field__glow" />
      </div>
      {error && <span className="mc-field__error">{error}</span>}
      {hint && !error && <span className="mc-field__hint">{hint}</span>}
    </div>
  );
};
