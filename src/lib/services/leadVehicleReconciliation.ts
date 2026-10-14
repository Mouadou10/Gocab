import { prisma } from "@/lib/prisma";
import { touchSyncState } from "@/lib/sync";

const STOP_TOKENS = new Set(["ait", "ben", "ould", "abou", "sidi", "moulay", "lalla", "el", "al"]);
const COMMON_FIRST_NAMES = new Set([
  "mohamed",
  "mohammad",
  "amine",
  "fatima",
  "zahra",
  "ahmed",
  "yassine",
  "hamza",
  "hassan",
  "omar",
  "ali",
  "mehdi",
  "said",
  "rachid",
  "khalid",
  "othman",
  "youssef",
  "anas",
  "abdellah",
]);

/**
 * Normalizes a driver or lead name for fuzzy comparison.
 * Removes accents, non-alphanumeric characters, and extra spaces.
 */
export function normalizeNameForMatching(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Normalizes a phone number for comparison (returns last 9 digits).
 */
export function normalizePhoneForMatching(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-9);
}

/**
 * Extracts meaningful tokens from a name string (length >= 3, excluding stop words).
 */
export function extractTokens(name: string | null | undefined): string[] {
  if (!name) return [];
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));
}

/**
 * High-precision verification if two Moroccan/French names refer to the same person.
 * Handles:
 *  - Inverted First/Last names ("ACHRAF CHADILI" === "CHADILI ACHRAF")
 *  - Compound names ("MOHAMED AMINE BOUZIDY" === "BOUZIDY MOHAMED AMINE")
 *  - Stripped accents / punctuation ("Taoufik Zhiri" === "zhiri ttaoufik")
 *  - Disallows generic single-token or common first name collisions
 */
export function areNamesEquivalent(
  nameA: string | null | undefined,
  nameB: string | null | undefined
): { isMatch: boolean; reason?: string } {
  if (!nameA || !nameB) return { isMatch: false };

  const cleanA = normalizeNameForMatching(nameA);
  const cleanB = normalizeNameForMatching(nameB);

  // Exact clean match (e.g. "badiazahid" === "badiazahid")
  if (cleanA.length >= 6 && cleanA === cleanB) {
    return { isMatch: true, reason: `Exact clean string match "${cleanA}"` };
  }

  const tokensA = extractTokens(nameA);
  const tokensB = extractTokens(nameB);

  if (tokensA.length === 0 || tokensB.length === 0) return { isMatch: false };

  // If sorted tokens are identical (e.g. ["achraf", "chadili"] === ["chadili", "achraf"])
  const sortedA = [...tokensA].sort().join(" ");
  const sortedB = [...tokensB].sort().join(" ");
  if (sortedA === sortedB && tokensA.length >= 2) {
    return { isMatch: true, reason: `Sorted tokens match: ${sortedA}` };
  }

  // 1-to-1 bijection token matching
  const usedB = new Set<number>();
  const matchedPairs: Array<{ tA: string; tB: string }> = [];

  for (const tA of tokensA) {
    for (let i = 0; i < tokensB.length; i++) {
      if (usedB.has(i)) continue;
      const tB = tokensB[i];
      const isExact = tA === tB;
      if (isExact) {
        usedB.add(i);
        matchedPairs.push({ tA, tB });
        break;
      }
    }
  }

  // Require at least 2 distinct token matches AND at least one must be a unique surname
  if (matchedPairs.length >= 2) {
    const hasDistinctSurname = matchedPairs.some(
      (p) => !COMMON_FIRST_NAMES.has(p.tA) && !COMMON_FIRST_NAMES.has(p.tB)
    );
    if (hasDistinctSurname) {
      const pairStr = matchedPairs.map((p) => `${p.tA}<->${p.tB}`).join(", ");
      return { isMatch: true, reason: `2 distinct tokens with surname: ${pairStr}` };
    }
  }

  return { isMatch: false };
}

/**
 * Synchronizes a vehicle assignment from the Vehicles / Drivers page to the matching Lead record.
 * Ensures the lead moves to VEHICLE_ASSIGNMENT on the Training and Leads boards.
 */
export async function syncVehicleAssignmentToLead(
  driver: { fullName: string; phoneSanitized?: string | null },
  vehicle?: { id?: string; plate_number?: string } | null
): Promise<{ matched: boolean; leadId?: string; leadName?: string }> {
  try {
    const driverPhoneDigits = normalizePhoneForMatching(driver.phoneSanitized);
    const driverNormName = normalizeNameForMatching(driver.fullName);

    if (!driverPhoneDigits && driverNormName.length < 3) {
      return { matched: false };
    }

    // Retrieve active leads
    const leads = await prisma.lead.findMany({
      where: { is_archived: false },
      select: {
        id: true,
        raw_name: true,
        sanitized_phone: true,
        board_column: true,
        training_status: true,
        brand_status: true,
      },
    });

    const matchedLead = leads.find((l) => {
      const leadPhoneDigits = normalizePhoneForMatching(l.sanitized_phone);
      if (driverPhoneDigits.length >= 8 && leadPhoneDigits.length >= 8 && leadPhoneDigits === driverPhoneDigits) {
        return true;
      }
      // Name-only matching applies only to treated/training leads, never cold NEW_LEADS
      if (l.board_column === "NEW_LEADS") return false;
      return areNamesEquivalent(driver.fullName, l.raw_name).isMatch;
    });

    if (matchedLead) {
      const needsUpdate =
        matchedLead.board_column !== "VEHICLE_ASSIGNMENT" ||
        matchedLead.training_status !== "Assign vehicle";

      if (needsUpdate) {
        await prisma.lead.update({
          where: { id: matchedLead.id },
          data: {
            board_column: "VEHICLE_ASSIGNMENT",
            training_status: "Assign vehicle",
            brand_status: "Training fixed",
            status_changed_at: new Date(),
          },
        });
        console.log(
          `🚗 Reconciled lead ${matchedLead.raw_name} (${matchedLead.sanitized_phone}) -> VEHICLE_ASSIGNMENT (Vehicle: ${vehicle?.plate_number || "Active"})`
        );
        await touchSyncState("leads").catch(() => {});
      }

      return { matched: true, leadId: matchedLead.id, leadName: matchedLead.raw_name };
    }

    return { matched: false };
  } catch (err: any) {
    console.error("syncVehicleAssignmentToLead error:", err?.message);
    return { matched: false };
  }
}

/**
 * Full reconciliation scan: Compares all active vehicles & assigned drivers
 * against the Leads / Training pipeline and updates any matching leads to VEHICLE_ASSIGNMENT.
 */
export async function reconcileAllVehicleAssignmentsWithLeads(): Promise<{
  totalAssignedVehicles: number;
  reconciledLeadsCount: number;
  updatedLeads: Array<{ leadName: string; phone: string; plateNumber: string; reason: string }>;
}> {
  try {
    const [vehicles, drivers, leads] = await Promise.all([
      prisma.vehicle.findMany({
        where: {
          assigned_driver_name: { not: null },
          is_archived: false,
        },
        select: {
          id: true,
          plate_number: true,
          status: true,
          assigned_driver_name: true,
          assigned_driver_phone: true,
          updated_at: true,
        },
      }),
      prisma.driverProfile.findMany({
        where: {
          assignedVehicleId: { not: null },
          is_archived: false,
        },
        select: {
          id: true,
          fullName: true,
          phoneSanitized: true,
          assignedVehicle: {
            select: { id: true, plate_number: true },
          },
        },
      }),
      prisma.lead.findMany({
        where: { is_archived: false },
        select: {
          id: true,
          raw_name: true,
          sanitized_phone: true,
          board_column: true,
          training_status: true,
          brand_status: true,
        },
      }),
    ]);

    const updatedLeads: Array<{ leadName: string; phone: string; plateNumber: string; reason: string }> = [];

    // Map all driver-vehicle pairs from both Vehicle and DriverProfile
    const driverVehiclePairs = new Map<string, { fullName: string; phoneSanitized: string; plateNumber: string }>();

    for (const v of vehicles) {
      if (v.assigned_driver_name) {
        const key = `${normalizeNameForMatching(v.assigned_driver_name)}_${normalizePhoneForMatching(v.assigned_driver_phone)}`;
        driverVehiclePairs.set(key, {
          fullName: v.assigned_driver_name,
          phoneSanitized: v.assigned_driver_phone || "",
          plateNumber: v.plate_number,
        });
      }
    }

    for (const d of drivers) {
      if (d.fullName && d.assignedVehicle) {
        const key = `${normalizeNameForMatching(d.fullName)}_${normalizePhoneForMatching(d.phoneSanitized)}`;
        if (!driverVehiclePairs.has(key)) {
          driverVehiclePairs.set(key, {
            fullName: d.fullName,
            phoneSanitized: d.phoneSanitized,
            plateNumber: d.assignedVehicle.plate_number,
          });
        }
      }
    }

    for (const pair of driverVehiclePairs.values()) {
      const pairPhoneDigits = normalizePhoneForMatching(pair.phoneSanitized);

      let matchReason = "";
      const matchedLead = leads.find((l) => {
        const lPhoneDigits = normalizePhoneForMatching(l.sanitized_phone);
        if (pairPhoneDigits.length >= 8 && lPhoneDigits.length >= 8 && pairPhoneDigits === lPhoneDigits) {
          matchReason = `Phone match (${pairPhoneDigits})`;
          return true;
        }
        // Name-only matching applies only to treated/training leads, never cold NEW_LEADS
        if (l.board_column === "NEW_LEADS") return false;

        const nameRes = areNamesEquivalent(pair.fullName, l.raw_name);
        if (nameRes.isMatch) {
          matchReason = nameRes.reason || "Name match";
          return true;
        }
        return false;
      });

      if (matchedLead) {
        const needsUpdate =
          matchedLead.board_column !== "VEHICLE_ASSIGNMENT" ||
          matchedLead.training_status !== "Assign vehicle";

        if (needsUpdate) {
          await prisma.lead.update({
            where: { id: matchedLead.id },
            data: {
              board_column: "VEHICLE_ASSIGNMENT",
              training_status: "Assign vehicle",
              brand_status: "Training fixed",
              status_changed_at: new Date(),
            },
          });

          updatedLeads.push({
            leadName: matchedLead.raw_name,
            phone: matchedLead.sanitized_phone,
            plateNumber: pair.plateNumber,
            reason: matchReason,
          });

          // Update local memory representation to prevent re-updating
          matchedLead.board_column = "VEHICLE_ASSIGNMENT";
          matchedLead.training_status = "Assign vehicle";
        }
      }
    }

    if (updatedLeads.length > 0) {
      await touchSyncState("leads").catch(() => {});
    }

    return {
      totalAssignedVehicles: driverVehiclePairs.size,
      reconciledLeadsCount: updatedLeads.length,
      updatedLeads,
    };
  } catch (err: any) {
    console.error("reconcileAllVehicleAssignmentsWithLeads error:", err);
    return {
      totalAssignedVehicles: 0,
      reconciledLeadsCount: 0,
      updatedLeads: [],
    };
  }
}
