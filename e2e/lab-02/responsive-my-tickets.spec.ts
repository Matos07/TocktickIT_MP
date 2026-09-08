import { test, expect, devices } from "@playwright/test";

const VIEWPORTS = {
    desktop: { width: 1280, height: 900 },
    tablet: { width: 820, height: 1180 },
    mobile: devices["iPhone 13"].viewport,
};

async function loginAsJennifer(page: import("@playwright/test").Page) {
    await page.goto("/select-requester");
    await page.getByLabel(/development requester/i).selectOption({ label: "Jennifer Anderson" });
    await page.getByRole("button", { name: /continue/i }).click();
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`My Tickets — ${name} screenshot`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await loginAsJennifer(page);
        await expect(page.getByRole("heading", { name: /my tickets/i })).toBeVisible();

        await page.screenshot({
            path: `artifacts/lab-02/screenshots/my-tickets/${name}.png`,
            fullPage: true,
        });
    });
}