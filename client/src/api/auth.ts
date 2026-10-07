export interface AuthUser {
    id: number;
    name: string;
    role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
    mustChangePassword: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class LoginError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
        super(message);
        this.code = code;
    }
}

export async function login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include", // required for the session cookie to be set cross-origin
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        let message = "Login failed.";
        let code: string | undefined;
        try {
            const body = await res.json();
            message = body?.error?.message ?? message;
            code = body?.error?.code;
        } catch {
            // ignore parse failure
        }
        throw new LoginError(message, code);
    }
    return res.json();
}

export async function logout(): Promise<void> {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
}

export async function fetchMe(): Promise<AuthUser | null> {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`Failed to load current user (HTTP ${res.status})`);
    return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/password`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
        let message = "Failed to change password.";
        try {
            const body = await res.json();
            message = body?.error?.message ?? message;
        } catch {
            // ignore
        }
        throw new Error(message);
    }
}