import { test, expect, request } from "@playwright/test";
import { accounts, API, E2E_PASSWORD } from "../support/accounts.js";
import { loginAs, logout, newSession } from "../support/auth.js";
import { shot } from "../support/screenshots.js";

const NEW_PASSWORD = "Fresh#Pass456";

test.describe("Authentication (E2E-01, E2E-02)", () => {
    test("a valid login shows the user and role, and logout ends the session server-side", async ({ page }) => {
        await loginAs(page, accounts.requester.email);

        await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
        await expect(page.getByText(accounts.requester.name)).toBeVisible();
        await expect(page.getByText("Requester", { exact: true })).toBeVisible();
        await shot(page, "authentication/logged-in-requester");

        const cookie = (await page.context().cookies()).find((c) => c.name === "tt_session");
        expect(cookie).toBeDefined();
        expect(cookie!.httpOnly).toBe(true);

        await logout(page);

        // Direct access is blocked once logged out...
        await page.goto("/create-ticket");
        await expect(page).toHaveURL(/\/login$/);
        await shot(page, "authentication/blocked-after-logout");

        // ...and the old session is dead on the server, not just forgotten by the browser (BR-09).
        const replay = await request.newContext();
        const res = await replay.get(`${API}/api/auth/me`, { headers: { cookie: `tt_session=${cookie!.value}` } });
        expect(res.status()).toBe(401);
        await replay.dispose();
    });

    test("invalid credentials get the same generic message, whether or not the email exists", async ({ page }) => {
        for (const email of [accounts.requester.email, "nobody.here@example.com"]) {
            await page.goto("/login");
            await page.getByLabel("Email address").fill(email);
            await page.getByLabel("Password", { exact: true }).fill("Wrong#Pass999");
            await page.getByRole("button", { name: "Sign In" }).click();
            await expect(page.getByRole("alert")).toHaveText("Invalid email or password.");
        }
        await expect(page).toHaveURL(/\/login$/);
        await shot(page, "authentication/login-invalid");
    });

    test("an inactive account gets a distinct message and no session", async ({ page }) => {
        await page.goto("/login");
        await page.getByLabel("Email address").fill(accounts.inactive.email);
        await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
        await page.getByRole("button", { name: "Sign In" }).click();

        await expect(page.getByRole("alert")).toContainText("inactive");
        await expect(page).toHaveURL(/\/login$/);
        expect((await page.request.get(`${API}/api/auth/me`)).status()).toBe(401);
        await shot(page, "authentication/login-inactive");
    });

    test("the Sign In button shows a busy state while the request is in flight", async ({ page }) => {
        await page.route("**/api/auth/login", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await route.continue();
        });
        await page.goto("/login");
        await page.getByLabel("Email address").fill(accounts.requester.email);
        await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
        await page.getByRole("button", { name: "Sign In" }).click();

        await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
        await shot(page, "authentication/login-busy");
        await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    });

    test("a safe error message appears when the API is unreachable", async ({ page }) => {
        await page.route("**/api/auth/login", (route) => route.abort());
        await page.goto("/login");
        await page.getByLabel("Email address").fill(accounts.requester.email);
        await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
        await page.getByRole("button", { name: "Sign In" }).click();

        await expect(page.getByRole("alert")).toHaveText("Login failed.");
        await shot(page, "authentication/login-api-failure");
    });

    test("E2E-02: an initial password must be changed before the app opens", async ({ page }) => {
        await loginAs(page, accounts.firstLogin.email);
        await expect(page).toHaveURL(/\/change-password$/);

        // The normal app stays out of reach: the UI sends us back...
        await page.goto("/");
        await expect(page).toHaveURL(/\/change-password$/);

        // ...and the API refuses too (BR-02).
        const blocked = await page.request.get(`${API}/api/tickets`);
        expect(blocked.status()).toBe(403);
        expect((await blocked.json()).error.code).toBe("PASSWORD_CHANGE_REQUIRED");

        const next = page.getByRole("button", { name: "Continue" });
        await page.getByLabel("Current (temporary) password").fill(E2E_PASSWORD);
        await page.getByLabel("New password", { exact: true }).fill("weak");
        await expect(next).toBeDisabled();
        await shot(page, "authentication/change-password-rules");

        await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
        await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
        await expect(next).toBeEnabled();
        await next.click();

        await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

        await logout(page);
        await loginAs(page, accounts.firstLogin.email, NEW_PASSWORD);
        await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    });

    test("each role sees only its own navigation, and the server refuses what the UI hides", async ({ browser }) => {
        const requester = await newSession(browser, accounts.requester.email);
        await expect(requester.getByRole("link", { name: "Create Ticket", exact: true })).toBeVisible();
        await expect(requester.getByRole("link", { name: "Ticket Queue", exact: true })).toHaveCount(0);
        await requester.goto("/queue");
        await expect(requester.getByText(/access denied/i)).toBeVisible();
        await shot(requester, "staff-queue/forbidden-requester");
        expect((await requester.request.get(`${API}/api/staff/tickets`)).status()).toBe(403);

        const staff = await newSession(browser, accounts.staff.email);
        await expect(staff.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
        await expect(staff.getByRole("link", { name: "Create Ticket", exact: true })).toHaveCount(0);
        await expect(staff.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);
        await staff.goto("/admin/users");
        await expect(staff.getByText(/access denied/i)).toBeVisible();
        expect((await staff.request.get(`${API}/api/admin/users`)).status()).toBe(403);

        const admin = await newSession(browser, accounts.admin.email);
        await expect(admin.getByRole("heading", { name: "User Management" })).toBeVisible();
        await expect(admin.getByRole("link", { name: "Ticket Queue", exact: true })).toBeVisible();
        await expect(admin.getByRole("link", { name: "Users", exact: true })).toBeVisible();
        await shot(admin, "authentication/logged-in-administrator");
    });
});