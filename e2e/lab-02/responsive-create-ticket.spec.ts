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
    test(`Create Ticket — ${name} screenshot`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await loginAsJennifer(page);
        await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
        await expect(page.getByLabel(/category/i)).toBeVisible();

        await page.screenshot({
            path: `artifacts/lab-02/screenshots/create-ticket/${name}.png`,
            fullPage: true,
        });
    });
}