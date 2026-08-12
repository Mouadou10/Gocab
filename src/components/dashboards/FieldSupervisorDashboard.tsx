"use client";

import React, { useState, useEffect } from 'react';

export default function FieldSupervisorDashboard({ region }: { region: string }) {
  const [objectives, setObjectives] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/objectives?role=FIELD_SUPERVISOR&region=${region}`)
      .then(r => r.json())
      .then(data => setObjectives(data.objectives || []));
  }, [region]);

  const getTarget = (key: string) => {
    const obj = objectives.find(o => o.metricKey === key);
    return obj ? obj.targetValue : null;
  };

  const inspTarget = getTarget("INSPECTION_RATE") ?? 90; // Default fallback
  const gpsTarget = getTarget("GPS_CONNECTIVITY") ?? 100;

  // Mock Actuals
  const actualInsp = 82.5; 
  const actualGps = 98.2;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">My Targets: Field Supervisor ({region})</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* KPI Card 1 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-600">Inspection Rate</h3>
            <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">Target: {inspTarget}%</span>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold">{actualInsp}%</span>
            <span className="text-sm text-gray-500 mb-1">Actual</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${actualInsp >= inspTarget ? 'bg-green-500' : 'bg-amber-500'}`} 
              style={{ width: `${Math.min((actualInsp / inspTarget) * 100, 100)}%` }}
            ></div>
          </div>
          {actualInsp < inspTarget && (
            <p className="text-xs text-red-500 mt-2">You are {Math.abs(actualInsp - inspTarget).toFixed(1)}% behind target.</p>
          )}
        </div>

        {/* KPI Card 2 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-600">GPS Connectivity</h3>
            <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">Target: {gpsTarget}%</span>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold">{actualGps}%</span>
            <span className="text-sm text-gray-500 mb-1">Actual</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${actualGps >= gpsTarget ? 'bg-green-500' : 'bg-amber-500'}`} 
              style={{ width: `${Math.min((actualGps / gpsTarget) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

      </div>
    </div>
  );
}
