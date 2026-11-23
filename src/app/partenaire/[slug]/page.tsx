"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  Wallet,
  Plus,
  Send,
  RefreshCw,
  MoreHorizontal,
  TrendingUp,
  Search,
  Bell,
  Eye,
  EyeOff,
  Car,
  Coins,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  ChevronRight,
  MessageCircle,
  BarChart3,
  PieChart,
  Users,
  ArrowUpRight,
  Share2,
  X,
  Check,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ArrowRight,
  Filter,
  Trash2,
  Archive,
} from "lucide-react";
import { PartnerSummary, PartnerLeadEvaluation, PartnerAvailableCar } from "@/lib/services/partnerCommissionService";

const MOROCCAN_CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tangier",
  "Agadir",
  "Fez",
  "Meknes",
  "Oujda",
  "Kenitra",
  "Tetouan",
  "Safi",
  "Mohammedia",
  "El Jadida",
  "Autre ville",
];

type DateRangePreset = "ALL" | "TODAY" | "7D" | "30D" | "THIS_MONTH" | "CUSTOM";

function isWithinDateRange(
  isoDate: string,
  preset: DateRangePreset,
  customStart: string,
  customEnd: string
): boolean {
  if (preset === "ALL") return true;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (preset === "TODAY") {
    return d >= startOfToday && d <= endOfToday;
  }
  if (preset === "7D") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    return d >= start && d <= endOfToday;
  }
  if (preset === "30D") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 29);
    return d >= start && d <= endOfToday;
  }
  if (preset === "THIS_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return d >= start && d <= endOfToday;
  }
  if (preset === "CUSTOM") {
    if (customStart) {
      const s = new Date(`${customStart}T00:00:00`);
      if (d < s) return false;
    }
    if (customEnd) {
      const e = new Date(`${customEnd}T23:59:59.999`);
      if (d > e) return false;
    }
    return true;
  }
  return true;
}

export default function PartnerPortalPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "zakaria";
  const partnerDisplayName = slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase();

  // Navigation state (Fintech App Tabs)
  const [activeTab, setActiveTab] = useState<"HOME" | "ARCHIVE" | "ANALYTICS" | "ALL_LEADS" | "AVAILABLE_CARS">("HOME");

  // Data state
  const [data, setData] = useState<PartnerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Filters & Search
  const [filterCategory, setFilterCategory] = useState<"ALL" | "SHOWED_UP">("ALL");
  const [archiveFilter, setArchiveFilter] = useState<"ALL_TREATED" | "VALIDATED" | "LOST">("ALL_TREATED");
  const [archiveSearch, setArchiveSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("ALL");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("ALL");
  const [carSearchQuery, setCarSearchQuery] = useState("");
  const [carCityFilter, setCarCityFilter] = useState<string>("ALL");

  // Lead modal / drawer
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PartnerLeadEvaluation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverCity, setDriverCity] = useState("Casablanca");
  const [driverIntention, setDriverIntention] = useState("Prendre une voiture immédiatement");
  const [driverNotes, setDriverNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch partner data
  const fetchData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setRefreshing(true);
      try {
        const res = await fetch(`/api/partners/${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erreur de chargement");
        setData(json);
      } catch (err: any) {
        if (!isSilent) {
          toast.error(err.message || "Impossible de charger les données");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Submit new lead
  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) {
      toast.error("Veuillez renseigner le nom complet du chauffeur.");
      return;
    }
    if (!driverPhone.trim()) {
      toast.error("Veuillez renseigner le numéro de téléphone.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/partners/${encodeURIComponent(slug)}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: driverName.trim(),
          phone: driverPhone.trim(),
          city: driverCity,
          intention: driverIntention,
          notes: driverNotes.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de la transmission");

      toast.success(
        `🎉 Chauffeur ${driverName} transmis à GoCab ! Commission de 150 DH activée dès validation.`,
        { duration: 5000 }
      );

      setDriverName("");
      setDriverPhone("");
      setDriverNotes("");
      setShowAddModal(false);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur de transmission");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete lead
  const handleDeleteLead = async (lead: PartnerLeadEvaluation) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement le dossier de ${lead.name} (${lead.phone}) ?`
      )
    ) {
      return;
    }

    setDeletingId(lead.id);
    try {
      const res = await fetch(`/api/partners/${encodeURIComponent(slug)}/leads?id=${lead.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de suppression");

      toast.success(`Dossier de ${lead.name} supprimé avec succès.`);
      if (selectedLead?.id === lead.id) {
        setSelectedLead(null);
      }
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer ce dossier");
    } finally {
      setDeletingId(null);
    }
  };

  // Copy referral link
  const handleShareLink = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/zakaria`;
      navigator.clipboard.writeText(url).then(
        () => {
          toast.success("Lien copié dans le presse-papier !");
        },
        () => {
          toast.error("Impossible de copier le lien");
        }
      );
    }
  };

  // Split Active (En cours) vs Treated (Archive: VALIDATED or LOST)
  const activeLeads = useMemo(() => {
    if (!data?.leads) return [];
    return data.leads.filter((l) => l.status === "PENDING");
  }, [data?.leads]);

  const treatedLeads = useMemo(() => {
    if (!data?.leads) return [];
    return data.leads.filter((l) => l.status === "VALIDATED" || l.status === "LOST");
  }, [data?.leads]);

  // Filtered active leads for HOME view
  const filteredActiveLeads = useMemo(() => {
    return activeLeads.filter((l) => {
      if (filterCategory === "SHOWED_UP" && !l.presenceConfirmed && l.stageBadgeColor !== "purple") {
        return false;
      }
      return true;
    });
  }, [activeLeads, filterCategory]);

  // Filtered treated leads for ARCHIVE view
  const filteredArchiveLeads = useMemo(() => {
    return treatedLeads.filter((l) => {
      if (archiveFilter === "VALIDATED" && l.status !== "VALIDATED") return false;
      if (archiveFilter === "LOST" && l.status !== "LOST") return false;
      if (!isWithinDateRange(l.createdAt, datePreset, customStartDate, customEndDate)) return false;

      if (archiveSearch.trim()) {
        const q = archiveSearch.toLowerCase();
        const matchesName = l.name.toLowerCase().includes(q);
        const matchesPhone = l.phone.includes(q);
        const matchesCity = (l.city || "").toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesCity;
      }
      return true;
    });
  }, [treatedLeads, archiveFilter, datePreset, customStartDate, customEndDate, archiveSearch]);

  // Filtered all leads for Directory (ALL_LEADS)
  const filteredLeads = useMemo(() => {
    if (!data?.leads) return [];
    return data.leads.filter((l) => {
      if (selectedCity !== "ALL" && l.city?.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = l.name.toLowerCase().includes(q);
        const matchesPhone = l.phone.includes(q);
        const matchesCity = (l.city || "").toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesCity;
      }
      return true;
    });
  }, [data?.leads, selectedCity, searchQuery]);

  // Available cars filtering
  const availableCarCities = useMemo(() => {
    const cities = new Set<string>();
    (data?.availableCars || []).forEach((c) => {
      if (c.hubCity) cities.add(c.hubCity);
    });
    return Array.from(cities);
  }, [data?.availableCars]);

  const filteredAvailableCars = useMemo(() => {
    const list = data?.availableCars || [];
    return list.filter((c) => {
      if (carCityFilter !== "ALL" && (c.hubCity || "").toLowerCase() !== carCityFilter.toLowerCase()) {
        return false;
      }
      if (carSearchQuery.trim()) {
        const q = carSearchQuery.toLowerCase();
        return (
          c.makeModel.toLowerCase().includes(q) ||
          c.plateNumber.toLowerCase().includes(q) ||
          (c.hubCity || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.availableCars, carCityFilter, carSearchQuery]);

  const handleProposeDriverForCar = (car: PartnerAvailableCar) => {
    setDriverCity(car.hubCity || "Casablanca");
    setDriverIntention("Prendre une voiture immédiatement");
    setDriverNotes(`Véhicule disponible souhaité : ${car.makeModel} (${car.plateNumber})`);
    setShowAddModal(true);
  };

  // Analytics / Dashboard stats filtered by selected Date Range
  const analyticsBreakdown = useMemo(() => {
    const allLeads = data?.leads || [];
    const ranged = allLeads.filter((l) =>
      isWithinDateRange(l.createdAt, datePreset, customStartDate, customEndDate)
    );
    const total = ranged.length;
    const validated = ranged.filter((l) => l.status === "VALIDATED").length;
    const pending = ranged.filter((l) => l.status === "PENDING").length;
    const lost = ranged.filter((l) => l.status === "LOST").length;
    const showedUp = ranged.filter((l) => l.presenceConfirmed || l.stageBadgeColor === "purple").length;
    const earnedMAD = ranged.reduce((sum, l) => sum + (l.isConverted ? l.commissionMAD || 150 : 0), 0);
    const potentialMAD = pending * (data?.commissionRateMAD || 150);

    const cityMap = new Map<string, { total: number; validated: number }>();
    for (const l of ranged) {
      const city = l.city?.trim() || "Maroc";
      const cur = cityMap.get(city) || { total: 0, validated: 0 };
      cur.total += 1;
      if (l.isConverted) cur.validated += 1;
      cityMap.set(city, cur);
    }
    const cityBreakdown = Array.from(cityMap.entries())
      .map(([city, counts]) => ({ city, ...counts }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      validated,
      pending,
      lost,
      treated: validated + lost,
      showedUp,
      total,
      earnedMAD,
      potentialMAD,
      valPct: total > 0 ? Math.round((validated / total) * 100) : 0,
      penPct: total > 0 ? Math.round((pending / total) * 100) : 0,
      lostPct: total > 0 ? Math.round((lost / total) * 100) : 0,
      showUpPct: total > 0 ? Math.round((showedUp / total) * 100) : 0,
      cityBreakdown,
    };
  }, [data, datePreset, customStartDate, customEndDate]);

  const DATE_PRESETS: { id: DateRangePreset; label: string }[] = [
    { id: "ALL", label: "Tout" },
    { id: "TODAY", label: "Aujourd'hui" },
    { id: "7D", label: "7 jours" },
    { id: "30D", label: "30 jours" },
    { id: "THIS_MONTH", label: "Ce mois" },
    { id: "CUSTOM", label: "Personnalisé" },
  ];

  const renderDateRangeFilter = () => (
    <div className="p-3 rounded-2xl bg-white border border-[#E5ECE7] space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#11241C] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#0E382B]" />
          <span>Période</span>
        </span>
        {datePreset !== "ALL" && (
          <button
            type="button"
            onClick={() => {
              setDatePreset("ALL");
              setCustomStartDate("");
              setCustomEndDate("");
            }}
            className="text-[10px] font-semibold text-[#0E382B] hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] no-scrollbar">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setDatePreset(p.id)}
            className={`px-2.5 py-1 rounded-full font-semibold whitespace-nowrap transition-all ${
              datePreset === p.id
                ? "bg-[#0E382B] text-white shadow-xs"
                : "bg-[#F4F6F0] text-[#697871] hover:bg-[#E7ECE9]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {datePreset === "CUSTOM" && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-[10px] font-semibold text-[#697871] mb-0.5">Du</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-[#E5ECE7] text-xs bg-[#F9FAF7] text-[#11241C] focus:outline-none focus:ring-2 focus:ring-[#0E382B]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[#697871] mb-0.5">Au</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-[#E5ECE7] text-xs bg-[#F9FAF7] text-[#11241C] focus:outline-none focus:ring-2 focus:ring-[#0E382B]"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderLeadCard = (lead: PartnerLeadEvaluation) => {
    const isValidated = lead.isConverted;
    const isPending = lead.status === "PENDING";

    return (
      <div
        key={lead.id}
        onClick={() => setSelectedLead(lead)}
        className="p-4 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#0E382B]/30 hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-3"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isValidated
                ? "bg-[#D8EEDF] text-[#0E382B]"
                : lead.presenceConfirmed || lead.stageBadgeColor === "purple"
                ? "bg-purple-100 text-purple-800 ring-1 ring-purple-200"
                : isPending
                ? "bg-[#FEF3C7] text-[#92400E]"
                : "bg-[#F3F4F6] text-[#6B7280]"
            }`}
          >
            {isValidated ? (
              lead.conversionReason === "VEHICLE_ASSIGNED" ? (
                <Car className="w-5 h-5" />
              ) : (
                <Coins className="w-5 h-5" />
              )
            ) : lead.presenceConfirmed || lead.stageBadgeColor === "purple" ? (
              <Users className="w-5 h-5 text-purple-700" />
            ) : isPending ? (
              <Clock className="w-5 h-5" />
            ) : (
              <Users className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-[#11241C] truncate">{lead.name}</p>
            <div className="flex items-center gap-2 text-xs text-[#697871] mt-0.5">
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3 text-[#697871]" />
                {lead.city || "Maroc"}
              </span>
              <span>•</span>
              <span>{new Date(lead.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {lead.presenceConfirmed && !isValidated && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  👤 Présent
                </span>
              )}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                  isValidated
                    ? "bg-[#D8EEDF] text-[#0E382B]"
                    : lead.presenceConfirmed || lead.stageBadgeColor === "purple"
                    ? "bg-purple-50 text-purple-900 border border-purple-100"
                    : isPending
                    ? "bg-[#FEF3C7] text-[#92400E]"
                    : "bg-[#FEE2E2] text-[#991B1B]"
                }`}
              >
                {lead.statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="text-right">
            {isValidated ? (
              <div>
                <span className="text-sm md:text-base font-extrabold text-[#0E382B] block">+150.00 DH</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Validé ✓
                </span>
              </div>
            ) : isPending ? (
              <div>
                <span className="text-xs font-bold text-amber-700 block">En cours</span>
                <span className="text-[10px] text-[#697871]">+150 DH pot.</span>
              </div>
            ) : (
              <div>
                <span className="text-xs font-semibold text-slate-400 block">0.00 DH</span>
                <span className="text-[10px] text-slate-400">Non converti</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteLead(lead);
            }}
            disabled={deletingId === lead.id}
            className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer active:scale-90"
            title="Supprimer ce dossier"
          >
            {deletingId === lead.id ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F6F0] text-[#151E19] flex justify-center selection:bg-[#0E382B] selection:text-white pb-36 font-sans antialiased">
      <Toaster position="top-center" reverseOrder={false} />

      {/* Main Mobile/Tablet Frame Container */}
      <div className="w-full max-w-md md:max-w-xl lg:max-w-2xl px-4 py-5 flex flex-col space-y-5">
        {/* ===================== TOP BAR (Fintech App Header) ===================== */}
        <header className="flex items-center justify-between pt-1 pb-1">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-full bg-[#0E382B] text-white flex items-center justify-center font-bold text-base shadow-sm ring-2 ring-white">
              {partnerDisplayName.charAt(0)}
            </div>
            <div>
              <p className="text-xs text-[#697871] font-medium tracking-wide">Bonjour 👋</p>
              <h1 className="text-lg font-bold tracking-tight text-[#11241C] flex items-center gap-1.5">
                {partnerDisplayName}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D8EEDF] text-[#0E382B]">
                  Apporteur GoCab
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchData()}
              disabled={refreshing}
              title="Actualiser en direct"
              className="w-10 h-10 rounded-full bg-white border border-[#E5ECE7] text-[#151E19] flex items-center justify-center hover:bg-[#EAF2ED] active:scale-95 transition-all shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 text-[#0E382B] ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <a
              href="https://wa.me/212645398932?text=Bonjour%20GoCab%2C%20c%27est%20Zakaria.%20J%27aimerais%20faire%20un%20point%20sur%20mes%20leads."
              target="_blank"
              rel="noopener noreferrer"
              title="Contacter GoCab sur WhatsApp"
              className="w-10 h-10 rounded-full bg-white border border-[#E5ECE7] text-[#0E382B] flex items-center justify-center hover:bg-[#EAF2ED] active:scale-95 transition-all shadow-xs"
            >
              <MessageCircle className="w-4 h-4 fill-[#0E382B]/10" />
            </a>
          </div>
        </header>

        {/* ===================== HERO BALANCE CARD (Dark Emerald Fintech Wallet) ===================== */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0E382B] via-[#114232] to-[#0A2B21] text-white p-6 shadow-xl shadow-[#0E382B]/15">
          {/* Subtle geometric background glow */}
          <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-[#186049]/40 blur-2xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-40 h-40 rounded-full bg-[#D8EEDF]/10 blur-xl pointer-events-none" />

          {/* Top row */}
          <div className="relative z-10 flex items-center justify-between mb-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-emerald-100 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Total Commissions</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="opacity-70 hover:opacity-100 transition-opacity ml-1"
              >
                {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-emerald-200">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              <span>150 DH / validation</span>
            </div>
          </div>

          {/* Center Balance Display */}
          <div className="relative z-10 my-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl md:text-5xl font-extrabold tracking-tight">
                {showBalance ? (data?.totalCommissionEarnedMAD || 0).toLocaleString("fr-FR") : "••••"}
              </span>
              <span className="text-xl md:text-2xl font-bold text-emerald-300">DH</span>
            </div>
            <p className="text-xs text-emerald-200/80 mt-1 font-normal flex items-center gap-1.5">
              <span>{data?.convertedLeads || 0} chauffeur(s) validé(s)</span>
              <span>•</span>
              <span className="text-emerald-300">
                {data?.leads?.length ? Math.round(((data.convertedLeads || 0) / data.leads.length) * 100) : 0}% de conversion
              </span>
            </p>
          </div>

          {/* Bottom Card Strip: Potential In Progress */}
          <div className="relative z-10 mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-emerald-100/90">
            <div className="flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>En cours de qualification :</span>
            </div>
            <span className="font-semibold text-amber-200">
              {showBalance ? `+${(data?.potentialPendingCommissionMAD || 0).toLocaleString("fr-FR")} DH` : "••• DH"}{" "}
              <span className="opacity-75 font-normal">({data?.pendingLeads || 0} dossiers)</span>
            </span>
          </div>
        </div>

        {/* ===================== QUICK ACTIONS ROW (Fintech Pills) ===================== */}
        <div className="grid grid-cols-4 gap-2.5 pt-1">
          {/* Action 1: Add Lead */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#0E382B]/30 hover:bg-[#F0F5F2] active:scale-95 transition-all shadow-xs group"
          >
            <div className="w-12 h-12 rounded-full bg-[#0E382B] text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-xs font-semibold text-[#151E19]">Ajouter</span>
            <span className="text-[10px] text-[#697871]">+150 DH</span>
          </button>

          {/* Action 2: Share referral */}
          <button
            onClick={handleShareLink}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#0E382B]/30 hover:bg-[#F0F5F2] active:scale-95 transition-all shadow-xs group"
          >
            <div className="w-12 h-12 rounded-full bg-[#E8F4EC] text-[#0E382B] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5 stroke-[2]" />
            </div>
            <span className="text-xs font-semibold text-[#151E19]">Partager</span>
            <span className="text-[10px] text-[#697871]">Mon lien</span>
          </button>

          {/* Action 3: Analytics */}
          <button
            onClick={() => setActiveTab("ANALYTICS")}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border active:scale-95 transition-all shadow-xs group ${
              activeTab === "ANALYTICS"
                ? "bg-[#0E382B] text-white border-[#0E382B]"
                : "bg-white border-[#E5ECE7] hover:border-[#0E382B]/30 hover:bg-[#F0F5F2] text-[#151E19]"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform ${
                activeTab === "ANALYTICS" ? "bg-white/15 text-white" : "bg-[#E8F4EC] text-[#0E382B]"
              }`}
            >
              <BarChart3 className="w-5 h-5 stroke-[2]" />
            </div>
            <span className={`text-xs font-semibold ${activeTab === "ANALYTICS" ? "text-white" : "text-[#151E19]"}`}>
              Stats
            </span>
            <span className={`text-[10px] ${activeTab === "ANALYTICS" ? "text-emerald-200" : "text-[#697871]"}`}>
              Gains
            </span>
          </button>

          {/* Action 4: WhatsApp Support */}
          <a
            href="https://wa.me/212645398932?text=Salam%20GoCab%2C%20c%27est%20Zakaria%2C%20j%27ai%20une%20question%20concernant%20un%20chauffeur."
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#0E382B]/30 hover:bg-[#F0F5F2] active:scale-95 transition-all shadow-xs group"
          >
            <div className="w-12 h-12 rounded-full bg-[#E8F4EC] text-[#0E382B] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <MessageCircle className="w-5 h-5 stroke-[2]" />
            </div>
            <span className="text-xs font-semibold text-[#151E19]">Support</span>
            <span className="text-[10px] text-[#697871]">WhatsApp</span>
          </a>
        </div>

        {/* ===================== LIVE AVAILABLE CARS BANNER ===================== */}
        <button
          type="button"
          onClick={() => setActiveTab("AVAILABLE_CARS")}
          className="w-full p-3.5 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#0E382B]/40 hover:bg-[#F0F5F2]/60 transition-all flex items-center justify-between shadow-2xs group text-left cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#D8EEDF] text-[#0E382B] flex items-center justify-center shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#11241C]">Véhicules disponibles en flotte</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0E382B] text-white">
                  {data?.availableCarsCount ?? 0}
                </span>
              </div>
              <p className="text-[11px] text-[#697871] truncate mt-0.5">
                {(data?.availableCarsCount ?? 0) > 0
                  ? "Consultez les voitures prêtes à être attribuées dès aujourd'hui"
                  : "Aucune voiture libre actuellement — proposez en précommande (+150 DH)"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-[#0E382B] shrink-0 group-hover:translate-x-0.5 transition-transform">
            <span>Voir</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>

        {/* ===================== TAB VIEW SWITCHER ===================== */}
        <div className="grid grid-cols-5 rounded-2xl bg-[#E7ECE9] p-1 text-[10px] sm:text-xs font-semibold gap-1">
          <button
            onClick={() => setActiveTab("HOME")}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 truncate ${
              activeTab === "HOME" ? "bg-white text-[#0E382B] shadow-xs font-bold" : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">En cours ({activeLeads.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("ARCHIVE")}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 truncate ${
              activeTab === "ARCHIVE"
                ? "bg-white text-[#0E382B] shadow-xs font-bold"
                : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <Archive className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Archive ({treatedLeads.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("AVAILABLE_CARS")}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 truncate ${
              activeTab === "AVAILABLE_CARS"
                ? "bg-white text-[#0E382B] shadow-xs font-bold"
                : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <Car className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Voitures ({data?.availableCarsCount ?? 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("ANALYTICS")}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 truncate ${
              activeTab === "ANALYTICS"
                ? "bg-white text-[#0E382B] shadow-xs font-bold"
                : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("ALL_LEADS")}
            className={`py-2 px-1 rounded-xl transition-all flex items-center justify-center gap-1 truncate ${
              activeTab === "ALL_LEADS"
                ? "bg-white text-[#0E382B] shadow-xs font-bold"
                : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <Filter className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Registre</span>
          </button>
        </div>

        {/* ===================== TAB 1: ACTIVE DOSSIERS (EN COURS) ===================== */}
        {activeTab === "HOME" && (
          <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-bold text-[#11241C] tracking-tight">Dossiers Actifs (En cours)</h2>
                <p className="text-[11px] text-[#697871]">
                  Les dossiers validés ou clôturés sont archivés automatiquement
                </p>
              </div>
              <button
                onClick={() => setActiveTab("ARCHIVE")}
                className="text-xs font-semibold text-[#0E382B] hover:underline flex items-center gap-1 shrink-0"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive ({treatedLeads.length})</span>
              </button>
            </div>

            {/* Quick status filter pills for active leads */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setFilterCategory("ALL")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                  filterCategory === "ALL"
                    ? "bg-[#0E382B] text-white font-semibold shadow-xs"
                    : "bg-white text-[#697871] border border-[#E5ECE7] hover:bg-[#F0F5F2]"
                }`}
              >
                En cours ({activeLeads.length})
              </button>
              <button
                onClick={() => setFilterCategory("SHOWED_UP")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterCategory === "SHOWED_UP"
                    ? "bg-purple-800 text-white font-semibold shadow-xs"
                    : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                }`}
              >
                <span>👤 Présents ({activeLeads.filter((l) => l.presenceConfirmed || l.stageBadgeColor === "purple").length})</span>
              </button>
              <button
                onClick={() => setActiveTab("ARCHIVE")}
                className="px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-1 bg-emerald-50 text-[#0E382B] border border-emerald-200 hover:bg-emerald-100"
              >
                <Archive className="w-3.5 h-3.5 text-[#0E382B]" />
                <span>Traités → Archive ({treatedLeads.length})</span>
              </button>
            </div>

            {/* List of Active Leads */}
            <div className="space-y-2.5">
              {loading ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-[#E5ECE7]">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#0E382B] mx-auto mb-2" />
                  <p className="text-xs text-[#697871]">Chargement de votre portefeuille...</p>
                </div>
              ) : filteredActiveLeads.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-[#E5ECE7] space-y-3">
                  <div className="w-14 h-14 rounded-full bg-[#E8F4EC] text-[#0E382B] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#11241C]">Aucun dossier en attente</h3>
                    <p className="text-xs text-[#697871] max-w-xs mx-auto mt-1">
                      {treatedLeads.length > 0
                        ? `Vos ${treatedLeads.length} dossier(s) traité(s) sont classés dans l'Archive.`
                        : "Ajoutez votre premier candidat pour déclencher automatiquement votre commission de 150 DH dès validation."}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0E382B] text-white text-xs font-semibold shadow-xs hover:bg-[#114232] active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Ajouter un chauffeur</span>
                    </button>
                    {treatedLeads.length > 0 && (
                      <button
                        onClick={() => setActiveTab("ARCHIVE")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E8F4EC] text-[#0E382B] text-xs font-semibold hover:bg-[#D8EEDF] transition-all"
                      >
                        <Archive className="w-4 h-4" />
                        <span>Voir l&apos;Archive ({treatedLeads.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                filteredActiveLeads.map(renderLeadCard)
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: ARCHIVE (TREATED LEADS) ===================== */}
        {activeTab === "ARCHIVE" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-bold text-[#11241C] flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-[#0E382B]" />
                  <span>Archive — Dossiers Traités</span>
                </h2>
                <p className="text-[11px] text-[#697871]">
                  Chauffeurs validés (+150 DH) ou clôturés automatiquement archivés
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#D8EEDF] text-[#0E382B]">
                {filteredArchiveLeads.length} dossier(s)
              </span>
            </div>

            {/* Date Range Filter */}
            {renderDateRangeFilter()}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#697871] absolute left-3.5 top-3" />
              <input
                type="text"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder="Rechercher dans les archives (nom, téléphone, ville)..."
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white border border-[#E5ECE7] text-xs text-[#151E19] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0E382B]"
              />
              {archiveSearch && (
                <button
                  type="button"
                  onClick={() => setArchiveSearch("")}
                  className="absolute right-3.5 top-3 text-xs text-[#697871] hover:text-[#151E19]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Treated status filter pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setArchiveFilter("ALL_TREATED")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                  archiveFilter === "ALL_TREATED"
                    ? "bg-[#0E382B] text-white font-semibold shadow-xs"
                    : "bg-white text-[#697871] border border-[#E5ECE7] hover:bg-[#F0F5F2]"
                }`}
              >
                Tous traités ({treatedLeads.length})
              </button>
              <button
                onClick={() => setArchiveFilter("VALIDATED")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  archiveFilter === "VALIDATED"
                    ? "bg-[#0E382B] text-white font-semibold shadow-xs"
                    : "bg-white text-[#697871] border border-[#E5ECE7] hover:bg-[#F0F5F2]"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Validés +150 DH ({treatedLeads.filter((l) => l.status === "VALIDATED").length})</span>
              </button>
              <button
                onClick={() => setArchiveFilter("LOST")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  archiveFilter === "LOST"
                    ? "bg-[#0E382B] text-white font-semibold shadow-xs"
                    : "bg-white text-[#697871] border border-[#E5ECE7] hover:bg-[#F0F5F2]"
                }`}
              >
                <span>Non retenus ({treatedLeads.filter((l) => l.status === "LOST").length})</span>
              </button>
            </div>

            {/* Archived Leads List */}
            <div className="space-y-2.5">
              {filteredArchiveLeads.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-[#E5ECE7] space-y-2">
                  <Archive className="w-8 h-8 text-[#697871] mx-auto opacity-60" />
                  <h3 className="text-sm font-bold text-[#11241C]">Aucun dossier traité sur cette période</h3>
                  <p className="text-xs text-[#697871] max-w-xs mx-auto">
                    Ajustez le filtre de date ou de statut pour afficher vos dossiers archivés.
                  </p>
                </div>
              ) : (
                filteredArchiveLeads.map(renderLeadCard)
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 2: DASHBOARD WITH DATE RANGE FILTER ===================== */}
        {activeTab === "ANALYTICS" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-bold text-[#11241C] flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-[#0E382B]" />
                  <span>Dashboard &amp; Performance</span>
                </h2>
                <p className="text-[11px] text-[#697871]">Analyse filtrée par période en temps réel</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E8F4EC] text-[#0E382B]">
                {analyticsBreakdown.total} dossier(s)
              </span>
            </div>

            {/* Date Range Filter */}
            {renderDateRangeFilter()}

            {/* Performance KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-[#E5ECE7] shadow-xs">
                <span className="text-[11px] font-medium text-[#697871]">Commissions Gagnées</span>
                <p className="text-2xl font-extrabold text-[#0E382B] mt-1">
                  {analyticsBreakdown.earnedMAD.toLocaleString("fr-FR")} DH
                </p>
                <span className="text-[10px] text-emerald-700 font-semibold">
                  {analyticsBreakdown.validated} validé(s) × 150 DH
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5ECE7] shadow-xs">
                <span className="text-[11px] font-medium text-[#697871]">Total Présentés</span>
                <p className="text-2xl font-extrabold text-[#11241C] mt-1">{analyticsBreakdown.total}</p>
                <span className="text-[10px] text-[#697871] font-semibold">
                  Taux conversion : {analyticsBreakdown.valPct}%
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5ECE7] shadow-xs">
                <span className="text-[11px] font-medium text-[#697871]">Gains Potentiels</span>
                <p className="text-2xl font-extrabold text-amber-700 mt-1">
                  {analyticsBreakdown.potentialMAD.toLocaleString("fr-FR")} DH
                </p>
                <span className="text-[10px] text-amber-700 font-semibold">
                  {analyticsBreakdown.pending} en cours
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5ECE7] shadow-xs">
                <span className="text-[11px] font-medium text-[#697871]">Présents au siège</span>
                <p className="text-2xl font-extrabold text-purple-800 mt-1">{analyticsBreakdown.showedUp}</p>
                <span className="text-[10px] text-purple-700 font-semibold">
                  {analyticsBreakdown.showUpPct}% de présence
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5ECE7] shadow-xs">
                <span className="text-[11px] font-medium text-[#697871]">Non retenus</span>
                <p className="text-2xl font-extrabold text-slate-600 mt-1">{analyticsBreakdown.lost}</p>
                <span className="text-[10px] text-slate-500 font-semibold">
                  {analyticsBreakdown.lostPct}% des dossiers
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("ARCHIVE")}
                className="p-4 rounded-2xl bg-[#E8F4EC] border border-[#CDE5D4] shadow-xs text-left hover:bg-[#D8EEDF] transition-all cursor-pointer"
              >
                <span className="text-[11px] font-semibold text-[#0E382B] flex items-center justify-between">
                  <span>Traités (Archive)</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
                <p className="text-2xl font-extrabold text-[#0E382B] mt-1">{analyticsBreakdown.treated}</p>
                <span className="text-[10px] text-[#0E382B]/80 font-semibold">Ouvrir l&apos;Archive →</span>
              </button>
            </div>

            {/* Total Earned Donut Card */}
            <div className="p-6 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm flex flex-col items-center text-center">
              <p className="text-xs font-semibold text-[#697871] uppercase tracking-wider mb-4">
                Répartition sur la période sélectionnée
              </p>

              {/* Central Circle Metric (Donut Style) */}
              <div className="relative w-40 h-40 rounded-full border-8 border-[#0E382B] flex flex-col items-center justify-center bg-[#F4F6F0]/50 shadow-inner my-1">
                <span className="text-2xl font-extrabold text-[#0E382B]">
                  {analyticsBreakdown.earnedMAD.toLocaleString("fr-FR")}
                </span>
                <span className="text-[11px] font-bold text-[#697871] uppercase tracking-wider">DH Gagnés</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-[#D8EEDF] px-2 py-0.5 rounded-full mt-1">
                  {analyticsBreakdown.validated} / {analyticsBreakdown.total} Validés
                </span>
              </div>

              {/* Legend Grid */}
              <div className="grid grid-cols-2 gap-3 w-full mt-5 pt-4 border-t border-[#E5ECE7] text-left text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[#0E382B]" />
                  <span className="text-[#697871] flex-1">Validés (150 DH)</span>
                  <span className="font-bold text-[#11241C]">{analyticsBreakdown.valPct}%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                  <span className="text-[#697871] flex-1">En cours</span>
                  <span className="font-bold text-[#11241C]">{analyticsBreakdown.penPct}%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[#E5E7EB]" />
                  <span className="text-[#697871] flex-1">Non convertis</span>
                  <span className="font-bold text-[#11241C]">{analyticsBreakdown.lostPct}%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                  <span className="text-[#697871] flex-1">Taux présence</span>
                  <span className="font-bold text-[#0E382B]">{analyticsBreakdown.showUpPct}%</span>
                </div>
              </div>
            </div>

            {/* City Breakdown */}
            {analyticsBreakdown.cityBreakdown.length > 0 && (
              <div className="p-5 rounded-3xl bg-white border border-[#E5ECE7] shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#11241C] uppercase tracking-wider">Top Villes (Période)</h3>
                  <span className="text-[11px] text-[#697871]">Validés / Total</span>
                </div>
                <div className="space-y-2.5">
                  {analyticsBreakdown.cityBreakdown.map((c) => {
                    const pct = analyticsBreakdown.total > 0 ? Math.round((c.total / analyticsBreakdown.total) * 100) : 0;
                    return (
                      <div key={c.city} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#11241C] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#0E382B]" />
                            {c.city}
                          </span>
                          <span className="text-[#697871] font-medium">
                            <strong className="text-[#0E382B]">{c.validated}</strong> / {c.total} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#F0F5F2] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0E382B] transition-all"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Motivational Performance Insight Pill */}
            <div className="p-4 rounded-2xl bg-[#E8F4EC] border border-[#CDE5D4] flex items-center justify-between text-xs text-[#0E382B]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5 text-[#0E382B]" />
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {analyticsBreakdown.valPct >= 50 ? "Excellente rentabilité !" : "Pipeline en pleine croissance !"}
                  </p>
                  <p className="text-[11px] text-[#0E382B]/80">
                    Chaque voiture prise ou précommande versée crédite instantanément 150 DH sur votre compte.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#0E382B] shrink-0" />
            </div>
          </div>
        )}

        {/* ===================== TAB 3: SEARCH & COMPLETE DIRECTORY ===================== */}
        {activeTab === "ALL_LEADS" && (
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-base font-bold text-[#11241C]">Recherche & Registre Complet</h2>
              <p className="text-xs text-[#697871]">Filtrer tous vos chauffeurs enregistrés</p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#697871] absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, téléphone, ville..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#E5ECE7] text-xs text-[#151E19] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0E382B]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-3.5 text-xs text-[#697871] hover:text-[#151E19]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* City Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setSelectedCity("ALL")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                  selectedCity === "ALL"
                    ? "bg-[#0E382B] text-white font-semibold"
                    : "bg-white text-[#697871] border border-[#E5ECE7]"
                }`}
              >
                Toutes les villes
              </button>
              {MOROCCAN_CITIES.slice(0, 6).map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                    selectedCity === city
                      ? "bg-[#0E382B] text-white font-semibold"
                      : "bg-white text-[#697871] border border-[#E5ECE7]"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>

            {/* Results count */}
            <p className="text-xs text-[#697871] px-1 font-medium">
              Affichage de {filteredLeads.length} chauffeur(s)
            </p>

            {/* Results list */}
            <div className="space-y-2.5">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="p-4 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#0E382B]/30 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#11241C] truncate">{lead.name}</p>
                    <p className="text-xs text-[#697871] mt-0.5">
                      {lead.phone} • {lead.city || "Maroc"}
                    </p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                        lead.isConverted
                          ? "bg-[#D8EEDF] text-[#0E382B]"
                          : lead.status === "PENDING"
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {lead.statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <span
                        className={`text-sm font-extrabold block ${
                          lead.isConverted ? "text-[#0E382B]" : "text-[#697871]"
                        }`}
                      >
                        {lead.isConverted ? "+150.00 DH" : "0.00 DH"}
                      </span>
                      <span className="text-[10px] text-[#697871]">
                        {new Date(lead.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLead(lead);
                      }}
                      disabled={deletingId === lead.id}
                      className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                      title="Supprimer ce dossier"
                    >
                      {deletingId === lead.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: AVAILABLE CARS IN FLEET ===================== */}
        {activeTab === "AVAILABLE_CARS" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-bold text-[#11241C] tracking-tight">Véhicules Disponibles</h2>
                <p className="text-[11px] text-[#697871]">
                  Parc GoCab prêt pour attribution immédiate (+150 DH / chauffeur)
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#D8EEDF] text-[#0E382B] text-xs font-extrabold">
                {data?.availableCarsCount ?? 0} libre(s)
              </span>
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#697871] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par modèle (Sandero, Logan), plaque ou ville..."
                value={carSearchQuery}
                onChange={(e) => setCarSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#E5ECE7] text-sm text-[#11241C] placeholder-[#697871] focus:outline-none focus:ring-2 focus:ring-[#0E382B]/20 focus:border-[#0E382B]"
              />
            </div>

            {/* City filter pills */}
            {availableCarCities.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  onClick={() => setCarCityFilter("ALL")}
                  className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                    carCityFilter === "ALL"
                      ? "bg-[#0E382B] text-white font-semibold"
                      : "bg-white text-[#697871] border border-[#E5ECE7]"
                  }`}
                >
                  Toutes les villes ({data?.availableCarsCount ?? 0})
                </button>
                {availableCarCities.map((city) => (
                  <button
                    key={city}
                    onClick={() => setCarCityFilter(city)}
                    className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                      carCityFilter === city
                        ? "bg-[#0E382B] text-white font-semibold"
                        : "bg-white text-[#697871] border border-[#E5ECE7]"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}

            {/* Available cars list */}
            {filteredAvailableCars.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white border border-[#E5ECE7] text-center space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-[#F0F5F2] text-[#0E382B] mx-auto flex items-center justify-center">
                  <Car className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-[#11241C]">
                  {(data?.availableCarsCount ?? 0) === 0
                    ? "Aucun véhicule disponible pour le moment"
                    : "Aucun véhicule ne correspond à votre recherche"}
                </p>
                <p className="text-xs text-[#697871] max-w-xs mx-auto">
                  {(data?.availableCarsCount ?? 0) === 0
                    ? "Tous les véhicules de la flotte sont actuellement attribués. Vous pouvez tout de même proposer des chauffeurs en précommande (+150 DH)."
                    : "Essayez un autre modèle, matricule ou filtre de ville."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDriverIntention("Déposer un acompte précommande");
                    setDriverNotes("");
                    setShowAddModal(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E382B] text-white text-xs font-bold hover:bg-[#114232] transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Proposer un chauffeur (+150 DH)</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAvailableCars.map((car) => (
                  <div
                    key={car.id}
                    className="p-4 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#0E382B]/30 transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-[#D8EEDF] text-[#0E382B] flex items-center justify-center shrink-0">
                        <Car className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[#11241C] truncate">
                            {car.makeModel}
                          </p>
                          {car.year && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {car.year}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#697871] mt-0.5">
                          <span className="font-mono font-bold text-[#0E382B] bg-[#F0F5F2] px-1.5 py-0.5 rounded">
                            {car.plateNumber}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />
                            {car.hubCity || "Casablanca"}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Disponible immédiatement
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleProposeDriverForCar(car)}
                      className="px-3 py-2 rounded-xl bg-[#0E382B] hover:bg-[#114232] text-white text-xs font-bold shrink-0 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Proposer</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== FLOATING FINTECH BOTTOM DOCK ===================== */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/95 backdrop-blur-md border border-[#E5ECE7] rounded-full p-2 shadow-2xl flex items-center justify-between z-30 ring-1 ring-black/5">
          {/* Home Nav */}
          <button
            onClick={() => setActiveTab("HOME")}
            className={`flex-1 flex flex-col items-center py-1 rounded-full transition-all ${
              activeTab === "HOME" ? "text-[#0E382B] font-bold" : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">En cours</span>
          </button>

          {/* Archive Nav */}
          <button
            onClick={() => setActiveTab("ARCHIVE")}
            className={`flex-1 flex flex-col items-center py-1 rounded-full transition-all relative ${
              activeTab === "ARCHIVE" ? "text-[#0E382B] font-bold" : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <div className="relative">
              <Archive className="w-5 h-5" />
              {treatedLeads.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 rounded-full bg-[#0E382B] text-white text-[9px] font-extrabold flex items-center justify-center">
                  {treatedLeads.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">Archive</span>
          </button>

          {/* Central Floating Action: Add Lead (Large Emerald Button) */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-13 h-13 -my-3 rounded-full bg-[#0E382B] text-white flex items-center justify-center shadow-lg shadow-[#0E382B]/30 hover:scale-105 active:scale-95 transition-all ring-4 ring-white"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>

          {/* Dashboard Nav */}
          <button
            onClick={() => setActiveTab("ANALYTICS")}
            className={`flex-1 flex flex-col items-center py-1 rounded-full transition-all ${
              activeTab === "ANALYTICS" ? "text-[#0E382B] font-bold" : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Dashboard</span>
          </button>

          {/* Available Cars Nav */}
          <button
            onClick={() => setActiveTab("AVAILABLE_CARS")}
            className={`flex-1 flex flex-col items-center py-1 rounded-full transition-all relative ${
              activeTab === "AVAILABLE_CARS" ? "text-[#0E382B] font-bold" : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <div className="relative">
              <Car className="w-5 h-5" />
              {(data?.availableCarsCount ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 rounded-full bg-[#0E382B] text-white text-[9px] font-extrabold flex items-center justify-center">
                  {data?.availableCarsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">Voitures</span>
          </button>
        </div>

        {/* ===================== MODAL: AJOUT CHAUFFEUR RAPIDE ===================== */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE7]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#D8EEDF] text-[#0E382B] flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#11241C]">Nouveau Chauffeur</h3>
                    <p className="text-xs text-[#697871]">Éligible à +150 DH de commission</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddLead} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-[#11241C] mb-1">
                    Nom Complet du Chauffeur *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Ex: Mohamed Alami"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#0E382B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#11241C] mb-1">
                    Numéro de Téléphone WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="06 12 34 56 78 ou +212..."
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#0E382B]"
                  />
                  <p className="text-[11px] text-[#697871] mt-1">Format marocain supporté (06/07/+212)</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#11241C] mb-1">Ville</label>
                    <select
                      value={driverCity}
                      onChange={(e) => setDriverCity(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#0E382B] bg-white"
                    >
                      {MOROCCAN_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#11241C] mb-1">Intention Chauffeur</label>
                    <select
                      value={driverIntention}
                      onChange={(e) => setDriverIntention(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#0E382B] bg-white"
                    >
                      <option value="Prendre une voiture immédiatement">Prendre voiture direct</option>
                      <option value="Déposer un acompte précommande">Verser acompte</option>
                      <option value="Information & Session formation">Intéressé formation</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#11241C] mb-1">Remarques ou détails (Optionnel)</label>
                  <textarea
                    rows={2}
                    value={driverNotes}
                    onChange={(e) => setDriverNotes(e.target.value)}
                    placeholder="Ex: Permis B depuis 5 ans, disponible de suite pour récupérer le véhicule..."
                    className="w-full px-4 py-2 rounded-xl border border-[#D1D5DB] text-sm focus:outline-none focus:ring-2 focus:ring-[#0E382B]"
                  />
                </div>

                {/* Commission Guarantee Banner */}
                <div className="p-3.5 rounded-2xl bg-[#E8F4EC] border border-[#CDE5D4] text-xs text-[#0E382B] flex items-center space-x-2.5">
                  <Coins className="w-5 h-5 shrink-0 text-[#0E382B]" />
                  <p>
                    <span className="font-bold">Garantie 150 DH :</span> Dès que l'agent GoCab valide l'affectation du
                    véhicule ou le versement de l'acompte, la commission s'ajoute immédiatement à votre solde.
                  </p>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 rounded-xl border border-[#D1D5DB] text-sm font-semibold text-[#697871] hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 rounded-xl bg-[#0E382B] hover:bg-[#114232] text-white text-sm font-bold shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Envoi à GoCab...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Transmettre (+150 DH)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== MODAL / DRAWER: DETAIL DU DOSSIER ===================== */}
        {selectedLead && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5ECE7]">
                <div>
                  <span className="text-[11px] font-semibold text-[#697871] uppercase tracking-wider">
                    Fiche Chauffeur
                  </span>
                  <h3 className="text-lg font-bold text-[#11241C]">{selectedLead.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Commission status card */}
              <div
                className={`p-4 rounded-2xl border ${
                  selectedLead.isConverted
                    ? "bg-[#D8EEDF]/40 border-[#A3D9B5]"
                    : selectedLead.status === "PENDING"
                    ? "bg-[#FEF3C7]/40 border-[#FDE68A]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#697871]">Statut Commission</span>
                  <span
                    className={`text-base font-extrabold ${
                      selectedLead.isConverted ? "text-[#0E382B]" : "text-amber-800"
                    }`}
                  >
                    {selectedLead.isConverted ? "+150.00 DH Validé" : "⏳ 150 DH en cours"}
                  </span>
                </div>
                <p className="text-xs text-[#11241C] font-medium mt-1">{selectedLead.statusLabel}</p>
              </div>

              {/* Driver attributes */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#697871]">Téléphone</span>
                  <a
                    href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#0E382B] flex items-center gap-1 hover:underline"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {selectedLead.phone}
                  </a>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#697871]">Présence au siège</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      selectedLead.presenceConfirmed
                        ? "bg-purple-100 text-purple-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {selectedLead.presenceConfirmed ? "👤 Présent au siège" : "Non encore présenté"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#697871]">Ville</span>
                  <span className="font-semibold text-[#11241C]">{selectedLead.city || "Maroc"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#697871]">Date d'enregistrement</span>
                  <span className="font-semibold text-[#11241C]">
                    {new Date(selectedLead.createdAt).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                {selectedLead.notes && (
                  <div className="py-1.5">
                    <span className="text-[#697871] block mb-0.5">Notes :</span>
                    <p className="p-2.5 rounded-xl bg-slate-50 text-slate-700 italic border border-slate-100">
                      {selectedLead.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDeleteLead(selectedLead)}
                  disabled={deletingId === selectedLead.id}
                  className="flex-1 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deletingId === selectedLead.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Supprimer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#0E382B] text-white text-xs font-bold hover:bg-[#114232] transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
