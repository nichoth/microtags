import { defineConfig, devices } from '@playwright/test'

const PORT = 8899
const CI = Boolean(process.env.CI)

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: true,
    forbidOnly: CI,
    retries: CI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run build:hydration && npm run serve:hydration',
        url: `http://localhost:${PORT}/example-hydration/`,
        env: { PORT: String(PORT) },
        reuseExistingServer: !CI,
        timeout: 120_000,
    },
})
