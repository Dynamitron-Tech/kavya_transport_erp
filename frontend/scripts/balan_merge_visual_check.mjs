/**
 * Playwright Visual Check — balan/safe-updates-20260319 merge validation
 *
 * Visits every page touched by the 33 pulled files, takes screenshots,
 * and checks for JS errors, blank screens, and core DOM elements.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const ARTIFACT_DIR = path.resolve('test-artifacts/balan-merge-visual');
const HEADLESS = process.env.PW_HEADLESS !== '0';
const SLOW_MO = Number(process.env.PW_SLOWMO || 250);

const CREDENTIALS = [
  { email: 'admin@kavyatransports.com', password: 'admin123' },
  { email: 'admin@transporterp.com',    password: 'admin123' },
];

if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const results = [];
let stepNo = 0;
const jsErrors = [];

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
    results.push({ step: stepNo, name, status: 'PASS', screenshot: path.basename(shot) });
    console.log(`  PASS  [${stepNo}] ${name}`);
  } catch (error) {
    const shot = await screenshot(page, `fail_${slug(name)}`);
    results.push({ step: stepNo, name, status: 'FAIL', error: error.message, screenshot: path.basename(shot) });
    console.log(`  FAIL  [${stepNo}] ${name} :: ${error.message}`);
  }
}

async function uiLogin(page) {
  for (const cred of CREDENTIALS) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').first().fill(cred.email);
    await page.locator('input[type="password"]').first().fill(cred.password);
    await page.locator('button:has-text("Sign in"), button:has-text("Login"), button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
    if (!page.url().includes('/login')) return cred.email;
  }
  return null;
}

/**
 * Navigates to a page, waits for it to stabilise, and runs basic health checks:
 *  - Not redirected to /login (session alive)
 *  - No React error boundary ("Something went wrong")
 *  - At least some visible text rendered (not blank white page)
 */
async function visitAndCheck(page, route, label, extraChecks) {
  await step(page, label, async () => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);

    // Not kicked to login
    if (page.url().includes('/login')) throw new Error(`Redirected to /login for ${route}`);

    // No error boundary
    const errorBoundary = page.locator('text=/something went wrong/i').first();
    if (await errorBoundary.isVisible().catch(() => false)) {
      throw new Error('React error boundary visible');
    }

    // Page has visible content
    const bodyText = await page.locator('body').innerText();
    if (bodyText.trim().length < 10) throw new Error('Page appears blank');

    // Optional extra checks
    if (extraChecks) await extraChecks(page);
  });
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Playwright Visual Check — balan/safe-updates-20260319');
  console.log('═══════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: HEADLESS, slowMo: SLOW_MO });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  // Collect JS errors
  page.on('pageerror', (err) => {
    jsErrors.push({ url: page.url(), message: err.message });
  });

  try {
    // ─── 1. Login ────────────────────────────────────────────
    console.log('── Phase 1: Authentication ──');
    await step(page, 'Open login page', async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await page.locator('input[type="email"]').first().waitFor({ timeout: 8000 });
    });

    let loggedInAs = null;
    await step(page, 'Login as admin', async () => {
      loggedInAs = await uiLogin(page);
      if (!loggedInAs) throw new Error('All credential combos failed');
    });

    // ─── 2. Layout & Navigation (Header.tsx, Sidebar.tsx, navConfig.ts, App.tsx) ───
    console.log('\n── Phase 2: Layout & Navigation ──');
    await step(page, 'Header renders correctly', async () => {
      // Check the header bar exists with nav links or logo
      const header = page.locator('header, nav').first();
      await header.waitFor({ timeout: 8000 });
      const headerText = await header.innerText();
      if (headerText.length < 3) throw new Error('Header has no content');
    });

    // ─── 3. Dashboard (DashboardPage.tsx, ManagerDashboardPage.tsx) ───
    console.log('\n── Phase 3: Dashboard ──');
    await visitAndCheck(page, '/dashboard', 'Dashboard page loads', async (p) => {
      // Should have some KPI cards or dashboard widgets
      const cards = p.locator('.card, [class*="card"], [class*="stat"], [class*="kpi"]');
      const count = await cards.count();
      if (count < 1) {
        // Fallback: just check there's heading-level content
        const h = p.locator('h1, h2, h3').first();
        await h.waitFor({ timeout: 5000 });
      }
    });

    // ─── 4. Jobs (JobsPage.tsx, JobDetailPage.tsx) ───
    console.log('\n── Phase 4: Jobs ──');
    await visitAndCheck(page, '/jobs', 'Jobs list page loads', async (p) => {
      // Should have a table or list
      await p.locator('table, [class*="list"], [class*="grid"]').first().waitFor({ timeout: 10000 }).catch(() => {});
    });

    // Try clicking into a job detail if data exists
    let jobDetailChecked = false;
    await step(page, 'Job detail page (JobDetailPage.tsx)', async () => {
      await page.goto(`${BASE}/jobs`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(800);

      const firstRow = page.locator('table tbody tr, [class*="row"], [class*="card"]').first();
      const hasRows = await firstRow.isVisible().catch(() => false);

      if (hasRows) {
        // JobsPage uses onRowClick → navigate(/jobs/:id), so click the row itself
        await firstRow.click();
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);

        if (page.url().includes('/login')) throw new Error('Redirected to login');

        // Check for Route/Cargo/Financial card sections from JobDetailPage
        const routeCard = page.locator('text=Route Details').first();
        const cargoCard = page.locator('text=Cargo Details').first();
        const financeCard = page.locator('text=Financials').first();

        let found = 0;
        if (await routeCard.isVisible().catch(() => false)) found++;
        if (await cargoCard.isVisible().catch(() => false)) found++;
        if (await financeCard.isVisible().catch(() => false)) found++;

        if (found >= 2) {
          jobDetailChecked = true;
        } else {
          // May have landed on detail but with different layout — check URL
          if (/\/jobs\/\d+/.test(page.url())) {
            jobDetailChecked = true;
          } else {
            throw new Error(`Navigated to ${page.url()} but expected /jobs/:id detail`);
          }
        }
      } else {
        // No data — just verify the page didn't crash
        const bodyText = await page.locator('body').innerText();
        if (bodyText.includes('Something went wrong')) throw new Error('Error boundary');
        console.log('    (no job data available for detail check)');
      }
    });

    // ─── 5. LR (LRListPage.tsx, CreateLRPage.tsx) ───
    console.log('\n── Phase 5: Lorry Receipts ──');
    await visitAndCheck(page, '/lr', 'LR list page loads', async (p) => {
      await p.locator('table, h1, h2').first().waitFor({ timeout: 10000 }).catch(() => {});
    });

    await visitAndCheck(page, '/lr/new', 'Create LR page loads', async (p) => {
      // Should have form fields
      const inputs = p.locator('input, select, textarea');
      const count = await inputs.count();
      if (count < 2) throw new Error('Too few form fields on Create LR page');
    });

    // ─── 6. Trips (TripsPage.tsx) ───
    console.log('\n── Phase 6: Trips ──');
    await visitAndCheck(page, '/trips', 'Trips page loads', async (p) => {
      await p.locator('table, h1, h2, [class*="trip"]').first().waitFor({ timeout: 10000 }).catch(() => {});
    });

    // ─── 7. Drivers (DriversPage.tsx, DriverDashboardPage.tsx, DriverTripsPage.tsx) ───
    console.log('\n── Phase 7: Drivers ──');
    await visitAndCheck(page, '/drivers', 'Drivers list page loads', async (p) => {
      await p.locator('table, h1, h2').first().waitFor({ timeout: 10000 }).catch(() => {});
    });

    await visitAndCheck(page, '/drivers/dashboard', 'Driver dashboard page loads');

    // ─── 8. Clients (ClientDetailPage.tsx) ───
    console.log('\n── Phase 8: Clients ──');
    await visitAndCheck(page, '/clients', 'Clients list page loads', async (p) => {
      await p.locator('table, h1, h2').first().waitFor({ timeout: 10000 }).catch(() => {});
    });

    // Try opening a client detail
    await step(page, 'Client detail page (ClientDetailPage.tsx)', async () => {
      await page.goto(`${BASE}/clients`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(800);

      const firstRow = page.locator('table tbody tr').first();
      const hasRows = await firstRow.isVisible().catch(() => false);

      if (hasRows) {
        const viewBtn = firstRow.locator('a, button[title="View"], button:has-text("View")').first();
        if (await viewBtn.count()) {
          await viewBtn.click();
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(1000);
          if (page.url().includes('/login')) throw new Error('Redirected to login');
          const bodyText = await page.locator('body').innerText();
          if (bodyText.includes('Something went wrong')) throw new Error('Error boundary');
        }
      }
      // Even if no data, page should be stable
    });

    // ─── 9. Finance / Invoices (InvoicesPage.tsx) ───
    console.log('\n── Phase 9: Finance ──');
    await visitAndCheck(page, '/finance/invoices', 'Invoices page loads');

    // ─── 10. Admin pages (EmployeesPage.tsx, AttendancePage.tsx) ───
    console.log('\n── Phase 10: Admin ──');
    await visitAndCheck(page, '/admin/employees', 'Employees page loads');
    await visitAndCheck(page, '/admin/attendance', 'Attendance page loads');

    // ─── 11. Profile (ProfilePage.tsx) ───
    console.log('\n── Phase 11: Profile ──');
    await visitAndCheck(page, '/profile', 'Profile page loads', async (p) => {
      // Should display user info
      await p.locator('input, h1, h2, text=/profile/i').first().waitFor({ timeout: 8000 }).catch(() => {});
    });

    // ─── 12. E-Way Bills (already validated earlier, quick re-check) ───
    console.log('\n── Phase 12: E-Way Bills (quick re-check) ──');
    await visitAndCheck(page, '/lr/eway-bill', 'E-Way Bill list page loads', async (p) => {
      await p.locator('h1:has-text("E-Way Bills")').first().waitFor({ timeout: 10000 });
    });

    // ─── 13. Quick cross-page nav smoke test (PAQuickActions) ───
    console.log('\n── Phase 13: Quick navigation smoke ──');
    for (const { route, label } of [
      { route: '/market-trips', label: 'Market Trips page' },
      { route: '/routes',       label: 'Routes page' },
      { route: '/suppliers',    label: 'Suppliers page' },
      { route: '/settings',     label: 'Settings page' },
    ]) {
      await visitAndCheck(page, route, label);
    }

    // ─── 14. Banking Module (Ajai's work) ───
    console.log('\n── Phase 14: Banking Module ──');
    await visitAndCheck(page, '/banking', 'Banking page loads (4-tab layout)', async (p) => {
      // Should render the tabbed banking interface
      await p.locator('text=/banking|transactions|reconciliation|accounts|overview/i').first().waitFor({ timeout: 10000 }).catch(() => {});
    });

    await visitAndCheck(page, '/finance/banking/new', 'New Banking Entry form loads', async (p) => {
      await p.locator('input, select, form, text=/entry|banking|amount/i').first().waitFor({ timeout: 8000 }).catch(() => {});
    });

    await visitAndCheck(page, '/accountant/banking', 'Accountant Banking view loads', async (p) => {
      await p.locator('text=/banking|ledger|entries|transactions/i').first().waitFor({ timeout: 8000 }).catch(() => {});
    });

    // ─── Summary ──────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(' RESULTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const total  = results.length;

    console.log(`\n  Total steps : ${total}`);
    console.log(`  Passed      : ${passed}`);
    console.log(`  Failed      : ${failed}`);
    console.log(`  JS errors   : ${jsErrors.length}`);

    if (failed > 0) {
      console.log('\n  ── Failed Steps ──');
      for (const r of results.filter(r => r.status === 'FAIL')) {
        console.log(`    [${r.step}] ${r.name}`);
        console.log(`        ${r.error}`);
      }
    }

    if (jsErrors.length > 0) {
      console.log('\n  ── JS Console Errors ──');
      for (const e of jsErrors.slice(0, 15)) {
        console.log(`    ${e.url}`);
        console.log(`      ${e.message.substring(0, 150)}`);
      }
    }

    // Write JSON report
    const reportPath = path.join(ARTIFACT_DIR, 'visual_check_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      mergedBranch: 'balan/safe-updates-20260319',
      loggedInAs,
      headless: HEADLESS,
      slowMo: SLOW_MO,
      summary: { total, passed, failed, jsErrors: jsErrors.length },
      steps: results,
      jsErrors,
    }, null, 2));
    console.log(`\n  Report: ${reportPath}`);
    console.log(`  Screenshots: ${ARTIFACT_DIR}/`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (failed > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
