export const BASE_URL = "http://localhost:5173";
export const API = "http://localhost:3000";

// Created by server/prisma/e2e-users.ts: keep both files in sync.
export const E2E_PASSWORD = "E2e#Pass123";

export const accounts = {
    requester: { name: "E2E Requester", email: "e2e.requester@example.com" },
    requester2: { name: "E2E Other Requester", email: "e2e.requester2@example.com" },
    staff: { name: "E2E Staff", email: "e2e.staff@example.com" },
    staff2: { name: "E2E Staff Two", email: "e2e.staff2@example.com" },
    admin: { name: "E2E Administrator", email: "e2e.admin@example.com" },
    firstLogin: { name: "E2E First Login", email: "e2e.firstlogin@example.com" },
    firstLoginShots: { name: "E2E First Login Shots", email: "e2e.firstlogin2@example.com" },
    inactive: { name: "E2E Inactive", email: "e2e.inactive@example.com" },
} as const;