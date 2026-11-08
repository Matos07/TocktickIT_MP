import { getPrisma } from "../src/prisma.js";

// Deactivates the throwaway accounts that the Vitest suites and the E2E user tests leave behind, so they
// stop cluttering assignee menus. Nothing is deleted: tickets and history stay intact (BR-25).
async function main() {
    const result = await getPrisma().user.updateMany({
        where: {
            isActive: true,
            OR: [
                { email: { startsWith: "test-" } },
                { email: { startsWith: "usradm" } },
                { email: { startsWith: "e2e.created." } },
            ],
        },
        data: { isActive: false },
    });
    console.log(`✔  ${result.count} throwaway account(s) deactivated`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await getPrisma().$disconnect();
    });