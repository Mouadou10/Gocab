"use client";

import React, { useState, useEffect } from 'react';

/**
 * TrainingScorecard — shows daily training pipeline metrics.
 * 
 * The progress bar tracks leads that reached "Accept offer", "Preorder",
 * or "VEHICLE_ASSIGNMENT" (the conversion goal of the training pipeline).
 * Filters by the date the lead's training_status was last changed.
 */
export default function TrainingScorecard({ leads }: { leads: any[] }) {
  const [dateFilter, setDateFilter] = useState<string>('');
  const [weeklyPreordersTarget, setWeeklyPreordersTarget] = useState(50);

  useEffect(() => {
    // Default to today
    const today = new Date().toISOString().split('T')[0];
    setDateFilter(today);

    // Fetch objectives for preorders/new drivers target
    fetch('/api/objectives?role=LEAD_ACQUISITION_JR')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.objectives) {
          const target = data.objectives.find((o: any) => o.metricKey === 'WEEKLY_PREORDERS');
          if (target) setWeeklyPreordersTarget(target.targetValue);
        }
      })
      .catch(console.error);
  }, []);

  // Training leads are those in TRAINING_PIPELINE or VEHICLE_ASSIGNMENT
  const trainingLeads = leads.filter(l =>
    l.board_column === 'TRAINING_PIPELINE' || l.board_column === 'VEHICLE_ASSIGNMENT'
  );

  // Filter by date using updated_at (training status changes trigger updated_at)
  const filteredLeads = trainingLeads.filter(lead => {
    if (!dateFilter) return true;
    const changedDate = new Date(lead.updated_at || lead.created_at).toISOString().split('T')[0];
    return changedDate === dateFilter;
  });

  const totalInTraining = filteredLeads.length;

  // Conversion statuses — the goal of the training pipeline
  const CONVERSION_STATUSES = ['Accept offer', 'Preorder'];
  const converted = filteredLeads.filter(l =>
    CONVERSION_STATUSES.includes(l.training_status) || l.board_column === 'VEHICLE_ASSIGNMENT'
  );
  const totalConverted = converted.length;

  // Daily target from weekly (6 working days)
  const dailyTarget = Math.ceil(weeklyPreordersTarget / 6);
  const progress = dailyTarget > 0 ? Math.min((totalConverted / dailyTarget) * 100, 100) : 0;

  const conversionRate = totalInTraining > 0
    ? ((totalConverted / totalInTraining) * 100).toFixed(1)
    : '0';

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  filteredLeads.forEach(lead => {
    const status = lead.training_status || lead.board_column;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Format display date
  const displayDate = dateFilter
    ? new Date(dateFilter + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      })
    : 'All Time';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold text-navy">Training Pipeline Performance</h2>
          <p className="text-sm text-gray-500">
            Daily training review — {displayDate}
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
        {/* New Drivers / Preorders Today */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">New Drivers / Preorders</div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-navy">{totalConverted}</span>
            <span className="text-sm text-gray-400 mb-1">/ {dailyTarget} target</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-orange-400'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-1">{progress.toFixed(0)}% of daily target</p>
        </div>

        {/* Conversion Rate */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">Training Conversion</div>
          <div className="text-3xl font-bold text-green-600 mb-2">{conversionRate}%</div>
          <p className="text-xs text-gray-500">{totalConverted} of {totalInTraining} training leads converted.</p>
        </div>

        {/* Status Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 col-span-1 md:col-span-2">
          <div className="text-sm font-medium text-gray-500 mb-3">Status Breakdown</div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-md">
              Scheduled: {statusCounts['Scheduled'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-green-100 text-green-700 rounded-md">
              Attended: {statusCounts['Attended'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-red-100 text-red-700 rounded-md">
              Not Interested: {statusCounts['Attended and not interested'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-orange-100 text-orange-700 rounded-md">
              Pending: {statusCounts['Pending'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-red-100 text-red-700 rounded-md">
              Refused: {statusCounts['Refused the offer'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-md">
              Accept Offer: {statusCounts['Accept offer'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-gray-200 text-gray-700 rounded-md">
              Not Attended: {statusCounts['Not attended'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-yellow-100 text-yellow-700 rounded-md">
              No Response: {statusCounts['No response'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-purple-100 text-purple-700 rounded-md">
              Preorder: {statusCounts['Preorder'] || 0}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1.5 bg-navy/10 text-navy rounded-md">
              Vehicle Assigned: {statusCounts['VEHICLE_ASSIGNMENT'] || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
