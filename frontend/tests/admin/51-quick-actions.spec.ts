import { test, expect } from '@playwright/test';
import { gotoAndReady } from '../setup/helpers';

test.describe('Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/dashboard');
  });

  test('Create LR opens LR form', async ({ page }) => {
    await page.getByRole('button', { name: /create lr/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/operations/);
    await expect(page).not.toHaveURL(/create-job|jobs\/create/);
    await expect(page).toHaveURL(/\/lr(\/new)?/);
    await expect(page.getByRole('heading', { name: /lorry receipt|create lr|lr/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('Generate E-way Bill opens LR eway workflow', async ({ page }) => {
    await page.getByRole('button', { name: /generate e-way bill/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/lr\/eway-bill/);
    await expect(page.getByRole('heading', { name: /e-way bill|eway/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('Create Trip opens trip flow', async ({ page }) => {
    await page.getByRole('button', { name: /create trip/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/create-job|jobs\/create/);
    await expect(page).toHaveURL(/\/trips(\/new)?/);
    await expect(page.getByRole('heading', { name: /create trip|trip/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('Upload Document opens upload workflow', async ({ page }) => {
    await page.getByRole('button', { name: /upload document/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/eway-bill|ewb/);
    await expect(page).toHaveURL(/\/documents\/(upload|new-upload)/);
    await expect(page.getByRole('heading', { name: /upload|document/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('Banking Entry opens finance payment flow', async ({ page }) => {
    await page.getByRole('button', { name: /banking entry/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/finance\/(payments|banking\/new)|\/banking/);
    await expect(page.getByRole('heading', { name: /banking/i }).first()).toBeVisible({ timeout: 8000 });
  });
});
