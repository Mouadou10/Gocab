/**
 * Executive Financial Report API — GET /api/reports/financial
 *
 * Calculates per-vehicle and fleet-wide financial metrics:
 * - Direct Expenses from VehicleExpense (repairs, police, maintenance, towing, etc.)
 * - Inactivity Opportunity Loss (250 MAD / day for every day a vehicle stays Available / Inactive / In Garage / Impounded)
 * - Total Cost Impact (Direct Expenses + Opportunity Cost)
 * - Driver Arrears / Debt tracking
 * - Department Performance Targets vs Actuals for every agent role
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DAILY_OPPORTUNITY_COST_MAD = 250; // 250 MAD / day lost revenue per inactive vehicle

export async function GET() {
  try {
    const [vehicles, expenses, drivers, leads, tickets, inspections, tasks, settingsRecord] = await Promise.all([
      prisma.vehicle.findMany({
        include: {
          driverProfile: true,
          expenses: true,
        },
      }),
      prisma.vehicleExpense.findMany({
        orderBy: { paid_at: "desc" },
      }),
      prisma.driverProfile.findMany(),
      prisma.lead.findMany(),
      prisma.maintenanceTicket.findMany(),
      prisma.fieldInspectionNew.findMany(),
      prisma.fieldTask.findMany(),
      prisma.setting.findUnique({ where: { key: "department_weekly_targets" } }),
    ]);

    // Parse custom department targets
    let customTargets: any = {};
    if (settingsRecord?.value) {
      try {
        customTargets = JSON.parse(settingsRecord.value);
      } catch (e) {}
    }

    const totalFleet = vehicles.length;
    const activeVehicles = vehicles.filter((v) => v.status === "Actif");
    const availableVehicles = vehicles.filter((v) => v.status === "Available" || v.status === "Disponible");
    const inRepairVehicles = vehicles.filter((v) => v.status === "In garage" || v.status === "In service");
    const impoundedVehicles = vehicles.filter((v) => v.status === "impounded by police" || v.status === "Accident" || v.status === "Blocked");

    const totalActiveCount = activeVehicles.length;
    const totalInactiveCount = totalFleet - totalActiveCount;
    const fleetUtilizationRate = totalFleet > 0 ? Math.round((totalActiveCount / totalFleet) * 100) : 0;

    // Direct Expenses Aggregation
    const totalDirectExpensesMAD = expenses.reduce((sum, e) => sum + (e.amount_mad || 0), 0);
    const expensesByCategory: Record<string, number> = {};
    for (const exp of expenses) {
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + (exp.amount_mad || 0);
    }

    // Driver Arrears Aggregation
    const totalDriverArrearsMAD = drivers.reduce((sum, d) => sum + (d.currentArrearsMAD || 0), 0);

    // Calculate Per-Vehicle Financials
    let totalOpportunityLossMAD = 0;

    const vehiclesFinancial = vehicles.map((v) => {
      // Inactive days calculation
      let inactiveDays = v.total_downtime_days || 0;
      if (v.status !== "Actif" && inactiveDays === 0) {
        // If currently inactive and downtime days is 0, estimate days since creation or minimum 1 day
        const createdDate = new Date(v.created_at);
        const daysDiff = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
        inactiveDays = Math.min(daysDiff, 30); // Cap at reasonable default for display
      }

      // Opportunity cost: 250 MAD per inactive day
      const opportunityLossMAD = inactiveDays * DAILY_OPPORTUNITY_COST_MAD;
      totalOpportunityLossMAD += opportunityLossMAD;

      // Direct expenses for this specific car
      const directExpensesMAD = v.expenses.reduce((sum, e) => sum + (e.amount_mad || 0), 0);
      const totalCostMAD = directExpensesMAD + opportunityLossMAD;

      return {
        id: v.id,
        plate_number: v.plate_number,
        make_model: v.make_model,
        year: v.year,
        hub_city: v.hub_city,
        status: v.status,
        driver_name: v.driverProfile?.fullName || v.assigned_driver_name || null,
        driver_phone: v.driverProfile?.phoneSanitized || v.assigned_driver_phone || null,
        driver_arrears_mad: v.driverProfile?.currentArrearsMAD || 0,
        inactive_days: inactiveDays,
        opportunity_loss_mad: opportunityLossMAD,
        direct_expenses_mad: directExpensesMAD,
        total_cost_mad: totalCostMAD,
        expense_count: v.expenses.length,
        current_mileage: v.current_mileage,
      };
    });

    // Daily ongoing burn rate (250 MAD × current inactive vehicles)
    const dailyOpportunityLossBurnRate = totalInactiveCount * DAILY_OPPORTUNITY_COST_MAD;
    const totalFleetFinancialImpactMAD = totalDirectExpensesMAD + totalOpportunityLossMAD;

    // --- AGENT TARGETS & ACCOUNTABILITY MATRIX ---
    // 1. Lead Acquisition Jr
    const totalLeads = leads.length;
    const assignedLeads = leads.filter((l) => l.board_column === "VEHICLE_ASSIGNMENT").length;
    const kycCompletedLeads = leads.filter(
      (l) => l.has_cin && l.has_fiche_anthropometrique && l.has_confirmation_adresse && l.has_permis
    ).length;
    const kycRate = totalLeads > 0 ? Math.round((kycCompletedLeads / totalLeads) * 100) : 0;
    const conversionRate = totalLeads > 0 ? Math.round((assignedLeads / totalLeads) * 100) : 0;

    // 2. Support & Maintenance
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter((t) => t.status === "RESOLVED").length;
    const openTickets = tickets.filter((t) => t.status !== "RESOLVED").length;
    const slaResolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100;

    // 3. Field Supervisor
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const inspectedVehicleIds = new Set(
      inspections.filter((i) => new Date(i.inspectedAt) >= thirtyDaysAgo).map((i) => i.vehicleId)
    );
    const inspectionRate = totalFleet > 0 ? Math.round((inspectedVehicleIds.size / totalFleet) * 100) : 0;
    const gpsConnectedCount = vehicles.filter((v) => v.isGpsConnected).length;
    const gpsRate = totalFleet > 0 ? Math.round((gpsConnectedCount / totalFleet) * 100) : 0;

    const agentTargets = {
      leadAcquisition: {
        role: "LEAD_ACQUISITION_JR",
        title: "Acquisition & Intégration Chauffeurs",
        agentName: "Équipe Acquisition",
        kpis: [
          {
            name: "Volume Total Prospects",
            actual: totalLeads,
            target: Number(customTargets.target_weekly_leads ?? 100),
            unit: "prospects",
            isPercentage: false,
            status: totalLeads >= Number(customTargets.target_weekly_leads ?? 100) ? "ON_TARGET" : "AT_RISK",
          },
          {
            name: "Taux de Dossiers KYC Conformes",
            actual: kycRate,
            target: Number(customTargets.target_kyc_completion_rate ?? 25),
            unit: "%",
            isPercentage: true,
            status: kycRate >= Number(customTargets.target_kyc_completion_rate ?? 25) ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Taux de Conversion Véhicule",
            actual: conversionRate,
            target: Number(customTargets.target_lead_conversion_rate ?? 20),
            unit: "%",
            isPercentage: true,
            status: conversionRate >= Number(customTargets.target_lead_conversion_rate ?? 20) ? "ON_TARGET" : "AT_RISK",
          },
        ],
      },
      fleetPerformance: {
        role: "FLEET_PERF_MANAGER",
        title: "Performance Flotte & Utilisation",
        agentName: "Fleet Performance Manager",
        kpis: [
          {
            name: "Taux d'Utilisation Flotte Active",
            actual: fleetUtilizationRate,
            target: Number(customTargets.target_active_fleet_rate ?? 85),
            unit: "%",
            isPercentage: true,
            status: fleetUtilizationRate >= Number(customTargets.target_active_fleet_rate ?? 85) ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Véhicules Inactifs (Perte 250 DH/j)",
            actual: totalInactiveCount,
            target: Math.max(1, Math.floor(totalFleet * 0.15)), // max 15% inactive
            unit: "véhicules",
            isPercentage: false,
            status: totalInactiveCount <= Math.max(1, Math.floor(totalFleet * 0.15)) ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Perte d'Opportunité Journalière",
            actual: dailyOpportunityLossBurnRate,
            target: 1000,
            unit: "MAD / jour",
            isPercentage: false,
            status: dailyOpportunityLossBurnRate <= 1000 ? "ON_TARGET" : "BREACHED",
          },
        ],
      },
      fieldSupervisor: {
        role: "FIELD_SUPERVISOR",
        title: "Opérations Terrain & Inspections",
        agentName: "Superviseur Terrain",
        kpis: [
          {
            name: "Taux d'Inspections Mensuelles (VCR)",
            actual: inspectionRate,
            target: Number(customTargets.target_monthly_inspection_rate ?? 90),
            unit: "%",
            isPercentage: true,
            status: inspectionRate >= Number(customTargets.target_monthly_inspection_rate ?? 90) ? "ON_TARGET" : "AT_RISK",
          },
          {
            name: "Télématique & GPS Actifs",
            actual: gpsRate,
            target: Number(customTargets.target_gps_connectivity_rate ?? 100),
            unit: "%",
            isPercentage: true,
            status: gpsRate >= Number(customTargets.target_gps_connectivity_rate ?? 100) ? "ON_TARGET" : "AT_RISK",
          },
        ],
      },
      supportMaintenance: {
        role: "SUPPORT_SPECIALIST",
        title: "Maintenance & SLA 24h",
        agentName: "Support & Garage",
        kpis: [
          {
            name: "Taux de Résolution SLA 24h",
            actual: slaResolutionRate,
            target: Number(customTargets.target_sla_resolution_rate ?? 95),
            unit: "%",
            isPercentage: true,
            status: slaResolutionRate >= Number(customTargets.target_sla_resolution_rate ?? 95) ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Tickets Ouverts / En Attente",
            actual: openTickets,
            target: Number(customTargets.target_max_open_tickets ?? 5),
            unit: "tickets",
            isPercentage: false,
            status: openTickets <= Number(customTargets.target_max_open_tickets ?? 5) ? "ON_TARGET" : "BREACHED",
          },
        ],
      },
      financeCollections: {
        role: "FINANCE_OFFICER",
        title: "Finance & Recouvrement",
        agentName: "Responsable Recouvrement",
        kpis: [
          {
            name: "Encours Total Impayés Chauffeurs",
            actual: totalDriverArrearsMAD,
            target: 15000,
            unit: "MAD",
            isPercentage: false,
            status: totalDriverArrearsMAD <= 15000 ? "ON_TARGET" : "BREACHED",
          },
          {
            name: "Dépenses Directes Garage / Police",
            actual: totalDirectExpensesMAD,
            target: 20000,
            unit: "MAD",
            isPercentage: false,
            status: totalDirectExpensesMAD <= 20000 ? "ON_TARGET" : "AT_RISK",
          },
        ],
      },
    };

    return NextResponse.json({
      summary: {
        total_fleet: totalFleet,
        active_vehicles: totalActiveCount,
        available_vehicles: availableVehicles.length,
        in_repair_vehicles: inRepairVehicles.length,
        impounded_vehicles: impoundedVehicles.length,
        inactive_vehicles: totalInactiveCount,
        utilization_rate: fleetUtilizationRate,
        daily_opportunity_cost_per_vehicle: DAILY_OPPORTUNITY_COST_MAD,
        daily_opportunity_loss_burn_rate: dailyOpportunityLossBurnRate,
        total_opportunity_loss_mad: totalOpportunityLossMAD,
        total_direct_expenses_mad: totalDirectExpensesMAD,
        total_driver_arrears_mad: totalDriverArrearsMAD,
        total_fleet_financial_impact_mad: totalFleetFinancialImpactMAD,
        expenses_by_category: expensesByCategory,
      },
      agentTargets,
      vehicles: vehiclesFinancial,
    });
  } catch (error: any) {
    console.error("GET /api/reports/financial error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate financial report" },
      { status: 500 }
    );
  }
}
