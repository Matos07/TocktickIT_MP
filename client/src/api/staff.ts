import { apiFetch, ForbiddenError, readErrorMessage } from "./http.js";
import { RequestedPriority, TicketStatus } from "./tickets.js";

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