export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";

export interface CreateTicketPayload {
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    description: string;
    requestedPriority: RequestedPriority;
}

export interface Ticket {
    id: number;
    ticketNumber: string;
    requesterId: number;
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    description: string;
    requestedPriority: RequestedPriority;
    itPriority: RequestedPriority | null;
    currentStatus: "NEW";
    createdAt: string;
    updatedAt: string;
}

export class CreateTicketError extends Error {
    fields?: Record<string, string>;
    constructor(message: string, fields?: Record<string, string>) {
        super(message);
        this.fields = fields;
    }
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function createTicket(
    requesterId: number,
    payload: CreateTicketPayload
): Promise<Ticket> {
    const res = await fetch(`${API_BASE}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requester-id": String(requesterId) },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        let body: { error?: { message?: string; fields?: Record<string, string> } } = {};
        try {
            body = await res.json();
        } catch {
            // ignore parse failure
        }
        throw new CreateTicketError(
            body.error?.message ?? `Failed to create ticket (HTTP ${res.status})`,
            body.error?.fields
        );
    }

    return res.json();
}

export interface TicketListItem {
    id: number;
    ticketNumber: string;
    summary: string;
    categoryId: number;
    requestedPriority: RequestedPriority;
    itPriority: RequestedPriority | null;
    currentStatus: "NEW";
    createdAt: string;
    updatedAt: string;
}

export interface TicketListResponse {
    data: TicketListItem[];
    pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface FetchTicketsParams {
    search?: string;
    categoryId?: number;
    requestedPriority?: RequestedPriority;
    status?: "NEW";
    sortBy?: "createdAt" | "updatedAt" | "ticketNumber";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
}

export async function fetchTickets(
    requesterId: number,
    params: FetchTicketsParams = {}
): Promise<TicketListResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") query.set(key, String(value));
    });

    const res = await fetch(`${API_BASE}/api/tickets?${query.toString()}`, {
        headers: { "x-requester-id": String(requesterId) },
    });
    if (!res.ok) throw new Error(`Failed to load tickets (HTTP ${res.status})`);
    return res.json();
}