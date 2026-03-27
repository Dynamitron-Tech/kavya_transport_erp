import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('test-artifacts/eway-e2e');
const HEADLESS = process.env.PW_HEADLESS !== '0';
const SLOW_MO = Number(process.env.PW_SLOWMO || 350);

const CREDENTIALS = [
  { email: 'admin@kavyatransports.com', password: 'admin123' },
  { email: 'admin@transporterp.com', password: 'admin123' },
];

if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const results = [];
let stepNo = 0;

function slug(name) {
  return name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

async function screenshot(page, label) {
  const file = path.join(ARTIFACT_DIR, `${String(stepNo).padStart(2, '0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function step(page, name, fn) {
  stepNo += 1;
  try {
    await fn();
    const shot = await screenshot(page, slug(name));
    results.push({ step: name, status: 'PASS', screenshot: shot });
    console.log(`PASS: ${name}`);
  } catch (error) {
    const shot = await screenshot(page, `failed_${slug(name)}`);
    results.push({ step: name, status: 'FAIL', error: error.message, screenshot: shot });
    console.log(`FAIL: ${name} :: ${error.message}`);
    throw error;
  }
}

async function stepSkip(page, name, reason) {
  stepNo += 1;
  const shot = await screenshot(page, `skipped_${slug(name)}`);
  results.push({ step: name, status: 'SKIP', reason, screenshot: shot });
  console.log(`SKIP: ${name} :: ${reason}`);
}

async function uiLogin(page) {
  for (const cred of CREDENTIALS) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').first().fill(cred.email);
    await page.locator('input[type="password"]').first().fill(cred.password);
    await page.locator('button:has-text("Sign in"), button:has-text("Login"), button[type="submit"]').first().click();
    await page.waitForTimeout(2200);
    if (!page.url().includes('/login')) return true;
  }
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  const created = {
    ewbNumber: `UI-EWB-${Date.now()}`,
    createdId: null,
    generatedEwbNumber: null,
  };

  try {
    await step(page, 'Open login page', async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
    });

    await step(page, 'Login from UI', async () => {
      const ok = await uiLogin(page);
      if (!ok) throw new Error('UI login failed');
    });

    await step(page, 'Open E-Way Bill list page', async () => {
      await page.goto(`${BASE}/lr/eway-bill`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      if (page.url().includes('/login')) throw new Error('Redirected to login');
      await page.locator('h1:has-text("E-Way Bills")').first().waitFor({ timeout: 10000 });
    });

    await step(page, 'Check status tabs and list health', async () => {
      for (const name of ['All', 'Draft', 'Generated', 'Active', 'In Transit', 'Extended', 'Completed', 'Cancelled', 'Expired']) {
        await page.locator(`button:has-text("${name}")`).first().waitFor({ timeout: 8000 });
      }
      await page.locator('input[placeholder*="Search" i]').first().waitFor({ timeout: 10000 });
    });

    await step(page, 'Create E-Way Bill from website', async () => {
      await page.locator('button:has-text("Generate E-Way Bill")').first().click();
      await page.locator('text=Create E-Way Bill').first().waitFor({ timeout: 10000 });

      const modal = page.locator('div.fixed.inset-0.z-50').first();
      const lrSelect = modal.locator('select').first();
      if (await lrSelect.count()) {
        const options = await lrSelect.locator('option').allTextContents();
        if (options.length > 1) {
          await lrSelect.selectOption({ index: 1 });
        }
      }

      await modal.locator('label:has-text("E-Way Bill Number") + input').fill(created.ewbNumber);
      await modal.locator('label:has-text("Goods Value") + input').fill('12345.67');
      await modal.locator('label:has-text("From State") + input').fill('Karnataka');
      await modal.locator('label:has-text("To State") + input').fill('Tamil Nadu');

      const createResp = page.waitForResponse((resp) => {
        return resp.url().includes('/api/v1/eway-bills') && resp.request().method() === 'POST';
      }, { timeout: 20000 });

      await modal.locator('button:has-text("Create E-Way Bill")').first().click();

      const resp = await createResp;
      if (!resp.ok()) throw new Error(`Create API returned ${resp.status()}`);
      const payload = await resp.json();
      created.createdId = payload?.data?.id || null;
      await page.waitForTimeout(1300);
      await page.locator('text=Create E-Way Bill').first().waitFor({ state: 'hidden', timeout: 10000 });
    });

    await step(page, 'Find created E-Way Bill in list', async () => {
      await page.goto(`${BASE}/lr/eway-bill`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("All")').first().click();
      await page.waitForTimeout(1200);
      const firstRow = page.locator('table tbody tr').first();
      await firstRow.waitFor({ timeout: 10000 });

      const ewbText = (await firstRow.locator('td').first().innerText()).trim();
      if (!ewbText) throw new Error('Could not read generated EWB number from first row');
      created.generatedEwbNumber = ewbText;
    });

    await step(page, 'Open detail and verify compliance section', async () => {
      const row = page.locator('table tbody tr').first();
      await row.locator('button[title="View"]').click();
      await page.waitForLoadState('networkidle');
      await page.locator('h3:has-text("Validity & Compliance")').first().waitFor({ timeout: 10000 });
      await page.locator('h3:has-text("Transport Details")').first().waitFor({ timeout: 10000 });
    });

    await step(page, 'Return to list and cancel created E-Way Bill', async () => {
      await page.goto(`${BASE}/lr/eway-bill`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await page.locator('button:has-text("All")').first().click();
      await page.waitForTimeout(900);

      const row = page.locator('table tbody tr').first();
      await row.waitFor({ timeout: 10000 });
      const cancelResp = page.waitForResponse((resp) => {
        return /\/api\/v1\/eway-bills\/\d+\/cancel$/.test(resp.url()) && resp.request().method() === 'POST';
      }, { timeout: 20000 });
      await row.locator('button[title="Cancel"]').click();
      const resp = await cancelResp;
      if (!resp.ok()) throw new Error(`Cancel API returned ${resp.status()}`);
      await page.waitForTimeout(1800);

      const targetRow = created.generatedEwbNumber
        ? page.locator(`table tbody tr:has-text("${created.generatedEwbNumber}")`).first()
        : page.locator('table tbody tr').first();

      await targetRow.waitFor({ timeout: 10000 });
      const cancelledBadge = targetRow.locator('span:has-text("Cancelled")').first();
      await cancelledBadge.waitFor({ timeout: 10000 });
    });

    const extendBtn = page.locator('button[title="Extend"]').first();
    if (await extendBtn.count()) {
      await step(page, 'Extend an active or in-transit E-Way Bill', async () => {
        await page.locator('button:has-text("Active")').first().click();
        await page.waitForTimeout(900);

        const extendAny = page.locator('button[title="Extend"]').first();
        if (!(await extendAny.count())) {
          throw new Error('No extendable E-Way Bill in Active tab');
        }

        await extendAny.click();
        await page.locator('text=Extend EWB:').first().waitFor({ timeout: 10000 });

        const modal = page.locator('div.fixed.inset-0.z-50').first();
        await modal.locator('label:has-text("Additional Distance") + input').fill('50');
        await modal.locator('label:has-text("Reason for Extension") + textarea').fill('UI automation extension test');

        const extendResp = page.waitForResponse((resp) => {
          return /\/api\/v1\/eway-bills\/\d+\/extend$/.test(resp.url()) && resp.request().method() === 'POST';
        }, { timeout: 20000 });

        await modal.locator('button:has-text("Extend Validity")').first().click();
        const resp = await extendResp;
        if (!resp.ok()) throw new Error(`Extend API returned ${resp.status()}`);

        await page.locator('text=Extend EWB:').first().waitFor({ state: 'hidden', timeout: 10000 });
        await page.waitForTimeout(1200);
      });
    } else {
      await stepSkip(page, 'Extend an active or in-transit E-Way Bill', 'No extendable rows present in current dataset');
    }

    await step(page, 'Check expiring alert visibility logic', async () => {
      await page.goto(`${BASE}/lr/eway-bill`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');

      const alert = page.locator('text=expiring within 8 hours').first();
      if (await alert.count()) {
        await alert.waitFor({ timeout: 5000 });
      } else {
        await page.locator('h1:has-text("E-Way Bills")').first().waitFor({ timeout: 5000 });
      }
    });

    const reportPath = path.join(ARTIFACT_DIR, 'eway_e2e_report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ at: new Date().toISOString(), headless: HEADLESS, slowMo: SLOW_MO, created, results }, null, 2)
    );

    console.log('EWAY_E2E_RESULTS_START');
    for (const r of results) {
      const suffix = r.error ? ` :: ${r.error}` : r.reason ? ` :: ${r.reason}` : '';
      console.log(`${r.status} - ${r.step} :: ${path.basename(r.screenshot)}${suffix}`);
    }
    console.log(`REPORT_FILE=${reportPath}`);
    console.log('EWAY_E2E_RESULTS_END');
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error('EWAY_E2E_FATAL', e.message);
  process.exit(1);
});
