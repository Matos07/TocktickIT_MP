import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    globalSetup: "./e2e/support/global-setup.ts",
    fullyParallel: false, // every scenario shares the real dev database
    workers: 1,
    retries: 0,
    timeout: 60_000,
    reporter: "list",
    use: {
        baseURL: "http://localhost:5173",
        trace: "on-first-retry",
    },
    webServer: [
        {
            command: "npm run dev",
            cwd: "./server",
            url: "http://localhost:3000/api/health",
            reuseExistingServer: true,
            timeout: 30_000,
        },
        {
            command: "npm run dev",
            cwd: "./client",
            url: "http://localhost:5173",
            reuseExistingServer: true,
            timeout: 30_000,
        },
    ],
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});