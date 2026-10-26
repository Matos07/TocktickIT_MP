import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createLoggedInUser } from "../helpers/auth.js";

const prisma = getPrisma();
type Session = Awaited<ReturnType<typeof createLoggedInUser>>;

let categoryId: number;
let relatedSystemId: number;
let owner: Session;
let other: Session;
let staff: Session;
let admin: Session;

async function createTicket(s: Session) {
    const res = await s.agent.post("/api/tickets").send({
        categoryId,
        relatedSystemId,
        summary: "Ticket for comment tests",
        description: "Description long enough to pass validation checks.",
        requestedPriority: "LOW",
    });
    return res.body.id as number;
}

beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow()).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    owner = await createLoggedInUser("REQUESTER");
    other = await createLoggedInUser("REQUESTER");
    staff = await createLoggedInUser("IT_STAFF");
    admin = await createLoggedInUser("ADMINISTRATOR");
});

describe("Public Comments", () => {
    it("AC-09: a requester comments on their own ticket, saved with author and timestamp", async () => {
        const ticketId = await createTicket(owner);

        const res = await owner.agent
            .post(`/api/tickets/${ticketId}/comments`)
            .send({ content: "  Thanks for the update.  " });

        expect(res.status).toBe(201);
        expect(res.body.content).toBe("Thanks for the update."); // trimmed
        expect(res.body.authorId).toBe(owner.user.id);
        expect(res.body.authorName).toBe(owner.user.name);
        expect(res.body.authorRole).toBe("REQUESTER");
        expect(Number.isNaN(new Date(res.body.createdAt).getTime())).toBe(false);
    });

    it("BR-20: the client cannot choose the author or the timestamp", async () => {
        const ticketId = await createTicket(owner);

        const res = await owner.agent
            .post(`/api/tickets/${ticketId}/comments`)
            .send({ content: "Hello", authorId: other.user.id, createdAt: "2001-01-01T00:00:00.000Z" });

        expect(res.status).toBe(201);
        expect(res.body.authorId).toBe(owner.user.id);
        expect(new Date(res.body.createdAt).getFullYear()).toBeGreaterThan(2001);
    });

    it("BR-19: rejects empty, whitespace-only, over-long, and non-string content", async () => {
        const ticketId = await createTicket(owner);

        for (const content of ["", "   \n\t ", "x".repeat(2001), undefined, 42]) {
            const res = await owner.agent.post(`/api/tickets/${ticketId}/comments`).send({ content });
            expect(res.status).toBe(400);
            expect(res.body.error.fields).toHaveProperty("content");
        }

        const boundary = await owner.agent
            .post(`/api/tickets/${ticketId}/comments`)
            .send({ content: "x".repeat(2000) });
        expect(boundary.status).toBe(201);
    });

    it("BR-04: requester, IT Staff and Administrator all see the thread, oldest first", async () => {
        const ticketId = await createTicket(owner);

        await owner.agent.post(`/api/tickets/${ticketId}/comments`).send({ content: "first" });
        const reply = await staff.agent.post(`/api/tickets/${ticketId}/comments`).send({ content: "second" });
        await admin.agent.post(`/api/tickets/${ticketId}/comments`).send({ content: "third" });

        expect(reply.status).toBe(201);
        expect(reply.body.authorRole).toBe("IT_STAFF");

        for (const viewer of [owner, staff, admin]) {
            const res = await viewer.agent.get(`/api/tickets/${ticketId}/comments`);
            expect(res.status).toBe(200);
            expect(res.body.map((c: { content: string }) => c.content)).toEqual(["first", "second", "third"]);
        }
    });

    it("returns 404 to another requester on read and write, without leaking content", async () => {
        const ticketId = await createTicket(owner);
        await owner.agent.post(`/api/tickets/${ticketId}/comments`).send({ content: "visible to participants only" });

        const read = await other.agent.get(`/api/tickets/${ticketId}/comments`);
        expect(read.status).toBe(404);
        expect(JSON.stringify(read.body)).not.toContain("participants");

        const write = await other.agent.post(`/api/tickets/${ticketId}/comments`).send({ content: "intruder" });
        expect(write.status).toBe(404);
    });

    it("returns 404 for a nonexistent ticket", async () => {
        const res = await owner.agent.post("/api/tickets/999999999/comments").send({ content: "hello" });
        expect(res.status).toBe(404);
    });
});

describe("PATCH /api/tickets/:id/resolved-by-requester", () => {
    it("AC-10: sets requesterConfirmedResolved without changing the formal status", async () => {
        const ticketId = await createTicket(owner);

        const res = await owner.agent.patch(`/api/tickets/${ticketId}/resolved-by-requester`).send({});
        expect(res.status).toBe(200);
        expect(res.body.requesterConfirmedResolved).toBe(true);

        const detail = await owner.agent.get(`/api/tickets/${ticketId}`);
        expect(detail.body.requesterConfirmedResolved).toBe(true);
        expect(detail.body.currentStatus).toBe("NEW"); // BR-05: only IT Staff changes the status
    });

    it("rejects a non-owning requester with 404 and leaves the flag unchanged", async () => {
        const ticketId = await createTicket(owner);

        const res = await other.agent.patch(`/api/tickets/${ticketId}/resolved-by-requester`).send({});
        expect(res.status).toBe(404);

        const detail = await owner.agent.get(`/api/tickets/${ticketId}`);
        expect(detail.body.requesterConfirmedResolved).toBe(false);
    });

    it("BR-05: IT Staff cannot use the requester-only endpoint (403)", async () => {
        const ticketId = await createTicket(owner);

        const res = await staff.agent.patch(`/api/tickets/${ticketId}/resolved-by-requester`).send({});
        expect(res.status).toBe(403);
    });
});