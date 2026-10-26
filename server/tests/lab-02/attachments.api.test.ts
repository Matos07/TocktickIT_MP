import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createLoggedInUser } from "../helpers/auth.js";

const prisma = getPrisma();
type Session = Awaited<ReturnType<typeof createLoggedInUser>>;

const smallPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const bigBuffer = Buffer.alloc(6 * 1024 * 1024); // exceeds the 5 MB limit

let categoryId: number;
let relatedSystemId: number;
let owner: Session;
let other: Session;

async function createTicket(s: Session) {
    const res = await s.agent.post("/api/tickets").send({
        categoryId,
        relatedSystemId,
        summary: "Test ticket for attachments",
        description: "Description long enough to pass validation checks.",
        requestedPriority: "LOW",
    });
    return res.body.id as number;
}

const upload = (s: Session, ticketId: number, buf: Buffer, name: string, contentType?: string) =>
    s.agent
        .post(`/api/tickets/${ticketId}/attachments`)
        .attach("file", buf, contentType ? { filename: name, contentType } : name);

beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow()).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    owner = await createLoggedInUser("REQUESTER");
    other = await createLoggedInUser("REQUESTER");
});

describe("POST /api/tickets/:id/attachments", () => {
    it("AC-02: uploads two valid attachments and both show as active", async () => {
        const ticketId = await createTicket(owner);

        expect((await upload(owner, ticketId, smallPng, "photo1.png")).status).toBe(201);
        expect((await upload(owner, ticketId, smallPng, "photo2.png")).status).toBe(201);

        const detail = await owner.agent.get(`/api/tickets/${ticketId}`);
        expect(detail.body.attachments).toHaveLength(2);
        expect(detail.body.attachments.every((a: { removedAt: null }) => a.removedAt === null)).toBe(true);
    });

    it("AC-05: rejects a file over 5 MB with 413", async () => {
        const ticketId = await createTicket(owner);
        expect((await upload(owner, ticketId, bigBuffer, "huge.png")).status).toBe(413);
    });

    it("AC-06: rejects a disallowed file type with 415", async () => {
        const ticketId = await createTicket(owner);
        const res = await upload(owner, ticketId, Buffer.from("not a real exe"), "virus.exe", "application/x-msdownload");
        expect(res.status).toBe(415);
    });

    it("AC-07 / BR-19: rejects a 6th active attachment with 409", async () => {
        const ticketId = await createTicket(owner);
        for (let i = 0; i < 5; i++) {
            expect((await upload(owner, ticketId, smallPng, `photo${i}.png`)).status).toBe(201);
        }
        const sixth = await upload(owner, ticketId, smallPng, "photo5.png");
        expect(sixth.status).toBe(409);
        expect(sixth.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
    });

    it("BR-21: rejects an upload to a ticket owned by another requester", async () => {
        const ticketId = await createTicket(owner);
        expect((await upload(other, ticketId, smallPng, "photo.png")).status).toBe(404);
    });
});

describe("GET /api/attachments/:id/download", () => {
    it("AC-15: downloads an active attachment's bytes", async () => {
        const ticketId = await createTicket(owner);
        const up = await upload(owner, ticketId, smallPng, "photo.png");

        const res = await owner.agent.get(`/api/attachments/${up.body.id}/download`);

        expect(res.status).toBe(200);
        expect(Buffer.compare(res.body, smallPng)).toBe(0);
    });

    it("AC-17: rejects downloading a removed attachment with 404", async () => {
        const ticketId = await createTicket(owner);
        const up = await upload(owner, ticketId, smallPng, "photo.png");
        await owner.agent.delete(`/api/attachments/${up.body.id}`).send({ reason: "Wrong file, replacing it." });

        const res = await owner.agent.get(`/api/attachments/${up.body.id}/download`);
        expect(res.status).toBe(404);
    });
});

describe("DELETE /api/attachments/:id", () => {
    it("AC-16: soft-removes with a reason, sets removedAt, keeps the row", async () => {
        const ticketId = await createTicket(owner);
        const up = await upload(owner, ticketId, smallPng, "photo.png");

        const res = await owner.agent
            .delete(`/api/attachments/${up.body.id}`)
            .send({ reason: "Wrong screenshot, replaced with the correct one." });

        expect(res.status).toBe(200);
        expect(res.body.removedAt).not.toBeNull();
        expect(res.body.removedReason).toBe("Wrong screenshot, replaced with the correct one.");
        expect(await prisma.attachment.findUnique({ where: { id: up.body.id } })).not.toBeNull();
    });

    it("rejects removal without a reason (400)", async () => {
        const ticketId = await createTicket(owner);
        const up = await upload(owner, ticketId, smallPng, "photo.png");

        const res = await owner.agent.delete(`/api/attachments/${up.body.id}`).send({});
        expect(res.status).toBe(400);
    });

    it("BR-21: rejects soft-removal by a non-owning requester", async () => {
        const ticketId = await createTicket(owner);
        const up = await upload(owner, ticketId, smallPng, "photo.png");

        const res = await other.agent.delete(`/api/attachments/${up.body.id}`).send({ reason: "Not mine to remove." });
        expect(res.status).toBe(404);
    });
});