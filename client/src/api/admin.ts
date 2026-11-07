import { apiFetch, ForbiddenError } from "./http.js";

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
}

export interface FetchUsersParams {
    search?: string;
    role?: UserRole;
}

// Carries the server's code and per-field messages, so a form can show them under the right input.
export class UserApiError extends Error {
    code?: string;
    fields?: Record<string, string>;
    constructor(message: string, code?: string, fields?: Record<string, string>) {
        super(message);
        this.name = "UserApiError";
        this.code = code;
        this.fields = fields;
    }
}

async function fail(res: Response, fallback: string): Promise<never> {
    if (res.status === 403) throw new ForbiddenError();
    let body: { error?: { message?: string; code?: string; fields?: Record<string, string> } } = {};
    try {
        body = await res.json();
    } catch {
        // ignore parse failure
    }
    throw new UserApiError(body.error?.message ?? fallback, body.error?.code, body.error?.fields);
}

export async function fetchUsers(params: FetchUsersParams = {}): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.role) query.set("role", params.role);

    const res = await apiFetch(`/api/admin/users?${query.toString()}`);
    if (!res.ok) return fail(res, "Failed to load users.");
    return res.json();
}

export interface CreateUserInput {
    name: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    initialPassword: string;
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
    const res = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) return fail(res, "Failed to create the user.");
    return res.json();
}

export type UserChanges = Partial<{ name: string; email: string; role: UserRole; isActive: boolean }>;

export async function updateUser(userId: number, changes: UserChanges): Promise<AdminUser> {
    const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
    });
    if (!res.ok) return fail(res, "Failed to update the user.");
    return res.json();
}

export async function resetUserPassword(userId: number, newPassword: string): Promise<void> {
    const res = await apiFetch(`/api/admin/users/${userId}/reset-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) return fail(res, "Failed to reset the password.");
}