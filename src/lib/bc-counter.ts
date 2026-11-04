import { prisma } from "@/lib/prisma";

export const BC_SETTING_KEY = "bon_de_commande_counter";
export const DEFAULT_BC_YEAR = 2026;
export const DEFAULT_START_COUNTER = 97; // Starts from 2026/97

export function formatBcRef(counter: number, year: number = DEFAULT_BC_YEAR): string {
  const padded = String(counter).padStart(2, "0");
  return `${year}/${padded}`;
}

export function parseBcRef(refStr: string): { year: number; counter: number } | null {
  if (!refStr) return null;
  const match = refStr.trim().match(/^(\d{4})\/(\d+)$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    counter: parseInt(match[2], 10),
  };
}

/**
 * Scans tickets and expenses to find the highest existing sequential BC counter.
 */
export async function getHighestExistingBcCounter(year: number = DEFAULT_BC_YEAR): Promise<number> {
  let maxFound = 0;
  const regex = new RegExp(`${year}/(\\d+)`, "g");

  try {
    const tickets = await prisma.maintenanceTicket.findMany({
      select: { description: true, resolution_notes: true },
    });

    for (const t of tickets) {
      const text = `${t.description || ""} ${t.resolution_notes || ""}`;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const num = parseInt(match[1], 10);
        if (num > maxFound) maxFound = num;
      }
    }

    const expenses = await prisma.vehicleExpense.findMany({
      where: {
        OR: [
          { invoice_number: { contains: `${year}/` } },
          { description: { contains: `${year}/` } },
        ],
      },
      select: { invoice_number: true, description: true },
    });

    for (const e of expenses) {
      const text = `${e.invoice_number || ""} ${e.description || ""}`;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const num = parseInt(match[1], 10);
        if (num > maxFound) maxFound = num;
      }
    }
  } catch (err) {
    console.warn("getHighestExistingBcCounter warning:", err);
  }

  return maxFound;
}

/**
 * Retrieves the current next sequential reference (e.g. 2026/97).
 * Strictly guarantees that next reference is >= highest existing + 1.
 */
export async function getNextBcRef(): Promise<{ nextRef: string; counter: number; year: number }> {
  const setting = await prisma.setting
    .findUnique({
      where: { key: BC_SETTING_KEY },
    })
    .catch(() => null);

  let currentCounter = DEFAULT_START_COUNTER;
  let currentYear = DEFAULT_BC_YEAR;

  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (typeof parsed.counter === "number") currentCounter = parsed.counter;
      if (typeof parsed.year === "number") currentYear = parsed.year;
    } catch {
      const num = parseInt(setting.value, 10);
      if (!isNaN(num)) currentCounter = num;
    }
  }

  // Also check database high-water mark so we never collide or repeat
  const highestExisting = await getHighestExistingBcCounter(currentYear);
  const minRequiredCounter = Math.max(DEFAULT_START_COUNTER, highestExisting + 1);

  if (currentCounter < minRequiredCounter) {
    currentCounter = minRequiredCounter;
    // Persist aligned counter
    await prisma.setting
      .upsert({
        where: { key: BC_SETTING_KEY },
        create: {
          key: BC_SETTING_KEY,
          value: JSON.stringify({ counter: currentCounter, year: currentYear }),
        },
        update: {
          value: JSON.stringify({ counter: currentCounter, year: currentYear }),
        },
      })
      .catch(() => {});
  }

  return {
    nextRef: formatBcRef(currentCounter, currentYear),
    counter: currentCounter,
    year: currentYear,
  };
}

/**
 * Advances the sequential reference counter when a Bon de Commande is used / saved / printed.
 * If usedRef is 2026/97, next counter will be 98 (2026/98).
 */
export async function advanceBcCounter(usedRef?: string): Promise<{ nextRef: string; counter: number; year: number }> {
  const current = await getNextBcRef();
  let nextCounter = current.counter + 1;
  let nextYear = current.year;

  if (usedRef) {
    const parsedUsed = parseBcRef(usedRef);
    if (parsedUsed) {
      nextYear = parsedUsed.year;
      // If the used reference was at or ahead of current, advance past it
      nextCounter = Math.max(current.counter + 1, parsedUsed.counter + 1);
    }
  }

  const payload = JSON.stringify({ counter: nextCounter, year: nextYear });

  await prisma.setting.upsert({
    where: { key: BC_SETTING_KEY },
    create: {
      key: BC_SETTING_KEY,
      value: payload,
    },
    update: {
      value: payload,
    },
  });

  return {
    nextRef: formatBcRef(nextCounter, nextYear),
    counter: nextCounter,
    year: nextYear,
  };
}
