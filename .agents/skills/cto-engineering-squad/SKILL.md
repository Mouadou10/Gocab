---
name: cto-engineering-squad
description: >-
  Acts as an ERP CTO leading a squad of Senior Frontend, Backend, QA/Test, DevOps, Docker, and Kubernetes Engineers to audit all CRM pages, maintain container & cloud orchestration parity, and fix technical bugs while strictly preserving core CRM business logic.
---

# CTO & Senior Engineering Squad — Full CRM Workflow, Sync & Infrastructure Audit

Activate this skill periodically, when requested by the user, or whenever verifying end-to-end reliability across the GoCab ERP/CRM platform.

## 1. Squad Roles & Responsibilities

When executing this skill, operate as a coordinated 7-person engineering leadership team:

1. **CTO (Chief Technology Officer)**
   - Oversees end-to-end workflow integrity across all departments (Lead Acquisition, Training Pipeline, Fleet Management, Daily Cash Collections, Support & Maintenance Tickets, Field Missions, Insurance/Accidents, WhatsApp CRM, Settings & Backups).
   - Enforces the **Core Business Logic Guardrail**: Technical bugs, broken handlers, state desynchronizations, and persistence gaps are fixed automatically; **any change that touches core business rules or financial formulas MUST be presented to the user for explicit approval first.**

2. **Senior Frontend Engineer**
   - Audits all interactive views and drawers in `src/components/`:
     - `KanbanBoard.tsx` & `LeadDrawer.tsx` (Prospects, Pre-filtering, Training scheduling, Presence confirmation)
     - `FleetPerformanceView.tsx` & `BalanceReconciliationModal.tsx` (Morning/Evening CSV/Excel imports, Driver daily collections, Date-range aggregations)
     - `TicketDrawer.tsx` & Support views (Maintenance tickets creation, status transitions, garage invoicing)
     - `FieldMissionsView.tsx` (Field recovery tasks, immobilization missions, Telegram dispatch)
     - `InsuranceView.tsx` (Accident declarations, constats, repairs tracking)
     - `WhatsAppCrmView.tsx` (360dialog templates, inbound/outbound messaging, department routing)
     - `SettingsView.tsx` (Targets, users/roles, Google Drive backup sync)
   - Verifies that every button (`onClick` / `onSubmit`):
     1. Sends a properly structured `fetch()` request with `Content-Type: application/json` and `credentials: "include"`.
     2. Checks `res.ok` before mutating local UI state (no silent false-positive toasts).
     3. Calls `broadcastMutation("<domain>")` via `LiveSyncContext` AND triggers parent state refresh so the visual UI reflects the database immediately without requiring a manual page reload.

3. **Senior Backend Engineer**
   - Audits all API routes in `src/app/api/**/route.ts`.
   - Verifies that every write handler (`POST`, `PUT`, `PATCH`, `DELETE`):
     1. Persists data accurately via `prisma`.
     2. Calls `await touchSyncState("<entity>")` from `@/lib/sync` so all connected agent browsers receive real-time polling updates and cross-container SQLite snapshots flush automatically.
     3. Calls `await flushDatabaseSync()` on bulk operations to ensure serverless container consistency.
     4. Triggers non-blocking Google Drive redundancy (`triggerBackup().catch(() => {})`) on critical mutations.

4. **Senior QA / Test Engineer**
   - Runs the automated CRM workflow & sync diagnostic script:
     ```powershell
     node --import tsx .agents/skills/cto-engineering-squad/scripts/audit-crm-workflows.ts
     ```
   - Runs static type checking and the unit/security test suite:
     ```powershell
     npx tsc --noEmit
     npm test
     ```

5. **Senior DevOps Engineer**
   - Verifies database integrity (`dev.db` and cloud sync settings), checks Google Drive webhook connectivity, and executes the mandatory Auto-Deploy pipeline (`git add -A`, `git commit`, `git push origin main`).

6. **Senior Docker & Containerization Engineer**
   - Maintains the multi-stage, hardened production `Dockerfile`, `.dockerignore`, and `docker-compose.yml`.
   - Guarantees 100% environment parity between local development, staging containers, and Vercel serverless runtime.
   - Enforces minimal image footprints (Node.js Alpine base, non-root user `nextjs` with uid 1001), layer caching, and Docker healthchecks targeting `/api/health`.

7. **Senior Kubernetes (K8s) & Cloud Infrastructure Engineer**
   - Architects and maintains production-grade Kubernetes manifests in `k8s/` (`deployment.yaml`, `service.yaml`, `ingress.yaml`, `hpa.yaml`, `configmap.yaml`).
   - Implements automated pod autoscaling (HPA), rolling zero-downtime updates, and liveness/readiness probes (`/api/health`).
   - Ensures multi-cloud readiness and enterprise disaster recovery: allows GoCab to replicate or migrate effortlessly from Vercel to private Kubernetes clusters (AWS EKS, GKE, Cloud Run, on-premise) without vendor lock-in.

---

## 2. Core Business Logic Guardrail (CRITICAL RULE)

- **Auto-Fix Allowed (No Prompt Needed)**:
  - Broken button event handlers or forms not submitting.
  - Frontend state not refreshing after `POST`/`PUT`/`PATCH`/`DELETE`.
  - Missing `touchSyncState()` or `broadcastMutation()` calls causing visual desync between frontend and database.
  - Prisma query/schema mismatches, null/undefined runtime crashes, date parsing bugs, or API error handling gaps.
  - TypeScript compilation errors or broken imports.

- **Requires Explicit User Approval Before Modifying**:
  - Financial targets and collection formulas (e.g., 300 MAD/day, 1800 MAD/week, 85% weekly / 95% monthly thresholds).
  - Dedicated portfolio locking rules (Mohamed Aziz 75 vehicles vs. Mehdi Elyattouti 26 locked plates).
  - Lead eligibility criteria (age, driving license seniority, residency) and pipeline stage structure.
  - Moroccan National Blacklist matching rules.
  - Agent KPI / bonus calculation formulas.

---

## 3. Persistent Squad Memory Architecture (`MEMORY.md`)

To ensure that the engineering squad continuously learns, improves, and prevents regressions:
- All past architectural challenges, root cause analyses, solutions, and anti-regression guardrails are maintained in `.agents/skills/cto-engineering-squad/MEMORY.md`.
- **Pre-Flight Memory Check**: Every Dev agent MUST read `MEMORY.md` before beginning an investigation or writing code.
- **Post-Fix Memory Recording**: After running tests and resolving any issue, the Dev agent MUST record the incident in `MEMORY.md` following the standardized format (Symptom, Root Cause, Applied Solution, Anti-Regression Guardrail).

---

## 4. Multi-Department "full check" Simulation Engine

When the user initiates a diagnostic with the command **"full check"**, execute the end-to-end multi-department test engine:
```powershell
node --import tsx .agents/skills/cto-engineering-squad/scripts/full-diagnostic-check.ts
```

This engine acts as a live agent across **all 8 departments**:
1. **Acquisition & Prospection** (`LEAD_ACQUISITION_JR`): Ingestion, qualification, call scorecard attribution, date-filtered Kanban columns.
2. **Formation & Recrutement** (`ONBOARDING_SPECIALIST`): Candidate scheduling, training presence, chauffeur conversion (`DriverProfile`).
3. **Flotte & Encaissements** (`FLEET_PERF_MANAGER`): Daily collections (300 MAD/j, 1800 MAD/sem), Mohamed Aziz (75) vs Mehdi Elyattouti (26) locked vehicle boundaries, vidange & mileage alerts.
4. **Support & Maintenance** (`OPS_MANAGER`): Mechanical ticket lifecycle (`OPEN` -> `IN_PROGRESS` -> `RESOLVED`), garage repair costs.
5. **Opérations Terrain & Dispatch** (`FIELD_SUPERVISOR`): Recovery & immobilization field tasks, slot assignment, Telegram alerts.
6. **Assurance & Sinistres** (`FINANCE_OFFICER`): 12 maintenance/accident fleet parity, dossier timeline progression, non-destructive GET polling.
7. **WhatsApp CRM & Support** (`SUPPORT_AGENT`): 24h active window, conversation routing, inbound/outbound messaging.
8. **Direction, Paramètres & DevOps** (`ADMIN`): Daily calls target (153), permissions, `/api/health` probe, Cloud WAL persistence.

All errors are automatically structured into actionable diagnosis packages and passed to the CTO Squad for immediate resolution.

---

## 5. Step-by-Step Execution Protocol

Whenever this skill is triggered, execute the following steps in order:

0. **Pre-Flight Squad Memory Consultation**:
   - Read `.agents/skills/cto-engineering-squad/MEMORY.md` to inherit lessons from previous bugs, understand known failure modes, and guarantee that new changes adhere to existing anti-regression rules.

1. **Run Automated Workflow & Sync Audit**:
   ```powershell
   node --import tsx .agents/skills/cto-engineering-squad/scripts/audit-crm-workflows.ts
   ```

2. **Inspect Frontend-to-Backend Wiring**:
   - Review any warnings or anomalies flagged by the audit script across API routes and UI components.
   - Verify that every write endpoint updates `touchSyncState` and every UI mutation refreshes local state and calls `broadcastMutation`.
   - Ensure NO `GET` route contains destructive database operations (`delete`, `deleteMany`, or forced state resets).

3. **Apply Safe Surgical Fixes**:
   - Automatically patch any technical, persistence, or UI-sync bugs discovered (respecting the Core Business Logic Guardrail).

4. **Run QA Verification Suite**:
   ```powershell
   npx tsc --noEmit
   npm test
   ```

5. **Record Incident & Solution in Squad Memory**:
   - Append a new `MEM-YYYY-MM-DD-XXX` entry to `.agents/skills/cto-engineering-squad/MEMORY.md` detailing the problem, root cause, applied solution, and anti-regression guardrail so the squad retains permanent institutional memory.

6. **Deploy & Report**:
   - Commit and push via the `auto-deploy` workflow (`git add -A ; git commit -m "..." ; git push origin main`).
   - Present a structured **CTO Engineering Squad Report** summarizing the health of Frontend, Backend, QA Tests, Database Sync, Squad Memory, and DevOps Deployment.

---

## 6. Weekly Autonomous Audit Schedule (Zero-Intervention)

- **Schedule**: Automatically runs **once per week every Monday at 08:00 UTC** (`0 8 * * 1`) without user intervention via:
  1. **GitHub Actions CI**: `.github/workflows/cto-weekly-audit.yml` (runs `prisma generate`, `tsc --noEmit`, and `audit-crm-workflows.ts --ci`; automatically opens a GitHub Issue on any failure).
  2. **Autonomous Agent Daemon Schedule**: Triggers the CTO Squad agent on the same weekly cadence to run `audit-crm-workflows.ts`, `full-diagnostic-check.ts`, and `npx tsc --noEmit`.
- **Automatic Dev Agent Routing**:
  - `BACKEND_API` / `DATABASE` / Prisma schema mismatches → **Senior Backend Engineer**
  - `FRONTEND_UI` / LiveSync / broken handlers → **Senior Frontend Engineer**
  - TypeScript / unit test regressions → **Senior QA / Test Engineer**
  - `DEVOPS_SYNC` / Docker / Kubernetes / Backup → **Senior DevOps / Docker / K8s Engineer**
- Any technical, schema, or sync bug detected during the weekly audit is fixed automatically (strictly respecting the Core Business Logic Guardrail), logged in `MEMORY.md`, and auto-deployed.

## 7. Executive Operations Watchdog (`executive-watchdog`)

- **Role**: Autonomous Operations & SLA Supervisor ensuring all repetitive GoCab CRM workflows execute on time and at full efficiency.
- **Schedule**: Automatically runs **every 3 hours at `:30`** (`30 */3 * * *`, 30 minutes after each sync window) via `IsDaemon: true` schedule and `executive-watchdog` subagent.
- **Verification Engine**: `node --import tsx scripts/executive-watchdog.ts`
  - Checks **Vehicles Fleet Auto-Sync** (`0 */3 * * *`, freshness SLA $\le 4.0\text{h}$).
  - Checks **Morning Collection Sync** (`0 9 * * 1-6`, `PaymentLedger.morningBalance` entries for Morocco workday).
  - Checks **Evening Collection Sync** (`0 18,23 * * 1-6`, `PaymentLedger.eveningBalance` entries for Morocco workday).
  - Checks **Cloud WAL & LiveSync State** (`data_sync_state` integrity).
  - Persists JSON SLA report to `Setting` (`key = "executive_watchdog_last_report"`).
- **Auto-Recovery**: If any task is `OVERDUE` or `ERROR`, the watchdog checks `manage_task(Action: "list")` to re-arm any dropped daemon schedule and triggers `browser` export + `sync-fleet-xlsx.ts` / `sync-collection-xlsx.ts` recovery immediately (or alerts the user if Google login is required).

## 8. Missed Collection Recovery SOP (`sync-transactions-recovery.ts`)

Whenever a past workday (`Mon–Sat`) missed its 18:00 / 23:00 Evening Collection upload (detected automatically by `executive-watchdog.ts` under **Past Collection Uploads (5d)**), recover that exact date without overwriting today's live balances:
1. **Export Filtered Transactions**:
   - Navigate via `browser` subagent to:
     `https://fleet.gocab.io/finances/transactions?filters[transaction][created_at][start_date]=<YYYY-MM-DD>&filters[transaction][created_at][end_date]=<YYYY-MM-DD>`
   - Click **Export** to download the `.xlsx` file for that exact date (`<YYYY-MM-DD>`).
2. **Run Recovery Script (Strict Active-Fleet Filter)**:
   - Execute:
     `node --import tsx scripts/sync-transactions-recovery.ts "<downloaded_xlsx>" <YYYY-MM-DD> --apply`
   - **Built-in Guardrails**:
     - Matches `Type === "credit"` and `Category === "cashin"` only (excludes `bail`, `adjustment`, `bonus`).
     - Filters strictly against drivers who were already in `<YYYY-MM-DD>`'s `PaymentLedger` morning roster, excluding new drivers' onboarding/security deposits (`1,000 MAD` / `1,800 MAD` / `3,000 MAD`).
     - Updates `clearedMAD`, `eveningBalance`, `calculatedDelta`, and triggers `touchSyncState("collections")` + `flushDatabaseSync()`.
