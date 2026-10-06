---
name: auto-deploy
description: >-
  Automatically verifies, commits, and pushes all code modifications to GitHub to trigger live Vercel deployments after every task or update.
---

# Auto-Deploy Workflow (GitHub & Vercel)

Use this skill whenever an update, bug fix, feature, or code change is completed in the Gocab repository. It ensures that all changes are verified, committed, and deployed immediately to production on Vercel via GitHub.

## 1. Pre-Flight Verification
Always verify that TypeScript passes with zero errors before committing:
```powershell
npx tsc --noEmit
```
If errors are found, fix them before proceeding.

## 2. Review Changes & Stage Files
Review the status and stage all modified and new files:
```powershell
git status
git add -A
```

## 3. Commit with Conventional Commit Message
Commit the staged changes with a concise, clear description of the modifications made:
```powershell
git commit -m "<type>(<scope>): <concise description of changes>"
```
Examples:
- `fix(scorecards): adapt target objectives dynamically based on date filters`
- `feat(dashboard): add Moroccan calendar engine and team bonus meter`

## 4. Push to GitHub (`origin main`)
Push the commit directly to the `main` branch to trigger Vercel's automated build and live deployment:
```powershell
git push origin main
```

## 5. Verify & Report Status
Confirm that the push completed with code 0 and inform the user of the new commit hash and live deployment status.
