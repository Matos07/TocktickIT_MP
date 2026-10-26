import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createLoggedInUser } from "../helpers/auth.js";

const prisma = getPrisma();
type Session = Awaited<ReturnType<typeof createLoggedInUser>>;

let categoryId: number;
let relatedSystemId: number;
let a: Session;
let b: Session;
let fresh: Session; // never creates a ticket

async function createTicket(s: Session, summary = "Test ticket") {
    const res = await s.agent.post("/api/tickets").send({
        categoryId,
        relatedSystemId,
        summary,
        description: "Description long enough to pass validation checks.",
        requestedPriority: "LOW",
    });
    return res.body.id as number;
}

beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow()).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    a = await createLoggedInUser("REQUESTER");
    b = await createLoggedInUser("REQUESTER");
    fresh = await createLoggedInUser("REQUESTER");
});

describe("GET /api/tickets", () => {
    it("AC-09 / BR-08: returns only the authenticated requester's tickets", async () => {
        const idA = await createTicket(a, "Requester A ticket");
        const idB = await createTicket(b, "Requester B ticket");

        const res = await a.agent.get("/api/tickets?pageSize=50");
        const ids = res.body.data.map((t: { id: number }) => t.id);

        expect(res.status).toBe(200);
        expect(ids).toContain(idA);
        expect(ids).not.toContain(idB);
    });

    it("AC-10: another authenticated requester sees a different, non-overlapping list", async () => {
        const idA = await createTicket(a, "Only A can see this");

        const resB = await b.agent.get("/api/tickets?pageSize=50");

        expect(resB.body.data.map((t: { id: number }) => t.id)).not.toContain(idA);
    });

    it("AC-11 / BR-23: a search with zero matches returns an empty list", async () => {
        await createTicket(a, "Findable summary text");

        const res = await a.agent.get("/api/tickets?search=zzz_no_such_ticket_zzz");

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
        expect(res.body.pagination.totalItems).toBe(0);
    });

    it("AC-12 / BR-23: a requester with zero tickets ever gets an empty list", async () => {
        const res = await fresh.agent.get("/api/tickets");

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
        expect(res.body.pagination.totalItems).toBe(0);
    });

    it("AC-13 / BR-10: pagination returns the correct page and clamps pageSize", async () => {
        for (let i = 0; i < 12; i++) await createTicket(a, `Paged ticket ${i}`);

        const page1 = await a.agent.get("/api/tickets?page=1&pageSize=5");
        const page2 = await a.agent.get("/api/tickets?page=2&pageSize=5");
        expect(page1.body.data).toHaveLength(5);
        expect(page2.body.data).toHaveLength(5);

        const ids1 = page1.body.data.map((t: { id: number }) => t.id);
        const ids2 = page2.body.data.map((t: { id: number }) => t.id);
        expect(ids1.some((id: number) => ids2.includes(id))).toBe(false);

        const clamped = await a.agent.get("/api/tickets?pageSize=9999");
        expect(clamped.body.pagination.pageSize).toBe(50);
    });

    it("BR-09: defaults to createdAt descending", async () => {
        const res = await a.agent.get("/api/tickets?pageSize=50");
        const dates = res.body.data.map((t: { createdAt: string }) => new Date(t.createdAt).getTime());
        expect(dates).toEqual([...dates].sort((x, y) => y - x));
    });
});