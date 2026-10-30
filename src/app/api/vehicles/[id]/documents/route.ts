import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { logAudit } from "@/lib/services/auditLogger";
import { v4 as uuidv4 } from "uuid";
import { touchSyncState } from "@/lib/sync";

export interface VehicleDocument {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  category: "CARTE_GRISE" | "ASSURANCE" | "VISITE_TECHNIQUE" | "VIGNETTE" | "AUTORISATION" | "ATTESTATION" | "PHOTOS_VEHICULE" | "REPARATION" | "AUTRE";
  size?: number | null;
  author?: string | null;
  created_at: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: { id: true, plate_number: true, make_model: true, documents: true },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Véhicule introuvable" }, { status: 404 });
    }

    let docs: VehicleDocument[] = [];
    if (vehicle.documents) {
      try {
        const parsed = JSON.parse(vehicle.documents);
        if (Array.isArray(parsed)) docs = parsed;
      } catch {
        docs = [];
      }
    }

    return NextResponse.json({ documents: docs, vehicle: { id: vehicle.id, plate_number: vehicle.plate_number, make_model: vehicle.make_model } });
  } catch (error) {
    console.error("GET /api/vehicles/[id]/documents error:", error);
    return NextResponse.json({ error: "Erreur lors de la récupération des documents" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Véhicule introuvable" }, { status: 404 });
    }

    let existingDocs: VehicleDocument[] = [];
    if (vehicle.documents) {
      try {
        const parsed = JSON.parse(vehicle.documents);
        if (Array.isArray(parsed)) existingDocs = parsed;
      } catch {
        existingDocs = [];
      }
    }

    const authorName = session?.user?.name || session?.user?.email || "Agent GoCab";

    // Support single doc or multiple docs upload
    const docsToAdd: VehicleDocument[] = [];
    if (Array.isArray(body.documents)) {
      for (const item of body.documents) {
        if (!item.fileUrl || !item.name) continue;
        docsToAdd.push({
          id: item.id || uuidv4(),
          name: item.name,
          fileUrl: item.fileUrl,
          fileType: item.fileType || (item.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
          category: item.category || "AUTRE",
          size: item.size || null,
          author: item.author || authorName,
          created_at: item.created_at || new Date().toISOString(),
        });
      }
    } else if (body.fileUrl && body.name) {
      docsToAdd.push({
        id: body.id || uuidv4(),
        name: body.name,
        fileUrl: body.fileUrl,
        fileType: body.fileType || (body.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
        category: body.category || "AUTRE",
        size: body.size || null,
        author: body.author || authorName,
        created_at: body.created_at || new Date().toISOString(),
      });
    } else {
      return NextResponse.json({ error: "Aucun document fourni" }, { status: 400 });
    }

    const updatedDocs = [...existingDocs, ...docsToAdd];

    await prisma.vehicle.update({
      where: { id },
      data: {
        documents: JSON.stringify(updatedDocs),
      },
    });

    await logAudit({
      userId: session?.user?.email || "system",
      action: "UPDATE",
      entityType: "VehicleDocument",
      entityId: id,
      changes: {
        plate_number: vehicle.plate_number,
        addedCount: docsToAdd.length,
        addedFiles: docsToAdd.map((d) => ({ name: d.name, category: d.category })),
      },
    }).catch(() => {});

    await touchSyncState("all");

    return NextResponse.json({
      success: true,
      documents: updatedDocs,
      added: docsToAdd,
    });
  } catch (error) {
    console.error("POST /api/vehicles/[id]/documents error:", error);
    return NextResponse.json({ error: "Échec de l'enregistrement des documents" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json({ error: "ID du document requis" }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Véhicule introuvable" }, { status: 404 });
    }

    let existingDocs: VehicleDocument[] = [];
    if (vehicle.documents) {
      try {
        const parsed = JSON.parse(vehicle.documents);
        if (Array.isArray(parsed)) existingDocs = parsed;
      } catch {
        existingDocs = [];
      }
    }

    const deletedDoc = existingDocs.find((d) => d.id === documentId);
    const updatedDocs = existingDocs.filter((d) => d.id !== documentId);

    await prisma.vehicle.update({
      where: { id },
      data: {
        documents: JSON.stringify(updatedDocs),
      },
    });

    await logAudit({
      userId: session?.user?.email || "system",
      action: "DELETE",
      entityType: "VehicleDocument",
      entityId: id,
      changes: {
        plate_number: vehicle.plate_number,
        deletedDocumentId: documentId,
        deletedDocumentName: deletedDoc?.name,
      },
    }).catch(() => {});

    await touchSyncState("all");

    return NextResponse.json({
      success: true,
      documents: updatedDocs,
    });
  } catch (error) {
    console.error("DELETE /api/vehicles/[id]/documents error:", error);
    return NextResponse.json({ error: "Échec de la suppression du document" }, { status: 500 });
  }
}
