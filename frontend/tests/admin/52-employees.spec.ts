import { test, expect } from '@playwright/test';
import { TEST } from '../setup/test-data';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData, runPrimaryCreateFlow } from '../setup/helpers';

test.describe('Employees', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/admin/employees');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /employees?/i);
  });

  test('no 404 or 500 network errors and no console errors', async ({ page }) => {
    const errors = installErrorCollectors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    assertNoErrors(errors);
  });

  test('list loads with data', async ({ page }) => {
    await ensureListHasData(page, TEST.employeeName);
  });

  test('primary create action works end to end', async ({ page }) => {
    await runPrimaryCreateFlow(page, {
      openButton: /add employee|new employee|create employee/i,
      prefix: 'Employees E2E',
    });

    await ensureListHasData(page);
  });

  test('status badges use valid backend values', async ({ page }) => {
    const invalidStatuses = 'created'.split('|');
    for (const invalid of invalidStatuses) {
      await expect(page.getByText(new RegExp('^' + invalid + '$', 'i'))).not.toBeVisible();
    }
  });
});
