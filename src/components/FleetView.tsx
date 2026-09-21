"use client";

/**
 * FleetView Component — Cars & Fleet Data Entry & Compliance Management
 *
 * Modernized Figma & Frontend Architecture:
 * 1. Executive Fleet KPI Dashboards (Total, Actifs, Disponibles, Au Garage, Hors-Règle, Dépenses Cumulées).
 * 2. Actionable & Collapsible Compliance Alert Center for expired documents.
 * 3. Quick Status Filter Tabs with real-time counters.
 * 4. Authentic Moroccan License Plate Badges ([ WW | 964984 ] & [ 26515 | ي | 6 ]).
 * 5. Driver contact chips with direct Click-to-Call & WhatsApp.
 * 6. High-density Corporate Table with traffic-light compliance matrix & unified action buttons.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Car,
  Plus,
  Search,
  FileText,
  DollarSign,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  Phone,
  MessageCircle,
  MapPin,
  Sparkles,
  Wrench,
  Copy,
  Check,
  Fuel,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import VehicleDrawer, { Vehicle } from "./VehicleDrawer";
import TicketDrawer from "./TicketDrawer";
import VehicleCSVUploader from "./VehicleCSVUploader";
import AddExpenseModal from "./AddExpenseModal";
import VehicleExpensesDrawer from "./VehicleExpensesDrawer";
import AttestationModal, { AttestationData } from "./AttestationModal";

const HUB_CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tangier",
  "Agadir",
] as const;

const VEHICLE_STATUSES = [
  "Available",
  "Actif",
  "In garage",
  "impounded",
  "police_immobilization",
  "Accident",
  "Blocked",
] as const;

// Arabic letter mapping for Moroccan plates (e.g. Y -> ي, A -> أ, etc.)
const ARABIC_LETTER_MAP: Record<string, string> = {
  a: "أ",
  b: "ب",
  d: "د",
  h: "هـ",
  w: "و",
  y: "ي",
  j: "ج",
  m: "م",
  s: "س",
  t: "ت",
};

/**
 * Authentic Moroccan License Plate formatter
 * Handles:
 * - WW prefix/suffix: [ WW | 964984 ] or [ WW | 028102 ]
 * - Standard: [ 26515 | ي | 6 ]
 */
function MoroccanPlateBadge({ plate }: { plate: string | null | undefined }) {
  if (!plate) return <span className="text-slate-400 italic text-xs font-mono">Sans matricule</span>;
  const clean = plate.trim();

  // WW plate (e.g. WW964984, 028102WW, WW-964984)
  if (/^ww/i.test(clean) || /ww$/i.test(clean)) {
    const num = clean.replace(/ww/gi, "").replace(/[-–\s]+/g, "");
    return (
      <div className="inline-flex items-center gap-1.5 bg-red-600 text-white font-mono font-black text-xs px-2.5 py-0.5 rounded-md tracking-wider shadow-2xs border border-red-700">
        <span className="text-[10px] font-extrabold tracking-normal">WW</span>
        <span className="text-white/60">|</span>
        <span>{num || clean}</span>
      </div>
    );
  }

  // Standard Moroccan plate: number - letter - region
  const parts = clean.split(/[-–|/\s]+/).filter(Boolean);
  if (parts.length === 3) {
    const rawLetter = parts[1].toLowerCase();
    const arabicChar = ARABIC_LETTER_MAP[rawLetter] || parts[1];

    return (
      <div className="inline-flex items-center bg-gray-950 text-white font-mono font-bold text-xs px-2.5 py-0.5 rounded-md tracking-wide shadow-2xs border border-gray-800">
        <span className="tracking-wider">{parts[0]}</span>
        <span className="mx-1.5 text-gray-500 font-normal">|</span>
        <span className="text-amber-400 font-black" title={parts[1]}>
          {arabicChar}
        </span>
        <span className="mx-1.5 text-gray-500 font-normal">|</span>
        <span className="text-gray-200">{parts[2]}</span>
      </div>
    );
  }

  // Fallback
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-950 text-white font-mono font-bold text-xs px-2.5 py-0.5 rounded-md tracking-wider shadow-2xs border border-gray-800">
      <span>🚗</span>
      <span>{clean}</span>
    </div>
  );
}

// Module-level in-memory cache for instant 0ms tab switching
let globalCachedVehicles: Vehicle[] | null = null;

export default function FleetView() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => globalCachedVehicles || []);
  const [isLoading, setIsLoading] = useState(!globalCachedVehicles || globalCachedVehicles.length === 0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHub, setSelectedHub] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [activeQuickTab, setActiveQuickTab] = useState<string>("ALL");
  const [isAlertsExpanded, setIsAlertsExpanded] = useState(false);
  const [copiedPlate, setCopiedPlate] = useState<string | null>(null);

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Expense states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isExpenseDrawerOpen, setIsExpenseDrawerOpen] = useState(false);
  const [expenseVehicle, setExpenseVehicle] = useState<Vehicle | null>(null);
  const [expenseCategory, setExpenseCategory] = useState<string>("REPAIR");

  // Ticket Drawer state
  const [ticketVehicle, setTicketVehicle] = useState<Vehicle | null>(null);
  const [isTicketDrawerOpen, setIsTicketDrawerOpen] = useState(false);

  // Quick Attestation Modal state
  const [attestationVehicleData, setAttestationVehicleData] = useState<AttestationData | null>(null);
  const [isAttestationModalOpen, setIsAttestationModalOpen] = useState(false);

  function handleQuickAttestation(vehicle: Vehicle) {
    const todayFormatted = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    setAttestationVehicleData({
      fullName: vehicle.assigned_driver_name || vehicle.driverProfile?.fullName || "",
      cin: vehicle.driverProfile?.cinNumber || "",
      brand: vehicle.make_model,
      immat: vehicle.plate_number,
      chassisNumber: vehicle.vin || "",
      date: todayFormatted,
    });
    setIsAttestationModalOpen(true);
  }

  const fetchVehicles = useCallback(async () => {
    if (!globalCachedVehicles || globalCachedVehicles.length === 0) {
      setIsLoading(true);
    }
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedHub) params.set("hub", selectedHub);
      if (selectedStatus) params.set("status", selectedStatus);

      const res = await fetch(`/api/vehicles?${params.toString()}`);
      const data = await res.json();
      if (data.vehicles) {
        if (!searchTerm && !selectedHub && !selectedStatus) {
          globalCachedVehicles = data.vehicles;
        }
        setVehicles(data.vehicles);
      }
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedHub, selectedStatus]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  async function handleDelete(id: string, plate: string) {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement le véhicule ${plate} ?\n\nCette action supprimera également l'historique des tickets, inspections et dossiers d'accidents liés.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Véhicule ${plate} supprimé`);
        fetchVehicles();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Échec de la suppression");
      }
    } catch (err) {
      console.error("Failed to delete vehicle:", err);
      toast.error("Erreur réseau");
    }
  }

  async function handleQuickStatusChange(vehicleId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        if (newStatus === "Accident") {
          toast.success("Statut Accidenté : Tickets Support et Assurance créés automatiquement !");
        } else {
          toast.success("Statut du véhicule mis à jour");
        }
        fetchVehicles();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Erreur lors de la mise à jour du statut");
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      toast.error("Erreur réseau");
    }
  }

  function copyPlateToClipboard(plate: string) {
    navigator.clipboard.writeText(plate);
    setCopiedPlate(plate);
    toast.success(`Immatriculation ${plate} copiée !`);
    setTimeout(() => setCopiedPlate(null), 2000);
  }

  // Calculate Expiration Alerts
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiredItems = useMemo(() => {
    const list: { vehicle: Vehicle; type: string; date: string; daysExpired: number }[] = [];
    vehicles.forEach((v) => {
      const checks = [
        { name: "Assurance", dateStr: v.insurance_expiry_date },
        { name: "Vignette", dateStr: v.vignette_expiry_date },
        { name: "Autorisation", dateStr: v.autorisation_expiry_date },
        { name: "Visite Tech", dateStr: v.technical_inspection_expiry },
      ];

      checks.forEach((chk) => {
        if (chk.dateStr) {
          try {
            const d = new Date(chk.dateStr);
            if (!isNaN(d.getTime()) && d < now) {
              const diffDays = Math.ceil((now.getTime() - d.getTime()) / (1000 * 3600 * 24));
              list.push({
                vehicle: v,
                type: chk.name,
                date: d.toLocaleDateString(),
                daysExpired: diffDays,
              });
            }
          } catch {}
        }
      });
    });
    return list;
  }, [vehicles, now]);

  // Set of vehicle IDs that have at least one expired document
  const expiredVehicleIds = useMemo(() => {
    return new Set(expiredItems.map((item) => item.vehicle.id));
  }, [expiredItems]);

  // KPI Calculations
  const totalCount = vehicles.length;
  const activeCount = vehicles.filter((v) => v.status === "Actif" || v.status === "working").length;
  const availableCount = vehicles.filter((v) => v.status === "Available").length;
  const inGarageCount = vehicles.filter(
    (v) => v.status === "In garage" || v.status === "maintenance" || v.status === "Accident"
  ).length;
  const blockedCount = vehicles.filter((v) =>
    ["impounded", "police_immobilization", "impounded by police", "Blocked"].includes(v.status)
  ).length;
  const totalFleetSpend = vehicles.reduce((sum, v) => sum + (v.total_expenses_mad || 0), 0);

  // Client-side quick filtering
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (activeQuickTab === "ACTIVE" && v.status !== "Actif" && v.status !== "working") return false;
      if (activeQuickTab === "AVAILABLE" && v.status !== "Available") return false;
      if (
        activeQuickTab === "GARAGE" &&
        v.status !== "In garage" &&
        v.status !== "maintenance" &&
        v.status !== "Accident"
      )
        return false;
      if (
        activeQuickTab === "BLOCKED" &&
        !["impounded", "police_immobilization", "impounded by police", "Blocked"].includes(v.status)
      )
        return false;
      if (activeQuickTab === "EXPIRED" && !expiredVehicleIds.has(v.id)) return false;
      return true;
    });
  }, [vehicles, activeQuickTab, expiredVehicleIds]);

  /** Compact, high-clarity compliance health badge */
  function getComplianceBadge(dateStr: string | null, label: string) {
    if (!dateStr) {
      return (
        <span
          className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 font-mono"
          title={`${label}: Non renseigné`}
        >
          {label}: —
        </span>
      );
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return (
          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 font-mono">
            {label}: —
          </span>
        );
      }
      if (d < now) {
        const diffDays = Math.ceil((now.getTime() - d.getTime()) / (1000 * 3600 * 24));
        return (
          <span
            className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border border-rose-200 shadow-2xs"
            title={`${label} expirée depuis ${diffDays} jour(s) (${d.toLocaleDateString()})`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping shrink-0" />
            <span>{label} !</span>
          </span>
        );
      }
      if (d <= threeDaysFromNow) {
        const days = Math.max(0, Math.ceil((d.getTime() - now.getTime()) / (1000 * 3600 * 24)));
        return (
          <span
            className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border border-amber-200"
            title={`${label} expire dans ${days} jour(s)`}
          >
            <span>⚠️ {label} ({days}j)</span>
          </span>
        );
      }
      return (
        <span
          className="text-[10px] font-semibold text-emerald-800 bg-emerald-50/70 px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border border-emerald-200/80"
          title={`${label} valide jusqu'au ${d.toLocaleDateString()}`}
        >
          <span className="text-emerald-600 font-bold">✓</span>
          <span>{label}</span>
        </span>
      );
    } catch {
      return (
        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 font-mono">
          {label}: —
        </span>
      );
    }
  }

  function formatStatusLabel(status: string) {
    switch (status) {
      case "Available":
        return "Disponible (Au parc)";
      case "Actif":
      case "working":
        return "Actif (En service)";
      case "In garage":
      case "maintenance":
        return "En maintenance / Garage";
      case "impounded":
        return "Fourrière Municipale";
      case "police_immobilization":
        return "Immobilisation Police";
      case "impounded by police":
        return "Fourrière / Police";
      case "Accident":
        return "Accidenté";
      case "Blocked":
        return "Bloqué";
      default:
        return status;
    }
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case "Available":
        return "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
      case "Actif":
      case "working":
        return "bg-blue-50 text-blue-800 border-blue-200 font-bold";
      case "In garage":
      case "maintenance":
        return "bg-amber-50 text-amber-800 border-amber-200 font-bold";
      case "Accident":
        return "bg-orange-50 text-orange-800 border-orange-200 font-bold";
      case "impounded":
        return "bg-rose-100 text-rose-900 border-rose-200 font-bold";
      case "police_immobilization":
      case "impounded by police":
        return "bg-slate-900 text-white border-slate-900 font-bold";
      case "Blocked":
        return "bg-red-900 text-white border-red-800 font-bold";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  }

  const hasActiveFilters = Boolean(searchTerm || selectedHub || selectedStatus || activeQuickTab !== "ALL");
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedHub("");
    setSelectedStatus("");
    setActiveQuickTab("ALL");
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto w-full">
      {/* 1. Header & Actions Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200/90">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Car className="w-4 h-4" />
            </div>
            <span>Cars & Fleet Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Supervisez votre parc automobile, conformité réglementaire, chauffeurs et dépenses par véhicule.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsExpenseDrawerOpen(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Frais & Dépenses</span>
          </button>

          <button
            onClick={() => {
              setExpenseVehicle(null);
              setExpenseCategory("REPAIR");
              setIsExpenseModalOpen(true);
            }}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Ajouter Frais</span>
          </button>

          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingVehicle(null);
              setIsDrawerOpen(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nouveau Véhicule</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Fleet KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Total Flotte */}
        <div
          onClick={() => setActiveQuickTab("ALL")}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            activeQuickTab === "ALL"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white border-slate-200/90 text-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickTab === "ALL" ? "text-slate-300" : "text-slate-500"}`}>
              Flotte Totale
            </span>
            <Car className={`w-3.5 h-3.5 ${activeQuickTab === "ALL" ? "text-slate-300" : "text-slate-400"}`} />
          </div>
          <div className="text-xl font-black font-mono tracking-tight">{totalCount}</div>
          <div className={`text-[10px] mt-0.5 ${activeQuickTab === "ALL" ? "text-slate-300" : "text-slate-400"}`}>
            véhicules enregistrés
          </div>
        </div>

        {/* Actifs En Service */}
        <div
          onClick={() => setActiveQuickTab("ACTIVE")}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            activeQuickTab === "ACTIVE"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white border-slate-200/90 text-slate-800 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickTab === "ACTIVE" ? "text-blue-100" : "text-blue-600"}`}>
              En Service
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="text-xl font-black font-mono tracking-tight">{activeCount}</div>
          <div className={`text-[10px] mt-0.5 ${activeQuickTab === "ACTIVE" ? "text-blue-200" : "text-slate-400"}`}>
            sur les routes
          </div>
        </div>

        {/* Disponibles */}
        <div
          onClick={() => setActiveQuickTab("AVAILABLE")}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            activeQuickTab === "AVAILABLE"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-white border-slate-200/90 text-slate-800 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickTab === "AVAILABLE" ? "text-emerald-100" : "text-emerald-600"}`}>
              Disponibles
            </span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${activeQuickTab === "AVAILABLE" ? "text-emerald-200" : "text-emerald-500"}`} />
          </div>
          <div className="text-xl font-black font-mono tracking-tight">{availableCount}</div>
          <div className={`text-[10px] mt-0.5 ${activeQuickTab === "AVAILABLE" ? "text-emerald-200" : "text-slate-400"}`}>
            au parc / prêts
          </div>
        </div>

        {/* Garage & Maintenance */}
        <div
          onClick={() => setActiveQuickTab("GARAGE")}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            activeQuickTab === "GARAGE"
              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
              : "bg-white border-slate-200/90 text-slate-800 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickTab === "GARAGE" ? "text-amber-100" : "text-amber-700"}`}>
              Au Garage
            </span>
            <Wrench className={`w-3.5 h-3.5 ${activeQuickTab === "GARAGE" ? "text-amber-200" : "text-amber-600"}`} />
          </div>
          <div className="text-xl font-black font-mono tracking-tight">{inGarageCount}</div>
          <div className={`text-[10px] mt-0.5 ${activeQuickTab === "GARAGE" ? "text-amber-100" : "text-slate-400"}`}>
            en réparation / accident
          </div>
        </div>

        {/* Documents Expirés Alert */}
        <div
          onClick={() => setActiveQuickTab("EXPIRED")}
          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
            activeQuickTab === "EXPIRED"
              ? "bg-rose-600 text-white border-rose-600 shadow-sm"
              : expiredItems.length > 0
              ? "bg-rose-50/70 border-rose-200 text-rose-950 hover:bg-rose-100/60"
              : "bg-white border-slate-200/90 text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeQuickTab === "EXPIRED" ? "text-rose-100" : "text-rose-700"}`}>
              Documents Expirés
            </span>
            <ShieldAlert className={`w-3.5 h-3.5 ${activeQuickTab === "EXPIRED" ? "text-rose-200" : "text-rose-600"}`} />
          </div>
          <div className="text-xl font-black font-mono tracking-tight">{expiredItems.length}</div>
          <div className={`text-[10px] mt-0.5 ${activeQuickTab === "EXPIRED" ? "text-rose-200" : "text-rose-600/80"}`}>
            sur {expiredVehicleIds.size} véhicules
          </div>
        </div>

        {/* Dépenses Cumulées */}
        <div
          onClick={() => setIsExpenseDrawerOpen(true)}
          className="p-3 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all cursor-pointer text-slate-800"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Dépenses Totales
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-black font-mono tracking-tight text-slate-900 truncate">
            {totalFleetSpend.toLocaleString()} <span className="text-xs font-normal">MAD</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Bons de Commande & Frais
          </div>
        </div>
      </div>

      {/* 3. Actionable Collapsible Compliance Alert Center */}
      {expiredItems.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-rose-50/80 to-red-50 border border-rose-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
              </span>
              <div>
                <h3 className="text-xs font-black text-rose-950 flex items-center gap-2">
                  <span>Centre de Vigilance Réglementaire :</span>
                  <span className="bg-rose-200/80 text-rose-900 px-2 py-0.2 rounded-md font-mono text-[11px]">
                    {expiredItems.length} documents expirés
                  </span>
                </h3>
                <p className="text-[11px] text-rose-800/80 mt-0.5">
                  Autorisations de circulation, visites techniques ou assurances échues nécessitant un renouvellement.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveQuickTab("EXPIRED")}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                Filtrer ces {expiredVehicleIds.size} véhicules
              </button>

              <button
                type="button"
                onClick={() => setIsAlertsExpanded((v) => !v)}
                className="px-2.5 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>{isAlertsExpanded ? "Réduire" : "Détails"}</span>
                {isAlertsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Collapsible details grid */}
          {isAlertsExpanded && (
            <div className="mt-3.5 pt-3.5 border-t border-rose-200/70 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
              {expiredItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setEditingVehicle(item.vehicle);
                    setIsDrawerOpen(true);
                  }}
                  className="bg-white hover:bg-rose-50/50 border border-rose-200/90 p-2 rounded-xl flex items-center justify-between text-xs font-mono shadow-2xs cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <MoroccanPlateBadge plate={item.vehicle.plate_number} />
                    <span className="text-rose-700 font-bold text-[11px] truncate">{item.type}</span>
                  </div>
                  <span className="text-[10px] text-rose-500 font-semibold shrink-0">
                    +{item.daysExpired}j
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Quick Category Tabs & Search/Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/90 space-y-3">
        {/* Quick Category Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: "ALL", label: "Toute la flotte", count: totalCount },
            { id: "ACTIVE", label: "🟢 En service", count: activeCount },
            { id: "AVAILABLE", label: "🅿️ Au parc", count: availableCount },
            { id: "GARAGE", label: "🔧 Au garage", count: inGarageCount },
            { id: "BLOCKED", label: "🛑 Fourrière / Bloqués", count: blockedCount },
            { id: "EXPIRED", label: "🚨 Non conformes", count: expiredVehicleIds.size },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveQuickTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeQuickTab === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeQuickTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter inputs */}
        <div className="flex flex-col md:flex-row items-center gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Rechercher par immatriculation, marque, modèle, VIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 absolute right-2.5 top-2.5 flex items-center justify-center text-[10px]"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Hub Filter */}
            <select
              value={selectedHub}
              onChange={(e) => setSelectedHub(e.target.value)}
              className="border border-slate-200/90 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none bg-slate-50 font-medium text-slate-700 cursor-pointer"
            >
              <option value="">Tous les hubs régionaux</option>
              {HUB_CITIES.map((h) => (
                <option key={h} value={h}>
                  📍 {h}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-slate-200/90 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none bg-slate-50 font-medium text-slate-700 cursor-pointer"
            >
              <option value="">Tous les statuts</option>
              {VEHICLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatStatusLabel(s)}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-2 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Effacer filtres</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Corporate Fleet Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            <span>Chargement des véhicules...</span>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs space-y-2">
            <Car className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="font-bold text-slate-700 text-sm">Aucun véhicule ne correspond aux critères.</p>
            <p className="text-slate-400 text-xs">Modifiez vos filtres ou réinitialisez la recherche.</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser les filtres</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Immatriculation</th>
                  <th className="py-3 px-4">Marque & Modèle</th>
                  <th className="py-3 px-4">Hub Régional</th>
                  <th className="py-3 px-4">Statut & Chauffeur</th>
                  <th className="py-3 px-4 text-center">Kilométrage</th>
                  <th className="py-3 px-4 text-center">Dépenses (MAD)</th>
                  <th className="py-3 px-4">Conformité Réglementaire</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredVehicles.map((v) => {
                  const isExpired = expiredVehicleIds.has(v.id);

                  return (
                    <tr
                      key={v.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isExpired ? "bg-rose-50/20" : ""
                      }`}
                    >
                      {/* 1. Immatriculation */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <MoroccanPlateBadge plate={v.plate_number} />
                          <button
                            type="button"
                            onClick={() => copyPlateToClipboard(v.plate_number)}
                            className="p-1 text-slate-300 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                            title="Copier l'immatriculation"
                          >
                            {copiedPlate === v.plate_number ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 2. Marque & Modèle */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{v.make_model}</span>
                          {v.year && (
                            <span className="text-[10px] font-semibold font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                              {v.year}
                            </span>
                          )}
                        </div>
                        {v.vin && (
                          <div
                            className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[140px]"
                            title={`VIN: ${v.vin}`}
                          >
                            VIN: {v.vin}
                          </div>
                        )}
                      </td>

                      {/* 3. Hub Régional */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          <MapPin className="w-3 h-3 text-blue-500" />
                          <span>{v.hub_city}</span>
                        </span>
                      </td>

                      {/* 4. Statut Opérationnel & Chauffeur */}
                      <td className="py-3.5 px-4">
                        <select
                          value={v.status}
                          onChange={(e) => handleQuickStatusChange(v.id, e.target.value)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] border focus:outline-none cursor-pointer shadow-2xs ${getStatusStyle(
                            v.status
                          )}`}
                        >
                          {!VEHICLE_STATUSES.includes(v.status as any) && (
                            <option value={v.status} className="bg-white text-slate-900 font-normal">
                              {formatStatusLabel(v.status)}
                            </option>
                          )}
                          {VEHICLE_STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-white text-slate-900 font-normal">
                              {formatStatusLabel(s)}
                            </option>
                          ))}
                        </select>

                        {v.assigned_driver_name ? (
                          <div className="text-[11px] text-slate-700 font-semibold mt-1 flex items-center gap-1">
                            <span>👤</span>
                            <span className="truncate max-w-[150px]">{v.assigned_driver_name}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">Non assigné</div>
                        )}
                      </td>

                      {/* 5. Kilométrage */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 tabular-nums">
                        {v.current_mileage.toLocaleString()}{" "}
                        <span className="text-[10px] font-normal text-slate-400">KM</span>
                      </td>

                      {/* 6. Dépenses (MAD) */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVehicle(v);
                            setIsDrawerOpen(true);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                            (v.total_expenses_mad || 0) > 0
                              ? "bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/90"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-400 border border-slate-200/60"
                          }`}
                          title="Cliquer pour inspecter les dépenses et Bons de Commande de ce véhicule"
                        >
                          <span>💰</span>
                          <span>{(v.total_expenses_mad || 0).toLocaleString()} MAD</span>
                        </button>
                      </td>

                      {/* 7. Conformité Réglementaire */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {getComplianceBadge(v.insurance_expiry_date, "Assurance")}
                          {getComplianceBadge(v.vignette_expiry_date, "Vignette")}
                          {getComplianceBadge(v.autorisation_expiry_date, "Autorisation")}
                          {getComplianceBadge(v.technical_inspection_expiry, "Visite Tech")}
                        </div>
                      </td>

                      {/* 8. Actions Toolbar */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleQuickAttestation(v)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 rounded-lg text-xs transition-colors font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Générer / Imprimer l'Attestation de Location"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Attestation</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setExpenseVehicle(v);
                              setExpenseCategory(v.status === "impounded by police" ? "POLICE" : "REPAIR");
                              setIsExpenseModalOpen(true);
                            }}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-200 rounded-lg text-xs transition-colors font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Enregistrer un frais (réparation, fourrière, etc.)"
                          >
                            <DollarSign className="w-3 h-3" />
                            <span>Frais</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setTicketVehicle(v);
                              setIsTicketDrawerOpen(true);
                            }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 border border-blue-200 rounded-lg text-xs transition-colors font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Créer un ticket de maintenance / vidange pour ce véhicule"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Ticket</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingVehicle(v);
                              setIsDrawerOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Modifier les détails du véhicule"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(v.id, v.plate_number)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer le véhicule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Slide-in Vehicle Drawer */}
      {isDrawerOpen && (
        <VehicleDrawer
          vehicle={editingVehicle}
          onClose={() => {
            setIsDrawerOpen(false);
            setEditingVehicle(null);
          }}
          onSaveSuccess={fetchVehicles}
        />
      )}

      {/* Slide-in Ticket Drawer */}
      {isTicketDrawerOpen && (
        <TicketDrawer
          vehicle={ticketVehicle}
          onClose={() => {
            setIsTicketDrawerOpen(false);
            setTicketVehicle(null);
          }}
          onSaveSuccess={fetchVehicles}
        />
      )}

      {/* Vehicle CSV Uploader Modal */}
      <VehicleCSVUploader
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onUploadSuccess={fetchVehicles}
      />

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setExpenseVehicle(null);
        }}
        onSuccess={fetchVehicles}
        initialVehicle={expenseVehicle}
        initialCategory={expenseCategory}
      />

      {/* Vehicle Expenses Drawer */}
      <VehicleExpensesDrawer
        isOpen={isExpenseDrawerOpen}
        onClose={() => setIsExpenseDrawerOpen(false)}
        onOpenAddModal={(v, cat) => {
          setExpenseVehicle(v || null);
          setExpenseCategory(cat || "REPAIR");
          setIsExpenseModalOpen(true);
        }}
      />

      {/* Attestation de Location Modal */}
      {attestationVehicleData && (
        <AttestationModal
          data={attestationVehicleData}
          isOpen={isAttestationModalOpen}
          onClose={() => {
            setIsAttestationModalOpen(false);
            setAttestationVehicleData(null);
          }}
        />
      )}
    </div>
  );
}

