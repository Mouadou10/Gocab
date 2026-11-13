"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  Users,
  CheckCircle2,
  Clock,
  Coins,
  Send,
  Phone,
  MapPin,
  Calendar,
  Sparkles,
  RefreshCw,
  Search,
  Car,
  ChevronDown,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  ShieldCheck,
  TrendingUp,
  FileCheck2,
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

  const [data, setData] = useState<PartnerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<"ALL" | "VALIDATED" | "PENDING" | "LOST">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // New Lead Form State
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverCity, setDriverCity] = useState("Casablanca");
  const [driverIntention, setDriverIntention] = useState("Prendre une voiture immédiatement");
  const [driverNotes, setDriverNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch partner data
  const fetchData = useCallback(async (isSilent = false) => {
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
  }, [slug]);

  useEffect(() => {
    fetchData();
    // Auto refresh every 20s for real-time tracking
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
        `🎉 Chauffeur ${driverName} transmis à GoCab ! Éligible à 150 DH dès prise de voiture ou précommande.`,
        { duration: 6000 }
      );

      // Reset form
      setDriverName("");
      setDriverPhone("");
      setDriverNotes("");
      setShowAddForm(false);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur de transmission");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    if (!data?.leads) return [];
    return data.leads.filter((l) => {
      if (filterTab === "VALIDATED" && !l.isConverted) return false;
      if (filterTab === "PENDING" && l.status !== "PENDING") return false;
      if (filterTab === "LOST" && l.status !== "LOST") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = l.name.toLowerCase().includes(q);
        const matchPhone = l.phone.toLowerCase().includes(q);
        const matchCity = (l.city || "").toLowerCase().includes(q);
        return matchName || matchPhone || matchCity;
      }
      return true;
    });
  }, [data?.leads, filterTab, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      <Toaster position="top-right" />

      {/* Top Brand Banner */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 p-1 flex items-center justify-center">
            <Image
              src="/gocab-official-logo.png"
              alt="GoCab Logo"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-100">
                GoCab Morocco
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Partenaire Officiel 🇲🇦
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-black text-amber-400 leading-tight">
              Espace Apporteur d&apos;Affaires — {partnerDisplayName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-bold text-slate-200 border border-slate-700/80 transition-all cursor-pointer disabled:opacity-50"
            title="Rafraîchir les données en direct"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </header>

      {/* Hero Header & Value Proposition */}
      <section className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800 px-4 sm:px-8 pt-6 pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Welcome & Rule Notice */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rémunération Directe à la Performance</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Tableau de Bord des Commissions
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Chaque chauffeur recommandé qui <strong className="text-slate-200">prend une voiture</strong> ou qui <strong className="text-slate-200">verse une précommande</strong> vous rapporte automatiquement <span className="text-amber-400 font-bold">150 MAD</span> de commission, validée dès la confirmation par l&apos;équipe GoCab.
              </p>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Transmettre un Chauffeur (+150 DH)</span>
            </button>
          </div>

          {/* Quick Submission Modal / Collapsible Form */}
          {showAddForm && (
            <div className="mb-8 p-5 sm:p-6 rounded-3xl bg-slate-850 border-2 border-amber-500/40 shadow-2xl shadow-amber-500/10 animate-fade-in">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Car className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      Nouveau Chauffeur à Enregistrer
                    </h3>
                    <p className="text-xs text-slate-400">
                      Le lead sera immédiatement injecté dans le CRM GoCab avec votre tag partenaire ({partnerDisplayName}).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg"
                >
                  ✕ Fermer
                </button>
              </div>

              <form onSubmit={handleAddLead} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Nom et Prénom du Chauffeur <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Youssef El Amrani"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Téléphone WhatsApp Marocain <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: 06 61 23 45 67 ou +2126..."
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Ville Souhaitée
                    </label>
                    <select
                      value={driverCity}
                      onChange={(e) => setDriverCity(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    >
                      {MOROCCAN_CITIES.map((c) => (
                        <option key={c} value={c} className="bg-slate-900 text-white">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Objectif du Chauffeur
                    </label>
                    <select
                      value={driverIntention}
                      onChange={(e) => setDriverIntention(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    >
                      <option value="Prendre une voiture immédiatement">Prendre une voiture immédiatement</option>
                      <option value="Verser une précommande (Réservation)">Verser une précommande (Réservation)</option>
                      <option value="Renseignement & Intégration">Renseignement & Intégration</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Remarques / Disponibilité (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Permis depuis 4 ans, disponible de suite, prêt pour caution"
                    value={driverNotes}
                    onChange={(e) => setDriverNotes(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dès que l&apos;onboarding confirme la prise de véhicule ou la précommande, vous gagnez 150 DH.</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? "Transmission en cours..." : "Confirmer l'Envoi Chauffeur"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total Commission Validated */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/30 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Commissions Gagnées
                </span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Coins className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {data ? `${data.totalCommissionEarnedMAD} DH` : "—"}
              </div>
              <p className="text-[11px] text-emerald-400/90 font-semibold mt-1">
                {data?.convertedLeads || 0} chauffeur{(data?.convertedLeads || 0) > 1 ? "s" : ""} validé{(data?.convertedLeads || 0) > 1 ? "s" : ""} × 150 DH
              </p>
            </div>

            {/* Card 2: Converted Drivers */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Voiture ou Précommande
                </span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {data?.convertedLeads || 0}
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Contrats confirmés par GoCab
              </p>
            </div>

            {/* Card 3: In Progress Leads */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Dossiers En Cours
                </span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Clock className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                {data?.pendingLeads || 0}
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Gain potentiel : +{data?.potentialPendingCommissionMAD || 0} DH
              </p>
            </div>

            {/* Card 4: Total Repertoire */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Transmis
                </span>
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Users className="w-5 h-5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {data?.totalLeads || 0}
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                Taux de conversion : {data?.conversionRatePct || 0}%
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Driver Ledger */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl">
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-black text-white">
                Suivi Détaillé des Chauffeurs Recommandés
              </h3>
              <p className="text-xs text-slate-400">
                Statuts actualisés en temps réel par les agents d&apos;onboarding et la flotte.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher nom, ville, tél..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 pt-4 pb-4 overflow-x-auto scrollbar-none text-xs">
            <button
              onClick={() => setFilterTab("ALL")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                filterTab === "ALL"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Tous ({data?.totalLeads || 0})
            </button>
            <button
              onClick={() => setFilterTab("VALIDATED")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                filterTab === "VALIDATED"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
              }`}
            >
              ✅ Validés (+150 DH) ({data?.convertedLeads || 0})
            </button>
            <button
              onClick={() => setFilterTab("PENDING")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                filterTab === "PENDING"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
              }`}
            >
              ⏳ En cours ({data?.pendingLeads || 0})
            </button>
            <button
              onClick={() => setFilterTab("LOST")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                filterTab === "LOST"
                  ? "bg-rose-600/80 text-white shadow-xs"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
              }`}
            >
              ❌ Non convertis ({data?.lostLeads || 0})
            </button>
          </div>

          {/* Driver List */}
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
              <p className="text-sm font-semibold">Chargement de votre portefeuille...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/50 my-2">
              <Users className="w-10 h-10 mx-auto text-slate-600" />
              <h4 className="text-sm font-bold text-slate-300">Aucun chauffeur trouvé</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? "Aucun résultat ne correspond à votre recherche."
                  : "Vous n'avez pas encore de chauffeur dans cette catégorie. Cliquez sur le bouton ci-dessus pour en ajouter un !"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                >
                  + Ajouter mon premier chauffeur
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    lead.isConverted
                      ? "bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40 shadow-sm"
                      : lead.status === "LOST"
                      ? "bg-slate-950/40 border-slate-800/60 opacity-75"
                      : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Driver Identity */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-white">
                          {lead.name}
                        </span>
                        <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
                          {lead.phone}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {lead.city}
                        </span>
                      </div>

                      {/* Notes / Details */}
                      {lead.notes && (
                        <p className="text-xs text-slate-400 italic">
                          &ldquo;{lead.notes}&rdquo;
                        </p>
                      )}

                      <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>Transmis le {new Date(lead.createdAt).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>

                    {/* Right: CRM Stage & Commission Badge */}
                    <div className="flex items-center gap-3 sm:self-center shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-300">
                          {lead.statusLabel}
                        </div>
                      </div>

                      {/* Big Commission Outcome Badge */}
                      {lead.isConverted ? (
                        <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-md flex items-center gap-1.5 font-black text-xs">
                          <Coins className="w-4 h-4 text-amber-400" />
                          <span>+150 DH GAGNÉ</span>
                        </div>
                      ) : lead.status === "LOST" ? (
                        <div className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold">
                          Non éligible
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20 text-xs font-bold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>150 DH En cours</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer & Partner Support WhatsApp */}
      <footer className="border-t border-slate-800 bg-slate-950 px-4 sm:px-8 py-6 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-400">Besoin d&apos;un renseignement sur vos virements de commission ?</span>
          <a
            href="https://wa.me/212662145109?text=Bonjour%20GoCab,%20je%20suis%20Zakaria,%20apporteur%20d%27affaires."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all font-bold"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Contacter GoCab WhatsApp (+212 6 62 14 51 09)</span>
          </a>
        </div>
        <p>GoCab Technologies Maroc © 2026 — Plateforme Sécurisée Partenaires & Apporteurs d&apos;Affaires</p>
      </footer>
    </div>
  );
}
