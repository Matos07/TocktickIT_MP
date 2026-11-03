import { apiFetch, ForbiddenError, readErrorMessage } from "./http.js";
import { AttachmentMeta, PublicCommentDto, RequestedPriority, TicketNotFoundError, TicketStatus } from "./tickets.js";

export interface StaffTicketListItem {
    id: number;
    ticketNumber: string;
    summary: string;
    categoryId: number;
    requestedPriority: RequestedPriority;
    itPriority: RequestedPriority | null;
    currentStatus: TicketStatus;
    ticketOwnerId: number | null;
    ticketOwnerName: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface StaffTicketListResponse {
    data: StaffTicketListItem[];
    pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export interface FetchStaffTicketsParams {
    search?: string;
    categoryId?: number;
    requestedPriority?: RequestedPriority;
    itPriority?: RequestedPriority;
    status?: TicketStatus;
    ownerId?: number | "unassigned";
    sortBy?: "createdAt" | "updatedAt" | "ticketNumber";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
}

export async function fetchStaffTickets(params: FetchStaffTicketsParams = {}): Promise<StaffTicketListResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") query.set(key, String(value));
    });

    const res = await apiFetch(`/api/staff/tickets?${query.toString()}`);
    if (res.status === 403) throw new ForbiddenError();
    if (!res.ok) throw new Error(await readErrorMessage(res, `Failed to load the ticket queue (HTTP ${res.status})`));
    return res.json();
}

export interface Assignee {
    id: number;
    name: string;
    role: "IT_STAFF" | "ADMINISTRATOR";
}

export async function fetchAssignees(): Promise<Assignee[]> {
    const res = await apiFetch("/api/staff/assignees");
    if (res.status === 403) throw new ForbiddenError();
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load assignees."));
    return res.json();
}
export interface StaffTicketDetail {
    id: number;
    ticketNumber: string;
    requesterId: number;
    requesterName: string;
    categoryId: number;
    categoryName: string;
    relatedSystemId: number;
    relatedSystemName: string;
    summary: string;
    description: string;
    requestedPriority: RequestedPriority;
    itPriority: RequestedPriority | null;
    currentStatus: TicketStatus;
    ticketOwnerId: number | null;
    ticketOwnerName: string | null;
    requesterConfirmedResolved: boolean;
    allowedTransitions: TicketStatus[];
    attachments: AttachmentMeta[];
    createdAt: string;
    updatedAt: string;
}

export async function fetchStaffTicket(ticketId: number): Promise<StaffTicketDetail> {
    const res = await apiFetch(`/api/staff/tickets/${ticketId}`);
    if (res.status === 403) throw new ForbiddenError();
    if (res.status === 404) throw new TicketNotFoundError();
    if (!res.ok) throw new Error(await readErrorMessage(res, `Failed to load the ticket (HTTP ${res.status})`));
    return res.json();
}

// Every operation answers with the updated detail, so the screen simply replaces its state.
async function staffPatch(path: string, body: object, fallback: string): Promise<StaffTicketDetail> {
    const res = await apiFetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (res.status === 403) throw new ForbiddenError();
    if (!res.ok) throw new Error(await readErrorMessage(res, fallback));
    return res.json();
}

export function claimTicket(ticketId: number): Promise<StaffTicketDetail> {
    return staffPatch(`/api/staff/tickets/${ticketId}/claim`, {}, "Failed to claim the ticket.");
}

export function assignTicket(ticketId: number, ticketOwnerId: number): Promise<StaffTicketDetail> {
    return staffPatch(`/api/staff/tickets/${ticketId}/assign`, { ticketOwnerId }, "Failed to assign the ticket.");
}

export function setItPriority(ticketId: number, itPriority: RequestedPriority): Promise<StaffTicketDetail> {
    return staffPatch(`/api/staff/tickets/${ticketId}/priority`, { itPriority }, "Failed to update the priority.");
}

export function setTicketStatus(ticketId: number, status: TicketStatus): Promise<StaffTicketDetail> {
    return staffPatch(`/api/staff/tickets/${ticketId}/status`, { status }, "Failed to update the status.");
}

export async function downloadStaffAttachment(attachmentId: number): Promise<Blob> {
    const res = await apiFetch(`/api/staff/attachments/${attachmentId}/download`);
    if (!res.ok) throw new Error(`Failed to download attachment (HTTP ${res.status})`);
    return res.blob();
}

export type InternalNoteDto = PublicCommentDto; // same shape as a public comment

export async function fetchInternalNotes(ticketId: number): Promise<InternalNoteDto[]> {
    const res = await apiFetch(`/api/tickets/${ticketId}/internal-notes`);
    if (res.status === 403) throw new Error("You don't have access to internal notes.");
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load internal notes."));
    return res.json();
}

export async function postInternalNote(ticketId: number, content: string): Promise<InternalNoteDto> {
    const res = await apiFetch(`/api/tickets/${ticketId}/internal-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    });

    if (!res.ok) {
        let message = "Failed to post the note.";
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