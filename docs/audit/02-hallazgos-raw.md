# GoCab CRM — Phase 2: Systematic Bug Discovery (Raw Findings)
**Document ID:** `02-hallazgos-raw.md`  
**Date:** 2026-10-09  
**Auditing Team:** Senior Multidisciplinary Engineering Team  
**Scope:** Full Codebase & Repository (`Gocab`)

---

## 1. Discovery Methodology & Toolchain
- **Static Code Analysis (SAST):** AST pattern matching, route traversal, regex inspection, ESLint 9 audit.
- **Software Composition Analysis (SCA):** `npm audit`, dependency graph inspection against GitHub Advisory Database.
- **Access Control & Auth Auditing:** Route-by-route authorization matrix inspection, token verification logic, edge middleware matcher analysis.
- **Threat Modeling & STRIDE Validation:** Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege.

---

## 2. Raw Findings Log

### [RAW-01] Unauthenticated Arbitrary Password Reset (`/api/users/change-password`)
- **Location:** `src/app/api/users/change-password/route.ts:10-54`
- **Method:** `POST`
- **Payload:** `{ "email": "mouad.koudia@gocab.io", "newPassword": "compromisedPassword123!" }`
- **Evidence:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId, newPassword } = body;
    // ... No auth check, no session verification, no old password check!
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const user = await prisma.user.update({
      where: userId ? { id: userId } : { email: email.toLowerCase() },
      data: { passwordHash, mustChangePassword: false },
    });
    return NextResponse.json({ success: true, user });
```
- **Impact:** Immediate full account takeover of any user in the database without credentials or session.

---

### [RAW-02] Hardcoded Passwords & Database Reseeding in Public `/api/seed`
- **Location:** `src/app/api/seed/route.ts:168-232` & `src/auth.config.ts:21`
- **Method:** `GET`
- **Evidence:**
```typescript
// auth.config.ts explicitly marks /api/seed as public
const isPublic = pathname.startsWith("/api/auth") || pathname.startsWith("/api/seed") ...

// seed/route.ts
const teamToSeed = [
  { email: "mouad.koudia@gocab.io", pass: "Moulana@pc1995", ... },
  { email: "kaoutar.ouardi@gocab.io", pass: "GoCab2024!", ... },
  { email: "salma.abouri@gocab.io", pass: "GoCab2024!", ... }
];
```
- **Impact:** Plaintext credentials exposed in repository; anyone can trigger reseeding in production.

---

### [RAW-03] Hardcoded JWT Secret Fallback in `auth.config.ts`
- **Location:** `src/auth.config.ts:9`
- **Evidence:**
```typescript
secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "81c134e63b7d02ddbdd6f6a3edae9042ace9af18cccada6e294bcc4998318c9f",
```
- **Impact:** Allows offline cryptographic signing of arbitrary user sessions if environment variable is missing.

---

### [RAW-04] Telegram Bot Secret Token & Settings Exposed Unauthenticated
- **Location:** `src/app/api/settings/route.ts:62-110`
- **Method:** `GET` & `POST`
- **Evidence:**
`GET /api/settings` returns all key/values including `telegram_bot_token` and `telegram_chat_id`.
`POST /api/settings` allows writing arbitrary keys without authentication.

---

### [RAW-05] Missing Authentication on 31+ Operational API Routes
- **Locations:**
  - `src/app/api/leads/route.ts` (GET / POST)
  - `src/app/api/drivers/route.ts` (GET / POST)
  - `src/app/api/drivers/[id]/route.ts` (GET / PATCH / DELETE)
  - `src/app/api/tickets/route.ts` (GET / POST)
  - `src/app/api/tickets/[id]/route.ts` (PATCH / DELETE)
  - `src/app/api/accidents/route.ts` (GET)
  - `src/app/api/accidents/[id]/route.ts` (PATCH)
  - `src/app/api/upload-leads/route.ts` (POST)
  - `src/app/api/upload-drivers/route.ts` (POST)
  - `src/app/api/upload-vehicles/route.ts` (POST)
  - `src/app/api/telegram/test/route.ts` (POST)
- **Impact:** Unrestricted deletion, creation, and data exfiltration of Moroccan citizen PII (CIN, driving licenses, criminal record checks).

---

### [RAW-06] Unauthenticated Cron Execution & Denial of Service
- **Locations:**
  - `src/app/api/cron/daily-billing/route.ts`
  - `src/app/api/cron/escalation/route.ts`
  - `src/app/api/cron/predictive-maintenance/route.ts`
- **Evidence:**
  `daily-billing` checks secret only `if (cronSecret)`. If `CRON_SECRET` is unset, anyone can invoke billing. `escalation` has no secret check at all.
- **Impact:** Arbitrary escalation of driver accounts to `TELEMATIC_BLOCK_EXECUTED`, cutting vehicle ignitions remotely.

---

### [RAW-07] Missing Webhook HMAC Signature Verification on WhatsApp Endpoint
- **Location:** `src/app/api/whatsapp/webhook/route.ts:37-134`
- **Method:** `POST`
- **Evidence:** Does not inspect `X-Hub-Signature-256` or validate HMAC-SHA256 hash using WhatsApp App Secret.
- **Impact:** Forged inbound WhatsApp customer messages, fraudulent booking confirmations.

---

### [RAW-08] Architectural Duplication: Conflicting `requireAuth` Implementations
- **Locations:** `src/lib/api-auth.ts` vs `src/lib/auth-guard.ts`
- **Evidence:** Two distinct functions with different signatures, error models, and return shapes.

---

### [RAW-09] Non-Idempotent Mutation Side-Effects in HTTP `GET /api/accidents`
- **Location:** `src/app/api/accidents/route.ts:52-120`
- **Evidence:** `GET` request issues database writes (`prisma.accidentClaim.updateMany`).

---

### [RAW-10] Supply Chain Vulnerabilities (19 Advisories)
- **Evidence:** `npm audit` reports 16 High, 3 Critical vulnerabilities (Next.js 16.3.0 RCE / SSRF, SheetJS ReDoS).
