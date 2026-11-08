import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";
import { accounts } from "../support/accounts.js";
import { createTicketViaApi } from "../support/api.js";
import { loginAs, logout } from "../support/auth.js";

// Minimal valid 1x1 PNG, generated at test time: no binary fixture to check in.
const PNG_BYTES = Buffer.from(
    "89504e470d0a1a0a0000000d494844520000000100000001080600000" +
    "01f15c4890000000a49444154789c6360000002000155bce87e0000000049454e44ae426082",
    "hex"
);

function writeTempPng(name: string): string {
    const filePath = path.join(os.tmpdir(), name);
    fs.writeFileSync(filePath, PNG_BYTES);
    return filePath;
}

test.describe("Requester ticket flow (E2E-01)", () => {
    test("log in → create ticket with attachment → find in My Tickets → open Detail", async ({ page }) => {
        const uniqueSummary = `E2E flow ticket ${Date.now()}`;
        const attachmentPath = writeTempPng(`e2e-${Date.now()}.png`);

        await loginAs(page, accounts.requester.email);
        await expect(page.getByText(accounts.requester.name)).toBeVisible();

        await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
        await page.getByLabel(/category/i).selectOption({ label: "Hardware" });
        await page.getByLabel(/related system/i).selectOption({ label: "Corporate Laptop" });
        await page.getByLabel(/summary/i).fill(uniqueSummary);
        await page.getByLabel(/description/i).fill("End-to-end test description, long enough to pass validation.");
        await page.getByLabel(/requested priority/i).selectOption("MEDIUM");
        await page.getByLabel(/attachments/i).setInputFiles(attachmentPath);
        await expect(page.getByText(path.basename(attachmentPath))).toBeVisible();

        await page.getByRole("button", { name: /submit/i }).click();

        // AC-01: ticket number displayed on success
        const ticketNumberLocator = page.getByText(/TKT-\d{4}-\d{6}/);
        await expect(ticketNumberLocator).toBeVisible({ timeout: 10_000 });
        const ticketNumber = (await ticketNumberLocator.textContent())!.trim();

        // AC-09: the ticket shows up in the authenticated requester's list
        await page.getByRole("link", { name: "My Tickets" }).click();
        await page.getByLabel("Search").fill(uniqueSummary);
        await expect(page.getByText(ticketNumber)).toBeVisible();

        await page.getByText(ticketNumber).click();
        await expect(page.getByLabel(/^summary$/i)).toHaveValue(uniqueSummary);

        // AC-02: the attachment uploaded during creation is active
        await expect(page.getByText(path.basename(attachmentPath))).toBeVisible();
        await expect(page.getByRole("button", { name: /download/i })).toBeVisible();
    });
});

test.describe("Cross-requester isolation (E2E-02)", () => {
    test("another requester cannot see or open the ticket, even by direct URL (AC-09, AC-14)", async ({ page }) => {
        const uniqueSummary = `E2E isolation ticket ${Date.now()}`;

        await loginAs(page, accounts.requester.email);
        const ticket = await createTicketViaApi(page, uniqueSummary);

        await logout(page);
        await loginAs(page, accounts.requester2.email);

        await page.getByLabel("Search").fill(uniqueSummary);
        await expect(page.getByText(/no tickets match/i)).toBeVisible();

        // A full page load works now: the session cookie survives, so this is the real ownership check.
        await page.goto(`/tickets/${ticket.id}`);
        await expect(page.getByText(/ticket not found/i)).toBeVisible();
    });
});