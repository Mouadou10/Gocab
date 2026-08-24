/**
 * Weekly KPI Report & Alerts Aggregation API — GET /api/reports/weekly
 * Computes live metrics across the 3 operational pillars, target vs actual variances,
 * and automated escalation alerts for the Operations Manager.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // 1. Fetch data in parallel
    const [leads, vehicles, tickets, inspections, accidents, churnEvents, tasks] = await Promise.all([
      prisma.lead.findMany(),
      prisma.vehicle.findMany(),
      prisma.maintenanceTicket.findMany(),
      prisma.fieldInspectionNew.findMany(),
      prisma.accidentClaim.findMany(),
      prisma.churnEvent.findMany(),
      prisma.fieldTask.findMany(),
    ]);

    const totalFleet = vehicles.length;
    const activeVehicles = vehicles.filter((v) => v.status === "Actif").length;
    const activeFleetRate = totalFleet > 0 ? Math.round((activeVehicles / totalFleet) * 100) : 0;

    // --- PILLAR 1: LEAD ACQUISITION & KYC ---
    const totalLeads = leads.length;
    const newLeadsThisWeek = leads.filter((l) => new Date(l.created_at) >= startOfWeek).length;
    const inTraining = leads.filter(
      (l) => l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT"
    ).length;
    const assignedVehicles = leads.filter((l) => l.board_column === "VEHICLE_ASSIGNMENT").length;
    const kycCompletedLeads = leads.filter(
      (l) => l.has_cin && l.has_fiche_anthropometrique && l.has_confirmation_adresse && l.has_permis
    ).length;
    const leadConversionRate = totalLeads > 0 ? Math.round((assignedVehicles / totalLeads) * 100) : 0;

    // --- PILLAR 2: DRIVER ENGAGEMENT & FLEET PERF ---
    const totalDowntimeDays = vehicles.reduce((sum, v) => sum + (v.total_downtime_days || 0), 0);
    const avgDowntimePerVehicle = totalFleet > 0 ? Number((totalDowntimeDays / totalFleet).toFixed(1)) : 0;
    const waivedTickets = tickets.filter((t) => t.payment_waived);
    const totalWaivedDays = waivedTickets.reduce((sum, t) => sum + (t.waived_days || 0), 0);
    const recentChurnCount = churnEvents.filter((c) => new Date(c.churned_at) >= startOfWeek).length;

    // --- PILLAR 3: SAFETY, FLEET & COMPLIANCE ---
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter((t) => t.status === "RESOLVED").length;
    const openTickets = tickets.filter((t) => t.status !== "RESOLVED");
    
    // SLA breaches
    const slaBreachedTickets = openTickets.filter(
      (t) => t.sla_deadline && new Date(t.sla_deadline).getTime() < now.getTime()
    ).length;
    const slaResolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100;

    // GPS Connectivity
    const gpsConnectedCount = vehicles.filter((v) => v.isGpsConnected).length;
    const gpsConnectivityRate = totalFleet > 0 ? Math.round((gpsConnectedCount / totalFleet) * 100) : 0;

    // Monthly Inspection Rate (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const inspectedVehicleIds = new Set(
      inspections
        .filter((i) => new Date(i.inspectedAt) >= thirtyDaysAgo)
        .map((i) => i.vehicleId)
    );
    const inspectionRate = totalFleet > 0 ? Math.round((inspectedVehicleIds.size / totalFleet) * 100) : 0;

    // Active Accident Claims
    const openAccidentClaims = accidents.filter((a) => a.timeline_step !== "VEHICLE_BACK").length;

    // Recovery tasks
    const recoveryTasks = tasks.filter((t) => t.task_type === "VEHICLE_RECOVERY");
    const completedRecoveries = recoveryTasks.filter((t) => t.status === "COMPLETED").length;
    const recoveryRate = recoveryTasks.length > 0 ? Math.round((completedRecoveries / recoveryTasks.length) * 100) : 100;

    // Fetch custom department targets if set by Ops Manager
    const customTargetsSetting = await prisma.setting.findUnique({
      where: { key: "department_weekly_targets" },
    });

    let customTargets: any = {};
    if (customTargetsSetting?.value) {
      try {
        customTargets = JSON.parse(customTargetsSetting.value);
      } catch (e) {}
    }

    // --- TARGET VS ACTUAL ALERTS & VARIANCES ---
    const TARGETS = {
      SLA_RESOLUTION: Number(customTargets.target_sla_resolution_rate ?? 95),
      INSPECTION_RATE: Number(customTargets.target_monthly_inspection_rate ?? 90),
      GPS_CONNECTIVITY: Number(customTargets.target_gps_connectivity_rate ?? 100),
      ACTIVE_FLEET_RATE: Number(customTargets.target_active_fleet_rate ?? 85),
      AVG_DOWNTIME_DAYS: Number(customTargets.target_max_downtime_days ?? 10),
      ASSET_RECOVERY_RATE: Number(customTargets.target_asset_recovery_rate ?? 100),
      WEEKLY_LEADS: Number(customTargets.target_weekly_leads ?? 100),
      CHURN_LIMIT: Number(customTargets.target_weekly_churn_limit ?? 2),
      COLLECTION_RATE: Number(customTargets.target_collection_rate ?? 90),
    };

    const alerts: {
      id: string;
      pillar: string;
      metric: string;
      actual: number;
      target: number;
      unit: string;
      variance: number;
      severity: "CRITICAL" | "WARNING" | "INFO";
      message: string;
    }[] = [];

    // SLA Alert
    if (slaResolutionRate < TARGETS.SLA_RESOLUTION) {
      alerts.push({
        id: "sla_breach",
        pillar: "Pillar 3: Safety & Maintenance",
        metric: "24h SLA Resolution Rate",
        actual: slaResolutionRate,
        target: TARGETS.SLA_RESOLUTION,
        unit: "%",
        variance: TARGETS.SLA_RESOLUTION - slaResolutionRate,
        severity: slaResolutionRate < 85 ? "CRITICAL" : "WARNING",
        message: `Driver Support SLA is at ${slaResolutionRate}% (${TARGETS.SLA_RESOLUTION - slaResolutionRate}% below the 95% target). ${slaBreachedTickets} open tickets are overdue.`,
      });
    }

    // GPS Connectivity Alert
    if (gpsConnectivityRate < TARGETS.GPS_CONNECTIVITY) {
      const disconnected = totalFleet - gpsConnectedCount;
      alerts.push({
        id: "gps_loss",
        pillar: "Pillar 3: Safety & Telematics",
        metric: "GPS Connectivity",
        actual: gpsConnectivityRate,
        target: TARGETS.GPS_CONNECTIVITY,
        unit: "%",
        variance: TARGETS.GPS_CONNECTIVITY - gpsConnectivityRate,
        severity: disconnected > 3 ? "CRITICAL" : "WARNING",
        message: `${disconnected} vehicle(s) currently have disconnected or malfunctioning GPS telematics.`,
      });
    }

    // Inspection Rate Alert
    if (inspectionRate < TARGETS.INSPECTION_RATE) {
      alerts.push({
        id: "inspection_lag",
        pillar: "Pillar 3: Field Operations",
        metric: "Monthly Physical Inspection Rate",
        actual: inspectionRate,
        target: TARGETS.INSPECTION_RATE,
        unit: "%",
        variance: TARGETS.INSPECTION_RATE - inspectionRate,
        severity: inspectionRate < 70 ? "CRITICAL" : "WARNING",
        message: `Field physical checkup rate is at ${inspectionRate}% (Target: 90%). Field Supervisors need to inspect ${Math.ceil(totalFleet * 0.9) - inspectedVehicleIds.size} more vehicles this month.`,
      });
    }

    // Downtime Alert
    if (avgDowntimePerVehicle > TARGETS.AVG_DOWNTIME_DAYS) {
      alerts.push({
        id: "high_downtime",
        pillar: "Pillar 2: Fleet Performance",
        metric: "Average Vehicle Downtime",
        actual: avgDowntimePerVehicle,
        target: TARGETS.AVG_DOWNTIME_DAYS,
        unit: " days",
        variance: Number((avgDowntimePerVehicle - TARGETS.AVG_DOWNTIME_DAYS).toFixed(1)),
        severity: avgDowntimePerVehicle > 15 ? "CRITICAL" : "WARNING",
        message: `Average fleet downtime is ${avgDowntimePerVehicle} days (exceeds maximum threshold of 10 days).`,
      });
    }

    // Active Fleet Alert
    if (activeFleetRate < TARGETS.ACTIVE_FLEET_RATE) {
      alerts.push({
        id: "fleet_utilization",
        pillar: "Pillar 2: Fleet Performance",
        metric: "Active Fleet Utilization",
        actual: activeFleetRate,
        target: TARGETS.ACTIVE_FLEET_RATE,
        unit: "%",
        variance: TARGETS.ACTIVE_FLEET_RATE - activeFleetRate,
        severity: activeFleetRate < 70 ? "CRITICAL" : "WARNING",
        message: `Active fleet rate is ${activeFleetRate}% (${activeVehicles}/${totalFleet} cars). ${totalFleet - activeVehicles} vehicles are inactive or in repair.`,
      });
    }

    return NextResponse.json({
      reportDate: now.toISOString(),
      summary: {
        totalFleet,
        activeVehicles,
        activeFleetRate,
        totalLeads,
        newLeadsThisWeek,
        leadConversionRate,
        slaResolutionRate,
        inspectionRate,
        gpsConnectivityRate,
        avgDowntimePerVehicle,
        recentChurnCount,
        openAccidentClaims,
      },
      pillar1: {
        totalLeads,
        newLeadsThisWeek,
        inTraining,
        kycCompletedLeads,
        assignedVehicles,
        leadConversionRate,
      },
      pillar2: {
        activeVehicles,
        totalFleet,
        activeFleetRate,
        totalDowntimeDays,
        avgDowntimePerVehicle,
        waivedTicketsCount: waivedTickets.length,
        totalWaivedDays,
        recentChurnCount,
      },
      pillar3: {
        totalTickets,
        resolvedTickets,
        openTickets: openTickets.length,
        slaBreachedTickets,
        slaResolutionRate,
        gpsConnectedCount,
        gpsConnectivityRate,
        inspectedVehiclesCount: inspectedVehicleIds.size,
        inspectionRate,
        openAccidentClaims,
        recoveryRate,
      },
      targets: TARGETS,
      alerts,
    });
  } catch (error) {
    console.error("GET /api/reports/weekly error:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly report" },
      { status: 500 }
    );
  }
}
