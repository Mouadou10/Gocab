"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLiveSync } from "@/context/LiveSyncContext";
import { resolveVehicleFleetManager } from "@/lib/fleet-managers";
import { AccidentClaim, TIMELINE_STEPS } from "./AccidentCard";
import InsuranceVehicleDetail from "./InsuranceVehicleDetail";
import RepairReminderModal from "./RepairReminderModal";
import RepairReminderCard, { RepairReminderItem } from "./RepairReminderCard";
import toast from "react-hot-toast";
import {
  Car,
  Clock,
  ShieldAlert,
  FileText,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface VehicleItem {
  id: string;
  plate_number: string;
  make_model?: string;
  hub_city?: string;
  status?: string;
  assigned_driver_name?: string | null;
  assigned_driver_phone?: string | null;
  is_driver_red_flagged?: boolean;
  driver_red_flag_reason?: string | null;
}

export default function InsuranceView() {
  const [claims, setClaims] = useState<AccidentClaim[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const { notifyMutation } = useLiveSync("tickets", () => {
    fetchClaims();
    fetchReminders();
  });
  useLiveSync("all", () => {
    fetchClaims();
    fetchReminders();
  });

  const [reminders, setReminders] = useState<RepairReminderItem[]>([]);
  const [remindersSummary, setRemindersSummary] = useState({
    total: 0,
    pending: 0,
    due_today: 0,
    overdue: 0,
    due_or_overdue: 0,
    in_repair: 0,
    completed: 0,
  });
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [filterReminderStatus, setFilterReminderStatus] = useState<"ALL" | "DUE" | "PENDING" | "IN_REPAIR" | "COMPLETED">("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Tabs: "master-detail" (main insurance & claims view) vs "reminders" (repair reminders list)
  const [viewMode, setViewMode] = useState<"master-detail" | "reminders">("master-detail");

  // Left List Filter: "open" (in progress) vs "restored" (completed) vs "all"
  const [leftTabFilter, setLeftTabFilter] = useState<"open" | "restored" | "all">("open");

  // Search by immat or driver on the left list
  const [searchImmat, setSearchImmat] = useState("");

  // States for reporting a new accident with searchable combobox
  const [isReporting, setIsReporting] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getFleetManagerDisplayName = (v?: {
    plate_number?: string | null;
    assigned_collector?: string | null;
    assigned_supervisor?: string | null;
  } | null) => {
    if (!v) return "Mohamed Aziz";
    return resolveVehicleFleetManager(v) === "mehdi elyattouti"
      ? "Mehdi Elyattouti"
      : "Mohamed Aziz";
  };

  // Mobile detail view toggle
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/accidents");
      const data = await res.json();
      if (data.success) {
        setClaims(data.claims || []);
      }
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/insurance/repair-reminders");
      const data = await res.json();
      if (data.success) {
        setReminders(data.reminders || []);
        if (data.summary) {
          setRemindersSummary(data.summary);
        }
      }
    } catch (err) {
      console.error("Failed to fetch repair reminders:", err);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/vehicles");
      const data = await res.json();
      setVehicles(data.vehicles || []);
    } catch (err) {
      console.error("Failed to fetch vehicles for accident reporting", err);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchReminders();
    fetchVehicles();
  }, [fetchClaims, fetchReminders, fetchVehicles]);

  // Separate active claims and completed (Vehicle Back) claims
  const activeClaims = claims.filter((c) => c.timeline_step !== "VEHICLE_BACK");
  const historyClaims = claims.filter((c) => c.timeline_step === "VEHICLE_BACK");

  // KPI Calculations
  const totalActive = activeClaims.length;
  const hardCount = activeClaims.filter((c) => c.severity === "HARD").length;
  const softCount = activeClaims.filter((c) => c.severity === "SOFT").length;
  const insuranceDocsCount = activeClaims.filter((c) => c.timeline_step === "INSURANCE_DOCS").length;
  const readyForPickupCount = activeClaims.filter((c) => c.timeline_step === "READY_FOR_PICKUP").length;

  const totalDowntimeDays = activeClaims.reduce((sum, c) => {
    const diffTime = Math.abs(new Date().getTime() - new Date(c.created_at).getTime());
    return sum + Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }, 0);
  const avgDowntimeDays = totalActive > 0 ? Math.round(totalDowntimeDays / totalActive) : 0;

  // Calculate days in status helper
  const calculateDaysInStatus = (dateStr?: string | null) => {
    if (!dateStr) return 0;
    const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filter vehicles on the left list
  const getFilteredClaims = () => {
    let baseList = claims;
    if (leftTabFilter === "open") baseList = activeClaims;
    else if (leftTabFilter === "restored") baseList = historyClaims;

    if (!searchImmat.trim()) return baseList;
    const q = searchImmat.toLowerCase().trim();
    return baseList.filter((c) => {
      const matchPlate = c.vehicle?.plate_number?.toLowerCase().includes(q);
      const matchModel = c.vehicle?.make_model?.toLowerCase().includes(q) || false;
      const matchDriver = c.driver_name?.toLowerCase().includes(q) || false;
      return matchPlate || matchModel || matchDriver;
    });
  };

  const filteredLeftClaims = getFilteredClaims();

  // Auto-select first vehicle if none or invalid
  useEffect(() => {
    if (filteredLeftClaims.length > 0) {
      const exists = filteredLeftClaims.some((c) => c.id === selectedClaimId);
      if (!exists && (!selectedClaimId || !claims.some((c) => c.id === selectedClaimId))) {
        setSelectedClaimId(filteredLeftClaims[0].id);
      }
    }
  }, [filteredLeftClaims, selectedClaimId, claims]);

  // Selected claim object
  const selectedClaim = claims.find((c) => c.id === selectedClaimId) || (filteredLeftClaims.length > 0 ? filteredLeftClaims[0] : null);

  const handleReportAccident = async () => {
    if (!newVehicleId || isSubmittingReport) return;
    setIsSubmittingReport(true);
    try {
      const selectedV = vehicles.find((v) => v.id === newVehicleId);
      const res = await fetch("/api/accidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vehicle_id: newVehicleId,
          plate_number: selectedV?.plate_number,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        const waNotif = data.whatsappNotification;
        if (waNotif?.sent) {
          toast.success(
            `Dossier accident ouvert ! WhatsApp envoyé à ${waNotif.managerName} avec le bouton « ✅ Créé sur Fleet ».`,
            { duration: 5500 }
          );
        } else if (waNotif?.managerName) {
          toast.success(
            `Dossier accident ouvert ! Gestionnaire associé : ${waNotif.managerName}.`,
            { duration: 4500 }
          );
        } else {
          toast.success("Dossier accident ouvert avec succès !");
        }
        setIsReporting(false);
        setNewVehicleId("");
        setVehicleSearch("");
        setIsDropdownOpen(false);
        setLeftTabFilter("open");
        notifyMutation("tickets");
        notifyMutation("all");
        await fetchClaims();
        if (data.claim?.id) {
          setSelectedClaimId(data.claim.id);
        }
      } else {
        toast.error(data?.error || "Échec de la création du dossier d'accident");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur réseau lors de l'ouverture du dossier");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Filter vehicles for reporting dropdown
  const filteredVehiclesToReport = vehicles.filter((v) => {
    if (!vehicleSearch.trim()) return true;
    const q = vehicleSearch.toLowerCase().trim();
    return (
      v.plate_number.toLowerCase().includes(q) ||
      (v.make_model && v.make_model.toLowerCase().includes(q)) ||
      (v.hub_city && v.hub_city.toLowerCase().includes(q))
    );
  });

  const selectedVehicleToReport = vehicles.find((v) => v.id === newVehicleId);

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & KPI METRICS                                            */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-navy flex items-center gap-2">
            <span>Assurance & Gestion des Sinistres</span>
            <span className="text-3xs bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
              Portail Partagé Assureur
            </span>
          </h2>
          <p className="text-xs text-gray-500">
            Suivi des véhicules accidentés, expertise chiffrée, accord de prise en charge et garage.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "reminders" ? "master-detail" : "reminders")}
            className={`px-3.5 py-2 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
              viewMode === "reminders"
                ? "bg-amber-600 text-white ring-2 ring-amber-400"
                : remindersSummary.due_or_overdue > 0
                ? "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 animate-pulse"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Rappels Réparations</span>
            <span className="text-3xs font-mono font-black px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900">
              {remindersSummary.due_or_overdue > 0 ? `⚠️ ${remindersSummary.due_or_overdue} dû(s)` : reminders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsReporting(!isReporting);
              if (isReporting) {
                setNewVehicleId("");
                setVehicleSearch("");
                setIsDropdownOpen(false);
              }
            }}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>{isReporting ? "✕ Annuler" : "🚨 Déclarer un Accident"}</span>
          </button>

          <button
            type="button"
            onClick={fetchClaims}
            className="p-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl transition-colors cursor-pointer"
            title="Actualiser les données"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100 font-bold">
            🚨
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-navy">{totalActive}</div>
            <div className="text-3xs font-bold text-gray-500 uppercase truncate">Véhicules Accidentés</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-navy">{avgDowntimeDays} j</div>
            <div className="text-3xs font-bold text-gray-500 uppercase truncate">Arrêt Moyen</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-navy flex items-baseline gap-1">
              <span className="text-red-600">{hardCount}</span>
              <span className="text-3xs text-gray-400">/</span>
              <span className="text-amber-600">{softCount}</span>
            </div>
            <div className="text-3xs font-bold text-gray-500 uppercase truncate">Lourde / Légère</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-navy">{insuranceDocsCount}</div>
            <div className="text-3xs font-bold text-gray-500 uppercase truncate">Attente Assurance</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-50 text-yellow-700 flex items-center justify-center shrink-0 border border-yellow-200">
            <span className="text-sm">⏳</span>
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-navy">{readyForPickupCount}</div>
            <div className="text-3xs font-bold text-gray-500 uppercase truncate">Prêt Récupération</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-navy">{historyClaims.length}</div>
            <div className="text-3xs font-bold text-gray-500 uppercase truncate">Véhicules Rétablis</div>
          </div>
        </div>
      </div>

      {/* Reporting Combobox Box */}
      {isReporting && (
        <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1 max-w-xl" ref={dropdownRef}>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider flex items-center justify-between">
                <span>Sélectionner le véhicule à déclarer en accident <span className="text-red-500">*</span></span>
                <span className="text-3xs text-gray-400 font-normal">{vehicles.length} véhicules</span>
              </label>

              {selectedVehicleToReport ? (
                <div className="space-y-1.5">
                  <div className="p-2.5 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between shadow-2xs gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-black text-xs text-navy bg-white px-2 py-1 rounded-lg border border-red-200 shadow-2xs">
                        🚗 {selectedVehicleToReport.plate_number}
                      </span>
                      <div className="text-xs font-bold text-gray-800">
                        {selectedVehicleToReport.make_model || "Modèle non spécifié"}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300">
                        📲 WhatsApp auto → {getFleetManagerDisplayName(selectedVehicleToReport)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewVehicleId("");
                        setVehicleSearch("");
                        setIsDropdownOpen(true);
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-800 bg-white px-2.5 py-1 rounded-lg border border-red-200 transition-colors shadow-2xs cursor-pointer"
                    >
                      Changer
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium pl-1">
                    En cliquant sur <strong>Ouvrir Dossier</strong>, {getFleetManagerDisplayName(selectedVehicleToReport)} recevra un message WhatsApp avec un bouton <strong>« ✅ Créé sur Fleet »</strong> synchronisé au CRM.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Tapez l'immatriculation (ex: 26552, WW990...) ou le modèle..."
                    value={vehicleSearch}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setVehicleSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    className="w-full pl-8 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:outline-none"
                  />

                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-gray-100 animate-fadeIn">
                      {filteredVehiclesToReport.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-400">
                          Aucun véhicule trouvé
                        </div>
                      ) : (
                        filteredVehiclesToReport.map((v) => {
                          const mgrName = getFleetManagerDisplayName(v);
                          const isMehdi = mgrName.includes("Mehdi");
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setNewVehicleId(v.id);
                                setIsDropdownOpen(false);
                                setVehicleSearch("");
                              }}
                              className="w-full p-2 text-left hover:bg-red-50/60 transition-colors flex items-center justify-between text-xs gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-navy shrink-0">
                                  {v.plate_number}
                                </span>
                                <span className="text-gray-600 truncate max-w-[160px]">{v.make_model}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    isMehdi
                                      ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  }`}
                                >
                                  👤 {isMehdi ? "Mehdi" : "Aziz"}
                                </span>
                                <span className="text-3xs text-gray-400">{v.hub_city || "Casablanca"}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReportAccident}
                disabled={!newVehicleId || isSubmittingReport}
                className="px-5 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isSubmittingReport ? "⏳ Ouverture & WhatsApp..." : "🚨 Ouvrir Dossier"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReporting(false);
                  setNewVehicleId("");
                  setVehicleSearch("");
                  setIsDropdownOpen(false);
                }}
                className="px-3.5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 2. REPAIR REMINDERS VIEW MODE (IF TOGGLED)                             */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {viewMode === "reminders" ? (
        <div className="space-y-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-black text-navy">
                Rappels de Réparations & Dépôt au Garage
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setViewMode("master-detail")}
              className="text-xs font-bold text-navy hover:underline flex items-center gap-1"
            >
              <span>← Retour au suivi des véhicules</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["ALL", "DUE", "PENDING", "IN_REPAIR", "COMPLETED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterReminderStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterReminderStatus === st
                      ? "bg-navy text-white shadow-2xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {st === "ALL" && `Tous (${reminders.length})`}
                  {st === "DUE" && `🚨 Échus / À déposer (${remindersSummary.due_or_overdue})`}
                  {st === "PENDING" && `⏳ En attente (${remindersSummary.pending})`}
                  {st === "IN_REPAIR" && `🔧 Au garage (${remindersSummary.in_repair})`}
                  {st === "COMPLETED" && `✅ Réparés (${remindersSummary.completed})`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsReminderModalOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Programmer Rappel Réparation</span>
            </button>
          </div>

          {/* Grid of reminders */}
          {reminders.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-400">
              Aucun rappel de réparation programmé.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {reminders
                .filter((r) => {
                  if (filterReminderStatus === "DUE" && !r.is_due_or_overdue) return false;
                  if (filterReminderStatus === "PENDING" && r.status !== "PENDING") return false;
                  if (filterReminderStatus === "IN_REPAIR" && r.status !== "IN_REPAIR") return false;
                  if (filterReminderStatus === "COMPLETED" && r.status !== "COMPLETED") return false;
                  return true;
                })
                .map((r) => (
                  <RepairReminderCard key={r.id} reminder={r} onUpdate={fetchReminders} />
                ))}
            </div>
          )}
        </div>
      ) : (
        /* ────────────────────────────────────────────────────────────────────── */
        /* 3. MASTER-DETAIL 2-PANEL SPLIT VIEW                                    */
        /* ────────────────────────────────────────────────────────────────────── */
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-[620px] h-[calc(100vh-160px)]">
          {/* ==================================================================== */}
          {/* LEFT SIDE: SMALLER PANEL (ONLY IMMAT & DAYS IN THIS STATUS)         */}
          {/* ==================================================================== */}
          <div
            className={`w-full md:w-80 lg:w-96 shrink-0 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden shadow-xs transition-all ${
              showMobileDetail ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Top of Left Side: Search & Filter Tabs */}
            <div className="p-3.5 bg-gray-50 border-b border-gray-200 space-y-2.5">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-gray-200/70 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setLeftTabFilter("open")}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    leftTabFilter === "open"
                      ? "bg-white text-navy shadow-xs font-black"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span>En cours</span>{" "}
                  <span className="text-3xs bg-red-100 text-red-700 px-1.5 py-0.2 rounded-full font-bold">
                    {activeClaims.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeftTabFilter("restored")}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    leftTabFilter === "restored"
                      ? "bg-white text-navy shadow-xs font-black"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span>Rétablis</span>{" "}
                  <span className="text-3xs bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                    {historyClaims.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeftTabFilter("all")}
                  className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    leftTabFilter === "all"
                      ? "bg-white text-navy shadow-xs font-black"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span>Tous ({claims.length})</span>
                </button>
              </div>

              {/* Search by Immat */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher par immat..."
                  value={searchImmat}
                  onChange={(e) => setSearchImmat(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                />
                {searchImmat && (
                  <button
                    type="button"
                    onClick={() => setSearchImmat("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* List of Vehicles: ONLY IMMAT & NUMBER OF DAYS IN THIS STATUS */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 scrollbar-thin">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 animate-spin text-navy" />
                  <span>Chargement des véhicules...</span>
                </div>
              ) : filteredLeftClaims.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  Aucun véhicule trouvé pour ces critères.
                </div>
              ) : (
                filteredLeftClaims.map((claim) => {
                  const isSelected = claim.id === selectedClaim?.id;
                  const daysInStatus = calculateDaysInStatus(claim.step_updated_at || claim.created_at);

                  // Extract garage name, insurance & GoCab Fleet sync status from claim comments
                  let garageName = "Emergence";
                  let fleetCreatedOnGoCabFleet = false;
                  let fleetWhatsappNotified = false;
                  let fleetManagerName = getFleetManagerDisplayName(claim.vehicle as any);
                  try {
                    if (claim.comments) {
                      const parsed = JSON.parse(claim.comments);
                      if (Array.isArray(parsed)) {
                        const meta = parsed.find((c: any) => c.id === "INSURANCE_DOSSIER_META");
                        if (meta?.garage_name) garageName = meta.garage_name;
                        if (meta?.fleet_created_on_gocab_fleet) fleetCreatedOnGoCabFleet = true;
                        if (meta?.fleet_whatsapp_notified) fleetWhatsappNotified = true;
                        if (meta?.fleet_manager_name) fleetManagerName = meta.fleet_manager_name;
                      }
                    }
                  } catch {}
                  const managerShort = fleetManagerName.includes("Mehdi") ? "Mehdi" : "Aziz";

                  // Color based on days in status
                  const daysColor =
                    daysInStatus <= 3
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : daysInStatus <= 7
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-red-50 text-red-800 border-red-300 font-black";

                  const stepDef = TIMELINE_STEPS.find((s) => s.id === claim.timeline_step) || TIMELINE_STEPS[0];

                  return (
                    <button
                      key={claim.id}
                      type="button"
                      onClick={() => {
                        setSelectedClaimId(claim.id);
                        setShowMobileDetail(true);
                      }}
                      className={`w-full p-3.5 text-left transition-all cursor-pointer flex items-center justify-between gap-3 group border-l-4 ${
                        isSelected
                          ? "bg-emerald-50/80 border-emerald-600 shadow-xs"
                          : "border-transparent hover:bg-gray-50"
                      }`}
                    >
                      {/* Left: Plate Number & Status Icon */}
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="text-base shrink-0">{stepDef.icon}</span>
                        <div className="min-w-0">
                          <div className="font-mono font-black text-sm text-navy tracking-wide flex items-center gap-1.5">
                            <span>{claim.vehicle?.plate_number}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-3xs font-semibold text-gray-500 truncate">
                              {stepDef.label}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-900 bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-200">
                              <span>🏬</span> {garageName}
                            </span>
                            {claim.fieldTask && (
                              <span
                                className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${
                                  claim.fieldTask.status === "COMPLETED"
                                    ? "text-emerald-900 bg-emerald-100 border-emerald-300"
                                    : "text-purple-900 bg-purple-100 border-purple-300"
                                }`}
                                title={`Mission Terrain : ${claim.fieldTask.task_type} (${claim.fieldTask.status})`}
                              >
                                🚀 {claim.fieldTask.task_type === "GARAGE_PICKUP" ? "Reprise Garage" : "Mission Terrain"}
                              </span>
                            )}
                            {fleetCreatedOnGoCabFleet ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-emerald-900 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300"
                                title={`Créé sur GoCab Fleet (${fleetManagerName})`}
                              >
                                ✅ Créé GoCab Fleet
                              </span>
                            ) : fleetWhatsappNotified ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-sky-900 bg-sky-100 px-1.5 py-0.2 rounded border border-sky-200"
                                title={`WhatsApp envoyé à ${fleetManagerName} — En attente de confirmation GoCab Fleet`}
                              >
                                ⏳ Attente Fleet ({managerShort})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: EXACT REQUIREMENT — NUMBER OF DAYS FOR VEHICLE WITHIN THIS STATUS */}
                      <div className="shrink-0 flex items-center gap-2 text-right">
                        <div
                          className={`px-2.5 py-1 rounded-xl border text-2xs font-extrabold shadow-2xs flex items-center gap-1 ${daysColor}`}
                          title={`${daysInStatus} jours passés dans l'étape "${stepDef.label}"`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{daysInStatus} jour{daysInStatus > 1 ? "s" : ""}</span>
                        </div>

                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${
                            isSelected ? "text-emerald-700 translate-x-0.5" : "text-gray-300 group-hover:text-gray-500"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Left Side Footer Counter */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-3xs font-semibold text-gray-500 flex items-center justify-between">
              <span>{filteredLeftClaims.length} véhicule(s) affiché(s)</span>
              <span>GoCab Fleet Intelligence</span>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* RIGHT SIDE: FULL DISPLAY OF VEHICLE, STATUSES, DOCS & INSURANCE PART */}
          {/* ==================================================================== */}
          <div
            className={`flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs flex flex-col ${
              !showMobileDetail ? "hidden md:flex" : "flex"
            }`}
          >
            {selectedClaim ? (
              <InsuranceVehicleDetail
                claim={selectedClaim}
                onUpdate={fetchClaims}
                onCloseMobile={() => setShowMobileDetail(false)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400 space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center text-2xl">
                  🚗
                </div>
                <h3 className="text-base font-bold text-gray-700">Sélectionnez un véhicule</h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  Cliquez sur une immatriculation à gauche pour afficher la fiche complète, le suivi de l&apos;assureur, les photos et les documents.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Repair Reminder Modal */}
      <RepairReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        onSuccess={fetchReminders}
        vehicles={vehicles}
      />
    </div>
  );
}
