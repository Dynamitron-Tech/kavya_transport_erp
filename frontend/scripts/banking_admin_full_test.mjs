import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const API = 'http://127.0.0.1:8000';
const ARTIFACT_DIR = path.resolve('test-artifacts/banking-e2e');
const HEADLESS = process.env.PW_HEADLESS !== '0';
const SLOW_MO = Number(process.env.PW_SLOWMO || 350);

const CREDENTIALS = [
  { email: 'admin@kavyatransports.com', password: 'admin123' },
  { email: 'admin@transporterp.com', password: 'admin123' },
];

if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const results = [];
let stepNo = 0;

async function screenshot(page, label) {
  const file = path.join(ARTIFACT_DIR, `${String(stepNo).padStart(2, '0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function step(page, name, fn) {
  stepNo += 1;
  try {
    await fn();
    const shot = await screenshot(page, name.replace(/[^a-z0-9]+/gi, '_').toLowerCase());
    results.push({ step: name, status: 'PASS', screenshot: shot });
    console.log(`PASS: ${name}`);
  } catch (error) {
    const shot = await screenshot(page, `failed_${name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`);
    results.push({ step: name, status: 'FAIL', error: error.message, screenshot: shot });
    console.log(`FAIL: ${name} :: ${error.message}`);
    throw error;
  }
}

async function apiLogin(cred) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cred),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.access_token || null;
}

async function ensureBankAccounts(token) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const listRes = await fetch(`${API}/api/v1/finance/bank-accounts`, { headers });
  const listJson = await listRes.json();
  let accounts = listJson?.data || [];

  if (accounts.length === 0) {
    const payload1 = {
      account_name: 'Main Current Account',
      account_number: '123456789012',
      bank_name: 'HDFC Bank',
      branch_name: 'Chennai Main',
      ifsc_code: 'HDFC0001234',
      account_type: 'current',
      current_balance: 50000,
      is_default: true,
    };
    const payload2 = {
      account_name: 'Transfer Secondary Account',
      account_number: '987654321098',
      bank_name: 'ICICI Bank',
      branch_name: 'Chennai T Nagar',
      ifsc_code: 'ICIC0005678',
      account_type: 'current',
      current_balance: 25000,
      is_default: false,
    };
    await fetch(`${API}/api/v1/finance/bank-accounts`, { method: 'POST', headers, body: JSON.stringify(payload1) });
    await fetch(`${API}/api/v1/finance/bank-accounts`, { method: 'POST', headers, body: JSON.stringify(payload2) });
  } else if (accounts.length === 1) {
    const payload2 = {
      account_name: 'Transfer Secondary Account',
      account_number: '987654321098',
      bank_name: 'ICICI Bank',
      branch_name: 'Chennai T Nagar',
      ifsc_code: 'ICIC0005678',
      account_type: 'current',
      current_balance: 25000,
      is_default: false,
    };
    await fetch(`${API}/api/v1/finance/bank-accounts`, { method: 'POST', headers, body: JSON.stringify(payload2) });
  }

  const verifyRes = await fetch(`${API}/api/v1/finance/bank-accounts`, { headers });
  const verifyJson = await verifyRes.json();
  return verifyJson?.data || [];
}

async function fillAndCreateEntry(page, opts) {
  await page.locator('button:has-text("New Entry")').first().click();
  await page.locator('text=Create Banking Entry').first().waitFor({ timeout: 10000 });

  await page.locator(`button:has-text("${opts.typeLabel}")`).first().click();

  const selects = page.locator('div.fixed.inset-0.z-50 select');
  const selectCount = await selects.count();
  if (selectCount < 1) throw new Error('No account select found in modal');

  await selects.nth(0).selectOption({ index: opts.fromIndex || 1 });

  const amountInput = page.locator('div.fixed.inset-0.z-50 input[placeholder="0.00"]').first();
  await amountInput.fill(opts.amount);

  const refInput = page.locator('div.fixed.inset-0.z-50 input[placeholder*="Ref" i], div.fixed.inset-0.z-50 input[placeholder*="UTR" i]').first();
  await refInput.fill(opts.reference);

  const descInput = page.locator('div.fixed.inset-0.z-50 textarea').first();
  await descInput.fill(opts.description);

  if (opts.transferTo) {
    if (selectCount < 2) throw new Error('Transfer target account select not present for BANK_TRANSFER');
    const targetSelect = selects.nth(selectCount - 1);
    const targetValues = await targetSelect.locator('option').evaluateAll((nodes) =>
      nodes.map((n) => ({ value: n.getAttribute('value') || '', text: (n.textContent || '').trim() }))
    );
    const validTargets = targetValues.filter((o) => o.value !== '');
    if (validTargets.length < 1) {
      throw new Error('No selectable target account options found for BANK_TRANSFER');
    }
    await targetSelect.selectOption(validTargets[0].value);
  }

  const respPromise = page.waitForResponse((resp) => {
    return resp.url().includes('/api/v1/banking/entries') && resp.request().method() === 'POST';
  }, { timeout: 20000 });

  await page.locator('div.fixed.inset-0.z-50 button:has-text("Create Entry")').first().click();

  const resp = await respPromise;
  if (!resp.ok()) {
    throw new Error(`Create entry API returned ${resp.status()}`);
  }

  await page.waitForTimeout(1200);
}

async function run() {
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  try {
    // Setup data through API first.
    let token = null;
    for (const cred of CREDENTIALS) {
      token = await apiLogin(cred);
      if (token) break;
    }
    if (!token) throw new Error('Could not login via API for setup');

    const ensuredAccounts = await ensureBankAccounts(token);
    console.log(`SETUP: bank_accounts=${ensuredAccounts.length}`);

    await step(page, 'Open login page', async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
    });

    await step(page, 'Login from UI', async () => {
      let done = false;
      for (const cred of CREDENTIALS) {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        await page.locator('input[type="email"]').first().fill(cred.email);
        await page.locator('input[type="password"]').first().fill(cred.password);
        await page.locator('button:has-text("Sign in"), button:has-text("Login"), button[type="submit"]').first().click();
        await page.waitForTimeout(2200);
        if (!page.url().includes('/login')) {
          done = true;
          break;
        }
      }
      if (!done) throw new Error('UI login failed');
    });

    await step(page, 'Open Banking admin page', async () => {
      await page.goto(`${BASE}/banking`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      if (page.url().includes('/login')) throw new Error('Redirected to login');
      await page.locator('text=Banking').first().waitFor({ timeout: 10000 });
    });

    await step(page, 'Check Overview tab widgets', async () => {
      await page.locator('button:has-text("Overview")').first().click();
      await page.locator('text=Total Balance').first().waitFor({ timeout: 10000 });
      await page.locator('text=Bank Accounts').first().waitFor({ timeout: 10000 });
    });

    await step(page, 'Check Transactions tab and filters', async () => {
      await page.locator('button:has-text("Transactions")').first().click();
      await page.locator('input[placeholder*="Search entries" i]').first().waitFor({ timeout: 10000 });
      await page.locator('button:has-text("New Entry")').first().waitFor({ timeout: 10000 });
    });

    await step(page, 'Create PAYMENT_RECEIVED entry', async () => {
      await fillAndCreateEntry(page, {
        typeLabel: 'Payment Received',
        amount: '1111.11',
        reference: `UI-BANK-PR-${Date.now()}`,
        description: 'Automated banking admin test PAYMENT_RECEIVED',
      });
    });

    await step(page, 'Create PAYMENT_MADE entry', async () => {
      await fillAndCreateEntry(page, {
        typeLabel: 'Payment Made',
        amount: '222.22',
        reference: `UI-BANK-PM-${Date.now()}`,
        description: 'Automated banking admin test PAYMENT_MADE',
      });
    });

    await step(page, 'Create BANK_TRANSFER entry', async () => {
      await fillAndCreateEntry(page, {
        typeLabel: 'Bank Transfer',
        amount: '333.33',
        reference: `UI-BANK-BT-${Date.now()}`,
        description: 'Automated banking admin test BANK_TRANSFER',
        fromIndex: 1,
        transferTo: 2,
      });
    });

    await step(page, 'Open Reconciliation tab', async () => {
      await page.locator('button:has-text("Reconciliation")').first().click();
      await page.locator('text=CSV Bank Statement Import').first().waitFor({ timeout: 10000 });
    });

    await step(page, 'Upload sample CSV in Reconciliation', async () => {
      const csvFile = path.join(ARTIFACT_DIR, 'sample_bank_statement.csv');
      fs.writeFileSync(
        csvFile,
        [
          'Date,Description,Reference,Debit,Credit,Balance',
          '19/03/2026,Customer payment received,UTR9001,0,1500.00,51500.00',
          '19/03/2026,Vendor payout,UTR9002,250.00,0,51250.00',
        ].join('\n'),
        'utf8'
      );

      const accountSelect = page.locator('select').filter({ hasText: 'Select Bank Account' }).first();
      if (await accountSelect.count()) {
        await accountSelect.selectOption({ index: 1 });
      } else {
        // fallback: first select in reconciliation card
        await page.locator('div:has-text("CSV Bank Statement Import") select').first().selectOption({ index: 1 });
      }

      const uploadInput = page.locator('input[type="file"]').first();
      await uploadInput.setInputFiles(csvFile);
      await page.waitForTimeout(2500);
    });

    await step(page, 'Open Accounts tab and verify rows', async () => {
      await page.locator('button:has-text("Accounts")').first().click();
      await page.locator('table').first().waitFor({ timeout: 10000 });
      const rows = await page.locator('table tbody tr').count();
      if (rows < 1) throw new Error('No account rows rendered in Accounts tab');
    });

    await step(page, 'Return to Transactions and verify table healthy', async () => {
      await page.locator('button:has-text("Transactions")').first().click();
      await page.locator('table').first().waitFor({ timeout: 10000 });
    });

    const reportPath = path.join(ARTIFACT_DIR, 'banking_e2e_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ at: new Date().toISOString(), headless: HEADLESS, slowMo: SLOW_MO, results }, null, 2));

    console.log('BANKING_E2E_RESULTS_START');
    for (const r of results) {
      console.log(`${r.status} - ${r.step} :: ${path.basename(r.screenshot)}`);
    }
    console.log(`REPORT_FILE=${reportPath}`);
    console.log('BANKING_E2E_RESULTS_END');
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error('BANKING_E2E_FATAL', e.message);
  process.exit(1);
});
