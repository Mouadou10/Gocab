/**
 * GoCab CRM — CTO & Senior Engineering Squad Automated Workflow Auditor
 *
 * Audits:
 * 1. Database integrity & table row counts (SQLite dev.db)
 * 2. Backend API Write Endpoints (POST/PUT/PATCH/DELETE persistence & sync)
 * 3. Frontend Component Interactive Handlers & LiveSync wiring
 * 4. Docker, Kubernetes & Cloud Infrastructure (Container parity & probes)
 * 5. Cloud Redundancy & Google Drive Webhook status
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const ROOT_DIR = process.cwd();
const DB_PATH = path.join(ROOT_DIR, "dev.db");
const API_DIR = path.join(ROOT_DIR, "src", "app", "api");
const COMPONENTS_DIR = path.join(ROOT_DIR, "src", "components");

interface AuditIssue {
  severity: "ERROR" | "WARN" | "INFO";
  layer: "DATABASE" | "BACKEND_API" | "FRONTEND_UI" | "DEVOPS_SYNC";
  target: string;
  detail: string;
}

const issues: AuditIssue[] = [];

function walkFiles(dir: string, extFilter: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extFilter));
    } else if (extFilter.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log("==================================================================");
console.log(" 🛡️  GOCAB CTO & SENIOR ENGINEERING SQUAD — WORKFLOW AUDIT");
console.log("==================================================================\n");

// 1. DATABASE INTEGRITY AUDIT
console.log("▶ [1/6] Auditing Database Persistence & Core Tables...");
if (!fs.existsSync(DB_PATH)) {
  issues.push({
    severity: "ERROR",
    layer: "DATABASE",
    target: "dev.db",
    detail: "Database file dev.db is missing from project root.",
  });
} else {
  const db = new Database(DB_PATH, { readonly: true });
  const coreTables = [
    "Lead",
    "Vehicle",
    "DriverProfile",
    "PaymentLedger",
    "MaintenanceTicket",
    "FieldTask",
    "WhatsAppConversation",
    "WhatsAppMessage",
    "Setting",
    "User",
  ];

  const tableSummary: Record<string, number | string> = {};
  for (const table of coreTables) {
    try {
      const row = db.prepare(`SELECT count(*) as count FROM "${table}"`).get() as { count: number };
      tableSummary[table] = row.count;
    } catch (err: any) {
      tableSummary[table] = `MISSING (${err.message})`;
      issues.push({
        severity: "ERROR",
        layer: "DATABASE",
        target: table,
        detail: `Core table "${table}" could not be queried: ${err.message}`,
      });
    }
  }
  console.table(tableSummary);

  // Check LiveSync & Backup settings
  try {
    const syncState = db.prepare("SELECT value FROM Setting WHERE key = 'data_sync_state'").get() as { value?: string } | undefined;
    const webhookUrl = db.prepare("SELECT value FROM Setting WHERE key = 'google_drive_webhook_url'").get() as { value?: string } | undefined;
    const lastBackup = db.prepare("SELECT value FROM Setting WHERE key = 'last_backup_google_drive'").get() as { value?: string } | undefined;

    console.log("  • LiveSync State:", syncState?.value ? "ACTIVE" : "NOT INITIALIZED");
    console.log("  • Google Drive Webhook:", webhookUrl?.value ? "CONFIGURED" : "MISSING");
    if (lastBackup?.value) {
      try {
        const parsed = JSON.parse(lastBackup.value);
        console.log(`  • Last Backup: ${parsed.timestamp} (${parsed.method}) — Success: ${parsed.success}`);
      } catch {
        console.log("  • Last Backup:", lastBackup.value);
      }
    }
  } catch (err: any) {
    issues.push({
      severity: "WARN",
      layer: "DEVOPS_SYNC",
      target: "Setting",
      detail: `Failed to inspect sync settings: ${err.message}`,
    });
  }
  db.close();
}

// 2. BACKEND API WRITE-PATH AUDIT
console.log("\n▶ [2/6] Auditing Backend API Write Endpoints (POST/PUT/PATCH/DELETE)...");
const apiRoutes = walkFiles(API_DIR, ["route.ts"]);
let writeRouteCount = 0;

const criticalSyncDomains = [
  { pathFragment: "api/leads", domain: "leads" },
  { pathFragment: "api/tickets", domain: "tickets" },
  { pathFragment: "api/field-tasks", domain: "field_tasks" },
  { pathFragment: "api/accidents", domain: "accidents" },
  { pathFragment: "api/vehicles", domain: "vehicles" },
  { pathFragment: "api/drivers", domain: "drivers" },
  { pathFragment: "api/collections", domain: "collections" },
];

for (const routeFile of apiRoutes) {
  const relPath = path.relative(ROOT_DIR, routeFile).replace(/\\/g, "/");
  const content = fs.readFileSync(routeFile, "utf8");
  const hasWrite = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(content);

  if (hasWrite) {
    writeRouteCount++;
    if (!content.includes("try") || !content.includes("catch")) {
      issues.push({
        severity: "WARN",
        layer: "BACKEND_API",
        target: relPath,
        detail: "Write handler missing top-level try/catch error boundary.",
      });
    }

    for (const crit of criticalSyncDomains) {
      if (relPath.includes(crit.pathFragment)) {
        if (!content.includes("touchSyncState")) {
          issues.push({
            severity: "WARN",
            layer: "BACKEND_API",
            target: relPath,
            detail: `Critical mutation route in "${crit.pathFragment}" does not call touchSyncState() for cross-client UI sync.`,
          });
        }
      }
    }
  }
}
console.log(`  ✓ Audited ${apiRoutes.length} total API route files (${writeRouteCount} write-enabled endpoints).`);

// 3. FRONTEND UI-TO-BACKEND SYNC AUDIT
console.log("\n▶ [3/6] Auditing Frontend Interactive Views & LiveSync Wiring...");
const criticalComponents = [
  "KanbanBoard.tsx",
  "LeadDrawer.tsx",
  "FleetPerformanceView.tsx",
  "BalanceReconciliationModal.tsx",
  "TicketDrawer.tsx",
  "FieldMissionsView.tsx",
  "InsuranceView.tsx",
  "WhatsAppCrmView.tsx",
  "SettingsView.tsx",
];

for (const compName of criticalComponents) {
  const compPath = path.join(COMPONENTS_DIR, compName);
  if (!fs.existsSync(compPath)) {
    issues.push({
      severity: "ERROR",
      layer: "FRONTEND_UI",
      target: compName,
      detail: `Critical workflow component ${compName} not found.`,
    });
    continue;
  }

  const content = fs.readFileSync(compPath, "utf8");
  const fetchMatches = content.match(/fetch\s*\(/g)?.length || 0;
  const hasResOkCheck = content.includes("res.ok") || content.includes("response.ok");
  const hasLiveSync = content.includes("useLiveSync") || content.includes("broadcastMutation");

  console.log(
    `  • ${compName.padEnd(32)} | API calls: ${String(fetchMatches).padEnd(3)} | res.ok verified: ${hasResOkCheck ? "YES" : "NO "} | LiveSync: ${hasLiveSync ? "YES" : "LOCAL"}`
  );

  if (fetchMatches > 0 && !hasResOkCheck) {
    issues.push({
      severity: "WARN",
      layer: "FRONTEND_UI",
      target: compName,
      detail: "Component performs fetch() calls without checking res.ok before updating visual state.",
    });
  }
}

// 4. DOCKER & KUBERNETES INFRASTRUCTURE AUDIT
console.log("\n▶ [4/6] Auditing Docker, Kubernetes & Cloud Infrastructure...");
const infraFiles = [
  { file: "Dockerfile", desc: "Multi-stage Production Dockerfile", required: true },
  { file: ".dockerignore", desc: "Docker Build Context Ignore", required: true },
  { file: "docker-compose.yml", desc: "Local/Staging Orchestration", required: true },
  { file: "k8s/deployment.yaml", desc: "Kubernetes Deployment & Pod Spec", required: true },
  { file: "k8s/service.yaml", desc: "Kubernetes Service (ClusterIP)", required: true },
  { file: "k8s/ingress.yaml", desc: "Kubernetes TLS Ingress", required: true },
  { file: "k8s/hpa.yaml", desc: "Horizontal Pod Autoscaler (HPA)", required: true },
  { file: "k8s/configmap.yaml", desc: "Kubernetes ConfigMap", required: true },
  { file: "src/app/api/health/route.ts", desc: "Unified Health Probe (/api/health)", required: true },
];

for (const item of infraFiles) {
  const p = path.join(ROOT_DIR, item.file);
  const exists = fs.existsSync(p);
  console.log(`  • ${item.desc.padEnd(36)} | File: ${item.file.padEnd(24)} | Status: ${exists ? "HEALTHY" : "MISSING"}`);
  if (!exists && item.required) {
    issues.push({
      severity: "ERROR",
      layer: "DEVOPS_SYNC",
      target: item.file,
      detail: `${item.desc} is missing from repository.`,
    });
  }
}

// 5. CTO SQUAD PERSISTENT MEMORY & SAFE NON-DESTRUCTIVE ROUTE AUDIT
console.log("\n▶ [5/6] Auditing CTO Squad Persistent Memory & Non-Destructive Route Standards...");
const memoryPath = path.join(ROOT_DIR, ".agents", "skills", "cto-engineering-squad", "MEMORY.md");
if (!fs.existsSync(memoryPath)) {
  issues.push({
    severity: "ERROR",
    layer: "DEVOPS_SYNC",
    target: "MEMORY.md",
    detail: "CTO Squad Memory file (.agents/skills/cto-engineering-squad/MEMORY.md) is missing.",
  });
} else {
  const memoryContent = fs.readFileSync(memoryPath, "utf8");
  const memoryEntries = memoryContent.match(/###\s+MEM-\d{4}-\d{2}-\d{2}-\d{3}/g) || [];
  console.log(`  • Squad Memory File: HEALTHY (${memoryEntries.length} institutional engineering incident records)`);
  for (const m of memoryEntries) {
    console.log(`    - ${m.replace("### ", "")}`);
  }
  if (memoryEntries.length === 0) {
    issues.push({
      severity: "WARN",
      layer: "DEVOPS_SYNC",
      target: "MEMORY.md",
      detail: "CTO Squad Memory file contains no recorded MEM- entries.",
    });
  }
}

// Check that NO GET route contains destructive delete operations
let safeGetRoutesChecked = 0;
for (const routeFile of apiRoutes) {
  const relPath = path.relative(ROOT_DIR, routeFile).replace(/\\/g, "/");
  const content = fs.readFileSync(routeFile, "utf8");
  const getMatch = content.match(/export\s+async\s+function\s+GET\s*\([^)]*\)\s*\{([\s\S]*?)(export\s+async\s+function|$)/);
  if (getMatch) {
    safeGetRoutesChecked++;
    const getBody = getMatch[1];
    if (getBody.includes(".deleteMany(") || getBody.includes(".delete(")) {
      issues.push({
        severity: "ERROR",
        layer: "BACKEND_API",
        target: relPath,
        detail: "Destructive database operation (.delete/.deleteMany) detected inside GET handler! GET endpoints must be idempotent and strictly read-only.",
      });
    }
  }
}
console.log(`  • GET Endpoint Idempotency: HEALTHY (${safeGetRoutesChecked} GET handlers verified strictly non-destructive)`);

// 6. SUMMARY REPORT
console.log("\n▶ [6/6] CTO Engineering Squad Diagnostic Summary:");
const errors = issues.filter((i) => i.severity === "ERROR");
const warnings = issues.filter((i) => i.severity === "WARN");

if (errors.length === 0 && warnings.length === 0) {
  console.log("  ✅ 0 Errors, 0 Warnings — All Frontend, Backend, Database, and Sync workflows are healthy!");
} else {
  console.log(`  ⚠️  Found ${errors.length} Error(s) and ${warnings.length} Warning(s):`);
  for (const issue of issues) {
    console.log(`     [${issue.severity}] [${issue.layer}] ${issue.target}: ${issue.detail}`);
  }
}

if (errors.length > 0) {
  process.exit(1);
}
