import fs from "fs";
import path from "path";
import { getPrisma } from "../src/prisma.js";

// Builds a "one active administrator" world for the last-administrator demonstration:
//   npm run e2e:admins -- isolate   deactivates every administrator except the E2E one
//   npm run e2e:admins -- restore   reactivates exactly the ones it deactivated
// If a run is interrupted, `restore` still works, and `npm run prisma:seed` reactivates alex.thompson.
const KEEP_EMAIL = "e2e.admin@example.com";
const STATE_FILE = path.join(process.cwd(), "prisma", ".e2e-admins.json");

async function main() {
    const prisma = getPrisma();
    const mode = process.argv[2];

    if (mode === "isolate") {
        const others = await prisma.user.findMany({
            where: { role: "ADMINISTRATOR", isActive: true, email: { not: KEEP_EMAIL } },
            select: { id: true },
        });
        const ids = others.map((u) => u.id);

        // Merge with an earlier, unrestored run so no id is ever forgotten.
        const previous: number[] = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : [];
        fs.writeFileSync(STATE_FILE, JSON.stringify([...new Set([...previous, ...ids])]));

        await prisma.user.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
        console.log(`✔  ${ids.length} administrator(s) deactivated; ${KEEP_EMAIL} is now the only active one`);
    } else if (mode === "restore") {
        if (!fs.existsSync(STATE_FILE)) {
            console.log("Nothing to restore.");
            return;
        }
        const ids: number[] = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        await prisma.user.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
        fs.unlinkSync(STATE_FILE);
        console.log(`✔  ${ids.length} administrator(s) reactivated`);
    } else {
        throw new Error('Usage: npm run e2e:admins -- <isolate|restore>');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await getPrisma().$disconnect();
    });