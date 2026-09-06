import { Router, Request, Response } from "express";
import { getPrisma } from "../prisma.js";

export const requestersRouter = Router();

// GET /api/requesters
// Returns only active Development Requesters (BR-05).
// api-spec §3: 500 on DB failure — safe message, empty array is NOT substituted.
requestersRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesters = await prisma.developmentRequester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    res.status(200).json(requesters);
  } catch (err) {
    console.error("[GET /api/requesters]", err);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to retrieve requesters. Please try again.",
      },
    });
  }
});
