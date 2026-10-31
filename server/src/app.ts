import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { getPrisma } from "./prisma.js";
import { ticketsRouter } from "./routes/tickets.js";
import { relatedSystemsRouter } from "./routes/related-systems.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { authRouter } from "./routes/auth.js";
import { staffRouter } from "./routes/staff.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors({ origin: true, credentials: true })); // credentials: the session cookie must round-trip from Vite
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET ?? "dev-only-change-me"));
app.use("/api/staff", staffRouter);

app.use("/api/auth", authRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/attachments", attachmentsRouter);

// Reference data stays public: it is not sensitive and Lab 1 tests rely on it.
app.use("/api/related-systems", relatedSystemsRouter);

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve categories" });
  }
});

export default app;