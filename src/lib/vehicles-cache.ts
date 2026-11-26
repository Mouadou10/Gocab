/**
 * Vehicles In-Memory Cache Helper
 * Stored on globalThis for fast unfiltered GET /api/vehicles responses.
 */

const gVehicles = globalThis as unknown as {
  __gocabVehiclesCache?: { vehicles: any[]; timestamp: number } | null;
};

export function getCachedVehicles(): any[] | null {
  const cached = gVehicles.__gocabVehiclesCache;
  if (cached && Date.now() - cached.timestamp < 15000) {
    return cached.vehicles;
  }
  return null;
}

export function setCachedVehicles(vehicles: any[]): void {
  gVehicles.__gocabVehiclesCache = { vehicles, timestamp: Date.now() };
}

export function invalidateVehiclesCache(): void {
  gVehicles.__gocabVehiclesCache = null;
}
