import Database from "better-sqlite3";
import path from "path";

const localDb = new Database(path.join(process.cwd(), "dev.db"));

const TURSO_URL = "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io/v2/pipeline";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ";

async function run() {
  console.log("=== Checking Local dev.db ===");
  const localRows = localDb.prepare(`
    SELECT brand_status, count(*) as count 
    FROM Lead 
    WHERE LOWER(brand_status) LIKE '%no response%' OR LOWER(brand_status) LIKE '%sans rep%' OR LOWER(brand_status) LIKE '%nrp%'
    GROUP BY brand_status
  `).all();
  console.log("Local dev.db No Response rows:", localRows);

  console.log("\n=== Checking Turso Production ===");
  const res = await fetch(TURSO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: "SELECT brand_status, count(*) as count FROM Lead WHERE LOWER(brand_status) LIKE '%no response%' OR LOWER(brand_status) LIKE '%sans rep%' OR LOWER(brand_status) LIKE '%nrp%' GROUP BY brand_status"
          }
        }
      ]
    })
  });
  const body = await res.json();
  const rows = body.results?.[0]?.response?.result?.rows || [];
  console.log("Turso No Response rows:", rows.map((r: any) => ({
    brand_status: r[0]?.value,
    count: r[1]?.value
  })));
}

run().catch(console.error);
