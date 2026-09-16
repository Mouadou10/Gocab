import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { processVehicleSideEffects } from "@/lib/services/vehicleService";
import { logAudit } from "@/lib/services/auditLogger";

/**
 * GET /api/vehicles/[id]
 * Fetches vehicle details, vidange history (counts of simple & complète, dates),
 * saved Bons de Commande, and Attestations de Location.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        driverProfile: true,
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    // Fetch all maintenance tickets for this vehicle
    const tickets = await prisma.maintenanceTicket.findMany({
      where: {
        OR: [
          { vehicle_id: id },
          { plate_number: vehicle.plate_number },
        ],
      },
      orderBy: { created_at: "desc" },
    });

    // Parse vidanges and bons de commande
    const vidanges: any[] = [];
    let simpleCount = 0;
    let completeCount = 0;
    const bonsDeCommande: any[] = [];

    for (const t of tickets) {
      let parsedBc: any = null;
      if (t.resolution_notes) {
        try {
          const parsed = JSON.parse(t.resolution_notes);
          if (parsed && parsed.bon_de_commande) {
            parsedBc = parsed.bon_de_commande;
            bonsDeCommande.push({
              ticket_id: t.id,
              ticket_type: t.ticket_type,
              status: t.status,
              created_at: t.created_at,
              bc: parsedBc,
            });
          }
        } catch {
          // not JSON
        }
      }

      // Check if ticket is a Vidange or has vidange items in its BC
      const isVidangeTicket = t.ticket_type === "Vidange";
      let hasVidangeBcItem = false;
      let vidangeItemType: "Vidange Complète" | "Vidange Simple" | null = null;

      if (parsedBc && Array.isArray(parsedBc.items)) {
        for (const item of parsedBc.items) {
          const des = (item.designation || "").toLowerCase();
          if (des.includes("vidange")) {
            hasVidangeBcItem = true;
            if (des.includes("complète") || des.includes("complete")) {
              vidangeItemType = "Vidange Complète";
            } else {
              vidangeItemType = "Vidange Simple";
            }
          }
        }
      }

      if (isVidangeTicket || hasVidangeBcItem) {
        let typeStr: "Vidange Complète" | "Vidange Simple" = "Vidange Simple";
        if (vidangeItemType) {
          typeStr = vidangeItemType;
        } else {
          const desc = (t.description || "").toLowerCase();
          if (desc.includes("complète") || desc.includes("complete") || (t.repair_cost && t.repair_cost >= 900)) {
            typeStr = "Vidange Complète";
          }
        }

        if (typeStr === "Vidange Complète") {
          completeCount++;
        } else {
          simpleCount++;
        }

        vidanges.push({
          ticket_id: t.id,
          date: t.created_at,
          resolved_at: t.resolved_at,
          status: t.status,
          type: typeStr,
          cost: t.repair_cost || (typeStr === "Vidange Complète" ? 960 : 510),
          garage: t.garage_name || parsedBc?.supplier_name || "Hard Auto Services",
          bc_number: parsedBc?.bc_number || null,
          bc_data: parsedBc,
          description: t.description,
        });
      }
    }

    // Fetch inspections / attestations for this vehicle
    const inspections = await prisma.vehicleInspection.findMany({
      where: {
        OR: [
          { vehicle_id: id },
          { plate_number: vehicle.plate_number },
        ],
      },
      orderBy: { inspection_date: "desc" },
    });

    const attestations = inspections.map((insp) => ({
      id: insp.id,
      date: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(insp.inspection_date)),
      raw_date: insp.inspection_date,
      inspector: insp.inspector_name,
      mileage: insp.current_mileage,
      health_score: insp.health_score,
      attestationData: {
        fullName: vehicle.assigned_driver_name || vehicle.driverProfile?.fullName || "",
        cin: vehicle.driverProfile?.cinNumber || "",
        brand: vehicle.make_model,
        immat: vehicle.plate_number,
        chassisNumber: vehicle.vin || "",
        date: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(insp.inspection_date)),
        inspectionId: insp.id,
      },
    }));

    return NextResponse.json({
      vehicle,
      vidangeStats: {
        total: vidanges.length,
        simpleCount,
        completeCount,
        history: vidanges,
      },
      bonsDeCommande,
      attestations,
    });
  } catch (error) {
    console.error("GET /api/vehicles/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch vehicle details" }, { status: 500 });
  }
}

/**
 * PATCH /api/vehicles/[id]
 * Updates vehicle metadata, mileage, status, and compliance dates.
 * Automations:
 *  - Accident status → auto-creates AccidentClaim
 *  - Mileage update ≥8,000 KM delta → auto-creates Urgent Vidange ticket
 *  - Actif→Available + driver unlinked → logs ChurnEvent (contract termination)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Snapshot vehicle state BEFORE update for churn detection
    const prevVehicle = await prisma.vehicle.findUnique({ where: { id } });
    const updateData: any = {};

    if (body.plate_number !== undefined) updateData.plate_number = body.plate_number.trim();
    if (body.make_model !== undefined) updateData.make_model = body.make_model.trim();
    if (body.year !== undefined) updateData.year = Number(body.year);
    if (body.vin !== undefined) updateData.vin = body.vin ? body.vin.trim() : null;
    if (body.current_mileage !== undefined) updateData.current_mileage = Number(body.current_mileage);
    if (body.hub_city !== undefined) updateData.hub_city = body.hub_city.trim();
    if (body.status !== undefined) updateData.status = body.status;

    if (body.insurance_expiry_date !== undefined) {
      updateData.insurance_expiry_date = body.insurance_expiry_date ? new Date(body.insurance_expiry_date) : null;
    }
    if (body.insurance_policy_number !== undefined) {
      updateData.insurance_policy_number = body.insurance_policy_number ? body.insurance_policy_number.trim() : null;
    }
    if (body.vignette_expiry_date !== undefined) {
      updateData.vignette_expiry_date = body.vignette_expiry_date ? new Date(body.vignette_expiry_date) : null;
    }
    if (body.autorisation_expiry_date !== undefined) {
      updateData.autorisation_expiry_date = body.autorisation_expiry_date ? new Date(body.autorisation_expiry_date) : null;
    }
    if (body.technical_inspection_expiry !== undefined) {
      updateData.technical_inspection_expiry = body.technical_inspection_expiry ? new Date(body.technical_inspection_expiry) : null;
    }

    if (body.assigned_driver_name !== undefined) updateData.assigned_driver_name = body.assigned_driver_name;
    if (body.assigned_driver_phone !== undefined) updateData.assigned_driver_phone = body.assigned_driver_phone;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.assigned_driver_id !== undefined) {
      if (body.assigned_driver_id) {
        // Link the driver profile to this vehicle
        await prisma.driverProfile.update({
          where: { id: body.assigned_driver_id },
          data: { assignedVehicleId: id }
        });
        
        // Fetch driver info to update denormalized fields on vehicle
        const driver = await prisma.driverProfile.findUnique({ where: { id: body.assigned_driver_id } });
        if (driver) {
          updateData.assigned_driver_name = driver.fullName;
          updateData.assigned_driver_phone = driver.phoneSanitized;
        }
      } else {
        // Unlink the driver
        const currentDriver = await prisma.driverProfile.findUnique({ where: { assignedVehicleId: id }});
        if (currentDriver) {
           await prisma.driverProfile.update({
             where: { id: currentDriver.id },
             data: { assignedVehicleId: null }
           });
        }
        updateData.assigned_driver_name = null;
        updateData.assigned_driver_phone = null;
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
    });

    const userId = session?.user?.name || session?.user?.email || session?.user?.id || "agent";
    
    // Process Side-effects defensively
    try {
      await processVehicleSideEffects(id, body, prevVehicle, vehicle, userId);
    } catch (sideEffectErr) {
      console.error("Error processing vehicle side-effects:", sideEffectErr);
    }
    
    // Log the update defensively
    try {
      await logAudit({
        userId,
        action: "UPDATE",
        entityType: "Vehicle",
        entityId: vehicle.id,
        changes: updateData,
      });
    } catch (auditErr) {
      console.error("Error logging vehicle update audit:", auditErr);
    }

    return NextResponse.json({ vehicle });

  } catch (error) {
    console.error("PATCH /api/vehicles/[id] error:", error);
    const authResp = (() => { try { return handleAuthError(error); } catch { return null; } })();
    if (authResp) return authResp;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update vehicle" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vehicles/[id]
 * Soft deletes a vehicle and unlinks assigned driver.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Wrap in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Unlink any DriverProfile assigned to this vehicle
      await tx.driverProfile.updateMany({
        where: { assignedVehicleId: id },
        data: { assignedVehicleId: null },
      });

      // 2. Soft delete the vehicle itself
      await tx.vehicle.update({
        where: { id },
        data: { 
          is_archived: true, 
          assigned_driver_name: null,
          assigned_driver_phone: null,
          status: "Archived"
        },
      });
      
      // Log audit
      try {
        await logAudit({
          userId: session?.user?.name || session?.user?.email || session?.user?.id || "agent",
          action: "ARCHIVE",
          entityType: "Vehicle",
          entityId: id,
          changes: { status: "Archived", unlinked_driver: true },
        });
      } catch (auditErr) {
        console.error("Error logging delete audit:", auditErr);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/vehicles/[id] error:", error);
    const authResp = (() => { try { return handleAuthError(error); } catch { return null; } })();
    if (authResp) return authResp;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete vehicle. It may have related records that could not be removed." },
      { status: 500 }
    );
  }
}
