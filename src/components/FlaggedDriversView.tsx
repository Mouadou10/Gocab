"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Flag,
  Search,
  Filter,
  Car,
  Phone,
  MessageCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  ShieldAlert,
  ChevronRight,
  RefreshCw,
  UserCheck,
  UserX,
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import DriverDrawer, { DriverProfile, Vehicle } from "./DriverDrawer";
import WhatsAppDirectModal, { WhatsAppDirectTarget } from "./WhatsAppDirectModal";

export interface DriverComment {
  id: string;
  driverId?: string;
  authorName: string;
  authorRole?: string | null;
  content: string;
  createdAt: string;
}

export default function FlaggedDriversView() {
  const [flaggedDrivers, setFlaggedDrivers] = useState<DriverProfile[]>([]);
  const [allDrivers, setAllDrivers] = useState<DriverProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<"ALL" | "WITH_VEHICLE" | "WITHOUT_VEHICLE">("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"date" | "arrears" | "name">("date");

  // Drawer & Modals
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);
  const [directWhatsAppTarget, setDirectWhatsAppTarget] = useState<WhatsAppDirectTarget | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isAddFlagModalOpen, setIsAddFlagModalOpen] = useState(false);
  const [driverToFlagId, setDriverToFlagId] = useState("");
  const [newFlagReason, setNewFlagReason] = useState("");
  const [isSubmittingFlag, setIsSubmittingFlag] = useState(false);

  // Per-driver inline comment states
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingCommentFor, setSubmittingCommentFor] = useState<string | null>(null);

  // Fetch flagged drivers
  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/drivers");
      const data = await res.json();
      if (Array.isArray(data.drivers)) {
        setAllDrivers(data.drivers);
        const flagged = data.drivers.filter((d: DriverProfile) => d.isRedFlagged);
        setFlaggedDrivers(flagged);
      }
    } catch (err) {
      console.error("Error fetching drivers:", err);
      toast.error("Erreur de chargement des chauffeurs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Unflag driver
  const handleRemoveFlag = async (driver: DriverProfile) => {
    if (!confirm(`Confirmez-vous le retrait du signalement Red Flag pour ${driver.fullName} ?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRedFlagged: false }),
      });
      if (!res.ok) {
        toast.error("Échec du retrait du Red Flag");
        return;
      }
      toast.success("Signalement Red Flag retiré !");
      fetchDrivers();
    } catch (err) {
      toast.error("Erreur réseau");
    }
  };

  // Add Red Flag to unflagged driver
  const handleCreateFlag = async () => {
    if (!driverToFlagId) {
      toast.error("Veuillez sélectionner un chauffeur");
      return;
    }
    setIsSubmittingFlag(true);
    try {
      const reason = newFlagReason.trim() || "Signalé par le gestionnaire de flotte";
      const res = await fetch(`/api/drivers/${driverToFlagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isRedFlagged: true,
          redFlagReason: reason,
        }),
      });
      if (!res.ok) {
        toast.error("Échec de l'enregistrement du signalement");
        return;
      }
      toast.success("🚩 Chauffeur signalé avec succès !");
      setIsAddFlagModalOpen(false);
      setDriverToFlagId("");
      setNewFlagReason("");
      fetchDrivers();
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmittingFlag(false);
    }
  };

  // Submit comment for specific driver
  const handlePostComment = async (driverId: string) => {
    const text = (commentInputs[driverId] || "").trim();
    if (!text) return;

    setSubmittingCommentFor(driverId);
    try {
      const res = await fetch(`/api/drivers/${driverId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur d'ajout de note");
        return;
      }
      toast.success("Commentaire ajouté !");
      setCommentInputs((prev) => ({ ...prev, [driverId]: "" }));

      // Update local driver comments
      setFlaggedDrivers((prev) =>
        prev.map((d) => {
          if (d.id === driverId) {
            const updatedComments = [data.comment, ...(d.comments || [])];
            return {
              ...d,
              comments: updatedComments,
              _count: { comments: updatedComments.length },
            };
          }
          return d;
        })
      );
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setSubmittingCommentFor(null);
    }
  };

  // Filtered and sorted list
  const filteredDrivers = useMemo(() => {
    let result = flaggedDrivers.filter((d) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = d.fullName.toLowerCase().includes(q);
      const phoneMatch = d.phoneSanitized.includes(q);
      const cinMatch = d.cinNumber.toLowerCase().includes(q);
      const plateMatch = d.assignedVehicle?.plate_number.toLowerCase().includes(q) || false;
      const reasonMatch = (d.redFlagReason || "").toLowerCase().includes(q);
      if (q && !nameMatch && !phoneMatch && !cinMatch && !plateMatch && !reasonMatch) {
        return false;
      }

      // Vehicle filter
      if (vehicleFilter === "WITH_VEHICLE" && !d.assignedVehicleId) return false;
      if (vehicleFilter === "WITHOUT_VEHICLE" && d.assignedVehicleId) return false;

      // Stage filter
      if (stageFilter !== "ALL" && d.defaultStage !== stageFilter) return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === "arrears") {
        return (b.currentArrearsMAD || 0) - (a.currentArrearsMAD || 0);
      }
      if (sortBy === "name") {
        return a.fullName.localeCompare(b.fullName);
      }
      // default: most recent flag
      const dateA = a.redFlaggedAt ? new Date(a.redFlaggedAt).getTime() : 0;
      const dateB = b.redFlaggedAt ? new Date(b.redFlaggedAt).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  }, [flaggedDrivers, searchQuery, vehicleFilter, stageFilter, sortBy]);

  // High-level KPI metrics
  const totalFlaggedCount = flaggedDrivers.length;
  const withVehicleCount = flaggedDrivers.filter((d) => d.assignedVehicleId).length;
  const totalArrearsMAD = flaggedDrivers.reduce((acc, d) => acc + (d.currentArrearsMAD || 0), 0);
  const totalCommentsCount = flaggedDrivers.reduce(
    (acc, d) => acc + (d.comments?.length || d._count?.comments || 0),
    0
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fadeIn">
      {/* ── Top Header Banner ───────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#881337] via-[#9f1239] to-navy text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-white/10 text-white rounded-2xl backdrop-blur-xs text-xl">🚩</span>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Chauffeurs Signalés & Collaboration Équipe</h2>
              <p className="text-white/80 text-xs mt-0.5">
                Supervision des chauffeurs à risque (Red Flags) · Journal des commentaires d&apos;intervention en direct
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAddFlagModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-rose-800 hover:bg-rose-50 text-xs font-bold rounded-2xl transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 text-rose-600" />
            <span>Nouveau Signalement</span>
          </button>

          <button
            onClick={fetchDrivers}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors cursor-pointer text-white"
            title="Rafraîchir les données"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Flagged */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-2xs font-bold uppercase tracking-wider text-rose-700">Chauffeurs Signalés</span>
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 font-mono">{totalFlaggedCount}</span>
            <span className="text-3xs font-semibold text-rose-600">Dossiers actifs</span>
          </div>
          <p className="text-3xs text-gray-500 font-medium">Chauffeurs avec statut Red Flag</p>
        </div>

        {/* With Assigned Vehicle */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-2xs font-bold uppercase tracking-wider text-navy">Avec Véhicule Assigné</span>
            <div className="p-2 bg-blue-100 text-navy rounded-xl">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 font-mono">{withVehicleCount}</span>
            <span className="text-3xs font-semibold text-blue-600">
              {totalFlaggedCount > 0 ? `${Math.round((withVehicleCount / totalFlaggedCount) * 100)}%` : "0%"}
            </span>
          </div>
          <p className="text-3xs text-gray-500 font-medium">Véhicules circulant sous risque</p>
        </div>

        {/* Cumulative Arrears */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-2xs font-bold uppercase tracking-wider text-amber-700">Impayés Cumulés</span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-700 font-mono">
              {totalArrearsMAD.toLocaleString()}
            </span>
            <span className="text-2xs font-bold text-amber-800">MAD</span>
          </div>
          <p className="text-3xs text-gray-500 font-medium">Montant global restant dû</p>
        </div>

        {/* Team Comments */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-2xs font-bold uppercase tracking-wider text-indigo-700">Commentaires Équipe</span>
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 font-mono">{totalCommentsCount}</span>
            <span className="text-3xs font-semibold text-indigo-600">Notes laissées</span>
          </div>
          <p className="text-3xs text-gray-500 font-medium">Historique d&apos;intervention partagé</p>
        </div>
      </div>

      {/* ── Search and Filters ────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par chauffeur, téléphone, CIN, immatriculation, motif..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Vehicle Filter */}
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:bg-white focus:outline-none focus:border-navy"
            >
              <option value="ALL">Tous Véhicules</option>
              <option value="WITH_VEHICLE">Avec Véhicule</option>
              <option value="WITHOUT_VEHICLE">Sans Véhicule</option>
            </select>

            {/* Stage Filter */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:bg-white focus:outline-none focus:border-navy"
            >
              <option value="ALL">Tous Statuts Recouvrement</option>
              <option value="NOMINAL">🟢 En règle</option>
              <option value="DAY_1_WARNING">🟡 Alerte J1</option>
              <option value="DAY_2_ACTION">🟠 Action J2</option>
              <option value="DAY_3_BLOCK">🔴 Blocage J3</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:bg-white focus:outline-none focus:border-navy"
            >
              <option value="date">Plus Récents</option>
              <option value="arrears">Plus d&apos;Impayés (MAD)</option>
              <option value="name">Nom Chauffeur (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Flagged Drivers List ─────────────────────────────────── */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-xs space-y-3">
            <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
            <p className="text-xs font-bold text-gray-600">Chargement des chauffeurs signalés...</p>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-xs space-y-3">
            <span className="p-3 bg-emerald-50 text-emerald-600 rounded-full inline-block text-2xl">🎉</span>
            <h3 className="text-sm font-bold text-gray-900">Aucun Chauffeur Signalé</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              {searchQuery || vehicleFilter !== "ALL" || stageFilter !== "ALL"
                ? "Aucun chauffeur ne correspond à vos filtres actuels."
                : "Tous les chauffeurs de la flotte sont actuellement en règle. Aucun Red Flag actif."}
            </p>
          </div>
        ) : (
          filteredDrivers.map((driver) => {
            const commentsList = driver.comments || [];
            const hasVehicle = Boolean(driver.assignedVehicleId);

            return (
              <div
                key={driver.id}
                className="bg-white rounded-3xl border-2 border-rose-200/80 shadow-xs overflow-hidden transition-all hover:border-rose-300"
              >
                {/* Driver Card Header */}
                <div className="p-5 bg-gradient-to-r from-rose-50/70 via-rose-50/30 to-white border-b border-rose-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-3xs font-black bg-rose-500 text-white shadow-2xs flex items-center gap-1">
                        <Flag className="w-3 h-3 fill-white" />
                        RED FLAG
                      </span>
                      <h3
                        onClick={() => setSelectedDriver(driver)}
                        className="text-base font-extrabold text-gray-900 hover:text-navy cursor-pointer transition-colors"
                      >
                        {driver.fullName}
                      </h3>
                      {driver.isKycVerified && (
                        <span className="p-0.5 bg-emerald-100 text-emerald-700 rounded-full" title="KYC Conforme">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="text-2xs font-bold text-gray-500 font-mono">
                        {driver.cinNumber} · {driver.phoneSanitized}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {hasVehicle ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-2xs font-extrabold bg-blue-100 text-blue-800">
                          <Car className="w-3.5 h-3.5" />
                          {driver.assignedVehicle?.plate_number} ({[driver.assignedVehicle?.brand, driver.assignedVehicle?.model].filter(Boolean).join(" ") || driver.assignedVehicle?.make_model || "Véhicule Actif"})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-2xs font-bold bg-amber-100 text-amber-800">
                          <Car className="w-3.5 h-3.5" />
                          Sans véhicule
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-2xs font-extrabold ${
                          (driver.currentArrearsMAD || 0) > 0
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        <CreditCard className="w-3 h-3" />
                        Impayés : {(driver.currentArrearsMAD || 0).toLocaleString()} MAD
                      </span>

                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-lg text-3xs font-bold uppercase">
                        Contrat : {driver.contractType}
                      </span>

                      {driver.defaultStage && (
                        <span
                          className={`px-2 py-0.5 rounded-lg text-3xs font-extrabold ${
                            driver.defaultStage === "DAY_3_BLOCK"
                              ? "bg-red-100 text-red-800"
                              : driver.defaultStage === "DAY_2_ACTION"
                              ? "bg-amber-100 text-amber-800"
                              : driver.defaultStage === "DAY_1_WARNING"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {driver.defaultStage === "DAY_3_BLOCK"
                            ? "🔴 Blocage J3"
                            : driver.defaultStage === "DAY_2_ACTION"
                            ? "🟠 Action J2"
                            : driver.defaultStage === "DAY_1_WARNING"
                            ? "🟡 Alerte J1"
                            : "🟢 Nominal"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`tel:${driver.phoneSanitized}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-navy text-xs font-bold rounded-xl transition-all shadow-2xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Appeler</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setDirectWhatsAppTarget({
                          phoneNumber: driver.phoneSanitized,
                          contactName: driver.fullName,
                          contactType: "DRIVER",
                          plateNumber: driver.assignedVehicle?.plate_number,
                          arrearsMAD: driver.currentArrearsMAD,
                          unpaidDays: driver.consecutiveUnpaidDays,
                          defaultMessage: `Bonjour ${driver.fullName},\n\nNous vous contactons depuis le siège GoCab concernant votre dossier chauffeur.\n\nMerci de nous contacter d'urgence.\n\nL'équipe GoCab Operations.`,
                        });
                        setIsWhatsAppModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Direct</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDriver(driver)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                    >
                      <span>Voir Profil</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gold" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveFlag(driver)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                      title="Retirer le signalement Red Flag"
                    >
                      <span>Retirer Flag</span>
                    </button>
                  </div>
                </div>

                {/* Reason and Details */}
                <div className="p-5 space-y-4">
                  {/* Flag Reason Callout */}
                  <div className="p-3.5 bg-rose-50/80 rounded-2xl border border-rose-200 flex items-start gap-3">
                    <span className="p-1.5 bg-rose-500 text-white rounded-lg shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-3xs font-black uppercase tracking-wider text-rose-900">
                          Motif du Signalement
                        </span>
                        {driver.redFlaggedAt && (
                          <span className="text-3xs font-bold text-rose-600">
                            Signalé le {new Date(driver.redFlaggedAt).toLocaleDateString("fr-FR")}
                            {driver.redFlaggedBy ? ` par ${driver.redFlaggedBy}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-rose-950 mt-1 whitespace-pre-wrap">
                        {driver.redFlagReason || "Aucun motif spécifié lors du signalement."}
                      </p>
                    </div>
                  </div>

                  {/* Team Collaboration Comments Section */}
                  <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-navy" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                          Notes & Collaboration Équipe ({commentsList.length})
                        </h4>
                      </div>
                      <span className="text-3xs font-medium text-gray-400">
                        Visibles par tous les agents et responsables
                      </span>
                    </div>

                    {/* Quick Add Comment Box */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentInputs[driver.id] || ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [driver.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handlePostComment(driver.id);
                          }
                        }}
                        placeholder="Ajouter une observation ou un compte-rendu pour l'équipe..."
                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                      />
                      <button
                        type="button"
                        onClick={() => handlePostComment(driver.id)}
                        disabled={submittingCommentFor === driver.id || !(commentInputs[driver.id] || "").trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        <Send className="w-3.5 h-3.5 text-gold" />
                        <span>{submittingCommentFor === driver.id ? "Envoi..." : "Publier"}</span>
                      </button>
                    </div>

                    {/* Existing Comments List */}
                    {commentsList.length > 0 ? (
                      <div className="space-y-2 pt-1 max-h-52 overflow-y-auto pr-1">
                        {commentsList.map((comm) => (
                          <div
                            key={comm.id}
                            className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xs font-extrabold text-navy">{comm.authorName}</span>
                                {comm.authorRole && (
                                  <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-slate-100 text-slate-700">
                                    {comm.authorRole}
                                  </span>
                                )}
                              </div>
                              <span className="text-3xs text-gray-400 font-medium">
                                {new Date(comm.createdAt).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">{comm.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-2 text-3xs text-gray-400 font-medium">
                        Aucun commentaire consigné pour le moment. Soyez le premier à ajouter une observation.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal to Add Red Flag to an Existing Driver ───────────────── */}
      {isAddFlagModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-100 text-rose-600 rounded-xl text-lg">🚩</span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Signaler un Chauffeur (Nouveau Red Flag)</h3>
                  <p className="text-2xs text-gray-500">
                    Sélectionnez un chauffeur à placer sous surveillance prioritaire
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFlagModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Choisir le Chauffeur :
                </label>
                <select
                  value={driverToFlagId}
                  onChange={(e) => setDriverToFlagId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  <option value="">-- Sélectionnez un chauffeur --</option>
                  {allDrivers
                    .filter((d) => !d.isRedFlagged)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.cinNumber} · {d.phoneSanitized}) {d.assignedVehicle ? `· [${d.assignedVehicle.plate_number}]` : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Motifs Prédéfinis :
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Arriérés impayés récurrents",
                    "Véhicule non restitué / Introuvable",
                    "Conduite dangereuse / Infraction grave",
                    "Injoignable / Contact rompu",
                    "Comportement agressif / Litige",
                    "Défaut documents / Faux permis",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewFlagReason(preset)}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-semibold transition-all cursor-pointer ${
                        newFlagReason === preset
                          ? "bg-rose-500 text-white shadow-xs"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Précisions / Motif Détaillé :
                </label>
                <textarea
                  value={newFlagReason}
                  onChange={(e) => setNewFlagReason(e.target.value)}
                  placeholder="Expliquez la situation et les consignes pour l'équipe..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAddFlagModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateFlag}
                disabled={isSubmittingFlag || !driverToFlagId}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5 fill-white" />
                <span>{isSubmittingFlag ? "Enregistrement..." : "Appliquer le Red Flag"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Detail Drawer */}
      <DriverDrawer
        driver={selectedDriver}
        isOpen={Boolean(selectedDriver)}
        onClose={() => setSelectedDriver(null)}
        onUpdate={() => {
          fetchDrivers();
        }}
      />

      {/* WhatsApp Direct Modal */}
      {directWhatsAppTarget && (
        <WhatsAppDirectModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => {
            setIsWhatsAppModalOpen(false);
            setDirectWhatsAppTarget(null);
          }}
          target={directWhatsAppTarget}
          onOpenFullChat={(phone) => {
            try {
              localStorage.setItem("gocab_target_whatsapp_phone", phone);
            } catch (e) {}
            setIsWhatsAppModalOpen(false);
            window.dispatchEvent(new CustomEvent("gocab_navigate_tab", { detail: "whatsapp" }));
          }}
        />
      )}
    </div>
  );
}
