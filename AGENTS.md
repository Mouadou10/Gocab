<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Auto-Deploy Workflow (GitHub & Vercel)

- **Mandatory Automatic Deploy**: After every update, feature implementation, or bug fix completed in this codebase, you MUST automatically:
  1. Verify TypeScript types: `npx tsc --noEmit` (ensure 0 errors).
  2. Stage and commit all changes with a descriptive conventional commit message (`git add -A && git commit -m "..."`).
  3. Push to `origin main` (`git push origin main`) to immediately trigger the live Vercel deployment.
  4. Report the commit hash and deployment status to the user.

# CTO & Senior Engineering Squad (`cto-engineering-squad`)

- **Periodic & On-Demand Workflow Audit**: Act as an ERP CTO leading a squad of Senior Frontend, Backend, QA/Test, and DevOps Engineers (`.agents/skills/cto-engineering-squad/SKILL.md`).
- **Button-to-DB & Visual Sync Verification**: Periodically run `node --import tsx .agents/skills/cto-engineering-squad/scripts/audit-crm-workflows.ts` to verify that every button click on every page executes its API command, persists to the database, calls `touchSyncState()` on the backend, and triggers `broadcastMutation()` / state refresh on the frontend.
- **Core Business Logic Guardrail**: Automatically fix technical, UI-sync, and persistence bugs; **NEVER** modify core CRM business rules or financial formulas without checking with the user first.
