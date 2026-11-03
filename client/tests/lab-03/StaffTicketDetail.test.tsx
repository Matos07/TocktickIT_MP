import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import StaffTicketDetail from "../../src/pages/StaffTicketDetail.js";
import * as staffApi from "../../src/api/staff.js";
import * as ticketsApi from "../../src/api/tickets.js";
import { ForbiddenError } from "../../src/api/http.js";

const makeDetail = (overrides: Partial<staffApi.StaffTicketDetail> = {}): staffApi.StaffTicketDetail => ({
    id: 42,
    ticketNumber: "TKT-2026-000042",
    requesterId: 1,
    requesterName: "Jennifer Anderson",
    categoryId: 1,
    categoryName: "Hardware",
    relatedSystemId: 1,
    relatedSystemName: "Corporate Laptop",
    summary: "Laptop battery drains quickly",
    description: "Battery drains much faster than usual.",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    currentStatus: "OPEN",
    ticketOwnerId: 7,
    ticketOwnerName: "Michael Brown",
    requesterConfirmedResolved: false,
    allowedTransitions: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
    attachments: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
});

const unowned = makeDetail({
    ticketOwnerId: null,
    ticketOwnerName: null,
    currentStatus: "NEW",
    allowedTransitions: ["OPEN", "IN_PROGRESS", "CANCELLED"],
});

const message = (id: number, authorName: string, authorRole: "REQUESTER" | "IT_STAFF", content: string) => ({
    id,
    ticketId: 42,
    authorId: id,
    authorName,
    authorRole,
    content,
    createdAt: "2026-09-02T10:00:00.000Z",
});

function renderDetail(id = "42") {
    return render(
        <MemoryRouter initialEntries={[`/staff/tickets/${id}`]}>
            <Routes>
                <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
                <Route path="/queue" element={<div>Queue Screen</div>} />
            </Routes>
        </MemoryRouter>
    );
}

describe("StaffTicketDetail", () => {
    beforeEach(() => {
        vi.spyOn(staffApi, "fetchAssignees").mockResolvedValue([
            { id: 7, name: "Michael Brown", role: "IT_STAFF" },
            { id: 8, name: "Sarah Johnson", role: "IT_STAFF" },
        ]);
        vi.spyOn(ticketsApi, "fetchComments").mockResolvedValue([]);
        vi.spyOn(staffApi, "fetchInternalNotes").mockResolvedValue([]);
    });
    afterEach(() => vi.restoreAllMocks());

    it("shows the ticket header read-only and the operational controls editable", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());

        renderDetail();

        expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
        for (const label of ["Requester", "Category", "Related System", "Summary", "Description"]) {
            expect(screen.getByLabelText(label)).toHaveAttribute("readonly");
        }
        expect(screen.getByDisplayValue("Jennifer Anderson")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Hardware")).toBeInTheDocument();

        expect(screen.getByLabelText("Ticket Owner")).toHaveValue("7");
        expect(screen.getByLabelText("IT Priority")).toHaveValue("MEDIUM");
        expect(screen.getByLabelText("Current Status")).toHaveValue("OPEN");
        expect(screen.getByLabelText("Ticket Owner")).not.toHaveAttribute("readonly");
    });

    it("UI-06: the status menu offers only the current status and the permitted transitions", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());

        renderDetail();

        const select = await screen.findByLabelText("Current Status");
        const labels = within(select).getAllByRole("option").map((o) => o.textContent);
        expect(labels).toEqual(["Open", "In Progress", "Waiting for Requester", "Cancelled"]);
    });

    it("saves a permitted status change immediately", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());
        const statusSpy = vi.spyOn(staffApi, "setTicketStatus").mockResolvedValue(
            makeDetail({
                currentStatus: "IN_PROGRESS",
                allowedTransitions: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
            })
        );

        renderDetail();

        fireEvent.change(await screen.findByLabelText("Current Status"), { target: { value: "IN_PROGRESS" } });

        await waitFor(() => expect(statusSpy).toHaveBeenCalledWith(42, "IN_PROGRESS"));
        expect(await screen.findByText("Ticket updated.")).toBeInTheDocument();
        expect(screen.getByLabelText("Current Status")).toHaveValue("IN_PROGRESS");
    });

    it("BR-29: Cancelled needs an explicit confirmation, and Go back leaves the status untouched", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());
        const statusSpy = vi.spyOn(staffApi, "setTicketStatus").mockResolvedValue(
            makeDetail({ currentStatus: "CANCELLED", allowedTransitions: [] })
        );

        renderDetail();
        const select = await screen.findByLabelText("Current Status");

        fireEvent.change(select, { target: { value: "CANCELLED" } });
        expect(screen.getByText(/cancel this ticket\?/i)).toBeInTheDocument();
        expect(statusSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Go back" }));
        expect(statusSpy).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Current Status")).toHaveValue("OPEN");

        fireEvent.change(screen.getByLabelText("Current Status"), { target: { value: "CANCELLED" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
        await waitFor(() => expect(statusSpy).toHaveBeenCalledWith(42, "CANCELLED"));
    });

    it("BR-29: Closing needs a confirmation, reopening does not", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(
            makeDetail({ currentStatus: "RESOLVED", allowedTransitions: ["CLOSED", "REOPENED"] })
        );
        const statusSpy = vi.spyOn(staffApi, "setTicketStatus").mockResolvedValue(
            makeDetail({ currentStatus: "REOPENED" })
        );

        renderDetail();
        const select = await screen.findByLabelText("Current Status");

        fireEvent.change(select, { target: { value: "CLOSED" } });
        expect(screen.getByText(/close this ticket\?/i)).toBeInTheDocument();
        expect(statusSpy).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Go back" }));

        fireEvent.change(screen.getByLabelText("Current Status"), { target: { value: "REOPENED" } });
        await waitFor(() => expect(statusSpy).toHaveBeenCalledWith(42, "REOPENED"));
    });

    it("AC-12: an unassigned ticket offers Claim, which takes ownership", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(unowned);
        const claimSpy = vi.spyOn(staffApi, "claimTicket").mockResolvedValue(
            makeDetail({ ticketOwnerId: 7, ticketOwnerName: "Michael Brown", currentStatus: "OPEN" })
        );

        renderDetail();

        fireEvent.click(await screen.findByRole("button", { name: "Claim this ticket" }));

        await waitFor(() => expect(claimSpy).toHaveBeenCalledWith(42));
        await waitFor(() =>
            expect(screen.queryByRole("button", { name: "Claim this ticket" })).not.toBeInTheDocument()
        );
        expect(screen.getByLabelText("Ticket Owner")).toHaveValue("7");
        expect(screen.getByLabelText("Current Status")).toHaveValue("OPEN");
    });

    it("an assigned ticket has no Claim button", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());

        renderDetail();

        await screen.findByLabelText("Ticket Owner");
        expect(screen.queryByRole("button", { name: "Claim this ticket" })).not.toBeInTheDocument();
    });

    it("AC-13: reassigns the ticket from the owner menu", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());
        const assignSpy = vi.spyOn(staffApi, "assignTicket").mockResolvedValue(
            makeDetail({ ticketOwnerId: 8, ticketOwnerName: "Sarah Johnson" })
        );

        renderDetail();

        await screen.findByRole("option", { name: "Sarah Johnson" });
        fireEvent.change(screen.getByLabelText("Ticket Owner"), { target: { value: "8" } });

        await waitFor(() => expect(assignSpy).toHaveBeenCalledWith(42, 8));
        await waitFor(() => expect(screen.getByLabelText("Ticket Owner")).toHaveValue("8"));
    });

    it("AC-15: changes the IT Priority", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());
        const prioritySpy = vi.spyOn(staffApi, "setItPriority").mockResolvedValue(makeDetail({ itPriority: "HIGH" }));

        renderDetail();

        fireEvent.change(await screen.findByLabelText("IT Priority"), { target: { value: "HIGH" } });

        await waitFor(() => expect(prioritySpy).toHaveBeenCalledWith(42, "HIGH"));
        await waitFor(() => expect(screen.getByLabelText("IT Priority")).toHaveValue("HIGH"));
    });

    it("shows the server's message and resyncs when an action is refused", async () => {
        const fetchSpy = vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());
        vi.spyOn(staffApi, "setTicketStatus").mockRejectedValue(
            new Error("The ticket status changed in the meantime. Reload and try again.")
        );

        renderDetail();

        fireEvent.change(await screen.findByLabelText("Current Status"), { target: { value: "IN_PROGRESS" } });

        expect(await screen.findByText(/changed in the meantime/i)).toBeInTheDocument();
        await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    });

    it("locks the status menu on a cancelled ticket", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(
            makeDetail({ currentStatus: "CANCELLED", allowedTransitions: [] })
        );

        renderDetail();

        expect(await screen.findByLabelText("Current Status")).toBeDisabled();
        expect(screen.getByText(/no further changes/i)).toBeInTheDocument();
    });

    it("tells staff when the requester indicated the problem appears resolved", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail({ requesterConfirmedResolved: true }));

        renderDetail();

        expect(await screen.findByText(/the requester indicated this problem appears resolved/i)).toBeInTheDocument();
    });

    it("shows attachments read-only: download for active ones, metadata only for removed ones", async () => {
        global.URL.createObjectURL = vi.fn(() => "blob:mock");
        global.URL.revokeObjectURL = vi.fn();
        const downloadSpy = vi.spyOn(staffApi, "downloadStaffAttachment").mockResolvedValue(new Blob(["x"]));
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(
            makeDetail({
                attachments: [
                    {
                        id: 1, originalFileName: "active.png", mimeType: "image/png", sizeBytes: 1024,
                        uploadedAt: "2026-09-01T00:00:00.000Z", removedAt: null, removedReason: null,
                    },
                    {
                        id: 2, originalFileName: "removed.png", mimeType: "image/png", sizeBytes: 1024,
                        uploadedAt: "2026-09-01T00:00:00.000Z", removedAt: "2026-09-02T00:00:00.000Z",
                        removedReason: "Wrong file.",
                    },
                ],
            })
        );

        renderDetail();

        const activeRow = (await screen.findByText("active.png")).closest("li")!;
        fireEvent.click(within(activeRow).getByRole("button", { name: /download/i }));
        await waitFor(() => expect(downloadSpy).toHaveBeenCalledWith(1));

        const removedRow = screen.getByText("removed.png").closest("li")!;
        expect(within(removedRow).queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
        expect(within(removedRow).getByText("Removed")).toBeInTheDocument();

        expect(screen.queryByLabelText(/add attachment/i)).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    });

    it("UI-07: Public Comments and Internal Notes are separate, clearly labelled panels", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());
        vi.spyOn(ticketsApi, "fetchComments").mockResolvedValue([
            message(1, "Jennifer Anderson", "REQUESTER", "Public message"),
        ]);
        vi.spyOn(staffApi, "fetchInternalNotes").mockResolvedValue([
            message(2, "Michael Brown", "IT_STAFF", "Private message"),
        ]);

        renderDetail();

        expect(await screen.findByText("Public message")).toBeInTheDocument();
        expect(await screen.findByText("Private message")).toBeInTheDocument();
        expect(screen.getByText("Public Comments")).toBeInTheDocument();
        expect(screen.getByText("Internal Notes")).toBeInTheDocument();
        expect(screen.getByText(/not visible to the requester/i)).toBeInTheDocument();
    });

    it("UI-07: an internal note is posted through its own box and never as a public comment", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockResolvedValue(makeDetail());
        const noteSpy = vi
            .spyOn(staffApi, "postInternalNote")
            .mockResolvedValue(message(3, "Michael Brown", "IT_STAFF", "Ordered a part."));
        const commentSpy = vi.spyOn(ticketsApi, "postComment");

        renderDetail();

        fireEvent.change(await screen.findByLabelText("Add Internal Note"), { target: { value: "  Ordered a part.  " } });
        expect(screen.getByRole("button", { name: "Post Comment" })).toBeDisabled(); // the public box is still empty

        fireEvent.click(screen.getByRole("button", { name: "Post Internal Note" }));

        await waitFor(() => expect(noteSpy).toHaveBeenCalledWith(42, "Ordered a part."));
        expect(commentSpy).not.toHaveBeenCalled();
    });

    it("shows a not-found state for an unknown ticket", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockRejectedValue(new ticketsApi.TicketNotFoundError());

        renderDetail("999");

        expect(await screen.findByText(/ticket not found/i)).toBeInTheDocument();
    });

    it("shows Access denied when the server answers 403", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockRejectedValue(new ForbiddenError());

        renderDetail();

        expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    });

    it("shows a safe error message when the ticket cannot be loaded", async () => {
        vi.spyOn(staffApi, "fetchStaffTicket").mockRejectedValue(new Error("Failed to load the ticket (HTTP 500)"));

        renderDetail();

        expect(await screen.findByText(/http 500/i)).toBeInTheDocument();
    });
});