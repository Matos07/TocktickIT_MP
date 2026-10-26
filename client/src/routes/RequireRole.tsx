import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { AuthUser } from "../api/auth.js";

export function Forbidden() {
    return (
        <div className="container py-5" style={{ maxWidth: 640 }}>
            <div className="alert alert-warning" role="alert">
                <strong>Access denied</strong>
                <p className="mb-0 mt-1">You don't have access to this page.</p>
            </div>
        </div>
    );
}

// UX only: every endpoint behind these screens is authorized server-side as well.
export function RequireRole({ roles }: { roles: AuthUser["role"][] }) {
    const { user } = useAuth();
    if (!user || !roles.includes(user.role)) return <Forbidden />;
    return <Outlet />;
}