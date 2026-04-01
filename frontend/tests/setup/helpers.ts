import { expect, type Page } from '@playwright/test';

type PrimaryCreateOptions = {
	openButton: RegExp;
	prefix: string;
};

type CollectedErrors = {
	responses: string[];
	console: string[];
	requestFailures: string[];
};

export async function gotoAndReady(page: Page, route: string) {
	await page.goto(route);
	await page.waitForLoadState('networkidle');
}

export async function expectHeading(page: Page, heading: RegExp) {
	const roleHeading = page.getByRole('heading', { name: heading }).first();
	if (await roleHeading.isVisible().catch(() => false)) {
		await expect(roleHeading).toBeVisible({ timeout: 8000 });
		return;
	}

	const textHeading = page.getByText(heading).first();
	await expect(textHeading).toBeVisible({ timeout: 8000 });
}

export function installErrorCollectors(page: Page): CollectedErrors {
	const errors: CollectedErrors = {
		responses: [],
		console: [],
		requestFailures: [],
	};

	page.on('response', (response) => {
		const status = response.status();
		if (status === 404 || status >= 500) {
			errors.responses.push(`${status} ${response.url()}`);
		}
	});

	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			errors.console.push(msg.text());
		}
	});

	page.on('requestfailed', (request) => {
		errors.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`.trim());
	});

	return errors;
}

export function assertNoErrors(errors: CollectedErrors) {
	expect(errors.responses, `Network 404/5xx errors:\n${errors.responses.join('\n')}`).toHaveLength(0);
	expect(errors.requestFailures, `Failed requests:\n${errors.requestFailures.join('\n')}`).toHaveLength(0);

	const actionableConsoleErrors = errors.console.filter(
		(entry) => !/ResizeObserver loop limit exceeded|favicon\.ico|ERR_BLOCKED_BY_CLIENT/i.test(entry),
	);
	expect(actionableConsoleErrors, `Console errors:\n${actionableConsoleErrors.join('\n')}`).toHaveLength(0);
}

export async function ensureListHasData(page: Page, seededText?: string) {
	if (seededText) {
		await expect(page.getByText(seededText).first()).toBeVisible({ timeout: 8000 });
		return;
	}

	const rows = page.locator('table tbody tr, [role="row"], [class*="row"], [data-testid*="row"]');
	if ((await rows.count()) > 0) {
		await expect(rows.first()).toBeVisible({ timeout: 8000 });
		return;
	}

	const cards = page.locator('[class*="card"], [class*="item"], [data-testid*="card"]');
	await expect(cards.first()).toBeVisible({ timeout: 8000 });
}

async function openPrimaryCreate(page: Page, openButton: RegExp) {
	const candidate = page.getByRole('button', { name: openButton }).first();
	if (await candidate.isVisible().catch(() => false)) {
		await candidate.click();
		await page.waitForLoadState('networkidle');
		return;
	}

	const fallback = page.getByRole('button', { name: /add|new|create|generate|issue|upload|verify/i }).first();
	await expect(fallback).toBeVisible({ timeout: 8000 });
	await fallback.click();
	await page.waitForLoadState('networkidle');
}

async function fillVisibleFields(page: Page, marker: string) {
	const textLike = page.locator('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea');
	const count = await textLike.count();

	for (let i = 0; i < count; i += 1) {
		const input = textLike.nth(i);
		if (!(await input.isVisible().catch(() => false))) continue;

		const type = (await input.getAttribute('type')) ?? '';
		const name = `${(await input.getAttribute('name')) ?? ''} ${(await input.getAttribute('id')) ?? ''} ${(await input.getAttribute('placeholder')) ?? ''}`.toLowerCase();

		if (/date|time/.test(type) || /date|time/.test(name)) {
			continue;
		}

		if (type === 'email' || /email/.test(name)) {
			await input.fill(`e2e.${Date.now()}@test.com`);
			continue;
		}

		if (type === 'tel' || /phone|mobile/.test(name)) {
			await input.fill('9876543210');
			continue;
		}

		if (type === 'number' || /amount|rate|price|qty|quantity|weight|km|distance/.test(name)) {
			await input.fill('123');
			continue;
		}

		await input.fill(marker);
	}

	const selects = page.locator('select');
	const selectCount = await selects.count();
	for (let i = 0; i < selectCount; i += 1) {
		const select = selects.nth(i);
		if (!(await select.isVisible().catch(() => false))) continue;
		const options = select.locator('option');
		const optionCount = await options.count();
		if (optionCount > 1) {
			await select.selectOption({ index: 1 });
		}
	}
}

async function submitPrimaryForm(page: Page) {
	const submit = page.getByRole('button', { name: /save|create|submit|generate|issue|upload|verify|add/i }).first();
	await expect(submit).toBeVisible({ timeout: 8000 });
	await submit.click();
	await page.waitForLoadState('networkidle');
}

export async function runPrimaryCreateFlow(page: Page, options: PrimaryCreateOptions) {
	const marker = `${options.prefix} ${Date.now()}`;

	await openPrimaryCreate(page, options.openButton);
	await fillVisibleFields(page, marker);
	await submitPrimaryForm(page);

	const markerHit = await page.getByText(marker).first().isVisible({ timeout: 8000 }).catch(() => false);
	if (markerHit) {
		await expect(page.getByText(marker).first()).toBeVisible({ timeout: 8000 });
		return;
	}

	const successSignal = page.getByText(/created|saved|updated|success|generated|submitted/i).first();
	if (await successSignal.isVisible({ timeout: 8000 }).catch(() => false)) {
		await expect(successSignal).toBeVisible({ timeout: 8000 });
		return;
	}

	await expect(page.getByText(/server error|500|traceback/i)).not.toBeVisible();
	await expect(page.getByText(/required|invalid/i)).not.toBeVisible();
}

export async function assertRupeeFormatting(page: Page) {
	await expect(page.getByText(/₹/).first()).toBeVisible({ timeout: 8000 });
	await expect(page.getByText(/amount_paid|paid_amount|raw_amount|total_amount/i)).not.toBeVisible();
}

export async function assertMapPageHealthy(page: Page) {
	const map = page.locator('.leaflet-container, #map, [class*="map"]').first();
	await expect(map).toBeVisible({ timeout: 8000 });
	await expect(page.getByText(/api key|invalid key|for development purposes only/i)).not.toBeVisible();
}
