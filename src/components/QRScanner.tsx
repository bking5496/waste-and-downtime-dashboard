import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (qrData: string) => void;
  recentScans?: string[]; // To prevent duplicate scans
}

const QRScanner: React.FC<QRScannerProps> = ({ isOpen, onClose, onScan, recentScans = [] }) => {
  const [error, setError] = useState<string | null>(null);
  const [, setIsScanning] = useState(false); // Tracks scanning state for future UI enhancements
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);

  // Keep ref in sync with prop
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Initialize scanner when modal opens
  useEffect(() => {
    if (isOpen && containerRef.current) {
      // Delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        startScannerInternal();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    return () => {
      stopScannerInternal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const stopScannerInternal = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const startScannerInternal = async () => {
    if (scannerRef.current) {
      await stopScannerInternal();
    }

    try {
      setError(null);
      setIsScanning(true);
      
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // QR code not found - this is normal, just keep scanning
        }
      );
    } catch (err: any) {
      console.error('QR Scanner error:', err);
      setIsScanning(false);
      
      if (err.toString().includes('NotAllowedError')) {
        setError('Camera permission denied. Please allow camera access to scan QR codes.');
      } else if (err.toString().includes('NotFoundError')) {
        setError('No camera found. Please ensure your device has a camera.');
      } else {
        setError(`Failed to start scanner: ${err.message || err}`);
      }
    }
  };

  const handleSuccessfulScan = async (qrData: string) => {
    // Prevent duplicate scans (same QR within 3 seconds)
    if (lastScanned === qrData) {
      return;
    }

    // Check if this pallet was already scanned this session
    if (recentScans.includes(qrData)) {
      setError(`Pallet "${qrData}" was already scanned this session!`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLastScanned(qrData);
    setShowSuccess(true);
    
    // Vibrate on successful scan (if supported)
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    // Stop scanning briefly to show success
    await stopScannerInternal();
    
    // Call the parent callback
    onScan(qrData);

    // Show success for 1.5 seconds then continue scanning
    setTimeout(() => {
      setShowSuccess(false);
      setLastScanned(null);
      if (isOpen) {
        startScannerInternal();
      }
    }, 1500);
  };

  const handleClose = () => {
    stopScannerInternal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="qr-scanner-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div 
          className="qr-scanner-modal"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="qr-scanner-header">
            <h3>
              <span className="scanner-icon">📷</span>
              Scan Pallet QR Code
            </h3>
            <button className="qr-close-btn" onClick={handleClose}>✕</button>
          </div>

          <div className="qr-scanner-body" ref={containerRef}>
            {/* Success overlay */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div 
                  className="scan-success-overlay"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <div className="success-checkmark">✓</div>
                  <p>Pallet Scanned!</p>
                  <span className="scanned-code">{lastScanned}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error message */}
            {error && (
              <div className="qr-error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            {/* QR Reader container */}
            <div id="qr-reader" className="qr-reader-container"></div>

            {/* Instructions */}
            <div className="qr-instructions">
              <p>Position the QR code within the frame</p>
              {recentScans.length > 0 && (
                <span className="scan-count">{recentScans.length} pallets scanned this shift</span>
              )}
            </div>
          </div>

          <div className="qr-scanner-footer">
            <button className="qr-cancel-btn" onClick={handleClose}>
              Done Scanning
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QRScanner;
