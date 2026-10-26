import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyTickets from "../../src/pages/MyTickets.js";
import * as ticketsApi from "../../src/api/tickets.js";
import { useIsMobile } from "../../src/hooks/useIsMobile.js";

vi.mock("../../src/hooks/useIsMobile.js", () => ({ useIsMobile: vi.fn(() => false) }));

function renderWithContext() {
    return render(
        <MemoryRouter>
            <MyTickets />
        </MemoryRouter>
    );
}

function makeResponse(tickets: unknown[], overrides = {}) {
    return {
        data: tickets,
        pagination: { page: 1, pageSize: 10, totalItems: tickets.length, totalPages: 1, ...overrides },
    };
}

const oneTicket = {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    summary: "Laptop issue",
    categoryId: 1,
    requestedPriority: "MEDIUM",
    itPriority: null,
    currentStatus: "NEW",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("MyTickets", () => {
    beforeEach(() => {
        vi.mocked(useIsMobile).mockReturnValue(false);
    });
    afterEach(() => vi.restoreAllMocks());

    it("AC-09: renders the tickets returned for the current requester", async () => {
        vi.spyOn(ticketsApi, "fetchTickets").mockResolvedValue(makeResponse([oneTicket]));

        renderWithContext();

        expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
        expect(screen.getByText("Laptop issue")).toBeInTheDocument();
    });

    it("AC-12: shows the empty state with a Create Ticket CTA when there are zero tickets ever", async () => {
        vi.spyOn(ticketsApi, "fetchTickets").mockResolvedValue(makeResponse([]));

        renderWithContext();

        expect(await screen.findByText(/you don't have any tickets yet/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /create ticket/i })).toBeInTheDocument();
    });

    it("AC-11: shows a distinct no-results state when a search returns zero matches", async () => {
        vi.spyOn(ticketsApi, "fetchTickets")
            .mockResolvedValueOnce(makeResponse([oneTicket]))
            .mockResolvedValueOnce(makeResponse([], { totalItems: 0 }));

        renderWithContext();
        await screen.findByText("TKT-2026-000001");

        fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "zzz_no_match" } });

        expect(await screen.findByText(/no tickets match your search/i)).toBeInTheDocument();
        expect(screen.queryByText(/you don't have any tickets yet/i)).not.toBeInTheDocument();
    });

    it("AC-13: Next advances to page 2 and calls the API with the new page", async () => {
        const fetchSpy = vi
            .spyOn(ticketsApi, "fetchTickets")
            .mockResolvedValueOnce(
                makeResponse(
                    Array.from({ length: 10 }, (_, i) => ({
                        id: i,
                        ticketNumber: `TKT-${i}`,
                        summary: `Ticket ${i}`,
                        categoryId: 1,
                        requestedPriority: "LOW",
                        itPriority: null,
                        currentStatus: "NEW",
                        createdAt: "2026-09-01T00:00:00.000Z",
                        updatedAt: "2026-09-01T00:00:00.000Z",
                    })),
                    { totalItems: 15, totalPages: 2 }
                )
            )
            .mockResolvedValueOnce(makeResponse([], { page: 2, totalItems: 15, totalPages: 2 }));

        renderWithContext();
        await screen.findByText("Ticket 0");

        fireEvent.click(screen.getByRole("button", { name: /next/i }));

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
        });
    });

    it("renders the mobile card layout instead of the table when useIsMobile is true", async () => {
        vi.mocked(useIsMobile).mockReturnValue(true);
        vi.spyOn(ticketsApi, "fetchTickets").mockResolvedValue(makeResponse([oneTicket]));

        renderWithContext();

        expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
});