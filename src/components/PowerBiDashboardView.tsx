"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";

interface PerformanceData {
  period: {
    startDate: string;
    endDate: string;
    dayCount: number;
    calendarDays?: number;
    workingDays?: number;
    workingDaysInMonth?: number;
    holidaysEncountered?: { date: string; name: string }[];
  };
  targets: {
    target_daily_calls: number;
    target_daily_training_fixed: number;
    target_daily_preorders: number;
    target_collection_rate: number;
    target_daily_tasks: number;
    target_fleet_uptime: number;
    target_ticket_resolution_rate: number;
    target_avg_available_days?: number;
    monthly_bonus_amount_mad?: number;
  };
  callResultsBreakdown?: {
    trainingFixed: number;
    noResponse: number;
    toRecall: number;
    notInterested: number;
    wrongNumber: number;
    alreadyClient: number;
    other: number;
    total: number;
  };
  trafficAcquisitionTeam?: {
    callsDone: number;
    callsTarget: number;
    callsAttainmentPct: number;
    trainingFixed: number;
    trainingFixedTarget: number;
    trainingFixedAttainmentPct: number;
    trainingFixedRate: number;
    targetTrainingFixedRate: number;
    attendedPersons: number;
    attendedRate: number;
    targetAttendedRate: number;
    preordersAssigned: number;
    preorderAssignedRate: number;
    targetPreorderAssignedRate: number;
    teamAttainmentPct: number;
    monthlyBonusBudgetMAD: number;
    bonusEarnedMAD: number;
    members: string[];
  };
  onboardingSpecialistTeam?: {
    attendedCount: number;
    attendedTarget: number;
    attendedAttainmentPct: number;
    preordersCount: number;
    assignedCount: number;
    preordersAssignedTotal: number;
    preordersTarget: number;
    preordersAttainmentPct: number;
    showupRate: number;
    targetShowupRate: number;
    preorderAssignedRate: number;
    targetPreorderAssignedRate: number;
    avgDaysCarAvailable: number;
    targetAvgDaysCarAvailable: number;
    velocityScorePct: number;
    teamAttainmentPct: number;
    monthlyBonusBudgetMAD: number;
    bonusEarnedMAD: number;
    members: string[];
  };
  monthlyTargets?: {
    monthlyCallsTarget: number;
    monthlyTrainingTarget: number;
    monthlyAttendedTarget: number;
    monthlyPreordersTarget: number;
    workingDaysInMonth: number;
  };
  kpis: {
    leadAcquisition: {
      callsDone: number;
      callsTarget: number;
      callsAttainmentPct: number;
      trainingFixed: number;
      trainingTarget: number;
      trainingAttainmentPct: number;
      attendedPersons: number;
      conversionRate?: number;
      targetConversionRate?: number;
      bonusEarnedMAD?: number;
    };
    trainingOnboarding: {
      attendanceRate: number;
      targetAttendanceRate?: number;
      assignedVehiclesCount: number;
      assignedVehiclesTarget?: number;
      preordersCount: number;
      preordersTarget: number;
      preordersAttainmentPct: number;
      totalPreorderMAD: number;
      avgDaysCarAvailable?: number;
      targetAvgDaysCarAvailable?: number;
      bonusEarnedMAD?: number;
    };
    fleetCollections: {
      totalMorningTargetMAD: number;
      totalEveningCollectedMAD: number;
      collectionRecoveryRate: number;
      recoveryObjectivePct: number;
      collectionAttainmentPct: number;
      isObjectiveMet: boolean;
      avgDaysInsuranceRepair: number;
      maxDaysInsuranceRepair?: number;
      avgHoursAdBlueVidange: number;
      maxHoursAdBlueVidange?: number;
      weeklyChurnRate: number;
      maxWeeklyChurnRate?: number;
    };
    fieldOperations: {
      avgHoursVehicleRecovery: number;
      monthlyChecksCount: number;
      monthlyChecksTarget?: number;
      tasksTotal: number;
      tasksCompleted: number;
      tasksFailed: number;
      tasksTarget: number;
      tasksAttainmentPct: number;
      taskCompletionRate: number;
      avgHealthScore: number;
    };
  };
  leaderboard: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    teamName?: string;
    keyMetric: string;
    actual: number;
    target: number;
    unit: string;
    attainmentPct: number;
    individualAttainmentPct?: number;
    bonusEarnedMAD?: number;
    bonusBudgetMAD?: number;
    status: "EXCEEDED" | "ON_TRACK" | "BEHIND";
  }[];
  dailyTimeline: {
    date: string;
    calls: number;
    trainings: number;
    collectedMAD: number;
    tasksDone: number;
  }[];
  users: {
    id: string;
    name: string;
    fullName?: string;
    role: string;
    email: string;
    region?: string;
  }[];
}

const PRESET_RANGES = [
  { id: "today", label: "Aujourd'hui", days: 0 },
  { id: "yesterday", label: "Hier", days: 1 },
  { id: "7d", label: "7 Derniers Jours", days: 7 },
  { id: "month", label: "Ce Mois (en cours)", days: 30 },
  { id: "30d", label: "30 Derniers Jours", days: 30 },
  { id: "custom", label: "Personnalisé 📅", days: -1 },
];

const DEPARTMENTS = [
  { id: "ALL", label: "Tous les Départements" },
  { id: "LEAD_ACQUISITION_JR", label: "📞 Traffic Acquisition (Nour & Kaoutar)" },
  { id: "TRAINING", label: "🎓 Onboarding (Ayoub Gsaib)" },
  { id: "FLEET_PERF_MANAGER", label: "💰 Recouvrement & Flotte" },
  { id: "FIELD_SUPERVISOR", label: "🛡️ Opérations Terrain" },
  { id: "GARAGE", label: "🔧 Maintenance & Garage" },
];

const CITIES = ["ALL", "Casablanca", "Rabat", "Marrakech", "Tangier", "Agadir", "Fez"];

export default function PowerBiDashboardView() {
  const { t } = useLanguage();

  // Filter States (PowerBI Slicers)
  const [selectedPreset, setSelectedPreset] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("ALL");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedCity, setSelectedCity] = useState("ALL");

  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "leaderboard" | "trends">("overview");

  // Initialize date range based on preset
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (selectedPreset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (selectedPreset === "yesterday") {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (selectedPreset === "7d") {
      const d = new Date(today);
      d.setDate(today.getDate() - 6);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (selectedPreset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (selectedPreset === "30d") {
      const d = new Date(today);
      d.setDate(today.getDate() - 29);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
    }
  }, [selectedPreset]);

  // Fetch KPI Performance Analytics from Backend
  const fetchPerformance = useCallback(async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });

      if (selectedUser !== "ALL") params.append("userId", selectedUser);
      if (selectedDept !== "ALL") params.append("role", selectedDept);
      if (selectedCity !== "ALL") params.append("hubCity", selectedCity);

      const res = await fetch(`/api/kpis/performance?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load performance metrics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("fetchPerformance error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedUser, selectedDept, selectedCity]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  // Filter leaderboard on client side by selected department if needed
  const filteredLeaderboard = useMemo(() => {
    if (!data?.leaderboard) return [];
    if (selectedDept === "ALL") return data.leaderboard;
    return data.leaderboard.filter((u) => {
      if (selectedDept === "LEAD_ACQUISITION_JR") return u.role === "LEAD_ACQUISITION_JR" || u.department.includes("Acquisition");
      if (selectedDept === "TRAINING") return u.role === "ONBOARDING_SPECIALIST" || u.department.includes("Formation");
      if (selectedDept === "FLEET_PERF_MANAGER") return u.role === "FLEET_PERF_MANAGER";
      if (selectedDept === "FIELD_SUPERVISOR") return u.role === "FIELD_SUPERVISOR";
      return true;
    });
  }, [data?.leaderboard, selectedDept]);

  const kpis = data?.kpis;
  const traffic = data?.trafficAcquisitionTeam;
  const onboarding = data?.onboardingSpecialistTeam;
  const callResults = data?.callResultsBreakdown;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ── Top Header Banner ───────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-navy via-navy/95 to-[#1a3352] text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <h2 className="text-xl font-bold tracking-tight">Tableau de Bord Exécutif & Bonus Équipe</h2>
          </div>
          <p className="text-white/70 text-xs mt-1">
            Indicateurs de performance en temps réel · Moteur d&apos;objectifs dynamiques · Prime mensuelle de 1 000 DH
          </p>
        </div>

        {/* Moroccan Working Calendar Badge */}
        <div className="flex flex-wrap items-center gap-2 bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-400 text-slate-950 font-black rounded-xl">
            <span>🇲🇦</span>
            <span>{data?.period.workingDays || 1} j ouvrés</span>
          </div>
          <div className="text-white/90 font-medium px-1">
            <span>(Lun–Ven · Fériés déduits : <strong>{data?.period.holidaysEncountered?.length || 0}</strong>)</span>
          </div>
          <button
            onClick={() => fetchPerformance()}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all cursor-pointer text-white"
            title="Rafraîchir les données"
          >
            🔄
          </button>
        </div>
      </div>

      {/* ── Interactive PowerBI Slicers Bar ─────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-black text-navy uppercase tracking-wider">
            <span>🎛️</span>
            <span>Filtres & Slicers Interactifs</span>
          </div>
          <span className="text-2xs font-semibold text-gray-500">
            Période : <strong>{data?.period.workingDays || 1} jour(s) ouvré(s)</strong> ({startDate} ➔ {endDate})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Preset Buttons */}
          <div className="space-y-1.5 lg:col-span-2">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              Période Rapide
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_RANGES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedPreset === preset.id
                      ? "bg-navy text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date From */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              Date Début (From)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedPreset("custom");
              }}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-navy/30 focus:border-navy outline-none"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              Date Fin (To)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedPreset("custom");
              }}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-navy/30 focus:border-navy outline-none"
            />
          </div>

          {/* User Slicer */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              👤 Collaborateur
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-navy/30 focus:border-navy outline-none"
            >
              <option value="ALL">👥 Toute l&apos;Équipe</option>
              {(data?.users || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Department Slicer */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              🏢 Département
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-navy/30 focus:border-navy outline-none"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>

          {/* City Slicer */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              📍 Ville / Hub City
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-navy/30 focus:border-navy outline-none"
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city === "ALL" ? "Toutes les Villes (Maroc)" : city}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Action */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedPreset("month");
                setSelectedUser("ALL");
                setSelectedDept("ALL");
                setSelectedCity("ALL");
              }}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>↺</span>
              <span>Réinitialiser Filtres</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "overview"
              ? "border-navy text-navy"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>🎯</span>
          <span>Tableau de Bord & Équipes</span>
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "leaderboard"
              ? "border-navy text-navy"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>🏆</span>
          <span>Classement & Prime Mensuelle (1 000 DH)</span>
        </button>
        <button
          onClick={() => setActiveTab("trends")}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "trends"
              ? "border-navy text-navy"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>📈</span>
          <span>Vélocité & Historique Journalier</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-24 text-center space-y-3 bg-white rounded-3xl border border-gray-200">
          <div className="w-10 h-10 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-gray-500">Calcul des KPIs et calcul des primes d&apos;équipe...</p>
        </div>
      ) : kpis ? (
        <>
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* ══════════════════════════════════════════════════════════════
                  SECTION 1: TRAFFIC ACQUISITION TEAM (NOUR & KAOUTAR)
                 ══════════════════════════════════════════════════════════════ */}
              <div className="bg-white border-2 border-blue-200 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2.5 bg-blue-50 text-blue-800 rounded-2xl border border-blue-200">
                      📞
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-gray-900">
                          Traffic Acquisition Team
                        </h3>
                        <span className="text-3xs px-2.5 py-0.5 bg-blue-100 text-blue-900 font-bold rounded-full">
                          Nour Abouri & Kaoutar Ouardi
                        </span>
                      </div>
                      <p className="text-2xs text-gray-500 mt-0.5">
                        Prospection · Qualification téléphonique · Taux de conversion cible : <strong>30%</strong>
                      </p>
                    </div>
                  </div>

                  {/* 1 000 MAD Monthly Bonus Card */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-3 rounded-2xl flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-2xs">
                      💰
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-3xs font-black uppercase tracking-wider text-blue-700">Prime Mensuelle</span>
                        <span className="text-3xs px-1.5 py-0.2 bg-blue-200 text-blue-900 rounded font-bold">Option 2 (Prop. pur)</span>
                      </div>
                      <p className="text-sm font-black text-gray-900 font-mono">
                        {traffic?.bonusEarnedMAD ?? 0} DH <span className="text-xs font-normal text-gray-500">/ 1 000 DH</span>
                      </p>
                      <p className="text-3xs text-gray-600 font-semibold">
                        Atteinte globale équipe : <strong>{traffic?.teamAttainmentPct ?? 0}%</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Core Traffic KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Calls Made */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-3xs font-black uppercase tracking-wider text-blue-700">1. Appels Réalisés</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-gray-900 font-mono">{traffic?.callsDone ?? 0}</span>
                      <span className="text-2xs text-gray-500 font-medium">Obj : {traffic?.callsTarget ?? 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, traffic?.callsAttainmentPct ?? 0)}%` }}
                      />
                    </div>
                    <p className="text-3xs text-gray-500 font-medium text-right">
                      Atteinte : <strong className="text-blue-700">{traffic?.callsAttainmentPct ?? 0}%</strong>
                    </p>
                  </div>

                  {/* 2. Training Fixed */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-3xs font-black uppercase tracking-wider text-emerald-700">2. Formations Fixées (30%)</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-gray-900 font-mono">{traffic?.trainingFixed ?? 0}</span>
                      <span className="text-2xs text-gray-500 font-medium">Obj : {traffic?.trainingFixedTarget ?? 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, traffic?.trainingFixedAttainmentPct ?? 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-3xs font-semibold">
                      <span className="text-gray-500">Tx Conversion :</span>
                      <strong className={traffic?.trainingFixedRate && traffic.trainingFixedRate >= 30 ? "text-emerald-700" : "text-amber-700"}>
                        {traffic?.trainingFixedRate ?? 0}% (Cible 30%)
                      </strong>
                    </div>
                  </div>

                  {/* 3. Attended Show-up from their fixed */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-3xs font-black uppercase tracking-wider text-teal-700">3. Présents en Formation (65%)</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-gray-900 font-mono">{traffic?.attendedPersons ?? 0}</span>
                      <span className="text-2xs text-gray-500 font-medium">issus de leurs fixées</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-teal-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((traffic?.attendedPersons ?? 0) / Math.max(1, (traffic?.trainingFixed ?? 1) * 0.65)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-3xs font-semibold">
                      <span className="text-gray-500">Tx Présence :</span>
                      <strong className={traffic?.attendedRate && traffic.attendedRate >= 65 ? "text-emerald-700" : "text-teal-700"}>
                        {traffic?.attendedRate ?? 0}% (Cible 65%)
                      </strong>
                    </div>
                  </div>

                  {/* 4. Preorders / Assigned from their fixed */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-3xs font-black uppercase tracking-wider text-purple-700">4. Précommandes & Affectations (25%)</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-gray-900 font-mono">{traffic?.preordersAssigned ?? 0}</span>
                      <span className="text-2xs text-gray-500 font-medium">fin d&apos;entonnoir</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-purple-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, ((traffic?.preordersAssigned ?? 0) / Math.max(1, (traffic?.trainingFixed ?? 1) * 0.25)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-3xs font-semibold">
                      <span className="text-gray-500">Tx Conversion Finale :</span>
                      <strong className={traffic?.preorderAssignedRate && traffic.preorderAssignedRate >= 25 ? "text-emerald-700" : "text-purple-700"}>
                        {traffic?.preorderAssignedRate ?? 0}% (Cible 25%)
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Call Results Distribution Waterfall */}
                {callResults && (
                  <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                        <span>📊</span>
                        <span>Répartition des Résultats d&apos;Appels ({callResults.total} appels traités)</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-2xs font-semibold">
                      <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-xl border border-emerald-200">
                        <span>✅ Formations Fixées :</span>
                        <strong className="font-mono text-xs">{callResults.trainingFixed}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-100 text-slate-800 px-3 py-1 rounded-xl border border-slate-200">
                        <span>📵 Pas de réponse :</span>
                        <strong className="font-mono text-xs">{callResults.noResponse}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 bg-amber-100 text-amber-800 px-3 py-1 rounded-xl border border-amber-200">
                        <span>🔁 À rappeler :</span>
                        <strong className="font-mono text-xs">{callResults.toRecall}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 bg-rose-100 text-rose-800 px-3 py-1 rounded-xl border border-rose-200">
                        <span>🚫 Pas intéressé :</span>
                        <strong className="font-mono text-xs">{callResults.notInterested}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 bg-red-100 text-red-800 px-3 py-1 rounded-xl border border-red-200">
                        <span>❌ Mauvais numéro :</span>
                        <strong className="font-mono text-xs">{callResults.wrongNumber}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 bg-purple-100 text-purple-800 px-3 py-1 rounded-xl border border-purple-200">
                        <span>🤝 Déjà client :</span>
                        <strong className="font-mono text-xs">{callResults.alreadyClient}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ══════════════════════════════════════════════════════════════
                  SECTION 2: ONBOARDING SPECIALIST TEAM (AYOUB GSAIB)
                 ══════════════════════════════════════════════════════════════ */}
              <div className="bg-white border-2 border-purple-200 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2.5 bg-purple-50 text-purple-800 rounded-2xl border border-purple-200">
                      🎓
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-gray-900">
                          Onboarding Specialist
                        </h3>
                        <span className="text-3xs px-2.5 py-0.5 bg-purple-100 text-purple-900 font-bold rounded-full">
                          Ayoub Gsaib
                        </span>
                      </div>
                      <p className="text-2xs text-gray-500 mt-0.5">
                        Formation chauffeurs · Précommandes & Contrats · Vélocité d&apos;attribution parc (&le; 1 jour)
                      </p>
                    </div>
                  </div>

                  {/* 1 000 MAD Monthly Bonus Card */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 p-3 rounded-2xl flex items-center gap-3 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-lg shadow-2xs">
                      💰
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-3xs font-black uppercase tracking-wider text-purple-700">Prime Mensuelle</span>
                        <span className="text-3xs px-1.5 py-0.2 bg-purple-200 text-purple-900 rounded font-bold">Option 2 (Prop. pur)</span>
                      </div>
                      <p className="text-sm font-black text-gray-900 font-mono">
                        {onboarding?.bonusEarnedMAD ?? 0} DH <span className="text-xs font-normal text-gray-500">/ 1 000 DH</span>
                      </p>
                      <p className="text-3xs text-gray-600 font-semibold">
                        Atteinte globale équipe : <strong>{onboarding?.teamAttainmentPct ?? 0}%</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Core Onboarding KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Attended Persons */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-3xs font-black uppercase tracking-wider text-purple-700">1. Présences en Formation</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-gray-900 font-mono">{onboarding?.attendedCount ?? 0}</span>
                      <span className="text-2xs text-gray-500 font-medium">Obj : {onboarding?.attendedTarget ?? 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-purple-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, onboarding?.attendedAttainmentPct ?? 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-3xs font-semibold">
                      <span className="text-gray-500">Tx de Présence :</span>
                      <strong className={onboarding?.showupRate && onboarding.showupRate >= 65 ? "text-emerald-700" : "text-amber-700"}>
                        {onboarding?.showupRate ?? 0}% (Cible 65%)
                      </strong>
                    </div>
                  </div>

                  {/* 2. Preorders & Vehicles Assigned */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-3xs font-black uppercase tracking-wider text-emerald-700">2. Précommandes & Affectations</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-gray-900 font-mono">{onboarding?.preordersAssignedTotal ?? 0}</span>
                      <span className="text-2xs text-gray-500 font-medium">Obj : {onboarding?.preordersTarget ?? 0}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, onboarding?.preordersAttainmentPct ?? 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-3xs font-semibold">
                      <span className="text-gray-500">Tx Conversion :</span>
                      <strong className={onboarding?.preorderAssignedRate && onboarding.preorderAssignedRate >= 25 ? "text-emerald-700" : "text-emerald-600"}>
                        {onboarding?.preorderAssignedRate ?? 0}% (Cible 25%)
                      </strong>
                    </div>
                  </div>

                  {/* 3. Preorder Breakdown */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p className="text-3xs font-black uppercase tracking-wider text-indigo-700">3. Détail Contrats Conclus</p>
                    <div className="flex items-center gap-3 pt-1">
                      <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-center flex-1">
                        <span className="text-lg font-black text-gray-900">{onboarding?.preordersCount ?? 0}</span>
                        <p className="text-3xs text-gray-500 font-semibold">Précommandes</p>
                      </div>
                      <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-center flex-1">
                        <span className="text-lg font-black text-emerald-700">{onboarding?.assignedCount ?? 0}</span>
                        <p className="text-3xs text-gray-500 font-semibold">Affectées</p>
                      </div>
                    </div>
                    <p className="text-3xs text-gray-500 text-center font-medium">
                      Encaissements : <strong>{kpis.trainingOnboarding.totalPreorderMAD.toLocaleString()} MAD</strong>
                    </p>
                  </div>

                  {/* 4. Fleet Velocity Speedometer (Available Cars <= 1 day) */}
                  <div className={`rounded-2xl p-4 space-y-2 border transition-all ${
                    (onboarding?.avgDaysCarAvailable ?? 1) <= 1.0
                      ? "bg-emerald-50/80 border-emerald-300"
                      : (onboarding?.avgDaysCarAvailable ?? 1) <= 1.5
                      ? "bg-amber-50/80 border-amber-300"
                      : "bg-rose-50/80 border-rose-300"
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className="text-3xs font-black uppercase tracking-wider text-gray-800">
                        4. Vélocité Disponibilité Parc
                      </p>
                      <span className={`text-3xs font-bold px-2 py-0.5 rounded-full ${
                        (onboarding?.avgDaysCarAvailable ?? 1) <= 1.0
                          ? "bg-emerald-200 text-emerald-900"
                          : "bg-amber-200 text-amber-900"
                      }`}>
                        {(onboarding?.avgDaysCarAvailable ?? 1) <= 1.0 ? "⚡ Excellent" : "⚠️ À surveiller"}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-gray-900 font-mono">
                        {onboarding?.avgDaysCarAvailable ?? 1.0} jour(s)
                      </span>
                      <span className="text-2xs font-bold text-gray-600">Cible : &le; 1.0 jour</span>
                    </div>

                    <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          (onboarding?.avgDaysCarAvailable ?? 1) <= 1.0 ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(20, (1.0 / Math.max(0.1, onboarding?.avgDaysCarAvailable ?? 1)) * 100))}%` }}
                      />
                    </div>
                    <p className="text-3xs text-gray-600 font-semibold">
                      Temps moyen d&apos;attente d&apos;une voiture en statut &quot;Available&quot;
                    </p>
                  </div>
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════════
                  SECTION 3: FLEET COLLECTIONS & FIELD OPS OVERVIEW
                 ══════════════════════════════════════════════════════════════ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Cash Collections & Support SLAs Card */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-3xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                        💸 Recouvrement & Support Flotte
                      </p>
                      <h3 className="text-2xl font-black text-gray-900 mt-1 font-mono">
                        {kpis.fleetCollections.collectionRecoveryRate}%{" "}
                        <span className="text-xs text-gray-500 font-normal">
                          / {kpis.fleetCollections.recoveryObjectivePct || 90}% Cible
                        </span>
                      </h3>
                      <p className="text-2xs text-gray-500 font-medium mt-0.5">
                        Encaissé : <strong>{kpis.fleetCollections.totalEveningCollectedMAD.toLocaleString()} MAD</strong>
                      </p>
                    </div>
                    <span className="text-2xl">💰</span>
                  </div>

                  <div className="space-y-1.5 pt-1 text-3xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Assurance (jours réparation) :</span>
                      <span className={kpis.fleetCollections.avgDaysInsuranceRepair <= (kpis.fleetCollections.maxDaysInsuranceRepair || 7) ? "text-emerald-700" : "text-red-700"}>
                        {kpis.fleetCollections.avgDaysInsuranceRepair} j (Max Obj : {kpis.fleetCollections.maxDaysInsuranceRepair || 7}j)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">AdBlue/Vidange (heures) :</span>
                      <span className={kpis.fleetCollections.avgHoursAdBlueVidange <= (kpis.fleetCollections.maxHoursAdBlueVidange || 5) ? "text-emerald-700" : "text-amber-700"}>
                        {kpis.fleetCollections.avgHoursAdBlueVidange} h (Max Obj : {kpis.fleetCollections.maxHoursAdBlueVidange || 5}h)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Taux de Churn hebdo :</span>
                      <span className={kpis.fleetCollections.weeklyChurnRate <= (kpis.fleetCollections.maxWeeklyChurnRate || 2) ? "text-emerald-600" : "text-red-600"}>
                        {kpis.fleetCollections.weeklyChurnRate}% (Max Obj : {kpis.fleetCollections.maxWeeklyChurnRate || 2}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Field Operations */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-3xs font-black uppercase tracking-wider text-green-800 bg-green-50 px-2 py-0.5 rounded-full inline-block">
                        🛡️ Opérations Terrain
                      </p>
                      <h3 className="text-2xl font-black text-gray-900 mt-1 font-mono">
                        {kpis.fieldOperations.tasksCompleted} / {kpis.fieldOperations.tasksTarget} Tâches
                      </h3>
                      <p className="text-2xs text-gray-500 font-medium mt-0.5">
                        Taux de réalisation : <strong>{kpis.fieldOperations.taskCompletionRate}%</strong>
                      </p>
                    </div>
                    <span className="text-2xl">⚡</span>
                  </div>

                  <div className="space-y-1.5 pt-1 text-3xs font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Temps récupération véhicule :</span>
                      <span className="text-green-800">{kpis.fieldOperations.avgHoursVehicleRecovery} h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Contrôles Mensuels (Checks) :</span>
                      <span className="text-green-800">
                        {kpis.fieldOperations.monthlyChecksCount} / {kpis.fieldOperations.monthlyChecksTarget || 30} réalisés
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Score Santé Moyen Flotte :</span>
                      <span className="text-gray-900">⭐ {kpis.fieldOperations.avgHealthScore} / 5.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "leaderboard" && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                    <span>🏆</span>
                    <span>Classement des Équipes & Matrice des Primes (1 000 DH)</span>
                  </h3>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    Attribution collective par équipe · Option 2 : Paiement Proportionnel pur de la prime mensuelle.
                  </p>
                </div>
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-3xs font-bold text-amber-900">
                  💰 Enveloppe Max : 1 000 DH / collaborateur
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-3xs font-black text-gray-500 uppercase tracking-wider bg-gray-50/80">
                      <th className="py-3 px-4">Rang</th>
                      <th className="py-3 px-4">Collaborateur</th>
                      <th className="py-3 px-4">Équipe / Pôle</th>
                      <th className="py-3 px-4">Métrique Clé</th>
                      <th className="py-3 px-4">Réalisé</th>
                      <th className="py-3 px-4">Objectif</th>
                      <th className="py-3 px-4">Atteinte Équipe</th>
                      <th className="py-3 px-4">Prime Mensuelle</th>
                      <th className="py-3 px-4">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLeaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-gray-400 font-medium">
                          Aucun collaborateur trouvé pour les filtres sélectionnés.
                        </td>
                      </tr>
                    ) : (
                      filteredLeaderboard.map((user, idx) => (
                        <tr key={user.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3 px-4 font-black">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-gray-900">{user.name}</p>
                            <p className="text-3xs text-gray-500">{user.email}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                              {user.teamName || user.department}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-700">
                            {user.keyMetric}
                          </td>
                          <td className="py-3 px-4 font-bold text-navy font-mono">
                            {typeof user.actual === "number" ? user.actual.toLocaleString() : user.actual} {user.unit}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-500 font-mono">
                            {typeof user.target === "number" ? user.target.toLocaleString() : user.target} {user.unit}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-gray-900 font-mono">{user.attainmentPct}%</span>
                              <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    user.attainmentPct >= 100
                                      ? "bg-emerald-500"
                                      : user.attainmentPct >= 80
                                      ? "bg-blue-600"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${Math.min(100, user.attainmentPct)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-xl font-bold font-mono text-xs">
                              <span>💰</span>
                              <span>{user.bonusEarnedMAD ?? 0} DH</span>
                              <span className="text-3xs text-gray-500 font-normal">/ 1 000</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider ${
                                user.status === "EXCEEDED"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : user.status === "ON_TRACK"
                                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                                  : "bg-amber-100 text-amber-800 border border-amber-300"
                              }`}
                            >
                              {user.status === "EXCEEDED"
                                ? "🌟 Dépassé"
                                : user.status === "ON_TRACK"
                                ? "✓ Sur Cible"
                                : "⚠️ En Cours"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "trends" && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                    <span>📈</span>
                    <span>Vélocité Journalière & Historique d&apos;Activité</span>
                  </h3>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    Évolution quotidienne des métriques clés sur la période sélectionnée.
                  </p>
                </div>
              </div>

              {/* Daily Bar Matrix */}
              <div className="space-y-4">
                {(data?.dailyTimeline || []).map((day) => (
                  <div key={day.date} className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-900 font-mono">📅 {day.date}</span>
                      <div className="flex items-center gap-4 text-2xs font-semibold">
                        <span className="text-blue-700">📞 {day.calls} Appels</span>
                        <span className="text-teal-700">🎓 {day.trainings} Formations</span>
                        <span className="text-emerald-700 font-bold">💰 {day.collectedMAD.toLocaleString()} MAD</span>
                        <span className="text-green-700">🛡️ {day.tasksDone} Tâches</span>
                      </div>
                    </div>
                    {/* Visual mini bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-blue-500 h-full" style={{ width: `${Math.min(30, (day.calls / 60) * 30)}%` }} title="Appels" />
                      <div className="bg-teal-500 h-full" style={{ width: `${Math.min(30, (day.trainings / 15) * 30)}%` }} title="Formations" />
                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(40, (day.collectedMAD / 5000) * 40)}%` }} title="Collections" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
