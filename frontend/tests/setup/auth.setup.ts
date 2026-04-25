import { test as setup, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { ADMIN } from './test-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
	await page.goto('/login');
	await page.waitForLoadState('networkidle');

	const emailInput = page
		.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
		.first();
	const passwordInput = page
		.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]')
		.first();

	await expect(emailInput).toBeVisible({ timeout: 8000 });
	await expect(passwordInput).toBeVisible({ timeout: 8000 });

	await emailInput.fill(ADMIN.email);
	await passwordInput.fill(ADMIN.password);

	await page.getByRole('button', { name: /sign in|login/i }).click();

	await page.waitForURL('**/dashboard', { timeout: 10000 });
	await expect(page).toHaveURL(/dashboard/);

	await page.context().storageState({ path: authFile });
});
