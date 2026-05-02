/**
 * fieldExtractor.ts
 * Browser-side regex field extraction for Indian transport documents.
 * Mirrors the backend document_ocr_service logic so the same rules
 * work client-side (without a network round-trip).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'RC'
  | 'Insurance'
  | 'DrivingLicense'
  | 'Fitness'
  | 'PUC'
  | 'Invoice'
  | 'EWayBill'
  | 'LRCopy'
  | 'Permit'
  | 'Contract'
  | 'POD'
  | 'TaxReceipt'
  | 'Other';

export interface FieldValue {
  value: string;
  confidence: 'high' | 'medium' | 'low';
  rawMatch: string;
}

export type ExtractedFields = Record<string, FieldValue>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Indian vehicle registration number pattern */
const VEH_REG = /\b([A-Z]{2}[\s\-]?\d{2}[\s\-]?[A-Z]{1,3}[\s\-]?\d{1,4})\b/i;

/** Normalise any Indian date format to YYYY-MM-DD */
export function normaliseDate(input: string): string | null {
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (also single-digit day/month)
  const dmy = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/.exec(input);
  if (dmy) {
    const md = parseInt(dmy[2]), dd = parseInt(dmy[1]);
    if (md >= 1 && md <= 12 && dd >= 1 && dd <= 31)
      return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  }

  // YYYY-MM-DD
  const ymd = /(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})/.exec(input);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  // Space-separated: "15 03 2028"
  const dmySp = /\b(\d{1,2})\s+(\d{1,2})\s+((19|20)\d{2})\b/.exec(input);
  if (dmySp) {
    const md = parseInt(dmySp[2]), dd = parseInt(dmySp[1]);
    if (md >= 1 && md <= 12 && dd >= 1 && dd <= 31)
      return `${dmySp[3]}-${dmySp[2].padStart(2,'0')}-${dmySp[1].padStart(2,'0')}`;
  }

  // OCR artifact: "/" read as "l" or "I" → "15l03l2028"
  const dmyArt = /(\d{2})[lI|](\d{2})[lI|]((19|20)\d{2})/.exec(input);
  if (dmyArt) return `${dmyArt[3]}-${dmyArt[2]}-${dmyArt[1]}`;

  // DD Mon YYYY
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const mth = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/i.exec(input);
  if (mth) {
    const month = monthNames[mth[2].toLowerCase().slice(0, 3)];
    return `${mth[3]}-${month}-${mth[1].padStart(2, '0')}`;
  }

  return null;
}

function fv(value: string, confidence: 'high' | 'medium' | 'low', rawMatch?: string): FieldValue {
  return { value, confidence, rawMatch: rawMatch ?? value };
}

function findAfterLabel(text: string, ...labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 1. Next-line first: label alone on its line, value on the line below
    //    Preferred for Indian DLs where "Name" is a column header
    const reNext = new RegExp(`${escaped}[^\\n]*\\n[ \\t]*([^\\n]{1,100})`, 'i');
    const mn = reNext.exec(text);
    if (mn && mn[1].trim()) {
      const nextLine = mn[1].trim();
      // Only accept if it looks like real content (not another label)
      const alpha = nextLine.replace(/[^A-Za-z\s]/g, '').trim();
      if (alpha.length >= 4) return nextLine;
    }
    // 2. Same-line fallback: "Name: ARVIND KUMAR"
    const re = new RegExp(`${escaped}\\s*[:\\-\\.\\s]?\\s*([^\\n]{1,100})`, 'i');
    const m = re.exec(text);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

function allDates(text: string): string[] {
  // Always normalize OCR letter→digit confusion before scanning for dates
  const t = normalizeDateText(text);
  const results: string[] = [];
  const push = (d: string) => {
    // Validate: year 1940-2099, month 1-12, day 1-31
    const [y, mo, dd] = d.split('-').map(Number);
    if (y >= 1940 && y <= 2099 && mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31)
      if (!results.includes(d)) results.push(d);
  };
  let m;

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (single-digit day/month too)
  const dmyPattern = /(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})/g;
  while ((m = dmyPattern.exec(t)) !== null) {
    push(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  }
  // YYYY-MM-DD
  const ymdPattern = /(\d{4})[.\/\-](\d{2})[.\/\-](\d{2})/g;
  while ((m = ymdPattern.exec(t)) !== null) {
    push(`${m[1]}-${m[2]}-${m[3]}`);
  }
  // Space-separated: "15 03 2028"
  const dmySp = /\b(\d{1,2})\s+(\d{1,2})\s+((19|20)\d{2})\b/g;
  while ((m = dmySp.exec(t)) !== null) {
    push(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  }
  // OCR artifact separators: "15l03l2028" "15I03I2028"
  const dmyArt = /(\d{2})[lI|](\d{2})[lI|]((19|20)\d{2})/g;
  while ((m = dmyArt.exec(t)) !== null) {
    push(`${m[3]}-${m[2]}-${m[1]}`);
  }
  // 8-digit continuous run: "08082044" → 08/08/2044
  const run8 = /\b(\d{2})(\d{2})((19|20)\d{2})\b/g;
  while ((m = run8.exec(t)) !== null) {
    push(`${m[3]}-${m[2]}-${m[1]}`);
  }
  return results;
}

/**
 * Normalize common OCR letter→digit substitutions that appear inside date strings.
 * Tesseract frequently misreads: 0↔O, 1↔I/l/!, 5↔S, 2↔Z.
 * We only fix them when they sit BETWEEN digits (date separator context).
 */
function normalizeDateText(t: string): string {
  return t
    .replace(/([\d])[Oo]([\d])/g, '$10$2')
    .replace(/([\d])[Oo]([\d])/g, '$10$2')   // second pass for runs like O8O8
    .replace(/([\d])[Il!]([\d])/g, '$11$2')
    .replace(/([\d])[Ss]([\d])/g, '$15$2')
    .replace(/([\d])[Zz]([\d])/g, '$12$2')
    // Also fix a leading O/I before a 4-digit year: O8/08/2044 → 08/08/2044
    .replace(/\bO(\d)\//, '0$1/')
    .replace(/\bO(\d)-/, '0$1-')
    .replace(/\bO(\d)\s/, '0$1 ');
}

/**
 * Find a date value near a label — checks the label line itself AND up to 3 lines below.
 * Returns a YYYY-MM-DD string or null.
 * `patterns` are raw regex strings (case-insensitive).
 */
function findDateNearLabel(lines: string[], ...patterns: string[]): string | null {
  for (const pattern of patterns) {
    const re = new RegExp(pattern, 'i');
    const idx = lines.findIndex(l => re.test(l));
    if (idx < 0) continue;
    for (let i = idx; i <= Math.min(idx + 3, lines.length - 1); i++) {
      const dates = allDates(normalizeDateText(lines[i]));
      if (dates.length > 0) return dates[0];
    }
  }
  return null;
}

// ─── Known Indian insurers ────────────────────────────────────────────────────

const INDIAN_INSURERS = [
  'new india', 'united india', 'oriental', 'national insurance',
  'bajaj allianz', 'icici lombard', 'hdfc ergo', 'tata aig',
  'reliance general', 'royal sundaram', 'cholamandalam',
  'future generali', 'liberty general', 'iffco tokio',
  'shriram general', 'digit insurance', 'acko',
];

// ─── Per doc-type extractors ──────────────────────────────────────────────────

function extractRC(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const lines = text.split('\n');

  // Registration number
  const rm = VEH_REG.exec(text);
  if (rm) {
    const clean = rm[1].replace(/[\s\-]/g, '').toUpperCase();
    fields.registration_number = fv(clean, 'high', rm[1]);
  }

  // Owner name — multi-line aware (TN smart card: "Owner Name\nNALAN SHUNMUGARAJ K")
  const owner = findAfterLabel(text, 'Name of Owner', 'Registered Owner', 'Owner Name', 'Owner', 'वाहन स्वामी');
  if (owner) {
    // Only take the first clean line, strip trailing noise
    const cleaned = owner.split('\n')[0].replace(/[^A-Za-z\s.]/g, '').trim();
    if (cleaned.length >= 3) fields.owner_name = fv(cleaned.slice(0, 80), 'medium', owner);
  }
  // Fallback: look for ALL-CAPS name line near "Owner" or "Name" label
  if (!fields.owner_name) {
    const ownerIdx = lines.findIndex(l => /owner\s*name|name\s*of\s*owner/i.test(l));
    if (ownerIdx >= 0) {
      for (let i = ownerIdx; i <= Math.min(ownerIdx + 3, lines.length - 1); i++) {
        const alphaOnly = lines[i].replace(/[^A-Z\s]/g, '').trim();
        const words = alphaOnly.split(/\s+/).filter(w => w.length >= 2);
        if (words.length >= 2 && words.join(' ').length >= 5) {
          fields.owner_name = fv(words.join(' ').slice(0, 80), 'medium', lines[i].trim());
          break;
        }
      }
    }
  }

  // Son / Wife / Daughter of (in case of individual Owner)
  const sdw = findAfterLabel(text,
    'Son/Wife/Daughter of', 'Son / Wife / Daughter',
    'S/W/D of', 'S/D/W of', "Son/Wife/Daughter of(In case of Individual Owner)",
  );
  if (sdw) {
    const cleaned = sdw.split('\n')[0].replace(/[^A-Za-z\s.]/g, '').trim();
    if (cleaned.length >= 3) fields.father_name = fv(cleaned.slice(0, 80), 'medium', sdw);
  }

  // Chassis — same-line first, then multi-line fallback
  const cm = /(?:chassis\s*(?:no|number)?|chassisno|चेसिस\s*संख्या)\s*[:\-.]?\s*([A-Z0-9X]{6,25})/i.exec(text);
  if (cm) {
    fields.chassis_number = fv(cm[1], cm[1].length >= 10 ? 'high' : 'medium', cm[0]);
  } else {
    // Multi-line: "Chassis Number\nMBJB49BT9001213701215"
    const chassIdx = lines.findIndex(l => /chassis/i.test(l));
    if (chassIdx >= 0) {
      for (let i = chassIdx; i <= Math.min(chassIdx + 2, lines.length - 1); i++) {
        const alphaNum = lines[i].replace(/[^A-Z0-9]/gi, '');
        if (/^[A-Z0-9]{10,25}$/i.test(alphaNum) && /[A-Z]/i.test(alphaNum) && /\d/.test(alphaNum)) {
          fields.chassis_number = fv(alphaNum.toUpperCase(), 'medium', lines[i].trim());
          break;
        }
      }
    }
  }

  // Engine — same-line first, then multi-line fallback
  const em = /(?:engine(?:\/motor)?\s*(?:no|number)?|engineno|इंजन\s*संख्या)\s*[:\-.]?\s*([A-Z0-9X]{6,20})/i.exec(text);
  if (em) {
    fields.engine_number = fv(em[1], em[1].length >= 6 ? 'high' : 'medium', em[0]);
  } else {
    // Multi-line: "Engine/Motor Number\n1ND1440167"
    const engIdx = lines.findIndex(l => /engine/i.test(l));
    if (engIdx >= 0) {
      for (let i = engIdx; i <= Math.min(engIdx + 2, lines.length - 1); i++) {
        const alphaNum = lines[i].replace(/[^A-Z0-9]/gi, '');
        if (/^[A-Z0-9]{6,20}$/i.test(alphaNum) && /\d/.test(alphaNum)) {
          fields.engine_number = fv(alphaNum.toUpperCase(), 'medium', lines[i].trim());
          break;
        }
      }
    }
  }

  // Registration date — TN smart card: "Date of Regn." / "Registration Date"
  if (!fields.issue_date) {
    const regDate = findDateNearLabel(lines,
      'date.{0,4}regn', 'date.{0,4}registration', 'regn.{0,4}date',
      'registration.{0,4}date', 'card.{0,4}issue.{0,4}date',
    );
    if (regDate) fields.issue_date = fv(regDate, 'high', regDate);
  }

  // Valid upto — also handles "Regn. Validity" / "Regn Validity" on new TN smart cards
  const dateCtx = findAfterLabel(text, 'Regn. Validity', 'Regn Validity', 'Valid Upto', 'Reg. Upto', 'Registration Valid', 'Validity', 'Valid Till', 'वैधता');
  if (dateCtx) {
    const d = normaliseDate(dateCtx);
    if (d) fields.valid_upto = fv(d, 'high', dateCtx);
  }
  // Multi-line fallback for validity (date may be on next line)
  if (!fields.valid_upto) {
    const vd = findDateNearLabel(lines,
      'regn\\.?\\s*validity', 'valid\\s*upto', 'valid\\s*till', 'validity',
    );
    if (vd) fields.valid_upto = fv(vd, 'high', vd);
  }

  // Vehicle class
  const vc = findAfterLabel(text, 'Vehicle Class', 'Class of Vehicle', 'Type of Vehicle');
  if (vc) fields.vehicle_class = fv(vc.split('\n')[0].slice(0, 30), 'medium', vc);

  // Fuel type — handles same-line AND next-line formats (new TN smart card: Fuel\nDIESEL)
  const fm = /fuel\s*(?:used|type)?\s*[:\-.]?\s*\n?\s*(diesel|petrol|cng|electric|lpg)/i.exec(text);
  if (fm) fields.fuel_type = fv(fm[1].charAt(0).toUpperCase() + fm[1].slice(1).toLowerCase(), 'high', fm[0]);

  // Emission norms
  const enm = findAfterLabel(text, 'Emission Norms', 'Emission');
  if (enm) {
    const cleaned = enm.split('\n')[0].trim();
    if (cleaned.length >= 2) fields.emission_norms = fv(cleaned.slice(0, 30), 'medium', enm);
  }

  // Address
  const addr = findAfterLabel(text, 'Address');
  if (addr) {
    // Take up to 2 lines
    const addrLines = addr.split('\n').slice(0, 2).map(l => l.trim()).filter(Boolean).join(', ');
    if (addrLines.length >= 5) fields.address = fv(addrLines.slice(0, 200), 'low', addr);
  }

  // Fallback: classify dates by heuristic if not already found
  if (!fields.issue_date || !fields.valid_upto) {
    const currentYear = new Date().getFullYear();
    const foundDates = allDates(normalizeDateText(text));
    for (const d of foundDates) {
      const year = parseInt(d.split('-')[0]);
      if (!fields.issue_date && year >= 2000 && year <= currentYear) {
        fields.issue_date = fv(d, 'medium', d);
      } else if (!fields.valid_upto && year > currentYear) {
        fields.valid_upto = fv(d, 'medium', d);
      }
    }
  }

  return fields;
}

function extractInsurance(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  // Policy number
  const pm = /(?:policy\s*(?:no|number)?)[:\s.]+([A-Z0-9\-\/]{8,30})/i.exec(text);
  if (pm) fields.policy_number = fv(pm[1].trim(), 'high', pm[0]);

  // Insurer name
  const lower = text.toLowerCase();
  for (const ins of INDIAN_INSURERS) {
    const idx = lower.indexOf(ins);
    if (idx !== -1) {
      const original = text.slice(idx, idx + ins.length);
      fields.insurer_name = fv(original, 'high', ins);
      break;
    }
  }

  // Vehicle number
  const vm = VEH_REG.exec(text);
  if (vm) fields.vehicle_number = fv(vm[1].replace(/[\s\-]/g, '').toUpperCase(), 'high', vm[1]);

  // Dates
  const dates = allDates(text);
  if (dates[0]) fields.valid_from = fv(dates[0], 'medium', dates[0]);
  if (dates.length >= 2) fields.valid_upto = fv(dates[dates.length - 1], 'medium', dates[dates.length - 1]);

  // Premium
  const prem = /premium[\s:\-]*(?:rs\.?|₹)?\s*([\d,]+\.?\d*)/i.exec(text);
  if (prem) fields.premium_amount = fv(prem[1].replace(/,/g, ''), 'medium', prem[0]);

  return fields;
}

function extractDL(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const lines = text.split('\n');

  // DL number — allow flexible spacing: TN72 20240005499, TN 72 20240005499, etc.
  const dlm = /([A-Z]{2}[\s\-]*\d{2}[\s\-]*(?:19|20)\d{2}[\s]*\d{4,9})/i.exec(text);
  if (dlm) {
    fields.dl_number = fv(dlm[1].replace(/[\s\-]/g, '').toUpperCase(), 'high', dlm[1]);
  } else {
    // Fallback: state code + RTO + year (19xx/20xx) + serial — must contain a valid year
    const dlFallback = /([A-Z]{2}\s*\d{2}\s*(?:19|20)\d{2}\s*\d{5,9})/i.exec(text);
    if (dlFallback) fields.dl_number = fv(dlFallback[1].replace(/\s/g, '').toUpperCase(), 'medium', dlFallback[0]);
  }

  // Name — try same-line first, then look for ALL-CAPS name near "Name" label
  const name = findAfterLabel(text, 'Name', 'Holder', 'DL Holder');
  if (name) {
    const firstLine = name.split('\n')[0].trim();
    // Only accept if it looks like a real name (all uppercase letters, min 4 chars)
    const alphaOnly = firstLine.replace(/[^A-Za-z\s]/g, '').trim();
    const nameWords = alphaOnly.split(/\s+/).filter(Boolean);
    // Require at least 4 chars total AND at least one word longer than 2 chars
    if (/^[A-Z\s]{4,}$/.test(alphaOnly) && nameWords.some(w => w.length > 2)) {
      fields.holder_name = fv(alphaOnly.slice(0, 80), 'high', firstLine);
    }
  }
  if (!fields.holder_name) {
    // Fallback: find an ALL-CAPS name line near a "Name" label line
    const nameIdx = lines.findIndex(l => /\bname\b/i.test(l));
    if (nameIdx >= 0) {
      for (let i = nameIdx; i <= Math.min(nameIdx + 3, lines.length - 1); i++) {
        const alphaOnly = lines[i].replace(/[^A-Z\s]/g, '').trim();
        const words = alphaOnly.split(/\s+/).filter(w => w.length >= 2);
        // Require 2+ words, total >= 5 chars, and at least one word > 2 chars
        if (words.length >= 2 && words.join(' ').length >= 5 && words.some(w => w.length > 2)) {
          fields.holder_name = fv(words.join(' ').slice(0, 80), 'medium', lines[i].trim());
          break;
        }
      }
    }
  }

  // DOB — handle OCR garbles: "Date of Buth", "Date of Bith", "Bate of Birth"
  const dobCtx = findAfterLabel(text, 'Date of Birth', 'Date of Buth', 'Date of Bith', 'Bate of Birth', 'D.O.B', 'DOB');
  if (dobCtx) {
    const d = normaliseDate(normalizeDateText(dobCtx));
    if (d) fields.dob = fv(d, 'high', dobCtx);
  }
  if (!fields.dob) {
    // Multi-line: DOB label might be on its own line
    const dobVal = findDateNearLabel(lines, 'date.{0,4}birth', 'dob\\b', 'd\\.o\\.b');
    if (dobVal) fields.dob = fv(dobVal, 'high', dobVal);
  }

  // Valid upto — multi-line search near validity labels (handles date on next line)
  if (!fields.valid_upto) {
    const vd = findDateNearLabel(lines,
      'validity.{0,4}nt', 'validity.{0,4}tr', 'valid.{0,4}till',
      'valid.{0,4}upto', 'valid.{0,4}to\\b', 'validity', 'valid upto', 'valid till',
    );
    if (vd) {
      const yr = parseInt(vd.split('-')[0]);
      if (yr > new Date().getFullYear() - 1) // must be present or future year
        fields.valid_upto = fv(vd, 'high', vd);
    }
  }

  // Issue date — explicit label search first (multi-line aware)
  if (!fields.issue_date) {
    const id = findDateNearLabel(lines,
      'date.{0,4}issue', 'issue.{0,4}date', 'date.{0,4}issuance',
      'issued.{0,4}on', 'date of iss',
    );
    if (id) fields.issue_date = fv(id, 'high', id);
  }

  // Fallback: classify ALL dates found in text (handles unlabelled dates)
  const currentYear = new Date().getFullYear();
  const foundDates = allDates(normalizeDateText(text));
  for (const d of foundDates) {
    const year = parseInt(d.split('-')[0]);
    if (!fields.dob && year >= 1940 && year <= currentYear - 16) {
      fields.dob = fv(d, 'medium', d);
    } else if (!fields.valid_upto && year >= currentYear) {
      fields.valid_upto = fv(d, 'medium', d);
    } else if (!fields.issue_date && year >= currentYear - 10 && year < currentYear) {
      fields.issue_date = fv(d, 'medium', d);
    }
  }

  // Father / Husband name (Son / Daughter / Wife of)
  const sdwCtx = findAfterLabel(text, 'Son / Daughter / Wife of', 'Son/Daughter/Wife of', 'S/D/W of', "Father's Name", 'Guardian');
  if (sdwCtx) {
    const alphaOnly = sdwCtx.split('\n')[0].replace(/[^A-Za-z\s]/g, '').trim();
    if (alphaOnly.length >= 4) fields.father_name = fv(alphaOnly.slice(0, 80), 'medium', sdwCtx);
  }
  if (!fields.father_name) {
    // Fallback: look for ALL-CAPS name line after S/D/W label
    const sdwIdx = lines.findIndex(l => /son\s*\/?\s*daughter|s\s*\/\s*d\s*\/\s*w|father/i.test(l));
    if (sdwIdx >= 0) {
      for (let i = sdwIdx + 1; i <= Math.min(sdwIdx + 2, lines.length - 1); i++) {
        const alphaOnly = lines[i].replace(/[^A-Z\s]/g, '').trim();
        const words = alphaOnly.split(/\s+/).filter(w => w.length >= 2);
        if (words.length >= 1 && words.join(' ').length >= 5) {
          fields.father_name = fv(words.join(' ').slice(0, 80), 'medium', lines[i].trim());
          break;
        }
      }
    }
  }

  // Vehicle classes
  const classes = [...text.matchAll(/\b(LMV|HMV|HGMV|MGV|MCWG|MCWOG|3W|Transport|HTV|PSV)\b/gi)]
    .map(m => m[1].toUpperCase());
  const unique = [...new Set(classes)];
  if (unique.length) fields.vehicle_class = fv(unique.join(', '), 'high', unique.join(', '));

  // Blood group — handles A+, A+ve, A+ at end-of-line (new TN smart card format)
  // Also handles common OCR garbles: "Blof Group", "Bl00d Group", "8lood Group"
  const bg = /(?:bl(?:oo?|of|0{1,2})d?\s*(?:group)?\s*[:\-]?\s*)?(A|B|AB|O)[+\-](?:ve)?(?=[\s\n,./]|$)/i.exec(text);
  if (bg) {
    const sign = bg[0].includes('+') ? '+' : '-';
    fields.blood_group = fv(`${bg[1].toUpperCase()}${sign}`, 'high', bg[0].trim());
  }

  return fields;
}

function extractFitness(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const lines = text.split('\n');

  // Certificate number
  const cm = /(?:certificate\s*(?:no|number)?|cert\s*(?:no|number)?)[:\s.]+([A-Z0-9\-\/]{5,25})/i.exec(text);
  if (cm) fields.certificate_number = fv(cm[1].trim(), 'high', cm[0]);

  // Vehicle number
  const vm = VEH_REG.exec(text);
  if (vm) fields.vehicle_number = fv(vm[1].replace(/[\s\-]/g, '').toUpperCase(), 'high', vm[1]);

  // Owner name (some FC docs include this; permit-like uploads may also carry it)
  const owner = findAfterLabel(
    text,
    'Owner Name',
    'Name of Owner',
    'Registered Owner',
    'Permit Holder Name',
    'Name Of The Permit Holder',
  );
  if (owner) {
    const cleaned = owner.split('\n')[0].replace(/[^A-Za-z\s.]/g, '').trim();
    if (cleaned.length >= 3) fields.owner_name = fv(cleaned.slice(0, 80), 'medium', owner);
  }

  // Valid upto
  const dateCtx = findAfterLabel(text, 'Valid Upto', 'Fit Upto', 'Valid Till', 'Validity');
  if (dateCtx) {
    const d = normaliseDate(dateCtx);
    if (d) fields.valid_upto = fv(d, 'high', dateCtx);
  }

  // Validity may be split as "From ... To ..." or appear on nearby lines.
  if (!fields.valid_upto) {
    const toDate = findDateNearLabel(lines,
      'valid.{0,4}to', 'to\s*[:\-]', 'valid.{0,4}upto', 'validity',
    );
    if (toDate) fields.valid_upto = fv(toDate, 'medium', toDate);
  }

  if (!fields.valid_upto) {
    const dates = allDates(text);
    if (dates.length >= 2) {
      fields.valid_upto = fv(dates[dates.length - 1], 'low', dates[dates.length - 1]);
    }
  }

  // Issued by
  const by = findAfterLabel(text, 'Issued By', 'Issuing Authority', 'RTO');
  if (by) fields.issued_by = fv(by.split('\n')[0].slice(0, 80), 'medium', by);

  return fields;
}

function extractPUC(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  // PUC number
  const pm = /(?:cert(?:ificate)?\s*(?:no|number)?|pucc?\s*(?:no|number)?)[:\s.]+([A-Z0-9\-\/]{5,25})/i.exec(text);
  if (pm) fields.puc_number = fv(pm[1].trim(), 'high', pm[0]);

  // Vehicle number
  const vm = VEH_REG.exec(text);
  if (vm) fields.vehicle_number = fv(vm[1].replace(/[\s\-]/g, '').toUpperCase(), 'high', vm[1]);

  // Dates
  const dates = allDates(text);
  if (dates[0]) fields.test_date = fv(dates[0], 'medium', dates[0]);
  if (dates.length >= 2) fields.valid_upto = fv(dates[1], 'medium', dates[1]);

  // Emission values
  const emVals = [...text.matchAll(/(?:co|hc)\s*[:\-]?\s*(\d+\.?\d*\s*%?)/gi)].map(m => m[0].trim());
  if (emVals.length) fields.emission_values = fv(emVals.join(', '), 'medium', emVals.join(', '));

  return fields;
}

function extractOther(text: string): ExtractedFields {
  const lines = text.split('\n').filter(l => l.trim().length > 3).slice(0, 20);
  const fields: ExtractedFields = {};
  lines.forEach((line, i) => {
    fields[`line_${String(i + 1).padStart(2, '0')}`] = fv(line.trim(), 'low', line.trim());
  });
  return fields;
}

// ─── Doc type auto-detect ─────────────────────────────────────────────────────

const DOC_KEYWORDS: Record<DocumentType, string[]> = {
  RC: [
    'registration certificate', 'registration card', 'vehicle registration',
    'reg. no', 'regn. number', 'regn number', 'regn. validity', 'regn validity',
    'chassis no', 'chassis number', 'engine no', 'engine number', 'engine/motor',
    'owner name', 'date of regn', 'rc book', 'पंजीकरण', 'பதிவு',
  ],
  Insurance: ['insurance', 'policy', 'insurer', 'premium', 'motor insurance', 'बीमा', 'காப்பீடு'],
  DrivingLicense: ['driving licence', 'driving license', 'dl no', 'd.l.no', 'licence to drive', 'ड्राइविंग', 'ஓட்டுனர்'],
  Fitness: ['fitness certificate', 'certificate of fitness', 'fit upto'],
  PUC: ['pollution', 'puc', 'pucc', 'emission', 'pollution under control', 'प्रदूषण'],
  EWayBill: ['e-way bill', 'eway', 'ewb'],
  LRCopy: ['lorry receipt', 'consignment note', 'consignment'],
  Invoice: ['invoice', 'bill of supply', 'tax invoice'],
  Permit: ['permit', 'national permit'],
  Contract: ['contract', 'agreement'],
  POD: ['proof of delivery', 'pod'],
  TaxReceipt: ['tax receipt'],
  Other: [],
};

export function detectDocType(text: string): DocumentType {
  const lower = text.toLowerCase();
  let best: DocumentType = 'Other';
  let bestScore = 0;

  for (const [docType, keywords] of Object.entries(DOC_KEYWORDS) as [DocumentType, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = docType;
    }
  }

  // Fallback heuristics for noisy OCR text where keywords may be garbled
  if (best === 'Other') {
    // RC: look for chassis, engine, regn, owner, fuel — unique to RC (check BEFORE DL)
    if (/chassis|engine.{0,8}number|regn\.|regn\s|owner\s*name|fuel\s|date\s*of\s*regn/i.test(text)) {
      return 'RC';
    }
    // DL: look for validity(nt), blood group, holder's sign — unique to driving licences
    if (/validity\s*\(\s*nt\s*\)/i.test(text) || /blood\s*group|blof\s*group|holder'?s?\s*sign/i.test(text)) {
      return 'DrivingLicense';
    }
    // DL number pattern present (strict: state code + RTO + year 19xx/20xx + serial)
    if (/\b[A-Z]{2}\d{2}\s*(?:19|20)\d{2}\d{4,9}\b/i.test(text)) {
      return 'DrivingLicense';
    }
    // Insurance: look for premium, insurer
    if (/premium|insurer|indemnity/i.test(text)) {
      return 'Insurance';
    }
  }

  return best;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function extractFields(text: string, docType: DocumentType): ExtractedFields {
  switch (docType) {
    case 'RC': return extractRC(text);
    case 'Insurance': return extractInsurance(text);
    case 'DrivingLicense': return extractDL(text);
    case 'Fitness': return extractFitness(text);
    case 'PUC': return extractPUC(text);
    default: return extractOther(text);
  }
}
