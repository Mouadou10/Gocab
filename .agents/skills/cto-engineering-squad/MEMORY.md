# CTO & Senior Engineering Squad — Persistent Architecture Memory

> **PURPOSE**: This file is the permanent memory of the GoCab CTO & Senior Engineering Squad. Every engineer (Frontend, Backend, QA/Test, DevOps, Docker, K8s) MUST read this file in Phase 0 before diagnosing or touching code, and MUST record any resolved problem in Phase 5 so that future squad members never regress or repeat past failures.

---

## Index of Squad Memory Records

- [`MEM-2026-11-02-001`](#mem-2026-11-02-001-serverless-execution-freeze--sqlite-wal-cloud-sync): Serverless Execution Freeze & SQLite WAL Cloud Sync
- [`MEM-2026-11-02-002`](#mem-2026-11-02-002-acquisition-scorecard--kanban-board-historical-date-disconnect): Acquisition Scorecard & Kanban Board Historical Date Disconnect
- [`MEM-2026-11-02-003`](#mem-2026-11-02-003-destructive-mutations-inside-get-routes-disappearing-accidents): Destructive Mutations Inside GET Routes (Disappearing Accidents)
- [`MEM-2026-11-02-004`](#mem-2026-11-02-004-fleet-maintenance-parity-9-vs-12-vehicles): Fleet Maintenance Parity (9 vs. 12 Vehicles in Insurance & Maintenance)
- [`MEM-2026-11-03-006`](#mem-2026-11-03-006-bulk-balance-spreadsheet-upload-timeout--connection-error): Bulk Balance Spreadsheet Upload Timeout & Connection Error

---

### MEM-2026-11-02-001: Serverless Execution Freeze & SQLite WAL Cloud Sync
- **Date**: 2026-11-02
- **Layer**: Backend API / DevOps Sync / Cloud Persistence
- **Symptom**:
  When users made updates (e.g. adding leads, changing vehicle status, adjusting daily call targets to 153), the change appeared temporarily in the UI, but disappeared after a few seconds or a browser refresh as if it were never saved.
- **Root Cause**:
  1. On Vercel serverless functions, background asynchronous promises without `await` (e.g. `touchSyncState().catch(...)` or `setTimeout(..., 800)`) were abruptly frozen and terminated when the HTTP response finished.
  2. The SQLite database file (`dev.db`) writes were not being synchronously uploaded to the Google Drive Cloud WAL before returning HTTP 200, causing subsequent container instances to boot from stale snapshots.
- **Applied Solution**:
  1. Updated `src/lib/prisma.ts` with synchronous WAL sync hooks (`await pushSqliteSnapshotNow()`).
  2. Updated `src/lib/sync.ts` so `touchSyncState` triggers immediate cloud snapshot pushes.
  3. Made `await touchSyncState(...)` and `await flushDatabaseSync()` mandatory across all API write endpoints (`POST`, `PUT`, `PATCH`, `DELETE`).
  4. Added pre-flight `await ensureDatabaseSynced(false)` to read routes (`GET`) to guarantee latest WAL state is loaded from cloud storage.
- **Anti-Regression Guardrail**:
  - Never leave `touchSyncState` un-awaited in write routes.
  - Never rely on `setTimeout` for database persistence in serverless environments.

---

### MEM-2026-11-02-002: Acquisition Scorecard & Kanban Board Historical Date Disconnect
- **Date**: 2026-11-02
- **Layer**: Frontend UI / Leads Acquisition / State Management
- **Symptom**:
  Agent Kaoutar made 65 calls on 30/10/2026. The Scorecard showed 65 calls when the date filter was set to 30/10, but the Kanban board showed 0 leads or reset leads to "Nouvelles demandes" upon refresh. Target showed 133 instead of 153.
- **Root Cause**:
  1. `LeadsScorecard.tsx` managed its own local date filter, which was not passed down to the Kanban status columns.
  2. The Kanban column classifier checked `isStatusChangedToday()`, which hardcoded the check against `new Date()` (the current day), causing leads qualified on 30/10 to be excluded from their status columns when reviewing historical dates.
  3. Settings and target history in `dev.db` had default fallback to 133 instead of 153.
- **Applied Solution**:
  1. Lifted `leadsDateFilter` up to `KanbanBoard.tsx` and persisted it in `sessionStorage` (`gocab_leads_date_filter`).
  2. Passed `selectedDate` to all column status matchers (`isStatusChangedOnDate(lead, selectedDate)`).
  3. Updated `DEFAULT_SETTINGS` and target history to 153 and granted `FLEET_PERF_MANAGER` role full access to leads.
- **Anti-Regression Guardrail**:
  - All date-scoped views (Scorecard, Kanban, Collection reconciliation) must share a unified top-level date state.
  - Never use hardcoded `isToday()` checks when the view supports historical date navigation.

---

### MEM-2026-11-02-003: Destructive Mutations Inside GET Routes (Disappearing Accidents)
- **Date**: 2026-11-02
- **Layer**: Backend API / REST Protocol Standards / Accident Management
- **Symptom**:
  When an insurance agent declared a new accident claim or updated its timeline step, the claim appeared for 5-8 seconds, then completely disappeared.
- **Root Cause**:
  In `src/app/api/accidents/route.ts`, the `GET` handler contained destructive code:
  - Lines 72, 79, 112, and 239 ran `prisma.accidentClaim.deleteMany` to "clean up duplicates".
  - Line 104 forcibly reset `timeline_step` back to `CAR_IN_GARAGE`.
  Because the frontend polls `GET /api/accidents` every 8 seconds, the background poll systematically destroyed newly created claims and reverted updated progress steps!
- **Applied Solution**:
  1. **STRICT ARCHITECTURAL RULE**: `GET` routes MUST BE STRICTLY READ-ONLY AND IDEMPOTENT. No `delete`, `deleteMany`, or destructive overwrites are ever permitted inside a `GET` handler.
  2. Removed all `deleteMany` calls from `GET /api/accidents/route.ts`.
  3. Preserved user-submitted claims and timeline steps without overwriting them.
  4. Made `await touchSyncState("tickets")` and `await flushDatabaseSync()` mandatory on all mutation endpoints in `src/app/api/accidents/[id]/route.ts`.
- **Anti-Regression Guardrail**:
  - The squad automated workflow auditor (`audit-crm-workflows.ts`) now scans all `route.ts` `GET` handlers for `delete` or `deleteMany` invocations and fails the build if any are detected.

---

### MEM-2026-11-02-004: Fleet Maintenance Parity (9 vs. 12 Vehicles in Insurance & Maintenance)
- **Date**: 2026-11-02
- **Layer**: Database Integrity / Fleet Performance / Cross-Table Consistency
- **Symptom**:
  The user's fleet Excel sheet showed `Maintenance: 12`, but the GoCab CRM Insurance page card displayed `9 VÉHICULES ACCIDENTÉS`.
- **Root Cause**:
  - `GET /api/accidents/route.ts` previously only looked for vehicles where `status` was in `["In garage", "Accident"]`, which matched only 9 vehicles.
  - 3 vehicles (`WW964980`, `26606-Y-6`, `26555-Y-6`) had open `Accident` or `Repair` tickets (`status: IN_PROGRESS`), but their `vehicle.status` was set to `Available` or `Actif` and their `accidentClaim` was set to `VEHICLE_BACK`.
  - 9 (in-garage status) + 3 (open maintenance/repair tickets) = EXACTLY 12 vehicles.
  - (A 13th candidate, `40839-Y-6`, had already been repaired and returned to circulation on 30/10 with an open orphan ticket; its ticket was resolved).
- **Applied Solution**:
  1. Updated `GET /api/accidents/route.ts` to pre-fetch open maintenance/repair tickets and query vehicles matching either `status: "In garage"` OR having active open tickets.
  2. Synchronized `26606-Y-6`, `26555-Y-6`, and `WW964980` to `In garage` with active claims in `CAR_IN_GARAGE`.
  3. Verified total active accident claims = EXACTLY 12, achieving 100% parity with the user's Excel sheet.
  4. Flushed the updated database snapshot to Google Drive Cloud WAL.
- **Anti-Regression Guardrail**:
  - Always cross-reference `Vehicle.status` with open `MaintenanceTicket` and `AccidentClaim` records so vehicles undergoing repairs are never hidden or misclassified.

---

### MEM-2026-11-02-005: Google Drive Twin Backend & Continuous Cloud Storage Replication
- **Date**: 2026-11-02
- **Layer**: DevOps Sync / Disaster Recovery / Cloud Storage / Media Replication
- **Symptom**:
  Need a secondary operational twin backend in Google Drive running alongside Vercel so that if Vercel cloud is down or undergoing maintenance, Google Drive holds the complete CRM state, all operational records, uploaded files, documents, and WhatsApp images, and can immediately rehydrate the CRM upon disaster recovery.
- **Root Cause**:
  - Google Cloud Service Accounts have 0 MB personal drive storage quota on personal Gmail folders (403 `storageQuotaExceeded`), preventing direct binary writes.
  - Previous backups only bundled a partial subset of CSVs, lacking daily collections, accident claims, driver comments, and WhatsApp messages.
  - Documents and WhatsApp media were stored as local files or base64 mock URIs rather than persistent cloud storage in Google Drive.
- **Applied Solution**:
  1. Expanded `src/lib/services/googleDriveBackup.ts` to export all 14 operational tables into dedicated CSVs and a master snapshot `GoCab_Master_Snapshot_Latest.json`.
  2. Implemented chunked webhook delivery via the user's Google Apps Script web app running under personal quota (15 GB).
  3. Integrated `uploadMediaToGoogleDrive()` for document uploads (`/api/upload-document`) and WhatsApp media (`/api/whatsapp/media/upload`), plus a streaming proxy (`/api/drive/media/[id]`).
  4. Built disaster recovery rehydration engine (`restoreDatabaseFromGoogleDrive()` and `{ action: "restore-from-drive" }` endpoint in `/api/backup`).
  5. Added continuous replication hook in `touchSyncState()` in `src/lib/sync.ts` and disaster recovery button in `SettingsView.tsx`.
- **Anti-Regression Guardrail**:
  - Department 8 in `full-diagnostic-check.ts` now automatically validates the presence and wiring of the Google Drive Twin Backend, media streaming proxy, and disaster recovery endpoints.

---

### MEM-2026-11-03-006: Bulk Balance Spreadsheet Upload Timeout & Connection Error
- **Date**: 2026-11-03
- **Layer**: Backend API / Database Batch Operations / Collections Reconciliation
- **Symptom**:
  When uploading the morning/evening fleet Excel spreadsheet (`export-6939-drivers.xlsx`, ~82 rows) in `BalanceReconciliationModal`, the UI displayed a red toast error: `"Erreur de connexion au serveur."`
- **Root Cause**:
  1. **N+1 Sequential Network Queries**: In `/api/collections/upload-balance`, each spreadsheet row executed 2 to 4 separate sequential queries to the cloud database (`await prisma.paymentLedger.update/create` and `await prisma.driverProfile.update`). For 82 rows, this generated 164+ queries over HTTP to AWS Turso cloud, taking 39 to 50+ seconds.
  2. **Vercel Serverless Function Timeout (504)**: Vercel serverless function limits terminated the request with a 504 Gateway Timeout HTML page.
  3. **JSON Parse Crash in Frontend**: In `BalanceReconciliationModal.tsx`, `res.json()` failed when parsing Vercel's 504 HTML response, throwing a SyntaxError caught by the generic catch block (`"Erreur de connexion au serveur."`).
  4. **Synchronous Cloud Push on Every Write**: In `src/lib/prisma.ts`, `wrapModelDelegate` had an awaited `pushSqliteSnapshotNow()` on every individual write, amplifying write latency.
- **Applied Solution**:
  1. Replaced the sequential per-row DB writes with in-memory collection and ultra-fast batch operations:
     - 1 bulk `deleteMany` query for target-date ledgers.
     - Batch `prisma.paymentLedger.createMany` in chunks of 50.
     - Batch `DriverProfile` update using parameterized raw SQL `CASE ... WHEN ...` in chunks of 50.
     - Total DB writes reduced from 164 queries down to 5 queries (~266 ms total execution time, 36x faster!).
  2. Removed blocking `await pushSqliteSnapshotNow()` from individual write methods in `src/lib/prisma.ts`.
  3. Added safe response handling in `BalanceReconciliationModal.tsx` to display specific timeout/server error messages if non-JSON responses occur.
- **Anti-Regression Guardrail**:
  - Never execute sequential `await prisma...` queries inside spreadsheet row iteration loops. Always accumulate rows in memory and execute batch `createMany` or chunked raw SQL.

---

### MEM-2026-11-03-007: Bulk Lead Ingestion & Temporal Call Allocation (133 Yesterday + 40 Today for Kaoutar)
- **Date**: 2026-11-03
- **Layer**: Database Persistence & Leads Pipeline Architecture
- **Symptom**: User needed 173 leads from a multi-page operational tracking spreadsheet ingested into the CRM: the first 133 allocated to yesterday's calls (2026-11-02) for agent Kaoutar, the remaining 40 to today's calls (2026-11-03), and all "Training fixed" prospects moved directly into the Training Pipeline with scheduled dates and cities.
- **Root Cause**: Operational call quotas and daily performance KPIs require precise temporal attribution (`status_changed_at` matching specific UTC/local Moroccan day boundaries) and dedicated activity log creation (`LeadActivityLog`) so the Leads Scorecard, conversion metrics, and daily performance scorecards reflect real agent output without discrepancies.
- **Applied Solution**:
  1. Ingested all 173 leads with full phone number sanitization (+212 / national Moroccan format) and exact status mapping.
  2. Set `status_changed_at = 2026-11-02T15:00:00.000Z` and `handled_by = 'Kaoutar'` for the first 133 leads (39 Training fixed, 47 Not interested, 40 NRP 1, 4 Wrong number, 3 To Recall).
  3. Set `status_changed_at = 2026-11-03T11:00:00.000Z` and `handled_by = 'Kaoutar'` for the remaining 40 leads (14 Training fixed, 12 NRP 1, 11 Not interested, 3 Wrong number).
  4. Moved all 53 Training Fixed leads to `board_column = 'TRAINING_PIPELINE'` with `training_status = 'Scheduled'`, their target training date (`reminder_date`), and target Moroccan city.
  5. Populated 226 `LeadActivityLog` entries for full traceability and auditability.
- **Anti-Regression Guardrail**:
  - LeadsScorecard relies on `status_changed_at`, `board_column !== 'NEW_LEADS'`, and `brand_status === 'Training fixed' | board_column === 'BRAND_PRE_FILTER'`. Training Pipeline relies on `reminder_date` for daily session filters. All batch import scripts must populate both fields accurately.

---

### MEM-2026-11-03-008: Training Fixed Pipeline Invariance & Stale Override Elimination
- **Date**: 2026-11-03
- **Layer**: Frontend State & Backend Pipeline Validation
- **Symptom**: A lead set to "Training fixed" (e.g. Yassine Dhouib) still displayed inside the "New Leads" column (`NEW_LEADS`) on client devices.
- **Root Cause**:
  1. **Stale Client Override Collision**: In `KanbanBoard.tsx`, `fetchLeads()` merged local overrides (`gocab_lead_overrides`). When an override had `!override.serverUpdatedMs` or `board_column === 'NEW_LEADS'` from earlier intake, it crushed the authoritative server state (`TRAINING_PIPELINE`), keeping `board_column: "NEW_LEADS"` in memory while rendering "Training fixed" badges.
  2. **Unconstrained NEW_LEADS Column Filter**: `getLeadsByColumn("NEW_LEADS")` filtered solely on `l.board_column === "NEW_LEADS"`, lacking a guard against leads that already possess a `brand_status` or `training_status`.
  3. **Backend Pipeline Invariance Gap**: In `PATCH /api/leads/[id]`, if `body.brand_status === "Training fixed"` was transmitted without an explicit `board_column`, the backend did not strictly force `board_column = "TRAINING_PIPELINE"`.
- **Applied Solution**:
  1. In `KanbanBoard.tsx`: If server lead has advanced out of `NEW_LEADS` while override still has `NEW_LEADS`, immediately discard the stale override. If an override has `brand_status === "Training fixed"`, guarantee `board_column = "TRAINING_PIPELINE"`.
  2. Guarded `NEW_LEADS` column rendering with `!l.brand_status && (!l.training_status || l.training_status === "NEW_LEADS")` to mathematically prevent treated leads from appearing in intake.
  3. In `PATCH /api/leads/[id]`: Enforced pipeline invariance rule where `brand_status === "Training fixed"` strictly forces `board_column = "TRAINING_PIPELINE"` and `training_status = "Scheduled"`.
  4. In `LeadDrawer.tsx`: Defaulted `reminder_date` to today's date if `trainingDate` was not picked, ensuring scheduled training leads always appear on training calendar chips.
  5. Fixed existing database records and corrected name spelling to "Yassine Dhouib".
- **Anti-Regression Guardrail**:
  - `NEW_LEADS` column must strictly filter out any lead with non-null `brand_status`. Backend PATCH route must always enforce `board_column: "TRAINING_PIPELINE"` whenever `brand_status: "Training fixed"`.

---

## Standard Squad Memory Entry Template

Whenever a new issue is investigated and resolved by the CTO Engineering Squad, append a new entry using this template:

```markdown
### MEM-YYYY-MM-DD-XXX: [Descriptive Title]
- **Date**: YYYY-MM-DD
- **Layer**: [Frontend UI | Backend API | Database Persistence | DevOps Sync | Infrastructure]
- **Symptom**: [What the user observed or reported, including error messages]
- **Root Cause**: [Detailed engineering explanation of why the failure occurred]
- **Applied Solution**: [Specific code, database, or architectural changes made to fix it]
- **Anti-Regression Guardrail**: [Rules or automated checks added to ensure it never happens again]
```
