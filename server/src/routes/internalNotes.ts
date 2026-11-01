import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { requireRole } from "../middleware/auth.js";
import { validateContent } from "../validation/content.js";

// Mounted under ticketsRouter, so requireAuth and requirePasswordChanged already ran.
// BR-04 / AC-04: Internal Notes are never reachable by a Requester. The role check comes
// first, before any ticket lookup, so a Requester learns nothing: not the content, and not
// whether the ticket exists.
export const internalNotesRouter = Router({ mergeParams: true });
internalNotesRouter.use(requireRole("IT_STAFF", "ADMINISTRATOR"));

async function findTicket(req: Request) {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) return null;
    return getPrisma().ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
}

function toDto(n: {
    id: number;
    ticketId: number;
    authorId: number;
    content: string;
    createdAt: Date;
    author: { name: string; role: string };
}) {
    return {
        id: n.id,
        ticketId: n.ticketId,
        authorId: n.authorId,
        authorName: n.author.name,
        authorRole: n.author.role,
        content: n.content,
        createdAt: n.createdAt,
    };
}

function notFound(res: Response) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
}

// POST /api/tickets/:id/internal-notes: BR-19, BR-20 (author and timestamp are server-set).
internalNotesRouter.post("/", async (req: Request, res: Response) => {
    try {
        const ticket = await findTicket(req);
        if (!ticket) return notFound(res);

        const result = validateContent(req.body?.content);
        if ("error" in result) {
            res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Note content is invalid.",
                    fields: { content: result.error },
                },
            });
            return;
        }

        const note = await getPrisma().internalNote.create({
            data: { ticketId: ticket.id, authorId: req.user!.id, content: result.value },
            include: { author: { select: { name: true, role: true } } },
        });

        res.status(201).json(toDto(note));
    } catch (err) {
        console.error("[POST /api/tickets/:id/internal-notes]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to post note. Please try again." },
        });
    }
});

// GET /api/tickets/:id/internal-notes: oldest first.
internalNotesRouter.get("/", async (req: Request, res: Response) => {
    try {
        const ticket = await findTicket(req);
        if (!ticket) return notFound(res);

        const notes = await getPrisma().internalNote.findMany({
            where: { ticketId: ticket.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: { author: { select: { name: true, role: true } } },
        });

        res.status(200).json(notes.map(toDto));
    } catch (err) {
        console.error("[GET /api/tickets/:id/internal-notes]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to retrieve notes. Please try again." },
        });
    }
});