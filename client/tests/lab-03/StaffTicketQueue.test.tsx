import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StaffTicketQueue from "../../src/pages/StaffTicketQueue.js";
import * as staffApi from "../../src/api/staff.js";
import * as categoriesApi from "../../src/api/categories.js";
import { ForbiddenError } from "../../src/api/http.js";
import { useIsMobile } from "../../src/hooks/useIsMobile.js";

vi.mock("../../src/hooks/useIsMobile.js", () => ({ useIsMobile: vi.fn(() => false) }));

const makeTicket = (overrides: Partial<staffApi.StaffTicketListItem> = {}): staffApi.StaffTicketListItem => ({
    id: 1,
    ticketNumber: "TKT-2026-000001",
    summary: "Laptop battery drains quickly",
    categoryId: 1,
    requestedPriority: "MEDIUM",
    itPriority: "HIGH",
    currentStatus: "IN_PROGRESS",
    ticketOwnerId: 7,
    ticketOwnerName: "Michael Brown",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
});

const unassigned = makeTicket({
    id: 2,
    ticketNumber: "TKT-2026-000002",
    summary: "Cannot connect to VPN",
    requestedPriority: "HIGH",
    itPriority: null,
    currentStatus: "NEW",
    ticketOwnerId: null,
    ticketOwnerName: null,
});

const makeResponse = (data: staffApi.StaffTicketListItem[], overrides = {}) => ({
    data,
    pagination: { page: 1, pageSize: 10, totalItems: data.length, totalPages: 1, ...overrides },
});

function renderQueue() {
    return render(
        <MemoryRouter>
            <StaffTicketQueue />
        </MemoryRouter>
    );
}

describe("StaffTicketQueue", () => {
    beforeEach(() => {
        vi.mocked(useIsMobile).mockReturnValue(false);
        vi.spyOn(categoriesApi, "fetchCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
        vi.spyOn(staffApi, "fetchAssignees").mockResolvedValue([]);
    });
    afterEach(() => vi.restoreAllMocks());

    it("AC-11: lists tickets with category, status, priorities and owner", async () => {
        vi.spyOn(staffApi, "fetchStaffTickets").mockResolvedValue(makeResponse([makeTicket(), unassigned]));

        renderQueue();

        const assignedRow = (await screen.findByRole("link", { name: "TKT-2026-000001" })).closest("tr")!;
        expect(within(assignedRow).getByText("Michael Brown")).toBeInTheDocument();
        expect(within(assignedRow).getByText("In Progress")).toBeInTheDocument();
        expect(await within(assignedRow).findByText("Hardware")).toBeInTheDocument();

        const unassignedRow = screen.getByRole("link", { name: "TKT-2026-000002" }).closest("tr")!;
        expect(within(unassignedRow).getByText("Unassigned")).toBeInTheDocument();
        expect(within(unassignedRow).getByText("—")).toBeInTheDocument(); // IT Priority not set
    });

    it("opens the ticket detail from the ticket number", async () => {
        vi.spyOn(staffApi, "fetchStaffTickets").mockResolvedValue(makeResponse([makeTicket()]));

        renderQueue();

        const link = await screen.findByRole("link", { name: "TKT-2026-000001" });
        expect(link).toHaveAttribute("href", "/staff/tickets/1");
    });

    it("shows a loading state while the queue is being fetched", () => {
        vi.spyOn(staffApi, "fetchStaffTickets").mockReturnValue(new Promise(() => { }));

        renderQueue();

        expect(screen.getByText(/loading ticket queue/i)).toBeInTheDocument();
    });

    it("shows the empty state when no ticket exists at all", async () => {
        vi.spyOn(staffApi, "fetchStaffTickets").mockResolvedValue(makeResponse([]));

        renderQueue();

        expect(await screen.findByText(/the ticket queue is empty/i)).toBeInTheDocument();
        expect(screen.queryByText(/no tickets match/i)).not.toBeInTheDocument();
    });

    it("AC-11: shows a distinct no-results state when a search matches nothing", async () => {
        vi.spyOn(staffApi, "fetchStaffTickets")
            .mockResolvedValueOnce(makeResponse([makeTicket()]))
            .mockResolvedValue(makeResponse([], { totalItems: 0, totalPages: 0 }));

        renderQueue();
        await screen.findByRole("link", { name: "TKT-2026-000001" });

        fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzz_no_match" } });

        expect(await screen.findByText(/no tickets match your search or filters/i)).toBeInTheDocument();
        expect(screen.queryByText(/the ticket queue is empty/i)).not.toBeInTheDocument();
    });

    it("shows a safe error message when the queue cannot be loaded", async () => {
        vi.spyOn(staffApi, "fetchStaffTickets").mockRejectedValue(
            new Error("Failed to load the ticket queue (HTTP 500)")
        );

        renderQueue();

        expect(await screen.findByText(/http 500/i)).toBeInTheDocument();
    });

    it("shows the Access denied state when the server answers 403", async () => {
        vi.spyOn(staffApi, "fetchStaffTickets").mockRejectedValue(new ForbiddenError());

        renderQueue();

        expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    });

    it("sends the selected filters to the API and goes back to page 1", async () => {
        const spy = vi.spyOn(staffApi, "fetchStaffTickets").mockResolvedValue(makeResponse([makeTicket()]));
        vi.spyOn(staffApi, "fetchAssignees").mockResolvedValue([{ id: 7, name: "Michael Brown", role: "IT_STAFF" }]);

        renderQueue();
        await screen.findByRole("link", { name: "TKT-2026-000001" });

        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "IN_PROGRESS" } });
        await waitFor(() =>
            expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ status: "IN_PROGRESS", page: 1 }))
        );

        fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "unassigned" } });
        await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ ownerId: "unassigned" })));

        await screen.findByRole("option", { name: "Michael Brown" });
        fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "7" } });
        await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ ownerId: 7 })));
    });

    it("Clear Filters removes every active filter", async () => {
        const spy = vi.spyOn(staffApi, "fetchStaffTickets").mockResolvedValue(makeResponse([makeTicket()]));

        renderQueue();
        await screen.findByRole("link", { name: "TKT-2026-000001" });

        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "IN_PROGRESS" } });
        await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ status: "IN_PROGRESS" })));

        fireEvent.click(screen.getAllByRole("button", { name: /clear filters/i })[0]);

        await waitFor(() =>
            expect(spy).toHaveBeenLastCalledWith(expect.not.objectContaining({ status: "IN_PROGRESS" }))
        );
    });

    it("Next advances to page 2 and calls the API with the new page", async () => {
        const tenTickets = Array.from({ length: 10 }, (_, i) =>
            makeTicket({ id: i + 1, ticketNumber: `TKT-2026-0000${String(i + 1).padStart(2, "0")}` })
        );
        const spy = vi
            .spyOn(staffApi, "fetchStaffTickets")
            .mockResolvedValueOnce(makeResponse(tenTickets, { totalItems: 15, totalPages: 2 }))
            .mockResolvedValue(makeResponse([], { page: 2, totalItems: 15, totalPages: 2 }));

        renderQueue();
        await screen.findByRole("link", { name: "TKT-2026-000001" });

        fireEvent.click(screen.getByRole("button", { name: /next/i }));

        await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    });

    it("renders cards instead of the table on a small screen", async () => {
        vi.mocked(useIsMobile).mockReturnValue(true);
        vi.spyOn(staffApi, "fetchStaffTickets").mockResolvedValue(makeResponse([unassigned]));

        renderQueue();

        const card = (await screen.findByRole("link", { name: "TKT-2026-000002" })).closest("li")!;
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(within(card).getByText("Unassigned")).toBeInTheDocument();
    });
});