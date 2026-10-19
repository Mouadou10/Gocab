import { prisma } from "@/lib/prisma";

export interface RedFlagInfo {
  id: string;
  fullName: string;
  phoneSanitized: string;
  cinNumber: string;
  reason?: string | null;
  redFlaggedAt?: Date | null;
  redFlaggedBy?: string | null;
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
  }) => { isRedFlagged: boolean; reason: string | null; info: RedFlagInfo | null };
}

/**
 * Returns pre-indexed lookup maps of all currently active Red Flag drivers.
 * Used across vehicles, accident claims, tickets, field missions, and WhatsApp
 * to guarantee every single driver display signals their Red Flag status.
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
    const info: RedFlagInfo = {
      id: d.id,
      fullName: d.fullName,
      phoneSanitized: d.phoneSanitized,
      cinNumber: d.cinNumber,
      reason: d.redFlagReason,
      redFlaggedAt: d.redFlaggedAt,
      redFlaggedBy: d.redFlaggedBy,
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
  }) => {
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

    if (match) {
      return {
        isRedFlagged: true,
        reason: match.reason || "Chauffeur signalé pour arriérés ou comportement à risque",
        info: match,
      };
    }

    return {
      isRedFlagged: false,
      reason: null,
      info: null,
    };
  };

  return { byId, byPhone, byName, byCin, checkDriver };
}
