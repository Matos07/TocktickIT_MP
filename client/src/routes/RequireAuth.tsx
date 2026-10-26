import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { fetchMe } from "../api/auth.js";

// The session cookie survives a page reload but React state does not, so when
// there is no user in memory we ask the server who we are before deciding.
// BR-02 is enforced by the backend too — the redirect below is only UX.
export function RequireAuth({ allowPasswordChange = false }: { allowPasswordChange?: boolean }) {
    const { user, setUser } = useAuth();
    const [checking, setChecking] = useState(user === null);

    useEffect(() => {
        if (user) return;
        let cancelled = false;
        fetchMe()
            .then((u) => {
                if (!cancelled && u) setUser(u);
            })
            .catch(() => {
                // Treated as "no session": the user is sent to Login.
            })
            .finally(() => {
                if (!cancelled) setChecking(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (checking) {
        return (
            <div className="container py-5">
                <p>Loading…</p>
            </div>
        );
    }
    if (!user) return <Navigate to="/login" replace />;
    if (user.mustChangePassword && !allowPasswordChange) return <Navigate to="/change-password" replace />;
    return <Outlet />;
}