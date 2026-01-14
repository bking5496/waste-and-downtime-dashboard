import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/LoadingSkeleton';
import { SkipLink } from './lib/accessibility';

// Lazy load pages for better initial load performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CaptureScreen = lazy(() => import('./pages/CaptureScreen'));
const MultiCaptureScreen = lazy(() => import('./pages/MultiCaptureScreen'));
const AdminConsole = lazy(() => import('./pages/AdminConsole'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

// Lazy load non-critical components
const ChatWidget = lazy(() => import('./components/ChatWidget'));
const LatestMessageBar = lazy(() => import('./components/LatestMessageBar'));

// Loading fallback component
const PageLoadingFallback = () => (
  <div role="status" aria-label="Loading page">
    <PageSkeleton />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <Router>
        {/* Skip link for keyboard navigation */}
        <SkipLink targetId="main-content">Skip to main content</SkipLink>

        <Suspense fallback={<PageLoadingFallback />}>
          <AnimatePresence mode="wait">
            <main id="main-content" tabIndex={-1}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/admin" element={<AdminConsole />} />
                <Route path="/capture/multi" element={<MultiCaptureScreen />} />
                <Route path="/capture/:machineId" element={<CaptureScreen />} />
                <Route path="/history" element={<HistoryPage />} />
              </Routes>
            </main>
          </AnimatePresence>
        </Suspense>

        {/* Chat components - non-critical, lazy loaded */}
        <Suspense fallback={null}>
          <ChatWidget />
          <LatestMessageBar />
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
