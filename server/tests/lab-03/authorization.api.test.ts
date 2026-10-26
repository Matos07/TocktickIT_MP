import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { createLoggedInUser, createTestUser, loginAgent, TEST_PASSWORD } from "../helpers/auth.js";

const prisma = getPrisma();
type Session = Awaited<ReturnType<typeof createLoggedInUser>>;

let categoryId: number;
let relatedSystemId: number;
let me: Session;
let other: Session;

const validBody = () => ({
    categoryId,
    relatedSystemId,
    summary: "Authorization test ticket",
    description: "Description long enough to pass validation checks.",
    requestedPriority: "LOW",
});

beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow()).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    me = await createLoggedInUser("REQUESTER");
    other = await createLoggedInUser("REQUESTER");
});

describe("AUTH-05: unauthenticated access", () => {
    it.each([
        ["get", "/api/tickets"],
        ["post", "/api/tickets"],
        ["get", "/api/tickets/1"],
        ["post", "/api/tickets/1/attachments"],
        ["get", "/api/attachments/1"],
        ["get", "/api/attachments/1/download"],
        ["delete", "/api/attachments/1"],
        ["get", "/api/tickets/1/comments"],
        ["post", "/api/tickets/1/comments"],
        ["patch", "/api/tickets/1/resolved-by-requester"],
    ])("%s %s returns 401 without a session", async (method, path) => {
        const res = await (request(app) as any)[method](path);
        expect(res.status).toBe(401);
    });
});

describe("Role enforcement on Requester endpoints", () => {
    it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("%s gets 403 on Requester ticket endpoints", async (role) => {
        const { agent } = await createLoggedInUser(role);

        expect((await agent.get("/api/tickets")).status).toBe(403);
        expect((await agent.post("/api/tickets").send(validBody())).status).toBe(403);
    });
});

describe("AC-03 / BR-03: identity comes from the session, never the client", () => {
    it("ignores a requesterId supplied in the request body", async () => {
        const res = await me.agent.post("/api/tickets").send({ ...validBody(), requesterId: other.user.id });

        expect(res.status).toBe(201);
        expect(res.body.requesterId).toBe(me.user.id);
    });

    it("ignores a requesterId supplied in the query string", async () => {
        const created = await other.agent.post("/api/tickets").send(validBody());

        const res = await me.agent.get(`/api/tickets?requesterId=${other.user.id}&pageSize=50`);

        expect(res.status).toBe(200);
        expect(res.body.data.map((t: { id: number }) => t.id)).not.toContain(created.body.id);
    });
});

describe("AC-14 / BR-24: cross-requester ticket access", () => {
    it("returns the same 404 for another requester's ticket and for a nonexistent one", async () => {
        const created = await other.agent.post("/api/tickets").send(validBody());

        const foreign = await me.agent.get(`/api/tickets/${created.body.id}`);
        const missing = await me.agent.get("/api/tickets/999999999");

        expect(foreign.status).toBe(404);
        expect(missing.status).toBe(404);
        expect(foreign.body).toEqual(missing.body);
    });
});

describe("AC-02 / BR-02: mustChangePassword gate on real routes", () => {
    it("blocks ticket APIs until the password is changed, then allows them", async () => {
        const user = await createTestUser("REQUESTER", { mustChangePassword: true });
        const agent = await loginAgent(user.email);

        const blocked = await agent.get("/api/tickets");
        expect(blocked.status).toBe(403);
        expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

        const change = await agent
            .patch("/api/auth/password")
            .send({ currentPassword: TEST_PASSWORD, newPassword: "BrandNew123!" });
        expect(change.status).toBe(200);

        expect((await agent.get("/api/tickets")).status).toBe(200);
    });
});