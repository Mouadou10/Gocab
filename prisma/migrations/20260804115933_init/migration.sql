-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raw_name" TEXT NOT NULL,
    "sanitized_phone" TEXT NOT NULL,
    "campaign_source" TEXT NOT NULL,
    "board_column" TEXT NOT NULL DEFAULT 'NEW_LEADS',
    "brand_status" TEXT,
    "training_status" TEXT,
    "reminder_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Blacklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sanitized_phone" TEXT NOT NULL,
    "reason" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_sanitized_phone_key" ON "Lead"("sanitized_phone");

-- CreateIndex
CREATE UNIQUE INDEX "Blacklist_sanitized_phone_key" ON "Blacklist"("sanitized_phone");
