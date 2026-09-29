/**
 * Attestation Date & 1-Month Renewal Period Calculator
 * 
 * Handles French written dates ("15 septembre 2026"), standard ISO dates ("2026-09-29"),
 * and slash dates ("15/09/2026"). Calculates the 1-month rental period and days remaining
 * until the next month-end expiration warning.
 */

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

/**
 * Parses any date string (French prose, ISO, or DD/MM/YYYY) into a valid Date object.
 */
export function parseAttestationDate(dateStr: string | null | undefined): Date {
  if (!dateStr || typeof dateStr !== "string") {
    return new Date();
  }

  const trimmed = dateStr.trim();

  // 1. Try French prose date: e.g. "15 septembre 2026" or "1er octobre 2026"
  const frenchMatch = trimmed.match(/^(\d{1,2})(?:er)?\s+([a-zA-Z\u00C0-\u017F]+)\s+(\d{4})/i);
  if (frenchMatch) {
    const day = parseInt(frenchMatch[1], 10);
    const monthRaw = frenchMatch[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const year = parseInt(frenchMatch[3], 10);

    for (const [key, monthIdx] of Object.entries(FRENCH_MONTHS)) {
      const cleanKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (cleanKey === monthRaw || monthRaw.startsWith(cleanKey.slice(0, 4))) {
        return new Date(year, monthIdx, day, 12, 0, 0);
      }
    }
  }

  // 2. Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }

  // 3. Try standard ISO or parseable date string
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Fallback to today
  return new Date();
}

/**
 * Calculates a 1-month rental period based on start date (Day 1).
 * Duration = 1 calendar month.
 */
export function calculateOneMonthPeriod(startDateInput: Date | string): {
  startDate: Date;
  expiryDate: Date;
  formattedStartDate: string;
  formattedExpiryDate: string;
  daysLeft: number;
  isEndingSoon: boolean;
  isExpired: boolean;
} {
  const startDate = typeof startDateInput === "string" ? parseAttestationDate(startDateInput) : new Date(startDateInput);
  startDate.setHours(12, 0, 0, 0);

  // Exactly 1 calendar month later
  const expiryDate = new Date(startDate);
  expiryDate.setMonth(expiryDate.getMonth() + 1);
  expiryDate.setHours(23, 59, 59, 999);

  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 3600 * 24));

  const isExpired = daysLeft < 0;
  // Warning active when 5 days or fewer remain before month-end
  const isEndingSoon = daysLeft <= 5 && !isExpired;

  const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    startDate,
    expiryDate,
    formattedStartDate: dateFormatter.format(startDate),
    formattedExpiryDate: dateFormatter.format(expiryDate),
    daysLeft,
    isEndingSoon,
    isExpired,
  };
}
