import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface DepartmentTargets {
  target_daily_calls: number;
  target_daily_training_fixed: number;
  target_daily_preorders: number;
  target_collection_rate: number;
  target_daily_tasks: number;
  target_fleet_uptime: number;
  target_ticket_resolution_rate: number;
}

const DEFAULT_TARGETS: DepartmentTargets = {
  target_daily_calls: 60,
  target_daily_training_fixed: 15,
  target_daily_preorders: 5,
  target_collection_rate: 60, // 60% standard
  target_daily_tasks: 10,
  target_fleet_uptime: 95, // 95% uptime
  target_ticket_resolution_rate: 85,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const userId = searchParams.get("userId");
    const role = searchParams.get("role");
    const hubCity = searchParams.get("hubCity");

    const now = new Date();
    
    // Default to last 7 days if not provided
    const startDate = startDateParam 
      ? new Date(`${startDateParam}T00:00:00.000Z`) 
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0));
    
    const endDate = endDateParam 
      ? new Date(`${endDateParam}T23:59:59.999Z`) 
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));

    // Number of days in range for daily target multiplication
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const dayCount = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // 1. Fetch system targets
    let targets = { ...DEFAULT_TARGETS };
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: "department_weekly_targets" },
      });
      if (setting?.value) {
        const parsed = JSON.parse(setting.value);
        targets = {
          target_daily_calls: Number(parsed.target_daily_calls) || targets.target_daily_calls,
          target_daily_training_fixed: Number(parsed.target_daily_training_fixed) || targets.target_daily_training_fixed,
          target_daily_preorders: Number(parsed.target_daily_preorders) || targets.target_daily_preorders,
          target_collection_rate: Number(parsed.target_collection_rate) || targets.target_collection_rate,
          target_daily_tasks: Number(parsed.target_daily_tasks) || targets.target_daily_tasks,
          target_fleet_uptime: Number(parsed.target_fleet_uptime) || targets.target_fleet_uptime,
          target_ticket_resolution_rate: Number(parsed.target_ticket_resolution_rate) || targets.target_ticket_resolution_rate,
        };
      }
    } catch (err) {
      console.warn("Using default KPI targets:", err);
    }

    // 2. Fetch Users
    const users = await prisma.user.findMany({
      select: { id: true, name: true, fullName: true, role: true, email: true, region: true, isActive: true },
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    // 3. Query Leads in Date Range
    const leadWhere: any = {
      is_archived: false,
    };
    if (hubCity && hubCity !== "ALL") {
      leadWhere.city = hubCity;
    }

    const allLeads = await prisma.lead.findMany({
      where: leadWhere,
      select: {
        id: true,
        raw_name: true,
        sanitized_phone: true,
        board_column: true,
        brand_status: true,
        training_status: true,
        status_changed_at: true,
        reminder_date: true,
        preorder_amount: true,
        city: true,
        has_cin: true,
        has_fiche_anthropometrique: true,
        has_confirmation_adresse: true,
        has_permis: true,
        handled_by: true,
        created_at: true,
        updated_at: true,
        notes: true,
      },
    });

    // Filter leads treated in date range
    const leadsTreatedInRange = allLeads.filter((l) => {
      const ts = l.status_changed_at || l.updated_at || l.created_at;
      if (!ts) return false;
      const d = new Date(ts);
      return d >= startDate && d <= endDate;
    });

    // Apply user filter if a specific user is chosen in slicer
    let targetUser: any = null;
    if (userId && userId !== "ALL") {
      targetUser = users.find((u) => u.id === userId);
    }

    const filteredLeadsInRange = leadsTreatedInRange.filter((l) => {
      if (!targetUser) return true;
      const uName = (targetUser.fullName || targetUser.name || "").toLowerCase();
      const uEmail = (targetUser.email || "").toLowerCase();
      const h = (l.handled_by || "").toLowerCase();
      const n = (l.notes || "").toLowerCase();
      return h.includes(uName) || h.includes(uEmail) || n.includes(uName) || n.includes(uEmail);
    });

    const callsDone = filteredLeadsInRange.filter((l) => l.board_column !== "NEW_LEADS").length;
    const trainingFixed = filteredLeadsInRange.filter(
      (l) => l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE"
    ).length;
    const leadConversionRate = callsDone > 0 ? Number(((trainingFixed / callsDone) * 100).toFixed(1)) : 0;

    // Training Pipeline in Date Range
    const trainingLeads = filteredLeadsInRange.filter(
      (l) => l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT"
    );

    const attendedCount = trainingLeads.filter(
      (l) => l.training_status && ["Attended", "Attended and not interested", "Pending", "Refused the offer", "Assign vehicle", "Preorder", "Accept offer"].includes(l.training_status)
    ).length;

    const assignedVehiclesCount = trainingLeads.filter(
      (l) => l.board_column === "VEHICLE_ASSIGNMENT" || l.training_status === "Assign vehicle" || l.training_status === "Accept offer"
    ).length;

    const preorders = trainingLeads.filter((l) => l.training_status === "Preorder");
    const preordersCount = preorders.length;
    const totalPreorderMAD = preorders.reduce((acc, l) => acc + (Number(l.preorder_amount) || 0), 0);
    const attendanceRate = trainingLeads.length > 0 ? Number(((attendedCount / trainingLeads.length) * 100).toFixed(1)) : 0;

    // 4. Query Collections & Daily Ledgers
    const paymentLedgers = await prisma.paymentLedger.findMany({
      where: {
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        driver: true,
      },
    });

    const dailyCollections = await prisma.dailyCollection.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalMorningTargetMAD = paymentLedgers.reduce((acc, row) => {
      const mb = Number(row.morningBalance) || 0;
      return mb < 0 ? acc + Math.abs(mb) : acc;
    }, 0) || dailyCollections.reduce((acc, d) => acc + (Number(d.expected_total) || 0), 0);

    const totalEveningCollectedMAD = paymentLedgers.reduce((acc, row) => {
      const collected = Number(row.clearedMAD) || (Number(row.calculatedDelta) && Number(row.calculatedDelta) > 0 ? Number(row.calculatedDelta) : 0);
      return acc + collected;
    }, 0) || dailyCollections.reduce((acc, d) => acc + (Number(d.collected_total) || 0), 0);

    const collectionRecoveryRate = totalMorningTargetMAD > 0 
      ? Number(((totalEveningCollectedMAD / totalMorningTargetMAD) * 100).toFixed(1))
      : 0;

    // 5. Query Field Tasks & Inspections
    const fieldTasks = await prisma.fieldTask.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const tasksCompleted = fieldTasks.filter((t) => t.status === "Completed").length;
    const tasksFailed = fieldTasks.filter((t) => t.status === "Failed").length;
    const tasksTotal = fieldTasks.length;
    const taskCompletionRate = tasksTotal > 0 ? Number(((tasksCompleted / tasksTotal) * 100).toFixed(1)) : 0;

    const inspections = await prisma.vehicleInspection.findMany({
      where: {
        inspection_date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const avgHealthScore = inspections.length > 0
      ? Number((inspections.reduce((acc, i) => acc + Number(i.health_score), 0) / inspections.length).toFixed(1))
      : 5.0;

    // 6. Query Maintenance Tickets & Fleet Uptime
    const tickets = await prisma.maintenanceTicket.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const ticketsResolved = tickets.filter((t) => t.status === "RESOLVED").length;
    const ticketResolutionRate = tickets.length > 0 
      ? Number(((ticketsResolved / tickets.length) * 100).toFixed(1)) 
      : 0;

    const totalVehicles = await prisma.vehicle.count({ where: { is_archived: false } });
    const activeVehicles = await prisma.vehicle.count({ 
      where: { is_archived: false, status: { in: ["Actif", "ACTIF", "Available", "DISPONIBLE"] } } 
    });
    const fleetUptimePct = totalVehicles > 0 ? Number(((activeVehicles / totalVehicles) * 100).toFixed(1)) : 100;

    // 7. Calculate Department Scaled Targets
    const scaledCallsTarget = targets.target_daily_calls * dayCount;
    const scaledTrainingTarget = targets.target_daily_training_fixed * dayCount;
    const scaledPreordersTarget = targets.target_daily_preorders * dayCount;
    const scaledTasksTarget = targets.target_daily_tasks * dayCount;

    // 8. Build Team Leaderboard with individual attribution
    const leaderboard = users.map((u) => {
      let dept = "Operations";
      let keyMetric = "Tasks";
      let actual = 0;
      let target = scaledTasksTarget;
      let unit = "";

      const uName = (u.fullName || u.name || "").toLowerCase();
      const uEmail = (u.email || "").toLowerCase();

      // Filter leads handled by this specific user
      const userHandledLeads = leadsTreatedInRange.filter((l) => {
        const h = ((l as any).handled_by || "").toLowerCase();
        const n = (l.notes || "").toLowerCase();
        return h.includes(uName) || h.includes(uEmail) || n.includes(uName) || n.includes(uEmail);
      });

      const userCalls = userHandledLeads.filter((l) => l.board_column !== "NEW_LEADS").length;
      const userTrainings = userHandledLeads.filter(
        (l) => l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE"
      ).length;

      if (u.role === "LEAD_ACQUISITION_JR") {
        dept = "Lead Acquisition";
        keyMetric = "Training Fixed";
        actual = userTrainings > 0 ? userTrainings : trainingFixed;
        target = scaledTrainingTarget;
        unit = "leads";
      } else if (u.role === "FLEET_PERF_MANAGER") {
        dept = "Fleet Collections";
        keyMetric = "Recovery Rate";
        actual = collectionRecoveryRate;
        target = targets.target_collection_rate;
        unit = "%";
      } else if (u.role === "FIELD_SUPERVISOR") {
        dept = "Field Operations";
        keyMetric = "Tasks Done";
        const userTasks = fieldTasks.filter((t) => 
          (t.assigned_to && t.assigned_to.toLowerCase().includes(uName)) ||
          (u.fullName && t.assigned_to?.toLowerCase().includes(u.fullName.toLowerCase()))
        );
        actual = userTasks.filter((t) => t.status === "Completed").length || tasksCompleted;
        target = scaledTasksTarget;
        unit = "tasks";
      } else if (u.role === "OPS_MANAGER" || u.role === "ADMIN") {
        dept = "Executive Ops";
        keyMetric = "Fleet Uptime";
        actual = fleetUptimePct;
        target = targets.target_fleet_uptime;
        unit = "%";
      } else if (u.role === "FINANCE_OFFICER") {
        dept = "Finance & Insurance";
        keyMetric = "Collection MAD";
        actual = totalEveningCollectedMAD;
        target = totalMorningTargetMAD * 0.6;
        unit = "MAD";
      }

      const attainmentPct = target > 0 
        ? Number(((actual / target) * 100).toFixed(1))
        : 100;

      let status = "ON_TRACK";
      if (attainmentPct >= 100) status = "EXCEEDED";
      else if (attainmentPct < 80) status = "BEHIND";

      return {
        id: u.id,
        name: u.fullName || u.name,
        email: u.email,
        role: u.role,
        department: dept,
        keyMetric,
        actual,
        target,
        unit,
        attainmentPct,
        status,
      };
    }).sort((a, b) => b.attainmentPct - a.attainmentPct);

    // 9. Generate Daily Trends Array (for Charts/Sparklines)
    const dailyTimeline: any[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const dateKey = curr.toISOString().split("T")[0];
      
      const dayLeads = leadsTreatedInRange.filter((l) => {
        const ts = l.status_changed_at || l.updated_at || l.created_at;
        return ts && new Date(ts).toISOString().split("T")[0] === dateKey;
      });

      const dayCalls = dayLeads.filter((l) => l.board_column !== "NEW_LEADS").length;
      const dayTrainings = dayLeads.filter(
        (l) => l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE"
      ).length;

      const dayPaymentLedgers = paymentLedgers.filter(
        (p) => p.paymentDate && new Date(p.paymentDate).toISOString().split("T")[0] === dateKey
      );
      const dayDailyCols = dailyCollections.filter(
        (c) => c.date && new Date(c.date).toISOString().split("T")[0] === dateKey
      );
      const dayCollectedMAD = dayPaymentLedgers.reduce(
        (acc, row) => acc + (Number(row.clearedMAD) || (Number(row.calculatedDelta) && Number(row.calculatedDelta) > 0 ? Number(row.calculatedDelta) : 0)), 
        0
      ) || dayDailyCols.reduce((acc, row) => acc + (Number(row.collected_total) || 0), 0);

      const dayTasks = fieldTasks.filter(
        (t) => t.created_at && new Date(t.created_at).toISOString().split("T")[0] === dateKey
      );
      const dayTasksDone = dayTasks.filter((t) => t.status === "Completed").length;

      dailyTimeline.push({
        date: dateKey,
        calls: dayCalls,
        trainings: dayTrainings,
        collectedMAD: dayCollectedMAD,
        tasksDone: dayTasksDone,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        dayCount,
      },
      targets,
      kpis: {
        leadAcquisition: {
          callsDone,
          callsTarget: scaledCallsTarget,
          callsAttainmentPct: scaledCallsTarget > 0 ? Number(((callsDone / scaledCallsTarget) * 100).toFixed(1)) : 0,
          trainingFixed,
          trainingTarget: scaledTrainingTarget,
          trainingAttainmentPct: scaledTrainingTarget > 0 ? Number(((trainingFixed / scaledTrainingTarget) * 100).toFixed(1)) : 0,
          conversionRate: leadConversionRate,
          conversionTarget: 25, // 25% standard
        },
        trainingOnboarding: {
          attendedCount,
          assignedVehiclesCount,
          preordersCount,
          preordersTarget: scaledPreordersTarget,
          preordersAttainmentPct: scaledPreordersTarget > 0 ? Number(((preordersCount / scaledPreordersTarget) * 100).toFixed(1)) : 0,
          totalPreorderMAD,
          attendanceRate,
        },
        fleetCollections: {
          totalMorningTargetMAD,
          totalEveningCollectedMAD,
          collectionRecoveryRate,
          recoveryObjectivePct: targets.target_collection_rate, // 60%
          collectionAttainmentPct: targets.target_collection_rate > 0 ? Number(((collectionRecoveryRate / targets.target_collection_rate) * 100).toFixed(1)) : 0,
          isObjectiveMet: collectionRecoveryRate >= targets.target_collection_rate,
        },
        fieldOperations: {
          tasksTotal,
          tasksCompleted,
          tasksFailed,
          tasksTarget: scaledTasksTarget,
          tasksAttainmentPct: scaledTasksTarget > 0 ? Number(((tasksCompleted / scaledTasksTarget) * 100).toFixed(1)) : 0,
          taskCompletionRate,
          inspectionsCount: inspections.length,
          avgHealthScore,
        },
        fleetMaintenance: {
          totalVehicles,
          activeVehicles,
          fleetUptimePct,
          fleetUptimeTarget: targets.target_fleet_uptime,
          ticketsTotal: tickets.length,
          ticketsResolved,
          ticketResolutionRate,
          ticketResolutionTarget: targets.target_ticket_resolution_rate,
        },
      },
      leaderboard,
      dailyTimeline,
      users,
    });
  } catch (error: any) {
    console.error("GET /api/kpis/performance error:", error);
    return NextResponse.json(
      { error: "Failed to generate KPI performance analytics", details: error.message },
      { status: 500 }
    );
  }
}
