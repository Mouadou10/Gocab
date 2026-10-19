import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  normalizeWhatsAppPhone,
  findOrCreateConversation,
  ensureWhatsAppTables,
  getDbConv,
  getDbMsg,
  sendWhatsAppWelcomeMenu,
  routeConversationByImmat,
  routeConversationToLeadAcquisition,
  resolveContactByPhone,
  syncAllWhatsAppConversations,
} from "@/lib/services/whatsappApiService";

export async function GET(request: NextRequest) {
  try {
    await ensureWhatsAppTables();

    const session = await auth();
    const userRole = ((session?.user as any)?.role || "").toUpperCase();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim() || "";
    const filter = searchParams.get("filter") || "ALL"; // ALL, FLEET_SUPPORT, LEAD_ACQUISITION, DRIVERS, LEADS, ARREARS, UNREAD

    // Fetch all conversations from DB
    let conversations: any[] = [];
    try {
      conversations = await getDbConv().findMany({
        where: { is_archived: false },
        orderBy: [{ is_pinned: "desc" }, { last_message_at: "desc" }],
      });
    } catch (err: any) {
      if (err?.message?.includes("no such table") || err?.message?.includes("no such column")) {
        await ensureWhatsAppTables();
        conversations = await getDbConv()
          .findMany({
            where: { is_archived: false },
            orderBy: [{ is_pinned: "desc" }, { last_message_at: "desc" }],
          })
          .catch(() => []);
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
              workflow_state: "ROUTED_DRIVER_SUPPORT",
              routed_department: "FLEET_SUPPORT",
              matched_plate: d.assignedVehicle?.plate_number || null,
              matched_vehicle_id: d.assignedVehicle?.id || null,
              last_message: sampleSnippet,
              last_message_at: new Date(Date.now() - Math.floor(Math.random() * 86400000)),
              unread_count: d.currentArrearsMAD >= 900 ? 1 : 0,
            },
          });

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
              workflow_state: "ROUTED_LEAD_ACQUISITION",
              routed_department: "LEAD_ACQUISITION",
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

      conversations = await getDbConv().findMany({
        where: { is_archived: false },
        orderBy: [{ is_pinned: "desc" }, { last_message_at: "desc" }],
      });
    }

    // Fast indexed metadata lookup for conversations in parallel
    const driverIds = conversations.map((c) => c.driver_id).filter(Boolean) as string[];
    const leadIds = conversations.map((c) => c.lead_id).filter(Boolean) as string[];
    const vehicleIds = conversations.map((c) => c.matched_vehicle_id).filter(Boolean) as string[];

    // Only search phones for the few conversations that are not linked yet (to avoid slow full-table scans)
    const unlinkedShortPhones = conversations
      .filter((c) => !c.driver_id && !c.lead_id)
      .map((c) => normalizeWhatsAppPhone(c.phone_number).slice(-9))
      .filter((sp) => sp.length >= 8);

    const [drivers, leads, vehicles] = await Promise.all([
      driverIds.length > 0 || unlinkedShortPhones.length > 0
        ? prisma.driverProfile.findMany({
            where: {
              is_archived: false,
              OR: [
                ...(driverIds.length > 0 ? [{ id: { in: driverIds } }] : []),
                ...(unlinkedShortPhones.length > 0
                  ? unlinkedShortPhones.map((sp) => ({ phoneSanitized: { contains: sp } }))
                  : []),
              ],
            },
            include: { assignedVehicle: true },
          })
        : [],
      leadIds.length > 0 || unlinkedShortPhones.length > 0
        ? prisma.lead.findMany({
            where: {
              is_archived: false,
              OR: [
                ...(leadIds.length > 0 ? [{ id: { in: leadIds } }] : []),
                ...(unlinkedShortPhones.length > 0
                  ? unlinkedShortPhones.map((sp) => ({ sanitized_phone: { contains: sp } }))
                  : []),
              ],
            },
          })
        : [],
      vehicleIds.length > 0
        ? prisma.vehicle.findMany({
            where: { id: { in: vehicleIds } },
            include: { driverProfile: true },
          })
        : [],
    ]);

    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    // Attach contextual CRM dossiers to each conversation
    let allMapped = conversations.map((conv) => {
      const cleanPhone = normalizeWhatsAppPhone(conv.phone_number);
      const shortPhone = cleanPhone.slice(-9);

      const matchedVehicle = conv.matched_vehicle_id
        ? vehicleMap.get(conv.matched_vehicle_id)
        : null;
      let driverFromMap: any = conv.driver_id ? driverMap.get(conv.driver_id) : null;
      if (!driverFromMap) {
        driverFromMap =
          drivers.find((d) => d.phoneSanitized && d.phoneSanitized.includes(shortPhone)) ||
          matchedVehicle?.driverProfile ||
          null;
      }
      const driver: any = driverFromMap || matchedVehicle?.driverProfile || null;

      let lead = conv.lead_id ? leadMap.get(conv.lead_id) : null;
      if (!lead) {
        lead =
          leads.find((l) => l.sanitized_phone && l.sanitized_phone.includes(shortPhone)) || null;
      }

      const resolvedPlate =
        conv.matched_plate ||
        driverFromMap?.assignedVehicle?.plate_number ||
        matchedVehicle?.plate_number ||
        null;

      const resolvedModel =
        driverFromMap?.assignedVehicle?.make_model ||
        matchedVehicle?.make_model ||
        "-";

      const resolvedContactType = driver ? "DRIVER" : lead ? "LEAD" : conv.contact_type;
      const resolvedDepartment = driver
        ? "FLEET_SUPPORT"
        : lead
        ? "LEAD_ACQUISITION"
        : conv.routed_department || null;
      const resolvedWorkflowState = driver
        ? "ROUTED_DRIVER_SUPPORT"
        : lead
        ? "ROUTED_LEAD_ACQUISITION"
        : conv.workflow_state || "NONE";

      return {
        id: conv.id,
        phoneNumber: conv.phone_number,
        contactName: driver?.fullName || lead?.raw_name || conv.contact_name,
        contactType: resolvedContactType,
        workflowState: resolvedWorkflowState,
        routedDepartment: resolvedDepartment,
        matchedPlate: resolvedPlate,
        matchedVehicleId: conv.matched_vehicle_id || driverFromMap?.assignedVehicle?.id || null,
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
              plateNumber: resolvedPlate || "Non assigné",
              vehicleModel: resolvedModel,
              isRedFlagged: Boolean(driver.isRedFlagged),
              redFlagReason: driver.redFlagReason || null,
            }
          : resolvedPlate
          ? {
              id: matchedVehicle?.id || `plate-${resolvedPlate}`,
              fullName: matchedVehicle?.assigned_driver_name || conv.contact_name,
              cin: "-",
              contractType: "DAILY",
              currentArrearsMAD: 0,
              consecutiveUnpaidDays: 0,
              defaultStage: "NOMINAL",
              plateNumber: resolvedPlate,
              vehicleModel: resolvedModel,
              isRedFlagged: Boolean(matchedVehicle?.driverProfile?.isRedFlagged),
              redFlagReason: matchedVehicle?.driverProfile?.redFlagReason || null,
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
              trainingStatus: lead.training_status || null,
              presenceConfirmed: lead.presence_confirmed || false,
              notes: lead.notes || null,
            }
          : null,
      };
    });

    const isFleetSupportConv = (c: any) =>
      c.routedDepartment === "FLEET_SUPPORT" ||
      c.workflowState === "ROUTED_DRIVER_SUPPORT" ||
      c.workflowState === "AWAITING_IMMAT" ||
      c.matchedPlate !== null ||
      c.contactType === "DRIVER" ||
      c.driver !== null;

    const isLeadAcquisitionConv = (c: any) =>
      c.routedDepartment === "LEAD_ACQUISITION" ||
      c.workflowState === "ROUTED_LEAD_ACQUISITION" ||
      c.contactType === "LEAD" ||
      c.lead !== null;

    // Role-based queue restriction:
    // - FLEET_PERF_MANAGER only sees Support Flotte
    // - LEAD_ACQUISITION_JR and BRAND_MANAGER only see Lead Acquisition
    let restrictedQueue: "FLEET_SUPPORT" | "LEAD_ACQUISITION" | null = null;
    if (userRole === "FLEET_PERF_MANAGER") {
      restrictedQueue = "FLEET_SUPPORT";
      allMapped = allMapped.filter(isFleetSupportConv);
    } else if (userRole === "LEAD_ACQUISITION_JR" || userRole === "BRAND_MANAGER") {
      restrictedQueue = "LEAD_ACQUISITION";
      allMapped = allMapped.filter(isLeadAcquisitionConv);
    }

    const fleetSupportCount = allMapped.filter(isFleetSupportConv).length;
    const leadAcquisitionCount = allMapped.filter(isLeadAcquisitionConv).length;

    let results = [...allMapped];

    // Apply category filters
    if (filter === "FLEET_SUPPORT" || restrictedQueue === "FLEET_SUPPORT") {
      results = results.filter(isFleetSupportConv);
      // Prioritize drivers who explicitly entered their immat via WhatsApp bot at the top
      results.sort((a, b) => {
        const aBot = a.workflowState === "ROUTED_DRIVER_SUPPORT" ? 1 : 0;
        const bBot = b.workflowState === "ROUTED_DRIVER_SUPPORT" ? 1 : 0;
        if (bBot !== aBot) return bBot - aBot;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    } else if (filter === "LEAD_ACQUISITION" || restrictedQueue === "LEAD_ACQUISITION") {
      results = results.filter(isLeadAcquisitionConv);
      results.sort((a, b) => {
        const aBot = a.workflowState === "ROUTED_LEAD_ACQUISITION" ? 1 : 0;
        const bBot = b.workflowState === "ROUTED_LEAD_ACQUISITION" ? 1 : 0;
        if (bBot !== aBot) return bBot - aBot;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    }

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
          (c.matchedPlate && c.matchedPlate.toLowerCase().includes(search)) ||
          (c.driver?.plateNumber && c.driver.plateNumber.toLowerCase().includes(search)) ||
          c.lastMessage.toLowerCase().includes(search)
      );
    }

    const totalUnread = results.reduce((acc, c) => acc + (c.unreadCount > 0 ? 1 : 0), 0);

    return NextResponse.json({
      conversations: results,
      totalCount: results.length,
      totalUnread,
      fleetSupportCount,
      leadAcquisitionCount,
      restrictedQueue,
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
    const { action, conversationId, phoneNumber, contactName, immat, sendBotReply } = body;

    if (action === "send_welcome_menu") {
      if (!phoneNumber) {
        return NextResponse.json({ error: "Numéro requis" }, { status: 400 });
      }
      const res = await sendWhatsAppWelcomeMenu(phoneNumber, conversationId);
      return NextResponse.json({ success: res.success, result: res });
    }

    if (action === "match_immat") {
      if (!conversationId || !immat) {
        return NextResponse.json(
          { error: "Conversation et immatriculation requises" },
          { status: 400 }
        );
      }
      const res = await routeConversationByImmat(
        conversationId,
        immat,
        sendBotReply !== undefined ? Boolean(sendBotReply) : true
      );
      return NextResponse.json({ success: true, ...res });
    }

    if (action === "route_lead_acquisition") {
      if (!conversationId) {
        return NextResponse.json({ error: "Conversation requise" }, { status: 400 });
      }
      const res = await routeConversationToLeadAcquisition(
        conversationId,
        contactName,
        sendBotReply !== undefined ? Boolean(sendBotReply) : true
      );
      return NextResponse.json({ success: true, ...res });
    }

    if (action === "toggle_bot") {
      if (!conversationId) {
        return NextResponse.json({ error: "Conversation requise" }, { status: 400 });
      }
      const conv = await getDbConv().findUnique({ where: { id: conversationId } });
      if (!conv) {
        return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
      }
      const isCurrentlyPaused =
        conv.workflow_state === "BOT_PAUSED" || conv.workflow_state === "HUMAN_AGENT";
      const newWorkflowState = isCurrentlyPaused ? "NONE" : "BOT_PAUSED";
      const updated = await getDbConv().update({
        where: { id: conversationId },
        data: { workflow_state: newWorkflowState },
      });
      return NextResponse.json({
        success: true,
        workflowState: updated.workflow_state,
        isBotPaused: newWorkflowState === "BOT_PAUSED",
      });
    }

    if (!phoneNumber) {
      return NextResponse.json({ error: "Numéro de téléphone requis" }, { status: 400 });
    }

    const conversation = await findOrCreateConversation(phoneNumber, contactName);

    return NextResponse.json({ success: true, conversation });
  } catch (error: any) {
    console.error("POST /api/whatsapp/conversations error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process conversation action" },
      { status: 500 }
    );
  }
}
