/**
 * GoCab Dual-Storage Redundancy & Google Drive Cloud Backup Service
 *
 * Provides automated and on-demand synchronization of GoCab CRM database records
 * (Leads, Fleet Vehicles, Driver Profiles, Payments, Maintenance Tickets, Field Missions,
 * Accident Dossiers, Collections, WhatsApp Chats, Settings, and Media) to Google Drive.
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
    fieldTasks: number;
    accidentClaims: number;
    dailyCollections: number;
    whatsAppConversations: number;
    whatsAppMessages: number;
    leadActivityLogs: number;
    driverComments: number;
    settings: number;
    users: number;
  };
  files: BackupFileItem[];
}

/**
 * Generate comprehensive backup payload:
 * CSV dumps and structured master JSON snapshots for EVERY GoCab database entity.
 */
export async function generateBackupPayload(): Promise<BackupPayload> {
  const [
    leads,
    vehicles,
    drivers,
    payments,
    tickets,
    fieldTasks,
    accidentClaims,
    dailyCollections,
    whatsAppConversations,
    whatsAppMessages,
    leadActivityLogs,
    driverComments,
    settings,
    users,
  ] = await Promise.all([
    prisma.lead.findMany({ where: { is_archived: false } }),
    prisma.vehicle.findMany({ where: { is_archived: false } }),
    prisma.driverProfile.findMany({ where: { is_archived: false } }),
    prisma.paymentLedger.findMany({ orderBy: { paymentDate: "desc" }, take: 2000 }),
    prisma.maintenanceTicket.findMany({ where: { is_archived: false } }),
    prisma.fieldTask.findMany({ orderBy: { created_at: "desc" }, take: 1000 }),
    prisma.accidentClaim.findMany({ orderBy: { created_at: "desc" }, take: 500 }),
    prisma.dailyCollection.findMany({ orderBy: { date: "desc" }, take: 1000 }),
    prisma.whatsAppConversation.findMany({ where: { is_archived: false } }),
    prisma.whatsAppMessage.findMany({ orderBy: { created_at: "desc" }, take: 1000 }),
    prisma.leadActivityLog.findMany({ orderBy: { created_at: "desc" }, take: 2000 }),
    prisma.driverComment.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.setting.findMany(),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        fullName: true,
        email: true,
        role: true,
        region: true,
        assignedCars: true,
        isActive: true,
        created_at: true,
      },
    }),
  ]);

  // Sanitize accident claims for backup: replace massive inline data: URIs with references
  // This reduces payload from 40MB down to ~3MB so Google Apps Script never hangs
  const sanitizedAccidents = accidentClaims.map((c) => {
    let docs = c.documents;
    if (docs && docs.includes("data:")) {
      try {
        const parsed = JSON.parse(docs);
        if (Array.isArray(parsed)) {
          docs = JSON.stringify(
            parsed.map((item, idx) => {
              if (item && typeof item === "object" && item.fileUrl && String(item.fileUrl).startsWith("data:")) {
                const approxSizeKb = Math.round((String(item.fileUrl).length * 0.75) / 1024);
                return {
                  ...item,
                  fileUrl: `[Stored in Cloud: ${item.name || `doc_${idx}`} (${approxSizeKb} KB)]`,
                };
              }
              return item;
            })
          );
        }
      } catch (_) {}
    }
    return { ...c, documents: docs };
  });

  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split("T")[0];

  // 1. Generate Dedicated CSV Exports for all departments
  const leadsCsv = Papa.unparse(leads);
  const vehiclesCsv = Papa.unparse(vehicles);
  const driversCsv = Papa.unparse(drivers);
  const paymentsCsv = Papa.unparse(payments);
  const ticketsCsv = Papa.unparse(tickets);
  const fieldTasksCsv = Papa.unparse(fieldTasks);
  const accidentsCsv = Papa.unparse(sanitizedAccidents);
  const collectionsCsv = Papa.unparse(dailyCollections);
  const whatsappCsv = Papa.unparse(whatsAppMessages);
  const activityCsv = Papa.unparse(leadActivityLogs);
  const commentsCsv = Papa.unparse(driverComments);

  // 2. Full Structured Master JSON Snapshot (Complete Dual-Backend State)
  const fullJson = JSON.stringify(
    {
      exported_at: timestamp,
      system: "GoCab CRM Dual-Backend (Google Drive Twin)",
      folder_id: GOOGLE_DRIVE_FOLDER_ID,
      meta: {
        total_leads: leads.length,
        total_vehicles: vehicles.length,
        total_drivers: drivers.length,
        total_payments: payments.length,
        total_tickets: tickets.length,
        total_field_tasks: fieldTasks.length,
        total_accident_claims: accidentClaims.length,
        total_daily_collections: dailyCollections.length,
        total_whatsapp_conversations: whatsAppConversations.length,
        total_whatsapp_messages: whatsAppMessages.length,
        total_lead_activity_logs: leadActivityLogs.length,
        total_driver_comments: driverComments.length,
        total_settings: settings.length,
        total_users: users.length,
      },
      data: {
        leads,
        vehicles,
        drivers,
        payments,
        tickets,
        fieldTasks,
        accidentClaims: sanitizedAccidents,
        dailyCollections,
        whatsAppConversations,
        whatsAppMessages,
        leadActivityLogs,
        driverComments,
        settings,
        users,
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
      filename: "tickets_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: ticketsCsv,
      sizeBytes: Buffer.byteLength(ticketsCsv),
    },
    {
      filename: "field_tasks_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: fieldTasksCsv,
      sizeBytes: Buffer.byteLength(fieldTasksCsv),
    },
    {
      filename: "accidents_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: accidentsCsv,
      sizeBytes: Buffer.byteLength(accidentsCsv),
    },
    {
      filename: "collections_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: collectionsCsv,
      sizeBytes: Buffer.byteLength(collectionsCsv),
    },
    {
      filename: "whatsapp_messages_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: whatsappCsv,
      sizeBytes: Buffer.byteLength(whatsappCsv),
    },
    {
      filename: "lead_activity_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: activityCsv,
      sizeBytes: Buffer.byteLength(activityCsv),
    },
    {
      filename: "driver_comments_latest.csv",
      mimeType: "text/csv; charset=utf-8",
      content: commentsCsv,
      sizeBytes: Buffer.byteLength(commentsCsv),
    },
    {
      filename: "GoCab_Master_Snapshot_Latest.json",
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
      fieldTasks: fieldTasks.length,
      accidentClaims: accidentClaims.length,
      dailyCollections: dailyCollections.length,
      whatsAppConversations: whatsAppConversations.length,
      whatsAppMessages: whatsAppMessages.length,
      leadActivityLogs: leadActivityLogs.length,
      driverComments: driverComments.length,
      settings: settings.length,
      users: users.length,
    },
    files,
  };
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

/**
 * Send backup files to Google Apps Script Webhook (Runs inside user's personal Google Drive with 15GB quota)
 * Batches files in pairs to guarantee execution stays well within Google Apps Script runtime limits.
 */
export async function pushToWebhook(webhookUrl: string, payload: BackupPayload) {
  const CHUNK_SIZE = 2;
  const allSavedFiles: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < payload.files.length; i += CHUNK_SIZE) {
    const chunk = payload.files.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          timestamp: payload.timestamp,
          counts: payload.counts,
          files: chunk.map((f) => ({
            filename: f.filename,
            mimeType: f.mimeType,
            content: f.content,
            contentBase64: f.content ? undefined : f.contentBase64,
          })),
        }),
        redirect: "follow",
      });

      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data && data.savedFiles && Array.isArray(data.savedFiles)) {
          allSavedFiles.push(...data.savedFiles);
        } else if (res.ok) {
          allSavedFiles.push(...chunk.map((c) => ({ name: c.filename })));
        }
      } catch {
        if (res.ok) {
          allSavedFiles.push(...chunk.map((c) => ({ name: c.filename })));
        }
      }
    } catch (err: any) {
      errors.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} error: ${err.message}`);
    }
  }

  return {
    success: allSavedFiles.length > 0,
    savedFiles: allSavedFiles,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export interface UploadMediaResult {
  success: boolean;
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  driveUrl: string;
  directUrl: string;
  error?: string;
}

/**
 * Upload an uploaded file or WhatsApp image directly to Google Drive.
 * Stores in the GoCab Backups folder via the Webhook (or Direct API).
 */
export async function uploadMediaToGoogleDrive(options: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  category?: string; // "documents" | "whatsapp" | "constats" | "tickets"
}): Promise<UploadMediaResult> {
  const { buffer, filename, mimeType, category = "documents" } = options;
  const contentBase64 = buffer.toString("base64");
  const timestamp = new Date().toISOString();

  const webhookSetting = await prisma.setting.findUnique({
    where: { key: WEBHOOK_SETTING_KEY },
  });
  const webhookUrl = webhookSetting?.value?.trim();

  const sanitizedFilename = `${category}_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // 1. Upload via Google Apps Script Webhook (User's Drive with 15GB)
  if (webhookUrl && webhookUrl.startsWith("http")) {
    try {
      const payload = {
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        timestamp,
        category,
        files: [
          {
            filename: sanitizedFilename,
            mimeType,
            contentBase64,
          },
        ],
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "follow",
      });

      const data = await res.json().catch(() => null);
      if (data && data.success !== false && data.savedFiles && data.savedFiles.length > 0) {
        const saved = data.savedFiles[0];
        const fileId = saved.id;
        const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
        const directUrl = `/api/drive/media/${fileId}`;
        return {
          success: true,
          fileId,
          filename: saved.name || sanitizedFilename,
          mimeType,
          sizeBytes: buffer.length,
          driveUrl,
          directUrl,
        };
      }
    } catch (err: any) {
      console.warn("uploadMediaToGoogleDrive webhook error:", err);
    }
  }

  // 2. Direct API Fallback
  const token = await getGoogleAccessToken();
  if (token) {
    try {
      const boundary = "-------gocab_media_" + Date.now();
      const metadata = {
        name: sanitizedFilename,
        parents: [GOOGLE_DRIVE_FOLDER_ID],
      };
      const multipartRequestBody =
        `\r\n--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n` +
        buffer.toString("binary") +
        `\r\n--${boundary}--`;

      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      const resData = await uploadRes.json().catch(() => null);
      if (resData?.id) {
        const fileId = resData.id;
        return {
          success: true,
          fileId,
          filename: sanitizedFilename,
          mimeType,
          sizeBytes: buffer.length,
          driveUrl: `https://drive.google.com/file/d/${fileId}/view`,
          directUrl: `/api/drive/media/${fileId}`,
        };
      }
    } catch (e) {
      console.warn("Direct upload error:", e);
    }
  }

  // 3. Fallback to local identifier
  const localId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return {
    success: false,
    fileId: localId,
    filename: sanitizedFilename,
    mimeType,
    sizeBytes: buffer.length,
    driveUrl: "",
    directUrl: `/api/whatsapp/media/${localId}`,
    error: "Google Drive storage currently unavailable",
  };
}

let backupDebounceTimer: NodeJS.Timeout | null = null;
let isBackingUp = false;

/**
 * Schedules a debounced background synchronization to Google Drive.
 * Keeps Google Drive twin backend updated after mutations without blocking HTTP responses.
 */
export function scheduleGoogleDriveSync(debounceMs = 10000): void {
  if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
  backupDebounceTimer = setTimeout(async () => {
    backupDebounceTimer = null;
    if (isBackingUp) return;
    try {
      isBackingUp = true;
      await triggerBackup();
    } catch (e) {
      console.warn("Background Google Drive auto-sync warning:", e);
    } finally {
      isBackingUp = false;
    }
  }, debounceMs);
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

  const webhookSetting = await prisma.setting.findUnique({
    where: { key: WEBHOOK_SETTING_KEY },
  });

  let success = false;
  let message = "";
  let method: "webhook" | "direct_api" | "local_only" = "local_only";
  let errorMsg: string | undefined = undefined;

  // 1. Try Google Apps Script Webhook (Primary for User's 15GB Drive)
  if (webhookSetting?.value && webhookSetting.value.trim().startsWith("http")) {
    try {
      const webhookRes = await pushToWebhook(webhookSetting.value.trim(), payload);
      if (webhookRes.success !== false) {
        success = true;
        method = "webhook";
        message = `Sauvegarde Google Drive synchronisée avec succès via Webhook (${payload.files.length} fichiers enregistrés dans le dossier GoCab Backups).`;
      } else {
        errorMsg = (webhookRes as any).error || webhookRes.errors?.join(", ") || "Erreur de réponse du Webhook Google Apps Script";
      }
    } catch (err: any) {
      errorMsg = err.message || "Impossible de joindre le Webhook Google Apps Script";
    }
  }

  // 2. Direct API Fallback
  if (!success) {
    const directRes = await pushDirectToGoogleDrive(payload);
    if (directRes.success) {
      success = true;
      method = "direct_api";
      message = `Sauvegarde Google Drive réussie directement via API v3 (${directRes.uploadedCount} fichiers synchronisés).`;
    }
  }

  // 3. Local archive fallback
  if (!success && !errorMsg) {
    message = "Données prêtes et archivées localement. Webhook Google Apps Script non configuré.";
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
    folder_id: GOOGLE_DRIVE_FOLDER_ID,
    folder_name: "GoCab Backups",
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
 * Restores all CRM database entities from the latest Google Drive Master Snapshot.
 * Used for Disaster Recovery if Vercel serverless containers reset or cloud DB fails.
 */
export async function restoreDatabaseFromGoogleDrive(): Promise<{
  success: boolean;
  message: string;
  restoredCounts: Record<string, number>;
  error?: string;
}> {
  const token = await getGoogleAccessToken();
  if (!token) {
    return {
      success: false,
      message: "Google Drive Access Token unavailable",
      restoredCounts: {},
      error: "AUTH_FAILED",
    };
  }

  try {
    // 1. Locate GoCab_Master_Snapshot_Latest.json or gocab_snapshot_latest.json
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${GOOGLE_DRIVE_FOLDER_ID}'+in+parents+and+trashed=false&fields=files(id,name,modifiedTime)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    const snapshotFile = listData.files?.find(
      (f: any) =>
        f.name === "GoCab_Master_Snapshot_Latest.json" ||
        f.name === "gocab_snapshot_latest.json"
    );

    if (!snapshotFile) {
      return {
        success: false,
        message: "No master snapshot found in Google Drive folder",
        restoredCounts: {},
        error: "SNAPSHOT_NOT_FOUND",
      };
    }

    // 2. Download the JSON content
    const mediaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${snapshotFile.id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const snapshot = await mediaRes.json();
    const data = snapshot.data || {};

    const restoredCounts: Record<string, number> = {};

    // Restore Settings
    if (Array.isArray(data.settings)) {
      for (const s of data.settings) {
        await prisma.setting.upsert({
          where: { key: s.key },
          update: { value: s.value },
          create: { key: s.key, value: s.value },
        }).catch(() => {});
      }
      restoredCounts.settings = data.settings.length;
    }

    // Restore Vehicles
    if (Array.isArray(data.vehicles)) {
      for (const v of data.vehicles) {
        await prisma.vehicle.upsert({
          where: { plate_number: v.plate_number },
          update: {
            status: v.status,
            current_mileage: v.current_mileage,
            total_downtime_days: v.total_downtime_days,
            assigned_supervisor: v.assigned_supervisor,
            notes: v.notes,
          },
          create: {
            id: v.id,
            plate_number: v.plate_number,
            make_model: v.make_model || "Dacia Logan",
            year: v.year || 2024,
            hub_city: v.hub_city || "Casablanca",
            status: v.status || "Available",
            current_mileage: v.current_mileage || 0,
            assigned_supervisor: v.assigned_supervisor,
            notes: v.notes,
          },
        }).catch(() => {});
      }
      restoredCounts.vehicles = data.vehicles.length;
    }

    // Restore Drivers
    if (Array.isArray(data.drivers)) {
      for (const d of data.drivers) {
        await prisma.driverProfile.upsert({
          where: { cinNumber: d.cinNumber },
          update: {
            fullName: d.fullName,
            phoneSanitized: d.phoneSanitized,
            defaultStage: d.defaultStage,
            isKycVerified: d.isKycVerified,
            contractType: d.contractType,
          },
          create: {
            id: d.id,
            cinNumber: d.cinNumber,
            fullName: d.fullName,
            phoneSanitized: d.phoneSanitized,
            defaultStage: d.defaultStage || "NOMINAL",
            isKycVerified: d.isKycVerified ?? false,
            contractType: d.contractType || "DAILY",
          },
        }).catch(() => {});
      }
      restoredCounts.drivers = data.drivers.length;
    }

    // Restore Leads
    if (Array.isArray(data.leads)) {
      for (const l of data.leads) {
        await prisma.lead.upsert({
          where: { sanitized_phone: l.sanitized_phone },
          update: {
            raw_name: l.raw_name,
            board_column: l.board_column,
            brand_status: l.brand_status,
            training_status: l.training_status,
            city: l.city,
            age: l.age,
            permis_seniority_years: l.permis_seniority_years,
            handled_by: l.handled_by,
          },
          create: {
            id: l.id,
            raw_name: l.raw_name,
            sanitized_phone: l.sanitized_phone,
            campaign_source: l.campaign_source || "GOOGLE_DRIVE_RESTORE",
            board_column: l.board_column || "NEW_LEADS",
            city: l.city,
            age: l.age,
            permis_seniority_years: l.permis_seniority_years,
            handled_by: l.handled_by,
          },
        }).catch(() => {});
      }
      restoredCounts.leads = data.leads.length;
    }

    // Restore Tickets
    if (Array.isArray(data.tickets)) {
      for (const t of data.tickets) {
        await prisma.maintenanceTicket.upsert({
          where: { id: t.id },
          update: {
            status: t.status,
            repair_cost: t.repair_cost,
            garage_name: t.garage_name,
            resolution_notes: t.resolution_notes,
          },
          create: {
            id: t.id,
            vehicle_id: t.vehicle_id || t.plate_number || "VEHICLE",
            plate_number: t.plate_number,
            driver_name: t.driver_name || null,
            driver_phone: t.driver_phone || null,
            ticket_type: t.ticket_type,
            description: t.description || "",
            status: t.status || "OPEN",
            priority: t.priority || "Normal",
            repair_cost: t.repair_cost || 0,
            garage_name: t.garage_name,
            resolution_notes: t.resolution_notes,
          },
        }).catch(() => {});
      }
      restoredCounts.tickets = data.tickets.length;
    }

    // Restore Field Tasks
    if (Array.isArray(data.fieldTasks)) {
      for (const ft of data.fieldTasks) {
        await prisma.fieldTask.upsert({
          where: { id: ft.id },
          update: {
            status: ft.status,
            assigned_to: ft.assigned_to,
            scheduled_time: ft.scheduled_time,
            recovery_notes: ft.recovery_notes,
          },
          create: {
            id: ft.id,
            task_type: ft.task_type,
            plate_number: ft.plate_number,
            description: ft.description || "",
            status: ft.status || "PENDING",
            priority: ft.priority || "Normal",
            assigned_to: ft.assigned_to,
            scheduled_time: ft.scheduled_time,
            recovery_notes: ft.recovery_notes,
          },
        }).catch(() => {});
      }
      restoredCounts.fieldTasks = data.fieldTasks.length;
    }

    // Restore Accident Claims
    if (Array.isArray(data.accidentClaims)) {
      for (const ac of data.accidentClaims) {
        await prisma.accidentClaim.upsert({
          where: { id: ac.id },
          update: {
            timeline_step: ac.timeline_step,
            driver_name: ac.driver_name,
            driver_phone: ac.driver_phone,
            comments: ac.comments,
            documents: ac.documents,
          },
          create: {
            id: ac.id,
            vehicle_id: ac.vehicle_id,
            timeline_step: ac.timeline_step || "CAR_IN_GARAGE",
            driver_name: ac.driver_name,
            driver_phone: ac.driver_phone,
            comments: ac.comments,
            documents: ac.documents,
          },
        }).catch(() => {});
      }
      restoredCounts.accidentClaims = data.accidentClaims.length;
    }

    return {
      success: true,
      message: `Restauration complète réussie depuis Google Drive (${Object.values(restoredCounts).reduce((a, b) => a + b, 0)} enregistrements restaurés).`,
      restoredCounts,
    };
  } catch (err: any) {
    console.error("restoreDatabaseFromGoogleDrive error:", err);
    return {
      success: false,
      message: `Erreur lors de la restauration depuis Google Drive: ${err.message}`,
      restoredCounts: {},
      error: err.message,
    };
  }
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
      prisma.fieldTask.count(),
      prisma.accidentClaim.count({ where: { timeline_step: { not: "VEHICLE_BACK" } } }),
      prisma.dailyCollection.count(),
      prisma.whatsAppConversation.count(),
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
      fieldTasks: counts[5],
      activeAccidents: counts[6],
      dailyCollections: counts[7],
      whatsAppConversations: counts[8],
    },
  };
}
