/**
 * Error Monitoring and Alerting Service
 * Captures errors, logs them, and surfaces them to users via toast notifications
 */

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

// Error entry structure
export interface ErrorEntry {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  message: string;
  context?: string;
  stack?: string;
  component?: string;
  userId?: string;
  machineId?: string;
  dismissed: boolean;
}

// Toast notification structure
export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Storage keys
const ERROR_LOG_KEY = 'error_log';
const MAX_ERROR_ENTRIES = 100;

// Global toast listeners
type ToastListener = (toast: ToastNotification) => void;
const toastListeners: ToastListener[] = [];

// ==========================================
// ERROR LOGGING
// ==========================================

/**
 * Generate unique error ID
 */
const generateErrorId = (): string => {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get all logged errors
 */
export const getErrorLog = (): ErrorEntry[] => {
  try {
    const stored = localStorage.getItem(ERROR_LOG_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Save error log
 */
const saveErrorLog = (errors: ErrorEntry[]): void => {
  try {
    // Keep only most recent entries
    const trimmed = errors.slice(0, MAX_ERROR_ENTRIES);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // Storage might be full - try to clear old errors
    try {
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(errors.slice(0, 20)));
    } catch {
      // Give up on persistence
    }
  }
};

/**
 * Log an error
 */
export const logError = (
  message: string,
  options: {
    severity?: ErrorSeverity;
    context?: string;
    stack?: string;
    component?: string;
    machineId?: string;
    showToast?: boolean;
  } = {}
): ErrorEntry => {
  const {
    severity = 'error',
    context,
    stack,
    component,
    machineId,
    showToast = true,
  } = options;

  const entry: ErrorEntry = {
    id: generateErrorId(),
    timestamp: new Date().toISOString(),
    severity,
    message,
    context,
    stack,
    component,
    machineId,
    dismissed: false,
  };

  // Add to log
  const errors = getErrorLog();
  errors.unshift(entry);
  saveErrorLog(errors);

  // Console output based on severity
  const consoleMessage = `[${severity.toUpperCase()}] ${component ? `[${component}] ` : ''}${message}`;
  switch (severity) {
    case 'critical':
    case 'error':
      console.error(consoleMessage, context || '', stack || '');
      break;
    case 'warning':
      console.warn(consoleMessage, context || '');
      break;
    default:
      console.info(consoleMessage, context || '');
  }

  // Show toast for user-facing errors
  if (showToast && (severity === 'error' || severity === 'critical')) {
    showToastNotification({
      id: entry.id,
      message: message,
      type: 'error',
      duration: severity === 'critical' ? 0 : 5000, // Critical stays until dismissed
    });
  } else if (showToast && severity === 'warning') {
    showToastNotification({
      id: entry.id,
      message: message,
      type: 'warning',
      duration: 4000,
    });
  }

  return entry;
};

/**
 * Log a caught exception
 */
export const logException = (
  error: Error | unknown,
  component?: string,
  context?: string
): ErrorEntry => {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  return logError(errorObj.message, {
    severity: 'error',
    stack: errorObj.stack,
    component,
    context,
    showToast: true,
  });
};

/**
 * Dismiss an error from the log
 */
export const dismissError = (errorId: string): void => {
  const errors = getErrorLog();
  const index = errors.findIndex(e => e.id === errorId);
  if (index !== -1) {
    errors[index].dismissed = true;
    saveErrorLog(errors);
  }
};

/**
 * Clear all errors
 */
export const clearErrorLog = (): void => {
  localStorage.removeItem(ERROR_LOG_KEY);
};

/**
 * Get undismissed errors count
 */
export const getActiveErrorCount = (): number => {
  return getErrorLog().filter(e => !e.dismissed && (e.severity === 'error' || e.severity === 'critical')).length;
};

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

/**
 * Subscribe to toast notifications
 */
export const subscribeToToasts = (listener: ToastListener): (() => void) => {
  toastListeners.push(listener);
  return () => {
    const index = toastListeners.indexOf(listener);
    if (index > -1) {
      toastListeners.splice(index, 1);
    }
  };
};

/**
 * Show a toast notification
 */
export const showToastNotification = (toast: ToastNotification): void => {
  toastListeners.forEach(listener => listener(toast));
};

/**
 * Convenience method for success toast
 */
export const showSuccess = (message: string, duration = 3000): void => {
  showToastNotification({
    id: `toast_${Date.now()}`,
    message,
    type: 'success',
    duration,
  });
};

/**
 * Convenience method for error toast
 */
export const showError = (message: string, duration = 5000): void => {
  showToastNotification({
    id: `toast_${Date.now()}`,
    message,
    type: 'error',
    duration,
  });
};

/**
 * Convenience method for warning toast
 */
export const showWarning = (message: string, duration = 4000): void => {
  showToastNotification({
    id: `toast_${Date.now()}`,
    message,
    type: 'warning',
    duration,
  });
};

/**
 * Convenience method for info toast
 */
export const showInfo = (message: string, duration = 3000): void => {
  showToastNotification({
    id: `toast_${Date.now()}`,
    message,
    type: 'info',
    duration,
  });
};

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

/**
 * Initialize global error handlers
 * Call this once at app startup
 */
export const initializeErrorHandlers = (): void => {
  // Handle uncaught errors
  window.onerror = (message, source, lineno, colno, error) => {
    logError(String(message), {
      severity: 'critical',
      context: `${source}:${lineno}:${colno}`,
      stack: error?.stack,
      component: 'GlobalErrorHandler',
      showToast: true,
    });
    return false; // Let default handler also run
  };

  // Handle unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const message = event.reason?.message || String(event.reason) || 'Unhandled promise rejection';
    logError(message, {
      severity: 'error',
      stack: event.reason?.stack,
      component: 'PromiseRejectionHandler',
      showToast: true,
    });
  };
};

// ==========================================
// ERROR BOUNDARY HELPER
// ==========================================

/**
 * Report error from React Error Boundary
 */
export const reportErrorBoundary = (error: Error, errorInfo: { componentStack: string }): void => {
  logError(`React Error: ${error.message}`, {
    severity: 'critical',
    stack: error.stack,
    context: errorInfo.componentStack,
    component: 'ErrorBoundary',
    showToast: true,
  });
};

// ==========================================
// NETWORK ERROR HELPERS
// ==========================================

/**
 * Log network/API error with context
 */
export const logNetworkError = (
  operation: string,
  error: Error | unknown,
  endpoint?: string
): ErrorEntry => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const isOffline = !navigator.onLine;

  const message = isOffline
    ? `Network offline: ${operation} failed`
    : `${operation} failed: ${errorObj.message}`;

  return logError(message, {
    severity: isOffline ? 'warning' : 'error',
    context: endpoint ? `Endpoint: ${endpoint}` : undefined,
    stack: errorObj.stack,
    component: 'NetworkService',
    showToast: true,
  });
};

/**
 * Log Supabase operation error
 */
export const logSupabaseError = (
  operation: string,
  error: { message: string; code?: string; details?: string } | null,
  table?: string
): ErrorEntry | null => {
  if (!error) return null;

  return logError(`Database error: ${operation}`, {
    severity: 'error',
    context: `Table: ${table || 'unknown'}, Code: ${error.code || 'unknown'}, Details: ${error.details || error.message}`,
    component: 'Supabase',
    showToast: true,
  });
};
