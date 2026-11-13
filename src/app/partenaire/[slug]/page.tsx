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
} from "lucide-react";
import { PartnerSummary, PartnerLeadEvaluation } from "@/lib/services/partnerCommissionService";

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

export default function PartnerPortalPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "zakaria";
  const partnerDisplayName = slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase();

  // Navigation state (Fintech App Tabs)
  const [activeTab, setActiveTab] = useState<"HOME" | "ANALYTICS" | "ALL_LEADS">("HOME");

  // Data state
  const [data, setData] = useState<PartnerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  // Filters & Search
  const [filterCategory, setFilterCategory] = useState<"ALL" | "VALIDATED" | "PENDING" | "LOST">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("ALL");

  // Lead modal / drawer
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PartnerLeadEvaluation | null>(null);

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

  // Filtered leads
  const filteredLeads = useMemo(() => {
    if (!data?.leads) return [];
    return data.leads.filter((l) => {
      if (filterCategory === "VALIDATED" && !l.isConverted) return false;
      if (filterCategory === "PENDING" && l.status !== "PENDING") return false;
      if (filterCategory === "LOST" && l.status !== "LOST") return false;

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
  }, [data?.leads, filterCategory, selectedCity, searchQuery]);

  // Analytics stats
  const analyticsBreakdown = useMemo(() => {
    if (!data) return { validated: 0, pending: 0, lost: 0, total: 0, valPct: 0, penPct: 0, lostPct: 0 };
    const validated = data.convertedLeads || 0;
    const pending = data.pendingLeads || 0;
    const lost = data.lostLeads || 0;
    const total = data.totalLeads || 0;
    return {
      validated,
      pending,
      lost,
      total,
      valPct: total > 0 ? Math.round((validated / total) * 100) : 0,
      penPct: total > 0 ? Math.round((pending / total) * 100) : 0,
      lostPct: total > 0 ? Math.round((lost / total) * 100) : 0,
    };
  }, [data]);

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

        {/* ===================== TAB VIEW SWITCHER ===================== */}
        <div className="flex rounded-2xl bg-[#E7ECE9] p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("HOME")}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "HOME" ? "bg-white text-[#0E382B] shadow-xs font-bold" : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Historique ({data?.leads?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("ANALYTICS")}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "ANALYTICS"
                ? "bg-white text-[#0E382B] shadow-xs font-bold"
                : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Analytique</span>
          </button>
          <button
            onClick={() => setActiveTab("ALL_LEADS")}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "ALL_LEADS"
                ? "bg-white text-[#0E382B] shadow-xs font-bold"
                : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Recherche & Filtres</span>
          </button>
        </div>

        {/* ===================== TAB 1: RECENT TRANSACTIONS / DOSSIERS ===================== */}
        {activeTab === "HOME" && (
          <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold text-[#11241C] tracking-tight">Dossiers & Commissions Récents</h2>
              <button
                onClick={() => setActiveTab("ALL_LEADS")}
                className="text-xs font-semibold text-[#0E382B] hover:underline flex items-center gap-1"
              >
                <span>Voir tout ({data?.leads?.length || 0})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick status filter pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button
                onClick={() => setFilterCategory("ALL")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
                  filterCategory === "ALL"
                    ? "bg-[#0E382B] text-white font-semibold shadow-xs"
                    : "bg-white text-[#697871] border border-[#E5ECE7] hover:bg-[#F0F5F2]"
                }`}
              >
                Tous ({data?.leads?.length || 0})
              </button>
              <button
                onClick={() => setFilterCategory("VALIDATED")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterCategory === "VALIDATED"
                    ? "bg-[#0E382B] text-white font-semibold shadow-xs"
                    : "bg-white text-[#697871] border border-[#E5ECE7] hover:bg-[#F0F5F2]"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Validés ({data?.convertedLeads || 0})</span>
              </button>
              <button
                onClick={() => setFilterCategory("PENDING")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterCategory === "PENDING"
                    ? "bg-[#0E382B] text-white font-semibold shadow-xs"
                    : "bg-white text-[#697871] border border-[#E5ECE7] hover:bg-[#F0F5F2]"
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>En cours ({data?.pendingLeads || 0})</span>
              </button>
              <button
                onClick={() => setFilterCategory("LOST")}
                className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                  filterCategory === "LOST"
                    ? "bg-[#0E382B] text-white font-semibold shadow-xs"
                    : "bg-white text-[#697871] border border-[#E5ECE7] hover:bg-[#F0F5F2]"
                }`}
              >
                <span>Non retenus ({data?.lostLeads || 0})</span>
              </button>
            </div>

            {/* List of Leads styled as Transactions */}
            <div className="space-y-2.5">
              {loading ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-[#E5ECE7]">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#0E382B] mx-auto mb-2" />
                  <p className="text-xs text-[#697871]">Chargement de votre portefeuille...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-[#E5ECE7] space-y-3">
                  <div className="w-14 h-14 rounded-full bg-[#E8F4EC] text-[#0E382B] flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#11241C]">Aucun chauffeur dans cette vue</h3>
                    <p className="text-xs text-[#697871] max-w-xs mx-auto mt-1">
                      Ajoutez votre premier candidat pour déclencher automatiquement votre commission de 150 DH dès
                      validation.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0E382B] text-white text-xs font-semibold shadow-xs hover:bg-[#114232] active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un chauffeur</span>
                  </button>
                </div>
              ) : (
                filteredLeads.map((lead) => {
                  const isValidated = lead.isConverted;
                  const isPending = lead.status === "PENDING";

                  return (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="p-4 rounded-2xl bg-white border border-[#E5ECE7] hover:border-[#0E382B]/30 hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-3"
                    >
                      {/* Left Avatar Icon */}
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                            isValidated
                              ? "bg-[#D8EEDF] text-[#0E382B]"
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
                          ) : isPending ? (
                            <Clock className="w-5 h-5" />
                          ) : (
                            <Users className="w-5 h-5" />
                          )}
                        </div>

                        {/* Middle Info */}
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
                          {/* Status Pill */}
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                isValidated
                                  ? "bg-[#D8EEDF] text-[#0E382B]"
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

                      {/* Right Amount / Commission */}
                      <div className="text-right shrink-0">
                        {isValidated ? (
                          <div>
                            <span className="text-sm md:text-base font-extrabold text-[#0E382B] block">
                              +150.00 DH
                            </span>
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
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 2: ANALYTICS VIEW (Screen 3 in Inspiration) ===================== */}
        {activeTab === "ANALYTICS" && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold text-[#11241C]">Analytique & Performance</h2>
              <span className="text-xs text-[#697871] font-medium">Cumul temps réel</span>
            </div>

            {/* Total Spent / Earned Donut Card */}
            <div className="p-6 rounded-3xl bg-white border border-[#E5ECE7] shadow-sm flex flex-col items-center text-center">
              <p className="text-xs font-semibold text-[#697871] uppercase tracking-wider mb-4">
                Répartition de vos Chauffeurs
              </p>

              {/* Central Circle Metric (Donut Style) */}
              <div className="relative w-44 h-44 rounded-full border-8 border-[#0E382B] flex flex-col items-center justify-center bg-[#F4F6F0]/50 shadow-inner my-2">
                <span className="text-3xl font-extrabold text-[#0E382B]">
                  {(data?.totalCommissionEarnedMAD || 0).toLocaleString("fr-FR")}
                </span>
                <span className="text-xs font-bold text-[#697871] uppercase tracking-wider">DH Gagnés</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-[#D8EEDF] px-2 py-0.5 rounded-full mt-1">
                  {analyticsBreakdown.validated} / {analyticsBreakdown.total} Chauffeurs
                </span>
              </div>

              {/* Legend Grid */}
              <div className="grid grid-cols-2 gap-3 w-full mt-6 pt-5 border-t border-[#E5ECE7] text-left text-xs">
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
                  <span className="text-[#697871] flex-1">Taux succès</span>
                  <span className="font-bold text-[#0E382B]">{analyticsBreakdown.valPct}%</span>
                </div>
              </div>
            </div>

            {/* Motivational Performance Insight Pill (Matching screen 3) */}
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

            {/* Performance KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-[#E5ECE7] shadow-xs">
                <span className="text-[11px] font-medium text-[#697871]">Total Présentés</span>
                <p className="text-2xl font-extrabold text-[#11241C] mt-1">{data?.totalLeads || 0}</p>
                <span className="text-[10px] text-emerald-700 font-semibold">Chauffeurs transmis</span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-[#E5ECE7] shadow-xs">
                <span className="text-[11px] font-medium text-[#697871]">Gains Potentiels</span>
                <p className="text-2xl font-extrabold text-amber-700 mt-1">
                  {(data?.potentialPendingCommissionMAD || 0).toLocaleString()} DH
                </p>
                <span className="text-[10px] text-amber-700 font-semibold">
                  {data?.pendingLeads || 0} en qualification
                </span>
              </div>
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
                  <div className="text-right shrink-0">
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
                </div>
              ))}
            </div>
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
            <Wallet className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Accueil</span>
          </button>

          {/* Analytics Nav */}
          <button
            onClick={() => setActiveTab("ANALYTICS")}
            className={`flex-1 flex flex-col items-center py-1 rounded-full transition-all ${
              activeTab === "ANALYTICS" ? "text-[#0E382B] font-bold" : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Stats</span>
          </button>

          {/* Central Floating Action: Add Lead (Large Emerald Button) */}
          <button
            onClick={() => setShowAddModal(true)}
            className="w-13 h-13 -my-3 rounded-full bg-[#0E382B] text-white flex items-center justify-center shadow-lg shadow-[#0E382B]/30 hover:scale-105 active:scale-95 transition-all ring-4 ring-white"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>

          {/* Directory Nav */}
          <button
            onClick={() => setActiveTab("ALL_LEADS")}
            className={`flex-1 flex flex-col items-center py-1 rounded-full transition-all ${
              activeTab === "ALL_LEADS" ? "text-[#0E382B] font-bold" : "text-[#697871] hover:text-[#151E19]"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Dossiers</span>
          </button>

          {/* WhatsApp Direct Nav */}
          <a
            href="https://wa.me/212645398932?text=Salam%20GoCab%2C%20c%27est%20Zakaria."
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center py-1 rounded-full text-[#697871] hover:text-[#0E382B] transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Contact</span>
          </a>
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

              <button
                onClick={() => setSelectedLead(null)}
                className="w-full py-2.5 rounded-xl bg-[#0E382B] text-white text-xs font-bold hover:bg-[#114232] transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
