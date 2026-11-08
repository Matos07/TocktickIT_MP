import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserManagement from "../../src/pages/UserManagement.js";
import { AuthContext } from "../../src/context/AuthContext.js";
import * as adminApi from "../../src/api/admin.js";
import { ForbiddenError } from "../../src/api/http.js";
import { useIsMobile } from "../../src/hooks/useIsMobile.js";

vi.mock("../../src/hooks/useIsMobile.js", () => ({ useIsMobile: vi.fn(() => false) }));

const me = { id: 1, name: "Alex Thompson", role: "ADMINISTRATOR" as const, mustChangePassword: false };

const makeUser = (overrides: Partial<adminApi.AdminUser> = {}): adminApi.AdminUser => ({
    id: 2,
    name: "Priya Nair",
    email: "priya.nair@example.com",
    role: "REQUESTER",
    isActive: true,
    ...overrides,
});

const alex = makeUser({ id: 1, name: "Alex Thompson", email: "alex.thompson@example.com", role: "ADMINISTRATOR" });
const priya = makeUser();
const michael = makeUser({ id: 3, name: "Michael Brown", email: "michael.brown@example.com", role: "IT_STAFF" });
const sofia = makeUser({ id: 4, name: "Sofia Dupont", email: "sofia.dupont@example.com", isActive: false });
const everyone = [alex, priya, michael, sofia];

// Behaves like the real endpoint: filters by search text (name or email) and by role.
function mockUsers(all = everyone) {
    return vi.spyOn(adminApi, "fetchUsers").mockImplementation(async (params = {}) =>
        all.filter(
            (u) =>
                (!params.role || u.role === params.role) &&
                (!params.search || `${u.name} ${u.email}`.toLowerCase().includes(params.search.toLowerCase()))
        )
    );
}

function renderPage() {
    return render(
        <MemoryRouter>
            <AuthContext.Provider value={{ user: me, setUser: vi.fn() }}>
                <UserManagement />
            </AuthContext.Provider>
        </MemoryRouter>
    );
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest("tr")!;

async function openCreate() {
    fireEvent.click(await screen.findByRole("button", { name: "Create User" }));
}

function fillCreateForm() {
    fireEvent.change(screen.getByLabelText(/^Full Name/), { target: { value: "  Dana Lee  " } });
    fireEvent.change(screen.getByLabelText(/^Email Address/), { target: { value: "dana.lee@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: "IT_STAFF" } });
    fireEvent.change(screen.getByLabelText(/^Initial Password/), { target: { value: "Initial#Pass1" } });
}

describe("UserManagement — list", () => {
    beforeEach(() => {
        vi.mocked(useIsMobile).mockReturnValue(false);
    });
    afterEach(() => vi.restoreAllMocks());

    it("lists name, email, role and status, with an Edit action for each user", async () => {
        mockUsers();

        renderPage();

        const priyaRow = await rowOf("Priya Nair");
        expect(within(priyaRow).getByText("priya.nair@example.com")).toBeInTheDocument();
        expect(within(priyaRow).getByText("Requester")).toBeInTheDocument();
        expect(within(priyaRow).getByText("Active")).toBeInTheDocument();
        expect(within(priyaRow).getByRole("button", { name: "Edit Priya Nair" })).toBeInTheDocument();
        expect(within(await rowOf("Sofia Dupont")).getByText("Inactive")).toBeInTheDocument();
    });

    it("AC-17: searches by name or email", async () => {
        const spy = mockUsers();
        renderPage();
        await rowOf("Priya Nair");

        fireEvent.change(screen.getByLabelText("Search"), { target: { value: "michael" } });

        await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ search: "michael" })));
        expect(await screen.findByText("Michael Brown")).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText("Priya Nair")).not.toBeInTheDocument());
    });

    it("filters by role", async () => {
        const spy = mockUsers();
        renderPage();
        await rowOf("Priya Nair");

        fireEvent.change(screen.getByLabelText("Filter by Role"), { target: { value: "IT_STAFF" } });

        await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ role: "IT_STAFF" })));
        expect(await screen.findByText("Michael Brown")).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByText("Priya Nair")).not.toBeInTheDocument());
    });

    it("shows a no-results state when nothing matches", async () => {
        mockUsers();
        renderPage();
        await rowOf("Priya Nair");

        fireEvent.change(screen.getByLabelText("Search"), { target: { value: "zzz_nobody" } });

        expect(await screen.findByText(/no users match your search or filters/i)).toBeInTheDocument();
    });

    it("shows a loading state while users are fetched", () => {
        vi.spyOn(adminApi, "fetchUsers").mockReturnValue(new Promise(() => { }));

        renderPage();

        expect(screen.getByText(/loading users/i)).toBeInTheDocument();
    });

    it("shows a safe error message when the list cannot be loaded", async () => {
        vi.spyOn(adminApi, "fetchUsers").mockRejectedValue(
            new adminApi.UserApiError("Failed to retrieve users. Please try again.", "SERVER_ERROR")
        );

        renderPage();

        expect(await screen.findByText(/failed to retrieve users/i)).toBeInTheDocument();
    });

    it("shows Access denied when the server answers 403", async () => {
        vi.spyOn(adminApi, "fetchUsers").mockRejectedValue(new ForbiddenError());

        renderPage();

        expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    });

    it("renders cards instead of the table on a small screen", async () => {
        vi.mocked(useIsMobile).mockReturnValue(true);
        mockUsers();

        renderPage();

        const card = (await screen.findByText("Priya Nair")).closest("li")!;
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        fireEvent.click(within(card).getByRole("button", { name: "Edit Priya Nair" }));
        expect(screen.getByLabelText(/^Full Name/)).toHaveValue("Priya Nair");
    });
});

describe("UserManagement — create", () => {
    beforeEach(() => {
        vi.mocked(useIsMobile).mockReturnValue(false);
        mockUsers();
    });
    afterEach(() => vi.restoreAllMocks());

    it("validates the form before calling the API", async () => {
        const createSpy = vi.spyOn(adminApi, "createUser");
        renderPage();

        await openCreate();
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/email address is required/i)).toBeInTheDocument();
        expect(screen.getByText(/does not meet the rules/i)).toBeInTheDocument();
        expect(createSpy).not.toHaveBeenCalled();
    });

    it("creates a user with the trimmed values and confirms it", async () => {
        const createSpy = vi.spyOn(adminApi, "createUser").mockResolvedValue(makeUser({ id: 9, name: "Dana Lee" }));
        renderPage();

        await openCreate();
        fillCreateForm();
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        await waitFor(() =>
            expect(createSpy).toHaveBeenCalledWith({
                name: "Dana Lee",
                email: "dana.lee@example.com",
                role: "IT_STAFF",
                isActive: true,
                initialPassword: "Initial#Pass1",
            })
        );
        expect(await screen.findByText("User created.")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Create New User" })).not.toBeInTheDocument();
    });

    it("creates an inactive account when the Active switch is turned off", async () => {
        const createSpy = vi.spyOn(adminApi, "createUser").mockResolvedValue(makeUser({ id: 9 }));
        renderPage();

        await openCreate();
        fillCreateForm();
        fireEvent.click(screen.getByLabelText("Active"));
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        await waitFor(() => expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ isActive: false })));
    });

    it("AC-18: shows a duplicate email under the Email field and keeps the panel open", async () => {
        vi.spyOn(adminApi, "createUser").mockRejectedValue(
            new adminApi.UserApiError("This email address is already in use.", "DUPLICATE_EMAIL", {
                email: "This email address is already in use.",
            })
        );
        renderPage();

        await openCreate();
        fillCreateForm();
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        expect(await screen.findByText(/already in use/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save User" })).toBeInTheDocument();
    });

    it("shows only a generic message for an unexpected failure", async () => {
        vi.spyOn(adminApi, "createUser").mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
        renderPage();

        await openCreate();
        fillCreateForm();
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
        expect(screen.queryByText(/econnrefused/i)).not.toBeInTheDocument();
    });

    it("shows Access denied if the server refuses the action with 403", async () => {
        vi.spyOn(adminApi, "createUser").mockRejectedValue(new ForbiddenError());
        renderPage();

        await openCreate();
        fillCreateForm();
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    });

    it("Cancel closes the panel without calling the API", async () => {
        const createSpy = vi.spyOn(adminApi, "createUser");
        renderPage();

        await openCreate();
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.queryByRole("heading", { name: "Create New User" })).not.toBeInTheDocument();
        expect(createSpy).not.toHaveBeenCalled();
    });
});

describe("UserManagement — edit", () => {
    beforeEach(() => {
        vi.mocked(useIsMobile).mockReturnValue(false);
        mockUsers();
    });
    afterEach(() => vi.restoreAllMocks());

    const openEdit = async (name: string) => fireEvent.click(await screen.findByRole("button", { name: `Edit ${name}` }));

    it("prefills the form and sends only the fields that changed", async () => {
        const updateSpy = vi.spyOn(adminApi, "updateUser").mockResolvedValue(makeUser({ name: "Priya N. Nair" }));
        renderPage();

        await openEdit("Priya Nair");
        expect(screen.getByLabelText(/^Full Name/)).toHaveValue("Priya Nair");
        expect(screen.getByLabelText(/^Email Address/)).toHaveValue("priya.nair@example.com");
        expect(screen.getByLabelText(/^Role/)).toHaveValue("REQUESTER");

        fireEvent.change(screen.getByLabelText(/^Full Name/), { target: { value: "Priya N. Nair" } });
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(2, { name: "Priya N. Nair" }));
        expect(await screen.findByText("User updated.")).toBeInTheDocument();
    });

    it("assigns a single role from the Role menu", async () => {
        const updateSpy = vi.spyOn(adminApi, "updateUser").mockResolvedValue(makeUser({ role: "IT_STAFF" }));
        renderPage();

        await openEdit("Priya Nair");
        fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: "IT_STAFF" } });
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(2, { role: "IT_STAFF" }));
    });

    it("does not call the API when nothing changed", async () => {
        const updateSpy = vi.spyOn(adminApi, "updateUser");
        renderPage();

        await openEdit("Priya Nair");
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        expect(await screen.findByText(/no changes to save/i)).toBeInTheDocument();
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it("validates an emptied name before calling the API", async () => {
        const updateSpy = vi.spyOn(adminApi, "updateUser");
        renderPage();

        await openEdit("Priya Nair");
        fireEvent.change(screen.getByLabelText(/^Full Name/), { target: { value: "   " } });
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it("BR-23: Deactivate is disabled on your own account, with the reason shown", async () => {
        const updateSpy = vi.spyOn(adminApi, "updateUser");
        renderPage();

        await openEdit("Alex Thompson");

        expect(screen.getByRole("button", { name: "Deactivate User" })).toBeDisabled();
        expect(screen.getByText(/cannot deactivate your own account/i)).toBeInTheDocument();
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it("warns that changing your own role removes access to this screen", async () => {
        renderPage();

        await openEdit("Alex Thompson");

        expect(screen.getByText(/removes your access to this screen/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^Role/)).toBeEnabled();
    });

    it("BR-24: shows the server's refusal when the last active administrator would be removed", async () => {
        vi.spyOn(adminApi, "updateUser").mockRejectedValue(
            new adminApi.UserApiError(
                "At least one active administrator must remain. Promote another administrator first.",
                "LAST_ADMINISTRATOR"
            )
        );
        renderPage();

        await openEdit("Alex Thompson");
        fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: "IT_STAFF" } });
        fireEvent.click(screen.getByRole("button", { name: "Save User" }));

        expect(await screen.findByText(/at least one active administrator must remain/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save User" })).toBeInTheDocument();
    });

    it("deactivating another user asks for confirmation first", async () => {
        const updateSpy = vi
            .spyOn(adminApi, "updateUser")
            .mockResolvedValue(makeUser({ id: 3, name: "Michael Brown", role: "IT_STAFF", isActive: false }));
        renderPage();

        await openEdit("Michael Brown");
        fireEvent.click(screen.getByRole("button", { name: "Deactivate User" }));
        expect(screen.getByText(/deactivate michael brown\?/i)).toBeInTheDocument();
        expect(updateSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Go back" }));
        expect(screen.queryByText(/deactivate michael brown\?/i)).not.toBeInTheDocument();
        expect(updateSpy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Deactivate User" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirm Deactivation" }));

        await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(3, { isActive: false }));
        expect(await screen.findByText("User deactivated.")).toBeInTheDocument();
    });

    it("reactivates an inactive account at once, and offers no Deactivate button for it", async () => {
        const updateSpy = vi.spyOn(adminApi, "updateUser").mockResolvedValue(makeUser({ id: 4, isActive: true }));
        renderPage();

        await openEdit("Sofia Dupont");
        expect(screen.queryByRole("button", { name: "Deactivate User" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Reactivate User" }));

        await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(4, { isActive: true }));
        expect(await screen.findByText("User reactivated.")).toBeInTheDocument();
    });

    it("AC-21: sets a new initial password after validating it", async () => {
        const resetSpy = vi.spyOn(adminApi, "resetUserPassword").mockResolvedValue();
        renderPage();

        await openEdit("Priya Nair");
        fireEvent.click(screen.getByRole("button", { name: "Set New Password" }));

        fireEvent.change(screen.getByLabelText("New initial password"), { target: { value: "weak" } });
        fireEvent.click(screen.getByRole("button", { name: "Apply New Password" }));
        expect(await screen.findByText(/does not meet the rules/i)).toBeInTheDocument();
        expect(resetSpy).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("New initial password"), { target: { value: "Reset#Pass88" } });
        fireEvent.click(screen.getByRole("button", { name: "Apply New Password" }));

        await waitFor(() => expect(resetSpy).toHaveBeenCalledWith(2, "Reset#Pass88"));
        expect(await screen.findByText(/must change it at next login/i)).toBeInTheDocument();
    });

    it("cancelling the password reset closes the box without calling the API", async () => {
        const resetSpy = vi.spyOn(adminApi, "resetUserPassword");
        renderPage();

        await openEdit("Priya Nair");
        fireEvent.click(screen.getByRole("button", { name: "Set New Password" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel password reset" }));

        expect(screen.queryByLabelText("New initial password")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Set New Password" })).toBeInTheDocument();
        expect(resetSpy).not.toHaveBeenCalled();
    });
});