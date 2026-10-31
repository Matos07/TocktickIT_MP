import { Request } from "express";

const SORTABLE_FIELDS = new Set(["createdAt", "updatedAt", "ticketNumber"]);
const SORT_ORDERS = new Set(["asc", "desc"]);
const VALID_STATUSES = new Set([
    "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
]);
const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

// Shared by the Requester list and the IT Staff queue. `baseWhere` carries the scope
// (the requester's own tickets, or nothing for staff); the filters below only narrow it.
export function parseTicketListQuery(
    query: Request["query"],
    baseWhere: Record<string, unknown>,
    options: { staff?: boolean } = {}
) {
    // BR-10: default 10, clamped to 1-50, never rejected.
    const page = Math.max(1, Math.floor(Number(query.page)) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(Number(query.pageSize)) || 10));

    // BR-09: default createdAt desc, with id as a stable tie-breaker.
    const sortByParam = String(query.sortBy ?? "");
    const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : "createdAt";
    const sortOrderParam = String(query.sortOrder ?? "");
    const sortOrder = SORT_ORDERS.has(sortOrderParam) ? sortOrderParam : "desc";

    const where: Record<string, unknown> = { ...baseWhere };

    const search = typeof query.search === "string" ? query.search.trim() : "";
    if (search) {
        where.OR = [
            { ticketNumber: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
        ];
    }

    const categoryId = Number(query.categoryId);
    if (Number.isInteger(categoryId) && categoryId > 0) where.categoryId = categoryId;

    const requestedPriority = String(query.requestedPriority ?? "");
    if (VALID_PRIORITIES.has(requestedPriority)) where.requestedPriority = requestedPriority;

    const status = String(query.status ?? "");
    if (VALID_STATUSES.has(status)) where.currentStatus = status;

    // Staff-only filters: a Requester's list can never be widened or re-scoped by them.
    if (options.staff) {
        const itPriority = String(query.itPriority ?? "");
        if (VALID_PRIORITIES.has(itPriority)) where.itPriority = itPriority;

        const ownerId = String(query.ownerId ?? "");
        if (ownerId === "unassigned") where.ticketOwnerId = null;
        else if (/^\d+$/.test(ownerId) && Number(ownerId) > 0) where.ticketOwnerId = Number(ownerId);
    }

    return { where, orderBy: [{ [sortBy]: sortOrder }, { id: "asc" as const }], page, pageSize };
}