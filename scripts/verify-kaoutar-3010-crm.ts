import Database from "better-sqlite3";
import path from "node:path";

const db = new Database(path.join(process.cwd(), "dev.db"), { readonly: true });

console.log("==================================================================");
console.log(" 🔍 VERIFYING KAOUTAR 30/10 LEADS & CALLS IN CRM");
console.log("==================================================================\n");

// 1. Check Leads for Kaoutar on 30/10
const leads3010 = db
  .prepare(
    `SELECT count(*) as cnt FROM Lead
     WHERE handled_by = 'Kaoutar Ouardi' AND status_changed_at LIKE '2026-10-30%'`
  )
  .get() as { cnt: number };

console.log(`1. Leads treated by Kaoutar on 2026-10-30: ${leads3010.cnt} leads`);

// 2. Status breakdown for Kaoutar on 30/10
const statusBreakdown = db
  .prepare(
    `SELECT board_column, brand_status, count(*) as count
     FROM Lead
     WHERE handled_by = 'Kaoutar Ouardi' AND status_changed_at LIKE '2026-10-30%'
     GROUP BY board_column, brand_status`
  )
  .all();
console.table(statusBreakdown);

// 3. Training Fixed leads on 30/10 with scheduled dates
const trainingFixedLeads = db
  .prepare(
    `SELECT raw_name, sanitized_phone, city, training_status, reminder_date
     FROM Lead
     WHERE handled_by = 'Kaoutar Ouardi'
       AND status_changed_at LIKE '2026-10-30%'
       AND brand_status = 'Training fixed'
     ORDER BY reminder_date ASC`
  )
  .all();

console.log(`\n2. Training Fixed Candidates (${trainingFixedLeads.length} total):`);
console.table(trainingFixedLeads);

// 4. City distribution
const cityDist = db
  .prepare(
    `SELECT city, count(*) as count
     FROM Lead
     WHERE handled_by = 'Kaoutar Ouardi' AND status_changed_at LIKE '2026-10-30%'
     GROUP BY city`
  )
  .all();
console.log("\n3. City Distribution:");
console.table(cityDist);

// 5. Activity logs for Kaoutar on 30/10
const logs3010 = db
  .prepare(
    `SELECT action, count(*) as count
     FROM LeadActivityLog
     WHERE agent = 'Kaoutar Ouardi' AND created_at LIKE '2026-10-30%'
     GROUP BY action`
  )
  .all();
console.log("\n4. LeadActivityLog breakdown for Kaoutar on 2026-10-30:");
console.table(logs3010);

// 6. Check for duplicate phone numbers
const dups = db
  .prepare(
    `SELECT sanitized_phone, count(*) as count
     FROM Lead
     GROUP BY sanitized_phone
     HAVING count > 1`
  )
  .all();
console.log(`\n5. Duplicate phones in Lead table: ${dups.length} duplicates found.`);

db.close();
