/**
 * fleet-managers.ts
 * 
 * Master Portfolio Definition for Fleet Performance Managers:
 * - Mehdi Elyattouti (dedicated portfolio of exactly 26 vehicles)
 * - Mohamed Aziz (all remaining vehicles and unassigned drivers)
 * 
 * Rule: The 26 vehicles assigned to Mehdi Elyattouti must ALWAYS remain
 * assigned to Mehdi, even when a driver is reassigned, removed, or changed.
 */

export const MEHDI_VEHICLE_PLATES = [
  "WW028118",
  "WW028122",
  "WW028117",
  "WW028110",
  "WW028113",
  "WW028112",
  "WW028114",
  "WW028107",
  "WW028106",
  "WW028111",
  "WW028115",
  "39457-Y-6",
  "26518-Y-6",
  "26517-Y-6",
  "028104WW",
  "WW028108",
  "028101WW",
  "26515-Y-6",
  "26605-Y-6",
  "26592-Y-6",
  "39677-Y-6",
  "40843-Y-6",
  "39678-Y-6",
  "26514-Y-6",
  "028119WW",
  "21526-Y-6",
] as const;

export const MEHDI_NORMALIZED_PLATES = new Set(
  MEHDI_VEHICLE_PLATES.map((p) => p.replace(/[\s-]/g, "").toUpperCase())
);

/**
 * Checks if a vehicle belongs to Mehdi Elyattouti's portfolio by plate number.
 */
export function isMehdiPlate(plateNumber: string | null | undefined): boolean {
  if (!plateNumber) return false;
  const clean = plateNumber.replace(/[\s-]/g, "").toUpperCase();
  return MEHDI_NORMALIZED_PLATES.has(clean);
}

/**
 * Resolves the fleet manager for a vehicle.
 * Mehdi's 26 vehicles always map to Mehdi Elyattouti.
 * All others default to Mohamed Aziz.
 */
export function resolveVehicleFleetManager(vehicle: {
  plate_number?: string | null;
  assigned_collector?: string | null;
  assigned_supervisor?: string | null;
}): "mehdi elyattouti" | "mohamed aziz" {
  if (isMehdiPlate(vehicle.plate_number)) {
    return "mehdi elyattouti";
  }
  const raw = (vehicle.assigned_collector || vehicle.assigned_supervisor || "").toLowerCase();
  if (raw.includes("mehdi")) {
    return "mehdi elyattouti";
  }
  return "mohamed aziz";
}

/**
 * Resolves the fleet manager for a driver.
 * If driver is driving one of Mehdi's 26 vehicles, manager is ALWAYS Mehdi Elyattouti.
 * Otherwise, if driver explicitly has Mehdi as manager, returns Mehdi.
 * Otherwise, defaults to Mohamed Aziz.
 */
export function resolveDriverFleetManager(driver: {
  manager?: string | null;
  vehicle?: { plate_number?: string | null } | null;
  plate_number?: string | null;
}): "mehdi elyattouti" | "mohamed aziz" {
  const plate = driver.vehicle?.plate_number || driver.plate_number;
  if (isMehdiPlate(plate)) {
    return "mehdi elyattouti";
  }
  const rawM = (driver.manager || "").toLowerCase();
  if (rawM.includes("mehdi")) {
    return "mehdi elyattouti";
  }
  return "mohamed aziz";
}
