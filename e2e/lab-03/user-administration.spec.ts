import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";
import { accounts, API } from "../support/accounts.js";
import { loginAs, newPage, newSession } from "../support/auth.js";
import { shot } from "../support/screenshots.js";

const serverDir = path.resolve(process.cwd(), "server");
const stamp = Date.now();
const INITIAL = "Initial#Pass1";
const RESET = "Reset#Pass88";
const newEmail = `e2e.created.${stamp}@example.com`;
const newName = `E2E Created ${stamp}`;
const renamed = `E2E Renamed ${stamp}`;

const rowFor = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });

test.describe.serial("User administration (E2E-04)", () => {
    test("creates a user with validation, finds it, edits it, and rejects a duplicate email", async ({ browser }) => {
        const admin = await newSession(browser, accounts.admin.email);
        await expect(admin.getByRole("heading", { name: "User Management" })).toBeVisible();

        await admin.getByRole("button", { name: "Create User" }).click();
        await admin.getByRole("button", { name: "Save User" }).click();
        await expect(admin.getByText("Name is required.")).toBeVisible();
        await shot(admin, "user-management/create-validation");

        await admin.getByLabel(/^Full Name/).fill(newName);
        await admin.getByLabel(/^Email Address/).fill(newEmail);
        await admin.getByLabel(/^Role/).selectOption("IT_STAFF");
        await admin.getByLabel(/^Initial Password/).fill("weak");
        await admin.getByRole("button", { name: "Save User" }).click();
        await expect(admin.getByText("Password does not meet the rules above.")).toBeVisible();

        await admin.getByLabel(/^Initial Password/).fill(INITIAL);
        await admin.getByRole("button", { name: "Save User" }).click();
        await expect(admin.getByText("User created.")).toBeVisible();

        // AC-17: search by email
        await admin.getByLabel("Search").fill(newEmail);
        const row = rowFor(admin, newEmail);
        await expect(row.getByText("IT Staff")).toBeVisible();
        await expect(row.getByText("Active", { exact: true })).toBeVisible();
        await shot(admin, "user-management/user-created");

        // AC-18: a duplicate email is refused, whatever its case
        await admin.getByRole("button", { name: "Create User" }).click();
        await admin.getByLabel(/^Full Name/).fill("Copycat");
        await admin.getByLabel(/^Email Address/).fill(newEmail.toUpperCase());
        await admin.getByLabel(/^Initial Password/).fill(INITIAL);
        await admin.getByRole("button", { name: "Save User" }).click();
        await expect(admin.getByText("This email address is already in use.")).toBeVisible();
        await shot(admin, "user-management/duplicate-email");
        await admin.getByRole("button", { name: "Cancel" }).click();

        // Edit
        await row.getByRole("button", { name: `Edit ${newName}` }).click();
        await admin.getByLabel(/^Full Name/).fill(renamed);
        await admin.getByRole("button", { name: "Save User" }).click();
        await expect(admin.getByText("User updated.")).toBeVisible();
        await expect(rowFor(admin, newEmail).getByText(renamed)).toBeVisible();
    });

    test("deactivating blocks login at once, reactivating restores it, and a reset forces a new password change", async ({ browser }) => {
        const admin = await newSession(browser, accounts.admin.email);
        await admin.getByLabel("Search").fill(newEmail);
        const edit = () => rowFor(admin, newEmail).getByRole("button", { name: `Edit ${renamed}` }).click();

        await edit();
        await admin.getByRole("button", { name: "Deactivate User" }).click();
        await expect(admin.getByText(new RegExp(`Deactivate ${renamed}\\?`))).toBeVisible();
        await shot(admin, "user-management/deactivate-confirm");
        await admin.getByRole("button", { name: "Confirm Deactivation" }).click();
        await expect(admin.getByText("User deactivated.")).toBeVisible();
        await expect(rowFor(admin, newEmail).getByText("Inactive")).toBeVisible();

        // The deactivated user cannot log in
        const user = await newPage(browser);
        await user.goto("/login");
        await user.getByLabel("Email address").fill(newEmail);
        await user.getByLabel("Password", { exact: true }).fill(INITIAL);
        await user.getByRole("button", { name: "Sign In" }).click();
        await expect(user.getByRole("alert")).toContainText("inactive");

        // Reactivated: the user can log in again, with the initial password they must change (AC-21)
        await edit();
        await admin.getByRole("button", { name: "Reactivate User" }).click();
        await expect(admin.getByText("User reactivated.")).toBeVisible();
        await loginAs(user, newEmail, INITIAL);
        await expect(user).toHaveURL(/\/change-password$/);

        // A reset ends the user's session (BR-30) and forces a new password change at the next login (BR-26)
        await edit();
        await admin.getByRole("button", { name: "Set New Password" }).click();
        await admin.getByLabel("New initial password").fill(RESET);
        await admin.getByRole("button", { name: "Apply New Password" }).click();
        await expect(admin.getByText(/must change it at next login/i)).toBeVisible();

        await user.reload();
        await expect(user).toHaveURL(/\/login$/);
        await loginAs(user, newEmail, RESET);
        await expect(user).toHaveURL(/\/change-password$/);
    });

    test("an administrator cannot deactivate their own account, and non-administrators are refused", async ({ browser }) => {
        const admin = await newSession(browser, accounts.admin.email);
        await admin.getByLabel("Search").fill(accounts.admin.email);
        await rowFor(admin, accounts.admin.email).getByRole("button", { name: `Edit ${accounts.admin.name}` }).click();

        await expect(admin.getByRole("button", { name: "Deactivate User" })).toBeDisabled();
        await expect(admin.getByText("You cannot deactivate your own account.")).toBeVisible();
        await shot(admin, "user-management/self-deactivation-blocked");

        // The server refuses on its own if the button is bypassed (BR-23)
        const { id } = await (await admin.request.get(`${API}/api/auth/me`)).json();
        const forced = await admin.request.patch(`${API}/api/admin/users/${id}`, { data: { isActive: false } });
        expect(forced.status()).toBe(400);
        expect((await forced.json()).error.code).toBe("CANNOT_DEACTIVATE_SELF");

        const staff = await newSession(browser, accounts.staff.email);
        await staff.goto("/admin/users");
        await expect(staff.getByText(/access denied/i)).toBeVisible();
        await shot(staff, "user-management/forbidden-non-admin");
        const create = await staff.request.post(`${API}/api/admin/users`, {
            data: { name: "Nope", email: `nope.${stamp}@example.com`, role: "REQUESTER", initialPassword: INITIAL },
        });
        expect(create.status()).toBe(403);
    });
});

// The only active administrator cannot be demoted. `isolate` deactivates every other administrator for
// the duration of this block, and `restore` brings them back, even if the test fails.
test.describe("the last active administrator (BR-24)", () => {
    test.beforeAll(() => {
        execSync("npm run e2e:admins -- isolate", { cwd: serverDir, stdio: "inherit" });
    });
    test.afterAll(() => {
        execSync("npm run e2e:admins -- restore", { cwd: serverDir, stdio: "inherit" });
    });

    test("cannot change their own role, and the refusal is explained", async ({ browser }) => {
        const admin = await newSession(browser, accounts.admin.email);
        await admin.getByLabel("Search").fill(accounts.admin.email);
        await rowFor(admin, accounts.admin.email).getByRole("button", { name: `Edit ${accounts.admin.name}` }).click();

        await admin.getByLabel(/^Role/).selectOption("IT_STAFF");
        await admin.getByRole("button", { name: "Save User" }).click();

        await expect(admin.getByText(/at least one active administrator must remain/i)).toBeVisible();
        await shot(admin, "user-management/last-administrator");

        // Nothing changed: after a reload the account is still an administrator
        await admin.reload();
        await expect(admin.getByRole("link", { name: "Users", exact: true })).toBeVisible();
    });
});