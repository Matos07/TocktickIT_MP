import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, LoginError } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.js";

type SubmitState = "idle" | "submitting" | "error";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitState, setSubmitState] = useState<SubmitState>("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const { setUser } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!email || !password) {
            setErrorMessage("Email and password are required.");
            setSubmitState("error");
            return;
        }

        setSubmitState("submitting");
        setErrorMessage("");

        try {
            const user = await login(email, password);
            setUser(user);
            navigate(user.mustChangePassword ? "/change-password" : "/");
        } catch (err) {
            setErrorMessage(err instanceof LoginError ? err.message : "Login failed.");
            setSubmitState("error");
        }
    }

    return (
        <div className="container py-5" style={{ maxWidth: 420 }}>
            <h1 className="h4 mb-4 text-center">
                TokTickIT <span style={{ color: "#006B3C" }}>Sign In</span>
            </h1>

            <form onSubmit={handleSubmit} noValidate>
                {submitState === "error" && (
                    <div className="alert alert-danger" role="alert">
                        {errorMessage}
                    </div>
                )}

                <div className="mb-3">
                    <label htmlFor="email" className="form-label fw-semibold">
                        Email address
                    </label>
                    <input
                        id="email"
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={submitState === "submitting"}
                    />
                </div>

                <div className="mb-4">
                    <label htmlFor="password" className="form-label fw-semibold">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={submitState === "submitting"}
                    />
                </div>

                <button type="submit" className="btn btn-success w-100" disabled={submitState === "submitting"}>
                    {submitState === "submitting" ? "Signing in…" : "Sign In"}
                </button>
            </form>
        </div>
    );
}