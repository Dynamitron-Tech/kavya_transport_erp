/**
 * DocumentScanner.tsx
 * iPhone-style document scanner modal.
 *
 * Features:
 *   - Live camera feed with environment-facing camera
 *   - Real-time edge detection via OpenCV.js (loaded from CDN)
 *   - Green border glow when document is detected
 *   - Auto-capture after 1.5 s of stable detection
 *   - Manual shutter button
 *   - Retake / Use-this-scan preview flow
 *   - Graceful file-picker fallback if camera is unavailable
 *
 * Props:
 *   isOpen          — Controls modal visibility
 *   onClose         — Called when user dismisses
 *   onCapture       — Called with { file, dataUrl } when scan is accepted
 *   docType?        — Optional doc type hint shown in UI
 */

import React, { useEffect, useRef } from 'react';
import {
  X, Camera, RefreshCw, Check, Upload, AlertCircle,
  ScanLine, Loader2,
} from 'lucide-react';
import { useCameraScanner } from './useCameraScanner';
import EdgeOverlay from './EdgeOverlay';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageFile: File, imageDataUrl: string) => void;
  docType?: string;
}

// ─── Status badge labels / colours ───────────────────────────────────────────

const STATUS_BADGE: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  idle: { label: 'Ready to scan', bg: 'bg-gray-800/70', text: 'text-white' },
  starting: { label: 'Starting camera…', bg: 'bg-gray-800/70', text: 'text-white' },
  scanning: { label: 'Point at document', bg: 'bg-gray-800/70', text: 'text-white' },
  detected: { label: 'Document detected ✓', bg: 'bg-green-600/90', text: 'text-white' },
  capturing: { label: 'Capturing…', bg: 'bg-blue-600/90', text: 'text-white' },
  preview: { label: 'Review scan', bg: 'bg-gray-800/70', text: 'text-white' },
  error: { label: 'Camera unavailable', bg: 'bg-red-600/90', text: 'text-white' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentScanner({
  isOpen,
  onClose,
  onCapture,
  docType,
}: DocumentScannerProps) {
  const {
    videoRef,
    canvasRef,
    overlayCanvasRef,
    status,
    error,
    capturedDataUrl,
    capturedFile,
    isOpenCVReady,
    startCamera,
    stopCamera,
    retake,
    captureManually,
  } = useCameraScanner();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && status === 'idle') {
      startCamera();
    }
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accept the captured scan
  const handleUse = () => {
    if (capturedFile && capturedDataUrl) {
      onCapture(capturedFile, capturedDataUrl);
      onClose();
    }
  };

  // File picker fallback
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onCapture(file, ev.target?.result as string);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.scanning;
  const isDetected = status === 'detected';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal container */}
      <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-blue-400" />
            <span className="text-white font-semibold">
              Scan Document
              {docType ? ` — ${docType}` : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera / Preview area */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>

          {/* Video feed (hidden once captured) */}
          {status !== 'preview' && (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
          )}

          {/* Captured image preview */}
          {status === 'preview' && capturedDataUrl && (
            <img
              src={capturedDataUrl}
              alt="Captured scan"
              className="absolute inset-0 w-full h-full object-contain bg-black"
            />
          )}

          {/* Edge detection overlay canvas */}
          {status !== 'preview' && (
            <EdgeOverlay
              ref={overlayCanvasRef}
              className={isDetected ? 'animate-pulse-subtle' : ''}
            />
          )}

          {/* Document frame guide — shown while scanning */}
          {(status === 'scanning' || status === 'detected') && (
            <div
              className={`absolute inset-8 rounded-lg border-2 pointer-events-none transition-colors duration-300 ${
                isDetected ? 'border-green-400 shadow-green-400/40 shadow-lg' : 'border-white/30'
              }`}
            />
          )}

          {/* Status badge (top-centre) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text} backdrop-blur-sm`}
            >
              {badge.label}
            </span>
          </div>

          {/* OpenCV loading notice */}
          {(status === 'scanning' || status === 'starting') && !isOpenCVReady && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-400 bg-black/60 px-3 py-1.5 rounded-full">
              <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />
              Loading edge detection…
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-900/90 p-6">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="text-white text-center text-sm">{error}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Upload file instead
              </button>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-800/80">
          {/* Hidden canvas used for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {status === 'preview' ? (
            /* Preview controls */
            <div className="w-full flex items-center justify-between">
              <button
                onClick={retake}
                className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </button>
              <span className="text-gray-400 text-xs">Looks good?</span>
              <button
                onClick={handleUse}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Check className="w-4 h-4" />
                Use this scan
              </button>
            </div>
          ) : (
            /* Scanning controls */
            <div className="w-full flex items-center justify-between">
              {/* File picker fallback */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                title="Upload from gallery"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload file</span>
              </button>

              {/* Shutter button */}
              <button
                onClick={captureManually}
                disabled={status !== 'scanning' && status !== 'detected'}
                className="w-16 h-16 rounded-full border-4 border-white bg-white/90 hover:bg-white flex items-center justify-center shadow-lg disabled:opacity-40 transition-all active:scale-95"
                aria-label="Capture photo"
              >
                <Camera className="w-7 h-7 text-gray-800" />
              </button>

              {/* Retry camera */}
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                title="Restart camera"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Retry</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileSelect}
        capture="environment"
      />
    </div>
  );
}
