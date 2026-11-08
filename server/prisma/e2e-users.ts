import bcrypt from "bcryptjs";
import { getPrisma } from "../src/prisma.js";

// Dedicated end-to-end accounts: a known password and a known state, reset on every run.
// Keep in sync with e2e/support/accounts.ts. Local development only.
const E2E_PASSWORD = "E2e#Pass123";

const accounts = [
    { name: "E2E Requester", email: "e2e.requester@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false },
    { name: "E2E Other Requester", email: "e2e.requester2@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: false },
    { name: "E2E Staff", email: "e2e.staff@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false },
    { name: "E2E Staff Two", email: "e2e.staff2@example.com", role: "IT_STAFF" as const, isActive: true, mustChangePassword: false },
    { name: "E2E Administrator", email: "e2e.admin@example.com", role: "ADMINISTRATOR" as const, isActive: true, mustChangePassword: false },
    { name: "E2E First Login", email: "e2e.firstlogin@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: true },
    { name: "E2E First Login Shots", email: "e2e.firstlogin2@example.com", role: "REQUESTER" as const, isActive: true, mustChangePassword: true },
    { name: "E2E Inactive", email: "e2e.inactive@example.com", role: "REQUESTER" as const, isActive: false, mustChangePassword: false },
];

async function main() {
    const prisma = getPrisma();
    const passwordHash = await bcrypt.hash(E2E_PASSWORD, 12);

    for (const account of accounts) {
        await prisma.user.upsert({
            where: { email: account.email },
            update: { ...account, passwordHash },
            create: { ...account, passwordHash },
        });
    }
    console.log(`✔  ${accounts.length} E2E accounts ready (password: ${E2E_PASSWORD})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await getPrisma().$disconnect();
    });