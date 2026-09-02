# Lab 1 — Test Plan and Evidence  (fill this in)

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | OK |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | OK |
| 3 | Vitest | Heading renders | OK |
| 4 | Vitest | Success state shows Online + category list | OK |
| 5 | Vitest | Error state shows Offline + message | OK |

