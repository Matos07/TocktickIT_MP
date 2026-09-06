import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyTickets from "../../src/pages/MyTickets.js";
import { RequesterContext } from "../../src/context/RequesterContext.js";
import * as ticketsApi from "../../src/api/tickets.js";

const requesterA = { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com" };
const requesterB = { id: 2, name: "David Lee", email: "david@example.com" };

function renderWithContext(requester = requesterA, clearRequester = vi.fn()) {
    return render(
        <MemoryRouter>
            <RequesterContext.Provider value={{ requester, setRequester: vi.fn(), clearRequester }}>
                <MyTickets />
            </RequesterContext.Provider>
        </MemoryRouter>
    );
}

function makeResponse(tickets: unknown[], overrides = {}) {
    return {
        data: tickets,
        pagination: { page: 1, pageSize: 10, totalItems: tickets.length, totalPages: 1, ...overrides },
    };
}

describe("MyTickets", () => {
    afterEach(() => vi.restoreAllMocks());

    it("AC-09: renders the tickets returned for the current requester", async () => {
        vi.spyOn(ticketsApi, "fetchTickets").mockResolvedValue(
            makeResponse([
                {
                    id: 1, ticketNumber: "TKT-2026-000001", summary: "Laptop issue", categoryId: 1,
                    requestedPriority: "MEDIUM", itPriority: null, currentStatus: "NEW",
                    createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z"
                },
            ])
        );

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
            .mockResolvedValueOnce(
                makeResponse([
                    {
                        id: 1, ticketNumber: "TKT-2026-000001", summary: "Laptop issue", categoryId: 1,
                        requestedPriority: "MEDIUM", itPriority: null, currentStatus: "NEW",
                        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z"
                    },
                ])
            )
            .mockResolvedValueOnce(makeResponse([], { totalItems: 0 }));

        renderWithContext();
        await screen.findByText("TKT-2026-000001");

        fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "zzz_no_match" } });

        expect(await screen.findByText(/no tickets match your search/i)).toBeInTheDocument();
        expect(screen.queryByText(/you don't have any tickets yet/i)).not.toBeInTheDocument();
    });

    it("AC-10: reloads the list when the selected requester changes", async () => {
        const fetchSpy = vi
            .spyOn(ticketsApi, "fetchTickets")
            .mockResolvedValueOnce(makeResponse([{
                id: 1, ticketNumber: "TKT-A", summary: "A's ticket", categoryId: 1,
                requestedPriority: "LOW", itPriority: null, currentStatus: "NEW",
                createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z"
            }]))
            .mockResolvedValueOnce(makeResponse([{
                id: 2, ticketNumber: "TKT-B", summary: "B's ticket", categoryId: 1,
                requestedPriority: "LOW", itPriority: null, currentStatus: "NEW",
                createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z"
            }]));

        const { rerender } = render(
            <MemoryRouter>
                <RequesterContext.Provider value={{ requester: requesterA, setRequester: vi.fn(), clearRequester: vi.fn() }}>
                    <MyTickets />
                </RequesterContext.Provider>
            </MemoryRouter>
        );
        await screen.findByText("A's ticket");

        rerender(
            <MemoryRouter>
                <RequesterContext.Provider value={{ requester: requesterB, setRequester: vi.fn(), clearRequester: vi.fn() }}>
                    <MyTickets />
                </RequesterContext.Provider>
            </MemoryRouter>
        );

        await waitFor(() => expect(screen.getByText("B's ticket")).toBeInTheDocument());
        expect(screen.queryByText("A's ticket")).not.toBeInTheDocument();
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("AC-13: Next advances to page 2 and calls the API with the new page", async () => {
        const fetchSpy = vi
            .spyOn(ticketsApi, "fetchTickets")
            .mockResolvedValueOnce(
                makeResponse(
                    Array.from({ length: 10 }, (_, i) => ({
                        id: i, ticketNumber: `TKT-${i}`, summary: `Ticket ${i}`, categoryId: 1,
                        requestedPriority: "LOW", itPriority: null, currentStatus: "NEW",
                        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
                    })),
                    { totalItems: 15, totalPages: 2 }
                )
            )
            .mockResolvedValueOnce(makeResponse([], { page: 2, totalItems: 15, totalPages: 2 }));

        renderWithContext();
        await screen.findByText("Ticket 0");

        fireEvent.click(screen.getByRole("button", { name: /next/i }));

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenLastCalledWith(requesterA.id, expect.objectContaining({ page: 2 }));
        });
    });
});