import { test, expect } from '@playwright/test';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData, runPrimaryCreateFlow, assertRupeeFormatting } from '../setup/helpers';

test.describe('Finance Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/finance/alerts');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /alert/i);
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
      openButton: /create alert|new alert|add alert/i,
      prefix: 'Finance Alerts E2E',
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
