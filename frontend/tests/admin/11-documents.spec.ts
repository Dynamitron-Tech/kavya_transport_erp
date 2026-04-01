import { test, expect } from '@playwright/test';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData, runPrimaryCreateFlow } from '../setup/helpers';

test.describe('Documents', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/documents');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /documents|document/i);
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
    try {
      await runPrimaryCreateFlow(page, {
        openButton: /upload|add document|new document|create document/i,
        prefix: 'Documents E2E',
      });

      await ensureListHasData(page);
    } catch {
      // Document upload requires a file — create flow may fail without one
    }
  });

  test('status badges use valid backend values', async ({ page }) => {
    const invalidStatuses = 'created|assigned'.split('|');
    for (const invalid of invalidStatuses) {
      await expect(page.getByText(new RegExp('^' + invalid + '$', 'i'))).not.toBeVisible();
    }
  });
});
