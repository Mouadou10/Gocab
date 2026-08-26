"use client";

/**
 * Enhanced Executive Dashboard & Financial Command Center — DashboardView
 *
 * Features:
 * 1. Opportunity Loss Calculator (250 MAD / day per inactive / available vehicle)
 * 2. Per-Vehicle Financial Breakdown Table (Direct Expenses + Inactivity Opportunity Loss)
 * 3. Clear Department Performance Targets & Accountabilities for Every Agent
 * 4. Exportable CSV Financial Summary for Accounting
 */

import { useEffect, useState, useMemo } from "react";
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
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building2,
  Clock,
  ChevronRight,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import toast from "react-hot-toast";
import AddExpenseModal from "./AddExpenseModal";

interface FinancialSummary {
  total_fleet: number;
  active_vehicles: number;
  available_vehicles: number;
  in_repair_vehicles: number;
  impounded_vehicles: number;
  inactive_vehicles: number;
  utilization_rate: number;
  daily_opportunity_cost_per_vehicle: number;
  daily_opportunity_loss_burn_rate: number;
  total_opportunity_loss_mad: number;
  total_direct_expenses_mad: number;
  total_driver_arrears_mad: number;
  total_fleet_financial_impact_mad: number;
  expenses_by_category: Record<string, number>;
}

interface VehicleFinancialItem {
  id: string;
  plate_number: string;
  make_model: string;
  year: number;
  hub_city: string;
  status: string;
  driver_name: string | null;
  driver_phone: string | null;
  driver_arrears_mad: number;
  inactive_days: number;
  opportunity_loss_mad: number;
  direct_expenses_mad: number;
  total_cost_mad: number;
  expense_count: number;
  current_mileage: number;
}

interface AgentTargetGroup {
  role: string;
  title: string;
  agentName: string;
  kpis: {
    name: string;
    actual: number;
    target: number;
    unit: string;
    isPercentage: boolean;
    status: "ON_TARGET" | "AT_RISK" | "BREACHED";
  }[];
}

export default function DashboardView() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [vehicles, setVehicles] = useState<VehicleFinancialItem[]>([]);
  const [agentTargets, setAgentTargets] = useState<Record<string, AgentTargetGroup>>({});
  const [dailyCollectionsSummary, setDailyCollectionsSummary] = useState<any>(null);
  const [redDrivers, setRedDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedVehicleForExpense, setSelectedVehicleForExpense] = useState<any | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const fetchFinancialReport = async () => {
    try {
      setIsLoading(true);
      const [finRes, colRes] = await Promise.all([
        fetch("/api/reports/financial"),
        fetch("/api/collections/driver-daily"),
      ]);

      const finData = await finRes.json();
      const colData = await colRes.json();

      if (finData.summary) {
        setSummary(finData.summary);
        setVehicles(finData.vehicles || []);
        setAgentTargets(finData.agentTargets || {});
      }

      if (colData.drivers) {
        setDailyCollectionsSummary(colData.summary);
        setRedDrivers(colData.drivers.filter((d: any) => d.isCriticalRed));
      }
    } catch (err) {
      console.error("Failed to load financial report:", err);
      toast.error("Erreur de chargement du rapport financier");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialReport();
  }, []);

  // Filtered vehicles for the financial table
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesSearch =
        v.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.make_model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.driver_name && v.driver_name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === "INACTIVE" && v.status === "Actif") return false;
      if (statusFilter === "ACTIVE" && v.status !== "Actif") return false;
      if (statusFilter === "AVAILABLE" && v.status !== "Available" && v.status !== "Disponible") return false;
      if (statusFilter === "GARAGE" && v.status !== "In garage" && v.status !== "In service") return false;
      if (statusFilter === "POLICE" && v.status !== "impounded by police" && v.status !== "Accident" && v.status !== "Blocked") return false;

      return true;
    });
  }, [vehicles, searchQuery, statusFilter]);

  // Export Financial CSV
  const exportFinancialCSV = () => {
    if (vehicles.length === 0) return;

    const headers = "Immatriculation,Modele,Chauffeur,Statut,Jours Inactivite,Perte Opportunite (250 MAD/j),Frais Directs (MAD),Cout Total GoCab (MAD),Impayes Chauffeur (MAD)\n";
    const rows = vehicles
      .map(
        (v) =>
          `"${v.plate_number}","${v.make_model}","${v.driver_name || "Non assigné"}","${v.status}",${v.inactive_days},${v.opportunity_loss_mad},${v.direct_expenses_mad},${v.total_cost_mad},${v.driver_arrears_mad}`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapport_financier_flotte_gocab_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Rapport financier exporté en CSV!");
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center animate-fadeIn">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
          <span className="text-sm font-semibold text-gray-600">Génération du Rapport Financier Exécutif...</span>
        </div>
      </div>
    );
  }

  const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6"];

  const fleetStatusPieData = [
    { name: "Actifs sur route", value: summary?.active_vehicles || 0 },
    { name: "Disponibles (250 DH/j)", value: summary?.available_vehicles || 0 },
    { name: "En Garage / Réparation", value: summary?.in_repair_vehicles || 0 },
    { name: "Fourrière / Accidents", value: summary?.impounded_vehicles || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 animate-fadeIn">
      {/* Top Executive Header Banner */}
      <div className="bg-gradient-to-r from-navy via-[#1b3453] to-[#0d1e38] text-white p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-gold/20 text-gold rounded-xl border border-gold/30">
              <DollarSign className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Tableau de Bord Financier & Opérationnel
            </h1>
          </div>
          <p className="text-white/70 text-sm">
            Contrôle des coûts de réparation, coût d'opportunité des véhicules à l'arrêt (<span className="text-gold font-bold">250 DH / jour</span> d'inactivité) et suivi des objectifs par collaborateur.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <button
            onClick={exportFinancialCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all shadow-2xs"
          >
            <Download className="w-4 h-4 text-gold" />
            <span>Exporter Rapport (CSV)</span>
          </button>

          <button
            onClick={() => {
              setSelectedVehicleForExpense(null);
              setIsExpenseModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gold hover:bg-gold/90 text-navy font-bold rounded-xl text-xs transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ajouter un Frais</span>
          </button>
        </div>
      </div>

      {/* Primary Financial Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Inactivity Opportunity Loss */}
        <div className="bg-white p-6 rounded-3xl border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Perte d'Opportunité Flotte</span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <p className="text-2xl sm:text-3xl font-black text-amber-900">
              {summary?.total_opportunity_loss_mad.toLocaleString()}{" "}
              <span className="text-sm font-semibold text-amber-700">MAD</span>
            </p>
            <p className="text-2xs text-amber-600 mt-1 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Calculé à <strong>250 MAD / jour</strong> d'arrêt
            </p>
          </div>
          <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-2xs text-gray-500">
            <span>Burn rate actuel :</span>
            <strong className="text-red-600 font-bold">
              -{summary?.daily_opportunity_loss_burn_rate.toLocaleString()} MAD / jour
            </strong>
          </div>
        </div>

        {/* Card 2: Direct Expenses (Repairs, Police, Tires) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dépenses Directes Garage / Police</span>
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <p className="text-2xl sm:text-3xl font-black text-navy">
              {summary?.total_direct_expenses_mad.toLocaleString()}{" "}
              <span className="text-sm font-semibold text-gray-500">MAD</span>
            </p>
            <p className="text-2xs text-gray-400 mt-1 font-medium">
              Réparations, fourrière, entretien & remorquage
            </p>
          </div>
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-2xs text-gray-500">
            <span>Impact financier global :</span>
            <strong className="text-navy font-bold">
              {summary?.total_fleet_financial_impact_mad.toLocaleString()} MAD
            </strong>
          </div>
        </div>

        {/* Card 3: Driver Arrears */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Impayés Chauffeurs (Encours)</span>
            <div className="p-2 bg-red-100 text-red-700 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <p className="text-2xl sm:text-3xl font-black text-red-600">
              {summary?.total_driver_arrears_mad.toLocaleString()}{" "}
              <span className="text-sm font-semibold text-red-400">MAD</span>
            </p>
            <p className="text-2xs text-gray-400 mt-1 font-medium">
              Soldes négatifs & dettes à recouvrer
            </p>
          </div>
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-2xs text-gray-500">
            <span>Statut :</span>
            <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded-md">En recouvrement actif</span>
          </div>
        </div>

        {/* Card 4: Fleet Utilization Rate */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Taux d'Utilisation Flotte</span>
            <div className={`p-2 rounded-xl ${summary && summary.utilization_rate >= 85 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <p className={`text-2xl sm:text-3xl font-black ${summary && summary.utilization_rate >= 85 ? "text-emerald-600" : "text-amber-600"}`}>
              {summary?.utilization_rate}%
            </p>
            <p className="text-2xs text-gray-400 mt-1 font-medium">
              {summary?.active_vehicles} sur {summary?.total_fleet} véhicules en circulation
            </p>
          </div>
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-2xs text-gray-500">
            <span>Objectif cible :</span>
            <strong className="text-emerald-600 font-bold">≥ 85%</strong>
          </div>
        </div>
      </div>

      {/* Visual Analytics & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Fleet Operational Status */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-navy text-sm">Répartition des Véhicules</h3>
            <p className="text-2xs text-gray-400 mt-0.5">Statut de la flotte et véhicules à risque de perte</p>
          </div>
          <div className="h-56 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fleetStatusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {fleetStatusPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} véhicules`, "Nombre"]}
                  contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid #e5e7eb" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-2xs pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-gray-600">Actifs : {summary?.active_vehicles}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-gray-600">Dispo : {summary?.available_vehicles}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-gray-600">Garage : {summary?.in_repair_vehicles}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-gray-600">Fourrière : {summary?.impounded_vehicles}</span>
            </div>
          </div>
        </div>

        {/* Breakdown of Direct Costs */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-navy text-sm">Structure des Coûts & Pertes Flotte</h3>
              <p className="text-2xs text-gray-400 mt-0.5">Comparaison entre Perte d'Opportunité (250 DH/j) et Frais Réels</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
              Impact : {summary?.total_fleet_financial_impact_mad.toLocaleString()} MAD
            </span>
          </div>

          <div className="space-y-4 my-4">
            {/* Progress Bar 1: Opportunity Loss */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-amber-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Perte d'Opportunité (Véhicules Inactifs × 250 MAD/j)
                </span>
                <span className="font-bold text-amber-900">
                  {summary?.total_opportunity_loss_mad.toLocaleString()} MAD
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      summary && summary.total_fleet_financial_impact_mad > 0
                        ? Math.min(100, Math.round((summary.total_opportunity_loss_mad / summary.total_fleet_financial_impact_mad) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Progress Bar 2: Direct Expenses */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-blue-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Dépenses Directes Garage, Fourrière & Entretien
                </span>
                <span className="font-bold text-blue-900">
                  {summary?.total_direct_expenses_mad.toLocaleString()} MAD
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-navy rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      summary && summary.total_fleet_financial_impact_mad > 0
                        ? Math.min(100, Math.round((summary.total_direct_expenses_mad / summary.total_fleet_financial_impact_mad) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Progress Bar 3: Driver Debt */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-red-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Dettes & Impayés Chauffeurs (Recouvrement)
                </span>
                <span className="font-bold text-red-900">
                  {summary?.total_driver_arrears_mad.toLocaleString()} MAD
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      summary && summary.total_driver_arrears_mad > 0
                        ? Math.min(100, Math.round((summary.total_driver_arrears_mad / (summary.total_fleet_financial_impact_mad || 10000)) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between text-2xs text-gray-600 border border-gray-200/60">
            <span>💡 <strong>Règle GoCab :</strong> Chaque jour où un véhicule reste sur parc ou au garage coûte <strong>250 MAD</strong> de manque à gagner.</span>
            <button
              onClick={fetchFinancialReport}
              className="p-1 text-gray-400 hover:text-navy rounded-lg"
              title="Rafraîchir"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 🚨 Driver Payment Collections & Critical Red Alert Section */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-red-100 text-red-600 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-navy">
                Suivi des Encaissements & Alertes Rouges Chauffeurs (300 / 1800 MAD)
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Contrats Journaliers (300 DH/j du Lun au Sam) & Hebdomadaires (1800 DH chaque Lundi). Alerte rouge déclenchée au <strong>3ème jour sans versement</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xs font-bold text-gray-400 uppercase">Collecté Aujourd'hui</span>
              <p className="text-base font-black text-emerald-600">
                {dailyCollectionsSummary?.totalClearedTodayMAD?.toLocaleString() || 0} / {dailyCollectionsSummary?.totalExpectedTodayMAD?.toLocaleString() || 0} MAD
              </p>
            </div>
          </div>
        </div>

        {/* Critical Red Drivers List */}
        {redDrivers.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                {redDrivers.length} Chauffeurs en Non-Paiement Critique (3e jour sans versement)
              </span>
              <span className="text-2xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                Intervention Terrain / Risque Immobilisation
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {redDrivers.map((driver) => {
                const cleanPhone = driver.phoneSanitized?.replace(/[^0-9]/g, "");
                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                  `Bonjour ${driver.fullName},\n\nNous constatons 3 jours consécutifs sans versement pour votre véhicule GoCab (${driver.vehicle?.plate_number || ""}).\nVotre solde d'arriérés est de : ${driver.currentArrearsMAD} MAD.\nMerci de régulariser immédiatement pour éviter l'immobilisation du véhicule.`
                )}`;

                return (
                  <div
                    key={driver.id}
                    className="p-4 bg-red-50/80 rounded-2xl border-2 border-red-200 shadow-2xs flex flex-col justify-between space-y-3 hover:border-red-400 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm text-red-950">{driver.fullName}</p>
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
                        <strong className="text-red-700 text-sm font-black">
                          {driver.currentArrearsMAD.toLocaleString()} MAD
                        </strong>
                      </div>

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-2xs rounded-xl shadow-2xs transition-colors flex items-center gap-1"
                      >
                        <span>WhatsApp</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3 text-xs text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Aucun chauffeur en alerte rouge (3ème jour sans paiement). Tous les versements sont à jour.</span>
          </div>
        )}
      </div>

      {/* 🎯 Clear Agent Role Targets & Accountability Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
              <span>🎯</span> Objectifs Opérationnels & KPI par Collaborateur
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Cibles hebdomadaires et mensuelles définies pour chaque poste opérationnel avec suivi des écarts en temps réel.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(agentTargets).map(([key, group]) => (
            <div
              key={key}
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between space-y-4 hover:border-navy/30 transition-all"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-navy">{group.title}</h3>
                  <span className="text-2xs font-semibold px-2 py-0.5 bg-navy/5 text-navy rounded-md">
                    {group.agentName}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {group.kpis.map((kpi, idx) => {
                  const percentage = kpi.isPercentage
                    ? kpi.actual
                    : kpi.target > 0
                    ? Math.round((kpi.actual / kpi.target) * 100)
                    : 100;

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700">{kpi.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-navy">
                            {kpi.actual.toLocaleString()}{kpi.isPercentage ? "%" : ""}
                          </span>
                          <span className="text-gray-400 text-2xs">
                            / {kpi.target.toLocaleString()}{kpi.isPercentage ? "%" : ` ${kpi.unit}`}
                          </span>
                          {kpi.status === "ON_TARGET" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : kpi.status === "BREACHED" ? (
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            kpi.status === "ON_TARGET"
                              ? "bg-emerald-500"
                              : kpi.status === "BREACHED"
                              ? "bg-red-500"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 📊 Detailed Per-Vehicle Financial Breakdown Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
              <span>🚘</span> Rapport Financier Détaillé par Véhicule
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Calcul individuel des jours d'arrêt, perte d'opportunité (250 DH/j), dépenses de garage et coût global.
            </p>
          </div>

          {/* Search & Filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher immatriculation, chauffeur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/20"
            >
              <option value="ALL">Tous les statuts ({vehicles.length})</option>
              <option value="AVAILABLE">Disponibles / Sur lot</option>
              <option value="INACTIVE">Inactifs (Coût 250 DH/j)</option>
              <option value="GARAGE">En Réparation / Garage</option>
              <option value="POLICE">Fourrière / Accident</option>
              <option value="ACTIVE">Actifs sur route</option>
            </select>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 uppercase text-2xs tracking-wider text-gray-500 border-b border-gray-100 font-bold">
                <tr>
                  <th className="py-4 px-6">Véhicule</th>
                  <th className="py-4 px-4">Chauffeur Assigné</th>
                  <th className="py-4 px-4">Statut</th>
                  <th className="py-4 px-4 text-center">Jours d'Arrêt</th>
                  <th className="py-4 px-4 text-right">Perte d'Opportunité (250 DH/j)</th>
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
                    const isHighLoss = v.opportunity_loss_mad >= 1500;

                    return (
                      <tr key={v.id} className="hover:bg-navy/5 transition-colors">
                        {/* Vehicle info */}
                        <td className="py-3.5 px-6 font-bold text-navy">
                          <div className="space-y-0.5">
                            <p className="font-mono text-xs">{v.plate_number}</p>
                            <p className="text-2xs text-gray-400 font-normal">{v.make_model} ({v.year})</p>
                          </div>
                        </td>

                        {/* Driver */}
                        <td className="py-3.5 px-4">
                          {v.driver_name ? (
                            <div>
                              <p className="font-semibold text-gray-800">{v.driver_name}</p>
                              {v.driver_arrears_mad > 0 && (
                                <span className="text-2xs text-red-600 font-bold">
                                  Impayés : {v.driver_arrears_mad.toLocaleString()} MAD
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-2xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                              Non assigné
                            </span>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-2xs font-bold px-2 py-0.5 rounded-md ${
                              v.status === "Actif"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : v.status === "Available" || v.status === "Disponible"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : v.status === "In garage" || v.status === "In service"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>

                        {/* Inactive Days */}
                        <td className="py-3.5 px-4 text-center font-bold">
                          <span className={`${v.inactive_days > 5 ? "text-red-600" : "text-gray-700"}`}>
                            {v.inactive_days} j
                          </span>
                        </td>

                        {/* Opportunity loss MAD */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={`font-mono font-bold ${isHighLoss ? "text-amber-700" : "text-gray-700"}`}>
                            {v.opportunity_loss_mad.toLocaleString()} MAD
                          </span>
                        </td>

                        {/* Direct expenses MAD */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-mono font-bold text-blue-700">
                            {v.direct_expenses_mad.toLocaleString()} MAD
                          </span>
                          {v.expense_count > 0 && (
                            <span className="text-2xs text-gray-400 block">({v.expense_count} entrées)</span>
                          )}
                        </td>

                        {/* Total Cost MAD */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={`font-mono text-xs font-black ${v.total_cost_mad > 0 ? "text-navy" : "text-gray-400"}`}>
                            {v.total_cost_mad.toLocaleString()} MAD
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-6 text-right">
                          <button
                            onClick={() => {
                              setSelectedVehicleForExpense(v);
                              setIsExpenseModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-navy/5 hover:bg-navy hover:text-white text-navy font-bold rounded-lg transition-colors text-2xs"
                            title="Ajouter un frais pour ce véhicule"
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
      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setSelectedVehicleForExpense(null);
        }}
        onSuccess={fetchFinancialReport}
        initialVehicle={selectedVehicleForExpense}
      />
    </div>
  );
}
