import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login from "../../src/pages/Login.js";
import { AuthContext } from "../../src/context/AuthContext.js";
import * as authApi from "../../src/api/auth.js";

function renderLogin(setUser = vi.fn()) {
    return render(
        <MemoryRouter initialEntries={["/login"]}>
            <AuthContext.Provider value={{ user: null, setUser }}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/change-password" element={<div>Change Password Screen</div>} />
                    <Route path="/" element={<div>Main App Screen</div>} />
                </Routes>
            </AuthContext.Provider>
        </MemoryRouter>
    );
}

describe("Login", () => {
    afterEach(() => vi.restoreAllMocks());

    it("AC-01: valid credentials redirect to Change Password when mustChangePassword is true", async () => {
        vi.spyOn(authApi, "login").mockResolvedValue({
            id: 1,
            name: "Jennifer Anderson",
            role: "REQUESTER",
            mustChangePassword: true,
        });

        renderLogin();

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jennifer.anderson@example.com" } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123!" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

        expect(await screen.findByText("Change Password Screen")).toBeInTheDocument();
    });

    it("redirects to the main app when mustChangePassword is false", async () => {
        vi.spyOn(authApi, "login").mockResolvedValue({
            id: 1,
            name: "Jennifer Anderson",
            role: "REQUESTER",
            mustChangePassword: false,
        });

        renderLogin();

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jennifer.anderson@example.com" } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123!" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

        expect(await screen.findByText("Main App Screen")).toBeInTheDocument();
    });

    it("AC-05/BR-06: shows the generic invalid-credentials message", async () => {
        vi.spyOn(authApi, "login").mockRejectedValue(
            new authApi.LoginError("Invalid email or password.", "INVALID_CREDENTIALS")
        );

        renderLogin();

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "nobody@example.com" } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

        expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    });

    it("AC-06/BR-07: shows the distinct inactive-account message", async () => {
        vi.spyOn(authApi, "login").mockRejectedValue(
            new authApi.LoginError("This account is inactive. Contact an administrator.", "ACCOUNT_INACTIVE")
        );

        renderLogin();

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "sofia.dupont@example.com" } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123!" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

        expect(await screen.findByText(/account is inactive/i)).toBeInTheDocument();
    });

    it("disables the Sign In button while the request is in flight", async () => {
        let resolveLogin: (value: any) => void;
        const pending = new Promise((resolve) => {
            resolveLogin = resolve;
        });
        vi.spyOn(authApi, "login").mockReturnValue(pending as any);

        renderLogin();

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jennifer.anderson@example.com" } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "Password123!" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

        expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();

        resolveLogin!({ id: 1, name: "Jennifer Anderson", role: "REQUESTER", mustChangePassword: false });
        await waitFor(() => expect(screen.getByText("Main App Screen")).toBeInTheDocument());
    });
});