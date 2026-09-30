/**
 * Vidange Statistics & Classification Engine
 *
 * Extracts and calculates vidange counts (Simple vs Complète) for vehicles
 * based strictly on SOLVED / RESOLVED maintenance tickets.
 */

export interface VidangeRecord {
  ticket_id: string;
  date: string;
  resolved_at: string | null;
  status: string;
  is_solved: boolean;
  type: "Vidange Complète" | "Vidange Simple";
  cost: number;
  garage: string;
  bc_number: string | null;
  description: string;
}

export interface VidangeStats {
  total: number; // Count of SOLVED vidanges
  simpleCount: number; // Count of SOLVED simple vidanges
  completeCount: number; // Count of SOLVED complete vidanges
  allTotal: number; // Total including open/pending
  openCount: number; // Currently open/in-progress
  lastVidangeDate: string | null;
  lastVidangeType: "Vidange Complète" | "Vidange Simple" | null;
  history: VidangeRecord[];
}

/**
 * Given a list of maintenance tickets for a vehicle, extracts vidange history
 * and computes the count of completed vidanges by category (Simple vs Complète)
 * based strictly on resolved tickets.
 */
export function extractVidangeStatsFromTickets(tickets: any[]): VidangeStats {
  const vidanges: VidangeRecord[] = [];
  let solvedSimple = 0;
  let solvedComplete = 0;
  let openCount = 0;

  for (const t of tickets || []) {
    let parsedBc: any = null;
    if (t.resolution_notes) {
      try {
        const parsed =
          typeof t.resolution_notes === "string"
            ? JSON.parse(t.resolution_notes)
            : t.resolution_notes;
        if (parsed?.bon_de_commande) {
          parsedBc = parsed.bon_de_commande;
        }
      } catch {
        // Not JSON
      }
    }

    const ticketTypeStr = (t.ticket_type || "").trim().toLowerCase();
    const isVidangeTicket = ticketTypeStr === "vidange";
    let hasVidangeBcItem = false;
    let vidangeBcType: "Vidange Complète" | "Vidange Simple" | null = null;

    if (parsedBc && Array.isArray(parsedBc.items)) {
      for (const it of parsedBc.items) {
        const des = (it.designation || "").toLowerCase();
        if (des.includes("vidange")) {
          hasVidangeBcItem = true;
          if (des.includes("complète") || des.includes("complete")) {
            vidangeBcType = "Vidange Complète";
          } else {
            vidangeBcType = "Vidange Simple";
          }
        }
      }
    }

    const desc = (t.description || "").toLowerCase();
    const hasVidangeInDesc = desc.includes("vidange");

    if (isVidangeTicket || hasVidangeBcItem || hasVidangeInDesc) {
      let typeStr: "Vidange Complète" | "Vidange Simple" = "Vidange Simple";
      if (vidangeBcType) {
        typeStr = vidangeBcType;
      } else if (
        desc.includes("complète") ||
        desc.includes("complete") ||
        (t.repair_cost && t.repair_cost >= 900)
      ) {
        typeStr = "Vidange Complète";
      }

      const statusUpper = (t.status || "").toUpperCase();
      const isSolved = statusUpper === "RESOLVED" || statusUpper === "SOLVED";

      if (isSolved) {
        if (typeStr === "Vidange Complète") {
          solvedComplete++;
        } else {
          solvedSimple++;
        }
      } else {
        openCount++;
      }

      vidanges.push({
        ticket_id: t.id,
        date: t.created_at
          ? new Date(t.created_at).toISOString()
          : new Date().toISOString(),
        resolved_at: t.resolved_at ? new Date(t.resolved_at).toISOString() : null,
        status: t.status,
        is_solved: isSolved,
        type: typeStr,
        cost: t.repair_cost || (typeStr === "Vidange Complète" ? 960 : 530),
        garage: t.garage_name || parsedBc?.supplier_name || "Hard Auto Services",
        bc_number: parsedBc?.bc_number || null,
        description: t.description || "",
      });
    }
  }

  // Sort history: latest date first
  vidanges.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Find last solved vidange
  const lastSolved = vidanges.find((v) => v.is_solved) || null;

  return {
    total: solvedSimple + solvedComplete,
    simpleCount: solvedSimple,
    completeCount: solvedComplete,
    allTotal: vidanges.length,
    openCount,
    lastVidangeDate: lastSolved
      ? lastSolved.resolved_at || lastSolved.date
      : null,
    lastVidangeType: lastSolved ? lastSolved.type : null,
    history: vidanges,
  };
}
