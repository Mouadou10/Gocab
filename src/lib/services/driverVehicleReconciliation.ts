/**
 * Driver-Vehicle Reconciliation Engine
 *
 * Enforces the strict rule: ONE DRIVER = ONE CURRENT WORKING CAR.
 *
 * When multiple vehicles are associated with the same driver (from CSV uploads,
 * reassignment, or car replacement after an accident):
 * 1. Resolves the single CURRENT WORKING CAR:
 *    - Checks recent CSV driver/car upload and active assignment.
 *    - Prioritizes active vehicles linked to the driver's DriverProfile.
 *    - Prioritizes status "Actif" over "Accident", "Available", "In garage".
 *    - Prioritizes the most recently updated vehicle.
 * 2. Moves any previous/older cars to HISTORY ONLY:
 *    - Clears active assigned_driver_name and assigned_driver_phone.
 *    - Stores historical_driver_name and historical_driver_phone.
 *    - Records in vehicle notes for transparent fleet traceability.
 */

import { prisma } from "@/lib/prisma";

export interface ReconciliationResult {
  reconciledCount: number;
  details: Array<{
    driverName: string;
    currentWorkingCarPlate: string;
    historicalCarsPlates: string[];
  }>;
}

/**
 * Normalizes driver name for matching (removes accents, extra spaces, uppercase).
 */
export function normalizeDriverName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Scans all vehicles and driver profiles to detect and resolve duplicate driver assignments.
 * Can be called during CSV upload, vehicle updates, or on-demand.
 */
export async function reconcileDriverVehicleAssignments(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    reconciledCount: 0,
    details: [],
  };

  // Fetch all vehicles and drivers
  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({
      where: { is_archived: false },
      include: {
        driverProfile: true,
      },
    }),
    prisma.driverProfile.findMany({
      where: { is_archived: false },
      include: {
        assignedVehicle: true,
      },
    }),
  ]);

  // Group vehicles by normalized assigned driver name
  const driverToVehiclesMap = new Map<string, typeof vehicles>();

  for (const v of vehicles) {
    const rawName = v.assigned_driver_name || v.driverProfile?.fullName;
    if (!rawName) continue;

    const normName = normalizeDriverName(rawName);
    if (!normName) continue;

    const list = driverToVehiclesMap.get(normName) || [];
    list.push(v);
    driverToVehiclesMap.set(normName, list);
  }

  // Also verify driver profiles that have an assigned vehicle
  for (const d of drivers) {
    if (!d.assignedVehicleId || !d.assignedVehicle) continue;
    const normName = normalizeDriverName(d.fullName);
    const list = driverToVehiclesMap.get(normName) || [];
    if (!list.some((v) => v.id === d.assignedVehicleId)) {
      list.push(d.assignedVehicle as any);
      driverToVehiclesMap.set(normName, list);
    }
  }

  // Iterate over drivers with multiple vehicles
  for (const [normName, assignedVehicles] of driverToVehiclesMap.entries()) {
    if (assignedVehicles.length <= 1) continue;

    // Find the corresponding DriverProfile
    const driverProfile = drivers.find(
      (d) => normalizeDriverName(d.fullName) === normName
    );

    // Pick the SINGLE current working car:
    // Scoring criteria:
    // 1. Linked to DriverProfile.assignedVehicleId (+1000)
    // 2. Status === "Actif" (+500), "In service" (+400)
    // 3. Status NOT "Accident" (-300), NOT "Available" (-200)
    // 4. Most recent updated_at timestamp
    const sorted = [...assignedVehicles].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (driverProfile && driverProfile.assignedVehicleId === a.id) scoreA += 1000;
      if (driverProfile && driverProfile.assignedVehicleId === b.id) scoreB += 1000;

      const statusA = (a.status || "").toLowerCase();
      const statusB = (b.status || "").toLowerCase();

      if (statusA.includes("actif") || statusA.includes("service")) scoreA += 500;
      if (statusB.includes("actif") || statusB.includes("service")) scoreB += 500;

      if (statusA.includes("accident") || statusA.includes("panne")) scoreA -= 300;
      if (statusB.includes("accident") || statusB.includes("panne")) scoreB -= 300;

      if (statusA.includes("avail") || statusA.includes("dispo")) scoreA -= 200;
      if (statusB.includes("avail") || statusB.includes("dispo")) scoreB -= 200;

      if (scoreA !== scoreB) return scoreB - scoreA;

      // Tie-breaker: latest updated_at
      const timeA = new Date(a.updated_at).getTime();
      const timeB = new Date(b.updated_at).getTime();
      return timeB - timeA;
    });

    const currentWorkingCar = sorted[0];
    const olderHistoricalCars = sorted.slice(1);

    const realDriverName =
      driverProfile?.fullName ||
      currentWorkingCar.assigned_driver_name ||
      olderHistoricalCars[0].assigned_driver_name ||
      normName;
    const realDriverPhone =
      driverProfile?.phoneSanitized ||
      currentWorkingCar.assigned_driver_phone ||
      olderHistoricalCars[0].assigned_driver_phone ||
      null;

    // 1. Ensure the current working car has the active driver fields and DriverProfile relation
    await prisma.vehicle.update({
      where: { id: currentWorkingCar.id },
      data: {
        assigned_driver_name: realDriverName,
        assigned_driver_phone: realDriverPhone,
        historical_driver_name: null,
      },
    });

    if (driverProfile && driverProfile.assignedVehicleId !== currentWorkingCar.id) {
      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          assignedVehicleId: currentWorkingCar.id,
        },
      });
    }

    // 2. Move older vehicles to HISTORY ONLY
    const historicalPlates: string[] = [];

    for (const oldCar of olderHistoricalCars) {
      historicalPlates.push(oldCar.plate_number);

      // Unlink driver profile if it was pointing here
      if (driverProfile && driverProfile.assignedVehicleId === oldCar.id) {
        // Already handled above
      }

      // Append to notes for transparent audit history
      let updatedNotes = oldCar.notes || "";
      const historyNote = `Ancien conducteur: ${realDriverName}`;
      if (!updatedNotes.includes(realDriverName)) {
        updatedNotes = updatedNotes
          ? `${updatedNotes} · ${historyNote}`
          : historyNote;
      }

      // If the old car was marked "Actif" but is now relieved of its driver, set to "Available"
      const currentOldStatus = (oldCar.status || "").toLowerCase();
      let newStatus = oldCar.status;
      if (currentOldStatus.includes("actif") || currentOldStatus.includes("service")) {
        newStatus = "Available";
      }

      await prisma.vehicle.update({
        where: { id: oldCar.id },
        data: {
          assigned_driver_name: null,
          assigned_driver_phone: null,
          historical_driver_name: realDriverName,
          historical_driver_phone: realDriverPhone,
          status: newStatus,
          notes: updatedNotes,
        },
      });
    }

    result.reconciledCount++;
    result.details.push({
      driverName: realDriverName,
      currentWorkingCarPlate: currentWorkingCar.plate_number,
      historicalCarsPlates: historicalPlates,
    });
  }

  return result;
}

/**
 * Given a driver's name, phone, or ID, returns their single active current working car.
 */
export async function getDriverCurrentWorkingCar(
  identifier: string
): Promise<any | null> {
  if (!identifier || !identifier.trim()) return null;
  const clean = identifier.trim();

  // Try direct driverProfile lookup
  const driver = await prisma.driverProfile.findFirst({
    where: {
      OR: [
        { id: clean },
        { fullName: clean },
        { phoneSanitized: clean },
        { cinNumber: clean.toUpperCase() },
      ],
    },
    include: {
      assignedVehicle: true,
    },
  });

  if (driver?.assignedVehicle) {
    return driver.assignedVehicle;
  }

  // Fallback: search vehicles by active assigned_driver_name
  const norm = normalizeDriverName(clean);
  const vehicles = await prisma.vehicle.findMany({
    where: {
      is_archived: false,
      assigned_driver_name: { not: null },
    },
  });

  const matching = vehicles.filter(
    (v) => normalizeDriverName(v.assigned_driver_name) === norm
  );

  if (matching.length === 0) return null;
  if (matching.length === 1) return matching[0];

  // If multiple, pick active or latest
  return matching.sort((a, b) => {
    const isActifA = (a.status || "").toLowerCase().includes("actif");
    const isActifB = (b.status || "").toLowerCase().includes("actif");
    if (isActifA && !isActifB) return -1;
    if (!isActifA && isActifB) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  })[0];
}
