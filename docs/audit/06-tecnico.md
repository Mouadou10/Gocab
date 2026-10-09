# GoCab CRM — Phase 6: Detailed Technical Report
**Document ID:** `06-tecnico.md`  
**Date:** 2026-10-09  
**Target:** GoCab Repository

---

## 1. Technical Audit Findings & Remediation Details

### BUG-001: Unauthenticated Account Takeover
- **File:** `src/app/api/users/change-password/route.ts`
- **Root Cause:** Direct password hash update based on incoming JSON without checking session or authorization.
- **Remediation:**
  - Integrated `requireAuth()`.
  - Non-administrators can only change their own password (`isSelf`).
  - Added `bcrypt.compare` verification for `oldPassword` on self-service changes.
- **Verification:** Verified with `tests/auth-security.test.ts` and TypeScript strict type checking.

---

### BUG-002: Hardcoded Plaintext Passwords in Public Seed
- **Files:** `src/app/api/seed/route.ts`, `src/auth.config.ts`
- **Root Cause:** NextAuth middleware whitelisted `/api/seed`, which contained team passwords in cleartext.
- **Remediation:**
  - Blocked `/api/seed` in production (`process.env.NODE_ENV === "production"` returns 403).
  - Replaced hardcoded credentials with `process.env.SEED_INITIAL_PASSWORD`.
  - Removed `/api/seed` from `isPublic` in `auth.config.ts`.
- **Verification:** Verified production guard and development key validation.

---

### BUG-003: Hardcoded JWT Fallback Secret
- **File:** `src/auth.config.ts`
- **Root Cause:** Static string fallback allowed offline signing of valid JWT session tokens.
- **Remediation:**
  - Removed static string fallback; in production, `process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET` is strictly required.
- **Verification:** Unit test confirms rejection of fallback token in production mode.

---

### BUG-004: Telegram Bot Token & Settings Leak
- **File:** `src/app/api/settings/route.ts`
- **Root Cause:** `GET` and `POST` lacked session authorization.
- **Remediation:**
  - Added `requireAuth()` to `GET` and `POST`.
  - Masked `telegram_bot_token` (`••••••••`) for non-management roles.
  - Enforced `["ADMIN", "OPS_MANAGER"]` role check on `POST`.
- **Verification:** Unit test validates masking logic for viewer vs admin.

---

### BUG-005: Systematic Missing Authentication Across Core APIs
- **Files:**
  - `src/app/api/leads/route.ts` (GET / POST)
  - `src/app/api/drivers/route.ts` (GET / POST)
  - `src/app/api/drivers/[id]/route.ts` (GET / PATCH / DELETE)
  - `src/app/api/tickets/route.ts` (GET / POST)
  - `src/app/api/tickets/[id]/route.ts` (PATCH / DELETE)
  - `src/app/api/accidents/route.ts` (GET)
  - `src/app/api/accidents/[id]/route.ts` (GET / PATCH)
  - `src/app/api/upload-leads/route.ts` (POST)
  - `src/app/api/upload-drivers/route.ts` (POST)
  - `src/app/api/upload-vehicles/route.ts` (POST)
  - `src/app/api/telegram/test/route.ts` (POST)
- **Remediation:**
  - Embedded `requireAuth()` and role-based permissions (`ADMIN`, `OPS_MANAGER`, etc.) across all endpoints.
- **Verification:** All route modifications compile cleanly with 0 TypeScript errors.

---

### BUG-006: Unauthenticated Cron Trigger
- **Files:**
  - `src/app/api/cron/daily-billing/route.ts`
  - `src/app/api/cron/escalation/route.ts`
  - `src/app/api/cron/predictive-maintenance/route.ts`
- **Remediation:**
  - Created reusable `validateCronAuth(request)` in `src/lib/api-auth.ts`.
  - Implemented fail-closed security requiring `CRON_SECRET`.
  - Applied constant-time comparison with `crypto.timingSafeEqual` over SHA-256 digests.
- **Verification:** Unit test confirms rejection of missing, empty, or mismatched tokens.

---

### BUG-007: Missing WhatsApp Webhook HMAC Signature
- **File:** `src/app/api/whatsapp/webhook/route.ts`
- **Remediation:**
  - Added verification of `X-Hub-Signature-256` header against `WHATSAPP_APP_SECRET`.
  - Used timing-safe comparison on HMAC digests.
- **Verification:** Unit test validates signature integrity check.
