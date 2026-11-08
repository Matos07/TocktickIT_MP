import { execSync } from "node:child_process";
import path from "node:path";

// Creates or resets the dedicated E2E accounts before every run, so each scenario starts from a known state.
// Run `npx playwright test` from the repository root.
export default async function globalSetup() {
    execSync("npm run prisma:e2e-users", { cwd: path.resolve(process.cwd(), "server"), stdio: "inherit" });
}