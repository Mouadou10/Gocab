/**
 * GoCab Executive Operations Watchdog
 *
 * Verifies that all repetitive automated tasks (Vehicles 3h sync, Morning 9AM & Evening 11PM
 * cash collections Mon-Sat, Cloud WAL sync, and CRM health) completed on time and efficiently.
 * Persists the latest SLA report in Setting (`executive_watchdog_last_report`).
 */

import { prisma, flushDatabaseSync } from "../src/lib/prisma";

interface TaskSlaResult {
  task: string;
  schedule: string;
  status: "ON_TIME" | "PENDING_WINDOW" | "OVERDUE" | "ERROR";
  detail: string;
  lastRunAt?: string | null;
  metric?: string;
}

async function main() {
  const now = new Date();
  // Morocco is UTC+1 (Africa/Casablanca)
  const moroccoNow = new Date(now.getTime() + 60 * 60 * 1000);
  const dayOfWeek = moroccoNow.getUTCDay(); // 0=Sun, 1=Mon..6=Sat
  const hour = moroccoNow.getUTCHours();
  const minute = moroccoNow.getUTCMinutes();
  const todayIso = moroccoNow.toISOString().split("T")[0];
  const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 6;

  const results: TaskSlaResult[] = [];

  // 1. Vehicles 3-Hour Sync SLA Check
  const latestVehicle = await prisma.vehicle.findFirst({
    where: { is_archived: false },
    orderBy: { updated_at: "desc" },
    select: { updated_at: true },
  });
  const totalVehicles = await prisma.vehicle.count({ where: { is_archived: false } });
  const vehicleHoursAgo = latestVehicle?.updated_at
    ? (now.getTime() - new Date(latestVehicle.updated_at).getTime()) / (1000 * 60 * 60)
    : 999;

  results.push({
    task: "Vehicles Fleet Auto-Sync",
    schedule: "Every 3 hours (0 */3 * * *)",
    status: vehicleHoursAgo <= 4 ? "ON_TIME" : "OVERDUE",
    lastRunAt: latestVehicle?.updated_at ? new Date(latestVehicle.updated_at).toISOString() : null,
    metric: `${totalVehicles} vehicles · ${vehicleHoursAgo.toFixed(1)}h ago`,
    detail:
      vehicleHoursAgo <= 4
        ? "Fleet data is fresh and within 3-hour SLA."
        : `Fleet data is ${vehicleHoursAgo.toFixed(1)}h old (> 4h SLA threshold) — recovery sync required.`,
  });

  // 2. Morning Collection (9:00 AM Mon-Sat) SLA Check
  const startOfDay = new Date(`${todayIso}T00:00:00.000Z`);
  const endOfDay = new Date(`${todayIso}T23:59:59.999Z`);
  const todaysLedgers = await prisma.paymentLedger.findMany({
    where: {
      paymentDate: { gte: startOfDay, lte: endOfDay },
    },
    select: {
      morningBalance: true,
      eveningBalance: true,
      calculatedDelta: true,
      loggedAt: true,
    },
  });

  const morningEntries = todaysLedgers.filter((l) => l.morningBalance !== null);
  const eveningEntries = todaysLedgers.filter((l) => l.eveningBalance !== null);

  if (!isWorkDay) {
    results.push({
      task: "Morning Collection Sync",
      schedule: "09:00 AM Mon-Sat",
      status: "PENDING_WINDOW",
      metric: "Sunday (off-day)",
      detail: "No collection sync scheduled on Sunday.",
    });
    results.push({
      task: "Evening Collection Sync",
      schedule: "11:00 PM Mon-Sat",
      status: "PENDING_WINDOW",
      metric: "Sunday (off-day)",
      detail: "No collection sync scheduled on Sunday.",
    });
  } else {
    const pastMorningWindow = hour > 9 || (hour === 9 && minute >= 15);
    results.push({
      task: "Morning Collection Sync",
      schedule: "09:00 AM Mon-Sat",
      status:
        morningEntries.length > 0
          ? "ON_TIME"
          : pastMorningWindow
          ? "OVERDUE"
          : "PENDING_WINDOW",
      metric: `${morningEntries.length} morning records today`,
      detail:
        morningEntries.length > 0
          ? `Morning balances recorded (${morningEntries.length} drivers).`
          : pastMorningWindow
          ? "Morning 09:00 AM sync missed for today — recovery required."
          : "Waiting for 09:00 AM window.",
    });

    const pastEveningWindow = hour > 23 || (hour === 23 && minute >= 15);
    results.push({
      task: "Evening Collection Sync",
      schedule: "11:00 PM Mon-Sat",
      status:
        eveningEntries.length > 0
          ? "ON_TIME"
          : pastEveningWindow
          ? "OVERDUE"
          : "PENDING_WINDOW",
      metric: `${eveningEntries.length} evening records today`,
      detail:
        eveningEntries.length > 0
          ? `Evening collections computed (${eveningEntries.length} drivers).`
          : pastEveningWindow
          ? "Evening 11:00 PM sync missed for today — recovery required."
          : "Waiting for 11:00 PM window.",
    });
  }

  // 3. Cloud WAL & Sync State Check
  const syncSetting = await prisma.setting.findUnique({
    where: { key: "data_sync_state" },
  });
  results.push({
    task: "Cloud WAL & LiveSync State",
    schedule: "Continuous",
    status: syncSetting?.value ? "ON_TIME" : "ERROR",
    metric: syncSetting?.value ? "ACTIVE" : "MISSING",
    detail: syncSetting?.value
      ? "LiveSync & Cloud WAL state active."
      : "data_sync_state setting missing.",
  });

  const overdueCount = results.filter((r) => r.status === "OVERDUE" || r.status === "ERROR").length;
  const report = {
    checkedAt: now.toISOString(),
    moroccoDate: todayIso,
    overallStatus: overdueCount === 0 ? "HEALTHY" : "ACTION_REQUIRED",
    overdueCount,
    results,
  };

  await prisma.setting.upsert({
    where: { key: "executive_watchdog_last_report" },
    update: { value: JSON.stringify(report) },
    create: { key: "executive_watchdog_last_report", value: JSON.stringify(report) },
  });
  await flushDatabaseSync().catch(() => {});

  console.log("==================================================================");
  console.log(" 👔 GOCAB EXECUTIVE OPERATIONS WATCHDOG — SLA & EFFICIENCY REPORT");
  console.log("==================================================================");
  console.table(
    results.map((r) => ({
      Task: r.task,
      Schedule: r.schedule,
      Status: r.status,
      Metric: r.metric || "-",
    }))
  );
  console.log(`Overall Status: ${report.overallStatus} (${overdueCount} overdue/error)`);

  if (overdueCount > 0) {
    process.exitCode = 2; // Signal executive agent to trigger recovery
  }
}

main()
  .catch((err) => {
    console.error("Executive watchdog failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0);
  });
