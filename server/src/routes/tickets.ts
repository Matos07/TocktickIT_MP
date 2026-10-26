import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { validateCreateTicketInput } from "../validation/ticket.js";
import { ticketAttachmentsRouter } from "./attachments.js";
import { requireAuth, requirePasswordChanged, requireRole } from "../middleware/auth.js";
import { commentsRouter } from "./comments.js";

export const ticketsRouter = Router();

// BR-02 / BR-03: every route below needs a valid session whose user has already
// changed their initial password. Ownership always comes from req.user, never
// from anything the client sends (header, body, or query string).
ticketsRouter.use(requireAuth, requirePasswordChanged);

// BR-01: ticketNumber = TKT-{creation year}-{6-digit zero-padded, based on id}.
function generateTicketNumber(id: number, createdAt: Date): string {
    const year = createdAt.getFullYear();
    const padded = String(id).padStart(6, "0");
    return `TKT-${year}-${padded}`;
}

// POST /api/tickets — AC-01, AC-04, BR-12, BR-13, BR-16 (attachments stay decoupled).
ticketsRouter.post("/", requireRole("REQUESTER"), async (req: Request, res: Response) => {
    const prisma = getPrisma();

    try {
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

        const requesterId = req.user!.id;

        // Create with a unique placeholder, then set the real ticketNumber from the
        // assigned id — inside one transaction so no half-numbered Ticket is visible.
        const ticket = await prisma.$transaction(async (tx) => {
            const created = await tx.ticket.create({
                data: {
                    ticketNumber: `PENDING-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    requesterId,
                    categoryId,
                    relatedSystemId,
                    summary,
                    description,
                    requestedPriority,
                    itPriority: requestedPriority, // BR-16 (Lab 3): IT Priority initially copies Requested Priority
                },
            });

            return tx.ticket.update({
                where: { id: created.id },
                data: { ticketNumber: generateTicketNumber(created.id, created.createdAt) },
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
const VALID_STATUSES = new Set([
    "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
]);
const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

// GET /api/tickets — search/filter/sort/pagination, scoped to the session user.
// AC-09..AC-13, BR-08, BR-09, BR-10, BR-23.
ticketsRouter.get("/", requireRole("REQUESTER"), async (req: Request, res: Response) => {
    const prisma = getPrisma();

    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));

        const sortByParam = String(req.query.sortBy ?? "");
        const sortBy = SORTABLE_FIELDS.has(sortByParam) ? sortByParam : "createdAt";
        const sortOrderParam = String(req.query.sortOrder ?? "");
        const sortOrder = SORT_ORDERS.has(sortOrderParam) ? sortOrderParam : "desc";

        const where: Record<string, unknown> = { requesterId: req.user!.id };

        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        if (search) {
            where.OR = [
                { ticketNumber: { contains: search, mode: "insensitive" } },
                { summary: { contains: search, mode: "insensitive" } },
            ];
        }

        const categoryId = Number(req.query.categoryId);
        if (Number.isInteger(categoryId) && categoryId > 0) where.categoryId = categoryId;

        const requestedPriority = String(req.query.requestedPriority ?? "");
        if (VALID_PRIORITIES.has(requestedPriority)) where.requestedPriority = requestedPriority;

        const status = String(req.query.status ?? "");
        if (VALID_STATUSES.has(status)) where.currentStatus = status;

        const [totalItems, tickets] = await Promise.all([
            prisma.ticket.count({ where }),
            prisma.ticket.findMany({
                where,
                orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
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
            pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 0 },
        });
    } catch (err) {
        console.error("[GET /api/tickets]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to retrieve tickets. Please try again." },
        });
    }
});

ticketsRouter.use("/:id/attachments", ticketAttachmentsRouter);
ticketsRouter.use("/:id/comments", commentsRouter);

// GET /api/tickets/:id — owned ticket detail + attachments. AC-14, BR-24.
ticketsRouter.get("/:id", requireRole("REQUESTER"), async (req: Request, res: Response) => {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
        return;
    }

    try {
        const ticket = await prisma.ticket.findFirst({
            where: { id: ticketId, requesterId: req.user!.id },
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

// PATCH /api/tickets/:id/resolved-by-requester — AC-10, BR-05.
// Sets a hint for IT Staff only; the formal currentStatus is never touched here.
// Ownership sits inside the WHERE clause, so the check and the write are atomic.
ticketsRouter.patch("/:id/resolved-by-requester", requireRole("REQUESTER"), async (req: Request, res: Response) => {
    const ticketId = Number(req.params.id);

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
        return;
    }

    try {
        const result = await getPrisma().ticket.updateMany({
            where: { id: ticketId, requesterId: req.user!.id },
            data: { requesterConfirmedResolved: true },
        });

        if (result.count === 0) {
            res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
            return;
        }

        res.status(200).json({ requesterConfirmedResolved: true });
    } catch (err) {
        console.error("[PATCH /api/tickets/:id/resolved-by-requester]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to update ticket. Please try again." },
        });
    }
});