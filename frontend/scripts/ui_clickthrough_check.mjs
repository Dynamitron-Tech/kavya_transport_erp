import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const EWB_ROUTE = '/lr/eway-bill';
const LOGIN_CREDENTIALS = [
  { email: 'admin@kavyatransports.com', password: 'admin123' },
  { email: 'admin@transporterp.com', password: 'admin123' },
];

async function safeClick(page, selectors) {
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if (await loc.count()) {
      await loc.click({ timeout: 10000 });
      return s;
    }
  }
  throw new Error(`No clickable selector found: ${selectors.join(', ')}`);
}

async function safeFill(page, selectors, value) {
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if (await loc.count()) {
      await loc.fill(value, { timeout: 10000 });
      return s;
    }
  }
  throw new Error(`No fill selector found: ${selectors.join(', ')}`);
}

const results = [];

async function step(name, fn) {
  try {
    await fn();
    results.push({ step: name, status: 'PASS' });
  } catch (e) {
    results.push({ step: name, status: 'FAIL', error: e.message });
    throw e;
  }
}

async function tryLogin(page, email, password) {
  await safeFill(page, [
    'input[type="email"]',
    'input[placeholder*="Email" i]',
    'input[placeholder*="admin" i]'
  ], email);

  await safeFill(page, [
    'input[type="password"]',
    'input[placeholder*="password" i]'
  ], password);

  await safeClick(page, [
    'button:has-text("Sign in")',
    'button:has-text("Login")',
    'button[type="submit"]'
  ]);

  await page.waitForTimeout(2500);
  return !page.url().includes('/login');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await step('Open login page', async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
    });

    await step('Login', async () => {
      let loggedIn = false;
      for (const cred of LOGIN_CREDENTIALS) {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        loggedIn = await tryLogin(page, cred.email, cred.password);
        if (loggedIn) break;
      }
      if (!loggedIn) {
        throw new Error(`Login failed for all known admin credentials. Current URL: ${page.url()}`);
      }
    });

    await step('Open Banking page', async () => {
      await page.goto(`${BASE}/banking`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      if (page.url().includes('/login')) {
        throw new Error('Redirected to /login while opening /banking (auth session not established)');
      }
      await page.locator('body').first().waitFor({ timeout: 15000 });
    });

    await step('Open Transactions tab', async () => {
      await safeClick(page, [
        'button:has-text("Transactions")',
        'text=Transactions'
      ]);
      await page.waitForTimeout(1000);
    });

    await step('Open New Entry modal', async () => {
      await safeClick(page, [
        'button:has-text("New Entry")',
        'button:has-text("Create")'
      ]);
      await page.locator('text=Create Banking Entry').first().waitFor({ timeout: 10000 });
    });

    await step('Fill modal fields and close modal', async () => {
      const modal = page.locator('div.fixed.inset-0.z-50').first();
      await modal.waitFor({ timeout: 10000 });

      const accountSelect = modal.locator('select').first();
      await accountSelect.waitFor({ timeout: 10000 });
      const options = await accountSelect.locator('option').allTextContents();
      if (options.length > 1) {
        await accountSelect.selectOption({ index: 1 });
      }

      await modal.locator('input[placeholder="0.00"]').first().fill('1234.56');
      await modal.locator('input[placeholder*="Ref" i], input[placeholder*="UTR" i]').first().fill('UI-TEST-BNK-001');
      await modal.locator('textarea[placeholder*="description" i], textarea').first().fill('Manual flow test');

      await modal.locator('button:has-text("Cancel")').first().click();
      await page.locator('text=Create Banking Entry').first().waitFor({ state: 'hidden', timeout: 10000 });
    });

    await step('Verify Banking page still healthy', async () => {
      await page.goto(`${BASE}/banking`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      if (page.url().includes('/login')) {
        throw new Error('Redirected to /login while re-opening /banking');
      }
      await page.locator('body').first().waitFor({ timeout: 15000 });
    });

    await step('Open EWB page', async () => {
      await page.goto(`${BASE}${EWB_ROUTE}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      if (page.url().includes('/login')) {
        throw new Error(`Redirected to /login while opening ${EWB_ROUTE}`);
      }
      await page.locator('body').first().waitFor({ timeout: 15000 });
    });

    await page.screenshot({ path: 'ui_clickthrough_result.png', fullPage: true });

    console.log('UI_CLICKTHROUGH_RESULTS_START');
    for (const r of results) {
      console.log(`${r.status} - ${r.step}${r.error ? ` :: ${r.error}` : ''}`);
    }
    console.log('UI_CLICKTHROUGH_RESULTS_END');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('UI clickthrough failed:', e.message);
  process.exit(1);
});
