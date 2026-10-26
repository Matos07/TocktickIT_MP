export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${API_BASE}${path}`, { ...init, credentials: "include" });
}

export async function readErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const body = await res.json();
        return body?.error?.message ?? fallback;
    } catch {
        return fallback;
    }
}