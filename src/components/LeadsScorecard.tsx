"use client";

import React, { useState, useEffect } from 'react';

interface LeadsScorecardProps {
  leads: any[];
  onSelectStatus?: (status: string) => void;
}

export default function LeadsScorecard({ leads, onSelectStatus }: LeadsScorecardProps) {
  const [dateFilter, setDateFilter] = useState<string>('');
  const [dailyCallsTarget, setDailyCallsTarget] = useState(34);
  const [dailyTrainingTarget, setDailyTrainingTarget] = useState(7);
  const [targetConversionRate, setTargetConversionRate] = useState(20);

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
            if (targets.target_daily_training_fixed) {
              setDailyTrainingTarget(Number(targets.target_daily_training_fixed));
            }
            if (targets.target_lead_conversion_rate) {
              setTargetConversionRate(Number(targets.target_lead_conversion_rate));
            }
          } catch (e) {
            console.error("Failed to parse department_weekly_targets", e);
          }
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
  const rawCallProgress = dailyTarget > 0 ? (totalCalled / dailyTarget) * 100 : 0;
  const callProgress = Math.min(rawCallProgress, 100);

  const conversionRateNum = totalCalled > 0 ? (trainingFixed / totalCalled) * 100 : 0;
  const conversionRate = conversionRateNum.toFixed(1);

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  calledLeads.forEach(lead => {
    const status = lead.brand_status || lead.board_column;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  // Format display date
  const isToday = dateFilter === todayStr;
  const isYesterday = dateFilter === yesterdayStr;
  const isAllTime = !dateFilter;

  const displayDate = isToday
    ? "Aujourd'hui"
    : isYesterday
    ? "Hier"
    : isAllTime
    ? "Tout l'historique"
    : new Date(dateFilter + 'T12:00:00').toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

  const statusConfig: {
    key: string;
    label: string;
    count: number;
    colorClasses: string;
    dotColor: string;
  }[] = [
    {
      key: 'Training fixed',
      label: 'Formation Fixée',
      count: trainingFixed,
      colorClasses: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/90 hover:border-emerald-300',
      dotColor: 'bg-emerald-500',
    },
    {
      key: 'No response 1',
      label: 'NRP 1 (Sans rép.)',
      count: statusCounts['No response 1'] || 0,
      colorClasses: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/90 hover:border-amber-300',
      dotColor: 'bg-amber-500',
    },
    {
      key: 'No response 2',
      label: 'NRP 2 (Sans rép.)',
      count: statusCounts['No response 2'] || 0,
      colorClasses: 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100/90 hover:border-orange-300',
      dotColor: 'bg-orange-500',
    },
    {
      key: 'To Recall',
      label: 'À Rappeler',
      count: statusCounts['To Recall'] || 0,
      colorClasses: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100/90 hover:border-purple-300',
      dotColor: 'bg-purple-500',
    },
    {
      key: 'Not interested',
      label: 'Pas Intéressé',
      count: statusCounts['Not interested'] || 0,
      colorClasses: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/90 hover:border-rose-300',
      dotColor: 'bg-rose-500',
    },
    {
      key: 'Wrong number',
      label: 'Faux Numéro',
      count: statusCounts['Wrong number'] || 0,
      colorClasses: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100/90 hover:border-sky-300',
      dotColor: 'bg-sky-500',
    },
    {
      key: 'Already a client',
      label: 'Déjà Client',
      count: statusCounts['Already a client'] || 0,
      colorClasses: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80 hover:border-slate-300',
      dotColor: 'bg-slate-400',
    },
  ];

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 mb-5 transition-all">
      {/* Top Header Row */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 mb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-navy/5 text-navy">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </span>
              Performance Prospection & Appels
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isToday ? "En direct" : "Archive"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>Revue d&apos;acquisition :</span>
            <span className="font-semibold text-slate-800 capitalize">{displayDate}</span>
            <span className="text-slate-300">•</span>
            <span>{totalCalled} prospects qualifiés</span>
          </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Preset Buttons */}
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDateFilter(todayStr)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                isToday
                  ? "bg-white text-navy font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              onClick={() => setDateFilter(yesterdayStr)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                isYesterday
                  ? "bg-white text-navy font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hier
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                isAllTime
                  ? "bg-white text-navy font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tout
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="relative flex items-center">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy cursor-pointer transition-all"
              title="Filtrer par date spécifique"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="ml-1.5 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors text-xs font-bold"
                title="Effacer filtre de date"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Card 1: Appels du Jour */}
        <div className="md:col-span-3 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/40 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
              <span className="flex items-center gap-1.5">
                <span>📞</span>
                <span>Appels Réalisés</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-3xs font-extrabold ${
                rawCallProgress >= 100
                  ? "bg-emerald-100 text-emerald-800"
                  : rawCallProgress >= 50
                  ? "bg-blue-100 text-blue-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {rawCallProgress.toFixed(0)}%
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2.5">
              <span className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                {totalCalled}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                / {dailyTarget} cible
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  rawCallProgress >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-xs'
                    : rawCallProgress >= 50
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                    : 'bg-gradient-to-r from-amber-400 to-orange-500'
                }`}
                style={{ width: `${callProgress}%` }}
              />
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-3xs text-slate-500 font-medium">
            <span>Rythme journalier</span>
            <span className={`font-bold ${rawCallProgress >= 100 ? 'text-emerald-700' : 'text-slate-700'}`}>
              {rawCallProgress >= 100 ? '🔥 Objectif dépassé' : `${Math.max(0, dailyTarget - totalCalled)} restants`}
            </span>
          </div>
        </div>

        {/* Card 2: Taux de Conversion Formations */}
        <div className="md:col-span-3 bg-gradient-to-br from-emerald-50/40 via-white to-slate-50/40 rounded-xl p-4 border border-emerald-200/60 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
              <span className="flex items-center gap-1.5 text-emerald-900">
                <span>🎯</span>
                <span>Taux de Conversion</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-3xs font-extrabold ${
                conversionRateNum >= targetConversionRate
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-blue-100 text-blue-800"
              }`}>
                Obj. {targetConversionRate}%
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2.5">
              <span className="text-3xl font-black text-emerald-700 tracking-tight font-mono">
                {conversionRate}%
              </span>
              <span className="text-xs font-semibold text-slate-400">
                ({trainingFixed} fixées)
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  conversionRateNum >= targetConversionRate
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-blue-500 to-teal-400'
                }`}
                style={{
                  width: `${Math.min(100, targetConversionRate > 0 ? (conversionRateNum / targetConversionRate) * 100 : 0)}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-emerald-100/60 flex items-center justify-between text-3xs text-slate-500 font-medium">
            <span>{trainingFixed} sur {totalCalled} leads</span>
            <span className="font-bold text-emerald-800">
              Cible : {trainingFixed}/{dailyTrainingTarget} fixées
            </span>
          </div>
        </div>

        {/* Card 3: Répartition des Statuts (Status Breakdown Interactive Triage) */}
        <div className="md:col-span-6 bg-gradient-to-br from-slate-50/60 via-white to-slate-50/30 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>📊</span>
                <span>Répartition des Retours d&apos;Appels</span>
              </div>
              <span className="text-3xs text-navy/80 font-bold bg-navy/5 px-2 py-0.5 rounded-full border border-navy/10 flex items-center gap-1">
                <span>⚡</span>
                <span>Cliquez pour amener la colonne en 2ᵉ place</span>
              </span>
            </div>

            {/* Status Pills Grid */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {statusConfig.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectStatus?.(item.key)}
                  className={`group relative text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${item.colorClasses} active:scale-95 shadow-2xs`}
                  title={`Placer la colonne "${item.label}" en 2ᵉ position pour traiter ces ${item.count} leads`}
                >
                  <span className={`w-2 h-2 rounded-full ${item.dotColor} shrink-0 group-hover:scale-125 transition-transform`} />
                  <span className="leading-none">{item.label}</span>
                  <span className="font-mono font-black text-3xs px-1.5 py-0.5 rounded-md bg-white/80 border border-black/5 shadow-3xs leading-none">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-3xs text-slate-400">
            <span>Total retours journaliers : {totalCalled}</span>
            <span className="font-medium text-slate-500">Triage rapide par colonne Kanban</span>
          </div>
        </div>
      </div>
    </section>
  );
}
