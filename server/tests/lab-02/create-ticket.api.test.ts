import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

let categoryId: number;
let relatedSystemId: number;
let requesterId: number;

beforeAll(async () => {
    // Assumes seed data from Issue 2 is present in the test database.
    const category = await prisma.category.findFirstOrThrow();
    categoryId = category.id;

    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({
        where: { isActive: true },
    });
    relatedSystemId = relatedSystem.id;

    const requester = await prisma.developmentRequester.findFirstOrThrow({
        where: { isActive: true },
    });
    requesterId = requester.id;
});

describe("POST /api/tickets", () => {
    it("AC-01: creates a ticket with valid data and returns 201 with a ticket number", async () => {
        const res = await request(app)
            .post("/api/tickets")
            .set("x-requester-id", String(requesterId))
            .send({
                categoryId,
                relatedSystemId,
                summary: "Laptop battery drains quickly",
                description: "Battery drains much faster than usual, started after last update.",
                requestedPriority: "MEDIUM",
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toBeTypeOf("number");
        expect(res.body.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
        expect(res.body.currentStatus).toBe("NEW");
        expect(res.body.requesterId).toBe(requesterId);

        // Confirm it's actually persisted, not just echoed back.
        const saved = await prisma.ticket.findUnique({ where: { id: res.body.id } });
        expect(saved).not.toBeNull();
        expect(saved?.ticketNumber).toBe(res.body.ticketNumber);
    });

    it("AC-04: rejects a missing Summary with 400 and persists nothing", async () => {
        const before = await prisma.ticket.count();

        const res = await request(app)
            .post("/api/tickets")
            .set("x-requester-id", String(requesterId))
            .send({
                categoryId,
                relatedSystemId,
                description: "Some description that is long enough to pass validation.",
                requestedPriority: "LOW",
                // summary intentionally omitted
            });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(res.body.error.fields).toHaveProperty("summary");

        const after = await prisma.ticket.count();
        expect(after).toBe(before);
    });

    it("BR-11: rejects a Summary under 5 characters", async () => {
        const res = await request(app)
            .post("/api/tickets")
            .set("x-requester-id", String(requesterId))
            .send({
                categoryId,
                relatedSystemId,
                summary: "Hi",
                description: "Some description that is long enough to pass validation.",
                requestedPriority: "LOW",
            });

        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty("summary");
    });

    it("BR-11: rejects a Description under 10 characters", async () => {
        const res = await request(app)
            .post("/api/tickets")
            .set("x-requester-id", String(requesterId))
            .send({
                categoryId,
                relatedSystemId,
                summary: "Valid summary text",
                description: "Too short",
                requestedPriority: "LOW",
            });

        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty("description");
    });

    it("BR-12: rejects an unknown categoryId", async () => {
        const res = await request(app)
            .post("/api/tickets")
            .set("x-requester-id", String(requesterId))
            .send({
                categoryId: 999999,
                relatedSystemId,
                summary: "Valid summary text",
                description: "Some description that is long enough to pass validation.",
                requestedPriority: "LOW",
            });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_REFERENCE");
    });

    it("BR-13: rejects an invalid requestedPriority value", async () => {
        const res = await request(app)
            .post("/api/tickets")
            .set("x-requester-id", String(requesterId))
            .send({
                categoryId,
                relatedSystemId,
                summary: "Valid summary text",
                description: "Some description that is long enough to pass validation.",
                requestedPriority: "URGENT", // not a valid enum value
            });

        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty("requestedPriority");
    });

    it("returns 404 when x-requester-id does not match an active requester", async () => {
        const res = await request(app)
            .post("/api/tickets")
            .set("x-requester-id", "999999")
            .send({
                categoryId,
                relatedSystemId,
                summary: "Valid summary text",
                description: "Some description that is long enough to pass validation.",
                requestedPriority: "LOW",
            });

        expect(res.status).toBe(404);
    });
});