import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SETTING_KEY = "bon_de_commande_counter";
const DEFAULT_YEAR = 2026;
const DEFAULT_START_COUNTER = 4; // Starts from 2026/04

function formatBcRef(counter: number, year: number = DEFAULT_YEAR): string {
  const padded = String(counter).padStart(2, "0");
  return `${year}/${padded}`;
}

function parseBcRef(refStr: string): { year: number; counter: number } | null {
  if (!refStr) return null;
  const match = refStr.trim().match(/^(\d{4})\/(\d+)$/);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    counter: parseInt(match[2], 10),
  };
}

/**
 * GET /api/bon-de-commande/next-ref
 * Returns the current next sequential reference (e.g. 2026/04, 2026/05, etc.)
 */
export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: SETTING_KEY },
    });

    let currentCounter = DEFAULT_START_COUNTER;
    let currentYear = DEFAULT_YEAR;

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

    return NextResponse.json({
      nextRef: formatBcRef(currentCounter, currentYear),
      counter: currentCounter,
      year: currentYear,
    });
  } catch (error: any) {
    console.error("Error fetching next BC reference:", error);
    return NextResponse.json(
      { nextRef: formatBcRef(DEFAULT_START_COUNTER, DEFAULT_YEAR), counter: DEFAULT_START_COUNTER, year: DEFAULT_YEAR },
      { status: 200 }
    );
  }
}

/**
 * POST /api/bon-de-commande/next-ref
 * Advances the counter when a Bon de Commande is saved.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const usedRef = body.usedRef || "";

    const setting = await prisma.setting.findUnique({
      where: { key: SETTING_KEY },
    });

    let currentCounter = DEFAULT_START_COUNTER;
    let currentYear = DEFAULT_YEAR;

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

    let nextCounter = currentCounter + 1;
    let nextYear = currentYear;

    if (usedRef) {
      const parsedUsed = parseBcRef(usedRef);
      if (parsedUsed) {
        nextYear = parsedUsed.year;
        // If the used reference was at or ahead of current, advance past it
        nextCounter = Math.max(currentCounter + 1, parsedUsed.counter + 1);
      }
    }

    // Save updated counter in Setting table
    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      create: {
        key: SETTING_KEY,
        value: JSON.stringify({ counter: nextCounter, year: nextYear }),
      },
      update: {
        value: JSON.stringify({ counter: nextCounter, year: nextYear }),
      },
    });

    return NextResponse.json({
      success: true,
      nextRef: formatBcRef(nextCounter, nextYear),
      counter: nextCounter,
      year: nextYear,
    });
  } catch (error: any) {
    console.error("Error advancing BC reference counter:", error);
    return NextResponse.json({ error: "Failed to update BC counter" }, { status: 500 });
  }
}
