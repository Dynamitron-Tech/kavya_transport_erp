import { test, expect } from '@playwright/test';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData, runPrimaryCreateFlow, assertMapPageHealthy } from '../setup/helpers';

test.describe('GPS Map', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/tracking/gps');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /gps|map/i);
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
      openButton: /add|new|create/i,
      prefix: 'GPS Map E2E',
    });

    await ensureListHasData(page);
  });

  test('status badges use valid backend values', async ({ page }) => {
    const invalidStatuses = 'created'.split('|');
    for (const invalid of invalidStatuses) {
      await expect(page.getByText(new RegExp('^' + invalid + '$', 'i'))).not.toBeVisible();
    }
  });
  test('map container is visible and no API key error appears', async ({ page }) => {
    await assertMapPageHealthy(page);
  });

});
