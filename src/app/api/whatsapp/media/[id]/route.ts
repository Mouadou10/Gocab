import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppApiConfig } from "@/lib/services/whatsappApiService";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import os from "os";

// Directory for caching downloaded media
const CACHE_DIR = path.join(os.tmpdir(), "gocab-whatsapp-media");

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch (_) {}
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Media ID manquant" }, { status: 400 });
    }

    ensureCacheDir();

    // 1. Check local cache first
    const possibleExts = [".jpg", ".png", ".webp", ".jpeg", ".bin"];
    for (const ext of possibleExts) {
      const cachedFile = path.join(CACHE_DIR, `${id}${ext}`);
      const metaFile = path.join(CACHE_DIR, `${id}.meta.json`);
      if (fs.existsSync(cachedFile)) {
        try {
          const buffer = fs.readFileSync(cachedFile);
          let mimeType = "image/jpeg";
          if (fs.existsSync(metaFile)) {
            const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
            if (meta.mime_type) mimeType = meta.mime_type;
          }
          return new NextResponse(buffer, {
            headers: {
              "Content-Type": mimeType,
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            },
          });
        } catch (_) {}
      }
    }

    // 2. Also check if the ID corresponds to a WhatsAppMessage ID in DB that has a media_url
    try {
      const dbMsg = await (prisma as any).whatsAppMessage?.findUnique({
        where: { id },
      });
      if (dbMsg?.media_url && dbMsg.media_url !== `/api/whatsapp/media/${id}`) {
        return NextResponse.redirect(new URL(dbMsg.media_url, request.url));
      }
    } catch (_) {}

    // 3. Fetch from WhatsApp Provider API
    const config = await getWhatsAppApiConfig();

    if (config.provider === "360dialog" && config.d360ApiKey) {
      const d360Base = config.d360ApiUrl.replace(/\/$/, "");
      
      // Step A: Request media metadata
      const metaRes = await fetch(`${d360Base}/${id}`, {
        headers: {
          "D360-API-KEY": config.d360ApiKey,
        },
      });

      if (!metaRes.ok) {
        console.warn(`360dialog get media metadata failed for ID ${id}:`, metaRes.status);
        return generatePlaceholderSvg("Photo indisponible", id);
      }

      const metaData = await metaRes.json().catch(() => null);
      if (!metaData || !metaData.url) {
        return generatePlaceholderSvg("Lien média introuvable", id);
      }

      const mimeType = metaData.mime_type || "image/jpeg";

      // Step B: Download binary through 360dialog proxy
      // Replace https://lookaside.fbsbx.com with 360dialog base URL
      const proxyDownloadUrl = metaData.url.startsWith("https://lookaside.fbsbx.com")
        ? metaData.url.replace("https://lookaside.fbsbx.com", d360Base)
        : metaData.url;

      const binRes = await fetch(proxyDownloadUrl, {
        headers: {
          "D360-API-KEY": config.d360ApiKey,
        },
      });

      if (!binRes.ok) {
        console.warn(`360dialog media binary download failed for ID ${id}:`, binRes.status);
        return generatePlaceholderSvg("Téléchargement média échoué", id);
      }

      const arrayBuffer = await binRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Cache file locally
      try {
        const ext = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
        fs.writeFileSync(path.join(CACHE_DIR, `${id}${ext}`), buffer);
        fs.writeFileSync(
          path.join(CACHE_DIR, `${id}.meta.json`),
          JSON.stringify({ mime_type: mimeType, downloaded_at: new Date().toISOString() })
        );
      } catch (cacheErr) {
        console.warn("Failed to write media cache:", cacheErr);
      }

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    } else if (config.accessToken) {
      // Direct Meta Graph API
      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${id}`, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      });

      if (!metaRes.ok) {
        return generatePlaceholderSvg("Photo indisponible", id);
      }

      const metaData = await metaRes.json().catch(() => null);
      if (!metaData?.url) {
        return generatePlaceholderSvg("Lien média introuvable", id);
      }

      const binRes = await fetch(metaData.url, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      });

      if (!binRes.ok) {
        return generatePlaceholderSvg("Téléchargement média échoué", id);
      }

      const arrayBuffer = await binRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = metaData.mime_type || "image/jpeg";

      try {
        const ext = mimeType.includes("png") ? ".png" : ".jpg";
        fs.writeFileSync(path.join(CACHE_DIR, `${id}${ext}`), buffer);
      } catch (_) {}

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }

    return generatePlaceholderSvg("Service média non configuré", id);
  } catch (err: any) {
    console.error("GET /api/whatsapp/media/[id] error:", err);
    return generatePlaceholderSvg("Erreur de chargement", "err");
  }
}

function generatePlaceholderSvg(label: string, id: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
    <rect width="100%" height="100%" fill="#f1f5f9"/>
    <circle cx="150" cy="80" r="30" fill="#cbd5e1"/>
    <path d="M135 75 L145 65 L155 75 L165 65" stroke="#94a3b8" stroke-width="3" fill="none"/>
    <text x="150" y="130" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" fill="#64748b" text-anchor="middle">📷 ${label}</text>
    <text x="150" y="150" font-family="monospace" font-size="10" fill="#94a3b8" text-anchor="middle">ID: ${id.slice(0, 16)}</text>
  </svg>`;
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60",
    },
  });
}
