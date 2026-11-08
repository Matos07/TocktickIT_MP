import { Browser, expect, Page } from "@playwright/test";
import { BASE_URL, E2E_PASSWORD } from "./accounts.js";

export async function loginAs(page: Page, email: string, password: string = E2E_PASSWORD) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function logout(page: Page) {
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/login$/);
}

// A page in its own browser context (its own cookies), so several roles can act in one test.
export async function newPage(browser: Browser): Promise<Page> {
    const context = await browser.newContext({ baseURL: BASE_URL });
    return context.newPage();
}

export async function newSession(browser: Browser, email: string, password: string = E2E_PASSWORD): Promise<Page> {
    const page = await newPage(browser);
    await loginAs(page, email, password);
    return page;
}