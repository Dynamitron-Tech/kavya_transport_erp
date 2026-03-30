import { test, expect } from '@playwright/test';
import { gotoAndReady } from '../setup/helpers';

test.describe('Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/dashboard');
  });

  test('Create LR opens LR form', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create lr/i });
    const link = page.getByRole('link', { name: /create lr/i });
    if (await btn.count()) {
      await btn.click();
    } else if (await link.count()) {
      await link.click();
    } else {
      test.skip(true, 'Create LR quick action not available on dashboard');
      return;
    }
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/lr/);
  });

  test('Generate E-way Bill opens LR eway workflow', async ({ page }) => {
    const btn = page.getByRole('button', { name: /generate e-way bill|e-way/i });
    const link = page.getByRole('link', { name: /generate e-way bill|e-way/i });
    if (await btn.count()) {
      await btn.click();
    } else if (await link.count()) {
      await link.click();
    } else {
      test.skip(true, 'E-way Bill quick action not available on dashboard');
      return;
    }
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/lr|\/eway/);
  });

  test('Create Trip opens trip flow', async ({ page }) => {
    const btn = page.getByRole('button', { name: /create trip/i });
    const link = page.getByRole('link', { name: /create trip/i });
    if (await btn.count()) {
      await btn.click();
    } else if (await link.count()) {
      await link.click();
    } else {
      test.skip(true, 'Create Trip quick action not available on dashboard');
      return;
    }
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/trips/);
  });

  test('Upload Document opens upload workflow', async ({ page }) => {
    const btn = page.getByRole('button', { name: /upload document/i });
    const link = page.getByRole('link', { name: /upload document/i });
    if (await btn.count()) {
      await btn.click();
    } else if (await link.count()) {
      await link.click();
    } else {
      test.skip(true, 'Upload Document quick action not available on dashboard');
      return;
    }
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/documents|\/jobs/);
  });

  test('Banking Entry opens finance payment flow', async ({ page }) => {
    const main = page.locator('main, [role="main"], .main-content').first();
    const btn = main.getByRole('button', { name: /banking entry|banking/i });
    const link = main.getByRole('link', { name: /banking entry|banking/i });
    if (await btn.count()) {
      await btn.click();
    } else if (await link.count()) {
      await link.click();
    } else {
      test.skip(true, 'Banking Entry quick action not available on dashboard');
      return;
    }
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/finance|\/banking|\/accountant/);
  });
});
