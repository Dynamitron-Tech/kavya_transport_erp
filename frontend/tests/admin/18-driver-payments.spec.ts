import { test, expect } from '@playwright/test';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData, runPrimaryCreateFlow, assertRupeeFormatting } from '../setup/helpers';

test.describe('Driver Payments', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/accountant/payments');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /payment/i);
  });

  test('no 404 or 500 network errors and no console errors', async ({ page }) => {
    const errors = installErrorCollectors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    assertNoErrors(errors);
  });

  test('list loads with data', async ({ page }) => {
    await ensureListHasData(page);
  });

  test('primary create action works end to end', async ({ page }) => {
    await runPrimaryCreateFlow(page, {
      openButton: /add payment|new payment|create payment/i,
      prefix: 'Driver Payments E2E',
    });

    await ensureListHasData(page);
  });

  test('status badges use valid backend values', async ({ page }) => {
    const invalidStatuses = 'created'.split('|');
    for (const invalid of invalidStatuses) {
      await expect(page.getByText(new RegExp('^' + invalid + '$', 'i'))).not.toBeVisible();
    }
  });
  test('amounts use Indian rupee formatting', async ({ page }) => {
    await assertRupeeFormatting(page);
  });

});
