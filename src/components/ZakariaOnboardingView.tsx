"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Users,
  CheckCircle2,
  Clock,
  Car,
  Coins,
  Search,
  RefreshCw,
  ExternalLink,
  Plus,
  Phone,
  MapPin,
  Calendar,
  AlertCircle,
  X,
  UserCheck,
  Check,
  MessageSquare,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PartnerSummary, PartnerLeadEvaluation } from "@/lib/services/partnerCommissionService";
import { useLanguage } from "@/context/LanguageContext";

const MOROCCAN_CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tangier",
  "Agadir",
  "Fès",
  "Meknès",
  "Kénitra",
  "Salé",
  "Témara",
  "Mohammedia",
  "El Jadida",
  "Tétouan",
  "Autre ville",
];

export default function ZakariaOnboardingView() {
  const { language } = useLanguage();
  const [data, setData] = useState<PartnerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "SHOWED_UP" | "VALIDATED" | "PENDING" | "LOST">("ALL");

  // Preorder modal state
  const [preorderModalLead, setPreorderModalLead] = useState<PartnerLeadEvaluation | null>(null);
  const [preorderAmountInput, setPreorderAmountInput] = useState("500");
  const [isUpdating, setIsUpdating] = useState(false);

  // Add lead modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadCity, setNewLeadCity] = useState("Casablanca");
  const [newLeadNotes, setNewLeadNotes] = useState("");
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const fetchPartnerData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch("/api/partners/zakaria", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de chargement des leads de Zakaria");
      setData(json);
    } catch (err: any) {
      if (!isSilent) toast.error(err.message || "Impossible de charger les données");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPartnerData();
    const interval = setInterval(() => {
      fetchPartnerData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchPartnerData]);

  // Quick Action 1: Mark Presence (Showed Up)
  const handleTogglePresence = async (lead: PartnerLeadEvaluation) => {
    const newPresence = !lead.presenceConfirmed;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presence_confirmed: newPresence,
          training_status: newPresence ? "Attended" : "Scheduled",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de mise à jour");

      toast.success(
        newPresence
          ? `✅ ${lead.name} marqué comme PRÉSENT au siège ! Zakaria le voit en temps réel.`
          : `↩️ Présence annulée pour ${lead.name}`
      );
      await fetchPartnerData(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick Action 2: Approve Vehicle Assignment (+150 DH Commission Confirmed)
  const handleApproveVehicle = async (lead: PartnerLeadEvaluation) => {
    if (!confirm(`Confirmer que ${lead.name} a pris un véhicule GoCab ?\n\nCela validera définitivement la commission de 150 DH pour Zakaria.`)) {
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_column: "VEHICLE_ASSIGNMENT",
          training_status: "Assign vehicle",
          brand_status: "Training fixed",
          presence_confirmed: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de validation");

      toast.success(
        `🚗 Véhicule validé pour ${lead.name} ! +150 DH crédités sur le compte de Zakaria.`,
        { duration: 5000 }
      );
      await fetchPartnerData(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'attribution");
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick Action 3: Open Preorder Modal (+150 DH Commission Confirmed)
  const handleOpenPreorderModal = (lead: PartnerLeadEvaluation) => {
    setPreorderModalLead(lead);
    setPreorderAmountInput(lead.preorderAmount ? String(lead.preorderAmount) : "500");
  };

  const handleConfirmPreorder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preorderModalLead) return;
    const amountNum = parseFloat(preorderAmountInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Veuillez saisir un montant de précommande valide.");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/leads/${preorderModalLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          training_status: "Preorder",
          preorder_amount: amountNum,
          presence_confirmed: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur d'enregistrement");

      toast.success(
        `💵 Précommande de ${amountNum} DH enregistrée pour ${preorderModalLead.name} ! +150 DH confirmés pour Zakaria.`,
        { duration: 5000 }
      );
      setPreorderModalLead(null);
      await fetchPartnerData(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la validation");
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick Action 4: Mark Lost / Refused
  const handleMarkLost = async (lead: PartnerLeadEvaluation) => {
    if (!confirm(`Marquer le candidat ${lead.name} comme non retenu ou refus de l'offre ?`)) {
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          training_status: "Refused the offer",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");

      toast.success(`Dossier ${lead.name} marqué comme non retenu.`);
      await fetchPartnerData(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setIsUpdating(false);
    }
  };

  // Add new lead for Zakaria
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) {
      toast.error("Nom et numéro de téléphone obligatoires.");
      return;
    }

    setIsSubmittingNew(true);
    try {
      const res = await fetch("/api/partners/zakaria/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLeadName.trim(),
          phone: newLeadPhone.trim(),
          city: newLeadCity,
          intention: "Onboarding Siège",
          notes: newLeadNotes.trim() ? `[Saisie Onboarding] ${newLeadNotes.trim()}` : "[Saisie Onboarding Specialist]",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de création");

      toast.success(`🎉 Chauffeur ${newLeadName} ajouté sous le compte de Zakaria !`);
      setNewLeadName("");
      setNewLeadPhone("");
      setNewLeadNotes("");
      setShowAddModal(false);
      await fetchPartnerData(true);
    } catch (err: any) {
      toast.error(err.message || "Impossible d'ajouter le candidat");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    if (!data?.leads) return [];
    return data.leads.filter((l) => {
      if (filterStatus === "SHOWED_UP" && !l.presenceConfirmed && !l.isConverted) return false;
      if (filterStatus === "VALIDATED" && !l.isConverted) return false;
      if (filterStatus === "PENDING" && l.status !== "PENDING") return false;
      if (filterStatus === "LOST" && l.status !== "LOST") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.city || "").toLowerCase().includes(q) ||
          (l.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.leads, filterStatus, searchQuery]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-[calc(100vh-8rem)] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ======================= TOP HEADER ======================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-200">
              🤝 Apporteur Tiers Partenaire
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
              💰 150 DH / Conversion
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Dossiers & Onboarding — Zakaria</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">
            Validez en 1 clic l&apos;arrivée du chauffeur au siège (Présent), puis confirmez la prise de véhicule ou le
            versement d&apos;une précommande pour déclencher automatiquement la commission de Zakaria.
          </p>
        </div>

        {/* Right side controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchPartnerData()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Actualiser les données"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-purple-600" : ""}`} />
            <span>Actualiser</span>
          </button>

          <Link
            href="/zakaria"
            target="_blank"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold shadow-2xs transition-all active:scale-95"
            title="Ouvrir l'Espace Partenaire mobile que consulte Zakaria"
          >
            <span>📱 Espace Zakaria (/zakaria)</span>
            <ExternalLink className="w-3.5 h-3.5 text-purple-700" />
          </Link>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-md shadow-purple-700/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Chauffeur Zakaria</span>
          </button>
        </div>
      </div>

      {/* ======================= KPI SUMMARY CARDS ======================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Transmis</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{data?.totalLeads ?? 0}</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Candidats apportés par Zakaria</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Showed Up */}
        <div className="bg-white rounded-3xl p-5 border border-purple-200/90 shadow-2xs flex items-center justify-between bg-gradient-to-br from-white to-purple-50/40">
          <div>
            <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Chauffeurs Présents</p>
            <h3 className="text-2xl font-black text-purple-950 mt-1">{data?.showedUpLeads ?? 0}</h3>
            <p className="text-[11px] text-purple-600 font-semibold mt-0.5">Se sont présentés au siège</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-700">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Validated / Converted */}
        <div className="bg-white rounded-3xl p-5 border border-emerald-200/90 shadow-2xs flex items-center justify-between bg-gradient-to-br from-white to-emerald-50/40">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Commissions Validées</p>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">
              {data?.convertedLeads ?? 0}{" "}
              <span className="text-xs font-bold text-emerald-600 font-sans">
                ({data?.conversionRatePct ?? 0}% conv.)
              </span>
            </h3>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Véhicule pris ou Précommande</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Total Earned MAD */}
        <div className="bg-gradient-to-br from-navy to-slate-900 rounded-3xl p-5 text-white shadow-md flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Total Dû à Zakaria</p>
            <h3 className="text-2xl font-black text-white mt-1">
              {(data?.totalCommissionEarnedMAD ?? 0).toLocaleString("fr-FR")} <span className="text-sm font-bold text-emerald-300">MAD</span>
            </h3>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5">
              {data?.potentialPendingCommissionMAD ?? 0} MAD potentiels en attente
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
            <Coins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ======================= SEARCH & FILTERS BAR ======================= */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, téléphone, ville ou note..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              filterStatus === "ALL"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tous ({data?.totalLeads ?? 0})
          </button>
          <button
            onClick={() => setFilterStatus("SHOWED_UP")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
              filterStatus === "SHOWED_UP"
                ? "bg-purple-700 text-white shadow-2xs"
                : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/80"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Présents ({data?.showedUpLeads ?? 0})</span>
          </button>
          <button
            onClick={() => setFilterStatus("VALIDATED")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
              filterStatus === "VALIDATED"
                ? "bg-emerald-700 text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Validés (+150 DH) ({data?.convertedLeads ?? 0})</span>
          </button>
          <button
            onClick={() => setFilterStatus("PENDING")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
              filterStatus === "PENDING"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>En cours ({data?.pendingLeads ?? 0})</span>
          </button>
          <button
            onClick={() => setFilterStatus("LOST")}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
              filterStatus === "LOST"
                ? "bg-rose-700 text-white shadow-2xs"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/80"
            }`}
          >
            Non retenus ({data?.lostLeads ?? 0})
          </button>
        </div>
      </div>

      {/* ======================= DRIVER CARDS LIST ======================= */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-2xs">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">Chargement des dossiers de Zakaria...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-2xs space-y-3">
            <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mx-auto text-2xl">
              🤝
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Aucun candidat dans cette sélection</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? "Aucun résultat ne correspond à votre recherche. Essayez avec un autre mot-clé."
                  : "Aucun candidat n'a encore été attribué à Zakaria dans cette catégorie. Vous pouvez en créer un nouveau."}
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un Chauffeur pour Zakaria</span>
            </button>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const isCarAssigned = lead.conversionReason === "VEHICLE_ASSIGNED" || lead.boardColumn === "VEHICLE_ASSIGNMENT";
            const isPreorderDeposited = lead.conversionReason === "PREORDER_DEPOSITED" || (lead.preorderAmount && lead.preorderAmount > 0);

            return (
              <div
                key={lead.id}
                className={`bg-white rounded-3xl p-5 border transition-all shadow-2xs hover:shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  lead.isConverted
                    ? "border-emerald-300/80 bg-gradient-to-r from-white via-emerald-50/20 to-emerald-50/40"
                    : lead.presenceConfirmed
                    ? "border-purple-300/80 bg-gradient-to-r from-white via-purple-50/20 to-purple-50/40"
                    : "border-slate-200"
                }`}
              >
                {/* Driver Info Column */}
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${
                      lead.isConverted
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : lead.presenceConfirmed
                        ? "bg-purple-100 text-purple-900 border border-purple-300"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {lead.isConverted ? (
                      isCarAssigned ? "🚗" : "💵"
                    ) : lead.presenceConfirmed ? (
                      "👤"
                    ) : (
                      "⏳"
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 truncate">{lead.name}</h4>
                      
                      {/* Live Status Badge */}
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border shadow-3xs ${
                          lead.isConverted
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300 font-black"
                            : lead.presenceConfirmed
                            ? "bg-purple-100 text-purple-900 border-purple-300 font-bold"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {lead.statusLabel}
                      </span>

                      {lead.presenceConfirmed && !lead.isConverted && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          ✓ Présence Validée
                        </span>
                      )}
                    </div>

                    {/* Contact & Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-slate-800 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                        title="Ouvrir WhatsApp"
                      >
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{lead.phone}</span>
                      </a>

                      <span className="flex items-center gap-1 text-slate-600 font-medium">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{lead.city || "Casablanca"}</span>
                      </span>

                      <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(lead.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                    </div>

                    {/* Notes if present */}
                    {lead.notes && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1 inline-block mt-1">
                        💬 {lead.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Action Buttons for Onboarding Agent */}
                <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                  {/* Action 1: Toggle Presence (Showed Up) */}
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleTogglePresence(lead)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 ${
                      lead.presenceConfirmed
                        ? "bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200"
                        : "bg-white hover:bg-purple-50 text-purple-800 border border-purple-200"
                    }`}
                    title="Confirmer que le chauffeur s'est présenté au siège"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{lead.presenceConfirmed ? "Présent ✓" : "Valider Présence"}</span>
                  </button>

                  {/* Action 2: Assign Vehicle (+150 DH) */}
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleApproveVehicle(lead)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95 ${
                      isCarAssigned
                        ? "bg-emerald-600 text-white border border-emerald-700 shadow-emerald-600/20"
                        : "bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300"
                    }`}
                    title="Valider l'attribution d'un véhicule (+150 DH pour Zakaria)"
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>{isCarAssigned ? "Véhicule Attribué ✓" : "Prend Véhicule (+150 DH)"}</span>
                  </button>

                  {/* Action 3: Preorder (+150 DH) */}
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleOpenPreorderModal(lead)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95 ${
                      isPreorderDeposited
                        ? "bg-teal-600 text-white border border-teal-700 shadow-teal-600/20"
                        : "bg-teal-50 hover:bg-teal-600 text-teal-800 hover:text-white border border-teal-300"
                    }`}
                    title="Enregistrer un versement de précommande (+150 DH pour Zakaria)"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>
                      {isPreorderDeposited
                        ? `Précommande ${lead.preorderAmount ? lead.preorderAmount + " DH" : "Validée"} ✓`
                        : "Précommande (+150 DH)"}
                    </span>
                  </button>

                  {/* Action 4: Refused / Not Attended */}
                  {!lead.isConverted && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleMarkLost(lead)}
                      className="p-2 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                      title="Marquer comme non retenu ou refus"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ======================= MODAL: VALIDER PRÉCOMMANDE ======================= */}
      {preorderModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💵</span>
                <div>
                  <h3 className="text-base font-black text-slate-900">Valider Précommande</h3>
                  <p className="text-xs text-slate-500 font-medium">Chauffeur : {preorderModalLead.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPreorderModalLead(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPreorder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Montant de la précommande versée (MAD) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="50"
                    required
                    value={preorderAmountInput}
                    onChange={(e) => setPreorderAmountInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none font-mono"
                    placeholder="Ex: 500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                    DH
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {["300", "500", "1000", "1500"].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPreorderAmountInput(amt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        preorderAmountInput === amt
                          ? "bg-teal-600 text-white border-teal-700"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {amt} DH
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-2xl text-[11px] text-teal-900 leading-tight">
                💡 L&apos;enregistrement de cette précommande valide immédiatement le statut <strong>Preorder</strong>{" "}
                et crédite <strong>+150 DH</strong> de commission confirmée sur le portail de Zakaria.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPreorderModalLead(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md shadow-teal-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isUpdating ? "Enregistrement..." : "Confirmer la Précommande (+150 DH)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: NOUVEAU CHAUFFEUR ZAKARIA ======================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👤➕</span>
                <div>
                  <h3 className="text-base font-black text-slate-900">Nouveau Chauffeur pour Zakaria</h3>
                  <p className="text-xs text-slate-500 font-medium">Attribué automatiquement à l&apos;apporteur Zakaria</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom & Prénom *</label>
                <input
                  type="text"
                  required
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="ex: Rachid Benjelloun"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Numéro de Téléphone *</label>
                <input
                  type="tel"
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="06 XX XX XX XX"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                <select
                  value={newLeadCity}
                  onChange={(e) => setNewLeadCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                >
                  {MOROCCAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarques</label>
                <textarea
                  rows={2}
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  placeholder="Ex: Candidat motivé, disponible immédiatement pour MG4..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-md shadow-purple-700/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isSubmittingNew ? "Création..." : "Créer le Dossier Zakaria"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
