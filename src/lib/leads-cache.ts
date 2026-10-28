/**
 * Leads In-Memory Cache Helper
 * Extracted from route.ts to prevent Next.js 15+ invalid export typecheck errors.
 */

let leadsCache: { leads: any[]; timestamp: number } | null = null;
let lastRecallCheckAt = 0;

export function getCachedLeads(): any[] | null {
  if (leadsCache && Date.now() - leadsCache.timestamp < 60000) {
    return leadsCache.leads;
  }
  return null;
}

export function setCachedLeads(leads: any[]): void {
  leadsCache = { leads, timestamp: Date.now() };
}

export function invalidateLeadsCache(): void {
  leadsCache = null;
}

export function shouldRunRecallCheck(): boolean {
  const now = Date.now();
  if (now - lastRecallCheckAt > 300000) {
    lastRecallCheckAt = now;
    return true;
  }
  return false;
}
