import path from "path";
import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { requireAuth, requirePasswordChanged, requireRole } from "../middleware/auth.js";
import { parseTicketListQuery } from "../lib/ticketQuery.js";
import { allowedTransitions, isTicketStatus, isTransitionAllowed } from "../lib/ticketStatus.js";
import { UPLOAD_DIR } from "../upload.js";

export const staffRouter = Router();

// Authorization matrix (specification.md §5.2): the whole /api/staff surface is
// IT Staff + Administrator only, and never reachable before the initial password is changed.
staffRouter.use(requireAuth, requirePasswordChanged, requireRole("IT_STAFF", "ADMINISTRATOR"));

const VALID_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH"]);

function parseId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function notFound(res: Response, message = "Ticket not found.") {
    res.status(404).json({ error: { code: "NOT_FOUND", message } });
}

function badRequest(res: Response, code: string, message: string, fields?: Record<string, string>) {
    res.status(400).json({ error: { code, message, ...(fields ? { fields } : {}) } });
}

function serverError(res: Response, route: string, err: unknown, message: string) {
    console.error(`[${route}]`, err);
    res.status(500).json({ error: { code: "SERVER_ERROR", message } });
}

// One shape for the detail screen and for every PATCH response, so the UI can simply replace its state.
async function findTicketDetail(ticketId: number) {
    const ticket = await getPrisma().ticket.findUnique({
        where: { id: ticketId },
        select: {
            id: true,
            ticketNumber: true,
            requesterId: true,
            categoryId: true,
            relatedSystemId: true,
            summary: true,
            description: true,
            requestedPriority: true,
            itPriority: true,
            currentStatus: true,
            ticketOwnerId: true,
            requesterConfirmedResolved: true,
            createdAt: true,
            updatedAt: true,
            requester: { select: { name: true } },
            ticketOwner: { select: { name: true } },
            category: { select: { name: true } },
            relatedSystem: { select: { name: true } },
            attachments: {
                orderBy: { id: "asc" },
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
    if (!ticket) return null;

    const { requester, ticketOwner, category, relatedSystem, ...fields } = ticket;
    return {
        ...fields,
        requesterName: requester.name,
        ticketOwnerName: ticketOwner?.name ?? null,
        categoryName: category.name,
        relatedSystemName: relatedSystem.name,
        // Single source of truth for BR-17: the UI only ever offers these.
        allowedTransitions: allowedTransitions(ticket.currentStatus),
    };
}

// GET /api/staff/tickets: the shared queue. AC-11, BR-09, BR-10.
staffRouter.get("/tickets", async (req: Request, res: Response) => {
    const prisma = getPrisma();

    try {
        const { where, orderBy, page, pageSize } = parseTicketListQuery(req.query, {}, { staff: true });

        const [totalItems, rows] = await Promise.all([
            prisma.ticket.count({ where }),
            prisma.ticket.findMany({
                where,
                orderBy,
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
                    ticketOwnerId: true,
                    createdAt: true,
                    updatedAt: true,
                    ticketOwner: { select: { name: true } },
                },
            }),
        ]);

        const data = rows.map(({ ticketOwner, ...ticket }) => ({
            ...ticket,
            ticketOwnerName: ticketOwner?.name ?? null,
        }));

        res.status(200).json({
            data,
            pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 0 },
        });
    } catch (err) {
        serverError(res, "GET /api/staff/tickets", err, "Failed to retrieve the ticket queue. Please try again.");
    }
});

// GET /api/staff/assignees: users who can own a ticket (BR-15). Never returns emails or credentials.
staffRouter.get("/assignees", async (_req: Request, res: Response) => {
    try {
        const users = await getPrisma().user.findMany({
            where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
            select: { id: true, name: true, role: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
        });
        res.status(200).json(users);
    } catch (err) {
        serverError(res, "GET /api/staff/assignees", err, "Failed to retrieve assignees. Please try again.");
    }
});

// GET /api/staff/tickets/:id: any ticket, with attachments (removed ones as metadata only).
staffRouter.get("/tickets/:id", async (req: Request, res: Response) => {
    const ticketId = parseId(req.params.id);
    if (!ticketId) return notFound(res);

    try {
        const detail = await findTicketDetail(ticketId);
        if (!detail) return notFound(res);
        res.status(200).json(detail);
    } catch (err) {
        serverError(res, "GET /api/staff/tickets/:id", err, "Failed to retrieve the ticket. Please try again.");
    }
});

// PATCH /api/staff/tickets/:id/claim: AC-12, BR-14.
// Atomic and idempotent: it only succeeds while the ticket is unowned or already ours.
staffRouter.patch("/tickets/:id/claim", async (req: Request, res: Response) => {
    const ticketId = parseId(req.params.id);
    if (!ticketId) return notFound(res);
    const userId = req.user!.id;

    try {
        const outcome = await getPrisma().$transaction(async (tx) => {
            const claimed = await tx.ticket.updateMany({
                where: { id: ticketId, OR: [{ ticketOwnerId: null }, { ticketOwnerId: userId }] },
                data: { ticketOwnerId: userId },
            });

            if (claimed.count === 0) {
                const exists = await tx.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
                return exists ? "conflict" : "not-found";
            }

            // BR-14: claiming a ticket that is still New also opens it.
            await tx.ticket.updateMany({ where: { id: ticketId, currentStatus: "NEW" }, data: { currentStatus: "OPEN" } });
            return "ok";
        });

        if (outcome === "not-found") return notFound(res);
        if (outcome === "conflict") {
            res.status(409).json({
                error: {
                    code: "TICKET_ALREADY_OWNED",
                    message: "This ticket is already owned by another user. Use reassign instead.",
                },
            });
            return;
        }

        res.status(200).json(await findTicketDetail(ticketId));
    } catch (err) {
        serverError(res, "PATCH /api/staff/tickets/:id/claim", err, "Failed to claim the ticket. Please try again.");
    }
});

// PATCH /api/staff/tickets/:id/assign: AC-13, BR-15. Never changes the status (only claim does, BR-14).
staffRouter.patch("/tickets/:id/assign", async (req: Request, res: Response) => {
    const ticketId = parseId(req.params.id);
    if (!ticketId) return notFound(res);

    const target = req.body?.ticketOwnerId;
    if (typeof target !== "number" || !Number.isInteger(target) || target <= 0) {
        return badRequest(res, "VALIDATION_ERROR", "A valid new owner is required.", {
            ticketOwnerId: "ticketOwnerId must be a positive integer.",
        });
    }

    try {
        const prisma = getPrisma();

        const newOwner = await prisma.user.findFirst({
            where: { id: target, isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
            select: { id: true },
        });
        if (!newOwner) {
            return badRequest(res, "INVALID_ASSIGNEE", "The new owner must be an active IT Staff or Administrator user.");
        }

        const updated = await prisma.ticket.updateMany({ where: { id: ticketId }, data: { ticketOwnerId: newOwner.id } });
        if (updated.count === 0) return notFound(res);

        res.status(200).json(await findTicketDetail(ticketId));
    } catch (err) {
        serverError(res, "PATCH /api/staff/tickets/:id/assign", err, "Failed to assign the ticket. Please try again.");
    }
});

// PATCH /api/staff/tickets/:id/priority: AC-15, BR-16.
staffRouter.patch("/tickets/:id/priority", async (req: Request, res: Response) => {
    const ticketId = parseId(req.params.id);
    if (!ticketId) return notFound(res);

    const itPriority = req.body?.itPriority;
    if (typeof itPriority !== "string" || !VALID_PRIORITIES.has(itPriority)) {
        return badRequest(res, "VALIDATION_ERROR", "IT Priority is invalid.", {
            itPriority: "IT Priority must be LOW, MEDIUM or HIGH.",
        });
    }

    try {
        const updated = await getPrisma().ticket.updateMany({
            where: { id: ticketId },
            data: { itPriority: itPriority as "LOW" | "MEDIUM" | "HIGH" },
        });
        if (updated.count === 0) return notFound(res);

        res.status(200).json(await findTicketDetail(ticketId));
    } catch (err) {
        serverError(res, "PATCH /api/staff/tickets/:id/priority", err, "Failed to update the priority. Please try again.");
    }
});

// PATCH /api/staff/tickets/:id/status: AC-14, BR-17, BR-28.
staffRouter.patch("/tickets/:id/status", async (req: Request, res: Response) => {
    const ticketId = parseId(req.params.id);
    if (!ticketId) return notFound(res);

    const next = req.body?.status;
    if (!isTicketStatus(next)) {
        return badRequest(res, "VALIDATION_ERROR", "Status is invalid.", { status: "Status is not a valid ticket status." });
    }

    try {
        const prisma = getPrisma();

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { currentStatus: true } });
        if (!ticket) return notFound(res);

        if (!isTransitionAllowed(ticket.currentStatus, next)) {
            res.status(400).json({
                error: {
                    code: "INVALID_TRANSITION",
                    message: `Cannot change the status from ${ticket.currentStatus} to ${next}.`,
                    allowedTransitions: allowedTransitions(ticket.currentStatus),
                },
            });
            return;
        }

        // Conditional write: if someone moved the ticket in the meantime, nothing is overwritten.
        const updated = await prisma.ticket.updateMany({
            where: { id: ticketId, currentStatus: ticket.currentStatus },
            data: {
                currentStatus: next,
                // BR-28: a reopened ticket lets the Requester flag it as resolved again.
                ...(next === "REOPENED" ? { requesterConfirmedResolved: false } : {}),
            },
        });
        if (updated.count === 0) {
            res.status(409).json({
                error: { code: "STATUS_CHANGED", message: "The ticket status changed in the meantime. Reload and try again." },
            });
            return;
        }

        res.status(200).json(await findTicketDetail(ticketId));
    } catch (err) {
        serverError(res, "PATCH /api/staff/tickets/:id/status", err, "Failed to update the status. Please try again.");
    }
});

// GET /api/staff/attachments/:id/download: read-only access for staff.
// Removed attachments are never served, to anyone (same 404 as a missing one).
staffRouter.get("/attachments/:id/download", async (req: Request, res: Response) => {
    const attachmentId = parseId(req.params.id);
    if (!attachmentId) return notFound(res, "Attachment not found.");

    try {
        const attachment = await getPrisma().attachment.findFirst({ where: { id: attachmentId, removedAt: null } });
        if (!attachment) return notFound(res, "Attachment not found.");

        res.download(path.join(UPLOAD_DIR, attachment.storedFileName), attachment.originalFileName, (err) => {
            if (err) {
                console.error("[GET /api/staff/attachments/:id/download]", err);
                if (!res.headersSent) notFound(res, "Attachment not found.");
            }
        });
    } catch (err) {
        serverError(res, "GET /api/staff/attachments/:id/download", err, "Failed to download the attachment. Please try again.");
    }
});