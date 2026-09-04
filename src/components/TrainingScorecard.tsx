"use client";

import React, { useState, useEffect } from 'react';

/**
 * TrainingScorecard — shows daily training pipeline metrics.
 * 
 * The progress bar tracks leads that reached "Accept offer", "Preorder",
 * or "VEHICLE_ASSIGNMENT" (the conversion goal of the training pipeline).
 * Filters by the date the lead's training_status was last changed.
 */
interface TrainingScorecardProps {
  leads: any[];
  onSelectStatus?: (status: string) => void;
}

export default function TrainingScorecard({ leads, onSelectStatus }: TrainingScorecardProps) {
  const [dateFilter, setDateFilter] = useState<string>('');
  const [dailyPreordersTarget, setDailyPreordersTarget] = useState(9);
  const [targetConversionRate, setTargetConversionRate] = useState(25);

  useEffect(() => {
    // Default to today
    const today = new Date().toISOString().split('T')[0];
    setDateFilter(today);

    // Fetch objectives from Settings
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings?.department_weekly_targets) {
          try {
            const targets = JSON.parse(data.settings.department_weekly_targets);
            if (targets.target_daily_preorders !== undefined && targets.target_daily_preorders !== null) {
              setDailyPreordersTarget(Number(targets.target_daily_preorders));
            } else if (targets.target_kyc_completion_rate) {
              setDailyPreordersTarget(Math.ceil(Number(targets.target_kyc_completion_rate) / 6));
            }
            if (targets.target_kyc_completion_rate) {
              setTargetConversionRate(Number(targets.target_kyc_completion_rate));
            } else if (targets.target_lead_conversion_rate) {
              setTargetConversionRate(Number(targets.target_lead_conversion_rate));
            }
          } catch (e) {}
        }
      })
      .catch(console.error);
  }, []);

  // Training leads are those in TRAINING_PIPELINE or VEHICLE_ASSIGNMENT
  const safeLeads = Array.isArray(leads) ? leads : [];
  const trainingLeads = safeLeads.filter(l =>
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
  const CONVERSION_STATUSES = ['Assign vehicle', 'Accept offer', 'Preorder', 'VEHICLE_ASSIGNMENT'];
  const converted = filteredLeads.filter(l =>
    CONVERSION_STATUSES.includes(l.training_status) || l.board_column === 'VEHICLE_ASSIGNMENT'
  );
  const totalConverted = converted.length;

  // Daily target configured in Operations Settings
  const dailyTarget = dailyPreordersTarget;
  const progress = dailyTarget > 0 ? Math.min((totalConverted / dailyTarget) * 100, 100) : 0;

  const conversionRate = totalInTraining > 0
    ? ((totalConverted / totalInTraining) * 100).toFixed(1)
    : '0';

  // Status breakdown
  const todayStr = new Date().toISOString().split('T')[0];
  const statusCounts: Record<string, number> = {};
  filteredLeads.forEach(lead => {
    const status = lead.training_status || lead.board_column;
    // For Scheduled leads, hide future dates until training day
    if (status === 'Scheduled' || (!lead.training_status && lead.board_column === 'TRAINING_PIPELINE')) {
      if (lead.reminder_date) {
        try {
          const d = new Date(lead.reminder_date);
          if (!isNaN(d.getTime())) {
            const dateStr = d.toISOString().split('T')[0];
            if (dateFilter === todayStr && dateStr !== todayStr) {
              return;
            }
          }
        } catch {}
      }
    }
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
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-green-600">{conversionRate}%</span>
            <span className="text-sm text-gray-400 mb-1">/ {targetConversionRate}% obj.</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                Number(conversionRate) >= targetConversionRate ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, targetConversionRate > 0 ? (Number(conversionRate) / targetConversionRate) * 100 : 0)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{totalConverted} of {totalInTraining} leads</span>
            <span className="font-semibold text-navy">Obj: {totalConverted}/{dailyPreordersTarget} convertis</span>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Status Breakdown</span>
            <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
              ✨ Click a status to bring column to 2nd position
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectStatus?.('Scheduled')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'Scheduled' in 2nd column position"
            >
              <span>Scheduled:</span>
              <span className="font-bold">{statusCounts['Scheduled'] || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStatus?.('Attended')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'Attended' in 2nd column position"
            >
              <span>Attended:</span>
              <span className="font-bold">{statusCounts['Attended'] || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStatus?.('Attended and not interested')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'Not Interested' in 2nd column position"
            >
              <span>Not Interested:</span>
              <span className="font-bold">{statusCounts['Attended and not interested'] || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStatus?.('Pending')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'Pending' in 2nd column position"
            >
              <span>Pending:</span>
              <span className="font-bold">{statusCounts['Pending'] || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStatus?.('Refused the offer')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'Refused' in 2nd column position"
            >
              <span>Refused:</span>
              <span className="font-bold">{statusCounts['Refused the offer'] || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStatus?.('Assign vehicle')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'Assign Vehicle' in 2nd column position"
            >
              <span>Assign Vehicle:</span>
              <span className="font-bold">
                {(statusCounts['Assign vehicle'] || 0) + (statusCounts['Accept offer'] || 0) + (statusCounts['VEHICLE_ASSIGNMENT'] || 0)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStatus?.('Not attended')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'Not Attended' in 2nd column position"
            >
              <span>Not Attended:</span>
              <span className="font-bold">{statusCounts['Not attended'] || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStatus?.('No response')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'No Response' in 2nd column position"
            >
              <span>No Response:</span>
              <span className="font-bold">{statusCounts['No response'] || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectStatus?.('Preorder')}
              className="text-xs font-semibold px-2.5 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 hover:shadow-sm transition-all rounded-lg cursor-pointer flex items-center gap-1.5"
              title="Click to place 'Preorder' in 2nd column position"
            >
              <span>Preorder:</span>
              <span className="font-bold">{statusCounts['Preorder'] || 0}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
