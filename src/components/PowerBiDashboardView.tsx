"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";

interface PerformanceData {
  period: {
    startDate: string;
    endDate: string;
    dayCount: number;
  };
  targets: {
    target_daily_calls: number;
    target_daily_training_fixed: number;
    target_daily_preorders: number;
    target_collection_rate: number;
    target_daily_tasks: number;
    target_fleet_uptime: number;
    target_ticket_resolution_rate: number;
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
    };
    trainingOnboarding: {
      attendanceRate: number;
      assignedVehiclesCount: number;
      preordersCount: number;
      preordersTarget: number;
      preordersAttainmentPct: number;
      totalPreorderMAD: number;
    };
    fleetCollections: {
      totalMorningTargetMAD: number;
      totalEveningCollectedMAD: number;
      collectionRecoveryRate: number;
      recoveryObjectivePct: number;
      collectionAttainmentPct: number;
      isObjectiveMet: boolean;
      avgDaysInsuranceRepair: number;
      avgHoursAdBlueVidange: number;
      weeklyChurnRate: number;
    };
    fieldOperations: {
      avgHoursVehicleRecovery: number;
      monthlyChecksCount: number;
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
    keyMetric: string;
    actual: number;
    target: number;
    unit: string;
    attainmentPct: number;
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
  { id: "month", label: "Ce Mois", days: 30 },
  { id: "30d", label: "30 Derniers Jours", days: 30 },
  { id: "custom", label: "Personnalisé 📅", days: -1 },
];

const DEPARTMENTS = [
  { id: "ALL", label: "Tous les Départements" },
  { id: "LEAD_ACQUISITION_JR", label: "📞 Acquisition Prospects" },
  { id: "TRAINING", label: "🎓 Formation & Onboarding" },
  { id: "FLEET_PERF_MANAGER", label: "💰 Recouvrement & Flotte" },
  { id: "FIELD_SUPERVISOR", label: "🛡️ Opérations Terrain" },
  { id: "GARAGE", label: "🔧 Maintenance & Garage" },
];

const CITIES = ["ALL", "Casablanca", "Rabat", "Marrakech", "Tangier", "Agadir", "Fez"];

export default function PowerBiDashboardView() {
  const { t } = useLanguage();

  // Filter States (PowerBI Slicers)
  const [selectedPreset, setSelectedPreset] = useState("7d");
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

  // Fetch KPI Performance Data
  const fetchPerformanceData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (selectedUser !== "ALL") params.set("userId", selectedUser);
      if (selectedDept !== "ALL") params.set("role", selectedDept);
      if (selectedCity !== "ALL") params.set("hubCity", selectedCity);

      const res = await fetch(`/api/kpis/performance?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch performance KPIs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedUser, selectedDept, selectedCity]);

  useEffect(() => {
    if (startDate && endDate) {
      fetchPerformanceData();
    }
  }, [fetchPerformanceData, startDate, endDate]);

  const kpis = data?.kpis;

  // Filter leaderboard based on selection
  const filteredLeaderboard = (data?.leaderboard || []).filter((item) => {
    if (selectedUser !== "ALL" && item.id !== selectedUser) return false;
    if (selectedDept !== "ALL" && item.role !== selectedDept) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12 animate-fadeIn text-gray-900">
      {/* ── Top Bar / Header ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-navy via-navy/95 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-2 bg-white/10 rounded-xl backdrop-blur-md">📊</span>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <span>GoCab Command Analytics</span>
                  <span className="text-3xs uppercase tracking-widest font-black bg-gold/20 text-gold border border-gold/40 px-2.5 py-0.5 rounded-full">
                    PowerBI View
                  </span>
                </h1>
                <p className="text-xs text-white/70 mt-0.5">
                  Suivi des KPIs individuels, atteinte des objectifs opérationnels & pacing en temps réel.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Banner */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchPerformanceData()}
              disabled={isLoading}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold border border-white/15 backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span className={`inline-block ${isLoading ? "animate-spin" : ""}`}>🔄</span>
              <span>{isLoading ? "Actualisation..." : "Rafraîchir"}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gold hover:bg-gold/90 active:scale-95 text-navy font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>📥</span>
              <span>Imprimer / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── PowerBI Slicer Bar (Interactive Filters) ────────────────── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-black text-navy uppercase tracking-wider">
            <span>🎛️</span>
            <span>Filtres & Slicers Interactifs</span>
          </div>
          <span className="text-2xs font-semibold text-gray-500">
            Période analysée : <strong>{data?.period.dayCount || 1} jour(s)</strong> ({startDate} ➔ {endDate})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Slicer: Preset Date Buttons */}
          <div className="space-y-1.5 lg:col-span-2">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              Période Rapide (Date Range Preset)
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

          {/* Slicer: Custom Date From */}
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

          {/* Slicer: Custom Date To */}
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

          {/* Slicer: Person / User */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              👤 Collaborateur (Person)
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-navy/30 focus:border-navy outline-none"
            >
              <option value="ALL">👥 Toute l&apos;Équipe (All Members)</option>
              {(data?.users || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Slicer: Department */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-bold text-gray-600 uppercase tracking-wide">
              🏢 Département (Role)
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

          {/* Slicer: City */}
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
                  {city === "ALL" ? "Toutes les Villes (Morocco)" : city}
                </option>
              ))}
            </select>
          </div>

          {/* Slicer: Reset Action */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedPreset("7d");
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
          <span>Tableau de Bord & Pacing KPIs</span>
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
          <span>Classement Équipe ({filteredLeaderboard.length})</span>
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
          <p className="text-xs font-bold text-gray-500">Calcul des KPIs et agrégation des performances...</p>
        </div>
      ) : kpis ? (
        <>
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* ── 4 Major Executive KPI Tiles ─────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Lead Acquisition Card */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-3xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                        📞 Acquisition Prospects
                      </p>
                      <h3 className="text-2xl font-black text-gray-900 mt-1">
                        {kpis.leadAcquisition.callsDone}{" "}
                        <span className="text-xs text-gray-500 font-normal">/ {kpis.leadAcquisition.callsTarget} Appels Obj.</span>
                      </h3>
                      <p className="text-2xs text-gray-500 font-medium mt-0.5">
                        {kpis.leadAcquisition.trainingFixed} Formations fixées par jour
                      </p>
                    </div>
                    <span className="text-2xl">🎯</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-3xs font-bold">
                      <span className="text-gray-600">Atteinte Objectif Appels :</span>
                      <span className={kpis.leadAcquisition.callsAttainmentPct >= 100 ? "text-emerald-700" : "text-blue-700"}>
                        {kpis.leadAcquisition.callsAttainmentPct}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          kpis.leadAcquisition.callsAttainmentPct >= 100
                            ? "bg-emerald-500"
                            : kpis.leadAcquisition.callsAttainmentPct >= 80
                            ? "bg-blue-600"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${Math.min(100, kpis.leadAcquisition.callsAttainmentPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-3xs pt-2 border-t border-gray-100 font-medium text-gray-500">
                    <span>Personnes Présentes :</span>
                    <strong className="text-gray-900">{kpis.leadAcquisition.attendedPersons} présences</strong>
                  </div>
                </div>

                {/* 2. Training & Preorders Card */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-3xs font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full inline-block">
                        🎓 Onboarding
                      </p>
                      <h3 className="text-2xl font-black text-gray-900 mt-1">
                        {kpis.trainingOnboarding.attendanceRate}%
                      </h3>
                      <p className="text-2xs text-gray-500 font-medium mt-0.5">
                        Taux de présence (Attended / Fixed)
                      </p>
                    </div>
                    <span className="text-2xl">🚗</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-3xs font-bold">
                      <span className="text-gray-600">Objectif Précommandes :</span>
                      <span className={kpis.trainingOnboarding.preordersAttainmentPct >= 100 ? "text-emerald-700" : "text-purple-700"}>
                        {kpis.trainingOnboarding.preordersCount} / {kpis.trainingOnboarding.preordersTarget}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          kpis.trainingOnboarding.preordersAttainmentPct >= 100
                            ? "bg-emerald-500"
                            : "bg-purple-600"
                        }`}
                        style={{ width: `${Math.min(100, kpis.trainingOnboarding.preordersAttainmentPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-3xs pt-2 border-t border-gray-100 font-medium text-gray-500">
                    <span>Véhicules affectés :</span>
                    <strong className="text-emerald-700 font-bold">{kpis.trainingOnboarding.assignedVehiclesCount} affectations</strong>
                  </div>
                </div>

                {/* 3. Cash Collections & Support SLAs Card */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-3xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                        💸 Support & Driver Perf
                      </p>
                      <h3 className="text-2xl font-black text-gray-900 mt-1">
                        {kpis.fleetCollections.collectionRecoveryRate}%
                      </h3>
                      <p className="text-2xs text-gray-500 font-medium mt-0.5">
                        Cash Recouvrement (Cible: 60%)
                      </p>
                    </div>
                    <span className="text-2xl">🔧</span>
                  </div>

                  {/* 60% Objective Visual Progress */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-3xs font-bold">
                      <span className="text-gray-600">Assurance (jours) :</span>
                      <span className={kpis.fleetCollections.avgDaysInsuranceRepair <= 5 ? "text-emerald-700 font-black" : "text-red-700"}>
                        {kpis.fleetCollections.avgDaysInsuranceRepair} j
                      </span>
                    </div>
                    <div className="flex justify-between text-3xs font-bold">
                      <span className="text-gray-600">AdBlue/Vidange (heures) :</span>
                      <span className={kpis.fleetCollections.avgHoursAdBlueVidange <= 5 ? "text-emerald-700 font-black" : "text-amber-700"}>
                        {kpis.fleetCollections.avgHoursAdBlueVidange} h
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-3xs pt-2 border-t border-gray-100 font-medium text-gray-500">
                    <span>Taux de Churn hebdo :</span>
                    <strong className={kpis.fleetCollections.weeklyChurnRate < 5 ? "text-emerald-600" : "text-red-600"}>{kpis.fleetCollections.weeklyChurnRate}%</strong>
                  </div>
                </div>

                {/* 4. Field Operations */}
                <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-3xs font-black uppercase tracking-wider text-green-800 bg-green-50 px-2 py-0.5 rounded-full inline-block">
                        🛡️ Field Operations
                      </p>
                      <h3 className="text-2xl font-black text-gray-900 mt-1">
                        {kpis.fieldOperations.avgHoursVehicleRecovery} h
                      </h3>
                      <p className="text-2xs text-gray-500 font-medium mt-0.5">
                        Temps moyen de récupération véhicule
                      </p>
                    </div>
                    <span className="text-2xl">⚡</span>
                  </div>

                  {/* Task Completion Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-3xs font-bold">
                      <span className="text-gray-600">Contrôles Mensuels (Checks) :</span>
                      <span className="text-green-800">
                        {kpis.fieldOperations.monthlyChecksCount} réalisés
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full transition-all duration-500"
                        style={{ width: `100%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-3xs pt-2 border-t border-gray-100 font-medium text-gray-500">
                    <span>Score Santé Moyen :</span>
                    <strong className="text-gray-900">⭐ {kpis.fieldOperations.avgHealthScore} / 5.0</strong>
                  </div>
                </div>
              </div>

              {/* ── Comprehensive Department OKR Matrix ─────────────── */}
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                      <span>🎯</span>
                      <span>Matrice d&apos;Objectifs par Département (OKRs & Pacing)</span>
                    </h3>
                    <p className="text-2xs text-gray-500 mt-0.5">
                      Comparaison des résultats consolidés avec les objectifs fixés dans les Paramètres d&apos;Opérations.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Lead Calls Goal */}
                  <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-800">
                      <span>📞 Volume d&apos;Appels</span>
                      <span className="text-3xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-black">
                        {kpis.leadAcquisition.callsAttainmentPct}%
                      </span>
                    </div>
                    <div className="flex justify-between text-2xs text-gray-500">
                      <span>Réalisé : <strong>{kpis.leadAcquisition.callsDone}</strong></span>
                      <span>Objectif : <strong>{kpis.leadAcquisition.callsTarget}</strong></span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, kpis.leadAcquisition.callsAttainmentPct)}%` }} />
                    </div>
                  </div>

                  {/* Training Fixed Goal */}
                  <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-800">
                      <span>🎓 Formations Fixées</span>
                      <span className="text-3xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-black">
                        {kpis.leadAcquisition.trainingAttainmentPct}%
                      </span>
                    </div>
                    <div className="flex justify-between text-2xs text-gray-500">
                      <span>Réalisé : <strong>{kpis.leadAcquisition.trainingFixed}</strong></span>
                      <span>Objectif : <strong>{kpis.leadAcquisition.trainingTarget}</strong></span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-teal-600 h-full rounded-full" style={{ width: `${Math.min(100, kpis.leadAcquisition.trainingAttainmentPct)}%` }} />
                    </div>
                  </div>

                  {/* Preorders Goal */}
                  <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-800">
                      <span>💵 Précommandes Véhicules</span>
                      <span className="text-3xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-black">
                        {kpis.trainingOnboarding.preordersAttainmentPct}%
                      </span>
                    </div>
                    <div className="flex justify-between text-2xs text-gray-500">
                      <span>Réalisé : <strong>{kpis.trainingOnboarding.preordersCount}</strong></span>
                      <span>Objectif : <strong>{kpis.trainingOnboarding.preordersTarget}</strong></span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.min(100, kpis.trainingOnboarding.preordersAttainmentPct)}%` }} />
                    </div>
                  </div>

                  {/* Cash Recovery Goal */}
                  <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-800">
                      <span>💰 Taux de Recouvrement</span>
                      <span className={`text-3xs px-2 py-0.5 rounded-full font-black ${
                        kpis.fleetCollections.isObjectiveMet ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {kpis.fleetCollections.collectionRecoveryRate}%
                      </span>
                    </div>
                    <div className="flex justify-between text-2xs text-gray-500">
                      <span>Encaissé : <strong>{kpis.fleetCollections.totalEveningCollectedMAD.toLocaleString()} MAD</strong></span>
                      <span>Seuil 60% : <strong>{(kpis.fleetCollections.totalMorningTargetMAD * 0.6).toLocaleString()} MAD</strong></span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${kpis.fleetCollections.isObjectiveMet ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(100, (kpis.fleetCollections.collectionRecoveryRate / 60) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Field Tasks Goal */}
                  <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-800">
                      <span>🛡️ Tâches Terrain</span>
                      <span className="text-3xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-black">
                        {kpis.fieldOperations.tasksAttainmentPct}%
                      </span>
                    </div>
                    <div className="flex justify-between text-2xs text-gray-500">
                      <span>Réalisé : <strong>{kpis.fieldOperations.tasksCompleted}</strong></span>
                      <span>Objectif : <strong>{kpis.fieldOperations.tasksTarget}</strong></span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-green-600 h-full rounded-full" style={{ width: `${Math.min(100, kpis.fieldOperations.tasksAttainmentPct)}%` }} />
                    </div>
                  </div>

                  {/* Maintenance Tickets Goal */}
                  <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-800">
                      <span>🔧 Taux de Churn / Départ</span>
                      <span className={`text-3xs px-2 py-0.5 rounded-full font-black ${kpis.fleetCollections.weeklyChurnRate < 5 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                        {kpis.fleetCollections.weeklyChurnRate}%
                      </span>
                    </div>
                    <div className="flex justify-between text-2xs text-gray-500">
                      <span>Semaine courante</span>
                      <span>Seuil Alerte : <strong>5%</strong></span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${kpis.fleetCollections.weeklyChurnRate < 5 ? "bg-emerald-600" : "bg-red-600"}`} style={{ width: `${Math.min(100, kpis.fleetCollections.weeklyChurnRate * 10)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "leaderboard" && (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                    <span>🏆</span>
                    <span>Classement Individuel de l&apos;Équipe (Team Leaderboard)</span>
                  </h3>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    Évaluation de la performance de chaque collaborateur par rapport aux objectifs assignés.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-3xs font-black text-gray-500 uppercase tracking-wider bg-gray-50/80">
                      <th className="py-3 px-4">Rang</th>
                      <th className="py-3 px-4">Collaborateur</th>
                      <th className="py-3 px-4">Département</th>
                      <th className="py-3 px-4">Métrique Clé</th>
                      <th className="py-3 px-4">Réalisé</th>
                      <th className="py-3 px-4">Objectif</th>
                      <th className="py-3 px-4">Taux d&apos;Atteinte</th>
                      <th className="py-3 px-4">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLeaderboard.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400 font-medium">
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
                            <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-gray-100 text-gray-700">
                              {user.department}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-700">
                            {user.keyMetric}
                          </td>
                          <td className="py-3 px-4 font-bold text-navy">
                            {typeof user.actual === "number" ? user.actual.toLocaleString() : user.actual} {user.unit}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-500">
                            {typeof user.target === "number" ? user.target.toLocaleString() : user.target} {user.unit}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-gray-900">{user.attainmentPct}%</span>
                              <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    user.attainmentPct >= 100
                                      ? "bg-emerald-500"
                                      : user.attainmentPct >= 80
                                      ? "bg-blue-600"
                                      : "bg-red-500"
                                  }`}
                                  style={{ width: `${Math.min(100, user.attainmentPct)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider ${
                                user.status === "EXCEEDED"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : user.status === "ON_TRACK"
                                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                                  : "bg-red-100 text-red-800 border border-red-300"
                              }`}
                            >
                              {user.status === "EXCEEDED"
                                ? "🌟 Dépassé"
                                : user.status === "ON_TRACK"
                                ? "✓ En Objectif"
                                : "⚠️ En Retard"}
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
