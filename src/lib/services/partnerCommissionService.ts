/**
 * Partner Commission Service — Third-Party Referrer Program (Apporteurs d'Affaires)
 *
 * Implements business logic for external business referrers (e.g. Zakaria):
 * - Partners introduce driver candidates wanting to take a car or deposit a preorder.
 * - Commission Rule: 150 MAD per driver confirmed to:
 *     1. Take a vehicle (VEHICLE_ASSIGNMENT / Assign vehicle / Accept offer)
 *     2. OR Deposit a preorder (Preorder / preorder_amount > 0)
 * - Real-time calculation reflecting onboarding confirmations immediately.
 */

import { prisma } from "@/lib/prisma";

export const PARTNER_COMMISSION_RATE_MAD = 150;

export interface PartnerLeadEvaluation {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  createdAt: string;
  updatedAt: string;
  boardColumn: string;
  brandStatus: string | null;
  trainingStatus: string | null;
  preorderAmount: number | null;
  notes: string | null;
  isConverted: boolean;
  conversionReason: "VEHICLE_ASSIGNED" | "PREORDER_DEPOSITED" | null;
  commissionMAD: number;
  status: "VALIDATED" | "PENDING" | "LOST";
  statusLabel: string;
  stageBadgeColor: "emerald" | "amber" | "slate" | "rose" | "blue";
}

export interface PartnerSummary {
  partnerName: string;
  partnerSlug: string;
  totalLeads: number;
  convertedLeads: number;
  pendingLeads: number;
  lostLeads: number;
  totalCommissionEarnedMAD: number;
  potentialPendingCommissionMAD: number;
  commissionRateMAD: number;
  conversionRatePct: number;
  leads: PartnerLeadEvaluation[];
}

/**
 * Evaluates whether a lead has satisfied the condition to earn the 150 MAD partner commission.
 */
export function evaluateLeadCommission(lead: {
  id: string;
  raw_name?: string | null;
  sanitized_phone?: string | null;
  city?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
  board_column?: string | null;
  brand_status?: string | null;
  training_status?: string | null;
  preorder_amount?: number | null;
  notes?: string | null;
}): PartnerLeadEvaluation {
  const boardCol = (lead.board_column || "NEW_LEADS").trim();
  const brandStat = (lead.brand_status || "").trim();
  const trainStat = (lead.training_status || "").trim();
  const preorderAmt = typeof lead.preorder_amount === "number" ? lead.preorder_amount : 0;

  // 1. Condition A: Person took a car / assigned vehicle
  const takesCar =
    boardCol === "VEHICLE_ASSIGNMENT" ||
    trainStat.toLowerCase() === "assign vehicle" ||
    trainStat.toLowerCase() === "accept offer" ||
    trainStat.toLowerCase() === "car taken";

  // 2. Condition B: Person deposited a preorder
  const depositsPreorder =
    trainStat.toLowerCase() === "preorder" ||
    preorderAmt > 0;

  // Evaluation outcome
  const isConverted = takesCar || depositsPreorder;

  let conversionReason: "VEHICLE_ASSIGNED" | "PREORDER_DEPOSITED" | null = null;
  if (takesCar) {
    conversionReason = "VEHICLE_ASSIGNED";
  } else if (depositsPreorder) {
    conversionReason = "PREORDER_DEPOSITED";
  }

  // Check if lost / dropped out
  const brandStatLower = brandStat.toLowerCase();
  const trainStatLower = trainStat.toLowerCase();

  const isLost =
    !isConverted &&
    (brandStatLower === "not interested" ||
      brandStatLower === "wrong number" ||
      brandStatLower === "no response 2" ||
      brandStatLower === "hors zone" ||
      brandStatLower === "already a client" ||
      trainStatLower === "refused the offer" ||
      trainStatLower === "not attended" ||
      trainStatLower === "attended and not interested");

  let status: "VALIDATED" | "PENDING" | "LOST" = "PENDING";
  let commissionMAD = 0;
  let statusLabel = "⏳ En cours de qualification";
  let stageBadgeColor: PartnerLeadEvaluation["stageBadgeColor"] = "amber";

  if (isConverted) {
    status = "VALIDATED";
    commissionMAD = PARTNER_COMMISSION_RATE_MAD;
    stageBadgeColor = "emerald";
    statusLabel = takesCar
      ? "🚗 Véhicule Assigné (+150 DH)"
      : `💵 Précommande Versée (${preorderAmt > 0 ? preorderAmt + " DH" : "Validée"} • +150 DH)`;
  } else if (isLost) {
    status = "LOST";
    commissionMAD = 0;
    stageBadgeColor = "rose";
    statusLabel = brandStat ? `❌ Non converti (${brandStat})` : "❌ Non converti";
  } else {
    status = "PENDING";
    commissionMAD = 0;
    stageBadgeColor = "blue";
    if (boardCol === "NEW_LEADS") {
      statusLabel = "✨ Nouveau dossier (En attente appel)";
    } else if (brandStatLower === "training fixed") {
      statusLabel = "📅 Formation fixée (Entretien programmé)";
    } else if (trainStatLower === "scheduled") {
      statusLabel = "📅 Session formation programmée";
    } else if (trainStatLower === "attended") {
      statusLabel = "✅ Formation suivie (Choix véhicule en cours)";
    } else if (trainStatLower === "pending") {
      statusLabel = "⏳ Dossier en cours de revue";
    } else if (brandStat) {
      statusLabel = `📞 Suivi (${brandStat})`;
    } else {
      statusLabel = "⏳ En cours de traitement";
    }
  }

  return {
    id: lead.id,
    name: lead.raw_name || "Chauffeur",
    phone: lead.sanitized_phone || "",
    city: lead.city || "Maroc",
    createdAt: lead.created_at ? new Date(lead.created_at).toISOString() : new Date().toISOString(),
    updatedAt: lead.updated_at ? new Date(lead.updated_at).toISOString() : new Date().toISOString(),
    boardColumn: boardCol,
    brandStatus: brandStat || null,
    trainingStatus: trainStat || null,
    preorderAmount: lead.preorder_amount ?? null,
    notes: lead.notes || null,
    isConverted,
    conversionReason,
    commissionMAD,
    status,
    statusLabel,
    stageBadgeColor,
  };
}

/**
 * Fetches all leads brought by a specific partner and computes the complete commission ledger.
 */
export async function getPartnerSummary(partnerNameOrSlug: string): Promise<PartnerSummary> {
  const normalized = (partnerNameOrSlug || "zakaria").trim();
  const displayName = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();

  // Search by exact referrer_name OR campaign_source containing the partner's name
  const leads = await prisma.lead.findMany({
    where: {
      is_archived: false,
      OR: [
        { referrer_name: { equals: displayName } },
        { referrer_name: { equals: normalized } },
        { campaign_source: { contains: displayName } },
        { campaign_source: { contains: normalized } },
      ],
    },
    orderBy: [
      { created_at: "desc" },
      { updated_at: "desc" },
    ],
  });

  const evaluatedLeads = leads.map((l) => evaluateLeadCommission(l));

  const totalLeads = evaluatedLeads.length;
  const convertedLeads = evaluatedLeads.filter((l) => l.isConverted).length;
  const lostLeads = evaluatedLeads.filter((l) => l.status === "LOST").length;
  const pendingLeads = totalLeads - convertedLeads - lostLeads;

  const totalCommissionEarnedMAD = convertedLeads * PARTNER_COMMISSION_RATE_MAD;
  const potentialPendingCommissionMAD = pendingLeads * PARTNER_COMMISSION_RATE_MAD;
  const conversionRatePct = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return {
    partnerName: displayName,
    partnerSlug: normalized.toLowerCase(),
    totalLeads,
    convertedLeads,
    pendingLeads,
    lostLeads,
    totalCommissionEarnedMAD,
    potentialPendingCommissionMAD,
    commissionRateMAD: PARTNER_COMMISSION_RATE_MAD,
    conversionRatePct,
    leads: evaluatedLeads,
  };
}
