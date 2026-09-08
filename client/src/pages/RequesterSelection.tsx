import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRequesters, Requester } from "../api/requesters.js";
import { useRequester } from "../context/RequesterContext.js";

type LoadState = "loading" | "success" | "error";

export default function RequesterSelection() {
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [requesters, setRequesters] = useState<Requester[]>([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [selectedId, setSelectedId] = useState<string>("");

    const { setRequester } = useRequester();
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        fetchRequesters()
            .then((data) => {
                if (cancelled) return;
                setRequesters(data);
                setLoadState("success");
            })
            .catch((err) => {
                if (cancelled) return;
                setErrorMessage(err instanceof Error ? err.message : "Unknown error");
                setLoadState("error");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function handleContinue() {
        const chosen = requesters.find((r) => String(r.id) === selectedId);
        if (!chosen) return;
        setRequester(chosen);
        navigate("/");
    }

    return (
        <div className="container py-5" style={{ maxWidth: 480 }}>
            <h1 className="h4 mb-2">Select Development Requester</h1>
            <p className="text-muted small mb-4">
                Choose a development requester to simulate the current requester
                context for Lab 2. This is for testing only and is not a login screen.
            </p>

            {loadState === "loading" && <p>Loading…</p>}

            {loadState === "error" && (
                <div className="alert alert-danger">
                    <strong>Unable to load requesters</strong>
                    <p className="mb-2 mt-1">{errorMessage}</p>
                    <button className="btn btn-outline-danger btn-sm" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            )}

            {loadState === "success" && requesters.length === 0 && (
                <div className="alert alert-warning">
                    No active Development Requesters are available. Please contact an
                    administrator.
                </div>
            )}

            {loadState === "success" && requesters.length > 0 && (
                <>
                    <div className="mb-3">
                        <label htmlFor="requester-select" className="form-label fw-semibold">
                            Development Requester <span className="text-danger">*</span>
                        </label>
                        <select
                            id="requester-select"
                            className="form-select"
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                        >
                            <option value="" disabled>
                                Choose a requester…
                            </option>
                            {requesters.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                        <div className="form-text">Only active development requesters are shown.</div>
                    </div>

                    <div className="alert alert-secondary small">
                        <strong>Authentication coming in Lab 3</strong> — this selection
                        will be replaced with secure authentication.
                    </div>

                    <div className="d-flex justify-content-end gap-2">
                        <button className="btn btn-outline-secondary" onClick={() => setSelectedId("")}>
                            Cancel
                        </button>
                        <button className="btn btn-success" disabled={!selectedId} onClick={handleContinue}>
                            Continue →
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}