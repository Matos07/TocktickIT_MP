-- Rename the table in place (preserves data, ids, and FK integrity)
ALTER TABLE "DevelopmentRequester" RENAME TO "User";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- Add new User columns.
-- passwordHash gets a temporary placeholder; prisma:seed will overwrite it
-- with a real bcrypt hash for every migrated Requester on next seed run.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER';
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- CreateTable: Session
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extend TicketStatus enum
ALTER TYPE "TicketStatus" ADD VALUE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- Extend Ticket (ticketOwnerId already exists as a plain Int column from
-- Lab 2 — only add the new column here, plus the FK constraint and index
-- that formalize the existing column into a real relation)
ALTER TABLE "Ticket" ADD COLUMN "requesterConfirmedResolved" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Ticket_ticketOwnerId_idx" ON "Ticket"("ticketOwnerId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketOwnerId_fkey" FOREIGN KEY ("ticketOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- CreateTable: PublicComment
CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PublicComment_ticketId_idx" ON "PublicComment"("ticketId");
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: InternalNote
CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InternalNote_ticketId_idx" ON "InternalNote"("ticketId");
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;