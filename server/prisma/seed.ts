import { getPrisma } from "../src/prisma.js";

// Issue 3 — seed the four supported categories.
async function main() {
  const prisma = getPrisma();

  for (const name of [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ]) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
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
