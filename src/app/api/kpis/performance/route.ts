import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMoroccanWorkingDays, getWorkingDaysInFullMonth } from "@/lib/moroccoCalendar";

export const dynamic = "force-dynamic";

interface DepartmentTargets {
  target_daily_calls: number;
  target_daily_training_fixed: number;
  target_weekly_leads: number;
  target_daily_preorders: number;
  target_daily_attended: number;
  target_training_showup_rate: number;
  target_kyc_completion_rate: number;
  target_lead_conversion_rate: number;
  target_preorder_conversion_rate: number;
  target_active_fleet_rate: number;
  target_max_downtime_days: number;
  target_weekly_churn_limit: number;
  target_monthly_churn_rate: number;
  target_max_waived_days: number;
  target_monthly_inspection_rate: number;
  target_gps_connectivity_rate: number;
  target_asset_recovery_rate: number;
  target_sla_resolution_rate: number;
  target_max_open_tickets: number;
  target_min_collection_rate: number;
  target_collection_rate: number;
  target_max_vidange_hours: number;
  target_max_field_mission_hours: number;
  target_weekly_revenue_mad: number;
  target_daily_tasks: number;
  target_fleet_uptime: number;
  target_ticket_resolution_rate: number;
  target_avg_available_days: number;
  monthly_bonus_amount_mad: number;

  // 🎯 Dynamic Objective Weights (%)
  weight_traffic_calls: number;
  weight_traffic_training: number;
  weight_traffic_conversion: number;

  weight_onboarding_attended: number;
  weight_onboarding_preorders: number;
  weight_onboarding_velocity: number;

  weight_fleet_cash: number;
  weight_fleet_churn: number;
  weight_fleet_maintenance: number;
  weight_fleet_vidange: number;
  weight_fleet_mission: number;

  weight_field_mission: number;
  weight_field_attestation: number;
  weight_field_tickets: number;
}

const DEFAULT_TARGETS: DepartmentTargets = {
  target_daily_calls: 50,
  target_daily_training_fixed: 15, // 30% of calls
  target_weekly_leads: 100,
  target_daily_preorders: 4, // 25% of training fixed
  target_daily_attended: 10, // 65% of training fixed
  target_training_showup_rate: 65, // 65% show-up rate
  target_kyc_completion_rate: 25,
  target_lead_conversion_rate: 30, // 30% conversion rate
  target_preorder_conversion_rate: 25, // 25% preorder rate
  target_active_fleet_rate: 85,
  target_max_downtime_days: 10, // AVG of cars staying in maintenance <= 10 days
  target_weekly_churn_limit: 2,
  target_monthly_churn_rate: 20, // Monthly churn rate <= 20% of total fleet drivers
  target_max_waived_days: 10,
  target_monthly_inspection_rate: 90,
  target_gps_connectivity_rate: 100,
  target_asset_recovery_rate: 100,
  target_sla_resolution_rate: 95,
  target_max_open_tickets: 5,
  target_min_collection_rate: 50, // 50%-60% of daily collection amount by end of day
  target_collection_rate: 60,
  target_max_vidange_hours: 1.0, // Timing to deal with Vidange/AdBleu AVG <= 1H
  target_max_field_mission_hours: 3.0, // Timing to execute field mission AVG <= 3H
  target_weekly_revenue_mad: 50000,
  target_daily_tasks: 10,
  target_fleet_uptime: 95,
  target_ticket_resolution_rate: 95, // % of tickets resolved >= 95%
  target_avg_available_days: 1.0,
  monthly_bonus_amount_mad: 1000,

  // Weights defaults
  weight_traffic_calls: 40,
  weight_traffic_training: 40,
  weight_traffic_conversion: 20,

  weight_onboarding_attended: 40,
  weight_onboarding_preorders: 40,
  weight_onboarding_velocity: 20,

  weight_fleet_cash: 20,
  weight_fleet_churn: 20,
  weight_fleet_maintenance: 20,
  weight_fleet_vidange: 20,
  weight_fleet_mission: 20,

  weight_field_mission: 33.3,
  weight_field_attestation: 33.3,
  weight_field_tickets: 33.4,
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

    // Default to current month or last 7 days
    const startDate = startDateParam
      ? new Date(`${startDateParam}T00:00:00.000Z`)
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0));

    const endDate = endDateParam
      ? new Date(`${endDateParam}T23:59:59.999Z`)
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));

    // Moroccan business calendar calculation (Mon-Fri, excluding statutory holidays)
    const moroccanDaysInfo = getMoroccanWorkingDays(startDate, endDate);
    const workingDays = moroccanDaysInfo.workingDays;
    const fullMonthInfo = getWorkingDaysInFullMonth(endDate.getFullYear(), endDate.getMonth());
    const workingDaysInMonth = fullMonthInfo.workingDays;

    // 1. Fetch system targets from Weekly Department Goals & Thresholds
    let targets = { ...DEFAULT_TARGETS };
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: "department_weekly_targets" },
      });
      if (setting?.value) {
        const parsed = JSON.parse(setting.value);
        const calls = Number(parsed.target_daily_calls) || DEFAULT_TARGETS.target_daily_calls;
        const fixed = Number(parsed.target_daily_training_fixed) || Math.round(calls * 0.30);
        targets = {
          ...DEFAULT_TARGETS,
          ...parsed,
          target_daily_calls: calls,
          target_daily_training_fixed: fixed,
          target_daily_attended: Math.round(fixed * 0.65),
          target_daily_preorders: Math.round(fixed * 0.25),
          target_training_showup_rate: Number(parsed.target_training_showup_rate) || 65,
          target_lead_conversion_rate: Number(parsed.target_lead_conversion_rate) || 30,
          target_preorder_conversion_rate: Number(parsed.target_preorder_conversion_rate) || 25,
          target_avg_available_days: Number(parsed.target_avg_available_days) || 1.0,
          monthly_bonus_amount_mad: Number(parsed.monthly_bonus_amount_mad) || 1000,
          target_min_collection_rate: Number(parsed.target_min_collection_rate) || 50,
          target_collection_rate: Number(parsed.target_collection_rate) >= 50 && Number(parsed.target_collection_rate) <= 65 ? Number(parsed.target_collection_rate) : 60,
          target_max_downtime_days: Number(parsed.target_max_downtime_days) || 10,
          target_weekly_churn_limit: Number(parsed.target_weekly_churn_limit) || DEFAULT_TARGETS.target_weekly_churn_limit,
          target_monthly_churn_rate: Number(parsed.target_monthly_churn_rate) || 20,
          target_max_vidange_hours: Number(parsed.target_max_vidange_hours) || 1.0,
          target_max_field_mission_hours: Number(parsed.target_max_field_mission_hours) || 3.0,
          target_monthly_inspection_rate: Number(parsed.target_monthly_inspection_rate) || 90,
          target_sla_resolution_rate: Number(parsed.target_sla_resolution_rate) || 95,
          target_daily_tasks: Number(parsed.target_daily_tasks) || DEFAULT_TARGETS.target_daily_tasks,
          target_fleet_uptime: Number(parsed.target_fleet_uptime) || DEFAULT_TARGETS.target_fleet_uptime,
          target_ticket_resolution_rate: Number(parsed.target_ticket_resolution_rate) || Number(parsed.target_sla_resolution_rate) || 95,

          // Dynamic Weights Parsing
          weight_traffic_calls: parsed.weight_traffic_calls !== undefined ? Number(parsed.weight_traffic_calls) : DEFAULT_TARGETS.weight_traffic_calls,
          weight_traffic_training: parsed.weight_traffic_training !== undefined ? Number(parsed.weight_traffic_training) : DEFAULT_TARGETS.weight_traffic_training,
          weight_traffic_conversion: parsed.weight_traffic_conversion !== undefined ? Number(parsed.weight_traffic_conversion) : DEFAULT_TARGETS.weight_traffic_conversion,

          weight_onboarding_attended: parsed.weight_onboarding_attended !== undefined ? Number(parsed.weight_onboarding_attended) : DEFAULT_TARGETS.weight_onboarding_attended,
          weight_onboarding_preorders: parsed.weight_onboarding_preorders !== undefined ? Number(parsed.weight_onboarding_preorders) : DEFAULT_TARGETS.weight_onboarding_preorders,
          weight_onboarding_velocity: parsed.weight_onboarding_velocity !== undefined ? Number(parsed.weight_onboarding_velocity) : DEFAULT_TARGETS.weight_onboarding_velocity,

          weight_fleet_cash: parsed.weight_fleet_cash !== undefined ? Number(parsed.weight_fleet_cash) : DEFAULT_TARGETS.weight_fleet_cash,
          weight_fleet_churn: parsed.weight_fleet_churn !== undefined ? Number(parsed.weight_fleet_churn) : DEFAULT_TARGETS.weight_fleet_churn,
          weight_fleet_maintenance: parsed.weight_fleet_maintenance !== undefined ? Number(parsed.weight_fleet_maintenance) : DEFAULT_TARGETS.weight_fleet_maintenance,
          weight_fleet_vidange: parsed.weight_fleet_vidange !== undefined ? Number(parsed.weight_fleet_vidange) : DEFAULT_TARGETS.weight_fleet_vidange,
          weight_fleet_mission: parsed.weight_fleet_mission !== undefined ? Number(parsed.weight_fleet_mission) : DEFAULT_TARGETS.weight_fleet_mission,

          weight_field_mission: parsed.weight_field_mission !== undefined ? Number(parsed.weight_field_mission) : DEFAULT_TARGETS.weight_field_mission,
          weight_field_attestation: parsed.weight_field_attestation !== undefined ? Number(parsed.weight_field_attestation) : DEFAULT_TARGETS.weight_field_attestation,
          weight_field_tickets: parsed.weight_field_tickets !== undefined ? Number(parsed.weight_field_tickets) : DEFAULT_TARGETS.weight_field_tickets,
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

    // Filter leads treated in date range or scheduled for training session in date range
    const leadsTreatedInRange = allLeads.filter((l) => {
      if (l.reminder_date) {
        const rd = new Date(l.reminder_date);
        if (!isNaN(rd.getTime()) && rd >= startDate && rd <= endDate) {
          return true;
        }
      }
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

    // ── Global Funnel Numbers ──────────────────────────────────────────
    const callsDone = filteredLeadsInRange.filter((l) => l.board_column !== "NEW_LEADS").length;
    const trainingFixed = filteredLeadsInRange.filter(
      (l) => l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT"
    ).length;

    // Attended persons (candidates showing up at training)
    const attendedPersons = filteredLeadsInRange.filter(
      (l) =>
        l.training_status &&
        [
          "Attended",
          "Attended and not interested",
          "Pending",
          "Refused the offer",
          "Assign vehicle",
          "Preorder",
          "Accept offer",
        ].includes(l.training_status)
    ).length;

    const leadConversionRate = callsDone > 0 ? Number(((trainingFixed / callsDone) * 100).toFixed(1)) : 0;

    // Training Pipeline in Date Range
    const trainingLeads = filteredLeadsInRange.filter(
      (l) => l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT" || l.brand_status === "Training fixed"
    );

    const attendedCount = trainingLeads.filter(
      (l) =>
        l.training_status &&
        [
          "Attended",
          "Attended and not interested",
          "Pending",
          "Refused the offer",
          "Assign vehicle",
          "Preorder",
          "Accept offer",
        ].includes(l.training_status)
    ).length;

    const assignedVehiclesCount = trainingLeads.filter(
      (l) => l.board_column === "VEHICLE_ASSIGNMENT" || l.training_status === "Assign vehicle" || l.training_status === "Accept offer"
    ).length;

    const preorders = trainingLeads.filter((l) => l.training_status === "Preorder");
    const preordersCount = preorders.length;
    const totalPreorderMAD = preorders.reduce((acc, l) => acc + (Number(l.preorder_amount) || 0), 0);

    const attendanceRate = trainingFixed > 0 ? Number(((attendedPersons / trainingFixed) * 100).toFixed(1)) : 0;

    // ── Cascading Targets based on Moroccan Working Days ───────────────
    const dailyCallsTarget = targets.target_daily_calls || 50;
    const dailyTrainingFixedTarget = Math.round(dailyCallsTarget * 0.30);
    const dailyAttendedTarget = Math.round(dailyTrainingFixedTarget * 0.65);
    const dailyPreordersTarget = Math.round(dailyTrainingFixedTarget * 0.25);

    const scaledCallsTarget = dailyCallsTarget * workingDays;
    const scaledTrainingTarget = Math.round(scaledCallsTarget * 0.30);
    const scaledAttendedTarget = Math.round(scaledTrainingTarget * 0.65);
    const scaledPreordersTarget = Math.round(scaledTrainingTarget * 0.25);
    const scaledTasksTarget = targets.target_daily_tasks * workingDays;

    const monthlyCallsTarget = dailyCallsTarget * workingDaysInMonth;
    const monthlyTrainingTarget = Math.round(monthlyCallsTarget * 0.30);
    const monthlyAttendedTarget = Math.round(monthlyTrainingTarget * 0.65);
    const monthlyPreordersTarget = Math.round(monthlyTrainingTarget * 0.25);

    // ── Traffic Acquisition Team (Nour & Kaoutar) ─────────────────────
    const trafficLeads = leadsTreatedInRange.filter((l) => {
      const h = ((l as any).handled_by || "").toLowerCase();
      const n = (l.notes || "").toLowerCase();
      return (
        h.includes("kaoutar") ||
        h.includes("nour") ||
        n.includes("kaoutar") ||
        n.includes("nour")
      );
    });

    const activeTrafficLeads = targetUser && targetUser.role === "LEAD_ACQUISITION_JR"
      ? filteredLeadsInRange
      : (trafficLeads.length > 0 ? trafficLeads : filteredLeadsInRange);

    const trafficCallsDone = activeTrafficLeads.filter((l) => l.board_column !== "NEW_LEADS").length;
    const trafficTrainingFixed = activeTrafficLeads.filter(
      (l) => l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT"
    ).length;

    // ── Call Results Breakdown for Traffic Team (Nour & Kaoutar) ───────
    const callResults = {
      trainingFixed: 0,
      noResponse: 0,
      toRecall: 0,
      notInterested: 0,
      wrongNumber: 0,
      alreadyClient: 0,
      other: 0,
      total: 0,
    };

    activeTrafficLeads.forEach((l) => {
      if (l.board_column !== "NEW_LEADS") {
        callResults.total++;
        const s = (l.brand_status || "").toLowerCase();
        if (
          l.brand_status === "Training fixed" ||
          l.board_column === "TRAINING_PIPELINE" ||
          l.board_column === "VEHICLE_ASSIGNMENT"
        ) {
          callResults.trainingFixed++;
        } else if (s.includes("no response") || s.includes("pas de réponse")) {
          callResults.noResponse++;
        } else if (s.includes("recall") || s.includes("rappeler")) {
          callResults.toRecall++;
        } else if (s.includes("not interested") || s.includes("pas intéressé")) {
          callResults.notInterested++;
        } else if (s.includes("wrong number") || s.includes("faux numéro")) {
          callResults.wrongNumber++;
        } else if (s.includes("client")) {
          callResults.alreadyClient++;
        } else {
          callResults.other++;
        }
      }
    });

    // Attended candidates from training fixed by the traffic team (sourced from the training pipeline)
    // Note: In GoCab's workflow, once a candidate arrives at training, Ayoub Gsaib conducts the session
    // and registers presence/preorders, which updates handled_by to 'ayoub gsaib'.
    // We fall back to the training pipeline counts in range so the Traffic Acquisition team gets credit for downstream conversions.
    const directTrafficAttended = activeTrafficLeads.filter(
      (l) =>
        (l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT") &&
        l.training_status &&
        [
          "Attended",
          "Attended and not interested",
          "Pending",
          "Refused the offer",
          "Assign vehicle",
          "Preorder",
          "Accept offer",
        ].includes(l.training_status)
    ).length;

    const directTrafficPreorders = activeTrafficLeads.filter(
      (l) =>
        (l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT") &&
        (l.training_status === "Preorder" ||
          l.training_status === "Assign vehicle" ||
          l.training_status === "Accept offer" ||
          l.board_column === "VEHICLE_ASSIGNMENT")
    ).length;

    const totalTrainingPreorders = preordersCount + assignedVehiclesCount;

    const trafficAttendedPersons = directTrafficAttended > 0 ? directTrafficAttended : attendedCount;
    const trafficPreordersAssigned = directTrafficPreorders > 0 ? directTrafficPreorders : totalTrainingPreorders;

    const trafficTrainingFixedRate = trafficCallsDone > 0 ? Number(((trafficTrainingFixed / trafficCallsDone) * 100).toFixed(1)) : 0;
    const trafficAttendedRate = trafficTrainingFixed > 0 ? Number(((trafficAttendedPersons / trafficTrainingFixed) * 100).toFixed(1)) : 0;
    const trafficPreorderAssignedRate = trafficTrainingFixed > 0 ? Number(((trafficPreordersAssigned / trafficTrainingFixed) * 100).toFixed(1)) : 0;

    // Traffic Team Composite Attainment %
    const callsAttainment = scaledCallsTarget > 0 ? (trafficCallsDone / scaledCallsTarget) * 100 : 0;
    const trainingAttainment = scaledTrainingTarget > 0 ? (trafficTrainingFixed / scaledTrainingTarget) * 100 : 0;
    const conversionAttainment = (trafficTrainingFixedRate / 30.0) * 100;
    const trafficWeightSum =
      (targets.weight_traffic_calls + targets.weight_traffic_training + targets.weight_traffic_conversion) || 100;
    const trafficTeamAttainmentPct = Number(
      (
        (targets.weight_traffic_calls * Math.min(150, callsAttainment) +
          targets.weight_traffic_training * Math.min(150, trainingAttainment) +
          targets.weight_traffic_conversion * Math.min(150, conversionAttainment)) /
        trafficWeightSum
      ).toFixed(1)
    );

    // 1,000 MAD Bonus (Option 2: Proportionnel pur)
    const trafficTeamBonusEarnedMAD = Math.min(1000, Math.round(1000 * (trafficTeamAttainmentPct / 100)));

    // ── Onboarding Specialist Team (Ayoub Gsaib) ───────────────────────
    // Ayoub Gsaib conducts and manages the training sessions for all scheduled candidates
    const activeOnboardingLeads = targetUser && targetUser.role === "ONBOARDING_SPECIALIST"
      ? filteredLeadsInRange
      : trainingLeads;

    const onboardingAttendedCount = activeOnboardingLeads.filter(
      (l) =>
        l.training_status &&
        [
          "Attended",
          "Attended and not interested",
          "Pending",
          "Refused the offer",
          "Assign vehicle",
          "Preorder",
          "Accept offer",
        ].includes(l.training_status)
    ).length;

    const onboardingPreordersCount = activeOnboardingLeads.filter((l) => l.training_status === "Preorder").length;
    const onboardingAssignedCount = activeOnboardingLeads.filter(
      (l) => l.board_column === "VEHICLE_ASSIGNMENT" || l.training_status === "Assign vehicle" || l.training_status === "Accept offer"
    ).length;
    const onboardingPreorderAssignedTotal = onboardingPreordersCount + onboardingAssignedCount;

    const scheduledTrainingCount = activeOnboardingLeads.length > 0 ? activeOnboardingLeads.length : trainingFixed;
    const onboardingShowupRate = scheduledTrainingCount > 0 ? Number(((onboardingAttendedCount / scheduledTrainingCount) * 100).toFixed(1)) : 0;
    const onboardingConversionRate = scheduledTrainingCount > 0 ? Number(((onboardingPreorderAssignedTotal / scheduledTrainingCount) * 100).toFixed(1)) : 0;

    // Conversion rate specifically of attended candidates: % preorder-assign / attended (Target: > 20% in each session)
    const onboardingAttendedConversionRate = onboardingAttendedCount > 0
      ? Number(((onboardingPreorderAssignedTotal / onboardingAttendedCount) * 100).toFixed(1))
      : 0;

    // Session-by-Session Performance Breakdown (reminder_date = scheduled training session date)
    const sessionMap = new Map<string, {
      date: string;
      convokedCount: number;
      scheduledCount: number;
      attendedCount: number;
      preordersCount: number;
      assignedCount: number;
    }>();

    activeOnboardingLeads.forEach((l) => {
      let sessionDate = "";
      if (l.reminder_date) {
        try {
          const d = new Date(l.reminder_date);
          if (!isNaN(d.getTime())) sessionDate = d.toISOString().split("T")[0];
        } catch {}
      }
      if (!sessionDate && l.status_changed_at) {
        try {
          const d = new Date(l.status_changed_at);
          if (!isNaN(d.getTime())) sessionDate = d.toISOString().split("T")[0];
        } catch {}
      }
      if (!sessionDate && l.created_at) {
        try {
          const d = new Date(l.created_at);
          if (!isNaN(d.getTime())) sessionDate = d.toISOString().split("T")[0];
        } catch {}
      }
      if (!sessionDate) sessionDate = "Session non datée";

      if (!sessionMap.has(sessionDate)) {
        sessionMap.set(sessionDate, {
          date: sessionDate,
          convokedCount: 0,
          scheduledCount: 0,
          attendedCount: 0,
          preordersCount: 0,
          assignedCount: 0,
        });
      }

      const entry = sessionMap.get(sessionDate)!;
      entry.convokedCount++;

      // Count leads currently in "Scheduled" status (Training Fixed awaiting session)
      const isScheduled =
        l.training_status === "Scheduled" ||
        (!l.training_status && l.board_column === "TRAINING_PIPELINE");
      if (isScheduled) {
        entry.scheduledCount++;
      }

      const isAttended = Boolean(
        l.training_status &&
        [
          "Attended",
          "Attended and not interested",
          "Pending",
          "Refused the offer",
          "Assign vehicle",
          "Preorder",
          "Accept offer",
        ].includes(l.training_status)
      );

      if (isAttended) {
        entry.attendedCount++;
      }

      if (l.training_status === "Preorder") {
        entry.preordersCount++;
      }
      if (l.board_column === "VEHICLE_ASSIGNMENT" || l.training_status === "Assign vehicle" || l.training_status === "Accept offer") {
        entry.assignedCount++;
      }
    });

    const trainingSessionsList = Array.from(sessionMap.values())
      .map((s) => {
        const totalPreordersAssigned = s.preordersCount + s.assignedCount;
        const conversionPerAttendedPct = s.attendedCount > 0
          ? Number(((totalPreordersAssigned / s.attendedCount) * 100).toFixed(1))
          : 0;
        const isCompliant = s.attendedCount > 0 && conversionPerAttendedPct >= 20.0;
        return {
          date: s.date,
          convokedCount: s.convokedCount,
          scheduledCount: s.scheduledCount,
          attendedCount: s.attendedCount,
          preordersCount: s.preordersCount,
          assignedCount: s.assignedCount,
          preordersAssignedTotal: totalPreordersAssigned,
          conversionPerAttendedPct,
          targetConversionPct: 20.0,
          isCompliant,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const compliantSessionsCount = trainingSessionsList.filter((s) => s.attendedCount > 0 && s.isCompliant).length;
    const totalActiveSessionsCount = trainingSessionsList.filter((s) => s.attendedCount > 0).length;

    // AVG Days Cars Remain as "Available" status
    const availableCars = await prisma.vehicle.findMany({
      where: { status: "Available", is_archived: false },
      select: { id: true, total_downtime_days: true, updated_at: true },
    });
    let sumAvailableDays = 0;
    availableCars.forEach((c) => {
      if (c.total_downtime_days && c.total_downtime_days > 0) {
        sumAvailableDays += c.total_downtime_days;
      } else {
        const d = (now.getTime() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        sumAvailableDays += Math.max(0, d);
      }
    });
    const avgDaysCarAvailable = availableCars.length > 0
      ? Number((sumAvailableDays / availableCars.length).toFixed(1))
      : 0.8;

    // Fleet Velocity Score: Target <= 1.0 day
    let velocityScorePct = 100;
    if (avgDaysCarAvailable <= 1.0) {
      velocityScorePct = Math.min(120, Math.round(100 + (1.0 - avgDaysCarAvailable) * 20));
    } else {
      velocityScorePct = Math.max(0, Math.round(100 - (avgDaysCarAvailable - 1.0) * 50));
    }

    const attendedAttainment = scaledAttendedTarget > 0 ? (onboardingAttendedCount / scaledAttendedTarget) * 100 : 0;
    const preordersAttainment = scaledPreordersTarget > 0 ? (onboardingPreorderAssignedTotal / scaledPreordersTarget) * 100 : 0;
    const onboardingWeightSum =
      (targets.weight_onboarding_attended + targets.weight_onboarding_preorders + targets.weight_onboarding_velocity) || 100;
    const onboardingTeamAttainmentPct = Number(
      (
        (targets.weight_onboarding_attended * Math.min(150, attendedAttainment) +
          targets.weight_onboarding_preorders * Math.min(150, preordersAttainment) +
          targets.weight_onboarding_velocity * Math.min(150, velocityScorePct)) /
        onboardingWeightSum
      ).toFixed(1)
    );

    // 1,000 MAD Bonus (Option 2: Proportionnel pur)
    const onboardingBonusEarnedMAD = Math.min(1000, Math.round(1000 * (onboardingTeamAttainmentPct / 100)));

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

    const totalMorningTargetMAD =
      paymentLedgers.reduce((acc, row) => {
        const mb = Number(row.morningBalance) || 0;
        if (mb < 0) return acc + Math.abs(mb);
        return acc + (Number(row.expectedMAD) || 0);
      }, 0) || dailyCollections.reduce((acc, d) => acc + (Number(d.expected_total) || 0), 0);

    const totalEveningCollectedMAD =
      paymentLedgers.reduce((acc, row) => {
        const collected =
          Number(row.clearedMAD) || (Number(row.calculatedDelta) && Number(row.calculatedDelta) > 0 ? Number(row.calculatedDelta) : 0);
        return acc + collected;
      }, 0) || dailyCollections.reduce((acc, d) => acc + (Number(d.collected_total) || 0), 0);

    const collectionRecoveryRate =
      totalMorningTargetMAD > 0 ? Number(((totalEveningCollectedMAD / totalMorningTargetMAD) * 100).toFixed(1)) : 0;

    // 5. Calculate Support, Maintenance, Churn & Field Mission Metrics for Fleet Performance Manager (Salma & Mohamed Aziz)
    const [activeAccidents, garageVehicles, repairTickets, vidangeTickets] = await Promise.all([
      prisma.accidentClaim.findMany({
        where: { timeline_step: { not: "VEHICLE_BACK" } },
      }),
      prisma.vehicle.findMany({
        where: {
          is_archived: false,
          status: { in: ["In garage", "In service", "Accident", "Maintenance"] },
        },
        select: { id: true, total_downtime_days: true, updated_at: true },
      }),
      prisma.maintenanceTicket.findMany({
        where: {
          is_archived: false,
          ticket_type: { in: ["Repair", "Accident"] },
          OR: [
            { status: { in: ["OPEN", "IN_PROGRESS"] } },
            { created_at: { gte: startDate, lte: endDate } },
          ],
        },
      }),
      prisma.maintenanceTicket.findMany({
        where: {
          is_archived: false,
          ticket_type: { in: ["Vidange", "AdBleu", "AdBlue"] },
          OR: [
            { status: { in: ["OPEN", "IN_PROGRESS"] } },
            { created_at: { gte: startDate, lte: endDate } },
          ],
        },
      }),
    ]);

    // 5a. AVG Days Cars Stay in Maintenance (Target: <= 10 days)
    const maintenanceDurationsDays: number[] = [];
    activeAccidents.forEach((claim) => {
      const claimDate = new Date(claim.created_at);
      const days = Math.max(0, (now.getTime() - claimDate.getTime()) / (1000 * 60 * 60 * 24));
      maintenanceDurationsDays.push(days);
    });
    repairTickets.forEach((ticket) => {
      const start = new Date(ticket.started_at || ticket.created_at);
      const end = ticket.resolved_at ? new Date(ticket.resolved_at) : now;
      const days = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      maintenanceDurationsDays.push(days);
    });
    garageVehicles.forEach((v) => {
      if (v.total_downtime_days && v.total_downtime_days > 0) {
        maintenanceDurationsDays.push(v.total_downtime_days);
      } else {
        const days = Math.max(0, (now.getTime() - new Date(v.updated_at).getTime()) / (1000 * 60 * 60 * 24));
        maintenanceDurationsDays.push(days);
      }
    });

    const avgDaysInsuranceRepair =
      maintenanceDurationsDays.length > 0
        ? Number((maintenanceDurationsDays.reduce((a, b) => a + b, 0) / maintenanceDurationsDays.length).toFixed(1))
        : 0;
    const carsInMaintenanceCount = Math.max(garageVehicles.length, activeAccidents.length);

    // 5b. Timing to Deal with Vidange / AdBleu (Target: AVG <= 1.0 H)
    const vidangeHoursList: number[] = [];
    vidangeTickets.forEach((ticket) => {
      const start = new Date(ticket.started_at || ticket.created_at);
      const end = ticket.resolved_at ? new Date(ticket.resolved_at) : now;
      const hours = Math.max(0.1, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      vidangeHoursList.push(hours);
    });
    const avgHoursAdBlueVidange =
      vidangeHoursList.length > 0
        ? Number((vidangeHoursList.reduce((a, b) => a + b, 0) / vidangeHoursList.length).toFixed(1))
        : 0.8;

    // 5c. Monthly Churn Rate (Target: <= 20% monthly of total fleet drivers)
    const churnEvents = await prisma.churnEvent.findMany({
      where: {
        churned_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const [activeDriversCount, activeVehiclesCount] = await Promise.all([
      prisma.driverProfile.count({ where: { is_archived: false } }),
      prisma.vehicle.count({ where: { is_archived: false, status: "Actif" } }),
    ]);

    const totalFleetDrivers = Math.max(activeDriversCount, activeVehiclesCount, 1);
    const churnCount = churnEvents.length;
    const weeksInRange = Math.max(1, workingDays / 5);
    const weeklyChurnRate =
      totalFleetDrivers > 0 ? Number((((churnCount / weeksInRange) / totalFleetDrivers) * 100).toFixed(1)) : 0;

    const monthsInPeriod = moroccanDaysInfo.totalCalendarDays > 31 ? moroccanDaysInfo.totalCalendarDays / 30 : 1;
    const monthlyChurnRate =
      totalFleetDrivers > 0 ? Number((((churnCount / monthsInPeriod) / totalFleetDrivers) * 100).toFixed(1)) : 0;

    // 6. Query Field Tasks & Inspections (Timing to Execute Field Mission: AVG <= 3.0 H)
    const fieldTasks = await prisma.fieldTask.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const tasksCompleted = fieldTasks.filter((t) => t.status === "Completed" || t.status === "COMPLETED").length;
    const tasksFailed = fieldTasks.filter((t) => t.status === "Failed" || t.status === "FAILED").length;
    const tasksTotal = fieldTasks.length;
    const taskCompletionRate = tasksTotal > 0 ? Number(((tasksCompleted / tasksTotal) * 100).toFixed(1)) : 0;

    const completedTasks = fieldTasks.filter((t) => t.status === "Completed" || t.status === "COMPLETED");
    let totalRecoveryHours = 0;
    completedTasks.forEach((task) => {
      if (task.recovery_duration_hours && task.recovery_duration_hours > 0) {
        totalRecoveryHours += task.recovery_duration_hours;
      } else if (task.completed_at) {
        const h = Math.max(0.2, (new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60));
        totalRecoveryHours += h;
      } else if (task.duration_hours) {
        totalRecoveryHours += task.duration_hours;
      }
    });
    const avgHoursVehicleRecovery =
      completedTasks.length > 0 ? Number((totalRecoveryHours / completedTasks.length).toFixed(1)) : 2.1;

    // ── Fleet Performance Manager Team (Salma Abouri & Mohamed Aziz) Composite Attainment & 1,000 MAD Bonus ──
    const targetMinCollectionRate = targets.target_min_collection_rate || 50; // 50%-60% daily target
    const targetMaxCollectionRate = targets.target_collection_rate || 60;
    const maxMonthlyChurnRate = targets.target_monthly_churn_rate || 20; // <= 20% monthly
    const maxDaysInMaintenance = targets.target_max_downtime_days || 10; // <= 10 days AVG
    const maxHoursVidangeAdBlue = targets.target_max_vidange_hours || 1.0; // <= 1H AVG
    const maxHoursFieldMission = targets.target_max_field_mission_hours || 3.0; // <= 3H AVG

    // KPI 1 Attainment: Cash Collection (50%-60% of daily collection amount by end of day)
    const collectionAttainmentPct =
      collectionRecoveryRate >= targetMinCollectionRate
        ? Math.min(
            150,
            Number(
              (
                100 +
                ((collectionRecoveryRate - targetMinCollectionRate) /
                  Math.max(1, targetMaxCollectionRate - targetMinCollectionRate)) *
                  10
              ).toFixed(1)
            )
          )
        : Number(((collectionRecoveryRate / targetMinCollectionRate) * 100).toFixed(1));

    // KPI 2 Attainment: Monthly Churn Rate (<= 20% monthly of total fleet drivers)
    const churnAttainmentPct =
      monthlyChurnRate <= maxMonthlyChurnRate
        ? Math.min(120, Number((100 + (maxMonthlyChurnRate - monthlyChurnRate) * 0.5).toFixed(1)))
        : Math.max(0, Number((100 - (monthlyChurnRate - maxMonthlyChurnRate) * 5).toFixed(1)));

    // KPI 3 Attainment: AVG Days Cars Stay in Maintenance (<= 10 days)
    const maintenanceAttainmentPct =
      avgDaysInsuranceRepair <= maxDaysInMaintenance
        ? Math.min(120, Number((100 + (maxDaysInMaintenance - avgDaysInsuranceRepair) * 2).toFixed(1)))
        : Math.max(0, Number((100 - (avgDaysInsuranceRepair - maxDaysInMaintenance) * 10).toFixed(1)));

    // KPI 4 Attainment: Timing to Deal with Vidange / AdBleu (AVG <= 1H)
    const vidangeAttainmentPct =
      avgHoursAdBlueVidange <= maxHoursVidangeAdBlue
        ? Math.min(120, Number((100 + (maxHoursVidangeAdBlue - avgHoursAdBlueVidange) * 20).toFixed(1)))
        : Math.max(0, Number(((maxHoursVidangeAdBlue / avgHoursAdBlueVidange) * 100).toFixed(1)));

    // KPI 5 Attainment: Timing to Execute Field Mission (AVG <= 3H)
    const fieldMissionAttainmentPct =
      avgHoursVehicleRecovery <= maxHoursFieldMission
        ? Math.min(120, Number((100 + (maxHoursFieldMission - avgHoursVehicleRecovery) * 10).toFixed(1)))
        : Math.max(0, Number(((maxHoursFieldMission / avgHoursVehicleRecovery) * 100).toFixed(1)));

    // Weighted Composite Team Attainment % across all 5 KPIs:
    const fleetWeightSum =
      (targets.weight_fleet_cash +
        targets.weight_fleet_churn +
        targets.weight_fleet_maintenance +
        targets.weight_fleet_vidange +
        targets.weight_fleet_mission) || 100;

    const fleetPerfTeamAttainmentPct = Number(
      (
        (targets.weight_fleet_cash * Math.min(150, collectionAttainmentPct) +
          targets.weight_fleet_churn * Math.min(150, churnAttainmentPct) +
          targets.weight_fleet_maintenance * Math.min(150, maintenanceAttainmentPct) +
          targets.weight_fleet_vidange * Math.min(150, vidangeAttainmentPct) +
          targets.weight_fleet_mission * Math.min(150, fieldMissionAttainmentPct)) /
        fleetWeightSum
      ).toFixed(1)
    );

    const fleetPerfBonusEarnedMAD = Math.min(1000, Math.round(1000 * (fleetPerfTeamAttainmentPct / 100)));

    const [inspections, attestationVehicles, allPeriodTickets] = await Promise.all([
      prisma.vehicleInspection.findMany({
        where: {
          inspection_date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      prisma.vehicle.findMany({
        where: {
          is_archived: false,
          OR: [
            { autorisation_expiry_date: { not: null } },
            { status: "Actif" },
          ],
        },
        select: {
          id: true,
          plate_number: true,
          status: true,
          assigned_driver_name: true,
          autorisation_expiry_date: true,
        },
      }),
      prisma.maintenanceTicket.findMany({
        where: {
          is_archived: false,
          status: { not: "CANCELLED" },
          OR: [
            { created_at: { gte: startDate, lte: endDate } },
            { resolved_at: { gte: startDate, lte: endDate } },
            { status: { in: ["OPEN", "IN_PROGRESS"] } },
          ],
        },
        select: {
          id: true,
          status: true,
          field_status: true,
          ticket_type: true,
          created_at: true,
          resolved_at: true,
        },
      }),
    ]);

    const monthlyChecksCount = inspections.length;

    const avgHealthScore =
      inspections.length > 0
        ? Number((inspections.reduce((acc, i) => acc + Number(i.health_score), 0) / inspections.length).toFixed(1))
        : 5.0;

    // ── Field Supervisor Team (Hamza Rassid & Ayoub Rassid) 3 KPIs & 1,000 MAD Bonus ──
    // KPI 1: AVG Time to Complete Missions (Target: <= 3.0 H AVG)
    const avgHoursMissionCompletion = avgHoursVehicleRecovery;
    const targetMaxMissionHours = targets.target_max_field_mission_hours || 3.0;
    const missionTimeAttainmentPct = fieldMissionAttainmentPct;

    // KPI 2: % of Persons / Drivers Generated the Attestation de Location in Time (Target: >= 90%)
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inspectedVehicleIdsInPeriod = new Set(inspections.map((i) => i.vehicle_id));
    const vehiclesWithConfiguredAttestation = attestationVehicles.filter(
      (v) => v.autorisation_expiry_date !== null || inspectedVehicleIdsInPeriod.has(v.id)
    );
    const attestationTrackedPool =
      vehiclesWithConfiguredAttestation.length > 0 ? vehiclesWithConfiguredAttestation : attestationVehicles;

    const attestationTotalPersons = attestationTrackedPool.length;
    const attestationOnTimeCount = attestationTrackedPool.filter((v) => {
      if (inspectedVehicleIdsInPeriod.has(v.id)) return true;
      if (v.autorisation_expiry_date) {
        const exp = new Date(v.autorisation_expiry_date);
        const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
        return expDay.getTime() >= todayMidnight.getTime();
      }
      return false;
    }).length;

    const attestationOnTimeRate =
      attestationTotalPersons > 0
        ? Number(((attestationOnTimeCount / attestationTotalPersons) * 100).toFixed(1))
        : 100;
    const targetAttestationOnTimeRate = targets.target_monthly_inspection_rate || 90;
    const attestationAttainmentPct = Number(
      Math.min(150, (attestationOnTimeRate / targetAttestationOnTimeRate) * 100).toFixed(1)
    );

    // KPI 3: % of Tickets Resolved (Target: >= 95%)
    const unlinkedFieldTasks = fieldTasks.filter(
      (ft) => !ft.linked_ticket_id && ft.status !== "FAILED" && ft.status !== "Failed"
    );
    const resolvedMaintenanceTickets = allPeriodTickets.filter(
      (t) =>
        t.status === "RESOLVED" ||
        t.field_status === "COMPLETED" ||
        t.field_status === "PICKED_UP"
    ).length;
    const resolvedUnlinkedTasks = unlinkedFieldTasks.filter(
      (ft) => ft.status === "COMPLETED" || ft.status === "Completed"
    ).length;

    const ticketsTotalCount = allPeriodTickets.length + unlinkedFieldTasks.length;
    const ticketsResolvedCount = resolvedMaintenanceTickets + resolvedUnlinkedTasks;
    const ticketResolutionRate =
      ticketsTotalCount > 0
        ? Number(((ticketsResolvedCount / ticketsTotalCount) * 100).toFixed(1))
        : 100;
    const targetTicketResolutionRate = targets.target_ticket_resolution_rate || targets.target_sla_resolution_rate || 95;
    const ticketResolutionAttainmentPct = Number(
      Math.min(150, (ticketResolutionRate / targetTicketResolutionRate) * 100).toFixed(1)
    );

    // Composite Team Attainment % across all 3 KPIs
    const fieldWeightSum =
      (targets.weight_field_mission + targets.weight_field_attestation + targets.weight_field_tickets) || 100;

    const fieldSupervisorTeamAttainmentPct = Number(
      (
        (targets.weight_field_mission * Math.min(150, missionTimeAttainmentPct) +
          targets.weight_field_attestation * Math.min(150, attestationAttainmentPct) +
          targets.weight_field_tickets * Math.min(150, ticketResolutionAttainmentPct)) /
        fieldWeightSum
      ).toFixed(1)
    );
    const fieldSupervisorBonusEarnedMAD = Math.min(
      1000,
      Math.round(1000 * (fieldSupervisorTeamAttainmentPct / 100))
    );

    // 7. Build Team Leaderboard with individual & team attribution
    const leaderboard = users.map((u) => {
      let dept = "Operations";
      let keyMetric = "Tasks";
      let actual = 0;
      let target = scaledTasksTarget;
      let unit = "";
      let bonusEarnedMAD = 0;
      let teamName = "Opérations";
      let teamAttainmentPct = 100;

      const uName = (u.fullName || u.name || "").toLowerCase();
      const uEmail = (u.email || "").toLowerCase();

      const userHandledLeads = leadsTreatedInRange.filter((l) => {
        const h = ((l as any).handled_by || "").toLowerCase();
        const n = (l.notes || "").toLowerCase();
        return h.includes(uName) || h.includes(uEmail) || n.includes(uName) || n.includes(uEmail);
      });

      const userCalls = userHandledLeads.filter((l) => l.board_column !== "NEW_LEADS").length;
      const userTrainings = userHandledLeads.filter(
        (l) => l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT"
      ).length;

      if (u.role === "LEAD_ACQUISITION_JR" || u.role === "BRAND_MANAGER" || uName.includes("nour") || uName.includes("kaoutar")) {
        dept = "Acquisition Prospects";
        teamName = "Traffic Acquisition (Nour & Kaoutar)";
        keyMetric = "Formations Fixées";
        actual = userTrainings > 0 ? userTrainings : trafficTrainingFixed;
        target = scaledTrainingTarget;
        unit = "leads";
        teamAttainmentPct = trafficTeamAttainmentPct;
        bonusEarnedMAD = trafficTeamBonusEarnedMAD;
      } else if (u.role === "ONBOARDING_SPECIALIST" || uName.includes("ayoub gsaib")) {
        dept = "Formation & Onboarding";
        teamName = "Onboarding Specialist (Ayoub Gsaib)";
        keyMetric = "Précommandes / Affect.";
        const userPreorders = userHandledLeads.filter(
          (l) => l.training_status === "Assign vehicle" || l.training_status === "Accept offer" || l.training_status === "Preorder"
        ).length;
        actual = userPreorders > 0 ? userPreorders : onboardingPreorderAssignedTotal;
        target = scaledPreordersTarget;
        unit = "drivers";
        teamAttainmentPct = onboardingTeamAttainmentPct;
        bonusEarnedMAD = onboardingBonusEarnedMAD;
      } else if (u.role === "FLEET_PERF_MANAGER" || uName.includes("salma") || uName.includes("mohamed aziz")) {
        dept = "Performance Flotte & Recouvrement";
        teamName = "Fleet Performance (Salma & Mohamed Aziz)";
        keyMetric = "Cash (50%-60%) & 5 KPIs Flotte";
        actual = collectionRecoveryRate;
        target = targetMinCollectionRate;
        unit = "% (50%-60%)";
        teamAttainmentPct = fleetPerfTeamAttainmentPct;
        bonusEarnedMAD = fleetPerfBonusEarnedMAD;
      } else if (u.role === "FIELD_SUPERVISOR" || uName.includes("hamza") || uName.includes("ayoub rassid")) {
        dept = "Opérations Terrain";
        teamName = "Field Supervisor (Hamza & Ayoub Rassid)";
        keyMetric = "Missions (≤3h) · Attest. (90%) · Tickets (95%)";
        actual = ticketResolutionRate;
        target = targetTicketResolutionRate;
        unit = "% résolus";
        teamAttainmentPct = fieldSupervisorTeamAttainmentPct;
        bonusEarnedMAD = fieldSupervisorBonusEarnedMAD;
      } else if (u.role === "OPS_MANAGER" || u.role === "ADMIN") {
        dept = "Direction des Opérations";
        teamName = "Executive";
        keyMetric = "Disponibilité Flotte";
        actual = 95;
        target = targets.target_fleet_uptime;
        unit = "%";
        teamAttainmentPct = 100;
        bonusEarnedMAD = 1000;
      } else if (u.role === "FINANCE_OFFICER") {
        dept = "Finance & Assurance";
        teamName = "Finance";
        keyMetric = "Encaissements MAD";
        actual = totalEveningCollectedMAD;
        target = totalMorningTargetMAD * 0.6;
        unit = "MAD";
        teamAttainmentPct = 100;
        bonusEarnedMAD = 1000;
      }

      const individualAttainmentPct =
        u.role === "FLEET_PERF_MANAGER" || uName.includes("salma") || uName.includes("mohamed aziz")
          ? collectionAttainmentPct
          : u.role === "FIELD_SUPERVISOR" || uName.includes("hamza") || uName.includes("ayoub rassid")
          ? fieldSupervisorTeamAttainmentPct
          : target > 0
          ? Number(((actual / target) * 100).toFixed(1))
          : 100;

      let status: "EXCEEDED" | "ON_TRACK" | "BEHIND" = "ON_TRACK";
      if (teamAttainmentPct >= 100) status = "EXCEEDED";
      else if (teamAttainmentPct < 80) status = "BEHIND";

      return {
        id: u.id,
        name: u.fullName || u.name,
        email: u.email,
        role: u.role,
        department: dept,
        teamName,
        keyMetric,
        actual,
        target,
        unit,
        attainmentPct: teamAttainmentPct,
        individualAttainmentPct,
        bonusEarnedMAD,
        bonusBudgetMAD: 1000,
        status,
      };
    }).sort((a, b) => b.attainmentPct - a.attainmentPct);

    // 8. Generate Daily Trends Array
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
        (l) => l.brand_status === "Training fixed" || l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT"
      ).length;

      const dayPaymentLedgers = paymentLedgers.filter(
        (p) => p.paymentDate && new Date(p.paymentDate).toISOString().split("T")[0] === dateKey
      );
      const dayDailyCols = dailyCollections.filter(
        (c) => c.date && new Date(c.date).toISOString().split("T")[0] === dateKey
      );
      const dayCollectedMAD =
        dayPaymentLedgers.reduce(
          (acc, row) =>
            acc +
            (Number(row.clearedMAD) ||
              (Number(row.calculatedDelta) && Number(row.calculatedDelta) > 0 ? Number(row.calculatedDelta) : 0)),
          0
        ) || dayDailyCols.reduce((acc, row) => acc + (Number(row.collected_total) || 0), 0);

      const dayTasks = fieldTasks.filter(
        (t) => t.created_at && new Date(t.created_at).toISOString().split("T")[0] === dateKey
      );
      const dayTasksDone = dayTasks.filter((t) => t.status === "Completed" || t.status === "COMPLETED").length;

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
        dayCount: workingDays,
        calendarDays: moroccanDaysInfo.totalCalendarDays,
        workingDays,
        workingDaysInMonth,
        holidaysEncountered: moroccanDaysInfo.holidaysEncountered,
      },
      targets,
      callResultsBreakdown: callResults,
      trafficAcquisitionTeam: {
        callsDone: trafficCallsDone,
        callsTarget: scaledCallsTarget,
        callsAttainmentPct: Number(callsAttainment.toFixed(1)),
        trainingFixed: trafficTrainingFixed,
        trainingFixedTarget: scaledTrainingTarget,
        trainingFixedAttainmentPct: Number(trainingAttainment.toFixed(1)),
        trainingFixedRate: trafficTrainingFixedRate,
        targetTrainingFixedRate: 30.0,
        attendedPersons: trafficAttendedPersons,
        attendedRate: trafficAttendedRate,
        targetAttendedRate: 65.0,
        preordersAssigned: trafficPreordersAssigned,
        preorderAssignedRate: trafficPreorderAssignedRate,
        targetPreorderAssignedRate: 25.0,
        teamAttainmentPct: trafficTeamAttainmentPct,
        monthlyBonusBudgetMAD: 1000,
        bonusEarnedMAD: trafficTeamBonusEarnedMAD,
        members: ["Nour Abouri", "Kaoutar Ouardi"],
      },
      onboardingSpecialistTeam: {
        attendedCount: onboardingAttendedCount,
        attendedTarget: scaledAttendedTarget,
        attendedAttainmentPct: Number(attendedAttainment.toFixed(1)),
        preordersCount: onboardingPreordersCount,
        assignedCount: onboardingAssignedCount,
        preordersAssignedTotal: onboardingPreorderAssignedTotal,
        preordersTarget: scaledPreordersTarget,
        preordersAttainmentPct: Number(preordersAttainment.toFixed(1)),
        showupRate: onboardingShowupRate,
        targetShowupRate: 65.0,
        preorderAssignedRate: onboardingConversionRate,
        targetPreorderAssignedRate: 25.0,
        conversionPerAttendedRate: onboardingAttendedConversionRate,
        targetConversionPerAttendedRate: 20.0,
        avgDaysCarAvailable,
        targetAvgDaysCarAvailable: 1.0,
        velocityScorePct,
        teamAttainmentPct: onboardingTeamAttainmentPct,
        monthlyBonusBudgetMAD: 1000,
        bonusEarnedMAD: onboardingBonusEarnedMAD,
        members: ["Ayoub Gsaib"],
        trainingSessions: trainingSessionsList,
        compliantSessionsCount,
        totalActiveSessionsCount,
      },
      fleetPerformanceTeam: {
        totalMorningTargetMAD,
        totalEveningCollectedMAD,
        collectionRecoveryRate,
        targetMinCollectionRate,
        targetMaxCollectionRate,
        collectionAttainmentPct,
        isCollectionCompliant: collectionRecoveryRate >= targetMinCollectionRate,
        monthlyChurnRate,
        maxMonthlyChurnRate,
        churnCount,
        totalFleetDrivers,
        churnAttainmentPct,
        isChurnCompliant: monthlyChurnRate <= maxMonthlyChurnRate,
        avgDaysInMaintenance: avgDaysInsuranceRepair,
        maxDaysInMaintenance,
        carsInMaintenanceCount,
        maintenanceAttainmentPct,
        isMaintenanceCompliant: avgDaysInsuranceRepair <= maxDaysInMaintenance,
        avgHoursAdBlueVidange,
        maxHoursVidangeAdBlue,
        vidangeTicketsCount: vidangeTickets.length,
        vidangeAttainmentPct,
        isVidangeCompliant: avgHoursAdBlueVidange <= maxHoursVidangeAdBlue,
        avgHoursFieldMission: avgHoursVehicleRecovery,
        maxHoursFieldMission,
        fieldMissionsCompletedCount: tasksCompleted,
        fieldMissionAttainmentPct,
        isFieldMissionCompliant: avgHoursVehicleRecovery <= maxHoursFieldMission,
        teamAttainmentPct: fleetPerfTeamAttainmentPct,
        monthlyBonusBudgetMAD: 1000,
        bonusEarnedMAD: fleetPerfBonusEarnedMAD,
        members: ["Salma Abouri", "Mohamed Aziz"],
      },
      fieldSupervisorTeam: {
        avgHoursMissionCompletion,
        targetMaxMissionHours,
        missionsCompletedCount: tasksCompleted,
        missionsTotalCount: tasksTotal,
        missionTimeAttainmentPct,
        isMissionTimeCompliant: avgHoursMissionCompletion <= targetMaxMissionHours,
        attestationOnTimeRate,
        targetAttestationOnTimeRate,
        attestationOnTimeCount,
        attestationTotalPersons,
        attestationAttainmentPct,
        isAttestationCompliant: attestationOnTimeRate >= targetAttestationOnTimeRate,
        ticketResolutionRate,
        targetTicketResolutionRate,
        ticketsResolvedCount,
        ticketsTotalCount,
        ticketResolutionAttainmentPct,
        isTicketResolutionCompliant: ticketResolutionRate >= targetTicketResolutionRate,
        teamAttainmentPct: fieldSupervisorTeamAttainmentPct,
        monthlyBonusBudgetMAD: 1000,
        bonusEarnedMAD: fieldSupervisorBonusEarnedMAD,
        members: ["Hamza Rassid", "Ayoub Rassid"],
      },
      monthlyTargets: {
        monthlyCallsTarget,
        monthlyTrainingTarget,
        monthlyAttendedTarget,
        monthlyPreordersTarget,
        workingDaysInMonth,
      },
      kpis: {
        leadAcquisition: {
          callsDone: trafficCallsDone || callsDone,
          callsTarget: scaledCallsTarget,
          callsAttainmentPct: scaledCallsTarget > 0 ? Number(((trafficCallsDone / scaledCallsTarget) * 100).toFixed(1)) : 0,
          trainingFixed: trafficTrainingFixed || trainingFixed,
          trainingTarget: scaledTrainingTarget,
          trainingAttainmentPct: scaledTrainingTarget > 0 ? Number(((trafficTrainingFixed / scaledTrainingTarget) * 100).toFixed(1)) : 0,
          attendedPersons: trafficAttendedPersons || attendedPersons,
          conversionRate: trafficTrainingFixedRate,
          targetConversionRate: 30.0,
          bonusEarnedMAD: trafficTeamBonusEarnedMAD,
        },
        trainingOnboarding: {
          attendanceRate: onboardingShowupRate || attendanceRate,
          targetAttendanceRate: 65.0,
          attendanceAttainmentPct: Number(attendedAttainment.toFixed(1)),
          assignedVehiclesCount: onboardingAssignedCount || assignedVehiclesCount,
          assignedVehiclesTarget: scaledPreordersTarget,
          preordersCount: onboardingPreordersCount || preordersCount,
          preordersTarget: scaledPreordersTarget,
          preordersAttainmentPct: Number(preordersAttainment.toFixed(1)),
          totalPreorderMAD,
          avgDaysCarAvailable,
          targetAvgDaysCarAvailable: 1.0,
          bonusEarnedMAD: onboardingBonusEarnedMAD,
        },
        fleetCollections: {
          totalMorningTargetMAD,
          totalEveningCollectedMAD,
          collectionRecoveryRate,
          recoveryObjectiveMinPct: targetMinCollectionRate,
          recoveryObjectivePct: targetMaxCollectionRate,
          collectionAttainmentPct,
          isObjectiveMet: collectionRecoveryRate >= targetMinCollectionRate,
          avgDaysInsuranceRepair,
          maxDaysInsuranceRepair: maxDaysInMaintenance,
          avgHoursAdBlueVidange,
          maxHoursAdBlueVidange: maxHoursVidangeAdBlue,
          weeklyChurnRate,
          maxWeeklyChurnRate: targets.target_weekly_churn_limit,
          monthlyChurnRate,
          maxMonthlyChurnRate,
          avgHoursFieldMission: avgHoursVehicleRecovery,
          maxHoursFieldMission,
          bonusEarnedMAD: fleetPerfBonusEarnedMAD,
        },
        fieldOperations: {
          avgHoursVehicleRecovery,
          maxHoursFieldMission,
          monthlyChecksCount,
          monthlyChecksTarget: Math.max(1, Math.round((targets.target_monthly_inspection_rate / 30) * workingDays)),
          attestationOnTimeRate,
          targetAttestationOnTimeRate,
          attestationOnTimeCount,
          attestationTotalPersons,
          ticketResolutionRate,
          targetTicketResolutionRate,
          ticketsResolvedCount,
          ticketsTotalCount,
          tasksTotal,
          tasksCompleted,
          tasksFailed,
          tasksTarget: scaledTasksTarget,
          tasksAttainmentPct: scaledTasksTarget > 0 ? Number(((tasksCompleted / scaledTasksTarget) * 100).toFixed(1)) : 0,
          taskCompletionRate,
          avgHealthScore,
          bonusEarnedMAD: fieldSupervisorBonusEarnedMAD,
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
