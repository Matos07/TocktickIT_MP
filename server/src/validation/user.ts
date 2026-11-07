import { validatePasswordComplexity } from "../auth/password.js";

export const ROLES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
export type RoleValue = (typeof ROLES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase();
}

export function isRole(value: unknown): value is RoleValue {
    return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

interface UserInput {
    name?: unknown;
    email?: unknown;
    role?: unknown;
    isActive?: unknown;
    initialPassword?: unknown;
}

// Only these fields are ever read from the body, so nothing else (passwordHash, id, ...) can be written.
// BR-21: `role` must be exactly one valid role, never a list.
export function validateUserInput(input: UserInput, mode: "create" | "update") {
    const fields: Record<string, string> = {};
    const data: { name?: string; email?: string; role?: RoleValue; isActive?: boolean; initialPassword?: string } = {};
    const required = mode === "create";

    if (input.name !== undefined || required) {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (name.length < 1 || name.length > 100) fields.name = "Name is required (1-100 characters).";
        else data.name = name;
    }

    if (input.email !== undefined || required) {
        const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
        if (email.length > 254 || !EMAIL_PATTERN.test(email)) fields.email = "A valid email address is required.";
        else data.email = email;
    }

    if (input.role !== undefined || required) {
        if (isRole(input.role)) data.role = input.role;
        else fields.role = "Role must be exactly one of REQUESTER, IT_STAFF or ADMINISTRATOR.";
    }

    if (input.isActive !== undefined) {
        if (typeof input.isActive === "boolean") data.isActive = input.isActive;
        else fields.isActive = "isActive must be true or false.";
    }

    if (mode === "create") {
        const password = typeof input.initialPassword === "string" ? input.initialPassword : "";
        const problems = validatePasswordComplexity(password);
        if (problems.length > 0) fields.initialPassword = problems.join(" ");
        else data.initialPassword = password;
    }

    return { fields, data };
}