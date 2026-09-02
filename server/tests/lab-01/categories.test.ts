import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
void request; void app;

// Issue 4 — write this test yourself, using health.test.ts as the pattern.
// Requires the DB to be migrated and seeded first.
// It should assert: GET /api/categories returns 200 and the four seeded
// category names in id order.
describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    // TODO(Issue 4): implement this assertion.
    const res = await request(app).get("/api/categories")

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);

    const names = res.body.map((c: { name: string }) => c.name);
    expect(names).toEqual(["Account and Access", "Hardware", "Software", "Network"])
  });
});

