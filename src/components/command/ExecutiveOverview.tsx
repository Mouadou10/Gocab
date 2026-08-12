import React from 'react';

type ExecutiveOverviewProps = {
  totalVehicles: number;
  activeVehicles: number;
  utilizationRate: number;
  cashMatch: number;
  volumeFeed: number;
  churnRate: number;
  averageDowntime: number;
};

export default function ExecutiveOverview({
  totalVehicles,
  activeVehicles,
  utilizationRate,
  cashMatch,
  volumeFeed,
  churnRate,
  averageDowntime
}: ExecutiveOverviewProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-[#2C4E8C] mb-4">Module 1: Executive Level 1 Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Fleet Size & Utilization Rate */}
        <div className="p-4 rounded-md border border-gray-100 bg-gray-50 flex flex-col">
          <span className="text-sm text-gray-500 font-medium">Active Fleet & Utilization</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{activeVehicles}</span>
            <span className="text-sm text-gray-500">/ {totalVehicles} Vehicles</span>
          </div>
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${utilizationRate}%` }}
            ></div>
          </div>
          <span className="mt-1 text-xs text-gray-500 text-right">{utilizationRate.toFixed(1)}%</span>
        </div>

        {/* National Cash Reconciliation Feed */}
        <div className="p-4 rounded-md border border-gray-100 bg-gray-50 flex flex-col">
          <span className="text-sm text-gray-500 font-medium">National Cash Reconciliation</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${cashMatch >= 60 ? 'text-[#5B6C28]' : 'text-red-600'}`}>
              {cashMatch}%
            </span>
          </div>
          <span className="mt-1 text-xs text-gray-500">Target: ≥ 60%</span>
        </div>

        {/* Global Churn & Downtime Counters */}
        <div className="p-4 rounded-md border border-gray-100 bg-gray-50 flex flex-col justify-between">
          <div>
            <span className="text-sm text-gray-500 font-medium">Monthly Churn</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${churnRate <= 5 ? 'text-[#5B6C28]' : 'text-red-600'}`}>
                {churnRate}%
              </span>
            </div>
            <span className="text-xs text-gray-500">Target: &lt; 5%</span>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500 font-medium">Avg Downtime</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${averageDowntime <= 10 ? 'text-[#5B6C28]' : 'text-red-600'}`}>
                {averageDowntime} days
              </span>
            </div>
            <span className="text-xs text-gray-500">Target: ≤ 10 days</span>
          </div>
        </div>

        {/* National Platform Volume Feed */}
        <div className="p-4 rounded-md border border-gray-100 bg-gray-50 flex flex-col">
          <span className="text-sm text-gray-500 font-medium">National Platform Volume</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{volumeFeed.toLocaleString()}</span>
          </div>
          <span className="mt-1 text-xs text-gray-500">Total completed trips (inDrive)</span>
        </div>
      </div>
    </div>
  );
}
