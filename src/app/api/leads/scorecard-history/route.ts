import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const RELEVANT_ACTIONS = [
  'CALL_INITIATED',
  'STATUS_CHANGED',
  'COLUMN_MOVED',
  'TRAINING_DATE_SET',
  'TRAINING_STATUS_CHANGED',
];

const TRAINING_ACTIONS = new Set([
  'TRAINING_DATE_SET',
  'TRAINING_STATUS_CHANGED',
]);

/**
 * Extract the target status or column from a LeadActivityLog detail string.
 * Examples:
 * - "Statut → No response 2" -> "No response 2"
 * - "Déplacé vers → TRAINING_PIPELINE" -> "TRAINING_PIPELINE"
 */
function extractArrowTarget(detail: string | null): string | null {
  if (!detail) return null;
  const idx = detail.indexOf('→');
  if (idx === -1) return null;
  return detail.slice(idx + 1).trim() || null;
}

/**
 * GET /api/leads/scorecard-history?date=YYYY-MM-DD[&city=...]
 * Computes immutable daily call and qualification counts from append-only
 * LeadActivityLog entries so historical dates never shrink when leads are
 * re-called or updated on subsequent days.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = (searchParams.get('date') || '').trim();
    const city = (searchParams.get('city') || '').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid or missing date parameter (expected YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const logs = await prisma.leadActivityLog.findMany({
      where: {
        created_at: { gte: start, lte: end },
        action: { in: RELEVANT_ACTIONS },
      },
      orderBy: { created_at: 'asc' },
      select: {
        lead_id: true,
        action: true,
        detail: true,
        created_at: true,
      },
    });

    // Group chronological events per lead for that date
    const logsByLead = new Map<string, typeof logs>();
    for (const log of logs) {
      if (!log.lead_id) continue;
      const list = logsByLead.get(log.lead_id);
      if (list) {
        list.push(log);
      } else {
        logsByLead.set(log.lead_id, [log]);
      }
    }

    // Also include any lead whose status_changed_at is still on this date
    // (covers legacy rows without LeadActivityLog entries)
    const legacyLeads = await prisma.lead.findMany({
      where: {
        status_changed_at: { gte: start, lte: end },
      },
      select: {
        id: true,
        city: true,
        brand_status: true,
        board_column: true,
        training_status: true,
      },
    });

    const allLeadIds = Array.from(
      new Set([...logsByLead.keys(), ...legacyLeads.map((l) => l.id)])
    );

    const leads = allLeadIds.length
      ? await prisma.lead.findMany({
          where: { id: { in: allLeadIds } },
          select: {
            id: true,
            city: true,
            brand_status: true,
            board_column: true,
            training_status: true,
          },
        })
      : [];

    const leadMap = new Map(leads.map((l) => [l.id, l]));
    const statusCounts: Record<string, number> = {};
    let totalCalled = 0;
    let trainingFixed = 0;

    for (const leadId of allLeadIds) {
      const lead = leadMap.get(leadId);
      if (!lead) continue;

      if (
        city &&
        (!lead.city || !lead.city.toLowerCase().includes(city.toLowerCase()))
      ) {
        continue;
      }

      const leadLogs = logsByLead.get(leadId) || [];
      let resolvedStatus: string | null = null;
      let isTraining = false;

      for (const log of leadLogs) {
        if (log.action === 'STATUS_CHANGED') {
          const target = extractArrowTarget(log.detail);
          if (target) {
            resolvedStatus = target;
            if (target.toLowerCase() === 'training fixed') {
              isTraining = true;
            }
          }
        } else if (log.action === 'COLUMN_MOVED') {
          const target = extractArrowTarget(log.detail);
          if (
            target === 'TRAINING_PIPELINE' ||
            target === 'VEHICLE_ASSIGNMENT'
          ) {
            isTraining = true;
            if (!resolvedStatus) {
              resolvedStatus = 'Training fixed';
            }
          }
        } else if (TRAINING_ACTIONS.has(log.action)) {
          isTraining = true;
          if (!resolvedStatus) {
            resolvedStatus = 'Training fixed';
          }
        }
      }

      // If only CALL_INITIATED or legacy status_changed_at without STATUS_CHANGED log
      if (!resolvedStatus) {
        const isLeadsWorkflow =
          lead.board_column === 'BRAND_PRE_FILTER' ||
          lead.board_column === 'TRAINING_PIPELINE' ||
          lead.board_column === 'VEHICLE_ASSIGNMENT' ||
          (lead.brand_status || '').toLowerCase() === 'training fixed';

        if (!isLeadsWorkflow) continue;
        if (lead.board_column === 'NEW_LEADS' && !lead.brand_status) continue;

        resolvedStatus = lead.brand_status || lead.board_column;
        if (
          (lead.brand_status || '').toLowerCase() === 'training fixed' ||
          lead.board_column === 'TRAINING_PIPELINE' ||
          lead.board_column === 'VEHICLE_ASSIGNMENT' ||
          Boolean(lead.training_status)
        ) {
          isTraining = true;
        }
      }

      totalCalled += 1;
      if (isTraining) {
        trainingFixed += 1;
      }
      statusCounts[resolvedStatus] = (statusCounts[resolvedStatus] || 0) + 1;
    }

    return NextResponse.json({
      date,
      totalCalled,
      trainingFixed,
      statusCounts,
    });
  } catch (error) {
    console.error('Failed to compute historical scorecard:', error);
    return NextResponse.json(
      { error: 'Failed to compute historical scorecard' },
      { status: 500 }
    );
  }
}
