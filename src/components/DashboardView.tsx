"use client";

/**
 * Global Executive Operations & BI Command Center — DashboardView
 *
 * Designed by Senior Data Engineering & Business Analysis for the Director of Operations:
 * 1. Global Team Work Composite Score & 4-Pillar Operational Accountability
 * 2. Period-Filtered Assigned Vehicles & Preorders + Onboarding Conversion
 * 3. % of Churn & Uncollected Bad Debt ("Lost Money") after firing/recovering drivers
 * 4. Fleet Composition Percentages: % Working, % Available, % Missing Docs, % in Maintenance
 * 5. Fleet Cycle & Retention Durations (AVG Days):
 *    - AVG Days a vehicle stays assigned to the same driver (Driver Tenure)
 *    - AVG Days a vehicle stays in Available status
 *    - AVG Days a vehicle stays in Missing Docs status
 *    - AVG Days a vehicle stays in Maintenance status
 * 6. % of Collection Debt & Cash Recovery Analytics + Portfolio Comparison (Mohamed Aziz vs Mehdi Elyattouti)
 */

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Car,
  Users,
  Wrench,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  CreditCard,
  Clock,
  PlusCircle,
  RefreshCw,
  MessageCircle,
  FileWarning,
  UserMinus,
  Award,
  Layers,
  Activity,
  Briefcase,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import toast from "react-hot-toast";
import AddExpenseModal from "./AddExpenseModal";
import WhatsAppDirectModal, { WhatsAppDirectTarget } from "./WhatsAppDirectModal";
import RedFlagBadge from "./RedFlagBadge";

interface FinancialSummary {
  total_fleet: number;
  active_vehicles: number;
  available_vehicles: number;
  in_repair_vehicles: number;
  missing_docs_vehicles: number;
  police_impounded_vehicles: number;
  impounded_vehicles: number;
  inactive_vehicles: number;

  // Percentages
  utilization_rate: number;
  available_vehicles_pct: number;
  maintenance_vehicles_pct: number;
  missing_docs_vehicles_pct: number;
  police_impounded_vehicles_pct: number;

  // AVG Days Metrics
  avg_days_assigned_same_driver: number;
  median_days_assigned_same_driver: number;
  tenure_cohorts: {
    under15Days: number;
    between15And45Days: number;
    over45Days: number;
  };
  avg_days_available: number;
  avg_days_missing_docs: number;
  avg_days_maintenance: number;
  target_max_available_days: number;
  target_max_missing_docs_days: number;
  target_max_maintenance_days: number;

  // Assigned Vehicles & Preorders
  assigned_vehicles_in_period: number;
  preorders_in_period: number;
  assigned_and_preorders_in_period: number;
  preorder_amount_in_period_mad: number;
  assigned_vehicles_all_time: number;
  preorders_all_time: number;
  preorder_amount_all_time_mad: number;
  prospection_calls_in_period: number;
  trainings_fixed_in_period: number;
  attended_in_period: number;
  onboarding_conversion_rate_pct: number;

  // Churn & Lost Debt
  churn_count_in_period: number;
  churn_count_all_time: number;
  period_churn_rate_pct: number;
  monthly_churn_rate_pct: number;
  target_max_churn_rate_pct: number;
  lost_debt_fired_drivers_period_mad: number;
  lost_debt_fired_drivers_all_time_mad: number;
  fired_with_debt_count_period: number;
  fired_with_debt_count_all_time: number;
  avg_lost_debt_per_fired_driver_mad: number;

  // Collection & Debt
  period_expected_collection_mad: number;
  period_collected_mad: number;
  period_uncollected_debt_mad: number;
  collection_rate_pct: number;
  collection_debt_pct: number;
  target_min_collection_rate_pct: number;
  target_max_collection_rate_pct: number;
  total_driver_arrears_mad: number;
  total_debt_exposure_mad: number;
  bad_debt_share_pct: number;

  // Financials
  daily_opportunity_cost_per_vehicle: number;
  daily_opportunity_loss_burn_rate: number;
  total_opportunity_loss_mad: number;
  total_direct_expenses_mad: number;
  total_fleet_financial_impact_mad: number;
  expenses_by_category: Record<string, number>;

  // Global Team Work Score
  global_team_work_score_pct: number;
  traffic_pillar_score_pct: number;
  onboarding_pillar_score_pct: number;
  fleet_pillar_score_pct: number;
  field_pillar_score_pct: number;
}

interface TeamWorkPillar {
  id: string;
  title: string;
  agents: string;
  scorePct: number;
  weightPct: number;
  status: "ON_TARGET" | "AT_RISK" | "BREACHED";
  metrics: {
    label: string;
    actual: string;
    subtext: string;
    target: string;
  }[];
}

interface PortfolioStats {
  key: string;
  name: string;
  totalVehicles: number;
  activeVehicles: number;
  utilizationPct: number;
  availableVehicles: number;
  maintenanceVehicles: number;
  missingDocsVehicles: number;
  policeVehicles: number;
  expectedMAD: number;
  collectedMAD: number;
  collectionRatePct: number;
  collectionDebtPct: number;
  churnCountPeriod: number;
  churnRatePct: number;
  lostDebtPeriodMAD: number;
  lostDebtAllTimeMAD: number;
  avgMaintenanceDays: number;
  avgDriverTenureDays: number;
}

interface ChurnedDriverEntry {
  id: string;
  vehicle_id: string;
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  manager: string;
  managerKey: string;
  churned_at: string;
  reason: string;
  unpaid_days: number;
  lost_debt_mad: number;
  is_red_flagged: boolean;
  in_selected_period: boolean;
}

interface VehicleFinancialItem {
  id: string;
  plate_number: string;
  make_model: string;
  year: number;
  hub_city: string;
  status: string;
  fleet_manager?: string;
  driver_name: string | null;
  driver_phone: string | null;
  is_driver_red_flagged?: boolean;
  driver_red_flag_reason?: string | null;
  driver_arrears_mad: number;
  inactive_days: number;
  driver_tenure_days?: number;
  status_duration_days?: number;
  opportunity_loss_mad: number;
  direct_expenses_mad: number;
  total_cost_mad: number;
  expense_count: number;
  current_mileage: number;
}

type PeriodPreset = "TODAY" | "YESTERDAY" | "7D" | "THIS_MONTH" | "30D" | "ALL" | "CUSTOM";

export default function DashboardView() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [periodInfo, setPeriodInfo] = useState<{
    preset: string;
    startDate: string;
    endDate: string;
    workingDays: number;
    calendarDays: number;
  } | null>(null);
  const [teamWorkPillars, setTeamWorkPillars] = useState<TeamWorkPillar[]>([]);
  const [portfolioComparison, setPortfolioComparison] = useState<{
    aziz: PortfolioStats;
    mehdi: PortfolioStats;
  } | null>(null);
  const [churnedDriversLedger, setChurnedDriversLedger] = useState<ChurnedDriverEntry[]>([]);
  const [vehicles, setVehicles] = useState<VehicleFinancialItem[]>([]);
  const [dailyCollectionsSummary, setDailyCollectionsSummary] = useState<any>(null);
  const [redDrivers, setRedDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date Slicer State
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("THIS_MONTH");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Table Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [churnScopeFilter, setChurnScopeFilter] = useState<"ALL" | "PERIOD" | "WITH_DEBT">("ALL");
  const [selectedVehicleForExpense, setSelectedVehicleForExpense] = useState<any | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [directWhatsAppTarget, setDirectWhatsAppTarget] = useState<WhatsAppDirectTarget | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const fetchFinancialReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (periodPreset === "CUSTOM" && (customFrom || customTo)) {
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);
        params.set("period", "CUSTOM");
      } else {
        params.set("period", periodPreset);
      }

      const [finRes, colRes] = await Promise.all([
        fetch(`/api/reports/financial?${params.toString()}`),
        fetch("/api/collections/driver-daily"),
      ]);

      const finData = await finRes.json();
      const colData = await colRes.json();

      if (finData.summary) {
        setSummary(finData.summary);
        setPeriodInfo(finData.period || null);
        setTeamWorkPillars(finData.teamWorkPillars || []);
        setPortfolioComparison(finData.portfolioComparison || null);
        setChurnedDriversLedger(finData.churnedDriversLedger || []);
        setVehicles(finData.vehicles || []);
      }

      if (colData.drivers) {
        setDailyCollectionsSummary(colData.summary);
        setRedDrivers(colData.drivers.filter((d: any) => d.isCriticalRed));
      }
    } catch (err) {
      console.error("Failed to load executive report:", err);
      toast.error("Erreur de chargement du Tableau de Bord Exécutif");
    } finally {
      setIsLoading(false);
    }
  }, [periodPreset, customFrom, customTo]);

  const lastCollectionsTs = useRef<number>(0);

  useEffect(() => {
    fetchFinancialReport();
  }, [fetchFinancialReport]);

  // Live sync: poll every 8s for collection updates
  useEffect(() => {
    const pollCollections = async () => {
      try {
        const ts = lastCollectionsTs.current;
        const res = await fetch(`/api/system/sync-status?collections=${ts}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.collections && data.collections > lastCollectionsTs.current) {
          lastCollectionsTs.current = data.collections;
          if (ts > 0) {
            fetchFinancialReport();
          } else {
            lastCollectionsTs.current = data.collections;
          }
        }
      } catch {}
    };
    pollCollections();
    const interval = setInterval(pollCollections, 8000);
    return () => clearInterval(interval);
  }, [fetchFinancialReport]);

  // Filtered vehicles for the financial table
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesSearch =
        v.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.make_model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.driver_name && v.driver_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.fleet_manager && v.fleet_manager.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const isActif = v.status === "Actif" || v.status === "In service" || v.status === "working";
      if (statusFilter === "INACTIVE" && isActif) return false;
      if (statusFilter === "ACTIVE" && !isActif) return false;
      if (statusFilter === "AVAILABLE" && v.status !== "Available" && v.status !== "Disponible") return false;
      if (statusFilter === "GARAGE" && v.status !== "In garage" && v.status !== "maintenance" && v.status !== "Accident")
        return false;
      if (statusFilter === "MISSING_DOCS" && v.status !== "missing_document") return false;
      if (
        statusFilter === "POLICE" &&
        v.status !== "impounded by police" &&
        v.status !== "police_immobilization" &&
        v.status !== "impounded" &&
        v.status !== "Blocked"
      )
        return false;

      return true;
    });
  }, [vehicles, searchQuery, statusFilter]);

  const filteredChurnLedger = useMemo(() => {
    return churnedDriversLedger.filter((c) => {
      if (churnScopeFilter === "PERIOD") return c.in_selected_period;
      if (churnScopeFilter === "WITH_DEBT") return c.lost_debt_mad > 0;
      return true;
    });
  }, [churnedDriversLedger, churnScopeFilter]);

  // Export Financial CSV
  const exportFinancialCSV = () => {
    if (vehicles.length === 0) return;

    const headers =
      "Immatriculation,Modele,Gestionnaire,Chauffeur,Statut,Anciennete Chauffeur (Jours),Jours Inactivite,Perte Opportunite (250 MAD/j),Frais Directs (MAD),Cout Total GoCab (MAD),Impayes Chauffeur (MAD)\n";
    const rows = vehicles
      .map(
        (v) =>
          `"${v.plate_number}","${v.make_model}","${v.fleet_manager || ""}","${v.driver_name || "Non assigné"}","${v.status}",${v.driver_tenure_days || 0},${v.inactive_days},${v.opportunity_loss_mad},${v.direct_expenses_mad},${v.total_cost_mad},${v.driver_arrears_mad}`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapport_executif_flotte_gocab_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Rapport exécutif exporté en CSV !");
  };

  if (isLoading && !summary) {
    return (
      <div className="flex h-96 items-center justify-center animate-fadeIn">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
          <span className="text-sm font-semibold text-gray-600">
            Calcul des Indicateurs Exécutifs & BI Opérationnel...
          </span>
        </div>
      </div>
    );
  }

  const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#e11d48", "#8b5cf6"];

  const fleetStatusPieData = [
    { name: `En Service (${summary?.utilization_rate || 0}%)`, value: summary?.active_vehicles || 0 },
    { name: `Disponibles (${summary?.available_vehicles_pct || 0}%)`, value: summary?.available_vehicles || 0 },
    { name: `Maintenance (${summary?.maintenance_vehicles_pct || 0}%)`, value: summary?.in_repair_vehicles || 0 },
    { name: `Docs Manquants (${summary?.missing_docs_vehicles_pct || 0}%)`, value: summary?.missing_docs_vehicles || 0 },
    { name: `Police / Sabot (${summary?.police_impounded_vehicles_pct || 0}%)`, value: summary?.police_impounded_vehicles || 0 },
  ].filter((d) => d.value > 0);

  const cycleDaysBarData = [
    {
      name: "Disponible",
      actual: summary?.avg_days_available || 0,
      target: summary?.target_max_available_days || 1,
    },
    {
      name: "Docs Manquants",
      actual: summary?.avg_days_missing_docs || 0,
      target: summary?.target_max_missing_docs_days || 3,
    },
    {
      name: "Maintenance",
      actual: summary?.avg_days_maintenance || 0,
      target: summary?.target_max_maintenance_days || 10,
    },
    {
      name: "Même Chauffeur",
      actual: summary?.avg_days_assigned_same_driver || 0,
      target: 45,
    },
  ];

  const globalScore = summary?.global_team_work_score_pct || 0;
  const globalGrade =
    globalScore >= 95
      ? { label: "EXCELLENT", color: "bg-emerald-500 text-white" }
      : globalScore >= 80
      ? { label: "SUR CIBLE", color: "bg-sky-500 text-white" }
      : globalScore >= 65
      ? { label: "SOUS TENSION", color: "bg-amber-500 text-navy" }
      : { label: "ACTION REQUISE", color: "bg-rose-500 text-white" };

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-16 animate-fadeIn">
      {/* =====================================================================
          1. EXECUTIVE COMMAND HEADER & PERIOD SLICER
         ===================================================================== */}
      <div className="bg-gradient-to-r from-navy via-[#1b3453] to-[#0d1e38] text-white p-6 sm:p-7 rounded-3xl shadow-md relative overflow-hidden space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 bg-gold/20 text-gold rounded-xl border border-gold/30">
                <Activity className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {t.executiveDashboard || "Tableau de Bord Exécutif — Direction des Opérations"}
              </h1>
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                BI & Data Engineering Live
              </span>
            </div>
            <p className="text-white/75 text-xs sm:text-sm">
              Vue holistique de la performance d&apos;équipe, affectations & précommandes, churn & pertes sur créances irrécouvrables, composition flotte (%) et durées moyennes de cycle (AVG Jours).
            </p>
          </div>

          {/* Right: Global Team Work KPI Score Badge + Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 block">
                  KPI Global Travail d&apos;Équipe
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gold font-mono">
                    {globalScore}%
                  </span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${globalGrade.color}`}>
                    {globalGrade.label}
                  </span>
                </div>
              </div>
              <Award className="w-7 h-7 text-gold/80" />
            </div>

            <button
              onClick={exportFinancialCSV}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-gold" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                setSelectedVehicleForExpense(null);
                setIsExpenseModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-gold hover:bg-gold/90 text-navy font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Ajouter un Frais</span>
            </button>
          </div>
        </div>

        {/* Date Range Slicer Bar */}
        <div className="pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-white/70 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gold" />
              <span>Période d&apos;analyse :</span>
            </span>
            {(
              [
                { id: "TODAY", label: "Aujourd'hui" },
                { id: "YESTERDAY", label: "Hier" },
                { id: "7D", label: "7 Jours" },
                { id: "THIS_MONTH", label: "Ce Mois-ci" },
                { id: "30D", label: "30 Jours" },
                { id: "ALL", label: "Tout l'Historique" },
                { id: "CUSTOM", label: "Personnalisé" },
              ] as { id: PeriodPreset; label: string }[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodPreset === p.id
                    ? "bg-white text-navy shadow-xs"
                    : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodPreset === "CUSTOM" ? (
            <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/15">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-white text-navy text-xs font-bold px-2.5 py-1 rounded-lg focus:outline-none"
              />
              <span className="text-xs text-white/70">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-white text-navy text-xs font-bold px-2.5 py-1 rounded-lg focus:outline-none"
              />
            </div>
          ) : (
            periodInfo && (
              <div className="flex items-center gap-2 text-xs text-white/80 font-mono bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span>
                  📅 {periodInfo.startDate} au {periodInfo.endDate} ({periodInfo.workingDays}j ouvrés)
                </span>
                <button
                  type="button"
                  onClick={fetchFinancialReport}
                  className="text-white hover:text-gold ml-1 cursor-pointer"
                  title="Actualiser les données"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* =====================================================================
          2. GLOBAL TEAM WORK SCORECARD (ENGLOBING ALL 4 DEPARTMENTS)
         ===================================================================== */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-navy/10 text-navy rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-navy">
                  Synthèse Globale du Travail d&apos;Équipe (Score Global : {globalScore}%)
                </h2>
                <p className="text-xs text-slate-500">
                  Indicateur consolidé englobant la performance de tous les pôles opérationnels sur la période sélectionnée
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
              📞 {summary?.prospection_calls_in_period || 0} Appels
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200">
              🎓 {summary?.trainings_fixed_in_period || 0} Fixées
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
              🚗 {summary?.assigned_and_preorders_in_period || 0} Affect./Précom.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teamWorkPillars.map((pillar) => {
            const badgeStyle =
              pillar.status === "ON_TARGET"
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : pillar.status === "AT_RISK"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-rose-100 text-rose-800 border-rose-200";
            const barColor =
              pillar.status === "ON_TARGET"
                ? "bg-emerald-500"
                : pillar.status === "AT_RISK"
                ? "bg-amber-500"
                : "bg-rose-500";

            return (
              <div
                key={pillar.id}
                className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-between space-y-3 hover:border-navy/30 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-extrabold text-navy leading-snug">
                      {pillar.title}
                    </h3>
                    <span
                      className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg border shrink-0 ${badgeStyle}`}
                    >
                      {pillar.scorePct}%
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">
                    👥 {pillar.agents}
                  </p>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(100, Math.max(5, pillar.scorePct))}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200/60">
                  {pillar.metrics.map((m, idx) => (
                    <div key={idx} className="text-[11px]">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span className="truncate pr-1">{m.label}</span>
                        <span className="text-navy font-mono shrink-0">{m.actual}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate">{m.subtext}</span>
                        <span className="shrink-0">Cible: {m.target}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          3. ROW A: ASSIGNED VEHICLES / PREORDERS, CHURN %, LOST DEBT & COLLECTION DEBT %
         ===================================================================== */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-navy flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <span>1. Acquisition, Churn Chauffeurs, Pertes sur Licenciements & Dette de Recouvrement</span>
          </h2>
          <span className="text-2xs text-slate-500 font-semibold">
            Dynamique sur la période ({periodInfo?.startDate} → {periodInfo?.endDate}) & Cumul Historique
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Assigned Vehicles & Preorders in Range */}
          <div className="bg-white p-5 rounded-3xl border border-indigo-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-indigo-800 uppercase tracking-wider">
                Véhicules Affectés & Précommandes
              </span>
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <Car className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-indigo-950 font-mono">
                  {summary?.assigned_and_preorders_in_period ?? 0}
                </p>
                <span className="text-xs font-bold text-indigo-600">
                  sur la période
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-2xs">
                <div className="bg-emerald-50 border border-emerald-200/70 rounded-xl px-2.5 py-1.5">
                  <span className="text-emerald-700 block font-semibold">Affectés (Période)</span>
                  <strong className="text-emerald-950 text-sm font-mono font-black">
                    {summary?.assigned_vehicles_in_period ?? 0}
                  </strong>
                  <span className="text-[10px] text-emerald-700 block">
                    Cumul: {summary?.assigned_vehicles_all_time ?? 0}
                  </span>
                </div>
                <div className="bg-purple-50 border border-purple-200/70 rounded-xl px-2.5 py-1.5">
                  <span className="text-purple-700 block font-semibold">Précommandes</span>
                  <strong className="text-purple-950 text-sm font-mono font-black">
                    {summary?.preorders_in_period ?? 0}
                  </strong>
                  <span className="text-[10px] text-purple-700 block">
                    Cumul: {summary?.preorders_all_time ?? 0} ({summary?.preorder_amount_all_time_mad?.toLocaleString() || 0} DH)
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Taux conv. Formation :</span>
              <strong className="text-indigo-700 font-bold">
                {summary?.onboarding_conversion_rate_pct ?? 0}% ({summary?.attended_in_period ?? 0} présents)
              </strong>
            </div>
          </div>

          {/* KPI 2: % of Churn */}
          <div className="bg-white p-5 rounded-3xl border border-rose-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wider">
                Taux de Churn (% of Churn)
              </span>
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                <UserMinus className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <p
                  className={`text-3xl font-black font-mono ${
                    (summary?.monthly_churn_rate_pct ?? 0) <= (summary?.target_max_churn_rate_pct ?? 20)
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {summary?.monthly_churn_rate_pct ?? 0}%
                </p>
                <span className="text-xs font-bold text-slate-500">
                  ({summary?.churn_count_in_period ?? 0} départs période)
                </span>
              </div>
              <p className="text-2xs text-slate-500 mt-1">
                Churn brut période : <strong>{summary?.period_churn_rate_pct ?? 0}%</strong> · Cumul historique :{" "}
                <strong>{summary?.churn_count_all_time ?? 0} départs</strong>
              </p>
              <div className="mt-2 flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
                <span>Aziz : <strong>{portfolioComparison?.aziz.churnRatePct ?? 0}%</strong> ({portfolioComparison?.aziz.churnCountPeriod ?? 0})</span>
                <span>Mehdi : <strong>{portfolioComparison?.mehdi.churnRatePct ?? 0}%</strong> ({portfolioComparison?.mehdi.churnCountPeriod ?? 0})</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Seuil max toléré :</span>
              <strong className="text-emerald-700 font-bold">
                ≤ {summary?.target_max_churn_rate_pct ?? 20}% / mois
              </strong>
            </div>
          </div>

          {/* KPI 3: Lost Money After Firing Driver Without Collecting Debt */}
          <div className="bg-white p-5 rounded-3xl border-2 border-red-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-red-800 uppercase tracking-wider">
                Pertes sur Chauffeurs Licenciés
              </span>
              <div className="p-2 bg-red-100 text-red-700 rounded-xl">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3">
              <p className="text-2xl sm:text-3xl font-black text-red-700 font-mono">
                -{summary?.lost_debt_fired_drivers_period_mad?.toLocaleString() ?? 0}{" "}
                <span className="text-xs font-bold">MAD</span>
              </p>
              <p className="text-2xs text-red-600 font-semibold mt-0.5">
                Créances perdues sur la période ({summary?.fired_with_debt_count_period ?? 0} chauffeurs récupérés avec dette)
              </p>
              <div className="mt-2 bg-red-50/80 border border-red-200/80 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px]">
                <span className="text-red-900 font-semibold">Cumul Historique Perdu :</span>
                <strong className="text-red-800 font-mono font-black">
                  -{summary?.lost_debt_fired_drivers_all_time_mad?.toLocaleString() ?? 0} MAD ({summary?.fired_with_debt_count_all_time ?? 0} cas)
                </strong>
              </div>
            </div>

            <div className="pt-2 border-t border-red-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Perte moy. / licenciement :</span>
              <strong className="text-red-700 font-mono font-bold">
                -{summary?.avg_lost_debt_per_fired_driver_mad?.toLocaleString() ?? 0} MAD / chauffeur
              </strong>
            </div>
          </div>

          {/* KPI 4: % of Collection Debt */}
          <div className="bg-white p-5 rounded-3xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">
                % Dette de Recouvrement
              </span>
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-rose-600 block">
                    % Dette Non Recouvrée
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-rose-600 font-mono">
                    {summary?.collection_debt_pct ?? 0}%
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                    % Cash Collecté
                  </span>
                  <p className="text-xl font-black text-emerald-600 font-mono">
                    {summary?.collection_rate_pct ?? 0}%
                  </p>
                </div>
              </div>

              <div className="w-full h-2 bg-rose-100 rounded-full overflow-hidden my-2 flex">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${Math.min(100, summary?.collection_rate_pct ?? 0)}%` }}
                  title="Taux collecté"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>Attendu : <strong>{summary?.period_expected_collection_mad?.toLocaleString() ?? 0} DH</strong></span>
                <span>Encaissé : <strong className="text-emerald-700">{summary?.period_collected_mad?.toLocaleString() ?? 0} DH</strong></span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Encours actifs actuel :</span>
              <strong className="text-rose-700 font-mono font-bold">
                {summary?.total_driver_arrears_mad?.toLocaleString() ?? 0} MAD
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. ROW B: FLEET COMPOSITION PERCENTAGES (% WORKING, % AVAILABLE, % MISSING DOCS, % MAINTENANCE)
         ===================================================================== */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-navy flex items-center gap-2">
            <Car className="w-4 h-4 text-emerald-600" />
            <span>2. Répartition de la Flotte en % (Sur {summary?.total_fleet ?? 101} Véhicules Actifs)</span>
          </h2>
          <span className="text-2xs text-slate-500 font-semibold">
            Synchronisé en temps réel avec la base Flotte
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* % Working / In Service */}
          <div
            onClick={() => setStatusFilter("ACTIVE")}
            className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider">
                % Véhicules En Service
              </span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                {summary?.active_vehicles ?? 0} / {summary?.total_fleet ?? 0}
              </span>
            </div>
            <div className="my-3">
              <p className="text-3xl font-black text-emerald-600 font-mono">
                {summary?.utilization_rate ?? 0}%
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                Véhicules en exploitation active sur la route
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Cible Direction :</span>
              <strong className="text-emerald-700">≥ 85%</strong>
            </div>
          </div>

          {/* % Available Vehicle */}
          <div
            onClick={() => setStatusFilter("AVAILABLE")}
            className="bg-white p-5 rounded-3xl border border-sky-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-sky-800 uppercase tracking-wider">
                % Véhicules Disponibles
              </span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-mono">
                {summary?.available_vehicles ?? 0} / {summary?.total_fleet ?? 0}
              </span>
            </div>
            <div className="my-3">
              <p className="text-3xl font-black text-sky-600 font-mono">
                {summary?.available_vehicles_pct ?? 0}%
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                Véhicules prêts au parc en attente d&apos;affectation chauffeur
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Coût d&apos;attente :</span>
              <strong className="text-amber-700">
                {((summary?.available_vehicles ?? 0) * 250).toLocaleString()} MAD / j
              </strong>
            </div>
          </div>

          {/* % Vehicle with Missing Docs */}
          <div
            onClick={() => setStatusFilter("MISSING_DOCS")}
            className="bg-white p-5 rounded-3xl border border-rose-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wider">
                % Documents Manquants
              </span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono">
                {summary?.missing_docs_vehicles ?? 0} / {summary?.total_fleet ?? 0}
              </span>
            </div>
            <div className="my-3">
              <p className="text-3xl font-black text-rose-600 font-mono">
                {summary?.missing_docs_vehicles_pct ?? 0}%
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                Véhicules immobilisés pour dossier ou papier manquant
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Cible Direction :</span>
              <strong className="text-emerald-700">0% (≤ 3j max)</strong>
            </div>
          </div>

          {/* % Vehicle in Maintenance */}
          <div
            onClick={() => setStatusFilter("GARAGE")}
            className="bg-white p-5 rounded-3xl border border-amber-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider">
                % Véhicules en Maintenance
              </span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono">
                {summary?.in_repair_vehicles ?? 0} / {summary?.total_fleet ?? 0}
              </span>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-amber-600 font-mono">
                  {summary?.maintenance_vehicles_pct ?? 0}%
                </p>
                <span className="text-2xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                  + {summary?.police_impounded_vehicles_pct ?? 0}% Police ({summary?.police_impounded_vehicles ?? 0})
                </span>
              </div>
              <p className="text-2xs text-slate-500 mt-1">
                Véhicules au garage / carrosserie / mécanique
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Perte garage / jour :</span>
              <strong className="text-red-600">
                -{((summary?.in_repair_vehicles ?? 0) * 250).toLocaleString()} MAD / j
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. ROW C: FLEET DURATION & RETENTION AVERAGES (AVG DAYS)
         ===================================================================== */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-navy flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>3. Durées Moyennes de Cycle & Stabilité Chauffeurs (AVG Days)</span>
          </h2>
          <span className="text-2xs text-slate-500 font-semibold">
            Mesure de la vélocité opérationnelle et de la fidélisation chauffeur
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* AVG Days Vehicle Assigned to Same Driver */}
          <div className="bg-white p-5 rounded-3xl border border-indigo-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wider">
                AVG Jours Même Chauffeur
              </span>
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-indigo-900 font-mono">
                  {summary?.avg_days_assigned_same_driver ?? 0}{" "}
                  <span className="text-sm font-bold">jours</span>
                </p>
              </div>
              <p className="text-2xs text-slate-500 mt-0.5">
                Médiane : <strong>{summary?.median_days_assigned_same_driver ?? 0}j</strong> par chauffeur actif
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
                <div className="bg-slate-50 rounded-lg py-1 border border-slate-200/60">
                  <span className="text-slate-500 block">&lt; 15j</span>
                  <strong className="text-slate-800 font-mono">{summary?.tenure_cohorts?.under15Days ?? 0}</strong>
                </div>
                <div className="bg-slate-50 rounded-lg py-1 border border-slate-200/60">
                  <span className="text-slate-500 block">15–45j</span>
                  <strong className="text-slate-800 font-mono">{summary?.tenure_cohorts?.between15And45Days ?? 0}</strong>
                </div>
                <div className="bg-emerald-50 rounded-lg py-1 border border-emerald-200/60">
                  <span className="text-emerald-700 block">&gt; 45j</span>
                  <strong className="text-emerald-900 font-mono">{summary?.tenure_cohorts?.over45Days ?? 0}</strong>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Aziz: {portfolioComparison?.aziz.avgDriverTenureDays ?? 0}j</span>
              <span>Mehdi: {portfolioComparison?.mehdi.avgDriverTenureDays ?? 0}j</span>
            </div>
          </div>

          {/* AVG Days Vehicle Stays Available */}
          <div className="bg-white p-5 rounded-3xl border border-sky-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-sky-900 uppercase tracking-wider">
                AVG Jours Statut Disponible
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  (summary?.avg_days_available ?? 0) <= (summary?.target_max_available_days ?? 1)
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {(summary?.avg_days_available ?? 0) <= (summary?.target_max_available_days ?? 1)
                  ? "✓ Conforme"
                  : "⚠️ À accélérer"}
              </span>
            </div>
            <div className="my-3">
              <p className="text-3xl font-black text-sky-700 font-mono">
                {summary?.avg_days_available ?? 0}{" "}
                <span className="text-sm font-bold">jours</span>
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                Durée moyenne où un véhicule reste Disponible au parc sans chauffeur
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Objectif Onboarding :</span>
              <strong className="text-sky-800 font-bold">
                ≤ {summary?.target_max_available_days ?? 1.0} jour
              </strong>
            </div>
          </div>

          {/* AVG Days Vehicle Stays Missing Docs */}
          <div className="bg-white p-5 rounded-3xl border border-rose-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-rose-900 uppercase tracking-wider">
                AVG Jours Docs Manquants
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  (summary?.avg_days_missing_docs ?? 0) <= (summary?.target_max_missing_docs_days ?? 3)
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {(summary?.avg_days_missing_docs ?? 0) <= (summary?.target_max_missing_docs_days ?? 3)
                  ? "✓ ≤ 3j"
                  : "⚠️ Dépassement"}
              </span>
            </div>
            <div className="my-3">
              <p className="text-3xl font-black text-rose-600 font-mono">
                {summary?.avg_days_missing_docs ?? 0}{" "}
                <span className="text-sm font-bold">jours</span>
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                Durée moyenne d&apos;immobilisation pour documents administratifs manquants
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Objectif Terrain :</span>
              <strong className="text-rose-700 font-bold">
                ≤ {summary?.target_max_missing_docs_days ?? 3.0} jours
              </strong>
            </div>
          </div>

          {/* AVG Days Vehicle Stays in Maintenance */}
          <div className="bg-white p-5 rounded-3xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">
                AVG Jours en Maintenance
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  (summary?.avg_days_maintenance ?? 0) <= (summary?.target_max_maintenance_days ?? 10)
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {(summary?.avg_days_maintenance ?? 0) <= (summary?.target_max_maintenance_days ?? 10)
                  ? "✓ ≤ 10j"
                  : "⚠️ > 10j"}
              </span>
            </div>
            <div className="my-3">
              <p className="text-3xl font-black text-amber-700 font-mono">
                {summary?.avg_days_maintenance ?? 0}{" "}
                <span className="text-sm font-bold">jours</span>
              </p>
              <p className="text-2xs text-slate-500 mt-1">
                Durée moyenne d&apos;immobilisation au garage (mécanique / sinistre)
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
              <span>Objectif Garage :</span>
              <strong className="text-amber-800 font-bold">
                ≤ {summary?.target_max_maintenance_days ?? 10} jours
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          6. VISUAL BI CHARTS & PORTFOLIO COMPARISON (AZIZ VS MEHDI)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Fleet Distribution Pie */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-navy text-sm">Composition Actuelle de la Flotte (%)</h3>
            <p className="text-2xs text-gray-400 mt-0.5">
              Répartition exacte des {summary?.total_fleet} véhicules par statut opérationnel
            </p>
          </div>
          <div className="h-52 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fleetStatusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={74}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {fleetStatusPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} véhicule(s)`, "Effectif"]}
                  contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid #e5e7eb" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-2xs pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-gray-700 font-semibold">
                En Service: {summary?.active_vehicles} ({summary?.utilization_rate}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-gray-700 font-semibold">
                Dispo: {summary?.available_vehicles} ({summary?.available_vehicles_pct}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-gray-700 font-semibold">
                Maint.: {summary?.in_repair_vehicles} ({summary?.maintenance_vehicles_pct}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-gray-700 font-semibold">
                Docs Manq.: {summary?.missing_docs_vehicles} ({summary?.missing_docs_vehicles_pct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Chart 2: Portfolio Comparison (Mohamed Aziz vs Mehdi Elyattouti) + Financial Impact */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between col-span-1 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-navy text-sm">
                Comparatif Portefeuilles Gestionnaires Flotte & Structure des Pertes
              </h3>
              <p className="text-2xs text-gray-400 mt-0.5">
                Mohamed Aziz ({portfolioComparison?.aziz.totalVehicles ?? 75} véh.) vs Mehdi Elyattouti ({portfolioComparison?.mehdi.totalVehicles ?? 26} véh. verrouillés)
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-rose-50 text-rose-800 rounded-xl border border-rose-200">
              Impact Global : {summary?.total_fleet_financial_impact_mad?.toLocaleString() ?? 0} MAD
            </span>
          </div>

          {portfolioComparison && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[portfolioComparison.aziz, portfolioComparison.mehdi].map((mgr) => (
                <div
                  key={mgr.key}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <p className="text-xs font-extrabold text-navy">{mgr.name}</p>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Portefeuille : {mgr.totalVehicles} véhicules ({mgr.activeVehicles} actifs)
                      </span>
                    </div>
                    <span className="text-xs font-black font-mono px-2.5 py-1 rounded-xl bg-navy text-white">
                      {mgr.utilizationPct}% actif
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Taux Recouvrement :</span>
                      <strong className="text-emerald-700 font-mono">{mgr.collectionRatePct}%</strong>{" "}
                      <span className="text-[10px] text-rose-600">({mgr.collectionDebtPct}% dette)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Churn & Départs :</span>
                      <strong className="text-slate-800 font-mono">
                        {mgr.churnRatePct}% ({mgr.churnCountPeriod} dép.)
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Dette Perdue (Licenciés) :</span>
                      <strong className="text-red-700 font-mono">
                        -{mgr.lostDebtAllTimeMAD.toLocaleString()} MAD
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">AVG Maint. / Même Chauf. :</span>
                      <strong className="text-navy font-mono">
                        {mgr.avgMaintenanceDays}j / {mgr.avgDriverTenureDays}j
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3-Bar Cost Breakdown */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-amber-800">
                1. Perte d&apos;Opportunité Inactivité ({summary?.inactive_vehicles} véh. inactifs × 250 DH/j)
              </span>
              <span className="font-mono font-bold text-amber-900">
                {summary?.total_opportunity_loss_mad?.toLocaleString() ?? 0} MAD
              </span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-red-800">
                2. Pertes Sèches Chauffeurs Licenciés sans Recouvrement ({summary?.fired_with_debt_count_all_time ?? 0} cas)
              </span>
              <span className="font-mono font-bold text-red-700">
                {summary?.lost_debt_fired_drivers_all_time_mad?.toLocaleString() ?? 0} MAD
              </span>
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-blue-800">
                3. Dépenses Directes Garage, Fourrière & Sinistres (Période)
              </span>
              <span className="font-mono font-bold text-blue-900">
                {summary?.total_direct_expenses_mad?.toLocaleString() ?? 0} MAD
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          7. AUDIT LEDGER: FIRED / RECOVERED DRIVERS & UNCOLLECTED BAD DEBT
         ===================================================================== */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-red-100 text-red-700 rounded-xl">
                <UserMinus className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-navy">
                  Registre des Chauffeurs Licenciés / Récupérés & Créances Perdues
                </h2>
                <p className="text-xs text-slate-500">
                  Traçabilité complète du churn et de l&apos;argent perdu après récupération du véhicule sans recouvrement de la dette
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setChurnScopeFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                churnScopeFilter === "ALL" ? "bg-white text-navy shadow-xs" : "text-slate-600"
              }`}
            >
              Tous ({churnedDriversLedger.length})
            </button>
            <button
              type="button"
              onClick={() => setChurnScopeFilter("PERIOD")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                churnScopeFilter === "PERIOD" ? "bg-white text-navy shadow-xs" : "text-slate-600"
              }`}
            >
              Sur la période ({summary?.churn_count_in_period ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setChurnScopeFilter("WITH_DEBT")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                churnScopeFilter === "WITH_DEBT" ? "bg-red-600 text-white shadow-xs" : "text-red-700"
              }`}
            >
              Avec Dette Perdue ({summary?.fired_with_debt_count_all_time ?? 0})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 uppercase text-[10px] tracking-wider text-slate-500 border-b border-slate-200 font-bold sticky top-0">
              <tr>
                <th className="py-3 px-4">Date Sortie</th>
                <th className="py-3 px-4">Chauffeur Licencié / Sortant</th>
                <th className="py-3 px-4">Véhicule</th>
                <th className="py-3 px-4">Gestionnaire</th>
                <th className="py-3 px-4">Motif / Rapport Récupération</th>
                <th className="py-3 px-4 text-center">Jours Impayés</th>
                <th className="py-3 px-4 text-right">Argent Perdu (Dette Non Recouvrée)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredChurnLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucun départ chauffeur sur ce filtre.
                  </td>
                </tr>
              ) : (
                filteredChurnLedger.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {new Date(item.churned_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.driver_name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.driver_phone}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-navy bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {item.plate_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          item.managerKey === "mehdi"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-sky-50 text-sky-800 border border-sky-200"
                        }`}
                      >
                        {item.manager}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-md truncate" title={item.reason}>
                      {item.reason}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {item.unpaid_days > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                          {item.unpaid_days}j
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black whitespace-nowrap">
                      {item.lost_debt_mad > 0 ? (
                        <span className="text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                          -{item.lost_debt_mad.toLocaleString()} MAD
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">0 MAD (Soldé)</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          8. CRITICAL RED ALERT DRIVERS (3RD CONSECUTIVE UNPAID DAY)
         ===================================================================== */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-red-100 text-red-600 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-navy">
                Suivi des Encaissements du Jour & Alertes Rouges Chauffeurs (300 / 1800 MAD)
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Contrats Journaliers (300 DH/j du Lun au Sam) & Hebdomadaires (1800 DH chaque Lundi). Alerte rouge déclenchée au <strong>3ème jour sans versement</strong> pour éviter de nouvelles pertes sur licenciement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xs font-bold text-gray-400 uppercase">Collecté Aujourd&apos;hui</span>
              <p className="text-base font-black text-emerald-600 font-mono">
                {dailyCollectionsSummary?.totalClearedTodayMAD?.toLocaleString() || 0} /{" "}
                {dailyCollectionsSummary?.totalExpectedTodayMAD?.toLocaleString() || 0} MAD
              </p>
            </div>
          </div>
        </div>

        {redDrivers.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                {redDrivers.length} Chauffeurs en Non-Paiement Critique (Risque de Perte Sèche)
              </span>
              <span className="text-2xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                Intervention Terrain / Risque Immobilisation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {redDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="p-4 bg-red-50/80 rounded-2xl border-2 border-red-200 shadow-2xs flex flex-col justify-between space-y-3 hover:border-red-400 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-sm text-red-950">{driver.fullName}</p>
                        {driver.isRedFlagged && <RedFlagBadge reason={driver.redFlagReason} />}
                      </div>
                      <p className="text-2xs font-mono text-gray-500">{driver.phoneSanitized}</p>
                      {driver.vehicle && (
                        <span className="font-mono font-bold text-2xs bg-white text-navy px-2 py-0.5 rounded-md border border-red-200 inline-block mt-1">
                          🚗 {driver.vehicle.plate_number}
                        </span>
                      )}
                    </div>

                    <span className="text-3xs font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full uppercase">
                      {driver.consecutiveUnpaidDays || 3}j impayés
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-red-200/60">
                    <div>
                      <span className="text-3xs text-gray-500 block">Total Impayés :</span>
                      <strong className="text-red-700 text-sm font-black font-mono">
                        {driver.currentArrearsMAD.toLocaleString()} MAD
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDirectWhatsAppTarget({
                          phoneNumber: driver.phoneSanitized,
                          contactName: driver.fullName,
                          contactType: "DRIVER",
                          plateNumber: driver.vehicle?.plate_number,
                          arrearsMAD: driver.currentArrearsMAD,
                          unpaidDays: driver.consecutiveUnpaidDays,
                          defaultMessage: `Bonjour ${driver.fullName},\n\nURGENT : Nous constatons 3 jours consécutifs sans versement pour votre véhicule GoCab (${driver.vehicle?.plate_number || ""}).\nVotre solde d'arriérés est de : ${driver.currentArrearsMAD} MAD.\nMerci de régulariser immédiatement pour éviter l'immobilisation du véhicule.\n\nL'équipe GoCab Operations.`,
                        });
                        setIsWhatsAppModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-2xs rounded-xl shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>WhatsApp Direct</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>
              Aucun chauffeur en alerte rouge (3ème jour sans paiement). Tous les versements sont à jour.
            </span>
          </div>
        )}
      </div>

      {/* =====================================================================
          9. DETAILED PER-VEHICLE FINANCIAL & OPERATIONAL BREAKDOWN TABLE
         ===================================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
              <span>🚘</span> Rapport Financier & Opérationnel Détaillé par Véhicule ({filteredVehicles.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Suivi individuel : Ancienneté chauffeur assigné, jours d&apos;arrêt, perte d&apos;opportunité (250 DH/j), frais directs et impayés.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Immatriculation, chauffeur, gestionnaire..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs text-slate-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">Tous les statuts ({vehicles.length})</option>
              <option value="ACTIVE">En Service / Working ({summary?.active_vehicles ?? 0})</option>
              <option value="AVAILABLE">Disponibles au parc ({summary?.available_vehicles ?? 0})</option>
              <option value="MISSING_DOCS">Documents Manquants ({summary?.missing_docs_vehicles ?? 0})</option>
              <option value="GARAGE">En Maintenance / Garage ({summary?.in_repair_vehicles ?? 0})</option>
              <option value="POLICE">Police / Fourrière ({summary?.police_impounded_vehicles ?? 0})</option>
              <option value="INACTIVE">Tous les Inactifs ({summary?.inactive_vehicles ?? 0})</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 uppercase text-2xs tracking-wider text-gray-500 border-b border-gray-100 font-bold">
                <tr>
                  <th className="py-4 px-6">Véhicule</th>
                  <th className="py-4 px-4">Chauffeur & Gestionnaire</th>
                  <th className="py-4 px-4">Statut</th>
                  <th className="py-4 px-4 text-center">Jours Même Chauffeur / Arrêt</th>
                  <th className="py-4 px-4 text-right">Perte d&apos;Opportunité (250 DH/j)</th>
                  <th className="py-4 px-4 text-right">Frais Directs (Garage/Police)</th>
                  <th className="py-4 px-4 text-right font-extrabold text-navy">Coût Total GoCab</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      Aucun véhicule correspondant aux filtres.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((v) => {
                    const isActif =
                      v.status === "Actif" || v.status === "In service" || v.status === "working";
                    return (
                      <tr key={v.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="font-bold text-navy font-mono">{v.plate_number}</div>
                          <div className="text-2xs text-gray-400">
                            {v.make_model} ({v.year}) • {v.hub_city}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {v.driver_name ? (
                            <div>
                              <div className="font-semibold text-gray-800 flex items-center gap-1.5 flex-wrap">
                                <span>{v.driver_name}</span>
                                {v.is_driver_red_flagged && (
                                  <RedFlagBadge reason={v.driver_red_flag_reason} size="xs" />
                                )}
                              </div>
                              {v.driver_arrears_mad > 0 && (
                                <span className="text-2xs text-red-600 font-bold block">
                                  Impayé: {v.driver_arrears_mad.toLocaleString()} MAD
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 block">
                                Mgr: {v.fleet_manager || "Mohamed Aziz"}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-gray-400 italic block">Non assigné</span>
                              <span className="text-[10px] text-slate-400 block">
                                Mgr: {v.fleet_manager || "Mohamed Aziz"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-2xs font-bold px-2.5 py-0.5 rounded-md ${
                              isActif
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : v.status === "Available" || v.status === "Disponible"
                                ? "bg-sky-50 text-sky-800 border border-sky-200"
                                : v.status === "missing_document"
                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                : v.status === "In garage" || v.status === "maintenance"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {v.status === "missing_document" ? "Docs Manquants" : v.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          {isActif ? (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-md font-bold">
                              👤 {v.driver_tenure_days || 1} j (actif)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold">
                              ⏸️ {v.inactive_days} j (arrêt)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-amber-800 font-mono">
                          {v.opportunity_loss_mad > 0
                            ? `${v.opportunity_loss_mad.toLocaleString()} MAD`
                            : "0 MAD"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-blue-800 font-mono">
                          {v.direct_expenses_mad > 0
                            ? `${v.direct_expenses_mad.toLocaleString()} MAD`
                            : "0 MAD"}
                          {v.expense_count > 0 && (
                            <span className="block text-3xs text-gray-400">
                              ({v.expense_count} frais)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-navy text-sm font-mono">
                          {v.total_cost_mad.toLocaleString()} MAD
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => {
                              setSelectedVehicleForExpense(v);
                              setIsExpenseModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-navy/5 hover:bg-navy text-navy hover:text-white rounded-lg text-2xs font-bold transition-all cursor-pointer"
                          >
                            + Frais
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <AddExpenseModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          initialVehicle={selectedVehicleForExpense}
          onSuccess={() => {
            fetchFinancialReport();
          }}
        />
      )}

      {/* Direct WhatsApp CRM Modal */}
      <WhatsAppDirectModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        target={directWhatsAppTarget}
      />
    </div>
  );
}
