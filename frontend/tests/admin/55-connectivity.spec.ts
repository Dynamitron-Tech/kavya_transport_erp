import { test, expect } from '@playwright/test';
import { gotoAndReady, installErrorCollectors, assertNoErrors } from '../setup/helpers';

test.describe('Connectivity / System Health', () => {
  test('health check page loads', async ({ page }) => {
    await gotoAndReady(page, '/admin/connectivity');
    await expect(page.getByRole('heading', { name: /connectivity|audit|health/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('PostgreSQL shows connected section', async ({ page }) => {
    await gotoAndReady(page, '/admin/connectivity');
    await expect(page.getByText(/database status|postgres/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('backend health endpoint returns 200', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('no 404/500 network and no console errors', async ({ page }) => {
    await gotoAndReady(page, '/admin/connectivity');
    const errors = installErrorCollectors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    assertNoErrors(errors);
  });
});
