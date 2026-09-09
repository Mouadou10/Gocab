/**
 * GET /api/leads/[id]/activity
 * Returns the activity log for a specific lead, newest-first.
 *
 * POST /api/leads/[id]/activity
 * Manually logs an agent action or note for a specific lead.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";
import { ensureLeadActivityLogTable } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await ensureLeadActivityLogTable();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logs = await (prisma as any).leadActivityLog.findMany({
      where: { lead_id: id },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    try {
      return handleAuthError(error);
    } catch {
      return NextResponse.json({ logs: [] }, { status: 200 });
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const agent =
      body.agent ||
      session?.user?.name ||
      session?.user?.email ||
      "Agent";
    const action = body.action || "NOTE_ADDED";
    const detail = body.detail || null;

    await ensureLeadActivityLogTable();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const log = await (prisma as any).leadActivityLog.create({
      data: {
        lead_id: id,
        agent,
        action,
        detail,
      },
    });

    return NextResponse.json({ success: true, log });
  } catch (error) {
    return handleAuthError(error);
  }
}
