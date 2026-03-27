import { test as setup, expect } from '@playwright/test';
import { ADMIN } from './test-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authDir = path.join(__dirname, '.auth');
const authFile = path.join(authDir, 'admin.json');

setup('authenticate as admin', async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const email = page.locator('input[type="email"]').first();
  const password = page.locator('input[type="password"]').first();

  await expect(email).toBeVisible({ timeout: 8000 });
  await expect(password).toBeVisible({ timeout: 8000 });

  await email.fill(ADMIN.email);
  await password.fill(ADMIN.password);

  await page.getByRole('button', { name: /sign in|login/i }).first().click();

  await page.waitForURL(/\/dashboard|\/accountant|\/fleet|\/pump/i, { timeout: 10000 });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: authFile });
});
