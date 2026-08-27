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
      "drivername", "chauffeur", "prenom",
    ],
  },
  {
    field: "phone",
    patterns: [
      "phonenumber", "phone", "telephone", "tel", "numero",
      "mobile", "gsm", "whatsapp",
    ],
  },
  {
    field: "city",
    patterns: [
      "city", "ville", "region", "hub",
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
  return val?.trim() || undefined;
}
