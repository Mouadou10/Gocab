import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeWhatsAppPhone,
  findOrCreateConversation,
  ensureWhatsAppTables,
  getDbConv,
  getDbMsg,
} from "@/lib/services/whatsappApiService";

export async function GET(request: NextRequest) {
  try {
    await ensureWhatsAppTables();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";
    const filter = searchParams.get("filter") || "ALL"; // ALL, DRIVERS, LEADS, ARREARS, UNREAD

    // Fetch all conversations from DB
    let conversations: any[] = [];
    try {
      conversations = await getDbConv().findMany({
        where: { is_archived: false },
        orderBy: [{ is_pinned: "desc" }, { last_message_at: "desc" }],
      });
    } catch (err: any) {
      if (err?.message?.includes("no such table")) {
        await ensureWhatsAppTables();
        conversations = await getDbConv().findMany({
          where: { is_archived: false },
          orderBy: [{ is_pinned: "desc" }, { last_message_at: "desc" }],
        }).catch(() => []);
      } else {
        throw err;
      }
    }

    // Auto-seed initial conversations from active Drivers and recent Leads if database table is empty
    if (conversations.length === 0) {
      const topDrivers = await prisma.driverProfile.findMany({
        take: 12,
        include: { assignedVehicle: true },
        orderBy: { currentArrearsMAD: "desc" },
      });

      for (const d of topDrivers) {
        const cleanPhone = normalizeWhatsAppPhone(d.phoneSanitized);
        if (!cleanPhone) continue;

        try {
          const sampleSnippet =
            d.currentArrearsMAD > 0
              ? `Rappel solde : ${d.currentArrearsMAD} MAD`
              : "Discussion GoCab Chauffeur";

          const conv = await getDbConv().create({
            data: {
              phone_number: cleanPhone,
              contact_name: d.fullName,
              driver_id: d.id,
              contact_type: "DRIVER",
              last_message: sampleSnippet,
              last_message_at: new Date(Date.now() - Math.floor(Math.random() * 86400000)),
              unread_count: d.currentArrearsMAD >= 900 ? 1 : 0,
            },
          });

          // Add a sample opening message
          await getDbMsg().create({
            data: {
              conversation_id: conv.id,
              direction: "OUTBOUND",
              sender_type: "AGENT",
              sender_name: "GoCab Operations",
              text: `Bonjour ${d.fullName}, ceci est votre ligne directe WhatsApp avec l'équipe d'exploitation GoCab.`,
              status: "READ",
            },
          });
        } catch (e) {}
      }

      // Add a couple of active leads
      const topLeads = await prisma.lead.findMany({
        take: 5,
        where: { is_archived: false },
        orderBy: { created_at: "desc" },
      });

      for (const l of topLeads) {
        const cleanPhone = normalizeWhatsAppPhone(l.sanitized_phone);
        if (!cleanPhone) continue;

        try {
          const conv = await getDbConv().create({
            data: {
              phone_number: cleanPhone,
              contact_name: l.raw_name,
              lead_id: l.id,
              contact_type: "LEAD",
              last_message: `Candidature GoCab (${l.board_column})`,
              last_message_at: new Date(Date.now() - 3600000),
              unread_count: 0,
            },
          });

          await getDbMsg().create({
            data: {
              conversation_id: conv.id,
              direction: "OUTBOUND",
              sender_type: "AGENT",
              sender_name: "GoCab Recrutement",
              text: `Bonjour ${l.raw_name}, merci pour votre intérêt pour GoCab. Vos documents sont en cours de validation.`,
              status: "DELIVERED",
            },
          });
        } catch (e) {}
      }

      // Re-query after auto-seed
      conversations = await getDbConv().findMany({
        where: { is_archived: false },
        orderBy: [{ is_pinned: "desc" }, { last_message_at: "desc" }],
      });
    }

    // Fetch related driver and lead metadata for all conversations in parallel
    const driverIds = conversations.map((c) => c.driver_id).filter(Boolean) as string[];
    const leadIds = conversations.map((c) => c.lead_id).filter(Boolean) as string[];

    const [drivers, leads] = await Promise.all([
      driverIds.length > 0
        ? prisma.driverProfile.findMany({
            where: { id: { in: driverIds } },
            include: { assignedVehicle: true },
          })
        : [],
      leadIds.length > 0
        ? prisma.lead.findMany({
            where: { id: { in: leadIds } },
          })
        : [],
    ]);

    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const leadMap = new Map(leads.map((l) => [l.id, l]));

    // Attach contextual CRM dossiers to each conversation
    let results = conversations.map((conv) => {
      const driver = conv.driver_id ? driverMap.get(conv.driver_id) : null;
      const lead = conv.lead_id ? leadMap.get(conv.lead_id) : null;

      return {
        id: conv.id,
        phoneNumber: conv.phone_number,
        contactName: conv.contact_name,
        contactType: conv.contact_type,
        lastMessage: conv.last_message || "",
        lastMessageAt: conv.last_message_at,
        unreadCount: conv.unread_count,
        isPinned: conv.is_pinned,
        driver: driver
          ? {
              id: driver.id,
              fullName: driver.fullName,
              cin: driver.cinNumber,
              contractType: driver.contractType,
              currentArrearsMAD: driver.currentArrearsMAD,
              consecutiveUnpaidDays: driver.consecutiveUnpaidDays,
              defaultStage: driver.defaultStage,
              plateNumber: driver.assignedVehicle?.plate_number || "Non assigné",
              vehicleModel: driver.assignedVehicle?.make_model || "-",
            }
          : null,
        lead: lead
          ? {
              id: lead.id,
              name: lead.raw_name,
              boardColumn: lead.board_column,
              city: lead.city || "Casablanca",
              hasCin: lead.has_cin,
              hasPermis: lead.has_permis,
            }
          : null,
      };
    });

    // Apply category filters
    if (filter === "DRIVERS") {
      results = results.filter((c) => c.contactType === "DRIVER" || c.driver !== null);
    } else if (filter === "LEADS") {
      results = results.filter((c) => c.contactType === "LEAD" || c.lead !== null);
    } else if (filter === "ARREARS") {
      results = results.filter((c) => (c.driver?.currentArrearsMAD || 0) > 0);
    } else if (filter === "UNREAD") {
      results = results.filter((c) => c.unreadCount > 0);
    }

    // Apply search filter
    if (search) {
      results = results.filter(
        (c) =>
          c.contactName.toLowerCase().includes(search) ||
          c.phoneNumber.includes(search) ||
          (c.driver?.plateNumber && c.driver.plateNumber.toLowerCase().includes(search)) ||
          c.lastMessage.toLowerCase().includes(search)
      );
    }

    const totalUnread = results.reduce((acc, c) => acc + (c.unreadCount > 0 ? 1 : 0), 0);

    return NextResponse.json({
      conversations: results,
      totalCount: results.length,
      totalUnread,
    });
  } catch (error: any) {
    console.error("GET /api/whatsapp/conversations error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch WhatsApp conversations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureWhatsAppTables();
    const body = await request.json();
    const { phoneNumber, contactName } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: "Numéro de téléphone requis" }, { status: 400 });
    }

    const conversation = await findOrCreateConversation(phoneNumber, contactName);

    return NextResponse.json({ success: true, conversation });
  } catch (error: any) {
    console.error("POST /api/whatsapp/conversations error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create conversation" },
      { status: 500 }
    );
  }
}
