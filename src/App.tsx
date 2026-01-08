import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import CaptureScreen from './pages/CaptureScreen';
import MultiCaptureScreen from './pages/MultiCaptureScreen';
import AdminConsole from './pages/AdminConsole';
import HistoryPage from './pages/HistoryPage';
import ChatWidget from './components/ChatWidget';
import LatestMessageBar from './components/LatestMessageBar';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admin" element={<AdminConsole />} />
            <Route path="/capture/multi" element={<MultiCaptureScreen />} />
            <Route path="/capture/:machineId" element={<CaptureScreen />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </AnimatePresence>

        <ChatWidget />
        <LatestMessageBar />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
