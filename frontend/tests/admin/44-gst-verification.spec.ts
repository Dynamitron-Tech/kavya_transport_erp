import { test, expect } from '@playwright/test';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData, runPrimaryCreateFlow } from '../setup/helpers';

test.describe('GST Verification', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/fleet/gst-verify');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /gst|verification/i);
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
      openButton: /verify|new|create/i,
      prefix: 'GST Verification E2E',
    });

    await ensureListHasData(page);
  });

  test('status badges use valid backend values', async ({ page }) => {
    const invalidStatuses = 'created'.split('|');
    for (const invalid of invalidStatuses) {
      await expect(page.getByText(new RegExp('^' + invalid + '$', 'i'))).not.toBeVisible();
    }
  });
  test('VAHAN / Sarathi verify controls are visible and show spinner on verify', async ({ page }) => {
    const verifyButton = page.getByRole('button', { name: /verify|vahan|sarathi/i }).first();
    await expect(verifyButton).toBeVisible({ timeout: 8000 });
    await verifyButton.click();
    const spinner = page.locator('.animate-spin, [role="progressbar"], text=/verifying|processing/i').first();
    await expect(spinner).toBeVisible({ timeout: 8000 });
  });

});
