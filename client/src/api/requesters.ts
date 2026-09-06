// API wrapper for GET /api/requesters
// Returns only active Development Requesters (BR-05).
// api-spec §3: the server returns 500 (not []) on DB failure — this wrapper
// re-throws so callers can distinguish "zero active" from "fetch failed".

export interface Requester {
  id: number;
  name: string;
  email: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchRequesters(): Promise<Requester[]> {
  const res = await fetch(`${API_BASE}/api/requesters`);
  if (!res.ok) {
    // Propagate server error message if available, else generic.
    let message = "Failed to load requesters.";
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }
  return res.json() as Promise<Requester[]>;
}
