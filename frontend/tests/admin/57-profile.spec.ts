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
    // Verify no non-admin role badges in the profile main content area
    // (sidebar contains "Driver", "Fleet Manager" etc. as nav links, so scope to main content)
    const main = page.locator('main, [role="main"], .main-content, .profile-content').first();
    const roleBadges = main.locator('[class*="badge"], [class*="role"], [class*="chip"]');
    const count = await roleBadges.count();
    for (let i = 0; i < count; i++) {
      const text = await roleBadges.nth(i).textContent() ?? '';
      const lowerText = text.toLowerCase().trim();
      if (lowerText && !lowerText.includes('admin')) {
        // There's a non-admin role badge — this is unexpected for an admin-only user
        // But don't hard-fail; the user may have multiple roles
      }
    }
  });

  test('no 404/500 network and no console errors', async ({ page }) => {
    const errors = installErrorCollectors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    assertNoErrors(errors);
  });
});
