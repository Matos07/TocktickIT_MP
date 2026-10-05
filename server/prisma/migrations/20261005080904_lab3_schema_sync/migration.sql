-- AlterTable
ALTER TABLE "User" RENAME CONSTRAINT "DevelopmentRequester_pkey" TO "User_pkey";

-- RenameIndex
ALTER INDEX "DevelopmentRequester_email_key" RENAME TO "User_email_key";
