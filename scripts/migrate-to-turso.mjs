import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB = path.join(__dirname, '..', 'dev.db');
const TURSO_URL = 'https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc3NDc4OTIsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.0g0YpznYxzbl2ZPeJh9doMk-GXrzL5GXlo9eUTTB_GkX6JmuYX0yXHPWL6NeWxL_7weQbi4WEY1zAMO7dk_gDQ';
const BATCH_SIZE = 50;

async function main() {
  console.log('Opening local SQLite...');
  const localDb = new Database(LOCAL_DB, { readonly: true });
  const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  
  try {
    const tursoCount = await turso.execute('SELECT COUNT(*) as cnt FROM Lead');
    console.log('Turso currently has:', tursoCount.rows[0][0], 'leads');
  } catch(e) { console.log('Could not count turso leads:', e.message); }
  
  const leads = localDb.prepare('SELECT * FROM Lead').all();
  console.log('Local SQLite has', leads.length, 'leads');
  
  let inserted = 0;
  let failed = 0;
  
  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    try {
      const statements = batch.map(lead => ({
        sql: 'INSERT OR REPLACE INTO Lead (id, raw_name, sanitized_phone, campaign_source, board_column, brand_status, training_status, reminder_date, preorder_amount, city, has_cin, has_fiche_anthropometrique, has_confirmation_adresse, has_permis, presence_confirmed, presence_confirmed_at, status_changed_at, handled_by, is_archived, notes, age, permis_seniority_years, is_resident, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [lead.id, lead.raw_name, lead.sanitized_phone, lead.campaign_source, lead.board_column || 'NEW_LEADS', lead.brand_status ?? null, lead.training_status ?? null, lead.reminder_date ?? null, lead.preorder_amount ?? null, lead.city ?? null, lead.has_cin ? 1 : 0, lead.has_fiche_anthropometrique ? 1 : 0, lead.has_confirmation_adresse ? 1 : 0, lead.has_permis ? 1 : 0, lead.presence_confirmed ? 1 : 0, lead.presence_confirmed_at ?? null, lead.status_changed_at ?? null, lead.handled_by ?? null, lead.is_archived ? 1 : 0, lead.notes ?? null, lead.age ?? null, lead.permis_seniority_years ?? null, lead.is_resident ?? null, lead.created_at, lead.updated_at]
      }));
      await turso.batch(statements, 'write');
      inserted += batch.length;
      process.stdout.write('\rProgress: ' + inserted + '/' + leads.length + ' (' + Math.round(inserted/leads.length*100) + '%)   ');
    } catch(err) {
      console.error('\nBatch failed:', err.message);
      failed += batch.length;
    }
  }
  
  console.log('\nDone! Inserted:', inserted, 'Failed:', failed);
  try {
    const finalCount = await turso.execute('SELECT COUNT(*) as cnt FROM Lead');
    console.log('Turso now has:', finalCount.rows[0][0], 'leads');
  } catch(e) {}
  localDb.close();
}
main().catch(e => { console.error(e); process.exit(1); });
