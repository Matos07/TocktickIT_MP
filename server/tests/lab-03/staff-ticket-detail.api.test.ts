import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { allowedTransitions, STATUS_TRANSITIONS, type TicketStatusValue } from "../../src/lib/ticketStatus.js";
import { createLoggedInUser, createTestUser } from "../helpers/auth.js";

const prisma = getPrisma();
type Session = Awaited<ReturnType<typeof createLoggedInUser>>;

const smallPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let categoryId: number;
let relatedSystemId: number;
let requester: Session;
let staff1: Session;
let staff2: Session;
let admin: Session;

async function createTicket(requestedPriority = "MEDIUM") {
    const res = await requester.agent.post("/api/tickets").send({
        categoryId,
        relatedSystemId,
        summary: "Ticket for staff operations",
        description: "Description long enough to pass validation checks.",
        requestedPriority,
    });
    return res.body.id as number;
}

const patch = (s: Session, id: number, action: string, body: object = {}) =>
    s.agent.patch(`/api/staff/tickets/${id}/${action}`).send(body);
const setStatus = (s: Session, id: number, status: unknown) => patch(s, id, "status", { status });
const reload = (id: number) => prisma.ticket.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow()).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    requester = await createLoggedInUser("REQUESTER");
    staff1 = await createLoggedInUser("IT_STAFF");
    staff2 = await createLoggedInUser("IT_STAFF");
    admin = await createLoggedInUser("ADMINISTRATOR");
});

describe("UNIT-03: status transition matrix (BR-17)", () => {
    it("matches specification.md §5.1", () => {
        expect(STATUS_TRANSITIONS).toEqual({
            NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
            OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
            IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
            WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
            RESOLVED: ["CLOSED", "REOPENED"],
            CLOSED: ["REOPENED"],
            REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
            CANCELLED: [],
        });
    });

    it("makes Cancelled the only dead end, and no status leads to itself", () => {
        for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
            if (from !== "CANCELLED") expect(targets.length).toBeGreaterThan(0);
            expect(targets).not.toContain(from);
        }
        expect(allowedTransitions("NEW")).toEqual(["OPEN", "IN_PROGRESS", "CANCELLED"]);
    });
});

describe("GET /api/staff/tickets/:id", () => {
    it("returns the full detail with names, attachments and the permitted next statuses", async () => {
        const id = await createTicket("HIGH");

        for (const viewer of [staff1, admin]) {
            const res = await viewer.agent.get(`/api/staff/tickets/${id}`);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                id,
                requesterId: requester.user.id,
                requesterName: requester.user.name,
                requestedPriority: "HIGH",
                itPriority: "HIGH",
                currentStatus: "NEW",
                ticketOwnerId: null,
                ticketOwnerName: null,
                requesterConfirmedResolved: false,
                allowedTransitions: ["OPEN", "IN_PROGRESS", "CANCELLED"],
                attachments: [],
            });
            expect(typeof res.body.categoryName).toBe("string");
            expect(typeof res.body.relatedSystemName).toBe("string");
        }
    });

    it("returns 404 for a nonexistent ticket", async () => {
        expect((await staff1.agent.get("/api/staff/tickets/999999999")).status).toBe(404);
    });

    it("returns 403 to a Requester, even for their own ticket", async () => {
        const id = await createTicket();
        expect((await requester.agent.get(`/api/staff/tickets/${id}`)).status).toBe(403);
    });
});

describe("PATCH /api/staff/tickets/:id/claim", () => {
    it("AC-12 / BR-14: claiming an unassigned New ticket makes the caller owner and opens it", async () => {
        const id = await createTicket();

        const res = await patch(staff1, id, "claim");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            ticketOwnerId: staff1.user.id,
            ticketOwnerName: staff1.user.name,
            currentStatus: "OPEN",
        });
    });

    it("is idempotent for the current owner and refuses anyone else with 409", async () => {
        const id = await createTicket();
        await patch(staff1, id, "claim");

        const again = await patch(staff1, id, "claim");
        expect(again.status).toBe(200);
        expect(again.body.currentStatus).toBe("OPEN");

        const rival = await patch(staff2, id, "claim");
        expect(rival.status).toBe(409);
        expect(rival.body.error.code).toBe("TICKET_ALREADY_OWNED");
        expect((await reload(id)).ticketOwnerId).toBe(staff1.user.id);
    });

    it("keeps the status when the ticket is no longer New", async () => {
        const id = await createTicket();
        await setStatus(staff2, id, "IN_PROGRESS");

        const res = await patch(staff1, id, "claim");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ticketOwnerId: staff1.user.id, currentStatus: "IN_PROGRESS" });
    });

    it("lets an Administrator claim a ticket", async () => {
        const id = await createTicket();
        const res = await patch(admin, id, "claim");
        expect(res.status).toBe(200);
        expect(res.body.ticketOwnerId).toBe(admin.user.id);
    });

    it("returns 404 for a nonexistent ticket", async () => {
        expect((await patch(staff1, 999999999, "claim")).status).toBe(404);
    });
});

describe("PATCH /api/staff/tickets/:id/assign", () => {
    it("AC-13 / BR-15: reassigns to another active IT Staff member without touching the status", async () => {
        const id = await createTicket();
        await patch(staff1, id, "claim");

        const res = await patch(staff2, id, "assign", { ticketOwnerId: staff2.user.id });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            ticketOwnerId: staff2.user.id,
            ticketOwnerName: staff2.user.name,
            currentStatus: "OPEN",
        });
    });

    it("assigning an unassigned ticket does not change its status (only claim does, BR-14)", async () => {
        const id = await createTicket();

        const res = await patch(staff1, id, "assign", { ticketOwnerId: staff2.user.id });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ ticketOwnerId: staff2.user.id, currentStatus: "NEW" });
    });

    it("allows an Administrator to be assigned a ticket", async () => {
        const id = await createTicket();
        const res = await patch(staff1, id, "assign", { ticketOwnerId: admin.user.id });
        expect(res.status).toBe(200);
        expect(res.body.ticketOwnerId).toBe(admin.user.id);
    });

    it("rejects an inactive user, a Requester and an unknown id as the new owner (400)", async () => {
        const inactive = await createTestUser("IT_STAFF", { isActive: false });
        const id = await createTicket();

        for (const ticketOwnerId of [inactive.id, requester.user.id, 999999999]) {
            const res = await patch(staff1, id, "assign", { ticketOwnerId });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_ASSIGNEE");
        }
        expect((await reload(id)).ticketOwnerId).toBeNull();
    });

    it("rejects a missing or malformed ticketOwnerId (400)", async () => {
        const id = await createTicket();

        for (const body of [{}, { ticketOwnerId: "7" }, { ticketOwnerId: null }, { ticketOwnerId: 1.5 }, { ticketOwnerId: -3 }]) {
            const res = await patch(staff1, id, "assign", body);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
        }
    });

    it("returns 404 for a nonexistent ticket", async () => {
        expect((await patch(staff1, 999999999, "assign", { ticketOwnerId: staff2.user.id })).status).toBe(404);
    });
});

describe("PATCH /api/staff/tickets/:id/priority", () => {
    it("AC-15: sets IT Priority independently of the requested priority; the Requester sees it read-only", async () => {
        const id = await createTicket("LOW");

        const res = await patch(staff1, id, "priority", { itPriority: "HIGH" });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ itPriority: "HIGH", requestedPriority: "LOW" });

        const seen = await requester.agent.get(`/api/tickets/${id}`);
        expect(seen.body).toMatchObject({ itPriority: "HIGH", requestedPriority: "LOW" });
    });

    it("rejects an invalid priority (400) and leaves the ticket unchanged", async () => {
        const id = await createTicket("MEDIUM");

        for (const itPriority of ["URGENT", "", null, 3]) {
            const res = await patch(staff1, id, "priority", { itPriority });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
        }
        expect((await reload(id)).itPriority).toBe("MEDIUM");
    });

    it("returns 404 for a nonexistent ticket", async () => {
        expect((await patch(staff1, 999999999, "priority", { itPriority: "LOW" })).status).toBe(404);
    });
});

describe("PATCH /api/staff/tickets/:id/status", () => {
    it("BR-17: follows the permitted path through the whole lifecycle", async () => {
        const id = await createTicket();

        for (const status of [
            "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
        ]) {
            const res = await setStatus(staff1, id, status);
            expect(res.status, `moving to ${status}`).toBe(200);
            expect(res.body.currentStatus).toBe(status);
            expect(res.body.allowedTransitions).toEqual(allowedTransitions(status as TicketStatusValue));
        }
    });

    it("AC-14: rejects a transition that is not in the matrix (400) and leaves the status unchanged", async () => {
        const id = await createTicket();

        const res = await setStatus(staff1, id, "RESOLVED"); // New -> Resolved is not permitted

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_TRANSITION");
        expect((await reload(id)).currentStatus).toBe("NEW");
    });

    it("rejects staying in the same status and any move out of Cancelled", async () => {
        const id = await createTicket();
        expect((await setStatus(staff1, id, "NEW")).status).toBe(400);

        expect((await setStatus(staff1, id, "CANCELLED")).status).toBe(200);
        expect((await setStatus(staff1, id, "OPEN")).status).toBe(400);
        expect((await setStatus(staff1, id, "CANCELLED")).status).toBe(400);
        expect((await reload(id)).currentStatus).toBe("CANCELLED");
    });

    it("rejects an unknown or missing status value (400)", async () => {
        const id = await createTicket();

        for (const status of ["DONE", "", null, 7, "toString"]) {
            const res = await setStatus(staff1, id, status);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
        }
    });

    it("BR-28: reopening a ticket clears the Requester's resolved flag", async () => {
        const id = await createTicket();
        await requester.agent.patch(`/api/tickets/${id}/resolved-by-requester`).send({});
        await setStatus(staff1, id, "IN_PROGRESS");
        await setStatus(staff1, id, "RESOLVED");
        expect((await reload(id)).requesterConfirmedResolved).toBe(true); // untouched while Resolved

        const res = await setStatus(staff1, id, "REOPENED");

        expect(res.status).toBe(200);
        expect(res.body.requesterConfirmedResolved).toBe(false);
    });

    it("lets an Administrator change the status too", async () => {
        const id = await createTicket();
        const res = await setStatus(admin, id, "OPEN");
        expect(res.status).toBe(200);
        expect(res.body.currentStatus).toBe("OPEN");
    });

    it("returns 404 for a nonexistent ticket", async () => {
        expect((await setStatus(staff1, 999999999, "OPEN")).status).toBe(404);
    });
});

describe("A Requester cannot operate on tickets", () => {
    it.each([
        ["claim", {}],
        ["assign", { ticketOwnerId: 1 }],
        ["priority", { itPriority: "HIGH" }],
        ["status", { status: "OPEN" }],
    ])("%s returns 403 and leaves the ticket unchanged", async (action, body) => {
        const id = await createTicket();

        const res = await patch(requester, id, action, body);

        expect(res.status).toBe(403);
        const ticket = await reload(id);
        expect(ticket.ticketOwnerId).toBeNull();
        expect(ticket.currentStatus).toBe("NEW");
        expect(ticket.itPriority).toBe("MEDIUM");
    });
});

describe("Staff access to attachments", () => {
    it("lets IT Staff download an active attachment and keeps removed ones as metadata only", async () => {
        const id = await createTicket();
        const up = await requester.agent.post(`/api/tickets/${id}/attachments`).attach("file", smallPng, "photo.png");

        const download = await staff1.agent.get(`/api/staff/attachments/${up.body.id}/download`);
        expect(download.status).toBe(200);
        expect(Buffer.compare(download.body, smallPng)).toBe(0);

        const detail = await staff1.agent.get(`/api/staff/tickets/${id}`);
        expect(detail.body.attachments).toHaveLength(1);

        expect((await requester.agent.get(`/api/staff/attachments/${up.body.id}/download`)).status).toBe(403);

        await requester.agent.delete(`/api/attachments/${up.body.id}`).send({ reason: "Replaced by a better one." });

        expect((await admin.agent.get(`/api/staff/attachments/${up.body.id}/download`)).status).toBe(404);
        const after = await admin.agent.get(`/api/staff/tickets/${id}`);
        expect(after.body.attachments[0]).toMatchObject({ id: up.body.id, removedReason: "Replaced by a better one." });
        expect(after.body.attachments[0].removedAt).not.toBeNull();
    });

    it("does not let IT Staff add or remove attachments (Requester-only)", async () => {
        const id = await createTicket();
        const up = await requester.agent.post(`/api/tickets/${id}/attachments`).attach("file", smallPng, "photo.png");

        const add = await staff1.agent.post(`/api/tickets/${id}/attachments`).attach("file", smallPng, "other.png");
        expect(add.status).toBe(403);

        const remove = await staff1.agent.delete(`/api/attachments/${up.body.id}`).send({ reason: "Not allowed" });
        expect(remove.status).toBe(403);
    });
});