import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { matchNationalBlacklist } from "@/lib/services/nationalBlacklistMatcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();

    if (!name) {
      return NextResponse.json({
        isBlacklisted: false,
        matchType: "NONE",
        score: 0,
        matchedEntry: null,
        warningBadgeText: "",
        warningDetailText: "",
      });
    }

    const result = matchNationalBlacklist(name);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to perform blacklist check", message: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }

    const body = await request.json().catch(() => ({}));
    const name = body.name ? String(body.name).trim() : "";

    const result = matchNationalBlacklist(name);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to perform blacklist check", message: error?.message },
      { status: 500 }
    );
  }
}
