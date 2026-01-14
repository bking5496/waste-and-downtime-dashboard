/**
 * Form validation utilities for production-ready validation
 */

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Field validation rule
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => string | null;
  message?: string;
}

// Validate a single field
export const validateField = (
  value: unknown,
  rules: ValidationRule
): string | null => {
  const strValue = typeof value === 'string' ? value : String(value ?? '');
  const numValue = typeof value === 'number' ? value : parseFloat(strValue);

  // Required check
  if (rules.required) {
    if (value === null || value === undefined || strValue.trim() === '') {
      return rules.message || 'This field is required';
    }
  }

  // Skip other validations if value is empty and not required
  if (!rules.required && strValue.trim() === '') {
    return null;
  }

  // Min length
  if (rules.minLength !== undefined && strValue.length < rules.minLength) {
    return rules.message || `Must be at least ${rules.minLength} characters`;
  }

  // Max length
  if (rules.maxLength !== undefined && strValue.length > rules.maxLength) {
    return rules.message || `Must be no more than ${rules.maxLength} characters`;
  }

  // Min value (numeric)
  if (rules.min !== undefined && !isNaN(numValue) && numValue < rules.min) {
    return rules.message || `Must be at least ${rules.min}`;
  }

  // Max value (numeric)
  if (rules.max !== undefined && !isNaN(numValue) && numValue > rules.max) {
    return rules.message || `Must be no more than ${rules.max}`;
  }

  // Pattern
  if (rules.pattern && !rules.pattern.test(strValue)) {
    return rules.message || 'Invalid format';
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(value);
  }

  return null;
};

// Validate multiple fields
export const validateForm = <T extends Record<string, unknown>>(
  data: T,
  schema: Record<keyof T, ValidationRule>
): ValidationResult => {
  const errors: Record<string, string> = {};

  for (const field of Object.keys(schema) as Array<keyof T>) {
    const error = validateField(data[field], schema[field]);
    if (error) {
      errors[field as string] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Pre-built validation schemas for common forms
export const shiftDetailsSchema = {
  operatorName: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Operator name is required',
  },
  orderNumber: {
    required: true,
    minLength: 1,
    maxLength: 50,
    message: 'Order number is required',
  },
  product: {
    required: true,
    minLength: 1,
    maxLength: 100,
    message: 'Product is required',
  },
  batchNumber: {
    required: true,
    minLength: 1,
    maxLength: 50,
    message: 'Batch number is required',
  },
};

export const wasteEntrySchema = {
  waste: {
    required: true,
    min: 0.1,
    max: 10000,
    message: 'Waste amount must be between 0.1 and 10000 kg',
  },
  wasteType: {
    required: true,
    message: 'Please select a waste type',
  },
};

export const downtimeEntrySchema = {
  downtime: {
    required: true,
    min: 1,
    max: 1440,
    message: 'Downtime must be between 1 and 1440 minutes',
  },
  downtimeReason: {
    required: true,
    message: 'Please select a downtime reason',
  },
};

export const speedEntrySchema = {
  speed: {
    required: true,
    min: 1,
    max: 2000,
    message: 'Speed must be between 1 and 2000 PPM',
  },
};

export const sachetMassSchema = {
  mass: {
    required: true,
    min: 0.1,
    max: 1000,
    message: 'Mass must be between 0.1 and 1000 grams',
  },
};

export const looseCasesSchema = {
  batchNumber: {
    required: true,
    pattern: /^\d{5}$/,
    message: 'Batch number must be exactly 5 digits',
  },
  cases: {
    required: true,
    min: 1,
    max: 9999,
    message: 'Cases must be between 1 and 9999',
  },
};

export const palletQRSchema = {
  qrCode: {
    required: true,
    pattern: /^\d{13}$/,
    message: 'QR code must be exactly 13 digits',
  },
};

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

// Sanitize number input
export const sanitizeNumber = (
  input: string | number,
  min?: number,
  max?: number
): number | null => {
  const num = typeof input === 'number' ? input : parseFloat(input);

  if (isNaN(num)) return null;
  if (min !== undefined && num < min) return min;
  if (max !== undefined && num > max) return max;

  return num;
};

// Validate and parse QR code
export const parseAndValidateQRCode = (
  qrCode: string
): { valid: boolean; data?: { batchNumber: string; palletNumber: string; casesCount: number }; error?: string } => {
  const cleaned = qrCode.trim();

  if (!/^\d{13}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'QR code must be exactly 13 digits',
    };
  }

  const casesCount = parseInt(cleaned.substring(9, 13), 10);

  if (isNaN(casesCount) || casesCount < 1) {
    return {
      valid: false,
      error: 'Invalid cases count in QR code',
    };
  }

  return {
    valid: true,
    data: {
      batchNumber: cleaned.substring(0, 5),
      palletNumber: cleaned.substring(5, 9),
      casesCount,
    },
  };
};

// Hook for form validation
export const useFormValidation = <T extends Record<string, unknown>>(
  schema: Record<keyof T, ValidationRule>
) => {
  const validate = (data: T): ValidationResult => validateForm(data, schema);

  const validateSingleField = (field: keyof T, value: unknown): string | null =>
    validateField(value, schema[field]);

  return { validate, validateSingleField };
};

export default {
  validateField,
  validateForm,
  sanitizeInput,
  sanitizeNumber,
  parseAndValidateQRCode,
  shiftDetailsSchema,
  wasteEntrySchema,
  downtimeEntrySchema,
  speedEntrySchema,
  sachetMassSchema,
  looseCasesSchema,
  palletQRSchema,
};
