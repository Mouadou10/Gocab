/**
 * Bulk Vehicle CSV Upload API — POST /api/upload-vehicles
 *
 * Ingests vehicle fleet spreadsheets (supports GoCab standard columns & external exports).
 * Extracts: Plate Number, Brand, Model, Year, VIN, Status, Insurance Policy, City/Hub, Manager, Driver.
 * Performs intelligent 2-way auto-matching with Driver profiles, Support tickets, and Accident claims.
 * Highly optimized with pre-fetched in-memory indexing and chunked concurrent writes to prevent timeouts.
 */

import { Prisma } from "@prisma/client";
import { prisma, flushDatabaseSync } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";
import { parseSpreadsheetFile } from "@/lib/spreadsheet";
import { reconcileDriverVehicleAssignments } from "@/lib/services/driverVehicleReconciliation";
import { isMehdiPlate } from "@/lib/fleet-managers";
import { invalidateDriverCache } from "@/lib/driverCache";


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

  // 3. Accident
  if (s.includes("accident") || s.includes("sinistre")) {
    return "Accident";
  }

  // 4. In garage / Maintenance / Réparation / Récupération
  if (
    s.includes("garage") ||
    s.includes("maintenance") ||
    s.includes("repair") ||
    s.includes("reparation") ||
    s.includes("réparation") ||
    s.includes("panne") ||
    s.includes("atelier") ||
    s.includes("mecanique") ||
    s.includes("mécanique") ||
    s.includes("recup") ||
    s.includes("récup")
  ) {
    return "In garage";
  }

  // 5. Missing key (Clé manquante)
  if (s.includes("missing_key") || s.includes("cle_manquante") || s.includes("clé") || s.includes("key")) {
    return "missing_key";
  }

  // 6. Missing documents (Documents manquants)
  if (
    s.includes("missing") ||
    s.includes("document") ||
    s.includes("doc_manquant") ||
    s.includes("manquant")
  ) {
    return "missing_document";
  }

  // 6. Blocked
  if (s.includes("block") || s.includes("bloqu")) {
    return "Blocked";
  }

  // 7. Working / Active / In service
  if (
    s.includes("working") ||
    s.includes("actif") ||
    s.includes("service") ||
    s.includes("in service") ||
    s.includes("en service")
  ) {
    return "Actif";
  }

  // 8. Available
  if (s.includes("avail") || s.includes("dispo") || s.includes("libre") || s.includes("parc")) {
    return hasDriver ? "Actif" : "Available";
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

export async function ingestVehiclesFile(file: File): Promise<{ status: number; body: any }> {
  try {

    const { rows: rawRows } = await parseSpreadsheetFile(file);
    const data = rawRows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[k.trim().toLowerCase().replace(/^["']|["']$/g, "")] = v;
      }
      return normalized;
    });

    if (!data || data.length === 0) {
      return { status: 400, body: { error: "Le fichier est vide ou illisible." } };
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
    const vehicleByVin = new Map<string, typeof allExistingVehicles[0]>();
    const vehicleByOldPlate = new Map<string, typeof allExistingVehicles[0]>();

    for (const v of allExistingVehicles) {
      if (v.plate_number) {
        vehicleByPlate.set(v.plate_number.toUpperCase().trim(), v);
        vehicleByNorm.set(normalizePlate(v.plate_number), v);
      }
      if (v.vin) {
        vehicleByVin.set(v.vin.toUpperCase().trim(), v);
      }
      if (v.notes) {
        const match = v.notes.match(/Ancien\s*N°?:\s*([A-Za-z0-9-]+)/i);
        if (match && match[1]) {
          const oldClean = cleanPlateInput(match[1]);
          const oldNorm = normalizePlate(match[1]);
          if (oldClean) vehicleByOldPlate.set(oldClean, v);
          if (oldNorm) vehicleByOldPlate.set(oldNorm, v);
        }
      }
    }

    const DRIVER_PHONE_ALIASES = [
      "driver phone",
      "phone",
      "telephone",
      "téléphone",
      "tel",
      "gsm",
      "mobile",
      "numéro chauffeur",
      "tel chauffeur",
      "téléphone chauffeur",
      "contact",
      "num",
    ];

    // 2. Pre-fetch all existing drivers in 1 query
    const allDrivers = await prisma.driverProfile.findMany();
    const driverByName = new Map<string, typeof allDrivers[0]>();
    const driverByPhone = new Map<string, typeof allDrivers[0]>();
    const driverByAssignedVehicleId = new Map<string, typeof allDrivers[0]>();
    const existingCins = new Set<string>();
    const existingPhones = new Set<string>();

    for (const d of allDrivers) {
      const clean = d.fullName.toLowerCase().replace(/\s+/g, " ").trim();
      driverByName.set(clean, d);
      if (d.phoneSanitized) {
        existingPhones.add(d.phoneSanitized.trim());
        const cleanP = d.phoneSanitized.replace(/\D/g, "").slice(-9);
        if (cleanP) driverByPhone.set(cleanP, d);
      }
      if (d.cinNumber) {
        existingCins.add(d.cinNumber.toUpperCase().trim());
      }
      if (d.assignedVehicleId) {
        driverByAssignedVehicleId.set(d.assignedVehicleId, d);
      }
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

    // 4. Pre-fetch all accident claims in 1 query
    const allClaims = await prisma.accidentClaim.findMany({
      orderBy: { created_at: "desc" },
    });
    const claimsByVehicleId = new Map<string, typeof allClaims>();
    for (const c of allClaims) {
      if (c.vehicle_id) {
        const list = claimsByVehicleId.get(c.vehicle_id) || [];
        list.push(c);
        claimsByVehicleId.set(c.vehicle_id, list);
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
    let archived_orphans = 0;
    const processedVehicleIds = new Set<string>();

    // Filter valid rows and parse them
    interface ParsedRow {
      plate_number: string;
      normPlate: string;
      make_model: string;
      year: number;
      vin: string | null;
      oldNumber: string | null;
      regNu: string | null;
      driverName: string | null;
      driverPhone: string | null;
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
      const driverPhone = getField(row, DRIVER_PHONE_ALIASES) || null;

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
        oldNumber: oldNumber || null,
        regNu: regNu || null,
        driverName,
        driverPhone,
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
      return {
        status: 400,
        body: {
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
      };
    }

    // In-memory accumulation collections for high-speed batch execution (eliminates N+1 query latency)
    const newVehiclesToCreate: any[] = [];
    const vehicleUpdates = new Map<string, any>();
    const ticketPlateUpdates: { vehicleId: string; newPlate: string }[] = [];

    const driverUnlinkVehicleIds = new Set<string>();
    const driverNameUpdates = new Map<string, string>();
    const formerVehicleHistoryUpdates: { vehicleId: string; historicalName: string; historicalPhone?: string | null }[] = [];
    const driverAssignUpdates = new Map<string, string>();
    const newDriversToCreate: Prisma.DriverProfileCreateManyInput[] = [];

    const ticketsToCreate: any[] = [];
    const ticketsToUpdate = new Map<string, any>();
    const ticketIdsToResolve = new Set<string>();

    const claimsToCreate: any[] = [];
    const claimsToUpdate = new Map<string, any>();
    const claimIdsToDelete = new Set<string>();
    const claimIdsToSetVehicleBack = new Set<string>();

    // ── Phase 1: Parse and Reconcile All Rows In-Memory ──
    for (const item of validRows) {
      try {
        let existing = vehicleByPlate.get(item.plate_number) || vehicleByNorm.get(item.normPlate);

        // 1. Try matching by VIN (handles license plate transitions like WW -> permanent)
        if (!existing && item.vin) {
          const cleanVin = item.vin.toUpperCase().trim();
          existing = vehicleByVin.get(cleanVin);
        }

        // 2. Try matching by Old Number
        if (!existing && item.oldNumber) {
          const cleanOld = cleanPlateInput(item.oldNumber);
          const normOld = normalizePlate(item.oldNumber);
          existing =
            vehicleByPlate.get(cleanOld) ||
            vehicleByNorm.get(normOld) ||
            vehicleByOldPlate.get(cleanOld) ||
            vehicleByOldPlate.get(normOld);
        }

        // 3. Try matching by Registration Number
        if (!existing && item.regNu) {
          const cleanReg = cleanPlateInput(item.regNu);
          const normReg = normalizePlate(item.regNu);
          existing = vehicleByPlate.get(cleanReg) || vehicleByNorm.get(normReg);
        }

        let vehicleId: string;

        if (!existing) {
          vehicleId = crypto.randomUUID();
          const newVehicle = {
            id: vehicleId,
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
            assigned_supervisor: (isMehdiPlate(item.plate_number) || (item.manager && item.manager.toLowerCase().includes("mehdi"))) ? "mehdi elyattouti" : "Mohamed Aziz",
            assigned_collector: (isMehdiPlate(item.plate_number) || (item.manager && item.manager.toLowerCase().includes("mehdi"))) ? "mehdi elyattouti" : "Mohamed Aziz",
            notes: item.notes,
            current_mileage: 0,
            created_at: new Date(),
            updated_at: new Date(),
          };
          newVehiclesToCreate.push(newVehicle);
          vehicleByPlate.set(item.plate_number, newVehicle as any);
          vehicleByNorm.set(item.normPlate, newVehicle as any);
          if (newVehicle.vin) vehicleByVin.set(newVehicle.vin.toUpperCase().trim(), newVehicle as any);
          inserted++;
        } else {
          vehicleId = existing.id;
          let notesToSave = item.notes || existing.notes;
          const previousPlate = existing.plate_number;
          if (previousPlate !== item.plate_number) {
            const transitionNote = `Ancien N°: ${previousPlate}`;
            if (!notesToSave || !notesToSave.includes(previousPlate)) {
              notesToSave = notesToSave ? `${notesToSave} · ${transitionNote}` : transitionNote;
            }

            // Update any maintenance tickets still under previous plate
            ticketPlateUpdates.push({ vehicleId: existing.id, newPlate: item.plate_number });
          }

          const newStatus =
            item.status === "Available"
              ? (item.driverName ? "Actif" : "Available")
              : item.status;
          const newAssignedDriverName =
            item.status === "Available" && !item.driverName
              ? null
              : item.driverName || existing.assigned_driver_name;
          const newHistoricalDriverName =
            item.status === "Available" && !item.driverName && existing.assigned_driver_name
              ? existing.assigned_driver_name
              : existing.historical_driver_name;
          const isMehdiVehicle = isMehdiPlate(item.plate_number) || (item.manager && item.manager.toLowerCase().includes("mehdi"));
          const newSupervisor = isMehdiVehicle ? "mehdi elyattouti" : "Mohamed Aziz";
          const newCollector = isMehdiVehicle ? "mehdi elyattouti" : "Mohamed Aziz";

          const updateData = {
            plate_number: item.plate_number,
            make_model: item.make_model,
            year: item.year,
            vin: item.vin || existing.vin,
            hub_city: item.hub_city,
            status: newStatus,
            is_archived: false,
            total_downtime_days: item.downtimeDays || existing.total_downtime_days,
            insurance_policy_number: item.insurancePolicy || existing.insurance_policy_number,
            isInsuranceActive: item.isInsuranceActive || existing.isInsuranceActive,
            assigned_driver_name: newAssignedDriverName,
            historical_driver_name: newHistoricalDriverName,
            assigned_supervisor: newSupervisor,
            assigned_collector: newCollector,
            notes: notesToSave,
            updated_at: new Date(),
          };

          vehicleUpdates.set(existing.id, updateData);
          Object.assign(existing, updateData);
          vehicleByPlate.set(item.plate_number, existing);
          vehicleByNorm.set(item.normPlate, existing);
          if (existing.vin) vehicleByVin.set(existing.vin.toUpperCase().trim(), existing);
          updated++;
        }

        processedVehicleIds.add(vehicleId);

        // Driver profile auto-link (Multi-strategy: Phone -> Vehicle Existing Driver -> Fuzzy Name)
        let matchedDriver: any = null;
        if (vehicleId) {
          const targetPhone = item.driverPhone || existing?.assigned_driver_phone;
          if (targetPhone) {
            const cleanP = targetPhone.replace(/\D/g, "").slice(-9);
            if (cleanP && driverByPhone.has(cleanP)) {
              matchedDriver = driverByPhone.get(cleanP);
            }
          }

          // Check existing driver assigned to this vehicle
          if (!matchedDriver && driverByAssignedVehicleId.has(vehicleId)) {
            const currentAssigned = driverByAssignedVehicleId.get(vehicleId)!;
            if (!item.driverName) {
              matchedDriver = currentAssigned;
            } else {
              const curNorm = currentAssigned.fullName.toLowerCase().replace(/[^a-z0-9]/g, "");
              const targetNorm = item.driverName.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (curNorm === targetNorm || curNorm.includes(targetNorm) || targetNorm.includes(curNorm)) {
                matchedDriver = currentAssigned;
              }
            }
          }

          // Match by name
          if (!matchedDriver && item.driverName) {
            const cleanTarget = item.driverName.toLowerCase().replace(/\s+/g, " ").trim();
            matchedDriver = driverByName.get(cleanTarget);

            // Fallback word & fuzzy matching
            if (!matchedDriver) {
              const targetWords = cleanTarget.split(" ").filter((w: string) => w.length >= 3);
              for (const [key, d] of driverByName.entries()) {
                const keyWords = key.split(" ").filter((w: string) => w.length >= 3);
                if (targetWords.length >= 2 && targetWords.every((w: string) => key.includes(w))) {
                  matchedDriver = d;
                  break;
                }
                // Handle spelling variations like benjaloun vs benjelloun
                if (targetWords.length >= 2 && keyWords.length >= 2) {
                  const firstNameMatch = targetWords[0] === keyWords[0];
                  const lastName1 = targetWords[targetWords.length - 1];
                  const lastName2 = keyWords[keyWords.length - 1];
                  if (firstNameMatch && (lastName1.startsWith(lastName2.slice(0, 4)) || lastName2.startsWith(lastName1.slice(0, 4)))) {
                    matchedDriver = d;
                    break;
                  }
                }
              }
            }
          }

          if (item.status !== "Actif") {
            // Non-working vehicle (Available, maintenance, police_immobilization, missing_key, etc.):
            // Release any active DriverProfile pointing to this vehicle so immobilized/garage cars
            // do not inflate active daily collection driver counts.
            driverUnlinkVehicleIds.add(vehicleId);
            for (const d of allDrivers) {
              if (d.assignedVehicleId === vehicleId) {
                d.assignedVehicleId = null;
              }
            }
            driverByAssignedVehicleId.delete(vehicleId);
          } else if (matchedDriver) {
            // Update driver name if vehicle CSV has a better/updated spelling
            if (item.driverName && matchedDriver.fullName !== item.driverName) {
              driverNameUpdates.set(matchedDriver.id, item.driverName);
              matchedDriver.fullName = item.driverName;
            }

            if (matchedDriver.assignedVehicleId !== vehicleId || matchedDriver.is_archived) {
              // Release driver's former vehicle to history
              if (matchedDriver.assignedVehicleId && matchedDriver.assignedVehicleId !== vehicleId) {
                formerVehicleHistoryUpdates.push({
                  vehicleId: matchedDriver.assignedVehicleId,
                  historicalName: matchedDriver.fullName,
                  historicalPhone: matchedDriver.phoneSanitized,
                });
              }

              // Release this vehicle from ANY other driver first to prevent unique constraint violation
              driverUnlinkVehicleIds.add(vehicleId);
              for (const d of allDrivers) {
                if (d.assignedVehicleId === vehicleId && d.id !== matchedDriver.id) {
                  d.assignedVehicleId = null;
                }
              }

              driverAssignUpdates.set(matchedDriver.id, vehicleId);
              matchedDriver.assignedVehicleId = vehicleId;
              matchedDriver.is_archived = false;
              driverByAssignedVehicleId.set(vehicleId, matchedDriver);
            }
            linked_drivers++;
          } else if (item.driverName) {
            // Release this vehicle from ANY other driver first
            driverUnlinkVehicleIds.add(vehicleId);
            for (const d of allDrivers) {
              if (d.assignedVehicleId === vehicleId) {
                d.assignedVehicleId = null;
              }
            }

            const realPhone = item.driverPhone || existing?.assigned_driver_phone;
            const cleanRealPhone = realPhone ? realPhone.replace(/\D/g, "") : "";
            let phoneFormatted = cleanRealPhone && cleanRealPhone.length >= 9
              ? (cleanRealPhone.startsWith("212") ? `+${cleanRealPhone}` : `+212${cleanRealPhone.slice(-9)}`)
              : `+212600${Math.floor(100000 + Math.random() * 900000)}`;

            while (existingPhones.has(phoneFormatted)) {
              phoneFormatted = `+212600${Math.floor(100000 + Math.random() * 900000)}`;
            }
            existingPhones.add(phoneFormatted);

            let cinNumber = `CIN-${item.plate_number.replace(/\D/g, "").slice(-4) || Math.floor(1000 + Math.random() * 9000)}`;
            while (existingCins.has(cinNumber)) {
              cinNumber = `CIN-${Math.floor(100000 + Math.random() * 900000)}`;
            }
            existingCins.add(cinNumber);

            const newDriverId = crypto.randomUUID();
            const newDriver = {
              id: newDriverId,
              fullName: item.driverName,
              phoneSanitized: phoneFormatted,
              cinNumber,
              age: 30,
              licenseSeniority: 4,
              contractType: "STANDARD",
              isKycVerified: true,
              defaultStage: "NOMINAL",
              currentArrearsMAD: 0.0,
              monthlyTripCount: 0,
              assignedVehicleId: vehicleId,
              is_archived: false,
            };

            newDriversToCreate.push(newDriver);
            matchedDriver = newDriver;
            const cleanTarget = item.driverName.toLowerCase().replace(/\s+/g, " ").trim();
            driverByName.set(cleanTarget, newDriver as any);
            const pDigits = phoneFormatted.replace(/\D/g, "").slice(-9);
            if (pDigits) driverByPhone.set(pDigits, newDriver as any);
            driverByAssignedVehicleId.set(vehicleId, newDriver as any);
            allDrivers.push(newDriver as any);
            linked_drivers++;
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
            ticketsToUpdate.set(existingTicket.id, {
              description: desc,
              priority,
              driver_name: item.driverName || existingTicket.driver_name,
              driver_phone: matchedDriver?.phoneSanitized || existingTicket.driver_phone,
            });
            tickets_updated++;
          } else {
            const newTicket = {
              id: crypto.randomUUID(),
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
            };
            ticketsToCreate.push(newTicket);
            openTickets.push(newTicket as any);
            openTicketsByVehicleId.set(vehicleId, openTickets);
            tickets_created++;
          }
        } else if (item.status === "police_immobilization") {
          const openTickets = openTicketsByVehicleId.get(vehicleId) || [];
          const existingTicket = openTickets.find((t) =>
            ["Police Immobilization", "police_immobilization", "Sabot"].includes(t.ticket_type)
          );

          const priority = item.downtimeDays >= 7 ? "Critical" : "Urgent";
          const desc = `🚔 Immobilisation Police / Sabot depuis ${item.downtimeDays} jours (depuis le ${startDateFormatted}). Régularisation administrative et mainlevée.`;

          if (existingTicket) {
            ticketsToUpdate.set(existingTicket.id, {
              description: desc,
              priority,
              driver_name: item.driverName || existingTicket.driver_name,
              driver_phone: matchedDriver?.phoneSanitized || existingTicket.driver_phone,
            });
            tickets_updated++;
          } else {
            const newTicket = {
              id: crypto.randomUUID(),
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
            };
            ticketsToCreate.push(newTicket);
            openTickets.push(newTicket as any);
            openTicketsByVehicleId.set(vehicleId, openTickets);
            tickets_created++;
          }
        } else if (item.status === "missing_document") {
          const openTickets = openTicketsByVehicleId.get(vehicleId) || [];
          const existingTicket = openTickets.find((t) =>
            ["Documents manquants", "missing_document", "missing_documents"].includes(t.ticket_type)
          );

          const priority = item.downtimeDays >= 7 ? "Critical" : "Urgent";
          const desc = `📄 Documents manquants signalés depuis ${item.downtimeDays} jours (depuis le ${startDateFormatted}). Régularisation administrative requise.`;

          if (existingTicket) {
            ticketsToUpdate.set(existingTicket.id, {
              description: desc,
              priority,
              driver_name: item.driverName || existingTicket.driver_name,
              driver_phone: matchedDriver?.phoneSanitized || existingTicket.driver_phone,
            });
            tickets_updated++;
          } else {
            const newTicket = {
              id: crypto.randomUUID(),
              vehicle_id: vehicleId,
              plate_number: item.plate_number,
              driver_name: item.driverName || null,
              driver_phone: matchedDriver?.phoneSanitized || null,
              ticket_type: "Documents manquants",
              priority,
              status: "OPEN",
              description: desc,
              created_at: statusStartDate,
              sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
            };
            ticketsToCreate.push(newTicket);
            openTickets.push(newTicket as any);
            openTicketsByVehicleId.set(vehicleId, openTickets);
            tickets_created++;
          }
        } else if (item.status === "missing_key") {
          const openTickets = openTicketsByVehicleId.get(vehicleId) || [];
          const existingTicket = openTickets.find((t) =>
            ["Clé manquante", "missing_key"].includes(t.ticket_type)
          );

          const priority = item.downtimeDays >= 7 ? "Critical" : "Urgent";
          const desc = `🔑 Clé manquante signalée depuis ${item.downtimeDays} jour(s) (depuis le ${startDateFormatted}). Récupération ou double de clé requis.`;

          if (existingTicket) {
            ticketsToUpdate.set(existingTicket.id, {
              description: desc,
              priority,
              driver_name: item.driverName || existingTicket.driver_name,
              driver_phone: matchedDriver?.phoneSanitized || existingTicket.driver_phone,
            });
            tickets_updated++;
          } else {
            const newTicket = {
              id: crypto.randomUUID(),
              vehicle_id: vehicleId,
              plate_number: item.plate_number,
              driver_name: item.driverName || null,
              driver_phone: matchedDriver?.phoneSanitized || null,
              ticket_type: "Clé manquante",
              priority,
              status: "OPEN",
              description: desc,
              created_at: statusStartDate,
              sla_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
            };
            ticketsToCreate.push(newTicket);
            openTickets.push(newTicket as any);
            openTicketsByVehicleId.set(vehicleId, openTickets);
            tickets_created++;
          }
        } else if (item.status === "Accident" || item.status === "In garage") {
          const openTickets = openTicketsByVehicleId.get(vehicleId) || [];
          const existingTicket = openTickets[0];
          const priority = item.downtimeDays >= 7 ? "Critical" : "Urgent";
          const desc = `💥 Véhicule en maintenance / accident signalé via import CSV (${item.downtimeDays > 0 ? `${item.downtimeDays} jours d'immobilisation` : "En cours"}).`;

          if (!existingTicket) {
            const newTicket = {
              id: crypto.randomUUID(),
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
            };
            ticketsToCreate.push(newTicket);
            openTickets.push(newTicket as any);
            openTicketsByVehicleId.set(vehicleId, openTickets);
            tickets_created++;
          }

          const vClaims = claimsByVehicleId.get(vehicleId) || [];
          const activeClaim = vClaims.find((c) => c.timeline_step !== "VEHICLE_BACK");

          if (activeClaim) {
            // Vehicle already in "Dossiers En Cours"
            // Clean up any old duplicate completed claims in VEHICLE_BACK so vehicle is removed from retablis
            const restoredDuplicates = vClaims.filter((c) => c.timeline_step === "VEHICLE_BACK");
            if (restoredDuplicates.length > 0) {
              for (const c of restoredDuplicates) {
                claimIdsToDelete.add(c.id);
              }
              claimsByVehicleId.set(vehicleId, [activeClaim]);
            }
          } else if (vClaims.length > 0) {
            // Vehicle has claim(s) in VEHICLE_BACK (Véhicules Rétablis) but is currently in maintenance in Excel!
            // Reopen the primary claim to CAR_IN_GARAGE
            const sortedClaims = [...vClaims].sort((a, b) => {
              let aComments = 0;
              let bComments = 0;
              try { aComments = a.comments ? JSON.parse(a.comments).length : 0; } catch {}
              try { bComments = b.comments ? JSON.parse(b.comments).length : 0; } catch {}
              return bComments - aComments;
            });
            const primaryClaim = sortedClaims[0];
            const extraDuplicates = sortedClaims.slice(1);

            claimsToUpdate.set(primaryClaim.id, {
              timeline_step: "CAR_IN_GARAGE",
              created_at: statusStartDate,
              step_updated_at: statusStartDate,
              driver_id: matchedDriver?.id || null,
              driver_name: item.driverName || matchedDriver?.fullName || primaryClaim.driver_name,
              driver_phone: matchedDriver?.phoneSanitized || primaryClaim.driver_phone,
            });

            if (extraDuplicates.length > 0) {
              for (const c of extraDuplicates) {
                claimIdsToDelete.add(c.id);
              }
            }

            primaryClaim.timeline_step = "CAR_IN_GARAGE";
            claimsByVehicleId.set(vehicleId, [primaryClaim]);
          } else {
            // No claim at all -> create new in CAR_IN_GARAGE
            const newClaim = {
              id: crypto.randomUUID(),
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
            };
            claimsToCreate.push(newClaim);
            claimsByVehicleId.set(vehicleId, [newClaim as any]);
          }
        } else if (item.status === "Actif" || item.status === "Available") {
          const allOpenTicketsForVehicle = openTicketsByVehicleId.get(vehicleId) || [];
          const openTickets = allOpenTicketsForVehicle.filter(
            (t) => t.ticket_type !== "VEHICLE_RECOVERY" && t.ticket_type !== "Vehicle Recovery"
          );
          if (openTickets.length > 0) {
            for (const t of openTickets) {
              ticketIdsToResolve.add(t.id);
            }
            tickets_resolved += openTickets.length;
            openTicketsByVehicleId.set(
              vehicleId,
              allOpenTicketsForVehicle.filter(
                (t) => t.ticket_type === "VEHICLE_RECOVERY" || t.ticket_type === "Vehicle Recovery"
              )
            );
          }

          const vClaims = claimsByVehicleId.get(vehicleId) || [];
          const activeClaims = vClaims.filter((c) => c.timeline_step !== "VEHICLE_BACK");
          if (activeClaims.length > 0) {
            for (const c of activeClaims) {
              claimIdsToSetVehicleBack.add(c.id);
              c.timeline_step = "VEHICLE_BACK";
            }
          }
        }
      } catch (rowErr: any) {
        console.warn(`Error processing vehicle row ${item.plate_number}:`, rowErr?.message || rowErr);
      }
    }

    // ── Phase 2: High-Speed Batch Writes to Database (Grouped Operations) ──

    // 1. Archive ghost/orphaned vehicles absent from spreadsheet
    const ghostVehicles = allExistingVehicles.filter(
      (v) => !processedVehicleIds.has(v.id) && !v.is_archived && v.plate_number !== "TEST"
    );
    if (ghostVehicles.length > 0) {
      await prisma.vehicle.updateMany({
        where: { id: { in: ghostVehicles.map((v) => v.id) } },
        data: {
          is_archived: true,
          status: "Archived",
          notes: "Archivé automatiquement : absent du fichier CSV de la flotte synchronisé.",
        },
      });
      archived_orphans = ghostVehicles.length;
    }

    // 2. Batch insert new vehicles in chunks of 50
    if (newVehiclesToCreate.length > 0) {
      for (let i = 0; i < newVehiclesToCreate.length; i += 50) {
        const chunk = newVehiclesToCreate.slice(i, i + 50);
        await prisma.vehicle.createMany({
          data: chunk,
        });
      }
    }

    // 3. Batch update existing vehicles in chunked transactions of 15 (stays well under Prisma 5s tx timeout)
    if (vehicleUpdates.size > 0) {
      const updatesList = Array.from(vehicleUpdates.entries());
      for (let i = 0; i < updatesList.length; i += 15) {
        const chunk = updatesList.slice(i, i + 15);
        await prisma.$transaction(
          chunk.map(([id, data]) => prisma.vehicle.update({ where: { id }, data }))
        );
      }
    }

    // 4. Batch update maintenance ticket plate transitions
    if (ticketPlateUpdates.length > 0) {
      await Promise.all(
        ticketPlateUpdates.map((t) =>
          prisma.maintenanceTicket.updateMany({
            where: { vehicle_id: t.vehicleId },
            data: { plate_number: t.newPlate },
          }).catch(() => {})
        )
      );
    }

    // 5. Driver unlinks & history updates (First release all assigned vehicles)
    if (driverUnlinkVehicleIds.size > 0) {
      const unlinks = Array.from(driverUnlinkVehicleIds);
      for (let i = 0; i < unlinks.length; i += 50) {
        const chunk = unlinks.slice(i, i + 50);
        await prisma.driverProfile.updateMany({
          where: { assignedVehicleId: { in: chunk } },
          data: { assignedVehicleId: null },
        });
      }
    }

    if (formerVehicleHistoryUpdates.length > 0) {
      for (let i = 0; i < formerVehicleHistoryUpdates.length; i += 40) {
        const chunk = formerVehicleHistoryUpdates.slice(i, i + 40);
        await prisma.$transaction(
          chunk.map((h) =>
            prisma.vehicle.update({
              where: { id: h.vehicleId },
              data: {
                assigned_driver_name: null,
                assigned_driver_phone: null,
                historical_driver_name: h.historicalName,
                historical_driver_phone: h.historicalPhone || null,
              },
            })
          )
        ).catch(() => {});
      }
    }

    // 6. Batch insert new drivers in chunks of 50
    if (newDriversToCreate.length > 0) {
      for (let i = 0; i < newDriversToCreate.length; i += 50) {
        const chunk = newDriversToCreate.slice(i, i + 50);
        await prisma.driverProfile.createMany({
          data: chunk,
        });
      }
    }

    // 7. Update driver names and assignments in chunked transactions
    const driverUpdateOps: any[] = [];
    for (const [id, fullName] of driverNameUpdates.entries()) {
      driverUpdateOps.push(
        prisma.driverProfile.update({
          where: { id },
          data: { fullName, is_archived: false },
        })
      );
    }
    for (const [driverId, vehicleId] of driverAssignUpdates.entries()) {
      driverUpdateOps.push(
        prisma.driverProfile.update({
          where: { id: driverId },
          data: { assignedVehicleId: vehicleId, is_archived: false },
        })
      );
    }
    if (driverUpdateOps.length > 0) {
      for (let i = 0; i < driverUpdateOps.length; i += 40) {
        const chunk = driverUpdateOps.slice(i, i + 40);
        await prisma.$transaction(chunk).catch(() => {});
      }
    }

    // 8. Maintenance tickets batch create / update / resolve
    if (ticketsToCreate.length > 0) {
      for (let i = 0; i < ticketsToCreate.length; i += 50) {
        const chunk = ticketsToCreate.slice(i, i + 50);
        await prisma.maintenanceTicket.createMany({
          data: chunk,
        });
      }
    }
    if (ticketsToUpdate.size > 0) {
      const ticketsList = Array.from(ticketsToUpdate.entries());
      for (let i = 0; i < ticketsList.length; i += 40) {
        const chunk = ticketsList.slice(i, i + 40);
        await prisma.$transaction(
          chunk.map(([id, data]) => prisma.maintenanceTicket.update({ where: { id }, data }))
        ).catch(() => {});
      }
    }
    if (ticketIdsToResolve.size > 0) {
      const resolveList = Array.from(ticketIdsToResolve);
      for (let i = 0; i < resolveList.length; i += 50) {
        const chunk = resolveList.slice(i, i + 50);
        await prisma.maintenanceTicket.updateMany({
          where: { id: { in: chunk } },
          data: {
            status: "RESOLVED",
            resolved_at: new Date(),
            resolution_notes: `Résolu automatiquement via import CSV Flotte : Véhicule remis en service le ${new Date().toLocaleDateString("fr-FR")}.`,
          },
        });
      }
    }

    // 9. Accident claims batch delete / create / update / resolve
    if (claimIdsToDelete.size > 0) {
      const deleteList = Array.from(claimIdsToDelete);
      for (let i = 0; i < deleteList.length; i += 50) {
        const chunk = deleteList.slice(i, i + 50);
        await prisma.accidentClaim.deleteMany({
          where: { id: { in: chunk } },
        }).catch(() => {});
      }
    }
    if (claimsToCreate.length > 0) {
      for (let i = 0; i < claimsToCreate.length; i += 50) {
        const chunk = claimsToCreate.slice(i, i + 50);
        await prisma.accidentClaim.createMany({
          data: chunk,
        });
      }
    }
    if (claimsToUpdate.size > 0) {
      const claimsList = Array.from(claimsToUpdate.entries());
      for (let i = 0; i < claimsList.length; i += 40) {
        const chunk = claimsList.slice(i, i + 40);
        await prisma.$transaction(
          chunk.map(([id, data]) => prisma.accidentClaim.update({ where: { id }, data }))
        ).catch(() => {});
      }
    }
    if (claimIdsToSetVehicleBack.size > 0) {
      const setBackList = Array.from(claimIdsToSetVehicleBack);
      for (let i = 0; i < setBackList.length; i += 50) {
        const chunk = setBackList.slice(i, i + 50);
        await prisma.accidentClaim.updateMany({
          where: { id: { in: chunk }, timeline_step: { not: "VEHICLE_BACK" } },
          data: {
            timeline_step: "VEHICLE_BACK",
            step_updated_at: new Date(),
          },
        }).catch(() => {});
      }
    }

    // Run driver-vehicle reconciliation to guarantee 1 driver = 1 working car
    await reconcileDriverVehicleAssignments().catch((err) => {
      console.error("Post-upload vehicle reconciliation error:", err);
    });

    // Flush SQLite failover state to cloud replica if active & invalidate caches
    invalidateDriverCache();
    await flushDatabaseSync();
    await touchSyncState("all");

    return { status: 200, body: {
      success: true,
      summary: {
        total_rows,
        inserted,
        updated,
        archived_orphans,
        skipped_invalid,
        linked_drivers,
        tickets_created,
        tickets_updated,
        tickets_resolved,
      },
    } };
  } catch (error: any) {
    console.error("ingestVehiclesFile error:", error);
    return {
      status: 500,
      body: { error: error?.message || "Échec du traitement du fichier CSV de la flotte." },
    };
  }
}
