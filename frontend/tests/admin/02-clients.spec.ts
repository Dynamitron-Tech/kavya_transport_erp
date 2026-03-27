import { test, expect } from '@playwright/test';
import { TEST } from '../setup/test-data';
import { gotoAndReady, expectHeading, installErrorCollectors, assertNoErrors, ensureListHasData } from '../setup/helpers';

test.describe('Clients', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndReady(page, '/clients');
  });

  test('page heading is visible after load', async ({ page }) => {
    await expectHeading(page, /clients/i);
  });

  test('no 404 or 500 network errors and no console errors', async ({ page }) => {
    const errors = installErrorCollectors(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    assertNoErrors(errors);
  });

  test('list loads with data', async ({ page }) => {
    await ensureListHasData(page, TEST.clientName);
  });

  test('primary create action works end to end', async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const clientName = `Clients E2E ${stamp}`;

    await page.getByRole('button', { name: /add client|new client|create client/i }).first().click();
    await expect(page.getByRole('heading', { name: /add new client|create client/i })).toBeVisible({ timeout: 8000 });

    const modal = page.locator('div.fixed.inset-0.z-50').first();
    await expect(modal).toBeVisible({ timeout: 8000 });

    await modal.locator('input[placeholder="Enter client name"]').fill(clientName);
    await modal.locator('input[placeholder*="CLI"]').fill(`CLI${stamp}`);

    const typeSelect = modal.locator('select').first();
    if (await typeSelect.count()) {
      await typeSelect.selectOption({ label: 'Corporate' }).catch(async () => {
        await typeSelect.selectOption({ index: 1 });
      });
    }

    await modal.locator('input[placeholder="22AAAAA0000A1Z5"]').fill('33ABCDE1234F1Z5');
    await modal.locator('input[placeholder="client@example.com"]').fill(`e2e${stamp}@test.com`);
    await modal.locator('input[placeholder*="98765"]').fill('9876543210');
    await modal.locator('textarea[placeholder="Enter address"]').fill(`E2E Address ${stamp}`);
    await modal.locator('input[placeholder="City"]').fill('Chennai');
    await modal.locator('input[placeholder="State"]').fill('Tamil Nadu');
    await modal.locator('input[placeholder="560001"]').fill('600001');

    const creditLimit = modal.locator('input').filter({ hasText: '' }).nth(8);
    if (await creditLimit.count()) {
      await creditLimit.fill('100000');
    }

    const creditDays = modal.locator('input').filter({ hasText: '' }).nth(9);
    if (await creditDays.count()) {
      await creditDays.fill('30');
    }

    const createResponse = page.waitForResponse(
      (response) => response.url().includes('/api/v1/clients') && response.request().method() === 'POST',
      { timeout: 10000 }
    );

    const submitButton = modal.getByRole('button', { name: /create client|save|submit/i }).first();
    await expect(submitButton).toBeEnabled({ timeout: 8000 });
    await submitButton.click();
    await createResponse;

    await expect(page.getByRole('heading', { name: /add new client|create client/i })).not.toBeVisible({ timeout: 8000 });
    await ensureListHasData(page, clientName);
  });

  test('status badges use valid backend values', async ({ page }) => {
    const invalidStatuses = 'created|assigned'.split('|');
    for (const invalid of invalidStatuses) {
      await expect(page.getByText(new RegExp('^' + invalid + '$', 'i'))).not.toBeVisible();
    }
  });
});
