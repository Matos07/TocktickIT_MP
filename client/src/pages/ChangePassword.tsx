import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.js";

type SubmitState = "idle" | "submitting" | "error";

export default function ChangePassword() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitState, setSubmitState] = useState<SubmitState>("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const { user, setUser } = useAuth();
    const navigate = useNavigate();

    const hasMinLength = newPassword.length >= 8;
    const hasCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
    const hasDigitAndSpecial = /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
    const rulesSatisfied = hasMinLength && hasCase && hasDigitAndSpecial;
    const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
    const canSubmit = rulesSatisfied && passwordsMatch && currentPassword.length > 0;

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;

        setSubmitState("submitting");
        setErrorMessage("");

        try {
            await changePassword(currentPassword, newPassword);
            if (user) setUser({ ...user, mustChangePassword: false });
            navigate("/");
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to change password.");
            setSubmitState("error");
        }
    }

    function ruleItem(satisfied: boolean, label: string) {
        return (
            <li style={{ color: satisfied ? "#0B7A46" : "#666" }}>
                {satisfied ? "✓" : "○"} {label}
            </li>
        );
    }

    return (
        <div className="container py-5" style={{ maxWidth: 420 }}>
            <h1 className="h4 mb-2">Change Your Password</h1>
            <p className="text-muted small mb-4">You must change your password to continue.</p>

            <form onSubmit={handleSubmit} noValidate>
                {submitState === "error" && (
                    <div className="alert alert-danger" role="alert">
                        {errorMessage}
                    </div>
                )}

                <div className="mb-3">
                    <label htmlFor="current-password" className="form-label fw-semibold">
                        Current (temporary) password
                    </label>
                    <input
                        id="current-password"
                        type="password"
                        className="form-control"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={submitState === "submitting"}
                    />
                </div>

                <div className="mb-3">
                    <label htmlFor="new-password" className="form-label fw-semibold">
                        New password
                    </label>
                    <input
                        id="new-password"
                        type="password"
                        className="form-control"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={submitState === "submitting"}
                    />
                </div>

                <div className="mb-3">
                    <label htmlFor="confirm-password" className="form-label fw-semibold">
                        Confirm new password
                    </label>
                    <input
                        id="confirm-password"
                        type="password"
                        className="form-control"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={submitState === "submitting"}
                    />
                    {confirmPassword.length > 0 && !passwordsMatch && (
                        <div className="text-danger small mt-1">Passwords do not match.</div>
                    )}
                </div>

                <div className="mb-4 p-3" style={{ backgroundColor: "#F5F7F6" }}>
                    <div className="small fw-semibold mb-1">Password must:</div>
                    <ul className="list-unstyled small mb-0">
                        {ruleItem(hasMinLength, "Be at least 8 characters")}
                        {ruleItem(hasCase, "Include upper and lower case letters")}
                        {ruleItem(hasDigitAndSpecial, "Include a number and a special character")}
                    </ul>
                </div>

                <button type="submit" className="btn btn-success w-100" disabled={!canSubmit || submitState === "submitting"}>
                    {submitState === "submitting" ? "Saving…" : "Continue"}
                </button>
            </form>
        </div>
    );
}