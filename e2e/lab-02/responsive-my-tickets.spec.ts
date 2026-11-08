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