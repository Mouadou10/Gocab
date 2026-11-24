/**
 * fleet-managers.ts
 * 
 * Master Portfolio Definition for Fleet Performance Managers:
 * - Mehdi Elyattouti (dedicated portfolio of exactly 40 vehicles)
 * - Mohamed Aziz (all remaining vehicles and unassigned drivers: 62 vehicles)
 * 
 * Rule: The vehicles assigned to Mehdi Elyattouti must ALWAYS remain
 * assigned to Mehdi, even when a driver is reassigned, removed, or changed.
 * Fleet performance agents get vehicles assigned instead of drivers.
 */

export const MEHDI_VEHICLE_PLATES = [
  // Primary plates (40 vehicles assigned to Mehdi)
  "028103WW",
  "26514-Y-6",
  "WW028118",
  "WW028105",
  "43898-Y-6",
  "10192T6",
  "43985-Y-6",
  "WW028123",
  "26592-Y-6",
  "WW028117",
  "39678-Y-6",
  "WW028106",
  "WW028108",
  "44188-Y-6",
  "WW028110",
  "WW990521",
  "028116WW",
  "39677-Y-6",
  "WW028122",
  "062979WW",
  "21526-Y-6",
  "WW028120",
  "44213-Y-6",
  "26605-Y-6",
  "39457-Y-6",
  "44193-Y-6",
  "40844-Y-6",
  "WW028112",
  "028101WW",
  "40841-Y-6",
  "WW028107",
  "40843-Y-6",
  "WW028115",
  "WW028113",
  "26518-Y-6",
  "43891-Y-6",
  "WW028109",
  "028121WW",
  "43984-Y-6",
  "40839-Y-6",
  // Old / temporary / registration aliases for 100% resilient matching
  "028104WW",
  "WW028124",
  "028124WW",
  "WW028125",
  "028119WW",
  "WW028111",
  "028102WW",
  "WW028114",
  "WW990519",
  "860534-WW",
  "860518-WW",
  "WW964993",
  "WW964992",
  "WW-804282",
  "860531-WW",
  "WW964986",
  "WW990522",
  "WW990523",
  "WW990524",
  "860509-WW",
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
 * Mehdi's 40 vehicles always map to Mehdi Elyattouti.
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
 * Portfolio is strictly vehicle-based:
 * If driver is assigned to a vehicle belonging to Mehdi Elyattouti, manager is Mehdi.
 * If driver is assigned to any other vehicle, manager is Mohamed Aziz.
 * If driver has no vehicle assigned, defaults to Mohamed Aziz.
 */
export function resolveDriverFleetManager(driver: {
  manager?: string | null;
  vehicle?: { plate_number?: string | null } | null;
  plate_number?: string | null;
}): "mehdi elyattouti" | "mohamed aziz" {
  const plate = driver.vehicle?.plate_number || driver.plate_number;
  if (plate) {
    return isMehdiPlate(plate) ? "mehdi elyattouti" : "mohamed aziz";
  }
  const rawM = (driver.manager || "").toLowerCase();
  if (rawM.includes("mehdi")) {
    return "mehdi elyattouti";
  }
  return "mohamed aziz";
}

export const FLEET_MANAGER_PHONES: Record<"mohamed aziz" | "mehdi elyattouti", string> = {
  "mohamed aziz": "+212 666-563066",
  "mehdi elyattouti": "+212 667-960025",
};

/**
 * Returns the assigned fleet manager's phone number based on plate portfolio or manager name.
 */
export function getFleetManagerPhone(input: {
  manager?: string | null;
  vehicle?: { plate_number?: string | null } | null;
  plate_number?: string | null;
}): string {
  const manager = resolveDriverFleetManager(input);
  return FLEET_MANAGER_PHONES[manager];
}
