import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";
import { validateCreateTicketInput } from "../validation/ticket.js";

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