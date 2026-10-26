import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TicketDetail from "../../src/pages/TicketDetail.js";
import * as ticketsApi from "../../src/api/tickets.js";

function renderAtTicket(ticketId: string) {
    return render(
        <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
            <Routes>
                <Route path="/tickets/:id" element={<TicketDetail />} />
            </Routes>
        </MemoryRouter>
    );
}

const baseTicket = {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    requesterId: 1,
    categoryId: 1,
    relatedSystemId: 1,
    summary: "Laptop battery drains quickly",
    description: "Battery drains much faster than usual.",
    requestedPriority: "MEDIUM" as const,
    itPriority: null,
    currentStatus: "NEW" as const,
    requesterConfirmedResolved: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
};

const comment = (id: number, authorName: string, authorRole: "REQUESTER" | "IT_STAFF", content: string) => ({
    id,
    ticketId: 42,
    authorId: id,
    authorName,
    authorRole,
    content,
    createdAt: "2026-09-02T10:00:00.000Z",
});

describe("TicketDetail", () => {
    beforeEach(() => {
        vi.spyOn(ticketsApi, "fetchComments").mockResolvedValue([]);
    });
    afterEach(() => vi.restoreAllMocks());

    it("renders read-only ticket header fields", async () => {
        vi.spyOn(ticketsApi, "fetchTicket").mockResolvedValue({ ...baseTicket, attachments: [] });

        renderAtTicket("42");

        expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Laptop battery drains quickly")).toBeInTheDocument();
    });

    it("AC-14: shows a not-found state when the ticket belongs to another requester or does not exist", async () => {
        vi.spyOn(ticketsApi, "fetchTicket").mockRejectedValue(new ticketsApi.TicketNotFoundError());

        renderAtTicket("999");

        expect(await screen.findByText(/ticket not found/i)).toBeInTheDocument();
        expect(screen.queryByDisplayValue("Laptop battery drains quickly")).not.toBeInTheDocument();
    });

    it("AC-15/AC-17: an active attachment shows Download, a removed one does not", async () => {
        vi.spyOn(ticketsApi, "fetchTicket").mockResolvedValue({
            ...baseTicket,
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
        });

        renderAtTicket("42");
        await screen.findByText("active.png");

        const activeRow = screen.getByText("active.png").closest("li")!;
        expect(within(activeRow).getByRole("button", { name: /download/i })).toBeInTheDocument();

        const removedRow = screen.getByText("removed.png").closest("li")!;
        expect(within(removedRow).queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
        expect(within(removedRow).getByText("Removed")).toBeInTheDocument();
    });
});

describe("TicketDetail — Public Comments", () => {
    beforeEach(() => {
        vi.spyOn(ticketsApi, "fetchTicket").mockResolvedValue({ ...baseTicket, attachments: [] });
    });
    afterEach(() => vi.restoreAllMocks());

    it("AC-09: lists comments with author name and role", async () => {
        vi.spyOn(ticketsApi, "fetchComments").mockResolvedValue([
            comment(1, "Jennifer Anderson", "REQUESTER", "It also happens when the laptop is idle."),
            comment(2, "Michael Brown", "IT_STAFF", "We are investigating."),
        ]);

        renderAtTicket("42");

        expect(await screen.findByText("It also happens when the laptop is idle.")).toBeInTheDocument();
        expect(screen.getByText("Michael Brown")).toBeInTheDocument();
        expect(screen.getByText("IT Staff")).toBeInTheDocument();
    });

    it("AC-09: posting a comment sends the trimmed text and shows it in the thread", async () => {
        vi.spyOn(ticketsApi, "fetchComments")
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([comment(5, "Jennifer Anderson", "REQUESTER", "Thanks for the update.")]);
        const postSpy = vi
            .spyOn(ticketsApi, "postComment")
            .mockResolvedValue(comment(5, "Jennifer Anderson", "REQUESTER", "Thanks for the update."));

        renderAtTicket("42");

        const box = await screen.findByLabelText(/add public comment/i);
        fireEvent.change(box, { target: { value: "  Thanks for the update.  " } });
        fireEvent.click(screen.getByRole("button", { name: /post comment/i }));

        await waitFor(() => expect(postSpy).toHaveBeenCalledWith(42, "Thanks for the update."));
        expect(await screen.findByText("Thanks for the update.")).toBeInTheDocument();
        expect(box).toHaveValue("");
    });

    it("BR-19: Post Comment stays disabled for empty or whitespace-only content", async () => {
        vi.spyOn(ticketsApi, "fetchComments").mockResolvedValue([]);

        renderAtTicket("42");

        const box = await screen.findByLabelText(/add public comment/i);
        const button = screen.getByRole("button", { name: /post comment/i });
        expect(button).toBeDisabled();

        fireEvent.change(box, { target: { value: "   " } });
        expect(button).toBeDisabled();

        fireEvent.change(box, { target: { value: "Hello" } });
        expect(button).toBeEnabled();
    });

    it("renders comment content as plain text, never as HTML", async () => {
        const malicious = '<img src=x onerror="alert(1)">';
        vi.spyOn(ticketsApi, "fetchComments").mockResolvedValue([
            comment(1, "Jennifer Anderson", "REQUESTER", malicious),
        ]);

        const { container } = renderAtTicket("42");

        expect(await screen.findByText(malicious)).toBeInTheDocument();
        expect(container.querySelector("img")).toBeNull();
    });
});

describe("TicketDetail — Problem Appears Resolved", () => {
    beforeEach(() => {
        vi.spyOn(ticketsApi, "fetchComments").mockResolvedValue([]);
    });
    afterEach(() => vi.restoreAllMocks());

    it("AC-10: marking the problem as resolved calls the API and replaces the button with a confirmation", async () => {
        vi.spyOn(ticketsApi, "fetchTicket").mockResolvedValue({ ...baseTicket, attachments: [] });
        const resolveSpy = vi.spyOn(ticketsApi, "markResolvedByRequester").mockResolvedValue();

        renderAtTicket("42");

        fireEvent.click(await screen.findByRole("button", { name: /mark problem as resolved/i }));

        await waitFor(() => expect(resolveSpy).toHaveBeenCalledWith(42));
        expect(await screen.findByText(/you indicated this problem appears resolved/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /mark problem as resolved/i })).not.toBeInTheDocument();
    });

    it("shows the confirmation instead of the button when the ticket is already marked", async () => {
        vi.spyOn(ticketsApi, "fetchTicket").mockResolvedValue({
            ...baseTicket,
            requesterConfirmedResolved: true,
            attachments: [],
        });

        renderAtTicket("42");

        expect(await screen.findByText(/you indicated this problem appears resolved/i)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /mark problem as resolved/i })).not.toBeInTheDocument();
    });
});