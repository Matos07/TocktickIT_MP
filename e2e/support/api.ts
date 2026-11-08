import { expect, Page } from "@playwright/test";
import { API } from "./accounts.js";

// Test setup only: creates a ticket as the user logged in on `page` (the session cookie is shared).
export async function createTicketViaApi(page: Page, summary: string) {
    const categories = await (await page.request.get(`${API}/api/categories`)).json();
    const systems = await (await page.request.get(`${API}/api/related-systems`)).json();

    const res = await page.request.post(`${API}/api/tickets`, {
        data: {
            categoryId: categories[0].id,
            relatedSystemId: systems[0].id,
            summary,
            description: "Created by an end-to-end test to exercise the workflow.",
            requestedPriority: "MEDIUM",
        },
    });
    expect(res.status()).toBe(201);
    return (await res.json()) as { id: number; ticketNumber: string };
}