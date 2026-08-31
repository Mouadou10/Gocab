/**
 * Fuzzy CSV Header Matcher
 *
 * Normalizes incoming CSV headers and maps them to expected fields
 * regardless of casing, accents, separators, or minor variations.
 *
 * Examples that all match "phone":
 *   "Phone Number", "phone_number", "Téléphone", "PHONE", "phone", "Tel", "Numéro"
 *
 * Examples that all match "name":
 *   "Lead Name", "Name", "Nom", "Full Name", "full_name", "NOM COMPLET"
 *
 * Examples that all match "city":
 *   "City", "Ville", "CITY", "ville"
 */

/** Strip accents, lowercase, remove all non-alpha characters */
function normalize(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove spaces, underscores, dashes, etc.
}

interface FieldMatcher {
  /** Canonical field name */
  field: string;
  /** Normalized substrings that indicate this field */
  patterns: string[];
}

const FIELD_MATCHERS: FieldMatcher[] = [
  {
    field: "name",
    patterns: [
      "leadname", "name", "nom", "fullname", "nomcomplet",
      "drivername", "chauffeur", "prenom", "client", "prospect",
    ],
  },
  {
    field: "phone",
    patterns: [
      "phonenumber", "phone", "telephone", "tel", "numero",
      "mobile", "gsm", "whatsapp", "contact",
    ],
  },
  {
    field: "city",
    patterns: [
      "city", "ville", "region", "hub", "location", "localisation",
    ],
  },
  {
    field: "status",
    patterns: [
      "status", "statut", "column", "boardcolumn", "brandstatus",
      "trainingstatus", "pipeline", "etat", "etape", "stage", "colonne",
    ],
  },
  {
    field: "date",
    patterns: [
      "datereceived", "date", "createdat", "daterecue",
    ],
  },
  {
    field: "cin",
    patterns: [
      "cin", "cinnumber", "identite", "numerocin",
    ],
  },
  {
    field: "contract_type",
    patterns: [
      "contracttype", "typecontrat", "contrat", "contract",
    ],
  },
  {
    field: "plate_number",
    patterns: [
      "platenumber", "plate", "immatriculation", "matricule",
    ],
  },
  {
    field: "arrears",
    patterns: [
      "impayesmad", "impayes", "arrears", "dette", "debt",
      "currentarrearsmad",
    ],
  },
];

export interface HeaderMapping {
  /** Map from canonical field name → original CSV header */
  mapping: Record<string, string>;
  /** Headers that couldn't be matched */
  unmapped: string[];
}

/**
 * Given an array of raw CSV headers, returns a mapping from canonical
 * field names to the original header strings.
 */
export function matchHeaders(rawHeaders: string[]): HeaderMapping {
  const mapping: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const rawHeader of rawHeaders) {
    const norm = normalize(rawHeader);
    let matched = false;

    for (const matcher of FIELD_MATCHERS) {
      // Check if the normalized header matches or contains any pattern
      const isMatch = matcher.patterns.some(
        (pattern) => norm === pattern || norm.includes(pattern)
      );

      if (isMatch && !mapping[matcher.field]) {
        mapping[matcher.field] = rawHeader;
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmapped.push(rawHeader);
    }
  }

  return { mapping, unmapped };
}

/**
 * Extract a value from a CSV row using the header mapping.
 * Falls back gracefully if the field isn't mapped.
 */
export function getField(
  row: Record<string, string>,
  mapping: Record<string, string>,
  canonicalField: string
): string | undefined {
  const originalHeader = mapping[canonicalField];
  if (!originalHeader) return undefined;
  const val = row[originalHeader];
  return val !== undefined && val !== null && val.trim() !== "" ? val.trim() : undefined;
}

/**
 * Maps a raw status string from CSV to the appropriate CRM column & status fields:
 * - board_column
 * - brand_status
 * - training_status
 */
export function resolveLeadStatus(rawStatus?: string): {
  board_column: string;
  brand_status: string | null;
  training_status: string | null;
} {
  if (!rawStatus || !rawStatus.trim()) {
    return { board_column: "NEW_LEADS", brand_status: null, training_status: null };
  }

  const rawTrimmed = rawStatus.trim();
  const normalized = rawTrimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // 1. Brand Pre-Filter columns (Leads Tab)
  if (
    normalized === "not interested" ||
    normalized.includes("not interest") ||
    normalized.includes("pas inter") ||
    normalized.includes("non inter") ||
    normalized.includes("refus")
  ) {
    return { board_column: "BRAND_PRE_FILTER", brand_status: "Not interested", training_status: null };
  }

  if (
    normalized === "nrp1" ||
    normalized === "nrp 1" ||
    normalized.includes("no response 1") ||
    normalized.includes("pas de reponse 1") ||
    normalized.includes("sans reponse 1") ||
    normalized.includes("no answer 1")
  ) {
    return { board_column: "BRAND_PRE_FILTER", brand_status: "No response 1", training_status: null };
  }

  if (
    normalized === "nrp2" ||
    normalized === "nrp 2" ||
    normalized.includes("no response 2") ||
    normalized.includes("pas de reponse 2") ||
    normalized.includes("sans reponse 2") ||
    normalized.includes("no answer 2")
  ) {
    return { board_column: "BRAND_PRE_FILTER", brand_status: "No response 2", training_status: null };
  }

  if (
    normalized.includes("training fix") ||
    normalized.includes("formation fix") ||
    normalized.includes("rdv formation") ||
    normalized.includes("formation prevue")
  ) {
    return { board_column: "BRAND_PRE_FILTER", brand_status: "Training fixed", training_status: null };
  }

  if (
    normalized.includes("recall") ||
    normalized.includes("rappeler") ||
    normalized.includes("callback") ||
    normalized === "to recall"
  ) {
    return { board_column: "BRAND_PRE_FILTER", brand_status: "To Recall", training_status: null };
  }

  if (
    normalized.includes("wrong number") ||
    normalized.includes("faux numero") ||
    normalized.includes("mauvais numero") ||
    normalized.includes("invalid number")
  ) {
    return { board_column: "BRAND_PRE_FILTER", brand_status: "Wrong number", training_status: null };
  }

  if (
    normalized.includes("already a client") ||
    normalized.includes("already client") ||
    normalized.includes("deja client") ||
    normalized.includes("client existant")
  ) {
    return { board_column: "BRAND_PRE_FILTER", brand_status: "Already a client", training_status: null };
  }

  // 2. Training Pipeline columns (Training Tab)
  if (
    normalized.includes("vehicle assignment") ||
    normalized.includes("assignation") ||
    normalized.includes("attribution") ||
    normalized === "vehicle_assignment"
  ) {
    return { board_column: "VEHICLE_ASSIGNMENT", brand_status: null, training_status: "Accept offer" };
  }

  if (
    normalized.includes("accept offer") ||
    normalized.includes("offre acceptee") ||
    normalized.includes("accepte l'offre") ||
    normalized === "accepte" ||
    normalized === "accepted"
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "Accept offer" };
  }

  if (
    normalized.includes("attended and not") ||
    normalized.includes("present et non") ||
    normalized.includes("present et pas")
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "Attended and not interested" };
  }

  if (
    normalized.includes("not attended") ||
    normalized.includes("absent") ||
    normalized.includes("non present") ||
    normalized.includes("pas venu")
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "Not attended" };
  }

  if (
    normalized.includes("attended") ||
    normalized.includes("present") ||
    normalized.includes("assiste")
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "Attended" };
  }

  if (
    normalized.includes("refused the offer") ||
    normalized.includes("offre refusee") ||
    normalized.includes("refus offre")
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "Refused the offer" };
  }

  if (
    normalized.includes("preorder") ||
    normalized.includes("precommande") ||
    normalized.includes("acompte") ||
    normalized.includes("pre-order")
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "Preorder" };
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("en attente") ||
    normalized.includes("en cours")
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "Pending" };
  }

  if (
    normalized.includes("scheduled") ||
    normalized.includes("programme") ||
    normalized.includes("planifie")
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "Scheduled" };
  }

  if (
    normalized === "nrp" ||
    normalized.includes("no response") ||
    normalized.includes("pas de reponse") ||
    normalized.includes("sans reponse")
  ) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: "No response" };
  }

  // 3. New Leads column
  if (
    normalized === "new_leads" ||
    normalized === "new leads" ||
    normalized === "new" ||
    normalized === "nouveau" ||
    normalized === "nouveaux" ||
    normalized === "nouveaux leads" ||
    normalized === "nouveau lead"
  ) {
    return { board_column: "NEW_LEADS", brand_status: null, training_status: null };
  }

  // Fallback: Check case-insensitive exact matching
  const knownBrandCols = [
    "Not interested",
    "No response 1",
    "Training fixed",
    "To Recall",
    "Wrong number",
    "No response 2",
    "Already a client",
  ];
  const matchedBrand = knownBrandCols.find((c) => c.toLowerCase() === rawTrimmed.toLowerCase());
  if (matchedBrand) {
    return { board_column: "BRAND_PRE_FILTER", brand_status: matchedBrand, training_status: null };
  }

  const knownTrainingCols = [
    "Scheduled",
    "Attended",
    "Attended and not interested",
    "Pending",
    "Refused the offer",
    "Accept offer",
    "Not attended",
    "No response",
    "Preorder",
  ];
  const matchedTraining = knownTrainingCols.find((c) => c.toLowerCase() === rawTrimmed.toLowerCase());
  if (matchedTraining) {
    return { board_column: "TRAINING_PIPELINE", brand_status: null, training_status: matchedTraining };
  }

  // Default to NEW_LEADS
  return { board_column: "NEW_LEADS", brand_status: null, training_status: null };
}
