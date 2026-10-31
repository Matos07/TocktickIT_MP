import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { createLoggedInUser, createTestUser } from "../helpers/auth.js";

const prisma = getPrisma();
type Session = Awaited<ReturnType<typeof createLoggedInUser>>;
type Row = { id: number; ticketOwnerId: number | null; ticketOwnerName: string | null; itPriority: string | null };

// Scopes every query to the three tickets created below, whatever else is in the shared dev database.
const marker = `queue${Date.now()}`;

let categoryId: number;
let relatedSystemId: number;
let r1: Session;
let r2: Session;
let staff: Session;
let admin: Session;
let t1: { id: number; ticketNumber: string };
let t2: { id: number; ticketNumber: string };
let t3: { id: number; ticketNumber: string };

async function createTicket(s: Session, label: string, requestedPriority: string) {
    const res = await s.agent.post("/api/tickets").send({
        categoryId,
        relatedSystemId,
        summary: `Queue ${marker} ${label}`,
        description: "Description long enough to pass validation checks.",
        requestedPriority,
    });
    return res.body as { id: number; ticketNumber: string };
}

const list = (s: Session, qs = "") => s.agent.get(`/api/staff/tickets?search=${marker}${qs}`);
const ids = (res: { body: { data: Row[] } }) => res.body.data.map((t) => t.id);

beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow()).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    r1 = await createLoggedInUser("REQUESTER");
    r2 = await createLoggedInUser("REQUESTER");
    staff = await createLoggedInUser("IT_STAFF");
    admin = await createLoggedInUser("ADMINISTRATOR");

    t1 = await createTicket(r1, "one", "LOW");
    t2 = await createTicket(r2, "two", "HIGH");
    t3 = await createTicket(r1, "three", "MEDIUM");
    // Claim does not exist yet (Issue 7), so ownership and status are set directly.
    await prisma.ticket.update({
        where: { id: t3.id },
        data: { ticketOwnerId: staff.user.id, currentStatus: "IN_PROGRESS" },
    });
});

describe("GET /api/staff/tickets", () => {
    it("AC-11: shows tickets from every requester to IT Staff and Administrator, newest first", async () => {
        for (const viewer of [staff, admin]) {
            const res = await list(viewer);
            expect(res.status).toBe(200);
            expect(ids(res)).toEqual([t3.id, t2.id, t1.id]);
        }
    });

    it("exposes owner and IT Priority; an unassigned ticket has a null owner", async () => {
        const res = await list(staff);
        const byId = new Map<number, Row>(res.body.data.map((t: Row) => [t.id, t]));

        expect(byId.get(t3.id)).toMatchObject({ ticketOwnerId: staff.user.id, ticketOwnerName: staff.user.name });
        expect(byId.get(t1.id)).toMatchObject({ ticketOwnerId: null, ticketOwnerName: null });
        expect(byId.get(t2.id)?.itPriority).toBe("HIGH"); // BR-16: copied from the requested priority
    });

    it("searches ticket number and summary, case-insensitively", async () => {
        const byNumber = await staff.agent.get(`/api/staff/tickets?search=${t1.ticketNumber.toLowerCase()}`);
        expect(ids(byNumber)).toEqual([t1.id]);

        const bySummary = await staff.agent.get(`/api/staff/tickets?search=${marker.toUpperCase()}`);
        expect(bySummary.body.pagination.totalItems).toBe(3);
    });

    it("filters by requestedPriority, status and category", async () => {
        expect(ids(await list(staff, "&requestedPriority=HIGH"))).toEqual([t2.id]);
        expect(ids(await list(staff, "&status=IN_PROGRESS"))).toEqual([t3.id]);
        expect((await list(staff, `&categoryId=${categoryId}`)).body.pagination.totalItems).toBe(3);
        expect((await list(staff, "&categoryId=999999")).body.data).toHaveLength(0);
    });

    it("filters by itPriority independently of requestedPriority", async () => {
        expect(ids(await list(staff, "&itPriority=HIGH"))).toEqual([t2.id]);

        await prisma.ticket.update({ where: { id: t1.id }, data: { itPriority: "HIGH" } });

        expect(ids(await list(staff, "&itPriority=HIGH")).sort()).toEqual([t1.id, t2.id].sort());
    });

    it("filters by owner, including 'unassigned'", async () => {
        expect(ids(await list(staff, "&ownerId=unassigned")).sort()).toEqual([t1.id, t2.id].sort());
        expect(ids(await list(staff, `&ownerId=${staff.user.id}`))).toEqual([t3.id]);
    });

    it("sorts by ticket number in both directions", async () => {
        expect(ids(await list(staff, "&sortBy=ticketNumber&sortOrder=asc"))).toEqual([t1.id, t2.id, t3.id]);
        expect(ids(await list(staff, "&sortBy=ticketNumber&sortOrder=desc"))).toEqual([t3.id, t2.id, t1.id]);
    });

    it("paginates and clamps pageSize at 50", async () => {
        const page1 = await list(staff, "&pageSize=2&page=1");
        const page2 = await list(staff, "&pageSize=2&page=2");

        expect(page1.body.data).toHaveLength(2);
        expect(page2.body.data).toHaveLength(1);
        expect(page1.body.pagination).toMatchObject({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });

        expect((await list(staff, "&pageSize=9999")).body.pagination.pageSize).toBe(50);
    });

    it("ignores invalid query parameters instead of failing", async () => {
        const res = await list(
            staff,
            "&sortBy=passwordHash&sortOrder=sideways&status=NOPE&ownerId=abc&itPriority=URGENT&page=-3"
        );

        expect(res.status).toBe(200);
        expect(ids(res)).toEqual([t3.id, t2.id, t1.id]);
        expect(res.body.pagination.page).toBe(1);
    });

    it("AC-11: a search with no match returns an empty page with consistent metadata", async () => {
        const res = await staff.agent.get("/api/staff/tickets?search=zzz_no_such_ticket_zzz");

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
        expect(res.body.pagination).toMatchObject({ totalItems: 0, totalPages: 0 });
    });
});

describe("GET /api/staff/assignees", () => {
    it("lists only active IT Staff and Administrators, without sensitive fields", async () => {
        const inactiveStaff = await createTestUser("IT_STAFF", { isActive: false });

        const res = await staff.agent.get("/api/staff/assignees");
        const assigneeIds = res.body.map((u: { id: number }) => u.id);

        expect(res.status).toBe(200);
        expect(assigneeIds).toEqual(expect.arrayContaining([staff.user.id, admin.user.id]));
        expect(assigneeIds).not.toContain(inactiveStaff.id);
        expect(assigneeIds).not.toContain(r1.user.id);
        expect(res.body.every((u: { role: string }) => ["IT_STAFF", "ADMINISTRATOR"].includes(u.role))).toBe(true);
        expect(Object.keys(res.body[0]).sort()).toEqual(["id", "name", "role"]);
    });

    it("is available to an Administrator too", async () => {
        expect((await admin.agent.get("/api/staff/assignees")).status).toBe(200);
    });
});