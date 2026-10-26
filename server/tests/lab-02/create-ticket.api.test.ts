import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { createLoggedInUser } from "../helpers/auth.js";

const prisma = getPrisma();

let categoryId: number;
let relatedSystemId: number;
let me: Awaited<ReturnType<typeof createLoggedInUser>>;

const body = (overrides: Record<string, unknown> = {}) => ({
    categoryId,
    relatedSystemId,
    summary: "Laptop battery drains quickly",
    description: "Battery drains much faster than usual, started after last update.",
    requestedPriority: "MEDIUM",
    ...overrides,
});

beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow()).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    me = await createLoggedInUser("REQUESTER");
});

describe("POST /api/tickets (authenticated Requester)", () => {
    it("AC-01: creates a ticket owned by the session user and returns 201 with a ticket number", async () => {
        const res = await me.agent.post("/api/tickets").send(body());

        expect(res.status).toBe(201);
        expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
        expect(res.body.currentStatus).toBe("NEW");
        expect(res.body.requesterId).toBe(me.user.id);
        expect(res.body.ticketOwnerId).toBeNull(); // BR-13
        expect(res.body.itPriority).toBe("MEDIUM"); // BR-16 (Lab 3): IT Priority copies Requested Priority

        const saved = await prisma.ticket.findUnique({ where: { id: res.body.id } });
        expect(saved?.ticketNumber).toBe(res.body.ticketNumber);
    });

    it("AC-04: rejects a missing Summary with 400 and persists nothing", async () => {
        const before = await prisma.ticket.count({ where: { requesterId: me.user.id } });

        const res = await me.agent.post("/api/tickets").send(body({ summary: undefined }));

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(res.body.error.fields).toHaveProperty("summary");
        expect(await prisma.ticket.count({ where: { requesterId: me.user.id } })).toBe(before);
    });

    it("BR-11: rejects a Summary under 5 characters", async () => {
        const res = await me.agent.post("/api/tickets").send(body({ summary: "Hi" }));
        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty("summary");
    });

    it("BR-11: rejects a Description under 10 characters", async () => {
        const res = await me.agent.post("/api/tickets").send(body({ description: "Too short" }));
        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty("description");
    });

    it("BR-12: rejects an unknown categoryId", async () => {
        const res = await me.agent.post("/api/tickets").send(body({ categoryId: 999999 }));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_REFERENCE");
    });

    it("BR-13: rejects an invalid requestedPriority value", async () => {
        const res = await me.agent.post("/api/tickets").send(body({ requestedPriority: "URGENT" }));
        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty("requestedPriority");
    });

    it("returns 401 when no session is present", async () => {
        const res = await request(app).post("/api/tickets").send(body());
        expect(res.status).toBe(401);
    });
});