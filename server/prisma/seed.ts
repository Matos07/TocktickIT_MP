import bcrypt from "bcryptjs";
import { getPrisma } from "../src/prisma.js";

// ---------------------------------------------------------------------------
// Lab 3 — Issue 2: idempotent seed for Users (with hashed passwords), plus
// example Tickets, Public Comments, and Internal Notes.
// Safe to run multiple times; upsert on unique fields avoids duplicate rows.
//
// SEEDED CREDENTIALS ARE FOR LOCAL DEVELOPMENT ONLY. Every seeded user has
// mustChangePassword: true except where noted, and these are not real
// secrets — never reuse them outside this course project.
// ---------------------------------------------------------------------------

const SEED_PASSWORD = "Password123!"; // meets BR-11; every user must change it at first login

async function main() {
  const prisma = getPrisma();

  // ── Lab 1: IT request categories (unchanged) ────────────────────────────
  const categoryNames = ["Account and Access", "Hardware", "Software", "Network"];
  for (const name of categoryNames) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`✔  Seeded ${categoryNames.length} categories`);

  // ── Related Systems (unchanged) ──────────────────────────────────────────
  const systems = [
    { name: "Corporate Laptop", isActive: true },
    { name: "VPN", isActive: true },
    { name: "Email / Microsoft 365", isActive: true },
    { name: "HR System (Workday)", isActive: true },
    { name: "ERP (SAP)", isActive: true },
    { name: "Wi-Fi / Network Access", isActive: true },
    { name: "Legacy Ticketing System", isActive: false },
  ];
  for (const s of systems) {
    await prisma.relatedSystem.upsert({ where: { name: s.name }, update: { isActive: s.isActive }, create: s });
  }
  console.log(`✔  Seeded ${systems.length} related systems`);

  // ── Users ─────────────────────────────────────────────────────────────
  // BR-27: migrated Lab 2 Requesters become role REQUESTER.
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const users = [
    // 4 active Requesters (migrated from Lab 2) + 1 inactive
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Marcus Chen", email: "marcus.chen@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Priya Nair", email: "priya.nair@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Lucas Ferreira", email: "lucas.ferreira@example.com", role: "REQUESTER" as const, isActive: true },
    { name: "Sofia Dupont", email: "sofia.dupont@example.com", role: "REQUESTER" as const, isActive: false },
    // 3 active IT Staff + 1 inactive
    { name: "Michael Brown", email: "michael.brown@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "David Lee", email: "david.lee@example.com", role: "IT_STAFF" as const, isActive: true },
    { name: "Kevin Patel", email: "kevin.patel@example.com", role: "IT_STAFF" as const, isActive: false },
    // 1 active Administrator
    { name: "Alex Thompson", email: "alex.thompson@example.com", role: "ADMINISTRATOR" as const, isActive: true },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, isActive: u.isActive },
      create: { ...u, passwordHash, mustChangePassword: true },
    });
  }
  console.log(`✔  Seeded ${users.length} users (passwords: "${SEED_PASSWORD}", must change at first login)`);

  // ── Example Tickets, distributed across status/owner/priority ──────────
  const category = await prisma.category.findFirstOrThrow({ where: { name: "Hardware" } });
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { name: "Corporate Laptop" } });
  const jennifer = await prisma.user.findUniqueOrThrow({ where: { email: "jennifer.anderson@example.com" } });
  const marcus = await prisma.user.findUniqueOrThrow({ where: { email: "marcus.chen@example.com" } });
  const michael = await prisma.user.findUniqueOrThrow({ where: { email: "michael.brown@example.com" } });
  const sarah = await prisma.user.findUniqueOrThrow({ where: { email: "sarah.johnson@example.com" } });

  const seedTickets = [
    {
      ticketNumber: "TKT-SEED-000001",
      requesterId: jennifer.id,
      ticketOwnerId: michael.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Laptop battery drains quickly",
      description: "Battery drains much faster than usual, started after last week's update.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      currentStatus: "IN_PROGRESS" as const,
    },
    {
      ticketNumber: "TKT-SEED-000002",
      requesterId: marcus.id,
      ticketOwnerId: null,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Cannot connect to VPN",
      description: "VPN client fails to connect since this morning.",
      requestedPriority: "HIGH" as const,
      itPriority: null,
      currentStatus: "NEW" as const,
    },
    {
      ticketNumber: "TKT-SEED-000003",
      requesterId: jennifer.id,
      ticketOwnerId: sarah.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "New employee setup request",
      description: "Need a laptop and accounts provisioned for a new hire starting Monday.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      currentStatus: "RESOLVED" as const,
    },
  ];

  for (const t of seedTickets) {
    await prisma.ticket.upsert({
      where: { ticketNumber: t.ticketNumber },
      update: {},
      create: t,
    });
  }
  console.log(`✔  Seeded ${seedTickets.length} example tickets`);

  // ── Example Public Comment + Internal Note (non-sensitive) ─────────────
  const ticketOne = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: "TKT-SEED-000001" } });

  const existingComment = await prisma.publicComment.findFirst({ where: { ticketId: ticketOne.id } });
  if (!existingComment) {
    await prisma.publicComment.create({
      data: { ticketId: ticketOne.id, authorId: michael.id, content: "We are investigating the issue on your device. We'll update you shortly." },
    });
  }

  const existingNote = await prisma.internalNote.findFirst({ where: { ticketId: ticketOne.id } });
  if (!existingNote) {
    await prisma.internalNote.create({
      data: { ticketId: ticketOne.id, authorId: michael.id, content: "Checked battery health report — likely needs hardware replacement, ordering a part." },
    });
  }
  console.log("✔  Seeded example Public Comment and Internal Note");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });