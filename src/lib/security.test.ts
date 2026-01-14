/**
 * Tests for security utilities
 */

import {
  escapeHtml,
  sanitizeString,
  sanitizeNumber,
  sanitizeEmail,
  sanitizeUrl,
  checkRateLimit,
  detectMaliciousInput,
} from './security';

describe('escapeHtml', () => {
  it('should escape HTML entities', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(escapeHtml("'single'")).toBe('&#39;single&#39;');
  });

  it('should handle empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle strings without special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('sanitizeString', () => {
  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should remove HTML tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('');
    expect(sanitizeString('Hello <b>world</b>')).toBe('Hello world');
  });

  it('should remove null bytes', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld');
  });

  it('should remove control characters', () => {
    expect(sanitizeString('hello\x01\x02world')).toBe('helloworld');
  });

  it('should respect maxLength', () => {
    expect(sanitizeString('a'.repeat(100), { maxLength: 50 })).toHaveLength(50);
  });

  it('should preserve newlines when allowed', () => {
    expect(sanitizeString('hello\nworld', { allowNewlines: true })).toBe('hello\nworld');
    expect(sanitizeString('hello\nworld', { allowNewlines: false })).toBe('helloworld');
  });

  it('should remove special chars when not allowed', () => {
    expect(sanitizeString('hello@world!', { allowSpecialChars: false })).toBe('helloworld');
  });
});

describe('sanitizeNumber', () => {
  it('should parse valid numbers', () => {
    expect(sanitizeNumber('42')).toBe(42);
    expect(sanitizeNumber(42)).toBe(42);
    expect(sanitizeNumber('3.14')).toBe(3.14);
    expect(sanitizeNumber('-10')).toBe(-10);
  });

  it('should return default for invalid input', () => {
    expect(sanitizeNumber('abc')).toBe(0);
    expect(sanitizeNumber('abc', { defaultValue: -1 })).toBe(-1);
  });

  it('should clamp to min/max', () => {
    expect(sanitizeNumber(5, { min: 10 })).toBe(10);
    expect(sanitizeNumber(150, { max: 100 })).toBe(100);
  });

  it('should round to decimals', () => {
    expect(sanitizeNumber(3.14159, { decimals: 2 })).toBe(3.14);
    expect(sanitizeNumber(3.145, { decimals: 2 })).toBe(3.15);
  });

  it('should strip non-numeric characters', () => {
    expect(sanitizeNumber('$100.50')).toBe(100.5);
    expect(sanitizeNumber('abc123def')).toBe(123);
  });
});

describe('sanitizeEmail', () => {
  it('should accept valid emails', () => {
    expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
    expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com');
  });

  it('should reject invalid emails', () => {
    expect(sanitizeEmail('notanemail')).toBeNull();
    expect(sanitizeEmail('missing@domain')).toBeNull();
    expect(sanitizeEmail('@nodomain.com')).toBeNull();
    expect(sanitizeEmail('')).toBeNull();
  });
});

describe('sanitizeUrl', () => {
  it('should accept valid http/https URLs', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
    expect(sanitizeUrl('http://example.com/path')).toBe('http://example.com/path');
  });

  it('should reject non-http protocols', () => {
    expect(sanitizeUrl('javascript:alert("xss")')).toBeNull();
    expect(sanitizeUrl('ftp://files.example.com')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>alert("xss")</script>')).toBeNull();
  });

  it('should reject invalid URLs', () => {
    expect(sanitizeUrl('not a url')).toBeNull();
    expect(sanitizeUrl('')).toBeNull();
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Clear rate limit store between tests by using unique keys
  });

  it('should allow requests under limit', () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const result1 = checkRateLimit(key, 3, 60000);
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = checkRateLimit(key, 3, 60000);
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
  });

  it('should block requests over limit', () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    checkRateLimit(key, 2, 60000);
    checkRateLimit(key, 2, 60000);
    const result = checkRateLimit(key, 2, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('detectMaliciousInput', () => {
  it('should detect script tags', () => {
    expect(detectMaliciousInput('<script>alert("xss")</script>')).toBe(true);
    expect(detectMaliciousInput('<SCRIPT>alert("xss")</SCRIPT>')).toBe(true);
  });

  it('should detect javascript: protocol', () => {
    expect(detectMaliciousInput('javascript:alert("xss")')).toBe(true);
  });

  it('should detect event handlers', () => {
    expect(detectMaliciousInput('onclick=alert("xss")')).toBe(true);
    expect(detectMaliciousInput('onerror=alert("xss")')).toBe(true);
  });

  it('should detect eval calls', () => {
    expect(detectMaliciousInput('eval(userInput)')).toBe(true);
  });

  it('should pass safe input', () => {
    expect(detectMaliciousInput('Hello, World!')).toBe(false);
    expect(detectMaliciousInput('Just some normal text')).toBe(false);
    expect(detectMaliciousInput('Order #12345')).toBe(false);
  });
});
