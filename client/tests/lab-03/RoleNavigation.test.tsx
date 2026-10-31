import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.js";
import { AuthContext } from "../../src/context/AuthContext.js";
import * as ticketsApi from "../../src/api/tickets.js";
import * as staffApi from "../../src/api/staff.js";
import * as categoriesApi from "../../src/api/categories.js";
import * as relatedSystemsApi from "../../src/api/related-systems.js";

const requester = { id: 1, name: "Jennifer Anderson", role: "REQUESTER" as const, mustChangePassword: false };
const staff = { id: 2, name: "Michael Brown", role: "IT_STAFF" as const, mustChangePassword: false };
const admin = { id: 3, name: "Alex Thompson", role: "ADMINISTRATOR" as const, mustChangePassword: false };

const emptyList = { data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } };

function renderApp(user: typeof requester | typeof staff | typeof admin, path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <AuthContext.Provider value={{ user, setUser: vi.fn() }}>
                <App />
            </AuthContext.Provider>
        </MemoryRouter>
    );
}

describe("Role-based navigation", () => {
    let staffSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.spyOn(ticketsApi, "fetchTickets").mockResolvedValue(emptyList);
        staffSpy = vi.spyOn(staffApi, "fetchStaffTickets").mockResolvedValue(emptyList);
        vi.spyOn(staffApi, "fetchAssignees").mockResolvedValue([]);
        vi.spyOn(categoriesApi, "fetchCategories").mockResolvedValue([]);
        vi.spyOn(relatedSystemsApi, "fetchRelatedSystems").mockResolvedValue([]);
    });
    afterEach(() => vi.restoreAllMocks());

    it("a Requester lands on My Tickets and sees only Requester navigation", async () => {
        renderApp(requester, "/");

        expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Create Ticket" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Ticket Queue" })).not.toBeInTheDocument();
        expect(screen.getByText("Requester")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    });

    it("IT Staff lands on the Ticket Queue and sees no Requester navigation", async () => {
        renderApp(staff, "/");

        expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Ticket Queue" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Create Ticket" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();
        expect(screen.getByText("Michael Brown")).toBeInTheDocument();
        expect(screen.getByText("IT Staff")).toBeInTheDocument();
    });

    it("an Administrator can open the Ticket Queue", async () => {
        renderApp(admin, "/queue");

        expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
        expect(screen.getByText("Administrator")).toBeInTheDocument();
    });

    it("a Requester opening /queue gets Access denied and the queue is never requested", async () => {
        renderApp(requester, "/queue");

        expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
        expect(staffSpy).not.toHaveBeenCalled();
    });

    it("IT Staff opening /create-ticket gets Access denied", async () => {
        renderApp(staff, "/create-ticket");

        expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    });
});