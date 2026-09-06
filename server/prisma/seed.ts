import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// Lab 2 — Issue 2: idempotent seed for all reference data.
// Safe to run multiple times; upsert on unique fields avoids duplicate rows.
// ---------------------------------------------------------------------------

async function main() {
  const prisma = getPrisma();

  // ── Lab 1: IT request categories (unchanged) ────────────────────────────
  const categoryNames = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✔  Seeded ${categoryNames.length} categories`);

  // ── Development Requesters ───────────────────────────────────────────────
  // BR-05: only isActive = true appear in the selector.
  // BR-22: the 1 inactive requester simulates a deactivated account;
  //        any Tickets they created while active remain accessible.
  const requesters = [
    // 4 active
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true },
    { name: "Marcus Chen", email: "marcus.chen@example.com", isActive: true },
    { name: "Priya Nair", email: "priya.nair@example.com", isActive: true },
    { name: "Lucas Ferreira", email: "lucas.ferreira@example.com", isActive: true },
    // 1 inactive — available for BR-22 and BR-05 filter tests
    { name: "Sofia Dupont", email: "sofia.dupont@example.com", isActive: false },
  ];
  for (const r of requesters) {
    await prisma.developmentRequester.upsert({
      where: { email: r.email },
      update: { name: r.name, isActive: r.isActive },
      create: r,
    });
  }
  console.log(`✔  Seeded ${requesters.length} development requesters (${requesters.filter((r) => r.isActive).length} active, ${requesters.filter((r) => !r.isActive).length} inactive)`);

  // ── Related Systems ──────────────────────────────────────────────────────
  // BR-12: inactive system is available to test 400 INVALID_REFERENCE.
  const systems = [
    // 6 active
    { name: "Corporate Laptop", isActive: true },
    { name: "VPN", isActive: true },
    { name: "Email / Microsoft 365", isActive: true },
    { name: "HR System (Workday)", isActive: true },
    { name: "ERP (SAP)", isActive: true },
    { name: "Wi-Fi / Network Access", isActive: true },
    // 1 inactive — available for BR-12 validation tests
    { name: "Legacy Ticketing System", isActive: false },
  ];
  for (const s of systems) {
    await prisma.relatedSystem.upsert({
      where: { name: s.name },
      update: { isActive: s.isActive },
      create: s,
    });
  }
  console.log(`✔  Seeded ${systems.length} related systems (${systems.filter((s) => s.isActive).length} active, ${systems.filter((s) => !s.isActive).length} inactive)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });

