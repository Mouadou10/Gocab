/**
 * In-memory server cache for driver profiles
 * Stored on globalThis so cross-container Cloud WAL replay can invalidate immediately.
 */

const gDrivers = globalThis as unknown as {
  __gocabDriverCache?: { data: any; timestamp: number } | null;
};

export function getDriverCache(): { data: any; timestamp: number } | null {
  return gDrivers.__gocabDriverCache || null;
}

export function setDriverCache(data: any) {
  gDrivers.__gocabDriverCache = { data, timestamp: Date.now() };
}

export function invalidateDriverCache() {
  gDrivers.__gocabDriverCache = null;
}
