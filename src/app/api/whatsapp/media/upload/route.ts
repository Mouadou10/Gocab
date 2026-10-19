import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppApiConfig } from "@/lib/services/whatsappApiService";
import fs from "fs";
import path from "path";
import os from "os";

const CACHE_DIR = path.join(os.tmpdir(), "gocab-whatsapp-media");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch (_) {}
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureCacheDir();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const mimeType = file.type || "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Le fichier doit être une image (JPEG, PNG, WebP)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const config = await getWhatsAppApiConfig();
    let mediaId: string | null = null;

    // Upload to live 360dialog / Meta if configured
    if (config.isLiveConfigured && config.provider === "360dialog" && config.d360ApiKey) {
      try {
        const d360Base = config.d360ApiUrl.replace(/\/$/, "");
        const uploadForm = new FormData();
        const blob = new Blob([buffer], { type: mimeType });
        uploadForm.append("file", blob, file.name || "image.jpg");
        uploadForm.append("messaging_product", "whatsapp");
        uploadForm.append("type", mimeType);

        const res = await fetch(`${d360Base}/media`, {
          method: "POST",
          headers: {
            "D360-API-KEY": config.d360ApiKey,
          },
          body: uploadForm,
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.id) {
            mediaId = data.id;
          }
        } else {
          console.warn("360dialog media upload warning:", res.status, await res.text().catch(() => ""));
        }
      } catch (uploadErr) {
        console.error("360dialog upload error:", uploadErr);
      }
    }

    // Fallback to local media ID if live provider upload not available
    if (!mediaId) {
      mediaId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Cache the uploaded image locally so it can be served immediately
    try {
      const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
      fs.writeFileSync(path.join(CACHE_DIR, `${mediaId}${ext}`), buffer);
      fs.writeFileSync(
        path.join(CACHE_DIR, `${mediaId}.meta.json`),
        JSON.stringify({ mime_type: mimeType, original_name: file.name, uploaded_at: new Date().toISOString() })
      );
    } catch (e) {
      console.warn("Failed to cache uploaded media:", e);
    }

    return NextResponse.json({
      success: true,
      mediaId,
      mediaUrl: `/api/whatsapp/media/${mediaId}`,
      mimeType,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error: any) {
    console.error("POST /api/whatsapp/media/upload error:", error);
    return NextResponse.json(
      { error: error?.message || "Échec de téléversement de l'image" },
      { status: 500 }
    );
  }
}
