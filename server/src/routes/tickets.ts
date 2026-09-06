import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { validateCreateTicketInput } from "../validation/ticket.js";
import { ticketAttachmentsRouter } from "./attachments.js";

export const ticketsRouter = Router();

// BR-01: ticketNumber = TKT-{creation year}-{6-digit zero-padded, based on id}.
function generateTicketNumber(id: number, createdAt: Date): string {
    const year = createdAt.getFullYear();
    const padded = String(id).padStart(6, "0");
    return `TKT-${year}-${padded}`;
}

// POST /api/tickets
// AC-01: valid data, no attachments -> 201, Ticket saved, ticket number returned.
// AC-04: missing Summary -> 400 with field-level error, nothing persisted.
// BR-12: categoryId/relatedSystemId must reference an existing, active record.
// BR-16: attachment upload is decoupled — this endpoint never touches attachments.
ticketsRouter.post("/", async (req: Request, res: Response) => {
    const prisma = getPrisma();

    // Resolve and validate the requester context (stand-in for auth, api-spec §4).
    const requesterId = Number(req.header("x-requester-id"));
    if (!Number.isInteger(requesterId) || requesterId <= 0) {
        res.status(404).json({
            error: { code: "REQUESTER_NOT_FOUND", message: "No active requester context." },
        });
        return;
    }

    try {
        const requester = await prisma.developmentRequester.findFirst({
            where: { id: requesterId, isActive: true },
            select: { id: true },
        });
        if (!requester) {
            res.status(404).json({
                error: { code: "REQUESTER_NOT_FOUND", message: "No active requester context." },
            });
            return;
        }

        const result = validateCreateTicketInput(req.body ?? {});
        if (!result.valid || !result.data) {
            res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "One or more fields are invalid.",
                    fields: result.fields,
                },
            });
            return;
        }

        const { categoryId, relatedSystemId, summary, description, requestedPriority } = result.data;

        // BR-12: category must exist; related system must exist and be active.
        const [category, relatedSystem] = await Promise.all([
            prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }),
            prisma.relatedSystem.findFirst({
                where: { id: relatedSystemId, isActive: true },
                select: { id: true },
            }),
        ]);

        if (!category || !relatedSystem) {
            res.status(400).json({
                error: {
                    code: "INVALID_REFERENCE",
                    message: "categoryId or relatedSystemId does not reference an active record.",
                },
            });
            return;
        }

        // Create with a temporary placeholder to satisfy the unique constraint,
        // then compute and set the real ticketNumber from the assigned id — all
        // inside one transaction so no half-numbered Ticket is ever visible.
        const ticket = await prisma.$transaction(async (tx) => {
            const created = await tx.ticket.create({
                data: {
                    ticketNumber: `PENDING-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    requesterId: requester.id,
                    categoryId,
                    relatedSystemId,
                    summary,
                    description,
                    requestedPriority,
                },
            });

            const ticketNumber = generateTicketNumber(created.id, created.createdAt);

            return tx.ticket.update({
                where: { id: created.id },
                data: { ticketNumber },
            });
        });

        res.status(201).json(ticket);
    } catch (err) {
        console.error("[POST /api/tickets]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to create ticket. Please try again." },
        });
    }
});

const SORTABLE_FIELDS = new Set(["createdAt", "updatedAt", "ticketNumber"]);
const SORT_ORDERS = new Set(["asc", "desc"]);
const VALID_STATUSES = new Set(["NEW"]);
const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

// GET /api/tickets — search/filter/sort/pagination, ownership-scoped.
// AC-09, AC-10, AC-11, AC-12, AC-13. BR-08, BR-09, BR-10, BR-23.
ticketsRouter.get("/", async (req: Request, res: Response) => {
    const prisma = getPrisma();

    try {
        const requesterId = Number(req.header("x-requester-id"));
        if (!Number.isInteger(requesterId) || requesterId <= 0) {
            res.status(404).json({ error: { code: "REQUESTER_NOT_FOUND", message: "No active requester context." } });
            return;
        }
        const requester = await prisma.developmentRequester.findFirst({
            where: { id: requesterId, isActive: true },
            select: { id: true },
        });
        if (!requester) {
            res.status(404).json({ error: { code: "REQUESTER_NOT_FOUND", message: "No active requester context." } });
            return;
        }

        // BR-10: default pageSize 10, clamped to 1-50, never rejected.
        const page = Math.max(1, Number(req.query.page) || 1);
        const rawPageSize = Number(req.query.pageSize) || 10;
        const pageSize = Math.min(50, Math.max(1, rawPageSize));

        // BR-09: default sort createdAt desc; unknown values fall back silently.
        const sortByParam = String(req.query.sortBy ?? "");
        const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : "createdAt";
        const sortOrderParam = String(req.query.sortOrder ?? "");
        const sortOrder = SORT_ORDERS.has(sortOrderParam) ? sortOrderParam : "desc";

        const where: Record<string, unknown> = { requesterId: requester.id };

        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        if (search) {
            where.OR = [
                { ticketNumber: { contains: search, mode: "insensitive" } },
                { summary: { contains: search, mode: "insensitive" } },
            ];
        }

        const categoryId = Number(req.query.categoryId);
        if (Number.isInteger(categoryId) && categoryId > 0) {
            where.categoryId = categoryId;
        }

        const requestedPriority = String(req.query.requestedPriority ?? "");
        if (VALID_PRIORITIES.has(requestedPriority)) {
            where.requestedPriority = requestedPriority;
        }

        const status = String(req.query.status ?? "");
        if (VALID_STATUSES.has(status)) {
            where.currentStatus = status;
        }

        const [totalItems, tickets] = await Promise.all([
            prisma.ticket.count({ where }),
            prisma.ticket.findMany({
                where,
                orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }], // secondary sort for stable ordering
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    ticketNumber: true,
                    summary: true,
                    categoryId: true,
                    requestedPriority: true,
                    itPriority: true,
                    currentStatus: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
        ]);

        res.status(200).json({
            data: tickets,
            pagination: {
                page,
                pageSize,
                totalItems,
                totalPages: Math.ceil(totalItems / pageSize) || 0,
            },
        });
    } catch (err) {
        console.error("[GET /api/tickets]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to retrieve tickets. Please try again." },
        });
    }
});

ticketsRouter.use("/:id/attachments", ticketAttachmentsRouter);

// GET /api/tickets/:id — owned ticket detail + attachments (api-spec §6).
ticketsRouter.get("/:id", async (req: Request, res: Response) => {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);

    try {
        const requesterId = Number(req.header("x-requester-id"));
        if (!Number.isInteger(requesterId) || requesterId <= 0) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
            return;
        }

        const ticket = await prisma.ticket.findFirst({
            where: { id: ticketId, requesterId },
            include: {
                attachments: {
                    select: {
                        id: true,
                        originalFileName: true,
                        mimeType: true,
                        sizeBytes: true,
                        uploadedAt: true,
                        removedAt: true,
                        removedReason: true,
                    },
                },
            },
        });

        if (!ticket) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
            return;
        }

        res.status(200).json(ticket);
    } catch (err) {
        console.error("[GET /api/tickets/:id]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to retrieve ticket. Please try again." },
        });
    }
});