import { expect, type Locator, type Page } from '@playwright/test';

export type CollectedErrors = {
  network: string[];
  console: string[];
};

export function installErrorCollectors(page: Page): CollectedErrors {
  const errors: CollectedErrors = { network: [], console: [] };

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      errors.network.push(`${status} ${response.url()}`);
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.console.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    errors.console.push(err.message);
  });

  return errors;
}

export async function gotoAndReady(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
}

export async function expectHeading(page: Page, pattern: RegExp): Promise<void> {
  const heading = page.getByRole('heading', { name: pattern }).first();
  const fallback = page.locator('h1, h2').filter({ hasText: pattern }).first();

  if (await heading.count()) {
    await expect(heading).toBeVisible({ timeout: 8000 });
    return;
  }

  await expect(fallback).toBeVisible({ timeout: 8000 });
}

export function assertNoErrors(errors: CollectedErrors): void {
  expect(
    errors.network,
    `Network errors detected:\n${errors.network.join('\n')}`
  ).toEqual([]);

  expect(
    errors.console,
    `Console errors detected:\n${errors.console.join('\n')}`
  ).toEqual([]);
}

export async function ensureListHasData(page: Page, seededText?: string): Promise<void> {
  if (seededText) {
    const seeded = page.getByText(seededText, { exact: false }).first();
    if (await seeded.count()) {
      await expect(seeded).toBeVisible({ timeout: 8000 });
      return;
    }
  }

  const tableRow = page.locator('table tbody tr').first();
  if (await tableRow.count()) {
    await expect(tableRow).toBeVisible({ timeout: 8000 });
    return;
  }

  const cards = page.locator('[class*="card"], [class*="row"], [data-testid*="item"], [data-testid*="list"]');
  await expect(cards.first()).toBeVisible({ timeout: 8000 });
}

async function firstVisible(locator: Locator): Promise<Locator | null> {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    if (await item.isVisible()) {
      return item;
    }
  }
  return null;
}

export async function runPrimaryCreateFlow(
  page: Page,
  options?: {
    openButton?: RegExp;
    submitButton?: RegExp;
    prefix?: string;
  }
): Promise<string> {
  const stamp = Date.now().toString().slice(-6);
  const unique = `${options?.prefix ?? 'E2E Record'} ${stamp}`;

  let open = await firstVisible(
    page.getByRole('button', {
      name: options?.openButton ?? /add|new|create|generate|upload|entry|record/i,
    })
  );

  if (!open) {
    open = await firstVisible(
      page.getByRole('link', {
        name: options?.openButton ?? /add|new|create|generate|upload|entry|record/i,
      })
    );
  }

  if (!open) {
    const current = page.url();
    if (current.includes('/jobs')) {
      await page.goto('/jobs/new');
      await page.waitForLoadState('networkidle');
    } else if (current.includes('/trips')) {
      await page.goto('/trips/new');
      await page.waitForLoadState('networkidle');
    } else if (current.includes('/lr')) {
      await page.goto('/lr/new');
      await page.waitForLoadState('networkidle');
    } else if (current.includes('/documents')) {
      await page.goto('/documents/upload');
      await page.waitForLoadState('networkidle');
    }
  } else {
    await open.click();
    await page.waitForLoadState('networkidle');
  }

  const modal = page.locator('div.fixed.inset-0.z-50').last();
  const useModal = await modal.isVisible().catch(() => false);
  const scope: Page | Locator = useModal ? modal : page;

  const inputs = scope.locator('input:not([type="hidden"]):not([disabled])');
  const inputCount = await inputs.count();

  for (let i = 0; i < inputCount; i += 1) {
    const input = inputs.nth(i);
    if (!(await input.isVisible())) continue;

    const type = (await input.getAttribute('type')) ?? 'text';
    if (['submit', 'button', 'checkbox', 'radio', 'file'].includes(type)) continue;

    const placeholder = ((await input.getAttribute('placeholder')) ?? '').toLowerCase();
    const name = ((await input.getAttribute('name')) ?? '').toLowerCase();

    if (type === 'email' || placeholder.includes('email') || name.includes('email')) {
      await input.fill(`e2e${stamp}@test.com`);
      continue;
    }

    if (type === 'tel' || placeholder.includes('phone') || name.includes('phone')) {
      await input.fill('9876543210');
      continue;
    }

    if (type === 'number') {
      await input.fill('100');
      continue;
    }

    if (type === 'date') {
      await input.fill('2026-03-27');
      continue;
    }

    if (type === 'datetime-local') {
      await input.fill('2026-03-27T10:30');
      continue;
    }

    if (placeholder.includes('gstin')) {
      await input.fill('33ABCDE1234F1Z5');
      continue;
    }

    if (placeholder.includes('pincode') || name.includes('pincode')) {
      await input.fill('600001');
      continue;
    }

    if (placeholder.includes('code') || name.includes('code')) {
      await input.fill(`E2E${stamp}`);
      continue;
    }

    await input.fill(unique);
  }

  const selects = scope.locator('select:not([disabled])');
  const selectCount = await selects.count();

  for (let i = 0; i < selectCount; i += 1) {
    const select = selects.nth(i);
    if (!(await select.isVisible())) continue;

    const optionsData = await select.locator('option').evaluateAll((opts) =>
      opts.map((opt) => ({
        value: opt.getAttribute('value') ?? '',
      }))
    );

    const usable = optionsData.find((opt) => opt.value !== '');
    if (usable) {
      await select.selectOption(usable.value);
    }
  }

  const textareas = scope.locator('textarea:not([disabled])');
  const textareasCount = await textareas.count();
  for (let i = 0; i < textareasCount; i += 1) {
    const area = textareas.nth(i);
    if (await area.isVisible()) {
      await area.fill(`${unique} notes`);
    }
  }

  const submit = await firstVisible(
    scope.getByRole('button', {
      name: options?.submitButton ?? /save|create|submit|generate|add|upload|send|done|next/i,
    })
  );

  expect(submit, 'Submit button was not found').not.toBeNull();
  await submit!.click();
  await page.waitForLoadState('networkidle');

  await expect(page.getByText(/server error|traceback/i)).not.toBeVisible();

  return unique;
}

export async function assertRupeeFormatting(page: Page): Promise<void> {
  await expect(page.getByText(/₹/).first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/amount_paid|paid_amount|total_amount_paise/i)).not.toBeVisible();
}

export async function assertMapPageHealthy(page: Page): Promise<void> {
  const map = page.locator('.leaflet-container, [id*="map"], [class*="map"]').first();
  await expect(map).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/api key|invalid key|for development purposes only|map error/i)).not.toBeVisible();
}
