import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  prepareDeterministicWriteArgs,
  recordWalEntry,
  pushSqliteSnapshotNow,
} from "../src/lib/sqliteCloudSync";

const sqlitePath = "dev.db";
const url = `file:${sqlitePath}`;
const client = new PrismaClient({ adapter: new PrismaLibSql({ url }) });

async function main() {
  process.env.FORCE_CLOUD_WAL = "true";

  // 1. Update department_weekly_targets
  const currTargetsRow = await client.setting.findUnique({
    where: { key: "department_weekly_targets" },
  });
  let targetsObj: Record<string, any> = {};
  if (currTargetsRow?.value) {
    try {
      targetsObj = JSON.parse(currTargetsRow.value);
    } catch {}
  }
  targetsObj.target_daily_calls = 153;
  targetsObj.target_daily_training_fixed = 46;
  const newTargetsVal = JSON.stringify(targetsObj);

  const writeArgs1 = prepareDeterministicWriteArgs("Setting", "upsert", [
    {
      where: { key: "department_weekly_targets" },
      update: { value: newTargetsVal },
      create: { key: "department_weekly_targets", value: newTargetsVal },
    },
  ]);
  const res1 = await client.setting.upsert(writeArgs1[0]);
  recordWalEntry("Setting", "upsert", writeArgs1, res1);
  console.log("Updated department_weekly_targets to 153 calls / 46 fixed");

  // 2. Update role_tab_permissions
  const currPermsRow = await client.setting.findUnique({
    where: { key: "role_tab_permissions" },
  });
  let permsObj: Record<string, string[]> = {};
  if (currPermsRow?.value) {
    try {
      permsObj = JSON.parse(currPermsRow.value);
    } catch {}
  }
  const fleetPerms = new Set(permsObj.FLEET_PERF_MANAGER || [
    "dashboard",
    "kpi-dashboard",
    "drivers",
    "flagged-drivers",
    "fleet",
    "vehicle-ops",
    "tickets",
    "performance",
    "insurance",
    "whatsapp",
  ]);
  fleetPerms.add("leads");
  permsObj.FLEET_PERF_MANAGER = Array.from(fleetPerms);
  const newPermsVal = JSON.stringify(permsObj);

  const writeArgs2 = prepareDeterministicWriteArgs("Setting", "upsert", [
    {
      where: { key: "role_tab_permissions" },
      update: { value: newPermsVal },
      create: { key: "role_tab_permissions", value: newPermsVal },
    },
  ]);
  const res2 = await client.setting.upsert(writeArgs2[0]);
  recordWalEntry("Setting", "upsert", writeArgs2, res2);
  console.log("Updated role_tab_permissions with leads for FLEET_PERF_MANAGER:", permsObj.FLEET_PERF_MANAGER);

  // 3. Update department_target_history
  const currHistRow = await client.setting.findUnique({
    where: { key: "department_target_history" },
  });
  let histArr: any[] = [];
  if (currHistRow?.value) {
    try {
      histArr = JSON.parse(currHistRow.value);
    } catch {}
  }
  const nov2Idx = histArr.findIndex((h) => h.effective_date === "2026-11-02");
  const nov2Snapshot = {
    effective_date: "2026-11-02",
    target_daily_calls: 153,
    target_daily_training_fixed: 46,
    target_daily_attended: 30,
    target_daily_preorders: 12,
    target_daily_tasks: 10,
    target_lead_conversion_rate: 30,
    target_training_showup_rate: 65,
    target_preorder_conversion_rate: 25,
    target_min_collection_rate: 50,
    target_collection_rate: 60,
    target_monthly_churn_rate: 20,
    target_max_downtime_days: 10,
    target_avg_available_days: 1.0,
    target_max_missing_docs_days: 3.0,
    target_max_vidange_hours: 1.0,
    target_max_field_mission_hours: 3.0,
    target_sla_resolution_rate: 95,
    target_monthly_inspection_rate: 90,
    target_active_fleet_rate: 85,
  };
  if (nov2Idx >= 0) {
    histArr[nov2Idx] = nov2Snapshot;
  } else {
    histArr.push(nov2Snapshot);
  }
  histArr.sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const newHistVal = JSON.stringify(histArr);

  const writeArgs3 = prepareDeterministicWriteArgs("Setting", "upsert", [
    {
      where: { key: "department_target_history" },
      update: { value: newHistVal },
      create: { key: "department_target_history", value: newHistVal },
    },
  ]);
  const res3 = await client.setting.upsert(writeArgs3[0]);
  recordWalEntry("Setting", "upsert", writeArgs3, res3);
  console.log("Updated department_target_history with 2026-11-02 snapshot (153 calls)");

  // 4. Update sync state
  const syncPayload = {
    leads: Date.now(),
    tickets: Date.now(),
    settings: Date.now(),
    collections: Date.now(),
    updatedAt: Date.now(),
  };
  const writeArgs4 = prepareDeterministicWriteArgs("Setting", "upsert", [
    {
      where: { key: "data_sync_state" },
      update: { value: JSON.stringify(syncPayload) },
      create: { key: "data_sync_state", value: JSON.stringify(syncPayload) },
    },
  ]);
  const res4 = await client.setting.upsert(writeArgs4[0]);
  recordWalEntry("Setting", "upsert", writeArgs4, res4);

  // 5. Push to Google Drive WAL
  console.log("Flushing to Google Drive WAL...");
  await pushSqliteSnapshotNow(sqlitePath);
  console.log("SUCCESS! All settings updated in dev.db and flushed to Google Drive WAL!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
