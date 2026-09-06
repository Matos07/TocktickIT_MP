import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";

export const relatedSystemsRouter = Router();

// GET /api/related-systems
// Returns only active Related Systems (BR-12 references active-only).
// api-spec §2.
relatedSystemsRouter.get("/", async (_req: Request, res: Response) => {
    try {
        const prisma = getPrisma();
        const relatedSystems = await prisma.relatedSystem.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        });
        res.status(200).json(relatedSystems);
    } catch (err) {
        console.error("[GET /api/related-systems]", err);
        res.status(500).json({
            error: {
                code: "SERVER_ERROR",
                message: "Failed to retrieve related systems. Please try again.",
            },
        });
    }
});