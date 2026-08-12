"use client";

import React, { useState } from 'react';
import FieldSupervisorDashboard from '@/components/dashboards/FieldSupervisorDashboard';
import FleetPerformanceDashboard from '@/components/dashboards/FleetPerformanceDashboard';

const ROLES = [
  { id: "FIELD_SUPERVISOR", label: "Field Supervisor" },
  { id: "FLEET_PERFORMANCE_MGR", label: "Fleet Performance Manager" },
  { id: "BRAND_MANAGER", label: "Brand Manager (Coming Soon)" },
];

const REGIONS = [
  { id: "CASABLANCA_HUB", label: "Casablanca Hub" },
  { id: "MARRAKECH_HUB", label: "Marrakech Hub" },
  { id: "ALL", label: "National (All)" }
];

export default function MyDashboardPage() {
  const [activeRole, setActiveRole] = useState("FIELD_SUPERVISOR");
  const [activeRegion, setActiveRegion] = useState("CASABLANCA_HUB");

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      
      {/* MOCK AUTH / ROLE SWITCHER */}
      <div className="mb-8 p-4 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider mr-2">Demo Simulator</span>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Simulate Role:</label>
          <select 
            value={activeRole} 
            onChange={e => setActiveRole(e.target.value)}
            className="border-gray-300 rounded text-sm p-1"
          >
            {ROLES.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Simulate Region:</label>
          <select 
            value={activeRegion} 
            onChange={e => setActiveRegion(e.target.value)}
            className="border-gray-300 rounded text-sm p-1"
          >
            {REGIONS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#2C4E8C] tracking-tight">My Action Dashboard</h1>
        <p className="text-gray-500 mt-2">Track your weekly performance against Director objectives.</p>
      </header>

      <div className="mt-6">
        {activeRole === "FIELD_SUPERVISOR" && (
          <FieldSupervisorDashboard region={activeRegion} />
        )}
        {activeRole === "FLEET_PERFORMANCE_MGR" && (
          <FleetPerformanceDashboard region={activeRegion} />
        )}
        {activeRole === "BRAND_MANAGER" && (
          <div className="p-8 bg-white text-center rounded-lg border text-gray-500">
            Brand Manager Dashboard module is currently under construction.
          </div>
        )}
      </div>

    </div>
  );
}
