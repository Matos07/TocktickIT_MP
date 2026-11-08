import { test, expect, devices } from "@playwright/test";
import { accounts } from "../support/accounts.js";
import { loginAs } from "../support/auth.js";

const VIEWPORTS = {
    desktop: { width: 1280, height: 900 },
    tablet: { width: 820, height: 1180 },
    mobile: devices["iPhone 13"].viewport,
};

const loginAsJennifer = (page: import("@playwright/test").Page) => loginAs(page, accounts.requester.email);

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