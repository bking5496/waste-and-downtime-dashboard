import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

// Generate unique error ID for tracking
const generateErrorId = (): string => {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Log error to console and optionally to external service
const logError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
  const errorReport = {
    id: errorId,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  console.error('ErrorBoundary caught an error:', errorReport);

  // Store in localStorage for debugging (keep last 10 errors)
  try {
    const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
    storedErrors.unshift(errorReport);
    localStorage.setItem('app_errors', JSON.stringify(storedErrors.slice(0, 10)));
  } catch (e) {
    // Ignore storage errors
  }

  // Future: Send to external error tracking service
  // if (process.env.REACT_APP_ERROR_REPORTING_URL) {
  //   fetch(process.env.REACT_APP_ERROR_REPORTING_URL, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(errorReport),
  //   }).catch(() => {});
  // }
};

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { errorId } = this.state;
    if (errorId) {
      logError(error, errorInfo, errorId);
    }
    this.setState({ errorInfo });

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.hash = '/';
    window.location.reload();
  };

  private handleCopyError = () => {
    const { error, errorInfo, errorId } = this.state;
    const errorText = `Error ID: ${errorId}
Message: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
URL: ${window.location.href}
Time: ${new Date().toISOString()}`;

    navigator.clipboard.writeText(errorText).then(() => {
      alert('Error details copied to clipboard');
    }).catch(() => {
      alert('Failed to copy error details');
    });
  };

  public render() {
    if (this.state.hasError) {
      // Allow custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary" role="alert" aria-live="assertive">
          <div className="error-boundary-content">
            <div className="error-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="64" height="64">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h1>Something went wrong</h1>
            <p className="error-message">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            {this.state.errorId && (
              <p className="error-id">
                Error ID: <code>{this.state.errorId}</code>
              </p>
            )}
            <div className="error-actions">
              <button
                className="error-btn primary"
                onClick={this.handleRetry}
                aria-label="Try again without reloading"
              >
                Try Again
              </button>
              <button
                className="error-btn secondary"
                onClick={this.handleReload}
                aria-label="Reload the page"
              >
                Reload Page
              </button>
              <button
                className="error-btn tertiary"
                onClick={this.handleGoHome}
                aria-label="Go to dashboard"
              >
                Go to Dashboard
              </button>
            </div>
            <button
              className="error-btn copy-btn"
              onClick={this.handleCopyError}
              aria-label="Copy error details to clipboard"
            >
              Copy Error Details
            </button>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre>{this.state.error?.stack}</pre>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
