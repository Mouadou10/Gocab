-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "preorder_amount" REAL;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);
