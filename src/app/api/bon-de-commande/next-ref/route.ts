import { NextRequest, NextResponse } from "next/server";
import { getNextBcRef, advanceBcCounter } from "@/lib/bc-counter";

/**
 * GET /api/bon-de-commande/next-ref
 * Returns the current next sequential reference (e.g. 2026/97, 2026/98, etc.)
 */
export async function GET() {
  try {
    const result = await getNextBcRef();
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Error fetching next BC reference:", error);
    return NextResponse.json(
      { nextRef: "2026/97", counter: 97, year: 2026 },
      { status: 200 }
    );
  }
}

/**
 * POST /api/bon-de-commande/next-ref
 * Advances the counter when a Bon de Commande is saved, validated, or printed.
 * e.g. If usedRef was 2026/97, next reference will be 2026/98.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const usedRef = body.usedRef || "";

    const result = await advanceBcCounter(usedRef);

    return NextResponse.json({
      success: true,
      nextRef: result.nextRef,
      counter: result.counter,
      year: result.year,
    });
  } catch (error: any) {
    console.error("Error advancing BC reference counter:", error);
    return NextResponse.json({ error: "Failed to update BC counter" }, { status: 500 });
  }
}
