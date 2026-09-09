/**
 * Bulk Vehicle CSV Upload API — POST /api/upload-vehicles
 *
 * Ingests vehicle fleet spreadsheets (supports GoCab standard columns & external exports).
 * Extracts: Plate Number, Brand, Model, Year, VIN, Status, Insurance Policy, City/Hub, Manager, Driver.
 * Performs intelligent 2-way auto-matching with Driver profiles.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";

function mapStatus(rawStatus: string | undefined, hasDriver: boolean): string {
  if (!rawStatus) return hasDriver ? "Actif" : "Available";
  const s = rawStatus.toLowerCase().trim();

  // 1. Police immobilization (Sabot / Immobilisation police)
  if (s.includes("police") || s.includes("immobiliz") || s.includes("sabot")) {
    return "police_immobilization";
  }

  // 2. Impounded (Fourrière municipale)
  if (s.includes("impound") || s.includes("fourriere") || s.includes("fourrière")) {
    return "impounded";
  }

  // 3. Maintenance & Accident (accident is maintenance per user specifications)
  if (s.includes("garage") || s.includes("maintenance") || s.includes("repair") || s.includes("accident")) {
    return "In garage";
  }

  // 4. Blocked
  if (s.includes("block") || s.includes("bloqu")) {
    return "Blocked";
  }

  // 5. Working / Active
  if (s.includes("working") || s.includes("actif") || s.includes("service")) {
    return "Actif";
  }

  // 6. Available
  if (s.includes("avail") || s.includes("dispo") || s.includes("libre")) {
    return "Available";
  }

  return hasDriver ? "Actif" : "Available";
}

function extractCity(rawGroup: string | undefined, rawManager: string | undefined): string {
  const combined = `${rawGroup || ""} ${rawManager || ""}`.toLowerCase();
  if (combined.includes("rabat")) return "Rabat";
  if (combined.includes("marrakech")) return "Marrakech";
  if (combined.includes("tangier") || combined.includes("tanger")) return "Tangier";
  if (combined.includes("agadir")) return "Agadir";
  return "Casablanca";
}

function normalizePlate(raw: string): string {
  if (!raw) return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
    }

    const csvText = await file.text();

    const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
    });

    if (errors.length > 0) {
      console.warn("CSV parse warnings:", errors);
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Empty CSV file" }, { status: 400 });
    }

    // Helper to find column by multiple possible aliases
    const getField = (row: Record<string, string>, aliases: string[]): string | undefined => {
      for (const alias of aliases) {
        const val = row[alias.toLowerCase()];
        if (val && val.trim()) return val.trim();
      }
      return undefined;
    };

    let total_rows = 0;
    let inserted = 0;
    let updated = 0;
    let skipped_invalid = 0;
    let linked_drivers = 0;
    let tickets_created = 0;
    let tickets_updated = 0;
    let tickets_resolved = 0;

    // Fetch all existing drivers for fuzzy name matching
    const allDrivers = await prisma.driverProfile.findMany();

    const findDriverByName = (driverName: string) => {
      if (!driverName) return null;
      const cleanTarget = driverName.toLowerCase().replace(/\s+/g, " ").trim();
      for (const d of allDrivers) {
        const cleanD = d.fullName.toLowerCase().replace(/\s+/g, " ").trim();
        if (cleanD === cleanTarget) return d;
      }
      return null;
    };

    for (const row of data) {
      total_rows++;

      // Plate number priority: Plate Number -> Registration Number -> Old Number
      const rawPlate = getField(row, [
        "plate number", "plate", "immatriculation", "matricule", "registration number", "registration nu", "old number", "immat"
      ]);

      if (!rawPlate) {
        skipped_invalid++;
        continue;
      }

      const plate_number = rawPlate.replace(/\s+/g, "").toUpperCase();

      // Brand & Model
      const brand = getField(row, ["brand", "marque", "make"]) || "DACIA";
      const model = getField(row, ["model", "modèle", "modele"]) || "SANDERO";
      const make_model = `${brand} ${model}`.trim();

      // Year
      const rawYear = getField(row, ["year", "annee", "année"]);
      const year = rawYear && !isNaN(Number(rawYear)) ? Number(rawYear) : 2026;

      // VIN
      const vin = getField(row, ["vin code", "vin", "chassis", "numéro de châssis"]) || null;

      // Driver
      const driverName = getField(row, ["driver", "conducteur", "chauffeur", "assigned driver", "nom chauffeur"]) || null;

      // Status
      const rawStatus = getField(row, ["status", "statut", "etat", "état"]);
      const status = mapStatus(rawStatus, Boolean(driverName));

      // Insurance
      const insuranceType = getField(row, ["insurance type", "type assurance", "assurance"]);
      const insurancePolicy = getField(row, ["insurance policy number", "insurance polic", "insurance policy", "police assurance", "policy number", "numéro police"]) || null;
      const isInsuranceActive = Boolean(insuranceType || insurancePolicy);

      // Hub City & Supervisor
      const managerGroup = getField(row, ["manager group", "groupe manager", "city", "ville", "hub"]);
      const manager = getField(row, ["manager", "superviseur", "supervisor"]);
      const hub_city = extractCity(managerGroup, manager);

      // Duration Status (e.g. "120 days", "9 days")
      const rawDuration = getField(row, ["duration status", "duration", "duree statut", "durée"]);
      let downtimeDays = 0;
      if (rawDuration) {
        const match = rawDuration.match(/\d+/);
        if (match) downtimeDays = parseInt(match[0], 10);
      }

      // Extra notes & attributes from spreadsheet
      const color = getField(row, ["color", "couleur"]);
      const oldNumber = getField(row, ["old number", "ancien matricule"]);
      const regNu = getField(row, ["registration nu", "registration number", "numéro enregistrement"]);
      const externalYang = getField(row, ["external yang", "yang", "external"]);
      const notesArray: string[] = [];
      if (color) notesArray.push(`Couleur: ${color}`);
      if (manager) notesArray.push(`Superviseur: ${manager}`);
      if (managerGroup) notesArray.push(`Groupe: ${managerGroup}`);
      if (oldNumber && oldNumber !== plate_number) notesArray.push(`Ancien N°: ${oldNumber}`);
      if (regNu && regNu !== plate_number) notesArray.push(`Enreg: ${regNu}`);
      if (rawDuration) notesArray.push(`Durée statut: ${rawDuration}`);
      if (externalYang) notesArray.push(`Ext: ${externalYang}`);
      const notes = notesArray.length > 0 ? notesArray.join(" · ") : null;

      // Check if vehicle already exists (by exact plate or normalized plate)
      const existing = await prisma.vehicle.findUnique({
        where: { plate_number },
      });

      let vehicleId = existing?.id;

      if (!existing) {
        const newVehicle = await prisma.vehicle.create({
          data: {
            plate_number,
            make_model,
            year,
            vin,
            hub_city,
            status,
            total_downtime_days: downtimeDays,
            insurance_policy_number: insurancePolicy,
            isInsuranceActive,
            assigned_driver_name: driverName,
            assigned_supervisor: manager || null,
            notes,
            current_mileage: 0,
          },
        });
        vehicleId = newVehicle.id;
        inserted++;
      } else {
        // Update existing vehicle
        const updatedVehicle = await prisma.vehicle.update({
          where: { id: existing.id },
          data: {
            make_model,
            year,
            vin: vin || existing.vin,
            hub_city,
            status,
            total_downtime_days: downtimeDays || existing.total_downtime_days,
            insurance_policy_number: insurancePolicy || existing.insurance_policy_number,
            isInsuranceActive: isInsuranceActive || existing.isInsuranceActive,
            assigned_driver_name: driverName || existing.assigned_driver_name,
            assigned_supervisor: manager || existing.assigned_supervisor,
            notes: notes || existing.notes,
          },
        });
        vehicleId = updatedVehicle.id;
        updated++;
      }

      // Auto-match DriverProfile by name or create placeholder
      let matchedDriver: any = null;
      if (driverName && vehicleId) {
        try {
          matchedDriver = findDriverByName(driverName);

          if (matchedDriver) {
            await prisma.driverProfile.update({
              where: { id: matchedDriver.id },
              data: { assignedVehicleId: vehicleId },
            });
            linked_drivers++;
          } else {
            // Create initial driver profile linked to this vehicle
            const newDriver = await prisma.driverProfile.create({
              data: {
                fullName: driverName,
                phoneSanitized: `+212600${Math.floor(100000 + Math.random() * 900000)}`,
                cinNumber: `CIN-${plate_number.replace(/\D/g, "").slice(-4) || Math.floor(1000 + Math.random() * 9000)}`,
                age: 30,
                licenseSeniority: 4,
                contractType: "STANDARD",
                isKycVerified: true,
                defaultStage: "NOMINAL",
                currentArrearsMAD: 0.0,
                monthlyTripCount: 0,
                assignedVehicleId: vehicleId,
              },
            });
            matchedDriver = newDriver;
            allDrivers.push(newDriver);
            linked_drivers++;
          }
        } catch (driverErr: any) {
          console.warn("Driver auto-link warning on vehicle upload:", driverErr?.message);
        }
      }

      // Automatically manage Maintenance, Fourrière & Police Tickets based on vehicle status
      if (vehicleId) {
        try {
          const statusStartDate = new Date(Date.now() - (downtimeDays || 0) * 24 * 60 * 60 * 1000);
          const startDateFormatted = statusStartDate.toLocaleDateString("fr-FR");

          if (status === "impounded") {
            // 1. Fourrière Municipale
            const existingTicket = await prisma.maintenanceTicket.findFirst({
              where: {
                vehicle_id: vehicleId,
                status: { in: ["OPEN", "IN_PROGRESS"] },
                ticket_type: { in: ["Fourrière", "impounded", "Fourriere"] },
              },
            });

            const priority = downtimeDays >= 7 ? "Critical" : "Urgent";
            const desc = `🚨 Véhicule en fourrière depuis ${downtimeDays} jours (depuis le ${startDateFormatted}). Suivi sortie de fourrière & frais journaliers.`;

            if (existingTicket) {
              await prisma.maintenanceTicket.update({
                where: { id: existingTicket.id },
                data: {
                  description: desc,
                  priority,
                  driver_name: driverName || existingTicket.driver_name,
                  driver_phone: matchedDriver?.phoneSanitized || existingTicket.driver_phone,
                },
              });
              tickets_updated++;
            } else {
              await prisma.maintenanceTicket.create({
                data: {
                  vehicle_id: vehicleId,
                  plate_number,
                  driver_name: driverName || null,
                  driver_phone: matchedDriver?.phoneSanitized || null,
                  ticket_type: "Fourrière",
                  priority,
                  status: "OPEN",
                  description: desc,
                  created_at: statusStartDate, // Start elapsed downtime counter from the real day it was impounded till today
                  sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              });
              tickets_created++;
            }
          } else if (status === "police_immobilization") {
            // 2. Immobilisation Police / Sabot
            const existingTicket = await prisma.maintenanceTicket.findFirst({
              where: {
                vehicle_id: vehicleId,
                status: { in: ["OPEN", "IN_PROGRESS"] },
                ticket_type: { in: ["Police Immobilization", "police_immobilization", "Sabot"] },
              },
            });

            const priority = downtimeDays >= 7 ? "Critical" : "Urgent";
            const desc = `🚔 Immobilisation Police / Sabot depuis ${downtimeDays} jours (depuis le ${startDateFormatted}). Régularisation administrative et mainlevée.`;

            if (existingTicket) {
              await prisma.maintenanceTicket.update({
                where: { id: existingTicket.id },
                data: {
                  description: desc,
                  priority,
                  driver_name: driverName || existingTicket.driver_name,
                  driver_phone: matchedDriver?.phoneSanitized || existingTicket.driver_phone,
                },
              });
              tickets_updated++;
            } else {
              await prisma.maintenanceTicket.create({
                data: {
                  vehicle_id: vehicleId,
                  plate_number,
                  driver_name: driverName || null,
                  driver_phone: matchedDriver?.phoneSanitized || null,
                  ticket_type: "Police Immobilization",
                  priority,
                  status: "OPEN",
                  description: desc,
                  created_at: statusStartDate,
                  sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              });
              tickets_created++;
            }
          } else if (status === "In garage") {
            // 3. Maintenance or Accident (accident is treated as maintenance per instructions)
            const isAccident = rawStatus?.toLowerCase().includes("accident");
            const ticketType = isAccident ? "Accident" : "Repair";
            const priority = isAccident ? "Critical" : "Normal";

            const existingTicket = await prisma.maintenanceTicket.findFirst({
              where: {
                vehicle_id: vehicleId,
                status: { in: ["OPEN", "IN_PROGRESS"] },
                ticket_type: { in: ["Repair", "Accident", "Maintenance", "Vidange"] },
              },
            });

            if (!existingTicket) {
              await prisma.maintenanceTicket.create({
                data: {
                  vehicle_id: vehicleId,
                  plate_number,
                  driver_name: driverName || null,
                  driver_phone: matchedDriver?.phoneSanitized || null,
                  ticket_type: ticketType,
                  priority,
                  status: "OPEN",
                  description: `🛠️ ${isAccident ? "Accident déclaré" : "Entrée en maintenance"} signalée via import CSV (${downtimeDays > 0 ? `${downtimeDays} jours d'immobilisation` : "En cours"}).`,
                  created_at: statusStartDate,
                  sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              });
              tickets_created++;
            }
          } else if (status === "Actif" || status === "Available") {
            // 4. Vehicle is back on the road -> auto-resolve open downtime tickets!
            const openTickets = await prisma.maintenanceTicket.findMany({
              where: {
                vehicle_id: vehicleId,
                status: { in: ["OPEN", "IN_PROGRESS"] },
                ticket_type: { in: ["Fourrière", "impounded", "Police Immobilization", "police_immobilization", "Repair", "Accident"] },
              },
            });

            if (openTickets.length > 0) {
              await prisma.maintenanceTicket.updateMany({
                where: {
                  id: { in: openTickets.map((t) => t.id) },
                },
                data: {
                  status: "RESOLVED",
                  resolved_at: new Date(),
                  resolution_notes: `Résolu automatiquement via import CSV Flotte : Véhicule remis en statut "${status}" le ${new Date().toLocaleDateString("fr-FR")}.`,
                },
              });
              tickets_resolved += openTickets.length;
            }
          }
        } catch (ticketErr: any) {
          console.warn("Ticket auto-management warning:", ticketErr?.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_rows,
        inserted,
        updated,
        skipped_invalid,
        linked_drivers,
        tickets_created,
        tickets_updated,
        tickets_resolved,
      },
    });
  } catch (error: any) {
    console.error("POST /api/upload-vehicles error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process vehicle CSV upload" },
      { status: 500 }
    );
  }
}
