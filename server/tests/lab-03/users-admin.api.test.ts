import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { leavesNoActiveAdministrator } from "../../src/lib/adminRules.js";
import { createLoggedInUser } from "../helpers/auth.js";

// Several tests hash and verify passwords (bcrypt cost 12), so give them more room than the 5 s default.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const prisma = getPrisma();
type Session = Awaited<ReturnType<typeof createLoggedInUser>>;
type UserDto = { id: number; name: string; email: string; role: string; isActive: boolean };

const marker = `usradm${Date.now()}`;
const INITIAL = "Initial#Pass1";
const email = (label: string) => `${marker}-${label}@example.com`;

let categoryId: number;
let relatedSystemId: number;
let admin: Session;
let alice: UserDto;
let bob: UserDto;
let carol: UserDto;

const loginWith = (address: string, password: string) =>
    request(app).post("/api/auth/login").send({ email: address, password });

async function agentFor(address: string, password: string) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({ email: address, password });
    expect(res.status).toBe(200);
    return agent;
}

async function createUser(label: string, role = "REQUESTER", isActive = true): Promise<UserDto> {
    const res = await admin.agent.post("/api/admin/users").send({
        name: `${marker} ${label}`,
        email: email(label),
        role,
        isActive,
        initialPassword: INITIAL,
    });
    expect(res.status).toBe(201);
    return res.body;
}

const patchUser = (id: number, body: object) => admin.agent.patch(`/api/admin/users/${id}`).send(body);

beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow()).id;
    relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })).id;
    admin = await createLoggedInUser("ADMINISTRATOR");
    alice = await createUser("alice");
    bob = await createUser("bob", "IT_STAFF");
    carol = await createUser("carol", "REQUESTER", false);
});

describe("UNIT: leavesNoActiveAdministrator (BR-24)", () => {
    const activeAdmin = { role: "ADMINISTRATOR", isActive: true } as const;

    it("flags deactivating or demoting the only active administrator", () => {
        expect(leavesNoActiveAdministrator(activeAdmin, { isActive: false }, 0)).toBe(true);
        expect(leavesNoActiveAdministrator(activeAdmin, { role: "IT_STAFF" }, 0)).toBe(true);
        expect(leavesNoActiveAdministrator(activeAdmin, { role: "REQUESTER", isActive: false }, 0)).toBe(true);
    });

    it("allows the same changes while another active administrator remains", () => {
        expect(leavesNoActiveAdministrator(activeAdmin, { isActive: false }, 1)).toBe(false);
        expect(leavesNoActiveAdministrator(activeAdmin, { role: "IT_STAFF" }, 2)).toBe(false);
    });

    it("does not flag changes that keep the administrator active", () => {
        expect(leavesNoActiveAdministrator(activeAdmin, {}, 0)).toBe(false);
        expect(leavesNoActiveAdministrator(activeAdmin, { isActive: true, role: "ADMINISTRATOR" }, 0)).toBe(false);
    });

    it("never flags a change to someone who is not an active administrator", () => {
        expect(leavesNoActiveAdministrator({ role: "IT_STAFF", isActive: true }, { isActive: false }, 0)).toBe(false);
        expect(leavesNoActiveAdministrator({ role: "ADMINISTRATOR", isActive: false }, { role: "REQUESTER" }, 0)).toBe(false);
        expect(leavesNoActiveAdministrator({ role: "REQUESTER", isActive: true }, { role: "ADMINISTRATOR" }, 0)).toBe(false);
    });
});

describe("Authorization (AUTH-04)", () => {
    it.each(["IT_STAFF", "REQUESTER"] as const)("%s gets 403 on every admin endpoint", async (role) => {
        const { agent } = await createLoggedInUser(role);
        const before = await prisma.user.count();

        expect((await agent.get("/api/admin/users")).status).toBe(403);
        const create = await agent
            .post("/api/admin/users")
            .send({ name: "Nope", email: email("nope"), role: "REQUESTER", initialPassword: INITIAL });
        expect(create.status).toBe(403);
        expect((await agent.patch(`/api/admin/users/${alice.id}`).send({ name: "Hacked" })).status).toBe(403);
        expect(
            (await agent.patch(`/api/admin/users/${alice.id}/reset-password`).send({ newPassword: "Hacked#Pass1" })).status
        ).toBe(403);

        expect(await prisma.user.count()).toBe(before);
        expect((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).name).toBe(`${marker} alice`);
    });
});

describe("GET /api/admin/users", () => {
    const list = (qs = "") => admin.agent.get(`/api/admin/users?search=${marker}${qs}`);
    const names = (res: { body: UserDto[] }) => res.body.map((u) => u.name);

    it("lists name, email, role and status only, sorted by name", async () => {
        const res = await list();

        expect(res.status).toBe(200);
        expect(names(res)).toEqual([`${marker} alice`, `${marker} bob`, `${marker} carol`]);
        expect(Object.keys(res.body[0]).sort()).toEqual(["email", "id", "isActive", "name", "role"]);
        expect(res.body.find((u: UserDto) => u.id === carol.id)).toMatchObject({ isActive: false });
    });

    it("searches by name or email, case-insensitively", async () => {
        const byEmail = await admin.agent.get(`/api/admin/users?search=${marker}-bob`);
        expect(names(byEmail)).toEqual([`${marker} bob`]);

        const byName = await admin.agent.get(`/api/admin/users?search=${marker.toUpperCase()}%20CAROL`);
        expect(names(byName)).toEqual([`${marker} carol`]);

        expect((await admin.agent.get("/api/admin/users?search=zzz_no_such_user_zzz")).body).toEqual([]);
    });

    it("filters by role and ignores an unknown role", async () => {
        expect(names(await list("&role=REQUESTER"))).toEqual([`${marker} alice`, `${marker} carol`]);
        expect(names(await list("&role=IT_STAFF"))).toEqual([`${marker} bob`]);
        expect(names(await list("&role=SUPERUSER"))).toHaveLength(3);
    });
});

describe("POST /api/admin/users", () => {
    it("creates a user without exposing credentials; the initial password must be changed at first login", async () => {
        const res = await admin.agent.post("/api/admin/users").send({
            name: `${marker} dave`,
            email: email("dave"),
            role: "IT_STAFF",
            isActive: true,
            initialPassword: INITIAL,
        });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({
            id: expect.any(Number),
            name: `${marker} dave`,
            email: email("dave"),
            role: "IT_STAFF",
            isActive: true,
        });

        const stored = await prisma.user.findUniqueOrThrow({ where: { id: res.body.id } });
        expect(stored.passwordHash).not.toBe(INITIAL);
        expect(stored.passwordHash.startsWith("$2")).toBe(true); // bcrypt, never plaintext (BR-08)
        expect(stored.mustChangePassword).toBe(true);

        const login = await loginWith(email("dave"), INITIAL);
        expect(login.status).toBe(200);
        expect(login.body).toMatchObject({ role: "IT_STAFF", mustChangePassword: true });
    });

    it("trims and lowercases the email, and defaults to an active account", async () => {
        const res = await admin.agent.post("/api/admin/users").send({
            name: `  ${marker} erin  `,
            email: `  ${email("erin").toUpperCase()}  `,
            role: "REQUESTER",
            initialPassword: INITIAL,
        });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ name: `${marker} erin`, email: email("erin"), isActive: true });
        expect((await loginWith(email("erin").toUpperCase(), INITIAL)).status).toBe(200); // login is case-insensitive too
    });

    it("AC-18 / BR-22: rejects a duplicate email, whatever its case (409), and creates nothing", async () => {
        for (const duplicate of [email("alice"), email("alice").toUpperCase()]) {
            const res = await admin.agent
                .post("/api/admin/users")
                .send({ name: "Copycat", email: duplicate, role: "REQUESTER", initialPassword: INITIAL });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
            expect(res.body.error.fields).toHaveProperty("email");
        }
        const matches = await prisma.user.count({ where: { email: { equals: email("alice"), mode: "insensitive" } } });
        expect(matches).toBe(1);
    });

    const valid = () => ({
        name: `${marker} valid`,
        email: email("valid"),
        role: "REQUESTER",
        isActive: true,
        initialPassword: INITIAL,
    });

    it.each([
        ["a missing name", { name: undefined }, "name"],
        ["a name over 100 characters", { name: "x".repeat(101) }, "name"],
        ["an invalid email", { email: "not-an-email" }, "email"],
        ["an unknown role", { role: "SUPERUSER" }, "role"],
        ["several roles (BR-21)", { role: ["IT_STAFF", "ADMINISTRATOR"] }, "role"],
        ["a non-boolean isActive", { isActive: "yes" }, "isActive"],
        ["a weak initial password (BR-11)", { initialPassword: "weak" }, "initialPassword"],
        ["a missing initial password", { initialPassword: undefined }, "initialPassword"],
    ])("rejects %s with 400 and creates nothing", async (_label, override, field) => {
        const before = await prisma.user.count();

        const res = await admin.agent.post("/api/admin/users").send({ ...valid(), ...override });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
        expect(res.body.error.fields).toHaveProperty(field);
        expect(await prisma.user.count()).toBe(before);
    });
});

describe("PATCH /api/admin/users/:id", () => {
    it("edits name, email, role and activation state", async () => {
        const user = await createUser("edit1");

        const res = await patchUser(user.id, {
            name: `${marker} edited`,
            email: email("edited1").toUpperCase(),
            role: "IT_STAFF",
            isActive: false,
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            id: user.id,
            name: `${marker} edited`,
            email: email("edited1"),
            role: "IT_STAFF",
            isActive: false,
        });
    });

    it("is not a duplicate of itself when the same email is resubmitted in another case", async () => {
        const res = await patchUser(alice.id, { email: email("alice").toUpperCase() });

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(email("alice"));
    });

    it("BR-22: rejects an email already used by someone else (409), whatever its case", async () => {
        const res = await patchUser(alice.id, { email: email("bob").toUpperCase() });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
        expect((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).email).toBe(email("alice"));
    });

    it.each([
        ["an unknown role", { role: "SUPERUSER" }, "role"],
        ["several roles", { role: ["REQUESTER", "IT_STAFF"] }, "role"],
        ["an invalid email", { email: "nope" }, "email"],
        ["an empty name", { name: "   " }, "name"],
        ["a non-boolean isActive", { isActive: "no" }, "isActive"],
    ])("rejects %s with 400", async (_label, body, field) => {
        const res = await patchUser(alice.id, body);

        expect(res.status).toBe(400);
        expect(res.body.error.fields).toHaveProperty(field);
    });

    it("ignores fields it does not own and refuses an update that changes nothing (400)", async () => {
        const user = await createUser("mass");
        const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

        const sneaky = await patchUser(user.id, { passwordHash: "x", mustChangePassword: false, id: 999999 });
        const empty = await patchUser(user.id, {});

        expect(sneaky.status).toBe(400);
        expect(empty.status).toBe(400);
        const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(after.passwordHash).toBe(before.passwordHash);
        expect(after.mustChangePassword).toBe(true);
    });

    it("returns 404 for an unknown user", async () => {
        expect((await patchUser(999999999, { name: "Ghost" })).status).toBe(404);
    });

    it("AC-19 / BR-23: an administrator cannot deactivate their own account, but can edit it", async () => {
        const res = await patchUser(admin.user.id, { isActive: false });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("CANNOT_DEACTIVATE_SELF");
        expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.user.id } })).isActive).toBe(true);

        expect((await patchUser(admin.user.id, { name: admin.user.name })).status).toBe(200);
    });

    it("BR-30: deactivating ends access at once, and reactivating does not revive the old session", async () => {
        const user = await createUser("deact");
        const agent = await agentFor(user.email, INITIAL);
        expect((await agent.get("/api/auth/me")).status).toBe(200);

        expect((await patchUser(user.id, { isActive: false })).status).toBe(200);

        expect((await agent.get("/api/auth/me")).status).toBe(401);
        const blocked = await loginWith(user.email, INITIAL);
        expect(blocked.status).toBe(403);
        expect(blocked.body.error.code).toBe("ACCOUNT_INACTIVE");

        expect((await patchUser(user.id, { isActive: true })).status).toBe(200);

        expect((await agent.get("/api/auth/me")).status).toBe(401); // the old session stayed dead
        expect((await loginWith(user.email, INITIAL)).status).toBe(200);
    });

    it("a role change takes effect on the very next request", async () => {
        const staff = await createLoggedInUser("IT_STAFF");
        expect((await staff.agent.get("/api/staff/assignees")).status).toBe(200);

        expect((await patchUser(staff.user.id, { role: "REQUESTER" })).status).toBe(200);

        expect((await staff.agent.get("/api/staff/assignees")).status).toBe(403);
    });

    it("BR-25: deactivating a staff member drops them from assignment lists but keeps their tickets", async () => {
        const owner = await createLoggedInUser("IT_STAFF");
        const requester = await createLoggedInUser("REQUESTER");
        const viewer = await createLoggedInUser("IT_STAFF");
        const ticket = await requester.agent.post("/api/tickets").send({
            categoryId,
            relatedSystemId,
            summary: "Ticket owned by a soon-deactivated user",
            description: "Description long enough to pass validation checks.",
            requestedPriority: "LOW",
        });
        await prisma.ticket.update({ where: { id: ticket.body.id }, data: { ticketOwnerId: owner.user.id } });

        const idsOf = async () => (await viewer.agent.get("/api/staff/assignees")).body.map((u: { id: number }) => u.id);
        expect(await idsOf()).toContain(owner.user.id);

        expect((await patchUser(owner.user.id, { isActive: false })).status).toBe(200);

        expect(await idsOf()).not.toContain(owner.user.id);
        const detail = await viewer.agent.get(`/api/staff/tickets/${ticket.body.id}`);
        expect(detail.body).toMatchObject({ ticketOwnerId: owner.user.id, ticketOwnerName: owner.user.name });
    });
});

describe("PATCH /api/admin/users/:id/reset-password", () => {
    it("AC-21 / BR-26 / BR-30: sets a new initial password to change at next login and ends old sessions", async () => {
        const user = await createUser("reset");
        const agent = await agentFor(user.email, INITIAL);
        const changed = await agent.patch("/api/auth/password").send({ currentPassword: INITIAL, newPassword: "Own#Pass99" });
        expect(changed.status).toBe(200);
        expect((await agent.get("/api/auth/me")).body.mustChangePassword).toBe(false);

        const res = await admin.agent
            .patch(`/api/admin/users/${user.id}/reset-password`)
            .send({ newPassword: "Reset#Pass88" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });

        const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(stored.passwordHash).not.toBe("Reset#Pass88");
        expect(stored.passwordHash.startsWith("$2")).toBe(true);

        expect((await agent.get("/api/auth/me")).status).toBe(401); // BR-30: the old session is gone
        expect((await loginWith(user.email, "Own#Pass99")).status).toBe(401); // the old password is dead
        const login = await loginWith(user.email, "Reset#Pass88");
        expect(login.status).toBe(200);
        expect(login.body.mustChangePassword).toBe(true); // BR-26
    });

    it("rejects a weak password (400) and leaves the account untouched", async () => {
        const user = await createUser("resetweak");
        const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

        for (const newPassword of ["weak", "", undefined, 12345678]) {
            const res = await admin.agent.patch(`/api/admin/users/${user.id}/reset-password`).send({ newPassword });
            expect(res.status).toBe(400);
            expect(res.body.error.fields).toHaveProperty("newPassword");
        }
        const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        expect(after.passwordHash).toBe(before.passwordHash);
    });

    it("returns 404 for an unknown user", async () => {
        const res = await admin.agent.patch("/api/admin/users/999999999/reset-password").send({ newPassword: "Reset#Pass88" });
        expect(res.status).toBe(404);
    });
});

// Keep this one last: it temporarily deactivates every other administrator to build a one-admin world.
// If a run is interrupted, `npm run prisma:seed` reactivates the seeded administrator.
describe("BR-24: the last active administrator", () => {
    it("cannot be demoted or deactivated", async () => {
        const first = await createLoggedInUser("ADMINISTRATOR");
        const second = await createLoggedInUser("ADMINISTRATOR");
        const others = await prisma.user.findMany({
            where: { role: "ADMINISTRATOR", isActive: true, id: { notIn: [first.user.id, second.user.id] } },
            select: { id: true },
        });
        const otherIds = others.map((u) => u.id);
        await prisma.user.updateMany({ where: { id: { in: otherIds } }, data: { isActive: false } });

        try {
            // `second` deactivates `first`: allowed, since `second` stays active.
            const removeFirst = await second.agent.patch(`/api/admin/users/${first.user.id}`).send({ isActive: false });
            expect(removeFirst.status).toBe(200);

            // `second` is now the only active administrator.
            const demote = await second.agent.patch(`/api/admin/users/${second.user.id}`).send({ role: "IT_STAFF" });
            expect(demote.status).toBe(400);
            expect(demote.body.error.code).toBe("LAST_ADMINISTRATOR");

            const deactivate = await second.agent.patch(`/api/admin/users/${second.user.id}`).send({ isActive: false });
            expect(deactivate.status).toBe(400);
            expect(deactivate.body.error.code).toBe("CANNOT_DEACTIVATE_SELF");

            const stored = await prisma.user.findUniqueOrThrow({ where: { id: second.user.id } });
            expect(stored).toMatchObject({ role: "ADMINISTRATOR", isActive: true });
        } finally {
            await prisma.user.updateMany({ where: { id: { in: otherIds } }, data: { isActive: true } });
        }
    });
});