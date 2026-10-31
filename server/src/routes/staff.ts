import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { requireAuth, requirePasswordChanged, requireRole } from "../middleware/auth.js";
import { parseTicketListQuery } from "../lib/ticketQuery.js";

export const staffRouter = Router();

// Authorization matrix (specification.md §5.2): the whole /api/staff surface is
// IT Staff + Administrator only, and never reachable before the initial password is changed.
staffRouter.use(requireAuth, requirePasswordChanged, requireRole("IT_STAFF", "ADMINISTRATOR"));

// GET /api/staff/tickets — the shared queue: every requester's tickets, same query contract
// as My Tickets plus itPriority and ownerId filters. AC-11, BR-09, BR-10.
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
        console.error("[GET /api/staff/tickets]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to retrieve the ticket queue. Please try again." },
        });
    }
});

// GET /api/staff/assignees — users who can own a ticket (BR-15): active IT Staff and Administrators.
// Never returns emails or credential fields.
staffRouter.get("/assignees", async (_req: Request, res: Response) => {
    try {
        const users = await getPrisma().user.findMany({
            where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
            select: { id: true, name: true, role: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
        });
        res.status(200).json(users);
    } catch (err) {
        console.error("[GET /api/staff/assignees]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to retrieve assignees. Please try again." },
        });
    }
});