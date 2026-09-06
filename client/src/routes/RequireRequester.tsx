import { Navigate, Outlet } from "react-router-dom";
import { useRequester } from "../context/RequesterContext.js";

export function RequireRequester() {
    const { requester } = useRequester();

    if (!requester) {
        return <Navigate to="/select-requester" replace />;
    }

    return <Outlet />;
}