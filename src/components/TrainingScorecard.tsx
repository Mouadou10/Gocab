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
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

export default function TrainingScorecard({
  leads,
  onSelectStatus,
  selectedDate,
  onDateChange,
}: TrainingScorecardProps) {
  const parseInitialDate = () => {
    if (selectedDate !== undefined) {
      if (!selectedDate || selectedDate === 'ALL') return { start: '', end: '' };
      if (selectedDate === 'TODAY') {
        const today = new Date().toISOString().split('T')[0];
        return { start: today, end: today };
      }
      if (selectedDate === 'TOMORROW') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tStr = tomorrow.toISOString().split('T')[0];
        return { start: tStr, end: tStr };
      }
      if (selectedDate.includes('..')) {
        const [s, e] = selectedDate.split('..');
        return { start: s || '', end: e || '' };
      }
      return { start: selectedDate, end: selectedDate };
    }
    const today = new Date().toISOString().split('T')[0];
    return { start: today, end: today };
  };

  const initialDates = parseInitialDate();
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  const [dailyPreordersTarget, setDailyPreordersTarget] = useState(9);
  const [targetConversionRate, setTargetConversionRate] = useState(25);

  // Synchronize internal date range with selectedDate prop from parent (KanbanBoard)
  useEffect(() => {
    if (selectedDate !== undefined) {
      if (!selectedDate || selectedDate === 'ALL') {
        setStartDate('');
        setEndDate('');
      } else if (selectedDate === 'TODAY') {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
      } else if (selectedDate === 'TOMORROW') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tStr = tomorrow.toISOString().split('T')[0];
        setStartDate(tStr);
        setEndDate(tStr);
      } else if (selectedDate.includes('..')) {
        const [s, e] = selectedDate.split('..');
        setStartDate(s || '');
        setEndDate(e || '');
      } else {
        setStartDate(selectedDate);
        setEndDate(selectedDate);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    // If selectedDate wasn't passed, default to today
    if (selectedDate === undefined) {
      const today = new Date().toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
    }

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
  }, [selectedDate]);

  const handleRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);

    if (!newStart && !newEnd) {
      onDateChange?.("ALL");
    } else if (newStart && newEnd && newStart === newEnd) {
      onDateChange?.(newStart);
    } else if (newStart && newEnd) {
      onDateChange?.(`${newStart}..${newEnd}`);
    } else if (newStart && !newEnd) {
      onDateChange?.(`${newStart}..`);
    } else if (!newStart && newEnd) {
      onDateChange?.(`..${newEnd}`);
    }
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    handleRangeChange(today, today);
  };

  const handleYesterday = () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().split('T')[0];
    handleRangeChange(yStr, yStr);
  };

  const handleThisWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    const startStr = monday.toISOString().split('T')[0];
    const endStr = now.toISOString().split('T')[0];
    handleRangeChange(startStr, endStr);
  };

  const handleThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const startStr = firstDay.toISOString().split('T')[0];
    const endStr = now.toISOString().split('T')[0];
    handleRangeChange(startStr, endStr);
  };

  const handleAllTime = () => {
    handleRangeChange('', '');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isTodaySelected = startDate === todayStr && endDate === todayStr;

  const yDate = new Date();
  yDate.setDate(yDate.getDate() - 1);
  const yStr = yDate.toISOString().split('T')[0];
  const isYesterdaySelected = startDate === yStr && endDate === yStr;

  const nowForWeek = new Date();
  const dayOfWeek = nowForWeek.getDay();
  const diffWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayDate = new Date(nowForWeek);
  mondayDate.setDate(nowForWeek.getDate() - diffWeek);
  const isThisWeekSelected = startDate === mondayDate.toISOString().split('T')[0] && endDate === todayStr;

  const firstOfMonth = new Date(nowForWeek.getFullYear(), nowForWeek.getMonth(), 1);
  const isThisMonthSelected = startDate === firstOfMonth.toISOString().split('T')[0] && endDate === todayStr;

  const isAllTimeSelected = !startDate && !endDate;

  // Training leads are those in TRAINING_PIPELINE or VEHICLE_ASSIGNMENT
  const safeLeads = Array.isArray(leads) ? leads : [];
  const trainingLeads = safeLeads.filter(l =>
    l.board_column === 'TRAINING_PIPELINE' || l.board_column === 'VEHICLE_ASSIGNMENT'
  );

  // Filter by date range using status_changed_at, updated_at, reminder_date, or created_at
  const filteredLeads = trainingLeads.filter(lead => {
    if (!startDate && !endDate) return true;
    const candidates = [
      lead.status_changed_at,
      lead.updated_at,
      lead.reminder_date,
      lead.created_at,
    ].filter(Boolean);

    return candidates.some((val: any) => {
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return false;
        const iso = d.toISOString().split('T')[0];
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const inRange = (ymd: string) => {
          if (startDate && ymd < startDate) return false;
          if (endDate && ymd > endDate) return false;
          return true;
        };

        return inRange(iso) || inRange(local);
      } catch {
        return false;
      }
    });
  });

  const totalInTraining = filteredLeads.length;

  // Conversion statuses — the goal of the training pipeline
  const CONVERSION_STATUSES = ['Assign vehicle', 'Accept offer', 'Preorder', 'VEHICLE_ASSIGNMENT'];
  const converted = filteredLeads.filter(l =>
    CONVERSION_STATUSES.includes(l.training_status) || l.board_column === 'VEHICLE_ASSIGNMENT'
  );
  const totalConverted = converted.length;

  // Calculate days in period for scaling target
  let periodDays = 1;
  if (startDate && endDate) {
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diffTime = Math.abs(e.getTime() - s.getTime());
      periodDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
    } catch {}
  }

  // Daily or scaled period target configured in Operations Settings
  const dailyTarget = dailyPreordersTarget;
  const scaledTarget = (startDate && endDate && periodDays > 1)
    ? dailyTarget * periodDays
    : dailyTarget;

  const progress = scaledTarget > 0 ? Math.min((totalConverted / scaledTarget) * 100, 100) : 0;

  const conversionRate = totalInTraining > 0
    ? ((totalConverted / totalInTraining) * 100).toFixed(1)
    : '0';

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  filteredLeads.forEach(lead => {
    const status = lead.training_status || lead.board_column;
    // For Scheduled leads, hide future dates if Today is selected
    if (status === 'Scheduled' || (!lead.training_status && lead.board_column === 'TRAINING_PIPELINE')) {
      if (lead.reminder_date && isTodaySelected) {
        try {
          const d = new Date(lead.reminder_date);
          if (!isNaN(d.getTime())) {
            const dateStr = d.toISOString().split('T')[0];
            if (dateStr !== todayStr) {
              return;
            }
          }
        } catch {}
      }
    }
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Format display date or range
  let displayDate = 'All Time';
  if (startDate && endDate) {
    if (startDate === endDate) {
      displayDate = new Date(startDate + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
    } else {
      const sFormatted = new Date(startDate + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      const eFormatted = new Date(endDate + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      displayDate = `${sFormatted} → ${eFormatted}`;
    }
  } else if (startDate && !endDate) {
    displayDate = `From ${new Date(startDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } else if (!startDate && endDate) {
    displayDate = `Until ${new Date(endDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold text-navy">Training Pipeline Performance</h2>
          <p className="text-sm text-gray-500">
            Training review — <span className="font-semibold text-navy">{displayDate}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Start and End date inputs */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 shadow-2xs">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-gray-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleRangeChange(e.target.value, endDate)}
                className="border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-800 bg-white focus:ring-1 focus:ring-navy outline-none cursor-pointer"
                title="Start date"
              />
            </div>
            <span className="text-gray-400 text-xs font-bold">→</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-gray-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleRangeChange(startDate, e.target.value)}
                className="border border-gray-300 rounded px-1.5 py-0.5 text-xs text-gray-800 bg-white focus:ring-1 focus:ring-navy outline-none cursor-pointer"
                title="End date"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={handleToday}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                isTodaySelected ? "bg-white text-navy shadow-2xs font-bold" : "text-gray-600 hover:text-navy"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleYesterday}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                isYesterdaySelected ? "bg-white text-navy shadow-2xs font-bold" : "text-gray-600 hover:text-navy"
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={handleThisWeek}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                isThisWeekSelected ? "bg-white text-navy shadow-2xs font-bold" : "text-gray-600 hover:text-navy"
              }`}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={handleThisMonth}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                isThisMonthSelected ? "bg-white text-navy shadow-2xs font-bold" : "text-gray-600 hover:text-navy"
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={handleAllTime}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                isAllTimeSelected ? "bg-white text-blue-600 shadow-2xs font-bold" : "text-blue-600 hover:underline"
              }`}
            >
              All Time
            </button>
          </div>
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
