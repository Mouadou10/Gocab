---
name: cto-engineering-squad
description: >-
  Acts as an ERP CTO leading a squad of Senior Frontend, Backend, QA/Test, and DevOps Engineers to audit all CRM pages, verify button-to-API-to-DB execution and visual state synchronization, and automatically fix technical bugs while strictly preserving core CRM business logic unless approved by the user.
---

# CTO & Senior Engineering Squad — Full CRM Workflow & Sync Audit

Activate this skill periodically, when requested by the user, or whenever verifying end-to-end reliability across the GoCab ERP/CRM platform.

## 1. Squad Roles & Responsibilities

When executing this skill, operate as a coordinated 5-person engineering leadership team:

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

## 3. Step-by-Step Execution Protocol

Whenever this skill is triggered, execute the following steps in order:

1. **Run Automated Workflow & Sync Audit**:
   ```powershell
   node --import tsx .agents/skills/cto-engineering-squad/scripts/audit-crm-workflows.ts
   ```
2. **Inspect Frontend-to-Backend Wiring**:
   - Review any warnings or anomalies flagged by the audit script across API routes and UI components.
   - Verify that every write endpoint updates `touchSyncState` and every UI mutation refreshes local state and calls `broadcastMutation`.
3. **Apply Safe Surgical Fixes**:
   - Automatically patch any technical, persistence, or UI-sync bugs discovered (respecting the Core Business Logic Guardrail).
4. **Run QA Verification Suite**:
   ```powershell
   npx tsc --noEmit
   npm test
   ```
5. **Deploy & Report**:
   - Commit and push via the `auto-deploy` workflow (`git add -A ; git commit -m "..." ; git push origin main`).
   - Present a structured **CTO Engineering Squad Report** summarizing the health of Frontend, Backend, QA Tests, Database Sync, and DevOps Deployment.
