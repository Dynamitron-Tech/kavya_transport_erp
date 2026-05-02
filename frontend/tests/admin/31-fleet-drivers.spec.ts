import { test, expect } from '@playwright/test';
import { TEST } from '../setup/test-data';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData, runPrimaryCreateFlow } from '../setup/helpers';

test.describe('Fleet Drivers', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/fleet/drivers');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /driver/i);
  });

  test('no 404 or 500 network errors and no console errors', async ({ page }) => {
    const errors = installErrorCollectors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    assertNoErrors(errors);
  });

  test('list loads with data', async ({ page }) => {
    await ensureListHasData(page, TEST.driverName);
  });

  test('primary create action works end to end', async ({ page }) => {
    await runPrimaryCreateFlow(page, {
      openButton: /add driver|new driver|create driver/i,
      prefix: 'Fleet Drivers E2E',
    });

    await ensureListHasData(page);
  });

  test('status badges use valid backend values', async ({ page }) => {
    const invalidStatuses = 'idle'.split('|');
    for (const invalid of invalidStatuses) {
      await expect(page.getByText(new RegExp('^' + invalid + '$', 'i'))).not.toBeVisible();
    }
  });
});
