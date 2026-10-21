import { prisma } from "@/lib/prisma";
import {
  matchNationalBlacklist,
  NationalBlacklistMatchResult,
} from "./nationalBlacklistMatcher";

export interface RedFlagInfo {
  id: string;
  fullName: string;
  phoneSanitized: string;
  cinNumber: string;
  reason?: string | null;
  redFlaggedAt?: Date | null;
  redFlaggedBy?: string | null;
  nationalBlacklistMatch?: NationalBlacklistMatchResult | null;
}

export interface CheckDriverResult {
  isRedFlagged: boolean;
  reason: string | null;
  info: RedFlagInfo | null;
  isNationalBlacklisted?: boolean;
  nationalBlacklistMatch?: NationalBlacklistMatchResult | null;
}

export interface RedFlagsLookup {
  byId: Map<string, RedFlagInfo>;
  byPhone: Map<string, RedFlagInfo>;
  byName: Map<string, RedFlagInfo>;
  byCin: Map<string, RedFlagInfo>;
  checkDriver: (opts: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
    cin?: string | null;
  }) => CheckDriverResult;
}

export { matchNationalBlacklist };

/**
 * Returns pre-indexed lookup maps of all currently active Red Flag drivers,
 * seamlessly merged with the National Blacklist (Liste Noire Région Casa-Settat).
 *
 * Used across vehicles, accident claims, tickets, field missions, WhatsApp,
 * and onboarding leads to guarantee immediate warning on blacklisted candidates.
 */
export async function getActiveRedFlagsLookup(): Promise<RedFlagsLookup> {
  const flaggedDrivers = await prisma.driverProfile.findMany({
    where: { isRedFlagged: true, is_archived: false },
    select: {
      id: true,
      fullName: true,
      phoneSanitized: true,
      cinNumber: true,
      redFlagReason: true,
      redFlaggedAt: true,
      redFlaggedBy: true,
    },
  });

  const byId = new Map<string, RedFlagInfo>();
  const byPhone = new Map<string, RedFlagInfo>();
  const byName = new Map<string, RedFlagInfo>();
  const byCin = new Map<string, RedFlagInfo>();

  for (const d of flaggedDrivers) {
    const nationalMatch = matchNationalBlacklist(d.fullName);
    const info: RedFlagInfo = {
      id: d.id,
      fullName: d.fullName,
      phoneSanitized: d.phoneSanitized,
      cinNumber: d.cinNumber,
      reason: d.redFlagReason,
      redFlaggedAt: d.redFlaggedAt,
      redFlaggedBy: d.redFlaggedBy,
      nationalBlacklistMatch: nationalMatch.isBlacklisted ? nationalMatch : null,
    };

    byId.set(d.id, info);

    if (d.phoneSanitized) {
      const clean = d.phoneSanitized.replace(/\D/g, "");
      byPhone.set(clean, info);
      if (clean.length >= 9) {
        byPhone.set(clean.slice(-9), info);
      }
    }

    if (d.fullName) {
      byName.set(d.fullName.trim().toLowerCase(), info);
    }

    if (d.cinNumber) {
      byCin.set(d.cinNumber.trim().toUpperCase(), info);
    }
  }

  const checkDriver = (opts: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
    cin?: string | null;
  }): CheckDriverResult => {
    let match: RedFlagInfo | undefined;

    if (opts.id && byId.has(opts.id)) {
      match = byId.get(opts.id);
    } else if (opts.phone) {
      const clean = opts.phone.replace(/\D/g, "");
      match = byPhone.get(clean) || (clean.length >= 9 ? byPhone.get(clean.slice(-9)) : undefined);
    }

    if (!match && opts.cin) {
      match = byCin.get(opts.cin.trim().toUpperCase());
    }

    if (!match && opts.name) {
      match = byName.get(opts.name.trim().toLowerCase());
    }

    // Always check candidate name against the National Blacklist (even if not in internal red flags)
    const nationalMatch = opts.name ? matchNationalBlacklist(opts.name) : null;

    if (match) {
      const combinedReason = nationalMatch?.isBlacklisted
        ? `${match.reason || "Signalé"} · 🚨 LISTE NOIRE: ${nationalMatch.matchedEntry?.reason}`
        : match.reason || "Chauffeur signalé pour arriérés ou comportement à risque";

      return {
        isRedFlagged: true,
        reason: combinedReason,
        info: {
          ...match,
          nationalBlacklistMatch: nationalMatch?.isBlacklisted ? nationalMatch : match.nationalBlacklistMatch,
        },
        isNationalBlacklisted: Boolean(nationalMatch?.isBlacklisted || match.nationalBlacklistMatch?.isBlacklisted),
        nationalBlacklistMatch: nationalMatch?.isBlacklisted ? nationalMatch : match.nationalBlacklistMatch,
      };
    }

    if (nationalMatch && nationalMatch.isBlacklisted) {
      return {
        isRedFlagged: true,
        reason: nationalMatch.warningDetailText,
        info: {
          id: `national-${nationalMatch.matchedEntry?.id}`,
          fullName: opts.name || nationalMatch.matchedEntry?.fullName || "",
          phoneSanitized: opts.phone || "",
          cinNumber: opts.cin || "",
          reason: nationalMatch.warningDetailText,
          nationalBlacklistMatch: nationalMatch,
        },
        isNationalBlacklisted: true,
        nationalBlacklistMatch: nationalMatch,
      };
    }

    return {
      isRedFlagged: false,
      reason: null,
      info: null,
      isNationalBlacklisted: false,
      nationalBlacklistMatch: null,
    };
  };

  return { byId, byPhone, byName, byCin, checkDriver };
}
