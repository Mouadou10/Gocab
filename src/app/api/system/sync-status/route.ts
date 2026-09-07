import { NextRequest, NextResponse } from "next/server";
import { getSyncState, getServerVersion } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/sync-status
 * Checks if monitored entities (leads, tickets, settings) or deployment version
 * have updated since the client's last sync timestamp.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientLeads = Number(searchParams.get("leads")) || 0;
    const clientTickets = Number(searchParams.get("tickets")) || 0;
    const clientSettings = Number(searchParams.get("settings")) || 0;
    const clientCollections = Number(searchParams.get("collections")) || 0;
    const clientVersion = searchParams.get("version") || "";

    const syncState = await getSyncState();
    const currentVersion = getServerVersion();

    const response = {
      leads: syncState.leads,
      tickets: syncState.tickets,
      settings: syncState.settings,
      collections: syncState.collections,
      version: currentVersion,
      shouldRefreshLeads: clientLeads > 0 && syncState.leads > clientLeads,
      shouldRefreshTickets: clientTickets > 0 && syncState.tickets > clientTickets,
      shouldRefreshSettings: clientSettings > 0 && syncState.settings > clientSettings,
      shouldRefreshCollections: clientCollections > 0 && syncState.collections > clientCollections,
      shouldRefreshApp:
        clientVersion.length > 0 &&
        currentVersion.length > 0 &&
        clientVersion !== currentVersion,
      serverTime: Date.now(),
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    console.error("GET /api/system/sync-status error:", error);
    return NextResponse.json(
      {
        leads: Date.now(),
        tickets: Date.now(),
        settings: Date.now(),
        version: getServerVersion(),
        shouldRefreshLeads: false,
        shouldRefreshTickets: false,
        shouldRefreshSettings: false,
        shouldRefreshApp: false,
        serverTime: Date.now(),
      },
      { status: 200 }
    );
  }
}
