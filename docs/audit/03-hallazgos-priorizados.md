# GoCab CRM — Phase 3: Finding Documentation & Prioritization
**Document ID:** `03-hallazgos-priorizados.md`  
**Date:** 2026-10-09  
**Auditing Team:** Senior Multidisciplinary Engineering Team (AppSec, Software Architect, SRE/DevOps, QA Lead, Compliance Auditor)

---

## 1. Prioritization & Risk Heatmap

```
  IMPACT
    ▲
  H │                     [BUG-004] [BUG-005]    [BUG-001] [BUG-002] [BUG-003]
    │                     [BUG-006] [BUG-007]
  M │ [BUG-008] [BUG-009] [BUG-010]
    │
  L │
    └────────────────────────────────────────────────────────►
                 LOW                   MEDIUM                 HIGH
                                  EXPLOITABILITY
```

---

## 2. Structured Findings Catalog

```yaml
- id: BUG-001
  title: "Unauthenticated Full Account Takeover via Arbitrary Password Reset"
  severity: Critical
  category: Security
  cvss_v3: 9.8 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
  cwe: CWE-306, CWE-640
  owasp: A01:2021-Broken Access Control, A07:2021-Identification Failures
  files: ["src/app/api/users/change-password/route.ts:10-54"]
  component: "UserService / Authentication"
  current_behavior: "Accepts JSON { email, userId, newPassword } and directly overwrites the password hash with no authentication, token, or current password verification."
  expected_behavior: "Requires either an authenticated active session matching the target user ID, or a cryptographically signed one-time reset token."
  root_cause: "Omission of requireAuth() and absence of existing password / verification token validation."
  impact:
    user: "Complete hijacking of user accounts."
    system: "Full administrative takeover of GoCab CRM."
    business: "Unauthorized access to confidential driver contracts, bank details, and telematics kill switch."
  reproduction:
    - "curl -X POST http://localhost:3000/api/users/change-password -H 'Content-Type: application/json' -d '{\"email\":\"mouad.koudia@gocab.io\",\"newPassword\":\"Attacker123!\"}'"
  evidence: ["src/app/api/users/change-password/route.ts lines 12-44"]
  proposed_fix: "Enforce requireAuth() check ensuring only the logged-in user can change their own password, verify oldPassword against existing passwordHash using bcrypt.compare before hashing the new password, or require ADMIN role."
  tests_to_add: ["unit/auth/change-password.test.ts", "integration/api/change-password-auth.test.ts"]
  priority_score: 9.8
  sla_fix: "≤ 24h"
  owner: "AppSec Lead"
  status: "Open"
  references: ["https://cwe.mitre.org/data/definitions/640.html", "https://owasp.org/Top10/A01_2021-Broken_Access_Control/"]

- id: BUG-002
  title: "Hardcoded Plaintext Passwords & Unrestricted DDL / DB Reseed in Public /api/seed"
  severity: Critical
  category: Security
  cvss_v3: 9.1 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)
  cwe: CWE-798, CWE-306
  owasp: A07:2021-Identification and Authentication Failures
  files: ["src/app/api/seed/route.ts:168-232", "src/auth.config.ts:21"]
  component: "Database Seeding / System Bootstrap"
  current_behavior: "Exposes team member emails and plaintext passwords ('Moulana@pc1995', 'GoCab2024!') in source code; public GET route executes DDL and resets team passwords in production."
  expected_behavior: "Seeding must be restricted to local development CLI scripts (e.g. tsx scripts/seed.ts) or protected by a strong ADMIN session in non-production environments with zero hardcoded credentials."
  root_cause: "Temporary seed helper left active and publicly whitelisted in NextAuth middleware."
  impact:
    user: "Known default credentials can be used to log into team accounts."
    system: "Database structure can be repeatedly executed by any internet crawler."
    business: "Breach of SOC2 and ISO 27001 credential management requirements."
  reproduction:
    - "curl -X GET http://localhost:3000/api/seed"
  evidence: ["src/app/api/seed/route.ts lines 174, 181, 188"]
  proposed_fix: "Remove plaintext passwords from source code; restrict endpoint strictly to development environment (process.env.NODE_ENV !== 'production') with ADMIN authorization or disable route in favor of CLI execution."
  tests_to_add: ["security/routes/seed-protection.test.ts"]
  priority_score: 9.1
  sla_fix: "≤ 24h"
  owner: "AppSec Lead / Software Architect"
  status: "Open"
  references: ["https://cwe.mitre.org/data/definitions/798.html"]

- id: BUG-003
  title: "Hardcoded Cryptographic Fallback Secret in NextAuth Configuration"
  severity: Critical
  category: Security
  cvss_v3: 8.6 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)
  cwe: CWE-798, CWE-321
  owasp: A02:2021-Cryptographic Failures
  files: ["src/auth.config.ts:9"]
  component: "Authentication / Session Tokens"
  current_behavior: "Falls back to static hardcoded string '81c134e63b7d02ddbdd6f6a3edae9042ace9af18cccada6e294bcc4998318c9f' when AUTH_SECRET is not provided."
  expected_behavior: "Application must fail to start or throw an explicit configuration error if AUTH_SECRET is missing, rather than using a known static secret."
  root_cause: "Developer convenience fallback committed to source control."
  impact:
    user: "Session hijacking."
    system: "Forged administrative JWT tokens without database authentication."
    business: "Cryptographic non-compliance under ISO 27001 (A.8.24)."
  reproduction:
    - "Unset AUTH_SECRET in .env and mint JWT using the hardcoded string."
  evidence: ["src/auth.config.ts line 9"]
  proposed_fix: "Throw an error if process.env.AUTH_SECRET and process.env.NEXTAUTH_SECRET are unset in production."
  tests_to_add: ["unit/auth/secret-validation.test.ts"]
  priority_score: 8.6
  sla_fix: "≤ 24h"
  owner: "AppSec Lead"
  status: "Open"
  references: ["https://cwe.mitre.org/data/definitions/321.html"]

- id: BUG-004
  title: "Telegram Bot Token & System Settings Exposed Unauthenticated"
  severity: High
  category: Security
  cvss_v3: 8.2 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N)
  cwe: CWE-200, CWE-306
  owasp: A01:2021-Broken Access Control
  files: ["src/app/api/settings/route.ts:62-110"]
  component: "Settings API"
  current_behavior: "GET /api/settings returns telegram_bot_token and internal config to anyone; POST /api/settings allows unauthenticated setting overwrites."
  expected_behavior: "Enforce requireAuth(['ADMIN', 'OPS_MANAGER']); mask sensitive secrets like telegram_bot_token on read."
  root_cause: "Omission of requireAuth() and absence of sensitive field filtering."
  impact:
    user: "Unauthorized modification of notification rules."
    system: "Telegram bot token leakage allowing unauthorized bot control."
    business: "Compromise of confidential recovery alerts and communication channels."
  reproduction:
    - "curl -X GET http://localhost:3000/api/settings"
  evidence: ["src/app/api/settings/route.ts lines 62-110"]
  proposed_fix: "Add requireAuth(['ADMIN', 'OPS_MANAGER']) on both GET and POST; mask telegram_bot_token in API responses."
  tests_to_add: ["integration/api/settings-auth.test.ts"]
  priority_score: 8.2
  sla_fix: "≤ 72h"
  owner: "AppSec Lead"
  status: "Open"
  references: ["https://cwe.mitre.org/data/definitions/200.html"]

- id: BUG-005
  title: "Systematic Missing Authentication Across Core Operational Endpoints (IDOR & PII Leak)"
  severity: High
  category: Security / Compliance
  cvss_v3: 8.6 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:L)
  cwe: CWE-306, CWE-862, CWE-639
  owasp: A01:2021-Broken Access Control
  files:
    - "src/app/api/leads/route.ts"
    - "src/app/api/drivers/route.ts"
    - "src/app/api/drivers/[id]/route.ts"
    - "src/app/api/tickets/route.ts"
    - "src/app/api/tickets/[id]/route.ts"
    - "src/app/api/accidents/route.ts"
    - "src/app/api/accidents/[id]/route.ts"
    - "src/app/api/upload-leads/route.ts"
    - "src/app/api/upload-drivers/route.ts"
    - "src/app/api/upload-vehicles/route.ts"
    - "src/app/api/telegram/test/route.ts"
  component: "Fleet & CRM Operational APIs"
  current_behavior: "Endpoints lack requireAuth(), allowing unauthenticated read, write, and deletion of records."
  expected_behavior: "All operational routes must enforce authenticated sessions with role-appropriate RBAC."
  root_cause: "Next.js middleware matcher explicitly excludes /api/*, requiring each route handler to explicitly invoke requireAuth()."
  impact:
    user: "Driver PII (CIN, phone, criminal record status) exposed to public internet (GDPR / Law 09-08 violation)."
    system: "Unauthenticated actors can delete driver profiles (DELETE /api/drivers/[id]) and tickets (DELETE /api/tickets/[id])."
    business: "Major compliance liability and potential data loss."
  reproduction:
    - "curl -X GET http://localhost:3000/api/leads"
    - "curl -X DELETE http://localhost:3000/api/drivers/test-id"
  evidence: ["Route handler files lack requireAuth() calls"]
  proposed_fix: "Systematically integrate requireAuth() across all operational endpoints with appropriate role guards."
  tests_to_add: ["integration/api/route-auth-suite.test.ts"]
  priority_score: 8.5
  sla_fix: "≤ 72h"
  owner: "AppSec Lead / Backend Engineer"
  status: "Open"
  references: ["https://cwe.mitre.org/data/definitions/306.html"]

- id: BUG-006
  title: "Unauthenticated Cron Execution Enabling Remote Engine Kill-Switch & Arrears Corruption"
  severity: High
  category: Security / Functional
  cvss_v3: 7.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H)
  cwe: CWE-306
  owasp: A01:2021-Broken Access Control
  files:
    - "src/app/api/cron/daily-billing/route.ts"
    - "src/app/api/cron/escalation/route.ts"
    - "src/app/api/cron/predictive-maintenance/route.ts"
  component: "Automated Cron Services"
  current_behavior: "cronSecret check is skipped if environment variable is unset; escalation and predictive maintenance routes have no authorization check whatsoever."
  expected_behavior: "Mandatory authorization check verifying Bearer CRON_SECRET on all automated cron endpoints, returning 401 if missing or invalid."
  root_cause: "Conditional check 'if (cronSecret)' allows unauthenticated access when secret is missing."
  impact:
    user: "Drivers unfairly penalized with repeated artificial daily charges."
    system: "Vehicles mistakenly placed into telematics engine shutdown."
    business: "Mass operational disruption and driver safety hazard."
  reproduction:
    - "curl -X POST http://localhost:3000/api/cron/escalation"
  evidence: ["src/app/api/cron/escalation/route.ts lines 4-10"]
  proposed_fix: "Enforce strict Bearer token authorization using process.env.CRON_SECRET across all cron routes; reject request if CRON_SECRET is not configured."
  tests_to_add: ["integration/cron/cron-auth.test.ts"]
  priority_score: 7.8
  sla_fix: "≤ 72h"
  owner: "SRE / DevOps Engineer"
  status: "Open"
  references: ["https://cwe.mitre.org/data/definitions/306.html"]

- id: BUG-007
  title: "Missing Webhook HMAC Signature Verification on WhatsApp Inbound Webhook"
  severity: High
  category: Security
  cvss_v3: 7.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N)
  cwe: CWE-345, CWE-353
  owasp: A08:2021-Software and Data Integrity Failures
  files: ["src/app/api/whatsapp/webhook/route.ts:37-134"]
  component: "WhatsApp Cloud API Webhook"
  current_behavior: "Processes POST requests without verifying Meta's X-Hub-Signature-256 header."
  expected_behavior: "Verify incoming request body HMAC-SHA256 signature against WHATSAPP_APP_SECRET before processing."
  root_cause: "Webhook handler only verifies token during GET challenge; skips cryptographic signature on POST."
  impact:
    user: "Spoofed driver responses and fraudulent customer agreements."
    system: "Corrupted conversation history."
    business: "Unauthorized message injection and fake KYC status changes."
  reproduction:
    - "curl -X POST http://localhost:3000/api/whatsapp/webhook -H 'Content-Type: application/json' -d '{\"entry\":[...]}'"
  evidence: ["src/app/api/whatsapp/webhook/route.ts lines 37-134"]
  proposed_fix: "Implement HMAC-SHA256 verification using crypto.createHmac and timingSafeEqual on req.headers.get('x-hub-signature-256')."
  tests_to_add: ["integration/webhooks/whatsapp-signature.test.ts"]
  priority_score: 7.5
  sla_fix: "≤ 72h"
  owner: "AppSec Lead"
  status: "Open"
  references: ["https://developers.facebook.com/docs/graph-api/webhooks/getting-started"]

- id: BUG-008
  title: "Dual Conflicting requireAuth Implementations & Inconsistent Return Types"
  severity: Medium
  category: Quality / Architecture
  cvss_v3: 5.3
  cwe: CWE-398
  files: ["src/lib/api-auth.ts", "src/lib/auth-guard.ts"]
  component: "Authentication Utilities"
  current_behavior: "Two different files provide requireAuth() with incompatible signatures (one returns union with NextResponse, other throws AuthError)."
  expected_behavior: "Single, standardized, ergonomic authentication and authorization helper with consistent return and error types."
  root_cause: "Unconsolidated utility code written during multiple feature phases."
  impact:
    user: "None directly."
    system: "High risk of developers misusing the wrong helper and introducing authentication bypass bugs."
    business: "Increased technical debt and maintenance complexity."
  proposed_fix: "Standardize on src/lib/api-auth.ts with unified role validation and explicit error helpers."
  tests_to_add: ["unit/lib/api-auth.test.ts"]
  priority_score: 5.5
  sla_fix: "≤ 2 weeks"
  owner: "Software Architect"
  status: "Open"
  references: ["Clean Architecture / Single Responsibility Principle"]

- id: BUG-009
  title: "Unsafe Database Mutation Side-Effects in HTTP GET /api/accidents"
  severity: Medium
  category: Functional / Architecture
  cvss_v3: 5.2
  cwe: CWE-398
  files: ["src/app/api/accidents/route.ts:52-120"]
  component: "Insurance & Accident Claims API"
  current_behavior: "GET /api/accidents mutates records in the database during query execution."
  expected_behavior: "GET handlers must be safe and idempotent per RFC 9110; mutations belong in POST/PATCH handlers or explicit sync tasks."
  root_cause: "Automatic data repair logic placed inside read query handler."
  impact:
    user: "Unexpected status changes upon simple page reloads."
    system: "Database lock contention, race conditions during high read volume."
    business: "Inconsistent claim audit history."
  proposed_fix: "Move auto-synchronization logic into explicit mutation trigger or POST /api/accidents/reconcile endpoint."
  tests_to_add: ["unit/api/accidents-get.test.ts"]
  priority_score: 5.2
  sla_fix: "≤ 2 weeks"
  owner: "Software Architect"
  status: "Open"
  references: ["https://datatracker.ietf.org/doc/html/rfc9110#section-9.2.1"]

- id: BUG-010
  title: "Supply Chain Dependencies with Known High & Critical CVEs"
  severity: High
  category: SupplyChain
  cvss_v3: 7.5
  cwe: CWE-1395
  files: ["package.json", "package-lock.json"]
  component: "Third-party Node Modules"
  current_behavior: "19 known vulnerabilities reported in npm audit (Next.js, NextAuth/Auth.js, SheetJS, etc.)."
  expected_behavior: "All production dependencies resolved to patched versions with zero open Critical findings."
  root_cause: "Outdated minor/patch versions of framework dependencies."
  impact:
    user: "Potential exposure to upstream library flaws."
    system: "Denial of service and potential SSRF in image optimization."
    business: "SCA audit failure under SOC2 / ISO 27001."
  proposed_fix: "Execute safe patch updates, configure dependabot, and audit xlsx usage."
  tests_to_add: ["ci/sca-audit.test.ts"]
  priority_score: 7.0
  sla_fix: "≤ 72h"
  owner: "SRE / DevOps Engineer"
  status: "Open"
  references: ["https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities"]
```
