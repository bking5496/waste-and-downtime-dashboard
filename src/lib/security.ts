/**
 * Security utilities for input sanitization and validation
 */

// HTML entities for escaping
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

// Escape HTML to prevent XSS
export const escapeHtml = (str: string): string => {
  return String(str).replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
};

// Sanitize string input - removes dangerous characters
export const sanitizeString = (input: string, options: {
  maxLength?: number;
  allowNewlines?: boolean;
  allowSpecialChars?: boolean;
} = {}): string => {
  const {
    maxLength = 1000,
    allowNewlines = false,
    allowSpecialChars = true,
  } = options;

  let sanitized = input.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters (except newlines if allowed)
  if (allowNewlines) {
    sanitized = sanitized.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  } else {
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  }

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Optionally remove special characters
  if (!allowSpecialChars) {
    sanitized = sanitized.replace(/[^\w\s-]/g, '');
  }

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
};

// Sanitize number input
export const sanitizeNumber = (
  input: string | number,
  options: {
    min?: number;
    max?: number;
    decimals?: number;
    defaultValue?: number;
  } = {}
): number => {
  const { min, max, decimals, defaultValue = 0 } = options;

  let num = typeof input === 'number' ? input : parseFloat(String(input).replace(/[^\d.-]/g, ''));

  if (isNaN(num)) {
    return defaultValue;
  }

  // Clamp to range
  if (min !== undefined) num = Math.max(min, num);
  if (max !== undefined) num = Math.min(max, num);

  // Round to decimals
  if (decimals !== undefined) {
    const factor = Math.pow(10, decimals);
    num = Math.round(num * factor) / factor;
  }

  return num;
};

// Validate and sanitize email
export const sanitizeEmail = (email: string): string | null => {
  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    return null;
  }

  return sanitized.substring(0, 254); // Max email length
};

// Sanitize URL
export const sanitizeUrl = (url: string): string | null => {
  const sanitized = url.trim();

  try {
    const parsed = new URL(sanitized);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
};

// Rate limiting helper (client-side, use with caution)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } => {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: record.resetTime - now,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetIn: record.resetTime - now,
  };
};

// CSRF token generation (for forms)
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

// Store and validate CSRF tokens
const csrfTokens = new Set<string>();

export const createCSRFToken = (): string => {
  const token = generateCSRFToken();
  csrfTokens.add(token);
  // Auto-expire tokens after 1 hour
  setTimeout(() => csrfTokens.delete(token), 3600000);
  return token;
};

export const validateCSRFToken = (token: string): boolean => {
  if (csrfTokens.has(token)) {
    csrfTokens.delete(token); // Single use
    return true;
  }
  return false;
};

// Content Security Policy helper
export const getCSPDirectives = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for React
    "style-src 'self' 'unsafe-inline'", // Required for styled components
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
};

// Secure storage wrapper (with expiration)
export const secureStorage = {
  set: (key: string, value: unknown, expirationMs?: number): void => {
    const item = {
      value,
      expiration: expirationMs ? Date.now() + expirationMs : null,
    };
    localStorage.setItem(key, JSON.stringify(item));
  },

  get: <T>(key: string, defaultValue?: T): T | undefined => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;

      const parsed = JSON.parse(item);
      if (parsed.expiration && Date.now() > parsed.expiration) {
        localStorage.removeItem(key);
        return defaultValue;
      }

      return parsed.value as T;
    } catch {
      return defaultValue;
    }
  },

  remove: (key: string): void => {
    localStorage.removeItem(key);
  },

  clear: (): void => {
    localStorage.clear();
  },
};

// Detect potentially malicious input patterns
export const detectMaliciousInput = (input: string): boolean => {
  const maliciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /data:text\/html/i,
    /vbscript:/i,
    /expression\s*\(/i,
    /eval\s*\(/i,
    /document\./i,
    /window\./i,
  ];

  return maliciousPatterns.some((pattern) => pattern.test(input));
};

export default {
  escapeHtml,
  sanitizeString,
  sanitizeNumber,
  sanitizeEmail,
  sanitizeUrl,
  checkRateLimit,
  generateCSRFToken,
  createCSRFToken,
  validateCSRFToken,
  getCSPDirectives,
  secureStorage,
  detectMaliciousInput,
};
