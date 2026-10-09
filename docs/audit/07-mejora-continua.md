# GoCab CRM — Phase 7: Continuous Improvement & Security Roadmap
**Document ID:** `07-mejora-continua.md`  
**Date:** 2026-10-09  
**Auditing Team:** Senior Multidisciplinary Engineering Team

---

## 1. Preventive Controls & Quality Gates

To prevent security debt from recurring, the following controls are recommended for CI/CD:

1. **Pre-Commit Hooks (Husky / lint-staged):**
   - Run type checking: `npx tsc --noEmit`.
   - Run unit tests: `npm test`.
   - Gitleaks or TruffleHog to block hardcoded API keys, passwords, or tokens.

2. **Automated CI Security Pipeline (GitHub Actions):**
   - **SAST (Static Analysis):** Semgrep rules verifying that every new `src/app/api/**/route.ts` contains `requireAuth` or is explicitly annotated as `@public`.
   - **SCA (Supply Chain):** Dependabot automated pull requests with weekly cadence for high-severity package updates.
   - **Secret Scanning:** GitHub Secret Scanning enabled across all branches.

---

## 2. Observability & SRE Recommendations

1. **Structured JSON Audit Logging:**
   - Integrate structured audit logs (`src/lib/services/auditLogger.ts`) for all security-sensitive events:
     - Password updates (with actor ID, target user ID, IP address, timestamp).
     - Vehicle status changes (Actif -> Blocked / Accident).
     - Financial waivers and payment recording.
2. **Alerting on Anomaly Spikes:**
   - Alert SRE / Ops team on:
     - Repeated 401/403 responses from `/api/*` (> 10/min from a single IP).
     - Multiple failed cron authentication attempts.
     - Sudden spike in failed WhatsApp webhook signatures.

---

## 3. Prioritized Architectural Roadmap

| Initiative | Priority | Description | Target Timeline |
|---|---|---|---|
| **Rate Limiting Middleware** | P1 (High) | Add Upstash Redis or in-memory token bucket rate limiting on auth & webhook routes (`/login`, `/api/users/change-password`, `/api/whatsapp/webhook`). | Sprint 1 |
| **Consolidate Auth Utilities** | P2 (Medium) | Transition all legacy callers of `auth-guard.ts` to `api-auth.ts` for unified error handling. | Sprint 2 |
| **Safe Migration for SheetJS** | P2 (Medium) | Replace unpatched `xlsx` library with modern `exceljs` to eliminate Prototype Pollution and ReDoS warnings. | Sprint 2 |
| **Separation of Read/Write in Accidents** | P3 (Low) | Decouple automatic synchronization side-effects from `GET /api/accidents` into a scheduled background reconciliation job. | Sprint 3 |
