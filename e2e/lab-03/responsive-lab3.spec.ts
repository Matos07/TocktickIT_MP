import { test, expect, devices, Page } from "@playwright/test";
import { accounts } from "../support/accounts.js";
import { createTicketViaApi } from "../support/api.js";
import { loginAs, newSession } from "../support/auth.js";
import { shot } from "../support/screenshots.js";

const VIEWPORTS = {
    desktop: { width: 1280, height: 900 },
    tablet: { width: 820, height: 1180 },
    mobile: devices["iPhone 13"].viewport,
};

// AC-22: nothing may make the page itself scroll sideways.
async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "the page must not scroll horizontally").toBeLessThanOrEqual(0);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`Lab 3 screens, ${name}`, () => {
        test.use({ viewport });

        test("Login", async ({ page }) => {
            await page.goto("/login");
            await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
            await shot(page, `authentication/login-${name}`);
            await expectNoHorizontalOverflow(page);
        });

        test("Change Password", async ({ page }) => {
            await loginAs(page, accounts.firstLoginShots.email);
            await expect(page.getByRole("heading", { name: "Change Your Password" })).toBeVisible();
            await shot(page, `authentication/change-password-${name}`);
            await expectNoHorizontalOverflow(page);
        });

        test("Ticket Queue", async ({ page }) => {
            await loginAs(page, accounts.staff.email);
            await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
            await expect(page.getByRole("link", { name: /^TKT-/ }).first()).toBeVisible();
            await shot(page, `staff-queue/${name}`);
            await expectNoHorizontalOverflow(page);
        });

        test("Staff Ticket Detail", async ({ page, browser }) => {
            const requester = await newSession(browser, accounts.requester.email);
            const ticket = await createTicketViaApi(requester, `E2E responsive detail ${name} ${Date.now()}`);

            await loginAs(page, accounts.staff.email);
            await page.request.post(`http://localhost:3000/api/tickets/${ticket.id}/comments`, {
                data: { content: "A public comment, visible to the requester." },
            });
            await page.request.post(`http://localhost:3000/api/tickets/${ticket.id}/internal-notes`, {
                data: { content: "An internal note, visible to staff only." },
            });

            await page.goto(`/staff/tickets/${ticket.id}`);
            await expect(page.getByText("An internal note, visible to staff only.")).toBeVisible();
            await expect(page.getByText("A public comment, visible to the requester.")).toBeVisible();
            await shot(page, `staff-ticket-detail/${name}`);
            await expectNoHorizontalOverflow(page);
        });

        test("User Management", async ({ page }) => {
            await loginAs(page, accounts.admin.email);
            await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
            await page.getByLabel("Search").fill("E2E"); // the dev database holds hundreds of throwaway accounts
            await expect(page.getByText(accounts.admin.email)).toBeVisible();
            await page.getByRole("button", { name: "Create User" }).click();
            await expect(page.getByRole("heading", { name: "Create New User" })).toBeVisible();
            await shot(page, `user-management/${name}`);
            await expectNoHorizontalOverflow(page);
        });
    });
}