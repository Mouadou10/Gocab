"use client";

import React, { useState, useEffect } from 'react';

const ROLE_MAPPING: Record<string, string> = {
  "brand-manager": "BRAND_MANAGER",
  "lead-acquisition": "LEAD_ACQUISITION_JR",
  "driver-support": "DRIVER_SUPPORT",
  "fleet-performance": "FLEET_PERFORMANCE_MGR",
  "onboarding-specialist": "ONBOARDING_SPECIALIST",
  "field-supervisor": "FIELD_SUPERVISOR",
  "senior-field-supervisor": "SENIOR_FIELD_SUPERVISOR"
};

const METRICS: Record<string, { id: string, label: string, isInverse?: boolean, unit?: string }[]> = {
  BRAND_MANAGER: [
    { id: "LEAD_CONVERSION", label: "Lead-to-Training Target", unit: "%" },
  ],
  LEAD_ACQUISITION_JR: [
    { id: "WEEKLY_CALLS", label: "Total Calls per Week", unit: " calls" },
    { id: "WEEKLY_PREORDERS", label: "Total Preorders per Week", unit: " leads" },
  ],
  DRIVER_SUPPORT: [
    { id: "SLA_RESPONSE", label: "SLA Response Rate", unit: "%" },
  ],
  FLEET_PERFORMANCE_MGR: [
    { id: "CASH_MATCH", label: "Daily Cash Match", unit: "%" },
    { id: "CHURN_BOUNDARY", label: "Monthly Churn Boundary", isInverse: true, unit: "%" },
  ],
  ONBOARDING_SPECIALIST: [
    { id: "TRAINING_SIGNATURE", label: "Training-to-Signature", unit: "%" },
    { id: "KYC_ACCURACY", label: "KYC Accuracy", unit: "%" },
  ],
  FIELD_SUPERVISOR: [
    { id: "INSPECTION_RATE", label: "Physical Inspection Rate", unit: "%" },
    { id: "GPS_CONNECTIVITY", label: "GPS Connectivity Rate", unit: "%" },
  ],
  SENIOR_FIELD_SUPERVISOR: [
    { id: "ASSET_RECOVERY", label: "Asset Recovery Success", unit: "%" },
    { id: "IMPOUND_TURNAROUND", label: "Impound Turnaround Time", unit: "%" },
  ]
};

const DEFAULT_TARGETS: Record<string, number> = {
  LEAD_CONVERSION: 60,
  WEEKLY_CALLS: 200,
  WEEKLY_PREORDERS: 20,
  SLA_RESPONSE: 95,
  CASH_MATCH: 60,
  CHURN_BOUNDARY: 5,
  TRAINING_SIGNATURE: 80,
  KYC_ACCURACY: 100,
  INSPECTION_RATE: 90,
  GPS_CONNECTIVITY: 100,
  ASSET_RECOVERY: 100,
  IMPOUND_TURNAROUND: 100
};

const MOCK_ACTUALS: Record<string, number> = {
  LEAD_CONVERSION: 58,
  WEEKLY_CALLS: 185,
  WEEKLY_PREORDERS: 14,
  SLA_RESPONSE: 96,
  CASH_MATCH: 55,
  CHURN_BOUNDARY: 4.2,
  TRAINING_SIGNATURE: 78,
  KYC_ACCURACY: 98,
  INSPECTION_RATE: 85,
  GPS_CONNECTIVITY: 100,
  ASSET_RECOVERY: 100,
  IMPOUND_TURNAROUND: 95
};

const REGIONS = [
  { id: "ALL", label: "National (All Regions)" },
  { id: "CASABLANCA_HQ", label: "Casablanca HQ" },
  { id: "CASABLANCA_HUB", label: "Casablanca Hub" },
  { id: "MARRAKECH_HUB", label: "Marrakech Hub" },
  { id: "TANGIER_HUB", label: "Tangier Hub" },
  { id: "AGADIR_HUB", label: "Agadir Hub" }
];

export default function DepartmentDashboardPage({ params }: { params: { roleId: string } }) {
  const dbRole = ROLE_MAPPING[params.roleId] || "BRAND_MANAGER";
  const metrics = METRICS[dbRole] || [];

  const [objectives, setObjectives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [region, setRegion] = useState("ALL");
  const [metricKey, setMetricKey] = useState(metrics[0]?.id || "");
  const [targetValue, setTargetValue] = useState("");
  
  // Dashboard view state
  const [viewRegion, setViewRegion] = useState("ALL");

  const fetchObjectives = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/objectives?role=${dbRole}`);
      const data = await res.json();
      if (data.success) {
        setObjectives(data.objectives);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjectives();
    if (metrics.length > 0) setMetricKey(metrics[0].id);
  }, [dbRole]);

  const handleSubmitTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetValue || !metricKey) return;

    try {
      const res = await fetch('/api/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: dbRole,
          region: region === "ALL" ? null : region,
          metricKey,
          targetValue: parseFloat(targetValue)
        })
      });
      if (res.ok) {
        setTargetValue("");
        fetchObjectives();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getTarget = (key: string) => {
    // Exact match for region, else fallback to ALL, else DEFAULT
    let target = objectives.find(o => o.metricKey === key && o.region === (viewRegion === "ALL" ? null : viewRegion))?.targetValue;
    if (target === undefined && viewRegion !== "ALL") {
      target = objectives.find(o => o.metricKey === key && !o.region)?.targetValue;
    }
    if (target === undefined) {
      target = DEFAULT_TARGETS[key] || 100;
    }
    return target;
  };

  const renderKpiBar = (metric: typeof metrics[0]) => {
    const target = getTarget(metric.id);
    const actual = MOCK_ACTUALS[metric.id] || 0;
    const isPassing = metric.isInverse ? (actual <= target) : (actual >= target);
    
    let percentage = 0;
    if (metric.isInverse) {
      percentage = Math.min((actual / (target * 2)) * 100, 100); 
    } else {
      percentage = Math.min((actual / target) * 100, 100);
    }

    return (
      <div key={metric.id} className="bg-white p-6 rounded-lg border shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-700">{metric.label}</h3>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 border border-gray-200">
            Target: {metric.isInverse ? '<=' : '>='}{target}{metric.unit}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${isPassing ? 'bg-green-500' : (metric.isInverse ? 'bg-red-500' : 'bg-amber-500')}`} 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <span className={`text-xl font-bold min-w-[70px] text-right ${isPassing ? 'text-green-600' : (metric.isInverse ? 'text-red-600' : 'text-amber-600')}`}>
            {actual}{metric.unit}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#2C4E8C] capitalize">
            {params.roleId.replace(/-/g, ' ')} Dashboard
          </h1>
          <p className="text-gray-500 mt-2">Manage objectives and track KPI performance.</p>
        </div>
      </header>

      {/* SET OBJECTIVES SECTION */}
      <section className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
        <h2 className="text-lg font-bold text-blue-900 mb-4">Set Weekly Objective</h2>
        <form onSubmit={handleSubmitTarget} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <select 
              value={region} 
              onChange={e => setRegion(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            >
              {REGIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KPI Metric</label>
            <select 
              value={metricKey} 
              onChange={e => setMetricKey(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            >
              {metrics.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
            <input 
              type="number" 
              step="0.1"
              required
              value={targetValue}
              onChange={e => setTargetValue(e.target.value)}
              placeholder="e.g. 90"
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-[#2C4E8C] text-white rounded-md p-2 text-sm font-semibold hover:bg-blue-800 transition-colors"
          >
            Update Target
          </button>
        </form>
      </section>

      {/* KPI TRACKING SECTION */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Current Performance</h2>
          <select 
            value={viewRegion} 
            onChange={(e) => setViewRegion(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm text-sm p-1.5 focus:ring-[#2C4E8C] focus:border-[#2C4E8C]"
          >
            {REGIONS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center p-8 text-gray-400 animate-pulse">Loading tracking data...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {metrics.map(m => renderKpiBar(m))}
          </div>
        )}
      </section>
      
    </div>
  );
}
