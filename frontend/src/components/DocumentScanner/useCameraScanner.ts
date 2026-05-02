/**
 * useCameraScanner.ts
 * Custom hook encapsulating all camera + edge-detection logic.
 * Uses OpenCV.js (loaded from CDN) for contour detection, and
 * falls back gracefully if OpenCV is not available.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export type ScanStatus =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'detected'
  | 'capturing'
  | 'preview'
  | 'error';

interface UseCameraScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  status: ScanStatus;
  error: string | null;
  capturedDataUrl: string | null;
  capturedFile: File | null;
  isOpenCVReady: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  retake: () => void;
  captureManually: () => void;
}

// ─── OpenCV.js CDN loading ────────────────────────────────────────────────────

declare global {
  interface Window {
    cv: any;
    Module: any;
  }
}

let _cvLoadPromise: Promise<void> | null = null;

function loadOpenCV(): Promise<void> {
  if (_cvLoadPromise) return _cvLoadPromise;
  if (typeof window === 'undefined') return Promise.resolve();

  // Already loaded
  if (window.cv?.Mat) return Promise.resolve();

  _cvLoadPromise = new Promise((resolve) => {
    window.Module = { onRuntimeInitialized: () => resolve() };
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.onerror = () => {
      console.warn('OpenCV.js failed to load — edge detection disabled');
      resolve(); // Resolve anyway so the UI doesn't block
    };
    document.head.appendChild(script);
  });

  return _cvLoadPromise;
}

// ─── Perspective correction (canvas-based) ───────────────────────────────────

function captureFrameFromVideo(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return canvas;
}

function canvasToFile(canvas: HTMLCanvasElement, name = 'scan.jpg'): File {
  return new File(
    [dataURLToBlob(canvas.toDataURL('image/jpeg', 0.95))],
    name,
    { type: 'image/jpeg' },
  );
}

function dataURLToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

// ─── OpenCV edge detection ───────────────────────────────────────────────────

interface ContourResult {
  contour: Point[];          // 4 corner points of the detected quadrilateral
  isGoodShape: boolean;
}

function detectDocumentContour(
  cv: any,
  canvas: HTMLCanvasElement,
): ContourResult | null {
  try {
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 75, 200);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let bestArea = 0;
    let bestPoly: Point[] | null = null;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area < canvas.width * canvas.height * 0.1) {
        contour.delete();
        continue;
      }
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (approx.rows === 4 && area > bestArea) {
        bestArea = area;
        bestPoly = Array.from({ length: 4 }).map((_, j) => ({
          x: approx.data32S[j * 2],
          y: approx.data32S[j * 2 + 1],
        }));
      }

      approx.delete();
      contour.delete();
    }

    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    if (!bestPoly) return null;

    const minArea = canvas.width * canvas.height * 0.15;
    return {
      contour: bestPoly,
      isGoodShape: bestArea >= minArea,
    };
  } catch {
    return null;
  }
}

function drawContourOverlay(canvas: HTMLCanvasElement, contour: Point[]) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(contour[0].x, contour[0].y);
  for (let i = 1; i < contour.length; i++) {
    ctx.lineTo(contour[i].x, contour[i].y);
  }
  ctx.closePath();

  // Glowing green stroke
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 12;
  ctx.stroke();

  // Semi-transparent green fill
  ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
  ctx.fill();
  ctx.restore();
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useCameraScanner(): UseCameraScannerReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectedFramesRef = useRef(0);

  const [status, setStatus] = useState<ScanStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [isOpenCVReady, setIsOpenCVReady] = useState(false);

  // Load OpenCV when the hook mounts
  useEffect(() => {
    loadOpenCV().then(() => {
      setIsOpenCVReady(!!(window.cv?.Mat));
    });
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.getContext('2d')?.clearRect(
        0, 0,
        overlayCanvasRef.current.width,
        overlayCanvasRef.current.height,
      );
    }
    detectedFramesRef.current = 0;
  }, []);

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setStatus('capturing');
    stopCamera();

    const frameCanvas = captureFrameFromVideo(video);
    const dataUrl = frameCanvas.toDataURL('image/jpeg', 0.95);
    const file = canvasToFile(frameCanvas);

    setCapturedDataUrl(dataUrl);
    setCapturedFile(file);
    setStatus('preview');
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setError(null);
    setStatus('starting');
    setCapturedDataUrl(null);
    setCapturedFile(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true'); // iOS Safari
        video.muted = true;
        await video.play();
      }

      setStatus('scanning');

      // Edge detection loop every 300ms
      intervalRef.current = setInterval(() => {
        const v = videoRef.current;
        const overlay = overlayCanvasRef.current;
        if (!v || v.readyState < 2 || !overlay) return;

        // Keep overlay canvas dimensions in sync with video
        if (overlay.width !== v.videoWidth) overlay.width = v.videoWidth;
        if (overlay.height !== v.videoHeight) overlay.height = v.videoHeight;

        // Skip edge detection if OpenCV is not ready
        if (!isOpenCVReady || !window.cv?.Mat) {
          return;
        }

        const frameCanvas = captureFrameFromVideo(v);
        const result = detectDocumentContour(window.cv, frameCanvas);
        const ctx = overlay.getContext('2d')!;

        if (result?.isGoodShape) {
          drawContourOverlay(overlay, result.contour);
          setStatus('detected');
          detectedFramesRef.current++;

          // Auto-capture after 1.5 s of stable detection (≈5 frames at 300ms)
          if (detectedFramesRef.current >= 5) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            doCapture();
          }
        } else {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          setStatus(s => s === 'detected' ? 'scanning' : s);
          detectedFramesRef.current = 0;
        }
      }, 300);
    } catch (err: any) {
      stopCamera();
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please enable camera access in browser settings.'
          : err?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Camera error: ${err?.message ?? String(err)}`;
      setError(msg);
      setStatus('error');
    }
  }, [doCapture, isOpenCVReady, stopCamera]);

  const captureManually = useCallback(() => {
    if (status === 'scanning' || status === 'detected') {
      doCapture();
    }
  }, [doCapture, status]);

  const retake = useCallback(() => {
    setCapturedDataUrl(null);
    setCapturedFile(null);
    setStatus('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return {
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
  };
}
