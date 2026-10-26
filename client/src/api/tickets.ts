import { apiFetch, readErrorMessage } from "./http.js";

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus =
    | "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER"
    | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

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
    currentStatus: TicketStatus;
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

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
    const res = await apiFetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    currentStatus: TicketStatus;
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
    status?: TicketStatus;
    sortBy?: "createdAt" | "updatedAt" | "ticketNumber";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
}

export async function fetchTickets(params: FetchTicketsParams = {}): Promise<TicketListResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") query.set(key, String(value));
    });

    const res = await apiFetch(`/api/tickets?${query.toString()}`);
    if (!res.ok) throw new Error(await readErrorMessage(res, `Failed to load tickets (HTTP ${res.status})`));
    return res.json();
}

export interface AttachmentMeta {
    id: number;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    removedAt: string | null;
    removedReason: string | null;
}

export interface TicketDetail extends Ticket {
    requesterConfirmedResolved: boolean;
    attachments: AttachmentMeta[];
}

export class TicketNotFoundError extends Error {
    constructor() {
        super("Ticket not found.");
        this.name = "TicketNotFoundError";
    }
}

export async function fetchTicket(ticketId: number): Promise<TicketDetail> {
    const res = await apiFetch(`/api/tickets/${ticketId}`);
    if (res.status === 404) throw new TicketNotFoundError();
    if (!res.ok) throw new Error(await readErrorMessage(res, `Failed to load ticket (HTTP ${res.status})`));
    return res.json();
}

export interface PublicCommentDto {
    id: number;
    ticketId: number;
    authorId: number;
    authorName: string;
    authorRole: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
    content: string;
    createdAt: string;
}

export async function fetchComments(ticketId: number): Promise<PublicCommentDto[]> {
    const res = await apiFetch(`/api/tickets/${ticketId}/comments`);
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load comments."));
    return res.json();
}

export async function postComment(ticketId: number, content: string): Promise<PublicCommentDto> {
    const res = await apiFetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    });

    if (!res.ok) {
        let message = "Failed to post comment.";
        try {
            const body = await res.json();
            message = body?.error?.fields?.content ?? body?.error?.message ?? message;
        } catch {
            // ignore parse failure
        }
        throw new Error(message);
    }
    return res.json();
}

export async function markResolvedByRequester(ticketId: number): Promise<void> {
    const res = await apiFetch(`/api/tickets/${ticketId}/resolved-by-requester`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{}",
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to update ticket."));
}