import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, AuthContext } from "../../src/context/AuthContext.js";
import { RequireAuth } from "../../src/routes/RequireAuth.js";
import { RequireRole } from "../../src/routes/RequireRole.js";
import * as authApi from "../../src/api/auth.js";

const requester = { id: 1, name: "Jennifer Anderson", role: "REQUESTER" as const, mustChangePassword: false };
const staff = { id: 2, name: "Michael Brown", role: "IT_STAFF" as const, mustChangePassword: false };

function renderGuarded() {
    return render(
        <MemoryRouter initialEntries={["/"]}>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<div>Login Screen</div>} />
                    <Route path="/change-password" element={<div>Change Password Screen</div>} />
                    <Route element={<RequireAuth />}>
                        <Route path="/" element={<div>Protected Screen</div>} />
                    </Route>
                </Routes>
            </AuthProvider>
        </MemoryRouter>
    );
}

describe("RequireAuth", () => {
    afterEach(() => vi.restoreAllMocks());

    it("AC-07: redirects to Login when there is no valid session", async () => {
        vi.spyOn(authApi, "fetchMe").mockResolvedValue(null);

        renderGuarded();

        expect(await screen.findByText("Login Screen")).toBeInTheDocument();
        expect(screen.queryByText("Protected Screen")).not.toBeInTheDocument();
    });

    it("restores the session after a page reload and shows the protected screen", async () => {
        vi.spyOn(authApi, "fetchMe").mockResolvedValue(requester);

        renderGuarded();

        expect(await screen.findByText("Protected Screen")).toBeInTheDocument();
    });

    it("AC-02: redirects to Change Password while the initial password has not been changed", async () => {
        vi.spyOn(authApi, "fetchMe").mockResolvedValue({ ...requester, mustChangePassword: true });

        renderGuarded();

        expect(await screen.findByText("Change Password Screen")).toBeInTheDocument();
        expect(screen.queryByText("Protected Screen")).not.toBeInTheDocument();
    });
});

describe("RequireRole", () => {
    function renderForRole(user: typeof requester | typeof staff) {
        return render(
            <MemoryRouter initialEntries={["/"]}>
                <AuthContext.Provider value={{ user, setUser: vi.fn() }}>
                    <Routes>
                        <Route element={<RequireRole roles={["REQUESTER"]} />}>
                            <Route path="/" element={<div>Requester Screen</div>} />
                        </Route>
                    </Routes>
                </AuthContext.Provider>
            </MemoryRouter>
        );
    }

    it("renders the screen for a permitted role", () => {
        renderForRole(requester);
        expect(screen.getByText("Requester Screen")).toBeInTheDocument();
    });

    it("shows Access denied for a role without access", () => {
        renderForRole(staff);
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
        expect(screen.queryByText("Requester Screen")).not.toBeInTheDocument();
    });
});