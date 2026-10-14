import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const PRODUCTION_TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io";
const PRODUCTION_TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";

async function run() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || PRODUCTION_TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || (url === PRODUCTION_TURSO_URL ? PRODUCTION_TURSO_TOKEN : undefined);

  console.log("Connecting to:", url);
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });

  const statements = [
    "ALTER TABLE DriverProfile ADD COLUMN isRedFlagged BOOLEAN NOT NULL DEFAULT 0",
    "ALTER TABLE DriverProfile ADD COLUMN redFlagReason TEXT",
    "ALTER TABLE DriverProfile ADD COLUMN redFlaggedAt DATETIME",
    "ALTER TABLE DriverProfile ADD COLUMN redFlaggedBy TEXT",
    `CREATE TABLE IF NOT EXISTS "DriverComment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "driverId" TEXT NOT NULL,
      "authorName" TEXT NOT NULL,
      "authorRole" TEXT,
      "content" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DriverComment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "DriverComment_driverId_idx" ON "DriverComment"("driverId")`
  ];

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
      console.log("Executed:", stmt.slice(0, 50));
    } catch (e: any) {
      console.log("Note / Already applied:", e.message);
    }
  }

  const res = await client.execute("SELECT id, fullName, isRedFlagged, redFlagReason FROM DriverProfile LIMIT 3");
  console.log("Sample drivers from Turso DB:", res.rows);
  process.exit(0);
}

run().catch(console.error);
