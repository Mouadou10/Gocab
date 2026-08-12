-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raw_name" TEXT NOT NULL,
    "sanitized_phone" TEXT NOT NULL,
    "campaign_source" TEXT NOT NULL,
    "board_column" TEXT NOT NULL DEFAULT 'NEW_LEADS',
    "brand_status" TEXT,
    "training_status" TEXT,
    "reminder_date" DATETIME,
    "preorder_amount" REAL,
    "city" TEXT,
    "has_cin" BOOLEAN NOT NULL DEFAULT false,
    "has_fiche_anthropometrique" BOOLEAN NOT NULL DEFAULT false,
    "has_confirmation_adresse" BOOLEAN NOT NULL DEFAULT false,
    "has_permis" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Lead" ("board_column", "brand_status", "campaign_source", "created_at", "id", "preorder_amount", "raw_name", "reminder_date", "sanitized_phone", "training_status") SELECT "board_column", "brand_status", "campaign_source", "created_at", "id", "preorder_amount", "raw_name", "reminder_date", "sanitized_phone", "training_status" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE UNIQUE INDEX "Lead_sanitized_phone_key" ON "Lead"("sanitized_phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
