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
      schedule: "18:00 & 23:00 Mon-Sat",
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

    const pastFirstEveningWindow = hour > 18 || (hour === 18 && minute >= 15);
    const pastFinalEveningWindow = hour > 23 || (hour === 23 && minute >= 15);
    results.push({
      task: "Evening Collection Sync",
      schedule: "18:00 & 23:00 Mon-Sat",
      status:
        eveningEntries.length > 0
          ? "ON_TIME"
          : pastFirstEveningWindow
          ? "OVERDUE"
          : "PENDING_WINDOW",
      metric: `${eveningEntries.length} evening records today`,
      detail:
        eveningEntries.length > 0
          ? `Evening collections computed (${eveningEntries.length} drivers).`
          : pastFinalEveningWindow
          ? "Evening 18:00 & 23:00 syncs missed for today — recovery required."
          : pastFirstEveningWindow
          ? "Evening 18:00 sync missed for today (next window 23:00) — recovery required."
          : "Waiting for 18:00 / 23:00 window.",
    });
  }

  // 2b. Past Missed Collection Uploads Check (Last 5 Workdays)
  const missedDates: string[] = [];
  for (let offset = 1; offset <= 5; offset++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - offset);
    const dIso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const dDow = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Casablanca",
      weekday: "short",
    }).format(d);
    if (dDow === "Sun" || dIso === todayIso) continue;
    const dayRows = await prisma.paymentLedger.findMany({
      where: {
        paymentDate: {
          gte: new Date(`${dIso}T00:00:00.000Z`),
          lte: new Date(`${dIso}T23:59:59.999Z`),
        },
      },
      select: { morningBalance: true, eveningBalance: true },
    });
    const mCount = dayRows.filter((r) => r.morningBalance !== null).length;
    const eCount = dayRows.filter((r) => r.eveningBalance !== null).length;
    if (mCount > 0 && eCount === 0) {
      missedDates.push(dIso);
    }
  }
  results.push({
    task: "Past Collection Uploads (5d)",
    schedule: "Mon-Sat Backfill Check",
    status: missedDates.length === 0 ? "ON_TIME" : "OVERDUE",
    metric: missedDates.length === 0 ? "0 missed days (5d)" : `Missed: ${missedDates.join(", ")}`,
    detail:
      missedDates.length === 0
        ? "All recent workdays have completed evening collection uploads."
        : `Missing evening uploads for [${missedDates.join(", ")}] — run sync-transactions-recovery.ts from /finances/transactions.`,
  });

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
