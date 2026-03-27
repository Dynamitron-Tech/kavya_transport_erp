import { test, expect } from '@playwright/test';
import { TEST } from '../setup/test-data';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData } from '../setup/helpers';

test.describe('Jobs / Orders', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/jobs');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /jobs|orders/i);
  });

  test('no 404 or 500 network errors and no console errors', async ({ page }) => {
    const errors = installErrorCollectors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    assertNoErrors(errors);
  });

  test('list loads with data', async ({ page }) => {
    await ensureListHasData(page, TEST.jobNumber);
  });

  test('primary create action works end to end', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);

    await page.goto('/jobs/new');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /create new job|create job/i })).toBeVisible({ timeout: 8000 });

    // Step 1: select client
    const clientSearch = page.locator('input[placeholder="Search clients..."]').first();
    await clientSearch.fill(TEST.clientName);

    const clientOption = page.locator('div.absolute.z-50 button').filter({ hasText: TEST.clientName }).first();
    if (await clientOption.count()) {
      await clientOption.click();
    } else {
      await page.locator('div.absolute.z-50 button').first().click();
    }

    await page.getByRole('button', { name: /next/i }).click();

    // Step 2: fill route fields
    const addressInputs = page.locator('input[placeholder="Street address"]');
    await addressInputs.nth(0).fill(`Origin Address ${stamp}`);
    await addressInputs.nth(1).fill(`Destination Address ${stamp}`);

    const cityInputs = page.locator('input[placeholder="City"]');
    await cityInputs.nth(0).fill('Chennai');
    await cityInputs.nth(1).fill('Coimbatore');

    await page.getByRole('button', { name: /next/i }).click();

    // Step 3: fill required datetime values
    const pickupInput = page.locator('input[type="datetime-local"]').first();
    const deliveryInput = page.locator('input[type="datetime-local"]').nth(1);
    await pickupInput.fill('2026-03-27T10:30');
    await deliveryInput.fill('2026-03-28T16:30');

    // Step 3 -> Step 4
    await page.getByRole('button', { name: /next/i }).click();

    const createResponse = page.waitForResponse(
      (response) => response.url().includes('/api/v1/jobs') && response.request().method() === 'POST',
      { timeout: 12000 }
    );

    await page.getByRole('button', { name: /save as draft/i }).click();
    const response = await createResponse;
    expect(response.ok()).toBeTruthy();

    await expect(page.getByText(/saved as draft|submitted for approval/i)).toBeVisible({ timeout: 8000 });

    if (!/\/jobs$/.test(page.url())) {
      await page.goto('/jobs');
      await page.waitForLoadState('networkidle');
    }

    await ensureListHasData(page);
  });

  test('status badges use valid backend values', async ({ page }) => {
    const invalidStatuses = 'created|assigned'.split('|');
    for (const invalid of invalidStatuses) {
      await expect(page.getByText(new RegExp('^' + invalid + '$', 'i'))).not.toBeVisible();
    }
  });
});
