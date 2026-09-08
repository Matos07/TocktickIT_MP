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
    test(`Ticket Detail — ${name} screenshot`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await loginAsJennifer(page);

        // Create a fresh ticket so there's always at least one Detail screen to capture.
        await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
        await page.locator("#category").selectOption({ label: "Hardware" });
        await expect(page.locator("#category")).not.toHaveValue("");

        await page.locator("#related-system").selectOption({ label: "Corporate Laptop" });
        await expect(page.locator("#related-system")).not.toHaveValue("");
        await page.getByLabel(/summary/i).fill(`Responsive screenshot ticket ${name}`);
        await page.getByLabel(/description/i).fill("Ticket created solely to capture a Ticket Detail screenshot.");
        await page.getByLabel(/requested priority/i).selectOption("LOW");
        await page.getByRole("button", { name: /submit/i }).click();
        await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10_000 });

        await page.getByRole("link", { name: /my tickets/i }).click();
        await page.getByLabel(/search/i).fill(`Responsive screenshot ticket ${name}`);
        await page.getByText(/TKT-\d{4}-\d{6}/).first().click();
        await expect(page.getByLabel(/^summary$/i)).toBeVisible();

        await page.screenshot({
            path: `artifacts/lab-02/screenshots/ticket-detail/${name}.png`,
            fullPage: true,
        });
    });
}