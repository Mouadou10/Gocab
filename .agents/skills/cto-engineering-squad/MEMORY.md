# CTO & Senior Engineering Squad — Persistent Architecture Memory

> **PURPOSE**: This file is the permanent memory of the GoCab CTO & Senior Engineering Squad. Every engineer (Frontend, Backend, QA/Test, DevOps, Docker, K8s) MUST read this file in Phase 0 before diagnosing or touching code, and MUST record any resolved problem in Phase 5 so that future squad members never regress or repeat past failures.

---

## Index of Squad Memory Records

- [`MEM-2026-11-02-001`](#mem-2026-11-02-001-serverless-execution-freeze--sqlite-wal-cloud-sync): Serverless Execution Freeze & SQLite WAL Cloud Sync
- [`MEM-2026-11-02-002`](#mem-2026-11-02-002-acquisition-scorecard--kanban-board-historical-date-disconnect): Acquisition Scorecard & Kanban Board Historical Date Disconnect
- [`MEM-2026-11-02-003`](#mem-2026-11-02-003-destructive-mutations-inside-get-routes-disappearing-accidents): Destructive Mutations Inside GET Routes (Disappearing Accidents)
- [`MEM-2026-11-02-004`](#mem-2026-11-02-004-fleet-maintenance-parity-9-vs-12-vehicles): Fleet Maintenance Parity (9 vs. 12 Vehicles in Insurance & Maintenance)

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
