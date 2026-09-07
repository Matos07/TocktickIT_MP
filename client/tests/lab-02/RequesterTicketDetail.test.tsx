import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TicketDetail from "../../src/pages/TicketDetail.js";
import { RequesterContext } from "../../src/context/RequesterContext.js";
import * as ticketsApi from "../../src/api/tickets.js";

const requester = { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" };

function renderAtTicket(ticketId: string) {
    return render(
        <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
            <RequesterContext.Provider value={{ requester, setRequester: vi.fn(), clearRequester: vi.fn() }}>
                <Routes>
                    <Route path="/tickets/:id" element={<TicketDetail />} />
                </Routes>
            </RequesterContext.Provider>
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
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("TicketDetail", () => {
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
        expect(screen.queryByText("Laptop battery drains quickly")).not.toBeInTheDocument();
    });

    it("AC-15/AC-17: an active attachment shows Download, a removed one does not", async () => {
        vi.spyOn(ticketsApi, "fetchTicket").mockResolvedValue({
            ...baseTicket,
            attachments: [
                {
                    id: 1, originalFileName: "active.png", mimeType: "image/png", sizeBytes: 1024,
                    uploadedAt: "2026-09-01T00:00:00.000Z", removedAt: null, removedReason: null
                },
                {
                    id: 2, originalFileName: "removed.png", mimeType: "image/png", sizeBytes: 1024,
                    uploadedAt: "2026-09-01T00:00:00.000Z", removedAt: "2026-09-02T00:00:00.000Z",
                    removedReason: "Wrong file."
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

// eslint-disable-next-line import/no-duplicates
import { within } from "@testing-library/react";