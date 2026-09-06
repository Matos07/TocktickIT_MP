import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

let requesterId: number;
let otherRequesterId: number;
let categoryId: number;
let relatedSystemId: number;

async function createTicket(forRequesterId: number) {
    const res = await request(app)
        .post("/api/tickets")
        .set("x-requester-id", String(forRequesterId))
        .send({
            categoryId,
            relatedSystemId,
            summary: "Test ticket for attachments",
            description: "Description long enough to pass validation checks.",
            requestedPriority: "LOW",
        });
    return res.body.id as number;
}

const smallPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const bigBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB, exceeds the 5 MB limit

beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow();
    categoryId = category.id;

    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    relatedSystemId = relatedSystem.id;

    const requesters = await prisma.developmentRequester.findMany({
        where: { isActive: true },
        take: 2,
    });
    requesterId = requesters[0].id;
    otherRequesterId = requesters[1].id;
});

describe("POST /api/tickets/:id/attachments", () => {
    it("AC-02: uploads two valid attachments and both show as active", async () => {
        const ticketId = await createTicket(requesterId);

        const res1 = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", smallPng, "photo1.png");
        expect(res1.status).toBe(201);
        expect(res1.body.removedAt).toBeNull();

        const res2 = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", smallPng, "photo2.png");
        expect(res2.status).toBe(201);

        const detail = await request(app)
            .get(`/api/tickets/${ticketId}`)
            .set("x-requester-id", String(requesterId));
        expect(detail.body.attachments).toHaveLength(2);
        expect(detail.body.attachments.every((a: { removedAt: null }) => a.removedAt === null)).toBe(true);
    });

    it("AC-05: rejects a file over 5 MB with 413", async () => {
        const ticketId = await createTicket(requesterId);

        const res = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", bigBuffer, "huge.png");

        expect(res.status).toBe(413);
    });

    it("AC-06: rejects a disallowed file type with 415", async () => {
        const ticketId = await createTicket(requesterId);

        const res = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", Buffer.from("not a real exe"), {
                filename: "virus.exe",
                contentType: "application/x-msdownload",
            });

        expect(res.status).toBe(415);
    });

    it("AC-07 / BR-19: rejects a 6th active attachment with 409", async () => {
        const ticketId = await createTicket(requesterId);

        for (let i = 0; i < 5; i++) {
            const res = await request(app)
                .post(`/api/tickets/${ticketId}/attachments`)
                .set("x-requester-id", String(requesterId))
                .attach("file", smallPng, `photo${i}.png`);
            expect(res.status).toBe(201);
        }

        const sixth = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", smallPng, "photo5.png");

        expect(sixth.status).toBe(409);
        expect(sixth.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
    });

    it("BR-21: rejects upload to a ticket owned by another requester", async () => {
        const ticketId = await createTicket(requesterId);

        const res = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(otherRequesterId))
            .attach("file", smallPng, "photo.png");

        expect(res.status).toBe(404);
    });
});

describe("GET /api/attachments/:id/download", () => {
    it("AC-15: downloads an active attachment's bytes", async () => {
        const ticketId = await createTicket(requesterId);
        const upload = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", smallPng, "photo.png");

        const res = await request(app)
            .get(`/api/attachments/${upload.body.id}/download`)
            .set("x-requester-id", String(requesterId));

        expect(res.status).toBe(200);
        expect(Buffer.compare(res.body, smallPng)).toBe(0);
    });

    it("AC-17: rejects downloading a removed attachment with 404", async () => {
        const ticketId = await createTicket(requesterId);
        const upload = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", smallPng, "photo.png");

        await request(app)
            .delete(`/api/attachments/${upload.body.id}`)
            .set("x-requester-id", String(requesterId))
            .send({ reason: "Wrong file, replacing it." });

        const res = await request(app)
            .get(`/api/attachments/${upload.body.id}/download`)
            .set("x-requester-id", String(requesterId));

        expect(res.status).toBe(404);
    });
});

describe("DELETE /api/attachments/:id", () => {
    it("AC-16: soft-removes with a reason, sets removedAt, keeps the row", async () => {
        const ticketId = await createTicket(requesterId);
        const upload = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", smallPng, "photo.png");

        const res = await request(app)
            .delete(`/api/attachments/${upload.body.id}`)
            .set("x-requester-id", String(requesterId))
            .send({ reason: "Wrong screenshot, replaced with the correct one." });

        expect(res.status).toBe(200);
        expect(res.body.removedAt).not.toBeNull();
        expect(res.body.removedReason).toBe("Wrong screenshot, replaced with the correct one.");

        const stillThere = await prisma.attachment.findUnique({ where: { id: upload.body.id } });
        expect(stillThere).not.toBeNull();
    });

    it("rejects removal without a reason (400)", async () => {
        const ticketId = await createTicket(requesterId);
        const upload = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", smallPng, "photo.png");

        const res = await request(app)
            .delete(`/api/attachments/${upload.body.id}`)
            .set("x-requester-id", String(requesterId))
            .send({});

        expect(res.status).toBe(400);
    });

    it("BR-21: rejects soft-removal by a non-owning requester", async () => {
        const ticketId = await createTicket(requesterId);
        const upload = await request(app)
            .post(`/api/tickets/${ticketId}/attachments`)
            .set("x-requester-id", String(requesterId))
            .attach("file", smallPng, "photo.png");

        const res = await request(app)
            .delete(`/api/attachments/${upload.body.id}`)
            .set("x-requester-id", String(otherRequesterId))
            .send({ reason: "Not mine to remove." });

        expect(res.status).toBe(404);
    });
});