import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { uploadMediaToGoogleDrive } from "@/lib/services/googleDriveBackup";

export async function POST(request: Request) {
  try {
    await requireAuth().catch(() => null);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string) || "document"; // e.g., 'license', 'carte_grise', 'insurance', 'constat'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save directly to Google Drive (GoCab Backups folder)
    const driveRes = await uploadMediaToGoogleDrive({
      buffer,
      filename: file.name || `document_${Date.now()}`,
      mimeType: file.type || "application/octet-stream",
      category: type,
    });

    const finalUrl = driveRes.directUrl || driveRes.driveUrl || `/api/drive/media/${driveRes.fileId}`;

    return NextResponse.json({
      success: true,
      url: finalUrl,
      driveUrl: driveRes.driveUrl,
      fileId: driveRes.fileId,
      filename: driveRes.filename,
      sizeBytes: driveRes.sizeBytes,
    });
  } catch (error: any) {
    console.error("Document upload failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload document to Google Drive" },
      { status: 500 }
    );
  }
}
