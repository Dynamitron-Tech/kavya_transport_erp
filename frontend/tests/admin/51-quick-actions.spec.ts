import { test, expect } from '@playwright/test';
import { gotoAndReady } from '../setup/helpers';

test.describe('Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/dashboard');
  });

  test('Create LR opens LR form', async ({ page }) => {
    await page.getByRole('button', { name: /create lr/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/lr\/new/);
  });

  test('Generate E-way Bill opens LR eway workflow', async ({ page }) => {
    await page.getByRole('button', { name: /generate e-way bill/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/lr(\?.*action=eway.*)?/);
  });

  test('Create Trip opens trip flow', async ({ page }) => {
    await page.getByRole('button', { name: /create trip/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/trips(\?.*action=create.*)?/);
  });

  test('Upload Document opens upload workflow', async ({ page }) => {
    await page.getByRole('button', { name: /upload document/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/jobs(\?.*action=upload.*)?/);
  });

  test('Banking Entry opens finance payment flow', async ({ page }) => {
    await page.getByRole('button', { name: /banking entry/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/finance\/payments(\?.*action=create.*)?/);
  });
});
