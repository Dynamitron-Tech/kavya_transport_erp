import { test, expect } from '@playwright/test';
import { gotoAndReady, installErrorCollectors, assertNoErrors } from '../setup/helpers';

test.describe('Profile', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/profile');
  });

  test('profile page loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /profile/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('admin name is displayed', async ({ page }) => {
    await expect(page.getByText(/kavya|admin/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('role badge shows Admin only', async ({ page }) => {
    await expect(page.getByText(/admin/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/driver|fleet manager|accountant|pump operator/i)).not.toBeVisible();
  });

  test('no 404/500 network and no console errors', async ({ page }) => {
    const errors = installErrorCollectors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    assertNoErrors(errors);
  });
});
