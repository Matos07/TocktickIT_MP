import { Page } from "@playwright/test";

export async function shot(page: Page, name: string) {
    await page.screenshot({ path: `artifacts/lab-03/screenshots/${name}.png`, fullPage: true });
}