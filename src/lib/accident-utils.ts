/**
 * Shared helper to compute the exact number of days since the vehicle's current accident started.
 * Prevents stale `created_at` dates from previously closed/reopened claims from inflating the count.
 */
export function calculateAccidentDays(claim: {
  created_at?: string | Date | null;
  comments?: string | null;
  vehicle?: { total_downtime_days?: number | null } | null;
}): number {
  const daysFromCreated = claim.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(claim.created_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  let daysFromDeclaration: number | null = null;
  try {
    if (claim.comments) {
      const parsed = JSON.parse(claim.comments);
      if (Array.isArray(parsed)) {
        const meta = parsed.find((c: any) => c && c.id === "INSURANCE_DOSSIER_META");
        if (meta?.declaration_date) {
          const declMs = new Date(meta.declaration_date).getTime();
          if (!isNaN(declMs)) {
            daysFromDeclaration = Math.max(0, Math.floor((Date.now() - declMs) / (1000 * 60 * 60 * 24)));
          }
        }
      }
    }
  } catch {}

  const fleetDowntime =
    typeof claim.vehicle?.total_downtime_days === "number" && claim.vehicle.total_downtime_days > 0
      ? claim.vehicle.total_downtime_days
      : null;

  if (fleetDowntime !== null) {
    if (daysFromDeclaration !== null && Math.abs(daysFromDeclaration - fleetDowntime) <= 3) {
      return Math.max(daysFromDeclaration, fleetDowntime);
    }
    if (daysFromCreated <= fleetDowntime + 3) {
      return Math.max(daysFromCreated, fleetDowntime);
    }
    return fleetDowntime;
  }

  if (daysFromDeclaration !== null) {
    return daysFromDeclaration;
  }

  return daysFromCreated;
}
