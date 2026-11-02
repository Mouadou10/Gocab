import { NextRequest, NextResponse } from "next/server";
import { getGoogleAccessToken } from "@/lib/services/googleDriveBackup";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: any) {
  try {
    const params = await context.params;
    const fileId = params.id;

    if (!fileId) {
      return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
    }

    const token = await getGoogleAccessToken();
    if (token) {
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (driveRes.ok) {
        const contentType = driveRes.headers.get("content-type") || "application/octet-stream";
        const buffer = await driveRes.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      }
    }

    // Fallback: Redirect to Google Drive public viewer
    return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${fileId}`, 307);
  } catch (error: any) {
    console.error("GET /api/drive/media/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch file from Google Drive" }, { status: 500 });
  }
}
