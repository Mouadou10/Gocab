"use client";

/**
 * Global Executive Operations & BI Command Center — DashboardView
 *
 * Crafted with Senior Figma Product Design & Canva Visual Storytelling Principles:
 * - Clean neutral-surface card system (80/20 semantic accent rule, zero rainbow border clutter)
 * - Spacious 2x2 Bento Grid for the 4 Operational Pillars (zero text truncation)
 * - Interactive Proportional Fleet DNA Bar & SVG Radial Global Score Gauge
 * - Sticky Chapter Navigation Switcher (Vue Complète or focused 1-click views)
 * - Date-Effective Daily Target Engine & In-Dashboard Daily Target Configurator
 */

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  TrendingDown,
  Car,
  Users,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Download,
  Search,
  CreditCard,
  Clock,
  RefreshCw,
  MessageCircle,
  UserMinus,
  Layers,
  Activity,
  Briefcase,
  Target,
  Sparkles,
  ArrowUpRight,
  SlidersHorizontal,
  Building2,
  Wrench,
  FileWarning,
  ChevronRight,
  Plus,
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
  Legend,
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

  // Churn & Uncollected Debt on Fired Drivers
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

  // Collection & Debt Metrics
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
type DashboardChapter = "ALL" | "TEAMS" | "FLEET" | "DEBT_PORTFOLIO" | "VEHICLES";

export default function DashboardView() {
  useLanguage();
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
  const [dailyTargets, setDailyTargets] = useState<any | null>(null);
  const [showDailyTargetPanel, setShowDailyTargetPanel] = useState(false);
  const [targetEditDate, setTargetEditDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [targetEditCalls, setTargetEditCalls] = useState<number>(133);
  const [targetEditFixed, setTargetEditFixed] = useState<number>(40);
  const [targetEditAttended, setTargetEditAttended] = useState<number>(26);
  const [targetEditPreorders, setTargetEditPreorders] = useState<number>(10);
  const [isSavingDailyTarget, setIsSavingDailyTarget] = useState(false);
  const [churnedDriversLedger, setChurnedDriversLedger] = useState<ChurnedDriverEntry[]>([]);
  const [vehicles, setVehicles] = useState<VehicleFinancialItem[]>([]);
  const [dailyCollectionsSummary, setDailyCollectionsSummary] = useState<any>(null);
  const [redDrivers, setRedDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Navigation & Slicer State
  const [activeChapter, setActiveChapter] = useState<DashboardChapter>("ALL");
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

  const vehicleTableRef = useRef<HTMLDivElement | null>(null);

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
        setDailyTargets(finData.dailyTargets || null);
        if (finData.dailyTargets?.activeSnapshot) {
          const snap = finData.dailyTargets.activeSnapshot;
          setTargetEditCalls(Number(snap.target_daily_calls) || 133);
          setTargetEditFixed(Number(snap.target_daily_training_fixed) || 40);
          setTargetEditAttended(Number(snap.target_daily_attended) || 26);
          setTargetEditPreorders(Number(snap.target_daily_preorders) || 10);
        }
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

  // Filter & jump to vehicle table helper
  const handleSelectFleetStatusFilter = (nextStatus: string) => {
    setStatusFilter((prev) => (prev === nextStatus ? "ALL" : nextStatus));
    if (activeChapter !== "ALL" && activeChapter !== "VEHICLES") {
      setActiveChapter("VEHICLES");
    } else {
      setTimeout(() => {
        vehicleTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

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

  const handleSaveDailyTargetForDate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDailyTarget(true);
    try {
      const existingSnap = dailyTargets?.activeSnapshot || {};
      const payloadTargets = {
        ...existingSnap,
        target_daily_calls: Number(targetEditCalls) || 50,
        target_daily_training_fixed: Number(targetEditFixed) || 15,
        target_daily_attended: Number(targetEditAttended) || 10,
        target_daily_preorders: Number(targetEditPreorders) || 4,
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "department_weekly_targets",
          value: JSON.stringify(payloadTargets),
          effective_date: targetEditDate,
        }),
      });

      if (res.ok) {
        toast.success(
          `Objectif journalier fixé pour le ${targetEditDate} (${payloadTargets.target_daily_calls} appels/j · ${payloadTargets.target_daily_training_fixed} form./j)`
        );
        await fetchFinancialReport();
      } else {
        toast.error("Erreur lors de la sauvegarde de l'objectif journalier");
      }
    } catch {
      toast.error("Erreur réseau lors de la sauvegarde");
    } finally {
      setIsSavingDailyTarget(false);
    }
  };

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
      <div className="flex h-[65vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white px-8 py-7 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="w-11 h-11 border-4 border-slate-200 border-t-[#1E3A5F] rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">
              Synchronisation du Command Center Exécutif
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Agrégation des équipes, cibles journalières, flotte et créances...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const PIE_COLORS = ["#10B981", "#0EA5E9", "#F59E0B", "#F43F5E", "#8B5CF6"];

  const fleetStatusPieData = [
    { name: "En Service", value: summary?.active_vehicles || 0, pct: summary?.utilization_rate || 0, color: "#10B981" },
    { name: "Disponibles", value: summary?.available_vehicles || 0, pct: summary?.available_vehicles_pct || 0, color: "#0EA5E9" },
    { name: "Maintenance", value: summary?.in_repair_vehicles || 0, pct: summary?.maintenance_vehicles_pct || 0, color: "#F59E0B" },
    { name: "Docs Manquants", value: summary?.missing_docs_vehicles || 0, pct: summary?.missing_docs_vehicles_pct || 0, color: "#F43F5E" },
    { name: "Police / Fourrière", value: summary?.police_impounded_vehicles || 0, pct: summary?.police_impounded_vehicles_pct || 0, color: "#8B5CF6" },
  ].filter((d) => d.value > 0);

  const cycleDaysBarData = [
    {
      name: "Dispo Parc",
      Réel: summary?.avg_days_available || 0,
      Cible: summary?.target_max_available_days || 1,
    },
    {
      name: "Docs Manq.",
      Réel: summary?.avg_days_missing_docs || 0,
      Cible: summary?.target_max_missing_docs_days || 3,
    },
    {
      name: "Maintenance",
      Réel: summary?.avg_days_maintenance || 0,
      Cible: summary?.target_max_maintenance_days || 10,
    },
    {
      name: "Rétention Chauf.",
      Réel: summary?.avg_days_assigned_same_driver || 0,
      Cible: 45,
    },
  ];

  const globalScore = summary?.global_team_work_score_pct || 0;
  const globalGrade =
    globalScore >= 95
      ? { label: "EXCELLENT", ring: "#10B981", pill: "bg-emerald-400/20 text-emerald-300 border-emerald-400/30" }
      : globalScore >= 80
      ? { label: "SUR CIBLE", ring: "#38BDF8", pill: "bg-sky-400/20 text-sky-200 border-sky-400/30" }
      : globalScore >= 65
      ? { label: "SOUS TENSION", ring: "#FBBF24", pill: "bg-amber-400/20 text-amber-200 border-amber-400/30" }
      : { label: "ACTION REQUISE", ring: "#FB7185", pill: "bg-rose-500/25 text-rose-200 border-rose-400/30" };

  // SVG Ring Math for Hero Score
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const clampedRingScore = Math.min(100, Math.max(0, globalScore));
  const ringOffset = ringCircumference - (clampedRingScore / 100) * ringCircumference;

  const showTeams = activeChapter === "ALL" || activeChapter === "TEAMS";
  const showFleet = activeChapter === "ALL" || activeChapter === "FLEET";
  const showDebtPortfolio = activeChapter === "ALL" || activeChapter === "DEBT_PORTFOLIO";
  const showVehicles = activeChapter === "ALL" || activeChapter === "VEHICLES";

  const totalFinancialImpact = Math.max(1, summary?.total_fleet_financial_impact_mad || 1);
  const oppLossSharePct = Math.round(((summary?.total_opportunity_loss_mad || 0) / totalFinancialImpact) * 100);
  const badDebtLossSharePct = Math.round(
    ((summary?.lost_debt_fired_drivers_all_time_mad || 0) / totalFinancialImpact) * 100
  );
  const directExpSharePct = Math.max(0, 100 - oppLossSharePct - badDebtLossSharePct);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20 animate-fade-in">
      {/* =====================================================================
          1. EDITORIAL HERO HEADER & TIME PERIOD SLICER
         ===================================================================== */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0B1528] via-[#132544] to-[#1E3A5F] text-white shadow-[0_20px_50px_-15px_rgba(15,23,42,0.35)] border border-white/10">
        {/* Subtle Canva-style ambient light mesh */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative z-10 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            {/* Left Identity & Executive Pulse */}
            <div className="space-y-4 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-100">
                  Direction des Opérations · Executive BI Command
                </span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Tableau de Bord Global GoCab
                </h1>
                <p className="text-sm text-slate-300/90 mt-1 leading-relaxed">
                  Vue consolidée du travail des 4 pôles opérationnels, de la vélocité du parc ({summary?.total_fleet ?? 101} véhicules), du churn et des créances de recouvrement.
                </p>
              </div>

              {/* 4 Instant Executive Pulse Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3.5 py-2.5 backdrop-blur-md">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 block">
                    Parc En Service
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-black font-mono tabular-nums text-emerald-300">
                      {summary?.active_vehicles ?? 0}/{summary?.total_fleet ?? 0}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-200/80">
                      ({summary?.utilization_rate ?? 0}%)
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3.5 py-2.5 backdrop-blur-md">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 block">
                    Affectés + Précom.
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-black font-mono tabular-nums text-sky-300">
                      {summary?.assigned_and_preorders_in_period ?? 0}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300">
                      ({summary?.assigned_vehicles_in_period ?? 0} + {summary?.preorders_in_period ?? 0})
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3.5 py-2.5 backdrop-blur-md">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 block">
                    Cash vs Dette
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg font-black font-mono tabular-nums text-amber-300">
                      {summary?.collection_rate_pct ?? 0}%
                    </span>
                    <span className="text-[11px] font-semibold text-rose-300">
                      ({summary?.collection_debt_pct ?? 0}% dette)
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-3.5 py-2.5 backdrop-blur-md">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 block">
                    Pertes Licenciés
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black font-mono tabular-nums text-rose-300">
                      -{(summary?.lost_debt_fired_drivers_all_time_mad ?? 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold text-rose-200/80">MAD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: SVG Circular Radial Score + Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 xl:shrink-0">
              <div className="flex items-center gap-4 bg-white/[0.08] border border-white/15 backdrop-blur-xl px-5 py-4 rounded-3xl">
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={ringRadius}
                      fill="transparent"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={ringRadius}
                      fill="transparent"
                      stroke={globalGrade.ring}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black font-mono tabular-nums text-white">
                      {globalScore}%
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-300 block">
                    Score Global Équipe
                  </span>
                  <span
                    className={`inline-block text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${globalGrade.pill}`}
                  >
                    {globalGrade.label}
                  </span>
                  <p className="text-[11px] text-slate-300/90 leading-snug max-w-[165px]">
                    Pondéré sur les 4 pôles & cibles journalières actives
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVehicleForExpense(null);
                    setIsExpenseModalOpen(true);
                  }}
                  className="flex-1 sm:w-44 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Nouveau Frais</span>
                </button>

                <button
                  type="button"
                  onClick={exportFinancialCSV}
                  className="flex-1 sm:w-44 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-2xl border border-white/15 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Slicer Bar inside Hero */}
          <div className="pt-4 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 mr-1">
                <Calendar className="w-3.5 h-3.5 text-amber-300" />
                <span>Période d&apos;analyse :</span>
              </span>
              {(
                [
                  { key: "TODAY", label: "Aujourd'hui" },
                  { key: "YESTERDAY", label: "Hier" },
                  { key: "7D", label: "7 Jours" },
                  { key: "THIS_MONTH", label: "Ce Mois" },
                  { key: "30D", label: "30 Jours" },
                  { key: "ALL", label: "Historique" },
                  { key: "CUSTOM", label: "Personnalisé" },
                ] as { key: PeriodPreset; label: string }[]
              ).map((item) => {
                const isSelected = periodPreset === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPeriodPreset(item.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white text-slate-900 shadow-sm font-bold"
                        : "bg-white/[0.06] text-slate-200 hover:bg-white/15"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {periodPreset === "CUSTOM" ? (
              <div className="flex items-center gap-2 flex-wrap bg-white/10 px-3 py-1.5 rounded-2xl border border-white/15">
                <span className="text-[11px] text-slate-200 font-medium">Du</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-white text-slate-900 rounded-lg px-2.5 py-1 text-xs font-semibold"
                />
                <span className="text-[11px] text-slate-200 font-medium">Au</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-white text-slate-900 rounded-lg px-2.5 py-1 text-xs font-semibold"
                />
              </div>
            ) : (
              periodInfo && (
                <div className="flex items-center gap-2.5 text-xs text-slate-200 bg-white/[0.07] px-3.5 py-1.5 rounded-2xl border border-white/10 self-start lg:self-auto">
                  <span className="font-mono tabular-nums font-semibold text-white">
                    {periodInfo.startDate} → {periodInfo.endDate}
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="text-amber-300 font-bold">
                    {periodInfo.workingDays}j ouvrés
                  </span>
                  <button
                    type="button"
                    onClick={fetchFinancialReport}
                    className="ml-1 p-1 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition-colors cursor-pointer"
                    title="Actualiser"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. STICKY FIGMA CHAPTER NAVIGATION BAR (REDUCES COGNITIVE OVERLOAD)
         ===================================================================== */}
      <nav className="sticky top-2 z-20 bg-white/85 backdrop-blur-xl border border-slate-200/80 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.08)] rounded-2xl p-1.5 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {(
            [
              { key: "ALL", label: "Vue Exécutive Complète", icon: Layers },
              { key: "TEAMS", label: "Équipes & Cibles du Jour", icon: Target },
              { key: "FLEET", label: "Flotte (%) & Cycles (AVG Jours)", icon: Car },
              { key: "DEBT_PORTFOLIO", label: "Churn, Dettes & Portefeuilles", icon: CreditCard },
              { key: "VEHICLES", label: `Parc Détaillé (${vehicles.length})`, icon: SlidersHorizontal },
            ] as { key: DashboardChapter; label: string; icon: any }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeChapter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveChapter(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-[#1E3A5F] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-amber-300" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {redDrivers.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveChapter("DEBT_PORTFOLIO")}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-bold shrink-0 cursor-pointer hover:bg-rose-100 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            <span>{redDrivers.length} Alerte(s) Impayés 3j+</span>
          </button>
        )}
      </nav>

      {/* =====================================================================
          3. CHAPTER A: STRATEGIC KPI HEADLINE ROW (4 CLEAN BENTO CARDS)
         ===================================================================== */}
      {(activeChapter === "ALL" || activeChapter === "DEBT_PORTFOLIO" || activeChapter === "TEAMS") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 block">
                Indicateurs Clés de Direction
              </span>
              <h2 className="text-base font-extrabold text-slate-900">
                Acquisition, Churn, Créances Perdues & Taux de Dette
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Assigned Vehicles & Preorders */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_28px_-6px_rgba(15,23,42,0.09)] transition-all p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-indigo-500" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Affectations & Précommandes
                  </span>
                  <span className="p-2 rounded-2xl bg-indigo-50 text-indigo-600">
                    <Car className="w-4 h-4" />
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tight text-slate-900 font-mono tabular-nums">
                    {summary?.assigned_and_preorders_in_period ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    sur {dailyTargets?.scaledPreordersTarget ?? 0} ciblés
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-2.5">
                    <span className="text-[11px] font-medium text-slate-500 block">Affectés</span>
                    <span className="text-base font-black font-mono tabular-nums text-emerald-700">
                      {summary?.assigned_vehicles_in_period ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Cumul: {summary?.assigned_vehicles_all_time ?? 0}
                    </span>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-2.5">
                    <span className="text-[11px] font-medium text-slate-500 block">Précommandes</span>
                    <span className="text-base font-black font-mono tabular-nums text-indigo-700">
                      {summary?.preorders_in_period ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Cumul: {summary?.preorders_all_time ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Conv. Présents Formation</span>
                <span className="font-bold font-mono tabular-nums text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  {summary?.onboarding_conversion_rate_pct ?? 0}% ({summary?.attended_in_period ?? 0} prés.)
                </span>
              </div>
            </div>

            {/* Card 2: % of Churn */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_28px_-6px_rgba(15,23,42,0.09)] transition-all p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Taux de Churn Chauffeurs
                  </span>
                  <span className="p-2 rounded-2xl bg-amber-50 text-amber-600">
                    <UserMinus className="w-4 h-4" />
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-black tracking-tight font-mono tabular-nums ${
                      (summary?.monthly_churn_rate_pct ?? 0) <= (summary?.target_max_churn_rate_pct ?? 20)
                        ? "text-slate-900"
                        : "text-rose-600"
                    }`}
                  >
                    {summary?.monthly_churn_rate_pct ?? 0}%
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      (summary?.monthly_churn_rate_pct ?? 0) <= (summary?.target_max_churn_rate_pct ?? 20)
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {summary?.churn_count_in_period ?? 0} départs
                  </span>
                </div>

                <div className="mt-3 rounded-2xl bg-slate-50 border border-slate-100 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Mohamed Aziz</span>
                    <span className="font-bold font-mono tabular-nums text-slate-800">
                      {portfolioComparison?.aziz.churnRatePct ?? 0}% ({portfolioComparison?.aziz.churnCountPeriod ?? 0})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Mehdi Elyattouti</span>
                    <span className="font-bold font-mono tabular-nums text-slate-800">
                      {portfolioComparison?.mehdi.churnRatePct ?? 0}% ({portfolioComparison?.mehdi.churnCountPeriod ?? 0})
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Plafond mensuel toléré</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                  ≤ {summary?.target_max_churn_rate_pct ?? 20}% / mois
                </span>
              </div>
            </div>

            {/* Card 3: Lost Money After Firing Driver Without Collecting Debt */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_28px_-6px_rgba(15,23,42,0.09)] transition-all p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-rose-600" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Argent Perdu (Licenciés Impayés)
                  </span>
                  <span className="p-2 rounded-2xl bg-rose-50 text-rose-600">
                    <TrendingDown className="w-4 h-4" />
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black tracking-tight text-rose-600 font-mono tabular-nums">
                    -{(summary?.lost_debt_fired_drivers_period_mad ?? 0).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-rose-600">MAD</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Sur la période ({summary?.fired_with_debt_count_period ?? 0} récupérations sans recouvrement)
                </p>

                <div className="mt-3 rounded-2xl bg-rose-50/60 border border-rose-100 p-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-rose-900">Cumul Historique</span>
                  <span className="text-xs font-black font-mono tabular-nums text-rose-700">
                    -{(summary?.lost_debt_fired_drivers_all_time_mad ?? 0).toLocaleString()} MAD ({summary?.fired_with_debt_count_all_time ?? 0})
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Perte moy. / départ</span>
                <span className="font-bold font-mono tabular-nums text-rose-700">
                  -{(summary?.avg_lost_debt_per_fired_driver_mad ?? 0).toLocaleString()} MAD
                </span>
              </div>
            </div>

            {/* Card 4: % of Collection Debt */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_28px_-6px_rgba(15,23,42,0.09)] transition-all p-5 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500" />
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    % Dette de Recouvrement vs Cash
                  </span>
                  <span className="p-2 rounded-2xl bg-emerald-50 text-emerald-600">
                    <CreditCard className="w-4 h-4" />
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
                      % Dette Non Recouvrée
                    </span>
                    <span className="text-3xl font-black tracking-tight text-slate-900 font-mono tabular-nums">
                      {summary?.collection_debt_pct ?? 0}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                      % Encaissé
                    </span>
                    <span className="text-xl font-black text-emerald-600 font-mono tabular-nums">
                      {summary?.collection_rate_pct ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Clean Split Progress Bar */}
                <div className="w-full h-2.5 bg-rose-100 rounded-full overflow-hidden my-3 flex">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, summary?.collection_rate_pct ?? 0)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Encaissé:{" "}
                    <strong className="text-slate-800 font-mono tabular-nums">
                      {(summary?.period_collected_mad ?? 0).toLocaleString()} DH
                    </strong>
                  </span>
                  <span>
                    Attendu:{" "}
                    <strong className="text-slate-800 font-mono tabular-nums">
                      {(summary?.period_expected_collection_mad ?? 0).toLocaleString()} DH
                    </strong>
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Arriérés chauffeurs actifs</span>
                <span className="font-bold font-mono tabular-nums text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">
                  {(summary?.total_driver_arrears_mad ?? 0).toLocaleString()} MAD
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          4. CHAPTER B: 4-PILLAR GLOBAL TEAM WORK BENTO GRID (2x2 — ZERO TRUNCATION)
         ===================================================================== */}
      {showTeams && (
        <section className="bg-white rounded-[28px] border border-slate-200/80 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.05)] p-6 sm:p-7 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-600">
                  Performance Collective & Cibles Dynamiques
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Scorecard des 4 Pôles Opérationnels ({globalScore}%)
              </h2>
              <p className="text-xs text-slate-500">
                Chaque objectif de période est calculé jour par jour selon les cibles quotidiennes réellement en vigueur.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowDailyTargetPanel((v) => !v)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                  showDailyTargetPanel
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border-indigo-200/80"
                }`}
              >
                <Target className="w-4 h-4 text-indigo-600" />
                <span>
                  {showDailyTargetPanel ? "Fermer l'Éditeur Journalier" : "Ajuster les Cibles du Jour & Voir le Détail"}
                </span>
              </button>
            </div>
          </div>

          {/* Sleek Daily Target Timeline Chips */}
          {dailyTargets && (
            <div className="rounded-2xl bg-slate-50/90 border border-slate-200/70 p-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  Calendrier des Cibles ({dailyTargets.workingDays}j ouvrés)
                </span>
                {dailyTargets.segments?.map((seg: any, i: number) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white border border-slate-200/80 text-xs"
                  >
                    <span className="font-mono font-bold text-slate-900">
                      {seg.startDate === seg.endDate ? seg.startDate : `${seg.startDate} → ${seg.endDate}`}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                      {seg.workingDays}j
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {seg.dailyCalls} app./j · {seg.dailyTrainingFixed} fix./j · {seg.dailyAttended} prés./j · {seg.dailyPreorders} aff./j
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-xs font-semibold text-slate-600 xl:text-right shrink-0">
                Cumul Période :{" "}
                <strong className="font-mono tabular-nums text-slate-900">
                  {dailyTargets.scaledCallsTarget} app. · {dailyTargets.scaledTrainingTarget} fix. · {dailyTargets.scaledAttendedTarget} prés. · {dailyTargets.scaledPreordersTarget} aff.
                </strong>
              </div>
            </div>
          )}

          {/* Collapsible Daily Target Configurator & Day-by-Day Table */}
          {showDailyTargetPanel && dailyTargets && (
            <div className="rounded-3xl bg-slate-50 border border-indigo-200/80 p-5 space-y-5 animate-slide-down">
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
                <div className="space-y-1 max-w-xl">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span>Modifier l&apos;Objectif Quotidien d&apos;une Date</span>
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Sélectionnez une date pour adapter ses cibles journalières selon vos besoins opérationnels. Les journées précédentes conservent automatiquement leurs anciennes cibles.
                  </p>
                </div>

                <form onSubmit={handleSaveDailyTargetForDate} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Date d&apos;effet
                    </label>
                    <input
                      type="date"
                      value={targetEditDate}
                      onChange={(e) => {
                        const d = e.target.value;
                        setTargetEditDate(d);
                        const snap = dailyTargets.history
                          ?.slice()
                          .reverse()
                          .find((h: any) => h.effective_date <= d);
                        if (snap) {
                          setTargetEditCalls(Number(snap.target_daily_calls) || 50);
                          setTargetEditFixed(Number(snap.target_daily_training_fixed) || 15);
                          setTargetEditAttended(Number(snap.target_daily_attended) || 10);
                          setTargetEditPreorders(Number(snap.target_daily_preorders) || 4);
                        }
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Appels / Jour
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={targetEditCalls}
                      onChange={(e) => {
                        const c = Math.max(1, Number(e.target.value) || 0);
                        const f = Math.round(c * 0.3);
                        const a = Math.round(f * 0.65);
                        const p = Math.round(f * 0.25);
                        setTargetEditCalls(c);
                        setTargetEditFixed(f);
                        setTargetEditAttended(a);
                        setTargetEditPreorders(p);
                      }}
                      className="w-24 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Fixées / Jour
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={targetEditFixed}
                      onChange={(e) => setTargetEditFixed(Math.max(1, Number(e.target.value) || 0))}
                      className="w-24 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Présents / Jour
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={targetEditAttended}
                      onChange={(e) => setTargetEditAttended(Math.max(1, Number(e.target.value) || 0))}
                      className="w-24 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Affect.+Précom./J
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={targetEditPreorders}
                      onChange={(e) => setTargetEditPreorders(Math.max(1, Number(e.target.value) || 0))}
                      className="w-28 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingDailyTarget}
                    className="px-4 py-2 rounded-xl bg-[#1E3A5F] hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDailyTarget ? "Sauvegarde..." : "Enregistrer la Cible"}
                  </button>
                </form>
              </div>

              {/* Day-by-Day Audit Table */}
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Statut Journée</th>
                      <th className="py-2.5 px-4 text-right">Appels (Réel / Cible)</th>
                      <th className="py-2.5 px-4 text-right">Formations Fixées</th>
                      <th className="py-2.5 px-4 text-right">Présents Formation</th>
                      <th className="py-2.5 px-4 text-right">Affectés + Précom.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyTargets.dailyPerformance
                      ?.slice()
                      .reverse()
                      .map((d: any) => (
                        <tr
                          key={d.date}
                          className={d.isWorkingDay ? "hover:bg-slate-50/80" : "bg-slate-50/40 text-slate-400"}
                        >
                          <td className="py-2 px-4 font-mono tabular-nums font-bold text-slate-800">{d.date}</td>
                          <td className="py-2 px-4">
                            {d.isWorkingDay ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[11px]">
                                Ouvré · Cible {d.effectiveTargetDate}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px]">
                                Repos / Férié
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-right font-mono tabular-nums">
                            <strong className="text-slate-900">{d.actualCalls}</strong> / {d.targetCalls}{" "}
                            {d.isWorkingDay && (
                              <span className={d.callsPct >= 100 ? "text-emerald-600 font-bold" : "text-amber-600"}>
                                ({d.callsPct}%)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-right font-mono tabular-nums">
                            <strong className="text-slate-900">{d.actualTrainingFixed}</strong> / {d.targetTrainingFixed}{" "}
                            {d.isWorkingDay && (
                              <span className={d.trainingFixedPct >= 100 ? "text-emerald-600 font-bold" : "text-amber-600"}>
                                ({d.trainingFixedPct}%)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-right font-mono tabular-nums">
                            <strong className="text-slate-900">{d.actualAttended}</strong> / {d.targetAttended}{" "}
                            {d.isWorkingDay && (
                              <span className={d.attendedPct >= 100 ? "text-emerald-600 font-bold" : "text-amber-600"}>
                                ({d.attendedPct}%)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-right font-mono tabular-nums">
                            <strong className="text-slate-900">{d.actualAssignedAndPreorders}</strong> / {d.targetPreorders}{" "}
                            {d.isWorkingDay && (
                              <span className={d.preordersPct >= 100 ? "text-emerald-600 font-bold" : "text-amber-600"}>
                                ({d.preordersPct}%)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2x2 Spacious Bento Grid — ZERO TRUNCATION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {teamWorkPillars.map((pillar) => {
              const statusTheme =
                pillar.status === "ON_TARGET"
                  ? {
                      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      bar: "bg-emerald-500",
                      dot: "bg-emerald-500",
                      label: "Sur Cible",
                    }
                  : pillar.status === "AT_RISK"
                  ? {
                      badge: "bg-amber-50 text-amber-700 border-amber-200",
                      bar: "bg-amber-500",
                      dot: "bg-amber-500",
                      label: "À Surveiller",
                    }
                  : {
                      badge: "bg-rose-50 text-rose-700 border-rose-200",
                      bar: "bg-rose-500",
                      dot: "bg-rose-500",
                      label: "Sous Seuil",
                    };

              return (
                <div
                  key={pillar.id}
                  className="rounded-3xl bg-white border border-slate-200/85 p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-slate-300 hover:shadow-md transition-all"
                >
                  {/* Pillar Header */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-slate-900">
                            {pillar.title}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                            Pondération {pillar.weightPct}%
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{pillar.agents}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl border font-mono tabular-nums text-sm font-black ${statusTheme.badge}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${statusTheme.dot}`} />
                          <span>{pillar.scorePct}%</span>
                        </div>
                        <span className="block text-[10px] font-semibold text-slate-400 mt-0.5">
                          {statusTheme.label}
                        </span>
                      </div>
                    </div>

                    {/* Smooth Score Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${statusTheme.bar}`}
                        style={{ width: `${Math.min(100, Math.max(4, pillar.scorePct))}%` }}
                      />
                    </div>
                  </div>

                  {/* 3 Spacious Metric Rows (No Truncation) */}
                  <div className="space-y-2.5 pt-1">
                    {pillar.metrics.map((m, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl bg-slate-50/80 border border-slate-100 px-4 py-3 space-y-1.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-700">
                            {m.label}
                          </span>
                          <span className="text-sm font-black font-mono tabular-nums text-[#1E3A5F]">
                            {m.actual}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                          <span className="text-slate-500 leading-snug">{m.subtext}</span>
                          <span className="font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200/70 self-start sm:self-auto shrink-0">
                            Cible : {m.target}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          5. CHAPTER C: FLEET PROPORTIONAL DNA BAR + % CARDS + AVG CYCLE DAYS
         ===================================================================== */}
      {showFleet && (
        <section className="space-y-6">
          {/* Canva-Style Proportional Fleet DNA Bar */}
          <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-600 block">
                  Photographie Temps Réel du Parc
                </span>
                <h2 className="text-lg font-black text-slate-900">
                  Répartition Proportionnelle des {summary?.total_fleet ?? 101} Véhicules (%)
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Cliquez sur un statut pour filtrer la liste des véhicules
              </span>
            </div>

            {/* Full-Width Proportional Multi-Segment Bar */}
            <div className="w-full h-4 rounded-full bg-slate-100 overflow-hidden flex gap-0.5 p-0.5">
              <div
                onClick={() => handleSelectFleetStatusFilter("ACTIVE")}
                className="h-full bg-emerald-500 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-90 transition-all"
                style={{ width: `${summary?.utilization_rate ?? 0}%` }}
                title={`En Service: ${summary?.active_vehicles} (${summary?.utilization_rate}%)`}
              />
              <div
                onClick={() => handleSelectFleetStatusFilter("AVAILABLE")}
                className="h-full bg-sky-500 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-90 transition-all"
                style={{ width: `${summary?.available_vehicles_pct ?? 0}%` }}
                title={`Disponibles: ${summary?.available_vehicles} (${summary?.available_vehicles_pct}%)`}
              />
              <div
                onClick={() => handleSelectFleetStatusFilter("GARAGE")}
                className="h-full bg-amber-500 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-90 transition-all"
                style={{ width: `${summary?.maintenance_vehicles_pct ?? 0}%` }}
                title={`En Maintenance: ${summary?.in_repair_vehicles} (${summary?.maintenance_vehicles_pct}%)`}
              />
              <div
                onClick={() => handleSelectFleetStatusFilter("MISSING_DOCS")}
                className="h-full bg-rose-500 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-90 transition-all"
                style={{ width: `${summary?.missing_docs_vehicles_pct ?? 0}%` }}
                title={`Documents Manquants: ${summary?.missing_docs_vehicles} (${summary?.missing_docs_vehicles_pct}%)`}
              />
              {(summary?.police_impounded_vehicles_pct ?? 0) > 0 && (
                <div
                  onClick={() => handleSelectFleetStatusFilter("POLICE")}
                  className="h-full bg-purple-500 first:rounded-l-full last:rounded-r-full cursor-pointer hover:opacity-90 transition-all"
                  style={{ width: `${summary?.police_impounded_vehicles_pct ?? 0}%` }}
                  title={`Police / Fourrière: ${summary?.police_impounded_vehicles} (${summary?.police_impounded_vehicles_pct}%)`}
                />
              )}
            </div>

            {/* 4 Clean Fleet % Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* % Working */}
              <button
                type="button"
                onClick={() => handleSelectFleetStatusFilter("ACTIVE")}
                className={`text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                  statusFilter === "ACTIVE"
                    ? "bg-emerald-50/70 border-emerald-400 shadow-xs"
                    : "bg-slate-50/70 hover:bg-slate-50 border-slate-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    En Service (Working)
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-lg">
                    {summary?.active_vehicles ?? 0} véh.
                  </span>
                </div>
                <p className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-2">
                  {summary?.utilization_rate ?? 0}%
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cible d&apos;exploitation : ≥ 85%
                </p>
              </button>

              {/* % Available */}
              <button
                type="button"
                onClick={() => handleSelectFleetStatusFilter("AVAILABLE")}
                className={`text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                  statusFilter === "AVAILABLE"
                    ? "bg-sky-50/70 border-sky-400 shadow-xs"
                    : "bg-slate-50/70 hover:bg-slate-50 border-slate-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    Disponibles au Parc
                  </span>
                  <span className="text-xs font-mono font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-lg">
                    {summary?.available_vehicles ?? 0} véh.
                  </span>
                </div>
                <p className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-2">
                  {summary?.available_vehicles_pct ?? 0}%
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Manque à gagner : {((summary?.available_vehicles ?? 0) * 250).toLocaleString()} DH/j
                </p>
              </button>

              {/* % Missing Docs */}
              <button
                type="button"
                onClick={() => handleSelectFleetStatusFilter("MISSING_DOCS")}
                className={`text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                  statusFilter === "MISSING_DOCS"
                    ? "bg-rose-50/70 border-rose-400 shadow-xs"
                    : "bg-slate-50/70 hover:bg-slate-50 border-slate-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Documents Manquants
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-lg">
                    {summary?.missing_docs_vehicles ?? 0} véh.
                  </span>
                </div>
                <p className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-2">
                  {summary?.missing_docs_vehicles_pct ?? 0}%
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cible conformité : 0% (≤ 3j max)
                </p>
              </button>

              {/* % Maintenance */}
              <button
                type="button"
                onClick={() => handleSelectFleetStatusFilter("GARAGE")}
                className={`text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                  statusFilter === "GARAGE"
                    ? "bg-amber-50/70 border-amber-400 shadow-xs"
                    : "bg-slate-50/70 hover:bg-slate-50 border-slate-200/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    En Maintenance
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-lg">
                    {summary?.in_repair_vehicles ?? 0} véh.
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-2xl font-black font-mono tabular-nums text-slate-900">
                    {summary?.maintenance_vehicles_pct ?? 0}%
                  </p>
                  {(summary?.police_impounded_vehicles ?? 0) > 0 && (
                    <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      +{summary?.police_impounded_vehicles} Police ({summary?.police_impounded_vehicles_pct}%)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Coût d&apos;arrêt : -{((summary?.in_repair_vehicles ?? 0) * 250).toLocaleString()} DH/j
                </p>
              </button>
            </div>
          </div>

          {/* AVG Cycle Days Row + Benchmark Chart */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* 4 AVG Days Cards (8 columns on XL) */}
            <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. AVG Days Same Driver */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      AVG Jours Même Chauffeur
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700">
                      Rétention
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                      {summary?.avg_days_assigned_same_driver ?? 0}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      jours (médiane {summary?.median_days_assigned_same_driver ?? 0}j)
                    </span>
                  </div>

                  {/* Cohorts */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 py-1.5">
                      <span className="text-[10px] text-slate-400 block">&lt; 15 jours</span>
                      <strong className="text-xs font-mono font-bold text-slate-700">
                        {summary?.tenure_cohorts?.under15Days ?? 0}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 py-1.5">
                      <span className="text-[10px] text-slate-400 block">15 – 45 j</span>
                      <strong className="text-xs font-mono font-bold text-slate-700">
                        {summary?.tenure_cohorts?.between15And45Days ?? 0}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 py-1.5">
                      <span className="text-[10px] text-emerald-700 block">&gt; 45 jours</span>
                      <strong className="text-xs font-mono font-bold text-emerald-800">
                        {summary?.tenure_cohorts?.over45Days ?? 0}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Aziz : <strong className="text-slate-800">{portfolioComparison?.aziz.avgDriverTenureDays ?? 0}j</strong></span>
                  <span>Mehdi : <strong className="text-slate-800">{portfolioComparison?.mehdi.avgDriverTenureDays ?? 0}j</strong></span>
                </div>
              </div>

              {/* 2. AVG Days Available */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      AVG Jours Statut Disponible
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        (summary?.avg_days_available ?? 0) <= (summary?.target_max_available_days ?? 1)
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {(summary?.avg_days_available ?? 0) <= (summary?.target_max_available_days ?? 1)
                        ? "✓ Conforme SLA"
                        : "À accélérer"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                      {summary?.avg_days_available ?? 0}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">jours au parc</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Temps moyen de rotation avant réaffectation d&apos;un véhicule libre à un nouveau chauffeur qualifié.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Cible SLA Onboarding</span>
                  <span className="font-bold font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg">
                    ≤ {summary?.target_max_available_days ?? 1.0} jour
                  </span>
                </div>
              </div>

              {/* 3. AVG Days Missing Docs */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      AVG Jours Documents Manquants
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        (summary?.avg_days_missing_docs ?? 0) <= (summary?.target_max_missing_docs_days ?? 3)
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {(summary?.avg_days_missing_docs ?? 0) <= (summary?.target_max_missing_docs_days ?? 3)
                        ? "✓ Conforme SLA"
                        : "Dépassement SLA"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                      {summary?.avg_days_missing_docs ?? 0}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">jours bloqués</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Durée moyenne d&apos;immobilisation administrative (assurance, autorisation, visite technique).
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Cible SLA Terrain</span>
                  <span className="font-bold font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg">
                    ≤ {summary?.target_max_missing_docs_days ?? 3.0} jours
                  </span>
                </div>
              </div>

              {/* 4. AVG Days Maintenance */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      AVG Jours en Maintenance
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        (summary?.avg_days_maintenance ?? 0) <= (summary?.target_max_maintenance_days ?? 10)
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {(summary?.avg_days_maintenance ?? 0) <= (summary?.target_max_maintenance_days ?? 10)
                        ? "✓ ≤ 10j"
                        : "Dépassement > 10j"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                      {summary?.avg_days_maintenance ?? 0}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">jours au garage</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Temps moyen de séjour atelier pour réparation mécanique, sinistre ou carrosserie.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Cible SLA Maintenance</span>
                  <span className="font-bold font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg">
                    ≤ {summary?.target_max_maintenance_days ?? 10} jours
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Cycle Benchmark Chart (4 columns on XL) */}
            <div className="xl:col-span-4 bg-white rounded-3xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 block">
                  Benchmark Durées (Jours)
                </span>
                <h3 className="text-sm font-extrabold text-slate-900 mt-0.5">
                  Durée Réelle vs Cible Opérationnelle
                </h3>
              </div>

              <div className="h-56 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cycleDaysBarData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94A3B8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "14px",
                        border: "1px solid #E2E8F0",
                        fontSize: "12px",
                        boxShadow: "0 10px 25px -5px rgba(15,23,42,0.1)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                    <Bar dataKey="Réel" fill="#1E3A5F" radius={[6, 6, 0, 0]} barSize={20} />
                    <Bar dataKey="Cible" fill="#94A3B8" radius={[6, 6, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          6. CHAPTER D: PORTFOLIO DUEL (AZIZ VS MEHDI), CHURN BAD DEBT LEDGER & RED ALERTS
         ===================================================================== */}
      {showDebtPortfolio && (
        <section className="space-y-6">
          {/* Portfolio Comparison + Cost Impact Breakdown */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Manager Duel (8 cols) */}
            <div className="xl:col-span-8 bg-white rounded-[28px] border border-slate-200/80 p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-600 block">
                    Performance par Portefeuille Gestionnaire
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    Mohamed Aziz ({portfolioComparison?.aziz.totalVehicles ?? 75} véh.) vs Mehdi Elyattouti ({portfolioComparison?.mehdi.totalVehicles ?? 26} véh.)
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  Recouvrement, Churn & Rétention comparés
                </span>
              </div>

              {portfolioComparison && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[portfolioComparison.aziz, portfolioComparison.mehdi].map((mgr) => (
                    <div
                      key={mgr.key}
                      className="rounded-3xl bg-slate-50/70 border border-slate-200/80 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900">{mgr.name}</h4>
                          <p className="text-xs text-slate-500">
                            {mgr.activeVehicles} en service sur {mgr.totalVehicles} véhicules
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-2xl bg-[#1E3A5F] text-white font-mono tabular-nums text-xs font-black">
                          {mgr.utilizationPct}% actif
                        </span>
                      </div>

                      {/* Collection Mini Bar */}
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600">Taux de Recouvrement</span>
                          <span className="font-mono font-black text-emerald-700">
                            {mgr.collectionRatePct}%{" "}
                            <span className="text-rose-500 font-semibold">({mgr.collectionDebtPct}% dette)</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-rose-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, mgr.collectionRatePct)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                          <span>Collecté: {mgr.collectedMAD.toLocaleString()} DH</span>
                          <span>Attendu: {mgr.expectedMAD.toLocaleString()} DH</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/60">
                          <span className="text-[10px] text-slate-400 block">Churn</span>
                          <strong className="text-xs font-mono font-black text-slate-800">
                            {mgr.churnRatePct}% ({mgr.churnCountPeriod})
                          </strong>
                        </div>
                        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/60">
                          <span className="text-[10px] text-slate-400 block">Dette Licenciés</span>
                          <strong className="text-xs font-mono font-black text-rose-600">
                            -{mgr.lostDebtAllTimeMAD.toLocaleString()}
                          </strong>
                        </div>
                        <div className="bg-white rounded-2xl p-2.5 border border-slate-200/60">
                          <span className="text-[10px] text-slate-400 block">Maint. / Chauf.</span>
                          <strong className="text-xs font-mono font-black text-slate-800">
                            {mgr.avgMaintenanceDays}j / {mgr.avgDriverTenureDays}j
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cost Impact Structure Card (4 cols) */}
            <div className="xl:col-span-4 bg-white rounded-[28px] border border-slate-200/80 p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] flex flex-col justify-between space-y-5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-rose-600 block">
                  Coût d&apos;Exploitation & Pertes
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Impact Financier Consolidé
                </h3>
                <p className="text-3xl font-black font-mono tabular-nums text-slate-900 mt-3">
                  {(summary?.total_fleet_financial_impact_mad ?? 0).toLocaleString()}{" "}
                  <span className="text-sm font-bold text-slate-400">MAD</span>
                </p>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">
                      1. Inactivité Parc ({summary?.inactive_vehicles} véh. × 250 DH/j)
                    </span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {(summary?.total_opportunity_loss_mad ?? 0).toLocaleString()} DH
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${oppLossSharePct}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">
                      2. Créances Perdues Licenciés ({summary?.fired_with_debt_count_all_time ?? 0} cas)
                    </span>
                    <span className="font-mono tabular-nums font-bold text-rose-600">
                      {(summary?.lost_debt_fired_drivers_all_time_mad ?? 0).toLocaleString()} DH
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${badDebtLossSharePct}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600">
                      3. Dépenses Directes Garage & Police
                    </span>
                    <span className="font-mono tabular-nums font-bold text-indigo-700">
                      {(summary?.total_direct_expenses_mad ?? 0).toLocaleString()} DH
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${directExpSharePct}%` }} />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Burn-rate d&apos;inactivité actuel</span>
                <strong className="font-mono tabular-nums text-amber-700">
                  -{(summary?.daily_opportunity_loss_burn_rate ?? 0).toLocaleString()} MAD / jour
                </strong>
              </div>
            </div>
          </div>

          {/* Critical Red Unpaid Drivers (3rd Day Alert) */}
          <div className="bg-white rounded-[28px] border border-slate-200/80 p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3">
                <span className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Alertes Rouges Recouvrement — Chauffeurs à 3+ Jours Sans Paiement
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Prévention proactive avant immobilisation ou licenciement avec perte sèche.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 px-4 py-2 rounded-2xl text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Encaissé Aujourd&apos;hui
                </span>
                <span className="text-sm font-black font-mono tabular-nums text-emerald-600">
                  {dailyCollectionsSummary?.totalClearedTodayMAD?.toLocaleString() || 0} /{" "}
                  {dailyCollectionsSummary?.totalExpectedTodayMAD?.toLocaleString() || 0} MAD
                </span>
              </div>
            </div>

            {redDrivers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {redDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="rounded-2xl bg-slate-50/70 hover:bg-white border border-rose-200/80 p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">{driver.fullName}</span>
                          {driver.isRedFlagged && <RedFlagBadge reason={driver.redFlagReason} />}
                        </div>
                        <p className="text-xs font-mono text-slate-500">{driver.phoneSanitized}</p>
                        {driver.vehicle && (
                          <span className="inline-block font-mono font-bold text-[11px] bg-white text-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200">
                            {driver.vehicle.plate_number}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-bold bg-rose-600 text-white px-2.5 py-0.5 rounded-full shrink-0">
                        {driver.consecutiveUnpaidDays || 3}j impayés
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/70">
                      <div>
                        <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                          Arriérés cumulés
                        </span>
                        <strong className="text-sm font-black font-mono tabular-nums text-rose-600">
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
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Relancer WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 flex items-center gap-3 text-xs font-medium text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Aucun chauffeur en dépassement critique (3+ jours sans paiement). Les encaissements sont réguliers.
                </span>
              </div>
            )}
          </div>

          {/* Audit Ledger: Fired / Recovered Drivers & Uncollected Bad Debt */}
          <div className="bg-white rounded-[28px] border border-slate-200/80 p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3">
                <span className="p-2.5 bg-slate-100 text-slate-700 rounded-2xl shrink-0">
                  <UserMinus className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Registre d&apos;Audit — Chauffeurs Sortants / Licenciés & Créances Perdues
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historique détaillé de chaque départ chauffeur et du montant exact non recouvré lors de la récupération du véhicule.
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold self-start">
                <button
                  type="button"
                  onClick={() => setChurnScopeFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    churnScopeFilter === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                  }`}
                >
                  Tous ({churnedDriversLedger.length})
                </button>
                <button
                  type="button"
                  onClick={() => setChurnScopeFilter("PERIOD")}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    churnScopeFilter === "PERIOD" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
                  }`}
                >
                  Période ({summary?.churn_count_in_period ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setChurnScopeFilter("WITH_DEBT")}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    churnScopeFilter === "WITH_DEBT"
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "text-rose-700 hover:bg-rose-50"
                  }`}
                >
                  Avec Dette ({summary?.fired_with_debt_count_all_time ?? 0})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 uppercase text-[10px] tracking-wider text-slate-500 border-b border-slate-200/80 font-bold sticky top-0">
                  <tr>
                    <th className="py-3.5 px-4">Date Sortie</th>
                    <th className="py-3.5 px-4">Chauffeur</th>
                    <th className="py-3.5 px-4">Immatriculation</th>
                    <th className="py-3.5 px-4">Portefeuille</th>
                    <th className="py-3.5 px-4">Motif / Rapport</th>
                    <th className="py-3.5 px-4 text-center">Impayés (J)</th>
                    <th className="py-3.5 px-4 text-right">Dette Perdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredChurnLedger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Aucun enregistrement pour ce filtre.
                      </td>
                    </tr>
                  ) : (
                    filteredChurnLedger.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {new Date(item.churned_at).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.driver_name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{item.driver_phone}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                            {item.plate_number}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              item.managerKey === "mehdi"
                                ? "bg-amber-50 text-amber-800 border border-amber-200/70"
                                : "bg-sky-50 text-sky-800 border border-sky-200/70"
                            }`}
                          >
                            {item.manager}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-md text-slate-600 leading-snug">
                          {item.reason}
                        </td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums">
                          {item.unpaid_days > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold">
                              {item.unpaid_days}j
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-black whitespace-nowrap">
                          {item.lost_debt_mad > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200/70">
                              -{item.lost_debt_mad.toLocaleString()} MAD
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">0 MAD</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          7. CHAPTER E: DETAILED PER-VEHICLE FINANCIAL & OPERATIONAL TABLE
         ===================================================================== */}
      {showVehicles && (
        <section ref={vehicleTableRef} className="bg-white rounded-[28px] border border-slate-200/80 p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.05)] space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 block">
                Inventaire Analytique par Actif
              </span>
              <h2 className="text-lg font-black text-slate-900">
                Parc GoCab — Durée d&apos;Affectation, Coûts & Statuts ({filteredVehicles.length} véhicules)
              </h2>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Rechercher plaque, chauffeur, gestionnaire..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-all"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:bg-white"
              >
                <option value="ALL">Tous les statuts ({vehicles.length})</option>
                <option value="ACTIVE">En Service ({summary?.active_vehicles ?? 0})</option>
                <option value="AVAILABLE">Disponibles ({summary?.available_vehicles ?? 0})</option>
                <option value="MISSING_DOCS">Documents Manquants ({summary?.missing_docs_vehicles ?? 0})</option>
                <option value="GARAGE">En Maintenance ({summary?.in_repair_vehicles ?? 0})</option>
                <option value="POLICE">Police / Fourrière ({summary?.police_impounded_vehicles ?? 0})</option>
                <option value="INACTIVE">Tous les Inactifs ({summary?.inactive_vehicles ?? 0})</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 uppercase text-[10px] tracking-wider text-slate-500 border-b border-slate-200/80 font-bold">
                <tr>
                  <th className="py-3.5 px-5">Véhicule</th>
                  <th className="py-3.5 px-4">Chauffeur & Portefeuille</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-center">Ancienneté / Arrêt</th>
                  <th className="py-3.5 px-4 text-right">Perte Inactivité</th>
                  <th className="py-3.5 px-4 text-right">Frais Directs</th>
                  <th className="py-3.5 px-4 text-right text-slate-900">Coût Total</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Aucun véhicule ne correspond à votre recherche.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((v) => {
                    const isActif =
                      v.status === "Actif" || v.status === "In service" || v.status === "working";
                    return (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-900 font-mono">{v.plate_number}</div>
                          <div className="text-[11px] text-slate-400">
                            {v.make_model} ({v.year}) · {v.hub_city}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {v.driver_name ? (
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                <span>{v.driver_name}</span>
                                {v.is_driver_red_flagged && (
                                  <RedFlagBadge reason={v.driver_red_flag_reason} size="xs" />
                                )}
                              </div>
                              {v.driver_arrears_mad > 0 && (
                                <span className="text-[11px] text-rose-600 font-mono font-bold block">
                                  Arriérés : {v.driver_arrears_mad.toLocaleString()} MAD
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 block">
                                Portefeuille : {v.fleet_manager || "Mohamed Aziz"}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="text-slate-400 italic block">Aucun chauffeur</span>
                              <span className="text-[11px] text-slate-400 block">
                                Portefeuille : {v.fleet_manager || "Mohamed Aziz"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                              isActif
                                ? "bg-emerald-50 text-emerald-700"
                                : v.status === "Available" || v.status === "Disponible"
                                ? "bg-sky-50 text-sky-700"
                                : v.status === "missing_document"
                                ? "bg-rose-50 text-rose-700"
                                : v.status === "In garage" || v.status === "maintenance"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActif
                                  ? "bg-emerald-500"
                                  : v.status === "Available" || v.status === "Disponible"
                                  ? "bg-sky-500"
                                  : v.status === "missing_document"
                                  ? "bg-rose-500"
                                  : v.status === "In garage" || v.status === "maintenance"
                                  ? "bg-amber-500"
                                  : "bg-purple-500"
                              }`}
                            />
                            {v.status === "missing_document"
                              ? "Docs Manquants"
                              : isActif
                              ? "En Service"
                              : v.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono tabular-nums whitespace-nowrap">
                          {isActif ? (
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-[11px]">
                              {v.driver_tenure_days || 1} j (même chauf.)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg font-bold text-[11px]">
                              {v.inactive_days} j d&apos;arrêt
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-amber-700 whitespace-nowrap">
                          {v.opportunity_loss_mad > 0
                            ? `${v.opportunity_loss_mad.toLocaleString()} MAD`
                            : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-indigo-700 whitespace-nowrap">
                          {v.direct_expenses_mad > 0
                            ? `${v.direct_expenses_mad.toLocaleString()} MAD`
                            : "—"}
                          {v.expense_count > 0 && (
                            <span className="block text-[10px] text-slate-400">
                              {v.expense_count} pièce(s)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 font-mono tabular-nums whitespace-nowrap">
                          {v.total_cost_mad.toLocaleString()} MAD
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVehicleForExpense(v);
                              setIsExpenseModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-[#1E3A5F] text-slate-700 hover:text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer"
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
        </section>
      )}

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
