/**
 * National Blacklist Matching Engine (Moroccan Rental Car Blacklist)
 *
 * Implements intelligent, transliteration-tolerant fuzzy matching for Moroccan names
 * against the official regional/national blacklist ("LISTE NOIR REGION CASA SETTAT").
 *
 * Handles:
 * - Word order inversions (e.g. "ABAZAOUIA JALAL" vs "JALAL ABAZAOUIA")
 * - Transliteration & spelling variances ("MOHAMED" vs "MOHAMMED" vs "MED", "AAMAR" vs "AMAR", "KOUDDOUS" vs "KOUDOUS")
 * - Detached/attached particles ("EL AMRANI" vs "ELAMRANI" vs "AMRANI", "BENCHEIKH" vs "BEN CHEIKH")
 * - Moroccan phonetics ("OU" vs "W" / "U", duplicate consonants, trailing vowels)
 * - Accents and special character stripping
 */

import blacklistData from "@/data/national_blacklist.json";

export interface NationalBlacklistEntry {
  id: string;
  fullName: string;
  city: string;
  reason: string;
  date: string;
  normalizedName: string;
}

export type MatchConfidence = "EXACT" | "HIGH" | "MEDIUM" | "NONE";

export interface NationalBlacklistMatchResult {
  isBlacklisted: boolean;
  matchType: MatchConfidence;
  score: number; // 0.0 to 1.0
  matchedEntry: NationalBlacklistEntry | null;
  warningBadgeText: string;
  warningDetailText: string;
}

interface PreindexedSignature {
  raw: string;
  baseTokens: string[];
  harmonizedTokens: string[];
  canonical: string;
  harmonizedCanonical: string;
}

interface IndexedEntry {
  entry: NationalBlacklistEntry;
  sig: PreindexedSignature;
}

function stripDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function cleanNameString(str: string): string {
  if (!str) return "";
  return stripDiacritics(str)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Harmonize Moroccan name phonetics and spelling variations
 */
export function harmonizeToken(token: string): string {
  if (!token) return "";
  let t = token.toUpperCase();

  // Common Moroccan first name abbreviations
  if (["MED", "MHD", "MD", "MOHD", "SIMOHAMED", "SIMOHAMMED", "SI MOHAMED"].includes(t)) {
    return "MOHAMED";
  }

  // Common Moroccan compound name standardizations
  if (t === "ABDOUL" || t === "ABDEL" || t === "ABD") {
    return "ABDEL";
  }

  // Collapse double consonants and vowels
  t = t
    .replace(/AA/g, "A")
    .replace(/EE/g, "E")
    .replace(/II/g, "I")
    .replace(/OO/g, "O")
    .replace(/MM/g, "M")
    .replace(/DD/g, "D")
    .replace(/SS/g, "S")
    .replace(/LL/g, "L")
    .replace(/BB/g, "B")
    .replace(/TT/g, "T")
    .replace(/RR/g, "R")
    .replace(/FF/g, "F")
    .replace(/KK/g, "K")
    .replace(/ZZ/g, "Z")
    .replace(/NN/g, "N");

  // Transliteration variants: OU <-> W / U at start of syllable
  if (t.startsWith("OU") && t.length > 2 && ["A", "E", "I", "O", "Y"].includes(t[2])) {
    t = "W" + t.slice(2);
  }

  // Moroccan suffixes
  if (t.endsWith("INE")) {
    t = t.slice(0, -3) + "IN";
  }
  if (t.endsWith("ANE") && t.length > 4) {
    t = t.slice(0, -3) + "AN";
  }
  if (t.endsWith("E") && t.length > 4 && !["E", "I", "O", "U"].includes(t[t.length - 2])) {
    t = t.slice(0, -1);
  }

  return t;
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row: number[] = [];
  for (let i = 0; i <= b.length; i++) row[i] = i;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val: number;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return (maxLen - levenshteinDistance(a, b)) / maxLen;
}

export function extractTokens(name: string): PreindexedSignature {
  const cleaned = cleanNameString(name);
  if (!cleaned) {
    return {
      raw: "",
      baseTokens: [],
      harmonizedTokens: [],
      canonical: "",
      harmonizedCanonical: "",
    };
  }

  const rawTokens = cleaned.split(" ").filter(Boolean);
  const expandedTokens: string[] = [];

  for (const t of rawTokens) {
    if ((t.startsWith("EL") || t.startsWith("AL")) && t.length > 3) {
      expandedTokens.push("EL");
      expandedTokens.push(t.slice(2));
    } else if (t.startsWith("BEN") && t.length > 4) {
      expandedTokens.push("BEN");
      expandedTokens.push(t.slice(3));
    } else if (t.startsWith("AIT") && t.length > 4) {
      expandedTokens.push("AIT");
      expandedTokens.push(t.slice(3));
    } else if (t.startsWith("ABOU") && t.length > 5) {
      expandedTokens.push("ABOU");
      expandedTokens.push(t.slice(4));
    } else {
      expandedTokens.push(t);
    }
  }

  // Filter out standalone particles when constructing root token comparison
  const significantTokens = expandedTokens.filter(
    (t) => !["EL", "AL", "BEN", "IBN", "AIT", "ABOU", "BOU", "OULD", "DE"].includes(t)
  );
  const baseTokens = significantTokens.length > 0 ? significantTokens : expandedTokens;
  const harmonized = baseTokens.map(harmonizeToken).filter(Boolean);

  return {
    raw: cleaned,
    baseTokens,
    harmonizedTokens: harmonized,
    canonical: [...baseTokens].sort().join(" "),
    harmonizedCanonical: [...harmonized].sort().join(" "),
  };
}

// In-memory pre-indexed blacklist
const preindexedBlacklist: IndexedEntry[] = (blacklistData as NationalBlacklistEntry[]).map((entry) => ({
  entry,
  sig: extractTokens(entry.fullName),
}));

/**
 * Matches any input name against the 1,075 records of the National / Regional Red Flag Blacklist.
 */
export function matchNationalBlacklist(
  queryName: string | null | undefined,
  options: { threshold?: number } = {}
): NationalBlacklistMatchResult {
  const threshold = options.threshold ?? 0.82;

  if (!queryName || queryName.trim().length < 3) {
    return {
      isBlacklisted: false,
      matchType: "NONE",
      score: 0,
      matchedEntry: null,
      warningBadgeText: "",
      warningDetailText: "",
    };
  }

  const qSig = extractTokens(queryName);
  if (qSig.baseTokens.length === 0) {
    return {
      isBlacklisted: false,
      matchType: "NONE",
      score: 0,
      matchedEntry: null,
      warningBadgeText: "",
      warningDetailText: "",
    };
  }

  const isSingleToken = qSig.baseTokens.length < 2;

  let bestMatch: NationalBlacklistEntry | null = null;
  let highestScore = 0;
  let matchType: MatchConfidence = "NONE";

  for (const item of preindexedBlacklist) {
    const bSig = item.sig;

    // 1. Direct exact match
    if (qSig.raw === bSig.raw) {
      return buildResult(item.entry, "EXACT", 1.0);
    }

    // 2. Exact word-order permutation match (e.g. "ABAZAOUIA JALAL" vs "JALAL ABAZAOUIA")
    if (qSig.canonical === bSig.canonical) {
      return buildResult(item.entry, "EXACT", 1.0);
    }

    // 3. Exact harmonized canonical match (e.g. "AAMAR ABDELKOUDDOUS" vs "AMAR ABDELKOUDOUS")
    if (qSig.harmonizedCanonical === bSig.harmonizedCanonical) {
      return buildResult(item.entry, "EXACT", 0.98);
    }

    // Prevent matching 1-word generic first names (e.g. "Mohamed" matching everyone)
    if (isSingleToken) {
      continue;
    }

    const qTokens = qSig.harmonizedTokens;
    const bTokens = bSig.harmonizedTokens;
    if (qTokens.length === 0 || bTokens.length === 0) continue;

    // Require both tokens to match with an individual similarity >= 0.78
    const usedB = new Set<number>();
    const pairScores: number[] = [];

    for (const qt of qTokens) {
      let bestSim = 0;
      let bestBIdx = -1;
      for (let bi = 0; bi < bTokens.length; bi++) {
        if (usedB.has(bi)) continue;
        const sim = stringSimilarity(qt, bTokens[bi]);
        if (sim > bestSim) {
          bestSim = sim;
          bestBIdx = bi;
        }
      }
      if (bestSim >= 0.78 && bestBIdx !== -1) {
        usedB.add(bestBIdx);
        pairScores.push(bestSim);
      }
    }

    // Both words must find a match, and at least 80% of candidate's tokens must match
    if (pairScores.length >= 2 && pairScores.length / qTokens.length >= 0.8) {
      const avgPairScore = pairScores.reduce((a, b) => a + b, 0) / pairScores.length;
      const coverage = pairScores.length / Math.max(qTokens.length, bTokens.length);
      const overallScore = avgPairScore * 0.7 + coverage * 0.3;

      if (overallScore > highestScore) {
        highestScore = overallScore;
        bestMatch = item.entry;
        if (overallScore >= 0.9) {
          matchType = "HIGH";
        } else if (overallScore >= 0.82) {
          matchType = "MEDIUM";
        }
      }
    }
  }

  if (highestScore >= threshold && bestMatch) {
    return buildResult(bestMatch, matchType, Math.round(highestScore * 100) / 100);
  }

  return {
    isBlacklisted: false,
    matchType: "NONE",
    score: 0,
    matchedEntry: null,
    warningBadgeText: "",
    warningDetailText: "",
  };
}

function buildResult(
  entry: NationalBlacklistEntry,
  matchType: MatchConfidence,
  score: number
): NationalBlacklistMatchResult {
  const percent = Math.round(score * 100);
  const confidenceLabel =
    matchType === "EXACT"
      ? "Correspondance exacte"
      : matchType === "HIGH"
      ? `Forte probabilité (${percent}%)`
      : `Probabilité moyenne (${percent}%)`;

  const reasonText = entry.reason || "Signalé sur liste noire";
  const cityText = entry.city ? ` · ${entry.city}` : "";
  const dateText = entry.date && entry.date !== "Non daté" ? ` (Date: ${entry.date})` : "";

  return {
    isBlacklisted: true,
    matchType,
    score,
    matchedEntry: entry,
    warningBadgeText: `🚨 LISTE NOIRE (${percent}%)`,
    warningDetailText: `🚨 LISTE NOIRE NATIONALE (Région Casa-Settat) : ${entry.fullName}${cityText} · Motif : ${reasonText}${dateText} · [${confidenceLabel}]`,
  };
}

/**
 * Returns all national blacklist entries.
 */
export function getAllNationalBlacklistEntries(): NationalBlacklistEntry[] {
  return blacklistData as NationalBlacklistEntry[];
}
