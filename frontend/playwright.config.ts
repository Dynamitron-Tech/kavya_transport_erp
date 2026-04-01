import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [
		['html', { outputFolder: 'playwright-report', open: 'always' }],
		['list'],
	],
	use: {
		baseURL: 'http://localhost:3000',
		headless: false,
		slowMo: 600,
		screenshot: 'on',
		video: 'on',
		trace: 'on',
		viewport: { width: 1440, height: 900 },
		storageState: 'tests/setup/.auth/admin.json',
	},
	projects: [
		{
			name: 'admin-auth-setup',
			testMatch: '**/setup/auth.setup.ts',
		},
		{
			name: 'admin-tests',
			dependencies: ['admin-auth-setup'],
			testMatch: '**/admin/**/*.spec.ts',
		},
	],
});
