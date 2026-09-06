import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// ── GET /api/requesters ────────────────────────────────────────────────────
// Tests BR-05 (only active requesters), api-spec §3 (shape + 500 behaviour).
// Happy-path runs against the live DB (integration); error-path mocks Prisma.

describe("GET /api/requesters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with only active requesters in correct shape", async () => {
    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Seed provides 4 active requesters.
    expect(res.body.length).toBeGreaterThanOrEqual(4);

    for (const r of res.body) {
      // api-spec §3 shape: id, name, email only.
      expect(r).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
      });
      // isActive must NOT be leaked in the response.
      expect(r).not.toHaveProperty("isActive");
    }

    // BR-05: inactive requester (Sofia Dupont) must not appear.
    const names = res.body.map((r: { name: string }) => r.name);
    expect(names).not.toContain("Sofia Dupont");
  });

  it("returns 500 with error object on DB failure — NOT an empty array (api-spec §3)", async () => {
    const prismaModule = await import("../../src/prisma.js");
    vi.spyOn(prismaModule, "getPrisma").mockReturnValue({
      developmentRequester: {
        findMany: vi.fn().mockRejectedValue(new Error("DB connection lost")),
      },
    } as never);

    const res = await request(app).get("/api/requesters");

    expect(res.status).toBe(500);
    // Must have an error property, not be an array.
    expect(res.body).toHaveProperty("error");
    expect(Array.isArray(res.body)).toBe(false);
  });
});
