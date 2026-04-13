/**
 * ocrService.ts
 * Browser-side OCR using Tesseract.js v5 (MIT license).
 * Singleton worker — initialises once, reused on every call.
 *
 * Install: npm install tesseract.js
 */

import api from './api';
import {
  detectDocType,
  extractFields,
  DocumentType,
  ExtractedFields,
} from '@/utils/fieldExtractor';
import type { Worker } from 'tesseract.js';

// ─── Suppress harmless Tesseract WASM warnings ───────────────────────────────
// The WASM bridge writes these directly to console.warn, bypassing JS errorHandler.
const _TESSERACT_NOISE = [
  'Parameter not found',
  'Line cannot be recognized',
  'Image too small to scale',
];
const _origConsoleWarn = console.warn;
let _tesseractWarnPatched = false;

function ensureTesseractWarnPatch() {
  if (_tesseractWarnPatched) return;
  console.warn = function (...args: unknown[]) {
    if (args.length > 0 && typeof args[0] === 'string') {
      const msg = args[0] as string;
      if (_TESSERACT_NOISE.some(n => msg.includes(n))) return;
    }
    _origConsoleWarn.apply(console, args);
  };
  _tesseractWarnPatched = true;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OCROptions {
  docType?: DocumentType;
  language?: string[];
  onProgress?: (progress: number) => void;
}

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCRResult {
  rawText: string;
  words: Array<{ text: string; confidence: number; bbox: BBox }>;
  lines: string[];
  extractedFields: ExtractedFields;
  docType: DocumentType;
  overallConfidence: number;
  processingTimeMs: number;
  error?: string;
}

// ─── Singleton worker state ───────────────────────────────────────────────────

let _worker: Worker | null = null;
let _workerLangs: string = '';
let _initPromise: Promise<void> | null = null;

/**
 * Initialise (or re-use) the Tesseract worker.
 * Safe to call multiple times — returns immediately if already ready.
 */
export async function initOCR(
  languages: string[] = ['eng', 'hin'],
  onProgress?: (p: number) => void,
): Promise<void> {
  ensureTesseractWarnPatch();

  const langStr = languages.join('+');

  // Already initialised with the same languages
  if (_worker && _workerLangs === langStr) return;

  // Another init is in flight
  if (_initPromise) {
    await _initPromise;
    return;
  }

  _initPromise = (async () => {
    if (_worker) {
      await _worker.terminate();
      _worker = null;
    }

    const { createWorker } = await import('tesseract.js');
    _worker = await createWorker(langStr, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round((m.progress ?? 0) * 100));
        }
      },
      // Suppress harmless internal Tesseract parameter warnings that clutter the console
      // (e.g. "classify_misfit_junk_penalty", "merge_fragments_in_matrix")
      errorHandler: (err: unknown) => {
        const msg = String(err);
        if (msg.includes('Parameter not found')) return;
        console.warn('[Tesseract]', err);
      },
    });

    _workerLangs = langStr;
    onProgress?.(100);
  })();

  await _initPromise;
  _initPromise = null;
}

/** Terminate and release the Tesseract worker. */
export async function terminateOCR(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    _workerLangs = '';
  }
}

// ─── Image rotation util ──────────────────────────────────────────────────────

/**
 * Rotate a canvas by the given angle (90, 180, 270 degrees).
 * Returns a new canvas with the rotated image.
 */
function rotateCanvas(source: HTMLCanvasElement | HTMLImageElement, angleDeg: number): HTMLCanvasElement {
  const sw = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
  const sh = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;

  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const dw = Math.round(sw * cos + sh * sin);
  const dh = Math.round(sw * sin + sh * cos);

  const out = document.createElement('canvas');
  out.width = dw;
  out.height = dh;
  const ctx = out.getContext('2d')!;
  ctx.translate(dw / 2, dh / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -sw / 2, -sh / 2);
  return out;
}

// ─── Image pre-processing (canvas API) ───────────────────────────────────────

/**
 * Compute the Otsu threshold for a grayscale histogram.
 * Returns the threshold value (0–255) that minimises intra-class variance.
 */
function otsuThreshold(histogram: number[], totalPixels: number): number {
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) sumTotal += i * histogram[i];

  let sumBg = 0;
  let weightBg = 0;
  let best = 0;
  let bestVariance = 0;

  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t];
    if (weightBg === 0) continue;
    const weightFg = totalPixels - weightBg;
    if (weightFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumTotal - sumBg) / weightFg;
    const variance = weightBg * weightFg * (meanBg - meanFg) ** 2;

    if (variance > bestVariance) {
      bestVariance = variance;
      best = t;
    }
  }
  return best;
}

/**
 * Pre-process an image for better OCR accuracy using only the browser Canvas API.
 *
 * Pipeline optimised for Indian government ID cards (RC, DL, Insurance):
 *   1. Grayscale conversion (luminance)
 *   2. Contrast stretch
 *   3. Otsu's adaptive binarisation → clean black text on white background
 *   4. Morphological noise cleanup (dilate + erode to remove speckle)
 *   5. Upscale if the image is too small (target ≥ 2200 px on longest side)
 *
 * `mode` controls the strategy:
 *  - 'binary' (default) = full Otsu binarisation pipeline
 *  - 'grayscale' = contrast-stretched grayscale only (preserves faded text better)
 */
export function preprocessImageCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  mode: 'binary' | 'grayscale' = 'binary',
): HTMLCanvasElement {
  // Draw source to a working canvas
  const src = (() => {
    const c = document.createElement('canvas');
    if (source instanceof HTMLCanvasElement) {
      c.width = source.width;
      c.height = source.height;
      c.getContext('2d')!.drawImage(source, 0, 0);
    } else {
      c.width = source.naturalWidth;
      c.height = source.naturalHeight;
      c.getContext('2d')!.drawImage(source, 0, 0);
    }
    return c;
  })();

  // ── Step 0b: Pre-upscale BEFORE binarisation with smooth (bicubic) interpolation ──
  // For distant/small photos this reconstructs text edges much better than
  // nearest-neighbour upscaling done after binarisation.
  const preSrc = (() => {
    const longest = Math.max(src.width, src.height);
    if (longest >= 1800) return src; // already large enough
    const scale = 2600 / longest;
    const us = document.createElement('canvas');
    us.width  = Math.round(src.width  * scale);
    us.height = Math.round(src.height * scale);
    const uc = us.getContext('2d')!;
    uc.imageSmoothingEnabled = true;
    (uc as any).imageSmoothingQuality = 'high'; // bicubic in Chrome/Firefox/Safari
    uc.drawImage(src, 0, 0, us.width, us.height);
    return us;
  })();

  const ctx = preSrc.getContext('2d')!;
  const { width, height } = preSrc;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const totalPixels = width * height;

  // ── Step 1: Grayscale ──
  const grey = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    grey[i] = Math.round(0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]);
  }

  // ── Step 1b: Contrast stretch ──
  // Expand the actual grayscale range to [0, 255].
  // Greatly helps low-contrast images (faded documents, distant photos under poor light).
  {
    let minG = 255, maxG = 0;
    for (let i = 0; i < totalPixels; i++) {
      if (grey[i] < minG) minG = grey[i];
      if (grey[i] > maxG) maxG = grey[i];
    }
    const gRange = maxG - minG;
    // Only stretch when image has a meaningfully narrow range (low contrast image)
    if (gRange > 10 && gRange < 220) {
      const inv = 255 / gRange;
      for (let i = 0; i < totalPixels; i++) {
        grey[i] = Math.round((grey[i] - minG) * inv);
      }
    }
  }

  // ── Grayscale mode: skip binarisation, just write contrast-stretched grey ──
  if (mode === 'grayscale') {
    for (let i = 0; i < totalPixels; i++) {
      const off = i * 4;
      data[off] = data[off + 1] = data[off + 2] = grey[i];
      data[off + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    // Upscale if needed
    const longest2 = Math.max(width, height);
    if (longest2 < 2200) {
      const scale = 2200 / longest2;
      const scaled = document.createElement('canvas');
      scaled.width  = Math.round(width  * scale);
      scaled.height = Math.round(height * scale);
      const sctx = scaled.getContext('2d')!;
      sctx.imageSmoothingEnabled = true;
      (sctx as any).imageSmoothingQuality = 'high';
      sctx.drawImage(preSrc, 0, 0, scaled.width, scaled.height);
      return scaled;
    }
    return preSrc;
  }

  // ── Step 2: Otsu binarisation ──
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < totalPixels; i++) histogram[grey[i]]++;

  const threshold = otsuThreshold(histogram, totalPixels);

  // Apply threshold (text = black = 0, background = white = 255)
  const binary = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    binary[i] = grey[i] > threshold ? 255 : 0;
  }

  // ── Inversion guard ──
  // If < 40% of pixels are white after Otsu, the image has a dark background and
  // Otsu inverted the result. Tesseract requires dark text on a light background.
  let whiteCount = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (binary[i] === 255) whiteCount++;
  }
  if (whiteCount < totalPixels * 0.4) {
    for (let i = 0; i < totalPixels; i++) {
      binary[i] = binary[i] === 0 ? 255 : 0;
    }
  }

  // ── Step 3: Morphological cleanup (3×3 dilate then erode — closes small gaps, removes speckle) ──
  // Dilate (expand white regions → shrink black noise specks)
  const dilated = new Uint8Array(totalPixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxVal = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const val = binary[ny * width + nx];
            if (val > maxVal) maxVal = val;
          }
        }
      }
      dilated[y * width + x] = maxVal;
    }
  }

  // Erode (shrink white regions → restore text edges)
  const cleaned = new Uint8Array(totalPixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const val = dilated[ny * width + nx];
            if (val < minVal) minVal = val;
          }
        }
      }
      cleaned[y * width + x] = minVal;
    }
  }

  // Write back to canvas
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    data[off] = data[off + 1] = data[off + 2] = cleaned[i];
    data[off + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  // ── Step 4: Upscale if still smaller than 2200 px on longest side ──
  // (Handles the case where pre-upscale was skipped for 1800–2200 px images)
  const longest2 = Math.max(width, height);
  if (longest2 < 2200) {
    const scale = 2200 / longest2;
    const scaled = document.createElement('canvas');
    scaled.width  = Math.round(width  * scale);
    scaled.height = Math.round(height * scale);
    const sctx = scaled.getContext('2d')!;
    sctx.imageSmoothingEnabled = true;
    (sctx as any).imageSmoothingQuality = 'high';
    sctx.drawImage(preSrc, 0, 0, scaled.width, scaled.height);
    return scaled;
  }

  return preSrc;
}

/**
 * Convert a File or data URL to an HTMLImageElement for preprocessing.
 */
async function fileToImage(source: File | string): Promise<HTMLImageElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── OCR text cleaning ───────────────────────────────────────────────────────

/**
 * Clean noisy OCR text before running field extraction.
 * Strips common artifacts from Tesseract output on ID card photos:
 *   - trailing / leading noise chars (|, =, ~, >, <, \, #, etc.)
 *   - long dashes (——, ---)
 *   - stray single chars surrounded by spaces
 *   - collapse multiple whitespace
 *   - drop lines that are pure noise (< 3 alphanumeric chars)
 */
function cleanOcrText(raw: string): string {
  return raw
    .split('\n')
    .map(line => {
      let l = line;
      // Strip leading/trailing noise chars (preserve hyphens in dates like 08-08-2044)
      l = l.replace(/^[\s|=~><\\#\[\]{}—–]+/, '');
      l = l.replace(/[\s|=~><\\#\[\]{}—–]+$/, '');
      // Remove long dashes / underscores (3+ chars, not inside date patterns)
      l = l.replace(/[—–]{2,}/g, ' ');
      l = l.replace(/-{3,}/g, ' ');
      // Remove stray single non-alpha chars bounded by spaces: " | " → " "
      l = l.replace(/\s[^a-zA-Z0-9\s]\s/g, ' ');
      // Collapse whitespace
      l = l.replace(/\s{2,}/g, ' ').trim();
      return l;
    })
    .filter(l => {
      const alphaNum = (l.match(/[a-zA-Z0-9]/g) ?? []).length;
      if (alphaNum < 3) return false;
      // Drop lines where non-ASCII script (Hindi/Tamil/etc.) outnumbers Latin chars
      // — these are script-noise lines that Tesseract garbles into garbage tokens
      const nonAscii = (l.match(/[^\x00-\x7F]/g) ?? []).length;
      if (nonAscii > alphaNum) return false;
      return true;
    })
    .join('\n');
}

// ─── Helpers for dual-pass scoring ────────────────────────────────────────────

/** Flatten word-level data from Tesseract.js v5 block hierarchy */
function flattenWords(data: any): Array<{ text: string; confidence: number; bbox: any }> {
  const allWords: Array<{ text: string; confidence: number; bbox: any }> = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          allWords.push(word);
        }
      }
    }
  }
  return allWords;
}

/** Compute Latin-word-only confidence from flat word list */
function computeConfidence(allWords: Array<{ text: string; confidence: number }>): number {
  const latinWords = allWords.filter(w => {
    if (!w.text || w.text.trim().length === 0) return false;
    const ascii = (w.text.match(/[\x20-\x7E]/g) ?? []).length;
    return ascii / w.text.length > 0.5;
  });
  const scoreWords = latinWords.length > 0 ? latinWords : allWords;
  const confs = scoreWords
    .map(w => w.confidence)
    .filter(c => typeof c === 'number' && c >= 0);
  return confs.length
    ? confs.reduce((a, b) => a + b, 0) / confs.length / 100
    : 0;
}

/** Run type detection + field extraction with fallback cascade */
function extractBest(cleanedText: string, docType?: DocumentType): { type: DocumentType; fields: ExtractedFields } {
  const detectedType: DocumentType = (docType && docType !== 'Other')
    ? docType
    : detectDocType(cleanedText);
  let fields = extractFields(cleanedText, detectedType);
  let type = detectedType;

  // If explicit type yielded nothing, retry with auto-detection
  if (Object.keys(fields).length === 0 && docType && docType !== 'Other') {
    const autoType = detectDocType(cleanedText);
    if (autoType !== 'Other') {
      type = autoType;
      fields = extractFields(cleanedText, autoType);
    }
  }

  // Last resort: try specific extractors when type is 'Other'
  if (type === 'Other') {
    let bestType: DocumentType = 'Other';
    let bestFields: ExtractedFields = {};
    let bestCount = 0;
    for (const tryType of ['RC', 'DrivingLicense', 'Insurance'] as DocumentType[]) {
      const tryFields = extractFields(cleanedText, tryType);
      const count = Object.keys(tryFields).length;
      if (count > bestCount) {
        bestCount = count;
        bestType = tryType;
        bestFields = tryFields;
      }
    }
    if (bestCount > 0) {
      type = bestType;
      fields = bestFields;
    } else {
      fields = extractFields(cleanedText, 'Other');
    }
  }

  return { type, fields };
}

/** Count "real" fields (exclude line_XX debug entries) */
function countRealFields(fields: ExtractedFields): number {
  return Object.keys(fields).filter(k => !k.startsWith('line_')).length;
}

/** Score and pick the best of two OCR recognition passes */
function pickBestPass(data1: any, data2: any, docType?: DocumentType) {
  const raw1 = data1.text ?? '';
  const raw2 = data2.text ?? '';
  const clean1 = cleanOcrText(raw1);
  const clean2 = cleanOcrText(raw2);

  const words1 = flattenWords(data1);
  const words2 = flattenWords(data2);
  const conf1 = computeConfidence(words1);
  const conf2 = computeConfidence(words2);

  const ext1 = extractBest(clean1, docType);
  const ext2 = extractBest(clean2, docType);
  const count1 = countRealFields(ext1.fields);
  const count2 = countRealFields(ext2.fields);

  // Pick winner: more real fields wins; if tied, higher confidence wins
  const use2 = count2 > count1 || (count2 === count1 && conf2 > conf1);

  const bestData   = use2 ? data2 : data1;
  const bestText   = use2 ? raw2 : raw1;
  const bestClean  = use2 ? clean2 : clean1;
  const bestWords  = use2 ? words2 : words1;
  const bestConf   = use2 ? conf2 : conf1;
  const bestExt    = use2 ? ext2 : ext1;

  // Merge: if the losing pass found fields that the winning pass missed, add them
  const loserExt = use2 ? ext1 : ext2;
  for (const [key, val] of Object.entries(loserExt.fields)) {
    if (!bestExt.fields[key] && !key.startsWith('line_')) {
      bestExt.fields[key] = val;
    }
  }

  const words = bestWords.map(w => ({
    text: w.text,
    confidence: (w.confidence ?? 0) / 100,
    bbox: {
      x0: w.bbox?.x0 ?? 0, y0: w.bbox?.y0 ?? 0,
      x1: w.bbox?.x1 ?? 0, y1: w.bbox?.y1 ?? 0,
    },
  }));

  return {
    bestData, bestText, bestClean,
    bestType: bestExt.type,
    bestFields: bestExt.fields,
    overallConfidence: bestConf,
    words,
  };
}

// ─── Main OCR function ────────────────────────────────────────────────────────

/**
 * Run OCR on an image source (File, data URL string, or canvas element).
 * Initialises the Tesseract worker on first call.
 */
export async function runOCR(
  imageSource: File | string | HTMLCanvasElement,
  options: OCROptions = {},
): Promise<OCRResult> {
  const t0 = performance.now();
  const { docType, language = ['eng', 'hin'], onProgress } = options;

  try {
    // Ensure worker is ready
    await initOCR(language, (p) => onProgress?.(Math.round(p * 0.2))); // 0–20% = init

    if (!_worker) throw new Error('Tesseract worker failed to initialise');

    // Load image once
    let img: HTMLImageElement | HTMLCanvasElement;
    if (imageSource instanceof HTMLCanvasElement) {
      img = imageSource;
    } else {
      img = await fileToImage(imageSource);
    }

    onProgress?.(22);

    // ── Helper: run dual-pass (binary + grayscale) on a single canvas ──
    const dualPass = async (src: HTMLImageElement | HTMLCanvasElement) => {
      const binaryCanvas = preprocessImageCanvas(src, 'binary');
      const grayCanvas   = preprocessImageCanvas(src, 'grayscale');
      const { data: d1 } = await _worker!.recognize(binaryCanvas);
      const { data: d2 } = await _worker!.recognize(grayCanvas);
      return pickBestPass(d1, d2, docType);
    };

    // ── First attempt: original orientation ──
    let bestPick = await dualPass(img);
    onProgress?.(50);

    // ── Auto-rotation: if confidence or field count is poor, try rotations ──
    // Indian ID smart cards are often photographed sideways or upside-down.
    const fieldCount = countRealFields(bestPick.bestFields);
    if (bestPick.overallConfidence < 0.35 || fieldCount < 2) {
      const rotations = [90, 270, 180]; // 90° and 270° most common for portrait cards
      const progressPerRot = 15; // ~15% per rotation attempt
      let progressAt = 50;

      for (const angle of rotations) {
        const rotated = rotateCanvas(img, angle);
        const pick = await dualPass(rotated);
        progressAt += progressPerRot;
        onProgress?.(Math.min(progressAt, 92));

        const rotFields = countRealFields(pick.bestFields);
        const curFields = countRealFields(bestPick.bestFields);

        // Accept rotation if it finds more fields, or same fields but better confidence
        if (rotFields > curFields || (rotFields === curFields && pick.overallConfidence > bestPick.overallConfidence)) {
          bestPick = pick;
        }

        // If we found a great result, stop trying more rotations
        if (countRealFields(bestPick.bestFields) >= 4 && bestPick.overallConfidence >= 0.40) break;
      }
    }

    onProgress?.(93);

    const { bestText: rawText, bestType: finalType, bestFields: finalFields,
            overallConfidence, words } = bestPick;

    const lines = rawText.split('\n').filter((l: string) => l.trim().length > 0);

    onProgress?.(100);

    return {
      rawText,
      words,
      lines,
      extractedFields: finalFields,
      docType: finalType,
      overallConfidence: Math.round(overallConfidence * 1000) / 1000,
      processingTimeMs: Math.round(performance.now() - t0),
    };
  } catch (err: any) {
    return {
      rawText: '',
      words: [],
      lines: [],
      extractedFields: {},
      docType: docType ?? 'Other',
      overallConfidence: 0,
      processingTimeMs: Math.round(performance.now() - t0),
      error: err?.message ?? String(err),
    };
  }
}

// ─── Server fallback OCR ──────────────────────────────────────────────────────

/**
 * Send the image to the backend Tesseract OCR endpoint.
 * Use when browser OCR confidence < 60% or when user requests enhanced OCR.
 */
export async function runServerOCR(
  imageFile: File,
  docType: string = 'auto',
): Promise<OCRResult> {
  const t0 = performance.now();

  const formData = new FormData();
  formData.append('file', imageFile);

  const response = await api.post(`/documents/ocr?doc_type=${encodeURIComponent(docType)}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  // `api` interceptor returns `response.data`, which for this endpoint is APIResponse.
  // Accept both envelope shape { success, data } and flat shape.
  const envelope = response as any;
  const raw = (envelope && envelope.data && typeof envelope.data === 'object') ? envelope.data : envelope;

  const rawText: string = raw.raw_text ?? '';
  const lines: string[] = raw.lines ?? [];
  const overallConfidence: number = raw.overall_confidence ?? 0;
  const detectedType: DocumentType = (raw.doc_type_detected as DocumentType) ?? 'Other';

  // Convert backend field format to frontend shape
  const extractedFields: ExtractedFields = {};
  for (const [key, val] of Object.entries(raw.fields ?? {})) {
    const f = val as { value: string; confidence: string; raw_match: string };
    extractedFields[key] = {
      value: f.value,
      confidence: f.confidence as 'high' | 'medium' | 'low',
      rawMatch: f.raw_match,
    };
  }

  return {
    rawText,
    words: raw.word_data ?? [],
    lines,
    extractedFields,
    docType: detectedType,
    overallConfidence,
    processingTimeMs: Math.round(performance.now() - t0),
    error: raw.error ?? undefined,
  };
}
