import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth/password.js";

// Test users are created per test file with a known password, so tests never
// depend on seed data (whose passwords change during manual testing).
export const TEST_PASSWORD = "TestPass123!";
export type TestRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

let cachedHash: string | null = null;
let counter = 0;

export async function createTestUser(
    role: TestRole = "REQUESTER",
    overrides: { isActive?: boolean; mustChangePassword?: boolean } = {}
) {
    if (!cachedHash) cachedHash = await hashPassword(TEST_PASSWORD);
    counter += 1;
    return getPrisma().user.create({
        data: {
            name: `Test ${role} ${counter}`,
            email: `test-${role.toLowerCase()}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 8)}@example.com`,
            passwordHash: cachedHash,
            role,
            isActive: overrides.isActive ?? true,
            mustChangePassword: overrides.mustChangePassword ?? false,
        },
    });
}

export async function loginAgent(email: string) {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/login").send({ email, password: TEST_PASSWORD });
    if (res.status !== 200) throw new Error(`Test login failed for ${email} (HTTP ${res.status})`);
    return agent;
}

export async function createLoggedInUser(role: TestRole = "REQUESTER") {
    const user = await createTestUser(role);
    const agent = await loginAgent(user.email);
    return { user, agent };
}