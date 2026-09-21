/**
 * Bulk Vehicle CSV Upload API — POST /api/upload-vehicles
 *
 * Ingests vehicle fleet spreadsheets (supports GoCab standard columns & external exports).
 * Extracts: Plate Number, Brand, Model, Year, VIN, Status, Insurance Policy, City/Hub, Manager, Driver.
 * Performs intelligent 2-way auto-matching with Driver profiles, Support tickets, and Accident claims.
 * Highly optimized with pre-fetched in-memory indexing and chunked concurrent writes to prevent timeouts.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import Papa from "papaparse";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s execution on Vercel for bulk imports

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

  // 3. Maintenance & Accident
  if (s.includes("accident") || s.includes("maintenance") || s.includes("garage") || s.includes("repair") || s.includes("panne")) {
    return "Accident";
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

function cleanPlateInput(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();
  if (clean.includes("/")) clean = clean.split("/")[0].trim();
  if (clean.includes(",")) clean = clean.split(",")[0].trim();
  return clean.replace(/\s+/g, "").toUpperCase();
}

const PLATE_ALIASES = [
  "plate number",
  "plate",
  "immatriculation",
  "matricule",
  "registration number",
  "registration nu",
  "registration",
  "old number",
  "immat",
  "vehicles",
  "vehicle",
  "vehicule",
  "vehicules",
  "voiture",
  "voitures",
  "car",
  "cars",
  "auto",
  "plaque",
  "plaque d'immatriculation",
  "n° immatriculation",
  "numéro immatriculation",
  "matricule véhicule",
  "matricule voiture",
  "code véhicule",
  "license plate",
  "plaque immat",
  "matricule auto",
];

const DRIVER_ALIASES = [
  "driver",
  "driver name",
  "conducteur",
  "chauffeur",
  "assigned driver",
  "nom chauffeur",
  "nom",
  "full name",
  "fullname",
  "nom complet",
  "name",
  "nom du chauffeur",
  "conducteur assigné",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier CSV fourni." }, { status: 400 });
    }

    let csvText = await file.text();
    // Strip BOM if present
    csvText = csvText.replace(/^\uFEFF/, "");

    const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""),
    });

    if (errors.length > 0) {
      console.warn("CSV parse warnings:", errors);
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Le fichier CSV est vide." }, { status: 400 });
    }

    // Helper to find column by multiple aliases
    const getField = (row: Record<string, string>, aliases: string[]): string | undefined => {
      for (const alias of aliases) {
        const val = row[alias.toLowerCase()];
        if (val && val.trim()) return val.trim();
      }
      return undefined;
    };

    // 1. Pre-fetch all existing vehicles in 1 query
    const allExistingVehicles = await prisma.vehicle.findMany();
    const vehicleByPlate = new Map<string, typeof allExistingVehicles[0]>();
    const vehicleByNorm = new Map<string, typeof allExistingVehicles[0]>();

    for (const v of allExistingVehicles) {
      if (v.plate_number) {
        vehicleByPlate.set(v.plate_number.toUpperCase().trim(), v);
        vehicleByNorm.set(normalizePlate(v.plate_number), v);
      }
    }

    // 2. Pre-fetch all existing drivers in 1 query
    const allDrivers = await prisma.driverProfile.findMany();
    const driverByName = new Map<string, typeof allDrivers[0]>();
    for (const d of allDrivers) {
      const clean = d.fullName.toLowerCase().replace(/\s+/g, " ").trim();
      driverByName.set(clean, d);
    }

    // 3. Pre-fetch all open maintenance tickets in 1 query
    const allOpenTickets = await prisma.maintenanceTicket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
    const openTicketsByVehicleId = new Map<string, typeof allOpenTickets>();
    for (const t of allOpenTickets) {
      if (t.vehicle_id) {
        const list = openTicketsByVehicleId.get(t.vehicle_id) || [];
        list.push(t);
        openTicketsByVehicleId.set(t.vehicle_id, list);
      }
    }

    // 4. Pre-fetch all active accident claims in 1 query
    const allActiveClaims = await prisma.accidentClaim.findMany({
      where: { timeline_step: { not: "VEHICLE_BACK" } },
    });
    const activeClaimsByVehicleId = new Map<string, typeof allActiveClaims[0]>();
    for (const c of allActiveClaims) {
      if (c.vehicle_id) {
        activeClaimsByVehicleId.set(c.vehicle_id, c);
      }
    }

    let total_rows = 0;
    let inserted = 0;
    let updated = 0;
    let skipped_invalid = 0;
    let linked_drivers = 0;
    let tickets_created = 0;
    let tickets_updated = 0;
    let tickets_resolved = 0;

    // Filter valid rows and parse them
    interface ParsedRow {
      plate_number: string;
      normPlate: string;
      make_model: string;
      year: number;
      vin: string | null;
      driverName: string | null;
      status: string;
      insurancePolicy: string | null;
      isInsuranceActive: boolean;
      hub_city: string;
      manager: string | null;
      downtimeDays: number;
      notes: string | null;
    }

    const validRows: ParsedRow[] = [];

    for (const row of data) {
      total_rows++;
      const rawPlate = getField(row, PLATE_ALIASES);
      if (!rawPlate) {
        skipped_invalid++;
        continue;
      }

      const plate_number = cleanPlateInput(rawPlate);
      const normPlate = normalizePlate(plate_number);

      if (!plate_number || normPlate.length < 3) {
        skipped_invalid++;
        continue;
      }

      const brand = getField(row, ["brand", "marque", "make"]) || "DACIA";
      const model = getField(row, ["model", "modèle", "modele"]) || "SANDERO";
      const make_model = `${brand} ${model}`.trim();

      const rawYear = getField(row, ["year", "annee", "année"]);
      const year = rawYear && !isNaN(Number(rawYear)) ? Number(rawYear) : 2026;

      const vin = getField(row, ["vin code", "vin", "chassis", "numéro de châssis"]) || null;
      const driverName = getField(row, DRIVER_ALIASES) || null;

      const rawStatus = getField(row, ["status", "statut", "etat", "état"]);
      const status = mapStatus(rawStatus, Boolean(driverName));

      const insuranceType = getField(row, ["insurance type", "type assurance", "assurance"]);
      const insurancePolicy = getField(row, ["insurance policy number", "insurance polic", "insurance policy", "police assurance", "policy number", "numéro police"]) || null;
      const isInsuranceActive = Boolean(insuranceType || insurancePolicy);

      const managerGroup = getField(row, ["manager group", "groupe manager", "city", "ville", "hub"]);
      const manager = getField(row, ["manager", "superviseur", "supervisor"]) || null;
      const hub_city = extractCity(managerGroup, manager || undefined);

      const rawDuration = getField(row, ["duration status", "duration", "duree statut", "durée"]);
      let downtimeDays = 0;
      if (rawDuration) {
        const match = rawDuration.match(/\d+/);
        if (match) downtimeDays = parseInt(match[0], 10);
      }

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

      validRows.push({
        plate_number,
        normPlate,
        make_model,
        year,
        vin,
        driverName,
        status,
        insurancePolicy,
        isInsuranceActive,
        hub_city,
        manager,
        downtimeDays,
        notes,
      });
    }

    if (total_rows > 0 && validRows.length === 0) {
      const detectedColumns = Object.keys(data[0] || {}).join(", ");
      return NextResponse.json(
        {
          error: `Aucune colonne d'immatriculation reconnue sur ${total_rows} lignes. Colonnes détectées dans le fichier: [${detectedColumns}]. Vérifiez que le fichier contient une colonne comme "Plate Number", "Immatriculation", "Matricule", ou "Vehicles".`,
          summary: {
            total_rows,
            inserted: 0,
            updated: 0,
            skipped_invalid: total_rows,
            linked_drivers: 0,
            tickets_created: 0,
            tickets_updated: 0,
            tickets_resolved: 0,
          },
        },
        { status: 400 }
      );
    }

    // Process valid rows in concurrent batches of 8 for optimal network throughput to Turso
    const BATCH_SIZE = 8;
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const chunk = validRows.slice(i, i + BATCH_SIZE);

      await Promise.all(
        chunk.map(async (item) => {
          try {
            const existing = vehicleByPlate.get(item.plate_number) || vehicleByNorm.get(item.normPlate);
            let vehicleId: string;

            if (!existing) {
              const newVehicle = await prisma.vehicle.create({
                data: {
                  plate_number: item.plate_number,
                  make_model: item.make_model,
                  year: item.year,
                  vin: item.vin,
                  hub_city: item.hub_city,
                  status: item.status,
                  total_downtime_days: item.downtimeDays,
                  insurance_policy_number: item.insurancePolicy,
                  isInsuranceActive: item.isInsuranceActive,
                  assigned_driver_name: item.driverName,
                  assigned_supervisor: item.manager,
                  notes: item.notes,
                  current_mileage: 0,
                },
              });
              vehicleId = newVehicle.id;
              vehicleByPlate.set(item.plate_number, newVehicle);
              vehicleByNorm.set(item.normPlate, newVehicle);
              inserted++;
            } else {
              const updatedVehicle = await prisma.vehicle.update({
                where: { id: existing.id },
                data: {
                  make_model: item.make_model,
                  year: item.year,
                  vin: item.vin || existing.vin,
                  hub_city: item.hub_city,
                  status: item.status,
                  total_downtime_days: item.downtimeDays || existing.total_downtime_days,
                  insurance_policy_number: item.insurancePolicy || existing.insurance_policy_number,
                  isInsuranceActive: item.isInsuranceActive || existing.isInsuranceActive,
                  assigned_driver_name: item.driverName || existing.assigned_driver_name,
                  assigned_supervisor: item.manager || existing.assigned_supervisor,
                  notes: item.notes || existing.notes,
                },
              });
              vehicleId = updatedVehicle.id;
              updated++;
            }

            // Driver profile auto-link
            let matchedDriver: any = null;
            if (item.driverName && vehicleId) {
              const cleanTarget = item.driverName.toLowerCase().replace(/\s+/g, " ").trim();
              matchedDriver = driverByName.get(cleanTarget);

              if (matchedDriver) {
                if (matchedDriver.assignedVehicleId !== vehicleId) {
                  await prisma.driverProfile.update({
                    where: { id: matchedDriver.id },
                    data: { assignedVehicleId: vehicleId },
                  }).catch(() => {});
                  matchedDriver.assignedVehicleId = vehicleId;
                }
                linked_drivers++;
              } else {
                try {
                  const newDriver = await prisma.driverProfile.create({
                    data: {
                      fullName: item.driverName,
                      phoneSanitized: `+212600${Math.floor(100000 + Math.random() * 900000)}`,
                      cinNumber: `CIN-${item.plate_number.replace(/\D/g, "").slice(-4) || Math.floor(1000 + Math.random() * 9000)}`,
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
                  driverByName.set(cleanTarget, newDriver);
                  linked_drivers++;
                } catch (e) {
                  // Ignore duplicate key if concurrently inserted
                }
              }
            }

            // Status-driven Ticket & Claim synchronization
            const statusStartDate = new Date(Date.now() - (item.downtimeDays || 0) * 24 * 60 * 60 * 1000);
            const startDateFormatted = statusStartDate.toLocaleDateString("fr-FR");

            if (item.status === "impounded") {
              const openTickets = openTicketsByVehicleId.get(vehicleId) || [];
              const existingTicket = openTickets.find((t) =>
                ["Fourrière", "impounded", "Fourriere"].includes(t.ticket_type)
              );

              const priority = item.downtimeDays >= 7 ? "Critical" : "Urgent";
              const desc = `🚨 Véhicule en fourrière depuis ${item.downtimeDays} jours (depuis le ${startDateFormatted}). Suivi sortie de fourrière & frais journaliers.`;

              if (existingTicket) {
                await prisma.maintenanceTicket.update({
                  where: { id: existingTicket.id },
                  data: {
                    description: desc,
                    priority,
                    driver_name: item.driverName || existingTicket.driver_name,
                    driver_phone: matchedDriver?.phoneSanitized || existingTicket.driver_phone,
                  },
                }).catch(() => {});
                tickets_updated++;
              } else {
                const newTicket = await prisma.maintenanceTicket.create({
                  data: {
                    vehicle_id: vehicleId,
                    plate_number: item.plate_number,
                    driver_name: item.driverName || null,
                    driver_phone: matchedDriver?.phoneSanitized || null,
                    ticket_type: "Fourrière",
                    priority,
                    status: "OPEN",
                    description: desc,
                    created_at: statusStartDate,
                    sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  },
                }).catch(() => null);

                if (newTicket) {
                  openTickets.push(newTicket);
                  openTicketsByVehicleId.set(vehicleId, openTickets);
                  tickets_created++;
                }
              }
            } else if (item.status === "police_immobilization") {
              const openTickets = openTicketsByVehicleId.get(vehicleId) || [];
              const existingTicket = openTickets.find((t) =>
                ["Police Immobilization", "police_immobilization", "Sabot"].includes(t.ticket_type)
              );

              const priority = item.downtimeDays >= 7 ? "Critical" : "Urgent";
              const desc = `🚔 Immobilisation Police / Sabot depuis ${item.downtimeDays} jours (depuis le ${startDateFormatted}). Régularisation administrative et mainlevée.`;

              if (existingTicket) {
                await prisma.maintenanceTicket.update({
                  where: { id: existingTicket.id },
                  data: {
                    description: desc,
                    priority,
                    driver_name: item.driverName || existingTicket.driver_name,
                    driver_phone: matchedDriver?.phoneSanitized || existingTicket.driver_phone,
                  },
                }).catch(() => {});
                tickets_updated++;
              } else {
                const newTicket = await prisma.maintenanceTicket.create({
                  data: {
                    vehicle_id: vehicleId,
                    plate_number: item.plate_number,
                    driver_name: item.driverName || null,
                    driver_phone: matchedDriver?.phoneSanitized || null,
                    ticket_type: "Police Immobilization",
                    priority,
                    status: "OPEN",
                    description: desc,
                    created_at: statusStartDate,
                    sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  },
                }).catch(() => null);

                if (newTicket) {
                  openTickets.push(newTicket);
                  openTicketsByVehicleId.set(vehicleId, openTickets);
                  tickets_created++;
                }
              }
            } else if (item.status === "Accident" || item.status === "In garage") {
              const openTickets = openTicketsByVehicleId.get(vehicleId) || [];
              const existingTicket = openTickets[0];
              const priority = item.downtimeDays >= 7 ? "Critical" : "Urgent";
              const desc = `💥 Véhicule en maintenance / accident signalé via import CSV (${item.downtimeDays > 0 ? `${item.downtimeDays} jours d'immobilisation` : "En cours"}).`;

              if (!existingTicket) {
                const newTicket = await prisma.maintenanceTicket.create({
                  data: {
                    vehicle_id: vehicleId,
                    plate_number: item.plate_number,
                    driver_name: item.driverName || matchedDriver?.fullName || null,
                    driver_phone: matchedDriver?.phoneSanitized || null,
                    ticket_type: "Accident",
                    priority,
                    status: "IN_PROGRESS",
                    started_at: statusStartDate,
                    description: desc,
                    created_at: statusStartDate,
                    sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  },
                }).catch(() => null);

                if (newTicket) {
                  openTickets.push(newTicket);
                  openTicketsByVehicleId.set(vehicleId, openTickets);
                  tickets_created++;
                }
              }

              const existingClaim = activeClaimsByVehicleId.get(vehicleId);
              if (!existingClaim) {
                const newClaim = await prisma.accidentClaim.create({
                  data: {
                    vehicle_id: vehicleId,
                    driver_id: matchedDriver?.id || null,
                    driver_name: item.driverName || matchedDriver?.fullName || null,
                    driver_phone: matchedDriver?.phoneSanitized || null,
                    severity: "HARD",
                    fault: null,
                    timeline_step: "CAR_IN_GARAGE",
                    step_updated_at: statusStartDate,
                    created_at: statusStartDate,
                    comments: JSON.stringify([
                      {
                        id: crypto.randomUUID(),
                        timeline_step: "CAR_IN_GARAGE",
                        comment: `Dossier créé automatiquement via import Flotte CSV (${item.downtimeDays > 0 ? `${item.downtimeDays} jours d'immobilisation` : "En cours"}).`,
                        author: "Import Flotte",
                        created_at: statusStartDate.toISOString(),
                      },
                    ]),
                  },
                }).catch(() => null);

                if (newClaim) {
                  activeClaimsByVehicleId.set(vehicleId, newClaim);
                }
              }
            } else if (item.status === "Actif" || item.status === "Available") {
              const openTickets = openTicketsByVehicleId.get(vehicleId) || [];
              if (openTickets.length > 0) {
                await prisma.maintenanceTicket.updateMany({
                  where: { id: { in: openTickets.map((t) => t.id) } },
                  data: {
                    status: "RESOLVED",
                    resolved_at: new Date(),
                    resolution_notes: `Résolu automatiquement via import CSV Flotte : Véhicule remis en statut "${item.status}" le ${new Date().toLocaleDateString("fr-FR")}.`,
                  },
                }).catch(() => {});
                tickets_resolved += openTickets.length;
                openTicketsByVehicleId.delete(vehicleId);
              }

              if (activeClaimsByVehicleId.has(vehicleId)) {
                await prisma.accidentClaim.updateMany({
                  where: {
                    vehicle_id: vehicleId,
                    timeline_step: { not: "VEHICLE_BACK" },
                  },
                  data: {
                    timeline_step: "VEHICLE_BACK",
                    step_updated_at: new Date(),
                  },
                }).catch(() => {});
                activeClaimsByVehicleId.delete(vehicleId);
              }
            }
          } catch (rowErr: any) {
            console.warn(`Error processing vehicle row ${item.plate_number}:`, rowErr?.message || rowErr);
          }
        })
      );
    }

    // Trigger sync state update
    void touchSyncState("all");

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
      { error: error?.message || "Échec du traitement du fichier CSV de la flotte." },
      { status: 500 }
    );
  }
}
