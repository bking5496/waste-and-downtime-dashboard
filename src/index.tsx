import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import './mobile.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for offline support in production
serviceWorkerRegistration.register({
  onSuccess: () => {
    console.log('App is ready for offline use');
  },
  onUpdate: (registration) => {
    console.log('New version available. Refresh to update.');
    // Optionally show a notification to the user
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  },
  onOffline: () => {
    console.log('App is running in offline mode');
  },
  onOnline: () => {
    console.log('App is back online');
  },
});

// Performance monitoring
reportWebVitals((metric) => {
  // Log performance metrics in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${metric.name}: ${metric.value.toFixed(2)}`);
  }
  // In production, send to analytics
  // sendToAnalytics(metric);
});
