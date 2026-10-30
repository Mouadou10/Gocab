/**
 * Leads In-Memory Cache Helper
 * Stored on globalThis so cross-container Cloud WAL replay can invalidate immediately.
 */

const gLeads = globalThis as unknown as {
  __gocabLeadsCache?: { leads: any[]; timestamp: number } | null;
  __gocabLastRecallCheckAt?: number;
};

export function getCachedLeads(): any[] | null {
  const cached = gLeads.__gocabLeadsCache;
  if (cached && Date.now() - cached.timestamp < 3000) {
    return cached.leads;
  }
  return null;
}

export function setCachedLeads(leads: any[]): void {
  gLeads.__gocabLeadsCache = { leads, timestamp: Date.now() };
}

export function invalidateLeadsCache(): void {
  gLeads.__gocabLeadsCache = null;
}

export function shouldRunRecallCheck(): boolean {
  const now = Date.now();
  if (now - (gLeads.__gocabLastRecallCheckAt || 0) > 300000) {
    gLeads.__gocabLastRecallCheckAt = now;
    return true;
  }
  return false;
}
