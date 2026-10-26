import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { validateContent } from "../validation/content.js";

// Mounted under ticketsRouter, which already enforces requireAuth and
// requirePasswordChanged. No role restriction here: Requester (owner only),
// IT Staff and Administrator may all take part in the public thread (BR-04).
export const commentsRouter = Router({ mergeParams: true });

// A Requester only reaches tickets they own; IT Staff/Administrator reach any
// ticket. A missing ticket and a foreign one are indistinguishable (BR-24).
async function findAccessibleTicket(req: Request) {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) return null;

    const where =
        req.user!.role === "REQUESTER" ? { id: ticketId, requesterId: req.user!.id } : { id: ticketId };
    return getPrisma().ticket.findFirst({ where, select: { id: true } });
}

function toDto(c: {
    id: number;
    ticketId: number;
    authorId: number;
    content: string;
    createdAt: Date;
    author: { name: string; role: string };
}) {
    return {
        id: c.id,
        ticketId: c.ticketId,
        authorId: c.authorId,
        authorName: c.author.name,
        authorRole: c.author.role,
        content: c.content,
        createdAt: c.createdAt,
    };
}

function notFound(res: Response) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found." } });
}

// POST /api/tickets/:id/comments — AC-09, BR-19, BR-20.
commentsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const ticket = await findAccessibleTicket(req);
        if (!ticket) return notFound(res);

        const result = validateContent(req.body?.content);
        if ("error" in result) {
            res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Comment content is invalid.",
                    fields: { content: result.error },
                },
            });
            return;
        }

        // Author and timestamp are always set server-side (BR-20).
        const comment = await getPrisma().publicComment.create({
            data: { ticketId: ticket.id, authorId: req.user!.id, content: result.value },
            include: { author: { select: { name: true, role: true } } },
        });

        res.status(201).json(toDto(comment));
    } catch (err) {
        console.error("[POST /api/tickets/:id/comments]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to post comment. Please try again." },
        });
    }
});

// GET /api/tickets/:id/comments — oldest first.
commentsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const ticket = await findAccessibleTicket(req);
        if (!ticket) return notFound(res);

        const comments = await getPrisma().publicComment.findMany({
            where: { ticketId: ticket.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: { author: { select: { name: true, role: true } } },
        });

        res.status(200).json(comments.map(toDto));
    } catch (err) {
        console.error("[GET /api/tickets/:id/comments]", err);
        res.status(500).json({
            error: { code: "SERVER_ERROR", message: "Failed to retrieve comments. Please try again." },
        });
    }
});