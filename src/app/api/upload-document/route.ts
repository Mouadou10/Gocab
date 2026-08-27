import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";

export async function POST(request: Request) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type"); // e.g., 'license', 'carte_grise', 'insurance'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Since we don't have AWS S3 or Vercel Blob keys configured,
    // we will simulate an upload and return a mock URL.
    // In production, you would use:
    // import { put } from '@vercel/blob';
    // const blob = await put(file.name, file, { access: 'public' });
    
    // MOCK DELAY
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const mockUrl = `https://mock-cloud-storage.com/${type}/${file.name.replace(/\s+/g, '_')}`;

    return NextResponse.json({ url: mockUrl, success: true });
  } catch (error) {
    console.error("Document upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
