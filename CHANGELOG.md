# Changelog

All notable changes to the GoCab CRM platform are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-10-09

### Security & Hardening
- **fix(security):** Close critical unauthenticated account takeover vulnerability in `/api/users/change-password` by enforcing active session check, ownership verification, and old password validation (`BUG-001`).
- **fix(security):** Disable public HTTP seed execution in production; remove plaintext passwords from repository source code and require development key (`BUG-002`).
- **fix(security):** Remove hardcoded fallback JWT secret in `src/auth.config.ts`; enforce environment variable in production (`BUG-003`).
- **fix(security):** Enforce `requireAuth()` on `/api/settings`; mask Telegram bot token for non-management roles and restrict writes to `ADMIN` and `OPS_MANAGER` (`BUG-004`).
- **fix(security):** Systematically enforce authentication and RBAC across operational routes: `/api/leads`, `/api/drivers`, `/api/tickets`, `/api/accidents`, `/api/upload-*`, and `/api/telegram/test` (`BUG-005`).
- **fix(security):** Implement fail-closed `validateCronAuth` with constant-time SHA-256 comparison for all automated cron endpoints (`BUG-006`).
- **fix(security):** Add Meta `X-Hub-Signature-256` HMAC-SHA256 signature verification on WhatsApp webhook route (`BUG-007`).

### Added
- **test:** Added native automated test runner (`npm test`) using Node 24 and `tsx` with unit verification suite for auth guards, timing-safe crypto, and token masking.
- **docs:** Added comprehensive security and architectural audit documentation under `docs/audit/` (`01-reconocimiento`, `02-hallazgos-raw`, `03-hallazgos-priorizados`, `05-validacion`, `06-ejecutivo`, `06-tecnico`, `07-mejora-continua`).

---

## [0.1.0] - Prior Release
- Initial GoCab CRM and fleet operations release.
