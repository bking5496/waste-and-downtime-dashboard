/**
 * Tests for validation utilities
 */

import {
  validateField,
  validateForm,
  sanitizeInput,
  sanitizeNumber,
  parseAndValidateQRCode,
  shiftDetailsSchema,
  wasteEntrySchema,
  downtimeEntrySchema,
  looseCasesSchema,
} from './validation';

describe('validateField', () => {
  describe('required validation', () => {
    it('should fail for empty string when required', () => {
      expect(validateField('', { required: true })).toBe('This field is required');
    });

    it('should fail for null when required', () => {
      expect(validateField(null, { required: true })).toBe('This field is required');
    });

    it('should fail for undefined when required', () => {
      expect(validateField(undefined, { required: true })).toBe('This field is required');
    });

    it('should pass for valid string when required', () => {
      expect(validateField('test', { required: true })).toBeNull();
    });

    it('should pass for empty string when not required', () => {
      expect(validateField('', { required: false })).toBeNull();
    });
  });

  describe('minLength validation', () => {
    it('should fail for string shorter than minLength', () => {
      expect(validateField('ab', { minLength: 3 })).toBe('Must be at least 3 characters');
    });

    it('should pass for string equal to minLength', () => {
      expect(validateField('abc', { minLength: 3 })).toBeNull();
    });

    it('should pass for string longer than minLength', () => {
      expect(validateField('abcd', { minLength: 3 })).toBeNull();
    });
  });

  describe('maxLength validation', () => {
    it('should fail for string longer than maxLength', () => {
      expect(validateField('abcdef', { maxLength: 5 })).toBe('Must be no more than 5 characters');
    });

    it('should pass for string equal to maxLength', () => {
      expect(validateField('abcde', { maxLength: 5 })).toBeNull();
    });

    it('should pass for string shorter than maxLength', () => {
      expect(validateField('abc', { maxLength: 5 })).toBeNull();
    });
  });

  describe('min/max numeric validation', () => {
    it('should fail for number below min', () => {
      expect(validateField(5, { min: 10 })).toBe('Must be at least 10');
    });

    it('should pass for number equal to min', () => {
      expect(validateField(10, { min: 10 })).toBeNull();
    });

    it('should fail for number above max', () => {
      expect(validateField(100, { max: 50 })).toBe('Must be no more than 50');
    });

    it('should pass for number equal to max', () => {
      expect(validateField(50, { max: 50 })).toBeNull();
    });
  });

  describe('pattern validation', () => {
    it('should fail for non-matching pattern', () => {
      expect(validateField('abc', { pattern: /^\d+$/ })).toBe('Invalid format');
    });

    it('should pass for matching pattern', () => {
      expect(validateField('123', { pattern: /^\d+$/ })).toBeNull();
    });
  });

  describe('custom validation', () => {
    it('should use custom validator', () => {
      const customValidator = (value: unknown) =>
        value === 'special' ? null : 'Must be "special"';

      expect(validateField('wrong', { custom: customValidator })).toBe('Must be "special"');
      expect(validateField('special', { custom: customValidator })).toBeNull();
    });
  });

  describe('custom message', () => {
    it('should use custom error message', () => {
      expect(validateField('', { required: true, message: 'Custom error' })).toBe('Custom error');
    });
  });
});

describe('validateForm', () => {
  const schema = {
    name: { required: true, minLength: 2 },
    age: { required: true, min: 0, max: 150 },
  };

  it('should return valid for correct data', () => {
    const result = validateForm({ name: 'John', age: 25 }, schema);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should return errors for invalid data', () => {
    const result = validateForm({ name: '', age: -5 }, schema);
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.age).toBeDefined();
  });

  it('should validate shift details schema', () => {
    const validData = {
      operatorName: 'John Doe',
      orderNumber: 'ORD-001',
      product: 'Product A',
      batchNumber: 'BATCH-001',
    };
    const result = validateForm(validData, shiftDetailsSchema);
    expect(result.isValid).toBe(true);
  });

  it('should fail empty shift details', () => {
    const invalidData = {
      operatorName: '',
      orderNumber: '',
      product: '',
      batchNumber: '',
    };
    const result = validateForm(invalidData, shiftDetailsSchema);
    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors)).toHaveLength(4);
  });

  it('should validate waste entry schema', () => {
    const validEntry = { waste: 5.5, wasteType: 'Powder' };
    const result = validateForm(validEntry, wasteEntrySchema);
    expect(result.isValid).toBe(true);
  });

  it('should fail invalid waste entry', () => {
    const invalidEntry = { waste: 0, wasteType: '' };
    const result = validateForm(invalidEntry, wasteEntrySchema);
    expect(result.isValid).toBe(false);
  });

  it('should validate downtime entry schema', () => {
    const validEntry = { downtime: 30, downtimeReason: 'Mechanical' };
    const result = validateForm(validEntry, downtimeEntrySchema);
    expect(result.isValid).toBe(true);
  });

  it('should validate loose cases schema', () => {
    const validEntry = { batchNumber: '12345', cases: 10 };
    const result = validateForm(validEntry, looseCasesSchema);
    expect(result.isValid).toBe(true);

    const invalidEntry = { batchNumber: '123', cases: 10 };
    const invalidResult = validateForm(invalidEntry, looseCasesSchema);
    expect(invalidResult.isValid).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('should remove HTML tags', () => {
    expect(sanitizeInput('<script>alert("xss")</script>hello')).toBe('hello');
  });

  it('should limit length', () => {
    const longString = 'a'.repeat(2000);
    expect(sanitizeInput(longString).length).toBe(1000);
  });
});

describe('sanitizeNumber', () => {
  it('should parse valid numbers', () => {
    expect(sanitizeNumber('42')).toBe(42);
    expect(sanitizeNumber(42)).toBe(42);
    expect(sanitizeNumber('3.14')).toBe(3.14);
  });

  it('should return null for invalid input', () => {
    expect(sanitizeNumber('abc')).toBeNull();
    expect(sanitizeNumber('')).toBeNull();
  });

  it('should clamp to min/max', () => {
    expect(sanitizeNumber(5, 10, 100)).toBe(10);
    expect(sanitizeNumber(150, 10, 100)).toBe(100);
    expect(sanitizeNumber(50, 10, 100)).toBe(50);
  });
});

describe('parseAndValidateQRCode', () => {
  it('should parse valid 13-digit QR code', () => {
    const result = parseAndValidateQRCode('1234512340050');
    expect(result.valid).toBe(true);
    expect(result.data).toEqual({
      batchNumber: '12345',
      palletNumber: '1234',
      casesCount: 50,
    });
  });

  it('should reject QR code with wrong length', () => {
    expect(parseAndValidateQRCode('123456789').valid).toBe(false);
    expect(parseAndValidateQRCode('12345678901234').valid).toBe(false);
  });

  it('should reject QR code with non-digit characters', () => {
    expect(parseAndValidateQRCode('123456789012a').valid).toBe(false);
  });

  it('should handle leading zeros correctly', () => {
    const result = parseAndValidateQRCode('0000100010001');
    expect(result.valid).toBe(true);
    expect(result.data?.batchNumber).toBe('00001');
    expect(result.data?.palletNumber).toBe('0001');
    expect(result.data?.casesCount).toBe(1);
  });

  it('should trim whitespace', () => {
    const result = parseAndValidateQRCode('  1234512340050  ');
    expect(result.valid).toBe(true);
  });
});
