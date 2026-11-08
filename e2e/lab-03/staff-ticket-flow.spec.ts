import { test, expect } from "@playwright/test";
import { accounts, API } from "../support/accounts.js";
import { createTicketViaApi } from "../support/api.js";
import { newSession } from "../support/auth.js";
import { shot } from "../support/screenshots.js";

test.describe("IT Staff ticket flow (E2E-03)", () => {
    test("find a ticket in the queue, claim it, and work it through the detail screen", async ({ browser }) => {
        const summary = `E2E staff flow ${Date.now()}`;
        const requester = await newSession(browser, accounts.requester.email);
        const ticket = await createTicketViaApi(requester, summary);

        const staff = await newSession(browser, accounts.staff.email);
        await expect(staff.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();

        await staff.getByLabel("Search").fill(summary);
        const row = staff.getByRole("row", { name: new RegExp(ticket.ticketNumber) });
        await expect(row.getByText("Unassigned")).toBeVisible();
        await shot(staff, "staff-queue/queue-unassigned");

        // AC-12: claiming takes ownership and opens a New ticket
        await row.getByRole("button", { name: `Claim ${ticket.ticketNumber}` }).click();
        await expect(row.getByText(accounts.staff.name)).toBeVisible();
        await expect(row.getByText("Open", { exact: true })).toBeVisible();
        await shot(staff, "staff-queue/queue-claimed");

        // AC-11: a filter that matches nothing shows the no-results state, then the ticket comes back
        await staff.getByLabel("Owner").selectOption("unassigned");
        await expect(staff.getByText(/no tickets match your search or filters/i)).toBeVisible();
        await shot(staff, "staff-queue/queue-no-results");
        await staff.getByLabel("Owner").selectOption("");
        await expect(row).toBeVisible();

        await row.getByRole("link", { name: ticket.ticketNumber }).click();
        await expect(staff.getByLabel("Current Status")).toHaveValue("OPEN");
        await expect(staff.getByLabel("Ticket Owner").locator("option:checked")).toHaveText(accounts.staff.name);

        // AC-15 and the status workflow
        await staff.getByLabel("IT Priority").selectOption("HIGH");
        await expect(staff.getByLabel("IT Priority")).toHaveValue("HIGH");
        await staff.getByLabel("Current Status").selectOption("IN_PROGRESS");
        await expect(staff.getByLabel("Current Status")).toHaveValue("IN_PROGRESS");
        await expect(staff.getByText("Ticket updated.")).toBeVisible();

        // BR-29: Cancelled asks for confirmation, and Go back leaves the status alone
        await staff.getByLabel("Current Status").selectOption("CANCELLED");
        await expect(staff.getByText(/cancel this ticket\?/i)).toBeVisible();
        await shot(staff, "staff-ticket-detail/confirm-cancel");
        await staff.getByRole("button", { name: "Go back" }).click();
        await expect(staff.getByLabel("Current Status")).toHaveValue("IN_PROGRESS");

        // AC-13: reassign
        await staff.getByLabel("Ticket Owner").selectOption({ label: accounts.staff2.name });
        await expect(staff.getByLabel("Ticket Owner").locator("option:checked")).toHaveText(accounts.staff2.name);

        // Public comment and internal note, in their own panels
        await staff.getByLabel("Add Public Comment").fill("We are looking into it.");
        await staff.getByRole("button", { name: "Post Comment" }).click();
        await expect(staff.getByText("We are looking into it.")).toBeVisible();

        await staff.getByLabel("Add Internal Note").fill("Waiting for a replacement part.");
        await staff.getByRole("button", { name: "Post Internal Note" }).click();
        await expect(staff.getByText("Waiting for a replacement part.")).toBeVisible();
        await shot(staff, "staff-ticket-detail/detail-handling");
    });

    test("the Requester sees status, IT Priority and public comments but never internal notes", async ({ browser }) => {
        const requester = await newSession(browser, accounts.requester.email);
        const ticket = await createTicketViaApi(requester, `E2E visibility ${Date.now()}`);
        const staff = await newSession(browser, accounts.staff.email);

        const patch = (action: string, data: object) =>
            staff.request.patch(`${API}/api/staff/tickets/${ticket.id}/${action}`, { data });
        expect((await patch("claim", {})).status()).toBe(200);
        expect((await patch("priority", { itPriority: "HIGH" })).status()).toBe(200);
        expect((await patch("status", { status: "IN_PROGRESS" })).status()).toBe(200);

        const publicText = "Public: we are on it.";
        const privateText = "Private: this requester has reported the same fault before.";
        const comment = await staff.request.post(`${API}/api/tickets/${ticket.id}/comments`, { data: { content: publicText } });
        const note = await staff.request.post(`${API}/api/tickets/${ticket.id}/internal-notes`, { data: { content: privateText } });
        expect(comment.status()).toBe(201);
        expect(note.status()).toBe(201);

        // What the Requester sees
        await requester.goto(`/tickets/${ticket.id}`);
        await expect(requester.getByText(publicText)).toBeVisible();
        await expect(requester.getByText("In Progress", { exact: true })).toBeVisible();
        await expect(requester.getByText("High", { exact: true })).toBeVisible();
        await expect(requester.getByText(privateText)).toHaveCount(0);
        await expect(requester.getByText("Internal Notes")).toHaveCount(0);
        await shot(requester, "staff-ticket-detail/requester-view");

        // What the server refuses on its own, whatever the UI shows (BR-04, AC-04)
        const notes = await requester.request.get(`${API}/api/tickets/${ticket.id}/internal-notes`);
        expect(notes.status()).toBe(403);
        expect(await notes.text()).not.toContain(privateText);
        const forged = await requester.request.patch(`${API}/api/staff/tickets/${ticket.id}/status`, { data: { status: "CLOSED" } });
        expect(forged.status()).toBe(403);

        // The transition matrix is enforced server-side too: In Progress -> Closed is not permitted (AC-14)
        const invalid = await patch("status", { status: "CLOSED" });
        expect(invalid.status()).toBe(400);
        expect((await invalid.json()).error.code).toBe("INVALID_TRANSITION");

        // The Requester signals the problem as resolved; staff see it, and the formal status is untouched (BR-05)
        await requester.getByRole("button", { name: "Mark problem as resolved" }).click();
        await expect(requester.getByText(/you indicated this problem appears resolved/i)).toBeVisible();

        await staff.goto(`/staff/tickets/${ticket.id}`);
        await expect(staff.getByText(/the requester indicated this problem appears resolved/i)).toBeVisible();
        await expect(staff.getByLabel("Current Status")).toHaveValue("IN_PROGRESS");
        await shot(staff, "staff-ticket-detail/requester-resolved-signal");
    });
});