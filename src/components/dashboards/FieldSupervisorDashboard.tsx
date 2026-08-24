"use client";

/**
 * FieldSupervisorDashboard
 * 
 * Replaces mock data with real API-driven KPI calculations.
 * KPIs per the Operational Structure:
 *   - Inspection Rate: 90% target (active vehicles inspected monthly)
 *   - GPS Connectivity: 100% target
 *   - Average Downtime: ≤10 Days target
 *   - Recovery Rate: 100% target (VEHICLE_RECOVERY tasks completed)
 */

import React, { useState, useEffect } from 'react';

interface KpiCardProps {
  label: string;
  actual: number;
  target: number;
  unit?: string;
  invertColors?: boolean; // For metrics where lower is better (e.g. downtime)
  isLoading?: boolean;
}

function KpiCard({ label, actual, target, unit = "%", invertColors = false, isLoading = false }: KpiCardProps) {
  const isOnTarget = invertColors ? actual <= target : actual >= target;
  const pct = invertColors
    ? Math.min((target / Math.max(actual, 1)) * 100, 100)
    : Math.min((actual / Math.max(target, 1)) * 100, 100);

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-600 text-sm">{label}</h3>
        <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
          Target: {invertColors ? "≤" : ""}{target}{unit}
        </span>
      </div>
      {isLoading ? (
        <div className="h-10 bg-gray-100 animate-pulse rounded mb-2" />
      ) : (
        <div className="flex items-end gap-2 mb-3">
          <span className={`text-3xl font-bold ${isOnTarget ? 'text-green-600' : 'text-amber-600'}`}>
            {actual}{unit}
          </span>
          <span className="text-sm text-gray-400 mb-1">actual</span>
        </div>
      )}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${isOnTarget ? 'bg-green-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!isLoading && !isOnTarget && (
        <p className="text-xs text-red-500 mt-2">
          {invertColors
            ? `${(actual - target).toFixed(1)}${unit} over target`
            : `${(target - actual).toFixed(1)}${unit} behind target`}
        </p>
      )}
    </div>
  );
}

export default function FieldSupervisorDashboard({ region }: { region: string }) {
  const [objectives, setObjectives] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    inspectionRate: 0,
    gpsConnectivity: 0,
    avgDowntime: 0,
    recoveryRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dynamic weekly objectives (targets)
  useEffect(() => {
    fetch(`/api/objectives?role=FIELD_SUPERVISOR&region=${region}`)
      .then(r => r.json())
      .then(data => setObjectives(data.objectives || []));
  }, [region]);

  // Fetch real KPI actuals from existing APIs
  useEffect(() => {
    async function fetchKpis() {
      setIsLoading(true);
      try {
        const [vehiclesRes, tasksRes, inspRes] = await Promise.all([
          fetch('/api/vehicles'),
          fetch('/api/field-tasks'),
          fetch('/api/inspections'),
        ]);
        const [vehiclesData, tasksData, inspData] = await Promise.all([
          vehiclesRes.json(),
          tasksRes.json(),
          inspRes.json(),
        ]);

        const vehicles: any[] = vehiclesData.vehicles || [];
        const tasks: any[] = tasksData.tasks || [];
        const inspections: any[] = inspData.inspections || [];

        const totalVehicles = vehicles.length;

        // GPS Connectivity: vehicles with isGpsConnected = true
        const gpsConnected = vehicles.filter(v => v.isGpsConnected).length;
        const gpsConnectivity = totalVehicles > 0
          ? Math.round((gpsConnected / totalVehicles) * 100)
          : 0;

        // Inspection Rate: vehicles inspected in last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const inspectedVehicleIds = new Set(
          inspections
            .filter((i: any) => new Date(i.inspectedAt || i.inspection_date) >= thirtyDaysAgo)
            .map((i: any) => i.vehicleId || i.vehicle_id)
        );
        const inspectionRate = totalVehicles > 0
          ? Math.round((inspectedVehicleIds.size / totalVehicles) * 100)
          : 0;

        // Average Downtime: average total_downtime_days across fleet
        const avgDowntime = totalVehicles > 0
          ? Math.round(vehicles.reduce((sum, v) => sum + (v.total_downtime_days || 0), 0) / totalVehicles)
          : 0;

        // Recovery Rate: VEHICLE_RECOVERY tasks completed vs total
        const recoveryTasks = tasks.filter((t: any) => t.task_type === 'VEHICLE_RECOVERY');
        const completedRecoveries = recoveryTasks.filter((t: any) => t.status === 'COMPLETED').length;
        const recoveryRate = recoveryTasks.length > 0
          ? Math.round((completedRecoveries / recoveryTasks.length) * 100)
          : 100; // No recovery tasks = 100% (nothing to recover)

        setKpis({ inspectionRate, gpsConnectivity, avgDowntime, recoveryRate });
      } catch (err) {
        console.error('Failed to fetch Field Supervisor KPIs:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchKpis();
  }, [region]);

  const getTarget = (key: string, fallback: number) => {
    const obj = objectives.find(o => o.metricKey === key);
    return obj ? obj.targetValue : fallback;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">My KPI Targets — Field Supervisor</h2>
        <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium">
          📍 {region}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard
          label="🔍 Inspection Rate"
          actual={kpis.inspectionRate}
          target={getTarget("INSPECTION_RATE", 90)}
          unit="%"
          isLoading={isLoading}
        />
        <KpiCard
          label="📡 GPS Connectivity"
          actual={kpis.gpsConnectivity}
          target={getTarget("GPS_CONNECTIVITY", 100)}
          unit="%"
          isLoading={isLoading}
        />
        <KpiCard
          label="⏱️ Avg Vehicle Downtime"
          actual={kpis.avgDowntime}
          target={getTarget("AVG_DOWNTIME", 10)}
          unit=" days"
          invertColors={true}
          isLoading={isLoading}
        />
        <KpiCard
          label="🚗 Asset Recovery Rate"
          actual={kpis.recoveryRate}
          target={getTarget("RECOVERY_RATE", 100)}
          unit="%"
          isLoading={isLoading}
        />
      </div>

      {/* Lifecycle stage reminder */}
      <div className="bg-navy/5 border border-navy/10 rounded-xl p-4 text-xs text-navy/80">
        <p className="font-semibold mb-1">📋 Field Ops Responsibilities</p>
        <ul className="space-y-0.5 list-disc list-inside text-navy/70">
          <li>Monthly physical inspections of assigned vehicles</li>
          <li>Blocked vehicle recovery within 48h escalation window</li>
          <li>Field intervention on maintenance handoffs from Driver Support</li>
          <li>GPS & telematics connectivity verification</li>
        </ul>
      </div>
    </div>
  );
}
