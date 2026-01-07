import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import CaptureScreen from './pages/CaptureScreen';
import HistoryPage from './pages/HistoryPage';
import ChatWidget from './components/ChatWidget';

function App() {
  return (
    <Router>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/capture/:machineId" element={<CaptureScreen />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </AnimatePresence>

      <ChatWidget />
    </Router>
  );
}

export default App;
