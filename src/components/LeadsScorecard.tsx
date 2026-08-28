"use client";

import React, { useState, useEffect } from 'react';

export default function LeadsScorecard({ leads }: { leads: any[] }) {
  const [dateFilter, setDateFilter] = useState<string>('');
  const [dailyCallsTarget, setDailyCallsTarget] = useState(34);

  useEffect(() => {
    // Default to today
    const today = new Date().toISOString().split('T')[0];
    setDateFilter(today);

    // Fetch objectives from Operations Manager Settings parameters
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings?.department_weekly_targets) {
          try {
            const targets = JSON.parse(data.settings.department_weekly_targets);
            if (targets.target_daily_calls) {
              setDailyCallsTarget(Number(targets.target_daily_calls));
            } else if (targets.target_weekly_leads) {
              setDailyCallsTarget(Math.ceil(Number(targets.target_weekly_leads) / 6));
            }
          } catch (e) {}
        }
      })
      .catch(console.error);
  }, []);

  // Filter called leads by the date they were actually called (status_changed_at)
  const calledLeads = leads.filter(l => {
    if (l.board_column === 'NEW_LEADS') return false; // Still untouched
    if (!l.status_changed_at) return false; // No timestamp yet (legacy data)
    if (!dateFilter) return true; // No filter = show all
    const changedDate = new Date(l.status_changed_at).toISOString().split('T')[0];
    return changedDate === dateFilter;
  });

  const totalCalled = calledLeads.length;

  // Training conversions for filtered set
  const trainingFixed = calledLeads.filter(
    l => l.brand_status === 'Training fixed' || l.board_column === 'TRAINING_PIPELINE'
  ).length;

  // Daily target set by Operations Manager in parameters
  const dailyTarget = dailyCallsTarget;
  const callProgress = dailyTarget > 0 ? Math.min((totalCalled / dailyTarget) * 100, 100) : 0;

  const conversionRate = totalCalled > 0 ? ((trainingFixed / totalCalled) * 100).toFixed(1) : '0';

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  calledLeads.forEach(lead => {
    const status = lead.brand_status || lead.board_column;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Format display date
  const displayDate = dateFilter
    ? new Date(dateFilter + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'All Time';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold text-navy">Lead Acquisition Performance</h2>
          <p className="text-sm text-gray-500">
            Daily calling review — {displayDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Date:</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-gray-300 rounded-lg shadow-sm text-sm p-2 focus:ring-2 focus:ring-navy/30 focus:border-navy"
          />
          <button
            onClick={() => setDateFilter('')}
            className="text-xs text-blue-600 hover:underline"
          >
            All Time
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Called vs Target */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Calls Today</div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-navy">{totalCalled}</span>
            <span className="text-sm text-gray-400 mb-1">/ {dailyTarget} target</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                callProgress >= 100 ? 'bg-green-500' : callProgress >= 50 ? 'bg-blue-500' : 'bg-orange-400'
              }`}
              style={{ width: `${callProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-1">{callProgress.toFixed(0)}% of daily target</p>
        </div>

        {/* Conversion Rate */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Conversion to Training</div>
          <div className="text-3xl font-bold text-green-600 mb-2">{conversionRate}%</div>
          <p className="text-xs text-gray-500">{trainingFixed} of {totalCalled} called leads converted.</p>
        </div>

        {/* Status Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 col-span-1 md:col-span-2">
          <div className="text-sm font-medium text-gray-500 mb-3">Status Breakdown</div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-red-100 text-red-700 rounded-md">
              Not Interested: {statusCounts['Not interested'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-yellow-100 text-yellow-700 rounded-md">
              No Response: {(statusCounts['No response 1'] || 0) + (statusCounts['No response 2'] || 0)}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-green-100 text-green-700 rounded-md">
              Training Fixed: {trainingFixed}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-purple-100 text-purple-700 rounded-md">
              To Recall: {statusCounts['To Recall'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-md">
              Wrong Number: {statusCounts['Wrong number'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-gray-200 text-gray-700 rounded-md">
              Already Client: {statusCounts['Already a client'] || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
