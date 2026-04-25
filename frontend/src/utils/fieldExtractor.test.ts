/**
 * fieldExtractor.test.ts
 * Vitest unit tests for the browser-side field extraction utility.
 * Run with: npm test (or npx vitest run)
 */

import { describe, it, expect } from 'vitest';
import {
  normaliseDate,
  detectDocType,
  extractFields,
  type DocumentType,
} from '../utils/fieldExtractor';

// ─── normaliseDate ────────────────────────────────────────────────────────────

describe('normaliseDate', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(normaliseDate('15/08/2025')).toBe('2025-08-15');
  });

  it('converts DD-MM-YYYY to YYYY-MM-DD', () => {
    expect(normaliseDate('01-01-2024')).toBe('2024-01-01');
  });

  it('converts DD.MM.YYYY to YYYY-MM-DD', () => {
    expect(normaliseDate('31.12.2030')).toBe('2030-12-31');
  });

  it('passes through YYYY-MM-DD unchanged', () => {
    expect(normaliseDate('2026-06-30')).toBe('2026-06-30');
  });

  it('converts "15 Aug 2025" format', () => {
    expect(normaliseDate('15 Aug 2025')).toBe('2025-08-15');
  });

  it('converts "1 January 2024" format', () => {
    expect(normaliseDate('1 January 2024')).toBe('2024-01-01');
  });

  it('returns null for non-date strings', () => {
    expect(normaliseDate('hello world')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normaliseDate('')).toBeNull();
  });

  it('handles date embedded in surrounding text', () => {
    expect(normaliseDate('Valid upto 31/12/2027 for all')).toBe('2027-12-31');
  });
});

// ─── detectDocType ────────────────────────────────────────────────────────────

describe('detectDocType', () => {
  it('detects RC from "Registration Certificate" keyword', () => {
    const text = 'REGISTRATION CERTIFICATE\nReg. No TN72BC7214\nChassis No: MA1FC2DR';
    expect(detectDocType(text)).toBe('RC');
  });

  it('detects Insurance from "insurance policy" keyword', () => {
    const text = 'Motor Insurance Policy\nPolicy No BA/123456\nInsurer HDFC Ergo';
    expect(detectDocType(text)).toBe('Insurance');
  });

  it('detects DrivingLicense from "Driving Licence" keyword', () => {
    const text = 'Driving Licence\nDL No TN0220092345678\nLMV, MCWG';
    expect(detectDocType(text)).toBe('DrivingLicense');
  });

  it('detects Fitness from "Fitness Certificate"', () => {
    const text = 'FITNESS CERTIFICATE\nFitness No FC/TN/2024/001\nValid Upto 31/12/2026';
    expect(detectDocType(text)).toBe('Fitness');
  });

  it('detects PUC from "PUCC" keyword', () => {
    const text = 'POLLUTION UNDER CONTROL CERTIFICATE\nPUCC No PUC/TN/2024/567\nCO: 0.15%';
    expect(detectDocType(text)).toBe('PUC');
  });

  it('returns Other for unrecognizable text', () => {
    const result = detectDocType('Lorem ipsum dolor sit amet');
    // Either Other or any type — just must not crash
    expect(typeof result).toBe('string');
  });

  it('detects Hindi keyword for RC (पंजीकरण)', () => {
    const text = 'पंजीकरण प्रमाण पत्र\nReg No TN72BC7214';
    expect(detectDocType(text)).toBe('RC');
  });

  it('detects Tamil keyword for Insurance (காப்பீடு)', () => {
    const text = 'காப்பீடு\nPolicy No BA123456\nMotor Insurance';
    expect(detectDocType(text)).toBe('Insurance');
  });
});

// ─── extractFields — RC ───────────────────────────────────────────────────────

describe('extractFields — RC', () => {
  const rc = `REGISTRATION CERTIFICATE
Reg. No: TN72BC7214
Owner Name: KAVYA TRANSPORTS PVT LTD
Chassis No: MA1FC2DRXP1234567
Engine No: K10C1234567
Valid Upto: 31/12/2030
Fuel: Diesel
Vehicle Class: HGV`;

  it('extracts registration_number', () => {
    const fields = extractFields(rc, 'RC');
    expect(fields.registration_number).toBeDefined();
    expect(fields.registration_number.value).toContain('TN72BC7214');
  });

  it('has high confidence for registration_number', () => {
    const fields = extractFields(rc, 'RC');
    expect(fields.registration_number.confidence).toBe('high');
  });

  it('extracts chassis_number', () => {
    const fields = extractFields(rc, 'RC');
    expect(fields.chassis_number).toBeDefined();
  });

  it('extracts engine_number', () => {
    const fields = extractFields(rc, 'RC');
    expect(fields.engine_number).toBeDefined();
  });

  it('extracts valid_upto and normalises to YYYY-MM-DD', () => {
    const fields = extractFields(rc, 'RC');
    expect(fields.valid_upto).toBeDefined();
    expect(fields.valid_upto.value).toBe('2030-12-31');
  });

  it('extracts fuel_type', () => {
    const fields = extractFields(rc, 'RC');
    expect(fields.fuel_type?.value.toLowerCase()).toBe('diesel');
  });
});

// ─── extractFields — Insurance ────────────────────────────────────────────────

describe('extractFields — Insurance', () => {
  const ins = `MOTOR INSURANCE POLICY
Policy No: BA/123456/2024/001
Vehicle No: TN72BC7214
Insurer: HDFC ERGO General Insurance Company
Valid from: 01/04/2024
Valid upto: 31/03/2025
Premium: Rs. 18,500`;

  it('extracts policy_number', () => {
    const fields = extractFields(ins, 'Insurance');
    expect(fields.policy_number).toBeDefined();
    expect(fields.policy_number.value.length).toBeGreaterThan(3);
  });

  it('extracts vehicle_number', () => {
    const fields = extractFields(ins, 'Insurance');
    expect(fields.vehicle_number).toBeDefined();
    expect(fields.vehicle_number.value).toContain('TN72BC7214');
  });

  it('extracts insurer_name (hdfc ergo)', () => {
    const fields = extractFields(ins, 'Insurance');
    expect(fields.insurer_name).toBeDefined();
    expect(fields.insurer_name.value.toLowerCase()).toContain('hdfc');
  });

  it('extracts valid_upto', () => {
    const fields = extractFields(ins, 'Insurance');
    expect(fields.valid_upto).toBeDefined();
    expect(fields.valid_upto.value).toBe('2025-03-31');
  });
});

// ─── extractFields — DrivingLicense ──────────────────────────────────────────

describe('extractFields — DrivingLicense', () => {
  const dl = `DRIVING LICENCE
DL No: TN0220191234567
Name: RAJAN KUMAR
Date of Birth: 15/01/1985
Valid To: 31/12/2033
LMV, MCWG
Blood Group: O+ve`;

  it('extracts dl_number', () => {
    const fields = extractFields(dl, 'DrivingLicense');
    expect(fields.dl_number).toBeDefined();
  });

  it('extracts holder_name', () => {
    const fields = extractFields(dl, 'DrivingLicense');
    expect(fields.holder_name).toBeDefined();
    expect(fields.holder_name.value).toContain('RAJAN');
  });

  it('extracts dob', () => {
    const fields = extractFields(dl, 'DrivingLicense');
    expect(fields.dob).toBeDefined();
    expect(fields.dob.value).toBe('1985-01-15');
  });

  it('extracts valid_upto', () => {
    const fields = extractFields(dl, 'DrivingLicense');
    expect(fields.valid_upto).toBeDefined();
    expect(fields.valid_upto.value).toBe('2033-12-31');
  });

  it('extracts blood_group', () => {
    const fields = extractFields(dl, 'DrivingLicense');
    expect(fields.blood_group?.value).toBe('O+');
  });

  it('extracts vehicle_class containing LMV', () => {
    const fields = extractFields(dl, 'DrivingLicense');
    expect(fields.vehicle_class?.value).toContain('LMV');
  });
});

// ─── extractFields — Fitness ──────────────────────────────────────────────────

describe('extractFields — Fitness', () => {
  const fit = `FITNESS CERTIFICATE
Certificate No: FC/TN/2024/00123
Vehicle No: TN72BC7214
Valid Upto: 30/06/2026
Issued By: RTO, Chennai`;

  it('extracts certificate_number', () => {
    const fields = extractFields(fit, 'Fitness');
    expect(fields.certificate_number).toBeDefined();
  });

  it('extracts vehicle_number', () => {
    const fields = extractFields(fit, 'Fitness');
    expect(fields.vehicle_number?.value).toContain('TN72BC7214');
  });

  it('extracts valid_upto', () => {
    const fields = extractFields(fit, 'Fitness');
    expect(fields.valid_upto?.value).toBe('2026-06-30');
  });
});

// ─── extractFields — PUC ─────────────────────────────────────────────────────

describe('extractFields — PUC', () => {
  const puc = `POLLUTION UNDER CONTROL CERTIFICATE
PUCC No: PUC/TN/2024/56789
Vehicle: TN72BC7214
Test Date: 01/03/2024
Valid Upto: 01/09/2024
CO: 0.15%, HC: 72 ppm`;

  it('extracts puc_number', () => {
    const fields = extractFields(puc, 'PUC');
    expect(fields.puc_number).toBeDefined();
  });

  it('extracts vehicle_number', () => {
    const fields = extractFields(puc, 'PUC');
    expect(fields.vehicle_number?.value).toContain('TN72BC7214');
  });

  it('extracts valid_upto', () => {
    const fields = extractFields(puc, 'PUC');
    expect(fields.valid_upto).toBeDefined();
    expect(fields.valid_upto?.value).toBe('2024-09-01');
  });

  it('extracts emission_values', () => {
    const fields = extractFields(puc, 'PUC');
    expect(fields.emission_values).toBeDefined();
  });
});

// ─── Indian vehicle number edge cases ────────────────────────────────────────

describe('Indian vehicle number regex edge cases', () => {
  const cases: [string, string][] = [
    ['TN72BC7214', 'standard no spaces'],
    ['MH 04 AB 1234', 'spaces between groups'],
    ['GJ01AB1234', 'Gujarat standard format'],
    ['DL03BF0001', 'Delhi standard format'],
  ];

  for (const [reg, desc] of cases) {
    it(`detects vehicle number: ${reg} (${desc})`, () => {
      const text = `Registration Certificate\nReg No: ${reg}\nEngine No: ABC123`;
      const fields = extractFields(text, 'RC');
      expect(fields.registration_number).toBeDefined();
      const val = fields.registration_number.value.replace(/[\s\-]/g, '').toUpperCase();
      const expected = reg.replace(/[\s\-]/g, '').toUpperCase();
      expect(val).toBe(expected);
    });
  }
});

// ─── Real TN Smart Card — Driving Licence ────────────────────────────────────
describe('Real TN smart card — Driving Licence', () => {
  const dlText = [
    'Indian Union Driving Licence',
    'Issued by Government Of Tamil Nadu',
    'TN 72 2024005499',
    'Name: N AJAI KUMAR',
    'Date of Birth: 06-09-2005',
    'Validity(NT) 05-09-2045',
    'Blood Group: A+',
    'Date of Issue: 29-08-2024',
  ].join('\n');

  it('detects as DrivingLicense', () => {
    expect(detectDocType(dlText)).toBe('DrivingLicense');
  });

  it('extracts DL number TN722024005499', () => {
    const f = extractFields(dlText, 'DrivingLicense');
    expect(f.dl_number).toBeDefined();
    expect(f.dl_number.value.replace(/[\s\-]/g, '').toUpperCase()).toBe('TN722024005499');
  });

  it('extracts valid_upto from Validity(NT) label', () => {
    const f = extractFields(dlText, 'DrivingLicense');
    expect(f.valid_upto).toBeDefined();
    expect(f.valid_upto.value).toBe('2045-09-05');
  });

  it('extracts blood group A+ at end-of-line', () => {
    const f = extractFields(dlText, 'DrivingLicense');
    expect(f.blood_group).toBeDefined();
    expect(f.blood_group.value).toBe('A+');
  });
});

// ─── Real TN Smart Card — Registration Certificate ───────────────────────────
describe('Real TN smart card — RC', () => {
  const rcText = [
    'Indian Union Vehicle Registration Certificate',
    'Issued by Government Of Tamil Nadu',
    'Regn. Number TN72BC7214',
    'Chassis Number MBJB49BT9001213701215',
    'Engine/Motor Number 1ND1440167',
    'Owner Name KUMARASAMY S',
    'Date of Regn. 04-01-2016',
    'Regn. Validity 03-01-2031',
    'Fuel',
    'DIESEL',
  ].join('\n');

  it('detects as RC', () => {
    expect(detectDocType(rcText)).toBe('RC');
  });

  it('extracts registration number TN72BC7214', () => {
    const f = extractFields(rcText, 'RC');
    expect(f.registration_number).toBeDefined();
    expect(f.registration_number.value.replace(/[\s\-]/g, '').toUpperCase()).toBe('TN72BC7214');
  });

  it('extracts engine number 1ND1440167 from Engine/Motor Number label', () => {
    const f = extractFields(rcText, 'RC');
    expect(f.engine_number).toBeDefined();
    expect(f.engine_number.value.toUpperCase()).toBe('1ND1440167');
  });

  it('extracts chassis number MBJB49BT9001213701215', () => {
    const f = extractFields(rcText, 'RC');
    expect(f.chassis_number).toBeDefined();
    expect(f.chassis_number.value.toUpperCase()).toBe('MBJB49BT9001213701215');
  });

  it('extracts valid_upto from Regn. Validity label', () => {
    const f = extractFields(rcText, 'RC');
    expect(f.valid_upto).toBeDefined();
    expect(f.valid_upto.value).toBe('2031-01-03');
  });

  it('extracts fuel type DIESEL from next-line format', () => {
    const f = extractFields(rcText, 'RC');
    expect(f.fuel_type).toBeDefined();
    expect(f.fuel_type.value).toBe('Diesel');
  });
});
