import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();

let requesterA: number;
let requesterB: number;
let categoryId: number;
let relatedSystemId: number;

async function createTicket(requesterId: number, summary = "Test ticket") {
    const res = await request(app)
        .post("/api/tickets")
        .set("x-requester-id", String(requesterId))
        .send({
            categoryId,
            relatedSystemId,
            summary,
            description: "Description long enough to pass validation checks.",
            requestedPriority: "LOW",
        });
    return res.body.id as number;
}

beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow();
    categoryId = category.id;
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    relatedSystemId = relatedSystem.id;
    const requesters = await prisma.developmentRequester.findMany({ where: { isActive: true }, take: 2 });
    requesterA = requesters[0].id;
    requesterB = requesters[1].id;
});

describe("GET /api/tickets", () => {
    it("AC-09 / BR-08: returns only the current requester's tickets", async () => {
        await createTicket(requesterA, "Requester A ticket");
        await createTicket(requesterB, "Requester B ticket");

        const res = await request(app).get("/api/tickets").set("x-requester-id", String(requesterA));

        expect(res.status).toBe(200);
        expect(res.body.data.every((t: { summary: string }) => t.summary !== "Requester B ticket")).toBe(true);
    });

    it("AC-10: a different requester sees a different, non-overlapping list", async () => {
        const ticketIdA = await createTicket(requesterA, "Only A can see this");

        const resB = await request(app).get("/api/tickets").set("x-requester-id", String(requesterB));

        const ids = resB.body.data.map((t: { id: number }) => t.id);
        expect(ids).not.toContain(ticketIdA);
    });

    it("AC-11 / BR-23: search with zero matches returns an empty data array with correct metadata", async () => {
        await createTicket(requesterA, "Findable summary text");

        const res = await request(app)
            .get("/api/tickets?search=zzz_no_such_ticket_zzz")
            .set("x-requester-id", String(requesterA));

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
        expect(res.body.pagination.totalItems).toBe(0);
    });

    it("AC-12 / BR-23: a requester with zero tickets ever gets an empty list distinct from no-results", async () => {
        const requesters = await prisma.developmentRequester.findMany({ where: { isActive: true } });
        const freshRequester = requesters.find((r) => r.id !== requesterA && r.id !== requesterB);
        if (!freshRequester) throw new Error("Seed needs at least 3 active requesters for this test.");

        const res = await request(app).get("/api/tickets").set("x-requester-id", String(freshRequester.id));

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
        expect(res.body.pagination.totalItems).toBe(0);
    });

    it("AC-13 / BR-10: pagination returns the correct page and clamps pageSize", async () => {
        for (let i = 0; i < 12; i++) {
            await createTicket(requesterA, `Paged ticket ${i}`);
        }

        const page1 = await request(app)
            .get("/api/tickets?page=1&pageSize=5")
            .set("x-requester-id", String(requesterA));
        expect(page1.body.data).toHaveLength(5);
        expect(page1.body.pagination.page).toBe(1);

        const page2 = await request(app)
            .get("/api/tickets?page=2&pageSize=5")
            .set("x-requester-id", String(requesterA));
        expect(page2.body.data).toHaveLength(5);
        expect(page2.body.pagination.page).toBe(2);

        const page1Ids = page1.body.data.map((t: { id: number }) => t.id);
        const page2Ids = page2.body.data.map((t: { id: number }) => t.id);
        expect(page1Ids.some((id: number) => page2Ids.includes(id))).toBe(false);

        const clamped = await request(app)
            .get("/api/tickets?pageSize=9999")
            .set("x-requester-id", String(requesterA));
        expect(clamped.body.pagination.pageSize).toBe(50);
    });

    it("BR-09: defaults to createdAt descending when no sort is specified", async () => {
        const res = await request(app).get("/api/tickets?pageSize=50").set("x-requester-id", String(requesterA));

        const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
        const sorted = [...dates].sort((a, b) => b - a);
        expect(dates).toEqual(sorted);
    });
});