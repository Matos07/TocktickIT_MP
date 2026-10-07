import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ChangePassword from "../../src/pages/ChangePassword.js";
import { AuthContext } from "../../src/context/AuthContext.js";
import * as authApi from "../../src/api/auth.js";

const mockUser = { id: 1, name: "Jennifer Anderson", role: "REQUESTER" as const, mustChangePassword: true };

function renderChangePassword(setUser = vi.fn()) {
    return render(
        <MemoryRouter initialEntries={["/change-password"]}>
            <AuthContext.Provider value={{ user: mockUser, setUser }}>
                <Routes>
                    <Route path="/change-password" element={<ChangePassword />} />
                    <Route path="/" element={<div>Main App Screen</div>} />
                </Routes>
            </AuthContext.Provider>
        </MemoryRouter>
    );
}

describe("ChangePassword", () => {
    afterEach(() => vi.restoreAllMocks());

    it("AC-02: Continue is disabled until all rules pass and confirmation matches", () => {
        renderChangePassword();

        const continueButton = screen.getByRole("button", { name: /continue/i });
        expect(continueButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/current \(temporary\) password/i), { target: { value: "Password123!" } });
        fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "weak" } });
        expect(continueButton).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewValid123!" } });
        expect(continueButton).toBeDisabled(); // confirm not filled yet

        fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewValid123!" } });
        expect(continueButton).toBeEnabled();
    });

    it("shows the live checklist updating as the password is typed", () => {
        renderChangePassword();

        fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "ab" } });
        expect(screen.getByText(/be at least 8 characters/i)).toHaveStyle({ color: "#666" });

        fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewValid123!" } });
        expect(screen.getByText(/be at least 8 characters/i)).toHaveStyle({ color: "#0B7A46" });
    });

    it("submits and navigates to the main app on success", async () => {
        const setUser = vi.fn();
        vi.spyOn(authApi, "changePassword").mockResolvedValue();

        renderChangePassword(setUser);

        fireEvent.change(screen.getByLabelText(/current \(temporary\) password/i), { target: { value: "Password123!" } });
        fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewValid123!" } });
        fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewValid123!" } });
        fireEvent.click(screen.getByRole("button", { name: /continue/i }));

        await waitFor(() => expect(screen.getByText("Main App Screen")).toBeInTheDocument());
        expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ mustChangePassword: false }));
    });

    it("shows an error banner when the current password is wrong", async () => {
        vi.spyOn(authApi, "changePassword").mockRejectedValue(new Error("Current password is incorrect."));

        renderChangePassword();

        fireEvent.change(screen.getByLabelText(/current \(temporary\) password/i), { target: { value: "wrong-one" } });
        fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "NewValid123!" } });
        fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: "NewValid123!" } });
        fireEvent.click(screen.getByRole("button", { name: /continue/i }));

        expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
    });
});