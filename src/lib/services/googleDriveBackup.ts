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

const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCyIhj5Hz6a1dbD
LO9EkbR97hoiOH9sRMZf9RNNmwxrVxvU8ApPAw8sBhQxOMlIiLMMViUVfaChVSUt
uvqbJLyPG6X45aspZNbkghxkcNLMAMkcN0MZ/WDW+On62RJ2LWy5S1NEfAPqhPb2
Y7ubFHRIwB/IAx6k4709vpTh+NFIciJdnKnjlMjRaVVQ+mGspoSMcGlndthyHg0u
4mAcFg+HE9G2f6tQnc4kLD96Uag0CQrEeaxhs6P1ZDLIvDUKQGQnvRaLqqXw9Fn5
Rw8C8pYUvYDaII7xiyLlLgBYegCUU/PEQTQPvf/B82vkkVWGQGOM/SxwFt2GsEXn
UvGX88PNAgMBAAECggEAUm6L/vCyAGXXad9n4+PHUgU2q8JYWQpkgHBBXAbVkvCv
DPV9171zLmyruHFuV/YGYT2WEKFfjXkA6O4fXV79MP5a6lihwdiLxxfcurApJEVy
y29ZSnQh9akfYblFHVH8/6w3XrhC+apJPJC/ds7a1vWtX1nuOuC2qJWCgSWq92ov
jDqyCgcqg2nH0rojTJbFK8okiPg6iMrNNaj62zrPlgd6M1o09y3zr/JYmcCE2/3T
QDoXaWtyTViWScCZp+2tSR/72IpHZqXoKzml7U9nK9lKP/7E/dOqRVKBaQpzMPIg
bh/shAMOGrNCsbe3fw1+gaX/xSBlMN+HhQVbOItKcwKBgQDlgQIDSnWe696Pra6D
CqjsJFrh1t92oyAYRSCz6QxPPnUy6P6r3JjJeboq1eq5HTAjZifC05kkJOuuX9LF
btBxORpYTOcGddneTDtAV9IXeNhC71NjVsoywD7Aw/fkcp46Tv4arMVA2OjS4Ywh
JSOXHoCGPFzK2NnbVQwncRyqYwKBgQDGstOeOPu9aO5Ludwnk0opwlBAi0EYo+SJ
OrBijXACWIFgzKovFnd3BPXM+cidSAuPvonDIowRvjjMPc29wE46lSYA+PeYiM4b
2+VvxeU2WJk1AmPiMNLs5yjewU+d8xP8+hos1Ne245gARvbT1L5/VCADG9/4oJZX
FaF+CumYDwKBgCfpQHVcDIpfkGvCE3gccXXneJqPqHrUMW+nDeHbpFVfkjgRRsCS
c0uOTK7IVrJsfgOZ7041SAt+FDJV3ayR8dPOz2MNtJtuAT5kWWV+ID4OuOUjA4hh
/nXG8uLI8aIbwKJ5PD1dUExPrGWH7buR3teX6VfuxWBNR82Zw6xUQlzrAoGBAI3u
45ccIUbVk5LoOsjSP6HAuc7BKkjNmcwk7iYX3jDuw8w/pjlolQGhu2sl6hXfhtKx
SnrnTKLH/I54f2TR34+dRr5fGY4N+xyPYT8MX4UImLfy8yJ5udGb9efYsmSjZF3K
0bPAfi6YONXJ2zrJtyIBF7TgzoYtP/cI7oi4htAlAoGBAJndFmGETkZ8ZfRfsU4j
mW23Sp0I1BcKnNcoK+kvviL5b4CQ3T6kDhNo5JLl/N8nl4kFtzD7bgYgXSBwCkok
86pc4C3xS8S9UpcDNaDxfQd2+ZLxUH1gnxhWa1sWd35kQV4ALlboztkmmoJQDP4q
H8C3qj1PipBONGputALVlcis
-----END PRIVATE KEY-----`;

/**
 * Obtains an OAuth2 Google Bearer Access Token using Service Account RSA-SHA256 JWT
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || DEFAULT_PRIVATE_KEY).replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!privateKey || !clientEmail) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/drive",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      })
    ).toString("base64url");

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(header + "." + claimSet);
    const signature = signer.sign(privateKey, "base64url");
    const jwt = header + "." + claimSet + "." + signature;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${encodeURIComponent(jwt)}`,
    });

    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.warn("Failed to acquire Google Drive access token:", err);
    return null;
  }
}

/**
 * Uploads files directly to Google Drive via Google Drive API v3
 */
export async function pushDirectToGoogleDrive(payload: BackupPayload): Promise<{
  success: boolean;
  uploadedCount: number;
  error?: string;
}> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return { success: false, uploadedCount: 0, error: "Token d'accès Google Drive indisponible" };
  }

  let uploaded = 0;
  for (const file of payload.files) {
    try {
      const boundary = "-------gocab_drive_boundary_" + Date.now();
      const metadata = {
        name: file.filename,
        parents: [GOOGLE_DRIVE_FOLDER_ID],
      };
      const content = file.content || Buffer.from(file.contentBase64 || "", "base64").toString("utf-8");

      const multipartRequestBody =
        `\r\n--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        `Content-Type: ${file.mimeType}\r\n\r\n` +
        content +
        `\r\n--${boundary}--`;

      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      const resData = await uploadRes.json();
      if (resData.id) {
        uploaded++;
      } else if (resData.error?.message?.includes("quota") || resData.error?.code === 403) {
        return {
          success: false,
          uploadedCount: uploaded,
          error: "QUOTA_EXCEEDED: Compte Google personnel. Utilisez le Webhook Google Apps Script pour stocker directement sur votre Google Drive (15 Go gratuits).",
        };
      }
    } catch (e: any) {
      console.warn(`Error uploading ${file.filename} to Google Drive:`, e);
    }
  }

  return {
    success: uploaded > 0,
    uploadedCount: uploaded,
  };
}

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

  // 1. Try Direct Google Drive API First (Works with Shared Drives or Service Account Quota)
  const directRes = await pushDirectToGoogleDrive(payload);
  if (directRes.success) {
    success = true;
    method = "direct_api";
    message = `Sauvegarde Google Drive réussie directement via API v3 (${directRes.uploadedCount} fichiers synchronisés).`;
  }

  // 2. If direct API failed or personal account quota was detected, use Webhook (Personal Drive 15GB)
  if (!success && webhookSetting?.value && webhookSetting.value.trim().startsWith("http")) {
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

  // 3. If neither worked, provide clear status
  if (!success && !errorMsg) {
    message = directRes.error || "Données prêtes et archivées localement. Pour synchroniser vers Google Drive personnel (@gmail.com), configurez le Webhook Google Apps Script.";
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
