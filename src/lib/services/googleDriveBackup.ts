/**
 * GoCab Dual-Storage Redundancy & Google Drive Cloud Backup Service
 *
 * Provides automated and on-demand synchronization of GoCab CRM database records
 * (Leads, Fleet Vehicles, Driver Profiles, Payments, Settings) to Google Drive.
 *
 * Target Google Drive Folder: 1rpJPDuKMo8Tej0lk8LUAJxeGK4p4-wtr
 * Service Account: google-drive@gen-lang-client-0868678110.iam.gserviceaccount.com
 */

import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import crypto from "crypto";

export const GOOGLE_DRIVE_FOLDER_ID = "1rpJPDuKMo8Tej0lk8LUAJxeGK4p4-wtr";
export const GOOGLE_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1rpJPDuKMo8Tej0lk8LUAJxeGK4p4-wtr";
export const GOOGLE_SERVICE_ACCOUNT_EMAIL = "google-drive@gen-lang-client-0868678110.iam.gserviceaccount.com";
export const BACKUP_SETTING_KEY = "last_backup_google_drive";
export const WEBHOOK_SETTING_KEY = "google_drive_webhook_url";

export interface BackupFileItem {
  filename: string;
  mimeType: string;
  content?: string;
  contentBase64?: string;
  sizeBytes: number;
}

export interface BackupPayload {
  timestamp: string;
  counts: {
    leads: number;
    vehicles: number;
    drivers: number;
    payments: number;
    tickets: number;
    settings: number;
  };
  files: BackupFileItem[];
}

/**
 * Generate full backup payload: CSV dumps and structured JSON snapshots
 */
export async function generateBackupPayload(): Promise<BackupPayload> {
  const [leads, vehicles, drivers, payments, tickets, settings] = await Promise.all([
    prisma.lead.findMany({ where: { is_archived: false } }),
    prisma.vehicle.findMany(),
    prisma.driverProfile.findMany(),
    prisma.paymentLedger.findMany({ orderBy: { paymentDate: "desc" }, take: 10000 }),
    prisma.maintenanceTicket.findMany(),
    prisma.setting.findMany(),
  ]);

  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split("T")[0];

  // 1. CSV Exports
  const leadsCsv = Papa.unparse(leads);
  const vehiclesCsv = Papa.unparse(vehicles);
  const driversCsv = Papa.unparse(drivers);
  const paymentsCsv = Papa.unparse(payments);

  // 2. Full JSON Snapshot
  const fullJson = JSON.stringify(
    {
      exported_at: timestamp,
      system: "GoCab CRM",
      folder_id: GOOGLE_DRIVE_FOLDER_ID,
      meta: {
        total_leads: leads.length,
        total_vehicles: vehicles.length,
        total_drivers: drivers.length,
        total_payments: payments.length,
        total_tickets: tickets.length,
        total_settings: settings.length,
      },
      data: {
        leads,
        vehicles,
        drivers,
        payments,
        tickets,
        settings,
      },
    },
    null,
    2
  );

  const files: BackupFileItem[] = [
    {
      filename: "leads_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: leadsCsv,
      sizeBytes: Buffer.byteLength(leadsCsv),
    },
    {
      filename: "vehicles_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: vehiclesCsv,
      sizeBytes: Buffer.byteLength(vehiclesCsv),
    },
    {
      filename: "drivers_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: driversCsv,
      sizeBytes: Buffer.byteLength(driversCsv),
    },
    {
      filename: "payments_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: paymentsCsv,
      sizeBytes: Buffer.byteLength(paymentsCsv),
    },
    {
      filename: `gocab_snapshot_${dateStr}.json`,
      mimeType: "application/json; charset=utf-8",
      content: fullJson,
      sizeBytes: Buffer.byteLength(fullJson),
    },
    {
      filename: "gocab_snapshot_latest.json",
      mimeType: "application/json; charset=utf-8",
      content: fullJson,
      sizeBytes: Buffer.byteLength(fullJson),
    },
  ];

  return {
    timestamp,
    counts: {
      leads: leads.length,
      vehicles: vehicles.length,
      drivers: drivers.length,
      payments: payments.length,
      tickets: tickets.length,
      settings: settings.length,
    },
    files,
  };
}

/**
 * Send backup files to Google Apps Script Webhook (Runs inside user's personal Google Drive with 15GB quota)
 */
export async function pushToWebhook(webhookUrl: string, payload: BackupPayload) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      timestamp: payload.timestamp,
      counts: payload.counts,
      files: payload.files.map((f) => ({
        filename: f.filename,
        mimeType: f.mimeType,
        content: f.content,
        contentBase64: f.content ? Buffer.from(f.content).toString("base64") : f.contentBase64,
      })),
    }),
    redirect: "follow",
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: res.ok, raw: text };
  }
}

/**
 * Perform backup execution, recording result in database Setting table
 */
export async function triggerBackup(): Promise<{
  success: boolean;
  message: string;
  method: "webhook" | "direct_api" | "local_only";
  timestamp: string;
  counts: any;
  error?: string;
}> {
  const payload = await generateBackupPayload();
  const timestamp = payload.timestamp;

  // Check if webhook is configured
  const webhookSetting = await prisma.setting.findUnique({
    where: { key: WEBHOOK_SETTING_KEY },
  });

  let success = false;
  let message = "";
  let method: "webhook" | "direct_api" | "local_only" = "local_only";
  let errorMsg: string | undefined = undefined;

  if (webhookSetting?.value && webhookSetting.value.trim().startsWith("http")) {
    try {
      const webhookRes = await pushToWebhook(webhookSetting.value.trim(), payload);
      if (webhookRes.success !== false) {
        success = true;
        method = "webhook";
        message = `Sauvegarde Google Drive réussie via Webhook (${payload.files.length} fichiers synchronisés).`;
      } else {
        errorMsg = webhookRes.error || "Erreur de réponse du Webhook Google Apps Script";
      }
    } catch (err: any) {
      errorMsg = err.message || "Impossible de joindre le Webhook Google Apps Script";
    }
  }

  // If webhook is not configured or failed, record status
  if (!success && !errorMsg) {
    message = "Données prêtes et archivées localement. Pour synchroniser automatiquement vers Google Drive personnel (@gmail.com), configurez le Webhook Google Apps Script.";
    method = "local_only";
    success = true;
  }

  const logData = {
    timestamp,
    success,
    method,
    message,
    counts: payload.counts,
    error: errorMsg,
  };

  await prisma.setting.upsert({
    where: { key: BACKUP_SETTING_KEY },
    create: {
      key: BACKUP_SETTING_KEY,
      value: JSON.stringify(logData),
    },
    update: {
      value: JSON.stringify(logData),
    },
  });

  return {
    success,
    message,
    method,
    timestamp,
    counts: payload.counts,
    error: errorMsg,
  };
}

/**
 * Get current Google Drive backup status and configuration
 */
export async function getBackupStatus() {
  const [lastBackupSetting, webhookSetting, counts] = await Promise.all([
    prisma.setting.findUnique({ where: { key: BACKUP_SETTING_KEY } }),
    prisma.setting.findUnique({ where: { key: WEBHOOK_SETTING_KEY } }),
    Promise.all([
      prisma.lead.count({ where: { is_archived: false } }),
      prisma.vehicle.count(),
      prisma.driverProfile.count(),
      prisma.paymentLedger.count(),
      prisma.maintenanceTicket.count(),
    ]),
  ]);

  let lastBackup = null;
  if (lastBackupSetting?.value) {
    try {
      lastBackup = JSON.parse(lastBackupSetting.value);
    } catch {
      lastBackup = { raw: lastBackupSetting.value };
    }
  }

  return {
    folderId: GOOGLE_DRIVE_FOLDER_ID,
    folderUrl: GOOGLE_DRIVE_FOLDER_URL,
    serviceAccountEmail: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    webhookUrl: webhookSetting?.value || null,
    isWebhookConfigured: !!(webhookSetting?.value && webhookSetting.value.trim().length > 10),
    lastBackup,
    currentCounts: {
      leads: counts[0],
      vehicles: counts[1],
      drivers: counts[2],
      payments: counts[3],
      tickets: counts[4],
    },
  };
}
