/**
 * In-memory server cache for driver profiles
 */

let driverCache: { data: any; timestamp: number } | null = null;

export function getDriverCache(): { data: any; timestamp: number } | null {
  return driverCache;
}

export function setDriverCache(data: any) {
  driverCache = { data, timestamp: Date.now() };
}

export function invalidateDriverCache() {
  driverCache = null;
}
