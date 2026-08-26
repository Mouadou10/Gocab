/**
 * Fleet Expenses & Financial Fees API — /api/expenses
 *
 * Handles recording, retrieving, and aggregating financial costs per vehicle:
 * Repairs, Police/Impound fees, Maintenance, Accidents, Towing, Parking, Tires, etc.
 * Supports 0 MAD amounts and driver rechargeability.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const EXPENSE_CATEGORIES = [
  { key: "REPAIR", label: "🔧 Réparation / Garage", group: "Maintenance & Réparations" },
  { key: "POLICE", label: "🚔 Fourrière / Amende Police", group: "Incidents & Infractions" },
  { key: "MAINTENANCE", label: "🛢️ Entretien Régulier (Vidange/Filtres)", group: "Maintenance & Réparations" },
  { key: "ACCIDENT", label: "💥 Sinistre / Carrosserie", group: "Incidents & Infractions" },
  { key: "TOWING", label: "🚛 Remorquage / Dépannage", group: "Assistance" },
  { key: "PARKING", label: "🅿️ Gardiennage / Stationnement", group: "Exploitation" },
  { key: "TIRES", label: "🛞 Pneumatiques", group: "Maintenance & Réparations" },
  { key: "ADMINISTRATIVE", label: "📄 Administratif / Vignette / Visite", group: "Réglementaire" },
  { key: "OTHER", label: "❓ Autre Frais", group: "Divers" },
] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicle_id = searchParams.get("vehicle_id");
    const plate_number = searchParams.get("plate_number");
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    const where: any = {};
    if (vehicle_id) where.vehicle_id = vehicle_id;
    if (plate_number) where.plate_number = { contains: plate_number.toUpperCase() };
    if (category && category !== "ALL") where.category = category;
    if (status && status !== "ALL") where.status = status;

    const expenses = await prisma.vehicleExpense.findMany({
      where,
      orderBy: { paid_at: "desc" },
      include: {
        vehicle: {
          select: {
            id: true,
            plate_number: true,
            make_model: true,
            status: true,
            assigned_driver_name: true,
          },
        },
      },
    });

    // Calculate aggregations
    const total_mad = expenses.reduce((sum, e) => sum + (e.amount_mad || 0), 0);
    const count = expenses.length;
    
    // Group totals by category
    const by_category: Record<string, { count: number; total_mad: number }> = {};
    for (const e of expenses) {
      if (!by_category[e.category]) {
        by_category[e.category] = { count: 0, total_mad: 0 };
      }
      by_category[e.category].count += 1;
      by_category[e.category].total_mad += e.amount_mad || 0;
    }

    return NextResponse.json({
      expenses,
      summary: {
        count,
        total_mad,
        by_category,
      },
    });
  } catch (error: any) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch vehicle expenses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const {
      vehicle_id,
      plate_number,
      category,
      amount_mad,
      description,
      invoice_number,
      paid_by,
      is_rechargeable,
      paid_at,
      status,
    } = body;

    if (!category) {
      return NextResponse.json({ error: "Catégorie de frais requise" }, { status: 400 });
    }

    // Resolve vehicle
    let targetVehicle = null;
    if (vehicle_id) {
      targetVehicle = await prisma.vehicle.findUnique({ where: { id: vehicle_id } });
    } else if (plate_number) {
      targetVehicle = await prisma.vehicle.findUnique({
        where: { plate_number: plate_number.toUpperCase().replace(/\s+/g, "") },
      });
    }

    if (!targetVehicle) {
      return NextResponse.json({ error: "Véhicule introuvable" }, { status: 404 });
    }

    const parsedAmount = typeof amount_mad === "number" ? amount_mad : parseFloat(amount_mad || "0");
    const finalAmount = isNaN(parsedAmount) || parsedAmount < 0 ? 0.0 : parsedAmount;

    const recorded_by = session?.user?.name || session?.user?.email || "Ops Manager";

    const newExpense = await prisma.vehicleExpense.create({
      data: {
        vehicle_id: targetVehicle.id,
        plate_number: targetVehicle.plate_number,
        category,
        amount_mad: finalAmount,
        description: description || null,
        invoice_number: invoice_number || null,
        paid_by: paid_by || "COMPANY",
        is_rechargeable: Boolean(is_rechargeable),
        paid_at: paid_at ? new Date(paid_at) : new Date(),
        recorded_by,
        status: status || "PAID",
      },
      include: {
        vehicle: true,
      },
    });

    // If rechargeable to driver and amount > 0, update driver arrears
    if (is_rechargeable && finalAmount > 0) {
      const driver = await prisma.driverProfile.findFirst({
        where: { assignedVehicleId: targetVehicle.id },
      });

      if (driver) {
        await prisma.driverProfile.update({
          where: { id: driver.id },
          data: {
            currentArrearsMAD: (driver.currentArrearsMAD || 0) + finalAmount,
          },
        });
      }
    }

    return NextResponse.json({ success: true, expense: newExpense });
  } catch (error: any) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create vehicle expense" },
      { status: 500 }
    );
  }
}
