"use client";

import React, { useState, useEffect } from 'react';

export default function FleetPerformanceDashboard({ region }: { region: string }) {
  const [objectives, setObjectives] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/objectives?role=FLEET_PERFORMANCE_MGR&region=${region}`)
      .then(r => r.json())
      .then(data => setObjectives(data.objectives || []));
  }, [region]);

  const getTarget = (key: string) => {
    const obj = objectives.find(o => o.metricKey === key);
    return obj ? obj.targetValue : null;
  };

  const cashTarget = getTarget("CASH_MATCH") ?? 60; // Default fallback
  const churnTarget = getTarget("CHURN_BOUNDARY") ?? 5; 

  // Mock Actuals
  const actualCash = 58.4; 
  const actualChurn = 6.2;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">My Targets: Fleet Performance Manager ({region})</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* KPI Card 1 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-600">Daily Cash Match</h3>
            <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">Target: &gt;={cashTarget}%</span>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold">{actualCash}%</span>
            <span className="text-sm text-gray-500 mb-1">Actual</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${actualCash >= cashTarget ? 'bg-green-500' : 'bg-amber-500'}`} 
              style={{ width: `${Math.min((actualCash / cashTarget) * 100, 100)}%` }}
            ></div>
          </div>
          {actualCash < cashTarget && (
            <p className="text-xs text-red-500 mt-2">Needs Improvement</p>
          )}
        </div>

        {/* KPI Card 2 */}
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-600">Monthly Churn</h3>
            <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">Target: &lt;={churnTarget}%</span>
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold">{actualChurn}%</span>
            <span className="text-sm text-gray-500 mb-1">Actual</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 flex justify-end">
            {/* Churn is inverted (lower is better), so we'll just color code */}
            <div 
              className={`h-2.5 rounded-full ${actualChurn <= churnTarget ? 'bg-green-500 w-full' : 'bg-red-500 w-full'}`} 
            ></div>
          </div>
          {actualChurn > churnTarget && (
             <p className="text-xs text-red-500 mt-2">Churn is exceeding maximum boundary.</p>
          )}
        </div>

      </div>
    </div>
  );
}
