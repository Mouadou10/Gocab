"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

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
    conversionPerAttendedRate?: number;
    targetConversionPerAttendedRate?: number;
    avgDaysCarAvailable: number;
    targetAvgDaysCarAvailable: number;
    velocityScorePct: number;
    teamAttainmentPct: number;
    monthlyBonusBudgetMAD: number;
    bonusEarnedMAD: number;
    members: string[];
    trainingSessions?: {
      date: string;
      convokedCount: number;
      scheduledCount?: number;
      attendedCount: number;
      preordersCount: number;
      assignedCount: number;
      preordersAssignedTotal: number;
      conversionPerAttendedPct: number;
      targetConversionPct: number;
      isCompliant: boolean;
    }[];
    compliantSessionsCount?: number;
    totalActiveSessionsCount?: number;
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

  // ── Chart 1 Data: Call Distribution Donut ────────────────────────
  const callDistributionData = useMemo(() => {
    if (!callResults || callResults.total === 0) return [];
    return [
      { name: "Formations Fixées", value: callResults.trainingFixed, color: "#10b981", icon: "✅" },
      { name: "Pas de réponse", value: callResults.noResponse, color: "#94a3b8", icon: "📵" },
      { name: "À rappeler", value: callResults.toRecall, color: "#f59e0b", icon: "🔁" },
      { name: "Pas intéressé", value: callResults.notInterested, color: "#f43f5e", icon: "🚫" },
      { name: "Mauvais numéro", value: callResults.wrongNumber, color: "#ef4444", icon: "❌" },
      { name: "Déjà client", value: callResults.alreadyClient, color: "#8b5cf6", icon: "🤝" },
    ].filter((item) => item.value > 0);
  }, [callResults]);

  // ── Chart 2 Data: Acquisition Pipeline Funnel ────────────────────
  const trafficFunnelData = useMemo(() => {
    if (!traffic) return [];
    const calls = traffic.callsDone || 0;
    const fixed = traffic.trainingFixed || 0;
    const attended = traffic.attendedPersons || 0;
    const preorders = traffic.preordersAssigned || 0;

    return [
      {
        stage: "1. Appels Réalisés",
        count: calls,
        rate: 100,
        targetRate: 100,
        fill: "#2563eb",
        badge: "Base prospection",
      },
      {
        stage: "2. Formations Fixées",
        count: fixed,
        rate: calls > 0 ? Number(((fixed / calls) * 100).toFixed(1)) : 0,
        targetRate: 30,
        fill: "#10b981",
        badge: "Cible : 30%",
      },
      {
        stage: "3. Présents Formation",
        count: attended,
        rate: fixed > 0 ? Number(((attended / fixed) * 100).toFixed(1)) : 0,
        targetRate: 65,
        fill: "#0d9488",
        badge: "Cible : 65%",
      },
      {
        stage: "4. Précommandes & Voitures",
        count: preorders,
        rate: fixed > 0 ? Number(((preorders / fixed) * 100).toFixed(1)) : 0,
        targetRate: 25,
        fill: "#7c3aed",
        badge: "Cible : 25%",
      },
    ];
  }, [traffic]);

  // ── Chart 3 Data: Onboarding Actual vs Target Comparison ─────────
  const onboardingComparisonData = useMemo(() => {
    if (!onboarding) return [];
    return [
      {
        name: "Présences Formation",
        Réalisé: onboarding.attendedCount,
        Objectif: onboarding.attendedTarget,
        attainment: onboarding.attendedAttainmentPct,
      },
      {
        name: "Précommandes / Affectées",
        Réalisé: onboarding.preordersAssignedTotal,
        Objectif: onboarding.preordersTarget,
        attainment: onboarding.preordersAttainmentPct,
      },
    ];
  }, [onboarding]);

  // ── Chart 4 Data: Onboarding Contracts Breakdown ─────────────────
  const onboardingContractsData = useMemo(() => {
    if (!onboarding) return [];
    return [
      { name: "Précommandes", value: onboarding.preordersCount, color: "#7c3aed" },
      { name: "Véhicules Affectés", value: onboarding.assignedCount, color: "#10b981" },
    ].filter((i) => i.value > 0);
  }, [onboarding]);

  // ── Chart 5 Data: Daily Activity Trends ──────────────────────────
  const timelineData = useMemo(() => {
    return (data?.dailyTimeline || []).map((d) => ({
      ...d,
      shortDate: d.date.length > 5 ? d.date.slice(5) : d.date,
    }));
  }, [data?.dailyTimeline]);

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

                {/* ── Visual Analytics Grid: Donut + Funnel ──────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                  {/* Left: Call Outcome Donut Chart */}
                  <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-lg bg-blue-100 text-blue-700 text-xs">📊</span>
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">
                          Répartition des Appels
                        </h4>
                      </div>
                      <span className="text-3xs font-extrabold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded-full">
                        {callResults?.total || 0} traités
                      </span>
                    </div>

                    {/* Donut Chart with Centered Metric */}
                    <div className="relative h-56 w-full flex items-center justify-center">
                      {callDistributionData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const d = payload[0];
                                    const total = callResults?.total || 1;
                                    const pct = (((Number(d.value) || 0) / total) * 100).toFixed(1);
                                    return (
                                      <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-700">
                                        <p className="font-bold flex items-center gap-1.5">
                                          <span>{d.payload.icon}</span>
                                          <span>{d.name}</span>
                                        </p>
                                        <p className="text-emerald-400 font-mono font-black text-sm mt-0.5">
                                          {d.value} appels ({pct}%)
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Pie
                                data={callDistributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={82}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {callDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Centered Donut Label */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xl font-black text-gray-900 font-mono leading-none">
                              {callResults?.trainingFixed || 0}
                            </span>
                            <span className="text-3xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                              Fixées ({traffic?.trainingFixedRate ?? 0}%)
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 font-semibold">Aucun appel dans cette période.</p>
                      )}
                    </div>

                    {/* Compact Interactive Chips Legend */}
                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-200/60 text-3xs font-semibold">
                      {callDistributionData.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between px-2 py-1 rounded-lg bg-white border border-slate-200/70"
                        >
                          <span className="flex items-center gap-1 truncate text-gray-700">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.name}</span>
                          </span>
                          <strong className="font-mono text-gray-900 ml-1">{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: End-to-End Pipeline Funnel Chart */}
                  <div className="lg:col-span-7 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs">🎯</span>
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">
                          Entonnoir de Conversion Prospection &rarr; Formation
                        </h4>
                      </div>
                      <span className="text-3xs font-extrabold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        Fin d&apos;entonnoir : {traffic?.preorderAssignedRate ?? 0}%
                      </span>
                    </div>

                    {/* Horizontal Stepped Funnel */}
                    <div className="h-56 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={trafficFunnelData}
                          margin={{ top: 5, right: 35, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="stage"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fontWeight: 700, fill: "#1e293b" }}
                            width={130}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-700">
                                    <p className="font-bold text-slate-200">{d.stage}</p>
                                    <p className="text-emerald-400 font-mono font-black text-sm mt-0.5">
                                      {d.count} candidats ({d.rate}%)
                                    </p>
                                    <p className="text-3xs text-slate-400 mt-1">{d.badge}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                            {trafficFunnelData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Step-by-Step Conversion Badges */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center">
                      <div className="p-2 bg-white rounded-xl border border-slate-200/70">
                        <p className="text-3xs text-gray-500 font-bold uppercase">1. Tx Fixées / Appels</p>
                        <p className={`text-xs font-black font-mono mt-0.5 ${
                          (traffic?.trainingFixedRate ?? 0) >= 30 ? "text-emerald-600" : "text-amber-600"
                        }`}>
                          {traffic?.trainingFixedRate ?? 0}% <span className="text-3xs text-gray-400 font-normal">/ 30%</span>
                        </p>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-slate-200/70">
                        <p className="text-3xs text-gray-500 font-bold uppercase">2. Tx Présence Salle</p>
                        <p className={`text-xs font-black font-mono mt-0.5 ${
                          (traffic?.attendedRate ?? 0) >= 65 ? "text-emerald-600" : "text-teal-600"
                        }`}>
                          {traffic?.attendedRate ?? 0}% <span className="text-3xs text-gray-400 font-normal">/ 65%</span>
                        </p>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-slate-200/70">
                        <p className="text-3xs text-gray-500 font-bold uppercase">3. Tx Précommandes</p>
                        <p className={`text-xs font-black font-mono mt-0.5 ${
                          (traffic?.preorderAssignedRate ?? 0) >= 25 ? "text-emerald-600" : "text-purple-600"
                        }`}>
                          {traffic?.preorderAssignedRate ?? 0}% <span className="text-3xs text-gray-400 font-normal">/ 25%</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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
                    <div className="space-y-1 pt-0.5">
                      <div className="flex justify-between text-3xs font-semibold">
                        <span className="text-gray-500">Tx Conv. / Inscrits :</span>
                        <strong className={onboarding?.preorderAssignedRate && onboarding.preorderAssignedRate >= 25 ? "text-emerald-700" : "text-emerald-600"}>
                          {onboarding?.preorderAssignedRate ?? 0}% <span className="text-3xs text-gray-400 font-normal">/ 25%</span>
                        </strong>
                      </div>
                      <div className="flex justify-between items-center text-3xs font-semibold bg-white px-2 py-1 rounded-lg border border-slate-200">
                        <span className="text-purple-800 font-bold">Tx Conv. / Présents :</span>
                        <span className={`px-1.5 py-0.5 rounded font-black font-mono text-3xs ${
                          (onboarding?.conversionPerAttendedRate ?? 0) >= 20
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}>
                          {onboarding?.conversionPerAttendedRate ?? 0}% {(onboarding?.conversionPerAttendedRate ?? 0) >= 20 ? "✓" : "⚠️"} (Cible &gt; 20%)
                        </span>
                      </div>
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

                {/* Visual Analytics Panel for Onboarding Specialist (Ayoub Gsaib) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-3 border-t border-purple-100">
                  {/* Left: Grouped Bar Chart (Réalisé vs Objectif) */}
                  <div className="lg:col-span-7 bg-purple-50/30 border border-purple-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-purple-200/60 pb-2.5 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-lg bg-purple-100 text-purple-700 text-xs">📊</span>
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">
                          Comparatif Performance : Réalisé vs Objectif Cible
                        </h4>
                      </div>
                      <span className="text-3xs font-extrabold text-purple-800 bg-purple-100/70 px-2 py-0.5 rounded-full">
                        Score global : {onboarding?.teamAttainmentPct ?? 0}%
                      </span>
                    </div>

                    {/* Grouped Bar Chart */}
                    <div className="h-56 w-full pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={onboardingComparisonData}
                          margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fontWeight: 700, fill: "#1e293b" }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: "#64748b" }}
                            allowDecimals={false}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                  <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-700">
                                    <p className="font-bold text-slate-200">{d.name}</p>
                                    <div className="flex items-center justify-between gap-4 mt-1.5 font-mono">
                                      <span className="text-purple-300">Réalisé : <strong>{d.Réalisé}</strong></span>
                                      <span className="text-slate-400">Obj : <strong>{d.Objectif}</strong></span>
                                    </div>
                                    <p className="text-3xs text-emerald-400 font-bold mt-1">
                                      Taux d&apos;atteinte : {d.attainment}%
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="Réalisé" fill="#9333ea" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="Objectif" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Chart Legend & Metric Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-200/60 text-3xs font-semibold">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-purple-600 inline-block" />
                          <span className="text-gray-700">Réalisé</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" />
                          <span className="text-gray-500">Objectif (Cible)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Présences :</span>
                        <strong className="text-purple-700">{onboarding?.attendedAttainmentPct ?? 0}%</strong>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">Contrats :</span>
                        <strong className="text-emerald-700">{onboarding?.preordersAttainmentPct ?? 0}%</strong>
                      </div>
                    </div>
                  </div>

                  {/* Right: Contrats Conclus Donut & Répartition */}
                  <div className="lg:col-span-5 bg-purple-50/30 border border-purple-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-purple-200/60 pb-2.5 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1 rounded-lg bg-pink-100 text-pink-700 text-xs">📝</span>
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">
                          Mix Contrats & Affectations
                        </h4>
                      </div>
                      <span className="text-3xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        {onboarding?.preordersAssignedTotal ?? 0} au total
                      </span>
                    </div>

                    {/* Donut Chart */}
                    <div className="h-44 w-full relative flex items-center justify-center">
                      {onboardingContractsData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={onboardingContractsData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={42}
                                outerRadius={68}
                                paddingAngle={4}
                                stroke="none"
                              >
                                {onboardingContractsData.map((entry, index) => (
                                  <Cell key={`cell-onboarding-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    const total = onboarding?.preordersAssignedTotal || 1;
                                    const pct = ((d.value / total) * 100).toFixed(1);
                                    return (
                                      <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs shadow-xl border border-slate-700">
                                        <p className="font-bold text-slate-200">{d.name}</p>
                                        <p className="text-pink-300 font-mono font-black mt-0.5">
                                          {d.value} ({pct}%)
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Centered Counter */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xl font-black text-gray-900 font-mono">
                              {onboarding?.preordersAssignedTotal ?? 0}
                            </span>
                            <span className="text-3xs font-bold uppercase tracking-wider text-purple-700">
                              Contrats
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center text-gray-400 py-8">
                          <span className="text-2xl mb-1">📋</span>
                          <p className="text-xs font-semibold">Aucun contrat signé sur la période</p>
                        </div>
                      )}
                    </div>

                    {/* Breakdown Badges */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-200/60">
                      <div className="p-2 bg-white rounded-xl border border-purple-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                          <span className="text-3xs font-bold text-gray-600">Précommandes</span>
                        </div>
                        <span className="text-xs font-black text-purple-700 font-mono">
                          {onboarding?.preordersCount ?? 0}
                        </span>
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-purple-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                          <span className="text-3xs font-bold text-gray-600">Affectées</span>
                        </div>
                        <span className="text-xs font-black text-emerald-700 font-mono">
                          {onboarding?.assignedCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Training Sessions Compliance Breakdown (> 20% Target) ── */}
                <div className="bg-gradient-to-r from-purple-50/70 via-white to-emerald-50/50 border border-purple-200/80 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 bg-purple-100 text-purple-700 rounded-xl text-base">
                        🎯
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">
                            Rendement par Session de Formation
                          </h4>
                          <span className="text-3xs px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-full">
                            Règle : &gt; 20% de transformation / présents
                          </span>
                        </div>
                        <p className="text-3xs text-gray-500 mt-0.5">
                          Chaque session animée par Ayoub doit convertir au minimum 20% des candidats présents en précommande ou véhicule.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="bg-white px-3 py-1.5 rounded-xl border border-purple-200 shadow-2xs text-center">
                        <span className="text-3xs text-gray-500 font-bold block uppercase">Conformité Sessions</span>
                        <span className="text-xs font-black text-purple-900 font-mono">
                          {onboarding?.compliantSessionsCount ?? 0} / {onboarding?.totalActiveSessionsCount ?? 0} conformes
                        </span>
                      </div>
                      <div className="bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs text-center">
                        <span className="text-3xs text-gray-500 font-bold block uppercase">Moyenne Période</span>
                        <span className={`text-xs font-black font-mono ${
                          (onboarding?.conversionPerAttendedRate ?? 0) >= 20 ? "text-emerald-700" : "text-rose-600"
                        }`}>
                          {onboarding?.conversionPerAttendedRate ?? 0}% {(onboarding?.conversionPerAttendedRate ?? 0) >= 20 ? "✅" : "⚠️"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sessions Grid / Table */}
                  {onboarding?.trainingSessions && onboarding.trainingSessions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-purple-100 text-3xs font-black uppercase tracking-wider text-gray-500">
                            <th className="pb-2 pl-2">Session (Date)</th>
                            <th className="pb-2 text-center" title="Total des candidats programmés pour cette session">Convoqués Total</th>
                            <th className="pb-2 text-center" title="Nombre de candidats actuellement en colonne Training Fixed (Scheduled)">En Attente (Scheduled)</th>
                            <th className="pb-2 text-center">Présents (Salle)</th>
                            <th className="pb-2 text-center">Précommandes</th>
                            <th className="pb-2 text-center">Affectées</th>
                            <th className="pb-2 text-center">Total Signés</th>
                            <th className="pb-2 text-center">Taux / Présents</th>
                            <th className="pb-2 text-right pr-2">Conformité (&gt; 20%)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50 font-medium">
                          {onboarding.trainingSessions.map((session, idx) => (
                            <tr key={`session-${session.date}-${idx}`} className="hover:bg-purple-50/40 transition-colors">
                              <td className="py-2.5 pl-2 font-bold font-mono text-gray-900 flex items-center gap-1.5">
                                <span>📅</span>
                                <span>{session.date}</span>
                              </td>
                              <td className="py-2.5 text-center font-bold text-gray-800 font-mono">{session.convokedCount}</td>
                              <td className="py-2.5 text-center font-mono">
                                <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-3xs">
                                  ⏳ {session.scheduledCount ?? 0}
                                </span>
                              </td>
                              <td className="py-2.5 text-center font-bold text-purple-700 font-mono">{session.attendedCount}</td>
                              <td className="py-2.5 text-center text-purple-600 font-mono">{session.preordersCount}</td>
                              <td className="py-2.5 text-center text-emerald-600 font-mono">{session.assignedCount}</td>
                              <td className="py-2.5 text-center font-black text-gray-900 font-mono">{session.preordersAssignedTotal}</td>
                              <td className="py-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-md font-black font-mono text-xs ${
                                  session.conversionPerAttendedPct >= 20
                                    ? "bg-emerald-100 text-emerald-800"
                                    : session.attendedCount === 0
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-rose-100 text-rose-700"
                                }`}>
                                  {session.conversionPerAttendedPct}%
                                </span>
                              </td>
                              <td className="py-2.5 text-right pr-2">
                                {session.attendedCount === 0 ? (
                                  <span className="text-3xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-bold">
                                    Non tenue
                                  </span>
                                ) : session.isCompliant ? (
                                  <span className="text-3xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-black border border-emerald-300">
                                    ✅ Conforme (&gt; 20%)
                                  </span>
                                ) : (
                                  <span className="text-3xs px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-black border border-rose-300">
                                    ⚠️ Sous objectif (&le; 20%)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-xs font-semibold">Aucune session enregistrée sur la période sélectionnée</p>
                    </div>
                  )}

                  <p className="text-3xs text-gray-500 pt-2 border-t border-purple-100 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>
                      <strong>Rapprochement Pipeline :</strong> La colonne <em>« En Attente (Scheduled) »</em> correspond directement au compteur de la colonne <em>Training Fixed (Scheduled)</em> de la page Formation pour cette date de session.
                    </span>
                  </p>
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
            <div className="space-y-6">
              {/* Header & Quick Summary */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                      <span>📈</span>
                      <span>Vélocité Journalière & Historique d&apos;Activité</span>
                    </h3>
                    <p className="text-2xs text-gray-500 mt-0.5">
                      Évolution chronologique des appels, formations, encaissements et interventions terrain.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-3xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                      📞 {traffic?.callsDone ?? 0} Appels
                    </span>
                    <span className="text-3xs font-bold px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg">
                      🎓 {traffic?.trainingFixed ?? 0} Formations
                    </span>
                    <span className="text-3xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-mono">
                      💰 {(kpis?.fleetCollections.totalEveningCollectedMAD ?? 0).toLocaleString()} MAD
                    </span>
                    <span className="text-3xs font-bold px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg">
                      🛡️ {kpis?.fieldOperations.tasksCompleted ?? 0} Tâches
                    </span>
                  </div>
                </div>

                {timelineData.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
                    {/* Chart 1: Volume d'Activité Multi-Séries (AreaChart) */}
                    <div className="lg:col-span-7 bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-blue-100 text-blue-700 text-xs">📊</span>
                          <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">
                            Volume Quotidien : Prospection & Terrain
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 text-3xs font-bold">
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                            <span className="text-blue-900">Appels</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                            <span className="text-teal-900">Formations</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />
                            <span className="text-green-900">Tâches</span>
                          </div>
                        </div>
                      </div>

                      <div className="h-64 w-full pt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={timelineData}
                            margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                              </linearGradient>
                              <linearGradient id="trainGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                              </linearGradient>
                              <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                              dataKey="shortDate"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fontWeight: 700, fill: "#475569" }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#64748b" }}
                              allowDecimals={false}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-700 space-y-1">
                                      <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 font-mono">
                                        📅 {d.date}
                                      </p>
                                      <div className="flex items-center justify-between gap-4 text-blue-300">
                                        <span>📞 Appels :</span>
                                        <strong>{d.calls}</strong>
                                      </div>
                                      <div className="flex items-center justify-between gap-4 text-teal-300">
                                        <span>🎓 Formations :</span>
                                        <strong>{d.trainings}</strong>
                                      </div>
                                      <div className="flex items-center justify-between gap-4 text-green-300">
                                        <span>🛡️ Tâches :</span>
                                        <strong>{d.tasksDone}</strong>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="calls"
                              stroke="#2563eb"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#callGradient)"
                            />
                            <Area
                              type="monotone"
                              dataKey="trainings"
                              stroke="#0d9488"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#trainGradient)"
                            />
                            <Area
                              type="monotone"
                              dataKey="tasksDone"
                              stroke="#16a34a"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#taskGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Chart 2: Cash Recouvrement Quotidien (BarChart) */}
                    <div className="lg:col-span-5 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs">💰</span>
                          <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">
                            Encaissements Flotte (MAD)
                          </h4>
                        </div>
                        <span className="text-3xs font-extrabold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                          {kpis.fleetCollections.totalEveningCollectedMAD.toLocaleString()} DH
                        </span>
                      </div>

                      <div className="h-64 w-full pt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={timelineData}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1fae5" />
                            <XAxis
                              dataKey="shortDate"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fontWeight: 700, fill: "#065f46" }}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#047857" }}
                              tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-700 font-mono">
                                      <p className="font-bold text-slate-200 border-b border-slate-700 pb-1">
                                        📅 {d.date}
                                      </p>
                                      <p className="text-emerald-400 font-black text-sm mt-1">
                                        {d.collectedMAD.toLocaleString()} MAD
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="collectedMAD" fill="#059669" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-400">
                    <span className="text-3xl mb-2 inline-block">📅</span>
                    <p className="text-xs font-semibold">Aucune donnée d&apos;activité journalière sur cette plage</p>
                  </div>
                )}
              </div>

              {/* Day-by-Day Historical Breakdown Cards */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <span>📋</span>
                  <span>Détail Journalier Consolidé</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(data?.dailyTimeline || []).map((day) => (
                    <div
                      key={day.date}
                      className="p-3.5 bg-gray-50/80 border border-gray-200/80 rounded-xl space-y-2 hover:bg-white hover:shadow-xs transition-all"
                    >
                      <div className="flex justify-between items-center border-b border-gray-200/60 pb-2">
                        <span className="font-bold text-gray-900 font-mono text-xs">📅 {day.date}</span>
                        <span className="text-3xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                          {day.collectedMAD.toLocaleString()} DH
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center text-3xs">
                        <div className="bg-white p-1.5 rounded-lg border border-gray-200/70">
                          <p className="text-gray-500 font-semibold">Appels</p>
                          <p className="font-black text-blue-700 text-xs font-mono">{day.calls}</p>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-gray-200/70">
                          <p className="text-gray-500 font-semibold">Formations</p>
                          <p className="font-black text-teal-700 text-xs font-mono">{day.trainings}</p>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-gray-200/70">
                          <p className="text-gray-500 font-semibold">Tâches</p>
                          <p className="font-black text-green-700 text-xs font-mono">{day.tasksDone}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
