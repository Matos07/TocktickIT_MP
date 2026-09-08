import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import os from "os";

test.beforeEach(({ page }) => {
    page.on("console", (msg) => console.log(`[browser console] ${msg.type()}: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`[browser error] ${err.message}`));
});

// Minimal valid 1x1 PNG, generated at test time — no binary fixture to check in.
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
    test("select Requester → create ticket with attachment → find in My Tickets → open Detail", async ({ page }) => {
        const uniqueSummary = `E2E flow ticket ${Date.now()}`;
        const attachmentPath = writeTempPng(`e2e-${Date.now()}.png`);

        // Requester Selection
        await page.goto("/select-requester");
        await page.getByLabel(/development requester/i).selectOption({ label: "Jennifer Anderson" });
        await page.getByRole("button", { name: /continue/i }).click();

        // Create Ticket
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

        // My Tickets: find it via search (AC-09 scoping — only Jennifer's tickets shown)
        await page.getByRole("link", { name: /my tickets/i }).click();
        await page.getByLabel(/search/i).fill(uniqueSummary);
        await expect(page.getByText(ticketNumber)).toBeVisible();

        // Open Ticket Detail
        await page.getByText(ticketNumber).click();
        await expect(page.getByLabel(/^summary$/i)).toHaveValue(uniqueSummary);

        // AC-02: the attachment uploaded during creation shows as active
        await expect(page.getByText(path.basename(attachmentPath))).toBeVisible();
        await expect(page.getByRole("button", { name: /download/i })).toBeVisible();
    });
});

test.describe("Cross-Requester isolation (E2E-02)", () => {
    test("switching Requester hides the other Requester's tickets and blocks direct detail access", async ({ page }) => {
        const uniqueSummary = `E2E isolation ticket ${Date.now()}`;

        // Create a ticket as Jennifer Anderson.
        await page.goto("/select-requester");
        await page.getByLabel(/development requester/i).selectOption({ label: "Jennifer Anderson" });
        await page.getByRole("button", { name: /continue/i }).click();

        await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
        await page.getByLabel(/category/i).selectOption({ label: "Hardware" });
        await page.getByLabel(/related system/i).selectOption({ label: "Corporate Laptop" });
        await page.getByLabel(/summary/i).fill(uniqueSummary);
        await page.getByLabel(/description/i).fill("End-to-end isolation test description, long enough.");
        await page.getByLabel(/requested priority/i).selectOption("LOW");
        await page.getByRole("button", { name: /submit/i }).click();
        await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible({ timeout: 10_000 });

        // Capture the Ticket Detail URL while still logged in as Jennifer.
        await page.getByRole("link", { name: /my tickets/i }).click();
        await page.getByLabel(/search/i).fill(uniqueSummary);
        await page.getByText(/TKT-\d{4}-\d{6}/).click();
        const jenniferTicketPath = new URL(page.url()).pathname;

        // AC-10: switch to a different Requester.
        await page.getByRole("button", { name: /change requester/i }).click();
        await page.getByLabel(/development requester/i).selectOption({ label: "Marcus Chen" });
        await page.getByRole("button", { name: /continue/i }).click();

        // Marcus's My Tickets must not contain Jennifer's ticket.
        await page.getByRole("link", { name: /my tickets/i }).click();
        await page.getByLabel(/search/i).fill(uniqueSummary);
        await expect(page.getByText(/no tickets match/i)).toBeVisible();

        // AC-14: direct navigation to Jennifer's ticket URL as Marcus → not-found.
        await page.evaluate((path) => {
            window.history.pushState({}, "", path);
            window.dispatchEvent(new PopStateEvent("popstate"));
        }, jenniferTicketPath);
        await expect(page.getByText(/ticket not found/i)).toBeVisible();
    });
});