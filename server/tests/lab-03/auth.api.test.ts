import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { requirePasswordChanged } from "../../src/middleware/auth.js";

const prisma = getPrisma();
const SEED_PASSWORD = "Password123!";

let activeRequesterEmail: string;
let inactiveUserEmail: string;

beforeAll(async () => {
    const active = await prisma.user.findFirstOrThrow({ where: { isActive: true, role: "REQUESTER" } });
    activeRequesterEmail = active.email;
    const inactive = await prisma.user.findFirstOrThrow({ where: { isActive: false } });
    inactiveUserEmail = inactive.email;
});

describe("POST /api/auth/login", () => {
    it("AC-01: valid credentials return 200, identity, and set a session cookie", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: activeRequesterEmail, password: SEED_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.role).toBe("REQUESTER");
        expect(res.body.mustChangePassword).toBe(true); // seed default
        expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("AC-05/BR-06: unknown email and wrong password return the identical generic message", async () => {
        const unknownEmailRes = await request(app)
            .post("/api/auth/login")
            .send({ email: "nobody@example.com", password: "whatever123!A" });

        const wrongPasswordRes = await request(app)
            .post("/api/auth/login")
            .send({ email: activeRequesterEmail, password: "wrong-password-123A!" });

        expect(unknownEmailRes.status).toBe(401);
        expect(wrongPasswordRes.status).toBe(401);
        expect(unknownEmailRes.body.error.message).toBe(wrongPasswordRes.body.error.message);
        expect(unknownEmailRes.body.error.message).toBe("Invalid email or password.");
    });

    it("AC-06/BR-07: inactive account returns a distinct 403 message", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: inactiveUserEmail, password: SEED_PASSWORD });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
    });
});

describe("Session lifecycle", () => {
    it("AC-07/BR-09: logout invalidates the session server-side", async () => {
        const agent = request.agent(app);

        await agent.post("/api/auth/login").send({ email: activeRequesterEmail, password: SEED_PASSWORD });
        const meBeforeLogout = await agent.get("/api/auth/me");
        expect(meBeforeLogout.status).toBe(200);

        await agent.post("/api/auth/logout");
        const meAfterLogout = await agent.get("/api/auth/me");
        expect(meAfterLogout.status).toBe(401);
    });

    it("GET /api/auth/me without a session returns 401", async () => {
        const res = await request(app).get("/api/auth/me");
        expect(res.status).toBe(401);
    });
});

describe("PATCH /api/auth/password", () => {
    it("rejects an incorrect current password with 400", async () => {
        const agent = request.agent(app);
        await agent.post("/api/auth/login").send({ email: activeRequesterEmail, password: SEED_PASSWORD });

        const res = await agent
            .patch("/api/auth/password")
            .send({ currentPassword: "totally-wrong", newPassword: "NewPass123!" });

        expect(res.status).toBe(400);
    });

    it("BR-11: rejects a new password that fails complexity rules", async () => {
        const agent = request.agent(app);
        await agent.post("/api/auth/login").send({ email: activeRequesterEmail, password: SEED_PASSWORD });

        const res = await agent
            .patch("/api/auth/password")
            .send({ currentPassword: SEED_PASSWORD, newPassword: "weak" });

        expect(res.status).toBe(400);
    });

    it("AC-02: a valid change clears mustChangePassword", async () => {
        // Use a dedicated user so this test doesn't invalidate SEED_PASSWORD
        // for other tests relying on it in the same run.
        const dedicated = await prisma.user.create({
            data: {
                name: "Temp Password Test User",
                email: `temp-pwtest-${Date.now()}@example.com`,
                passwordHash: (await import("../../src/auth/password.js")).hashPassword
                    ? await (await import("../../src/auth/password.js")).hashPassword(SEED_PASSWORD)
                    : "",
                role: "REQUESTER",
                isActive: true,
                mustChangePassword: true,
            },
        });

        const agent = request.agent(app);
        await agent.post("/api/auth/login").send({ email: dedicated.email, password: SEED_PASSWORD });

        const changeRes = await agent
            .patch("/api/auth/password")
            .send({ currentPassword: SEED_PASSWORD, newPassword: "NewValid123!" });
        expect(changeRes.status).toBe(200);

        const meRes = await agent.get("/api/auth/me");
        expect(meRes.body.mustChangePassword).toBe(false);
    });
});

describe("requirePasswordChanged middleware (unit)", () => {
    it("BR-02: calls next() when mustChangePassword is false", () => {
        const req = { user: { mustChangePassword: false } } as any;
        const res = { status: () => res, json: () => res } as any;
        let nextCalled = false;
        requirePasswordChanged(req, res, () => {
            nextCalled = true;
        });
        expect(nextCalled).toBe(true);
    });

    it("BR-02: responds 403 when mustChangePassword is true", () => {
        const req = { user: { mustChangePassword: true } } as any;
        let statusCode: number | undefined;
        const res = {
            status: (code: number) => {
                statusCode = code;
                return res;
            },
            json: () => res,
        } as any;
        let nextCalled = false;
        requirePasswordChanged(req, res, () => {
            nextCalled = true;
        });
        expect(statusCode).toBe(403);
        expect(nextCalled).toBe(false);
    });
});