"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AccidentCard, { AccidentClaim, TIMELINE_STEPS } from "./AccidentCard";
import toast from "react-hot-toast";
import {
  Car,
  Clock,
  ShieldAlert,
  FileText,
  Search,
  Filter,
  RotateCcw,
} from "lucide-react";

interface VehicleItem {
  id: string;
  plate_number: string;
  make_model?: string;
  hub_city?: string;
  status?: string;
  assigned_driver_name?: string | null;
}

export default function InsuranceView() {
  const [claims, setClaims] = useState<AccidentClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Split into 2 pages: "open" (active claims) and "restored" (completed/restored vehicles)
  const [activeTab, setActiveTab] = useState<"open" | "restored">("open");

  // Filter and Search Toolbar States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState<string>("ALL");
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterFault, setFilterFault] = useState<string>("ALL");

  // States for reporting a new accident with searchable combobox
  const [isReporting, setIsReporting] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        setClaims(data.claims);
      }
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    } finally {
      setIsLoading(false);
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
    fetchVehicles();
  }, [fetchClaims, fetchVehicles]);

  const handleReportAccident = async () => {
    if (!newVehicleId) return;
    try {
      const res = await fetch("/api/accidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: newVehicleId }),
      });
      if (res.ok) {
        toast.success("Dossier accident ouvert avec succès !");
        setIsReporting(false);
        setNewVehicleId("");
        setVehicleSearch("");
        setIsDropdownOpen(false);
        setActiveTab("open");
        fetchClaims();
        fetchVehicles();
      } else {
        toast.error("Échec de la création du dossier d'accident");
      }
    } catch (err) {
      console.error("Error reporting accident:", err);
      toast.error("Erreur réseau");
    }
  };

  // Separate active claims and completed (Vehicle Back) claims
  const activeClaims = claims.filter((c) => c.timeline_step !== "VEHICLE_BACK");
  const historyClaims = claims.filter((c) => c.timeline_step === "VEHICLE_BACK");

  // KPI Calculations based on active claims
  const totalActive = activeClaims.length;
  const hardCount = activeClaims.filter((c) => c.severity === "HARD").length;
  const softCount = activeClaims.filter((c) => c.severity === "SOFT").length;
  const insuranceDocsCount = activeClaims.filter((c) => c.timeline_step === "INSURANCE_DOCS").length;

  const totalDowntimeDays = activeClaims.reduce((sum, c) => {
    const diffTime = Math.abs(new Date().getTime() - new Date(c.created_at).getTime());
    return sum + Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }, 0);
  const avgDowntimeDays = totalActive > 0 ? Math.round(totalDowntimeDays / totalActive) : 0;

  // Filter Claims Helper
  const filterClaimsList = (list: AccidentClaim[]) => {
    return list.filter((claim) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPlate = claim.vehicle.plate_number.toLowerCase().includes(q);
        const matchModel = claim.vehicle.make_model?.toLowerCase().includes(q) || false;
        const matchDriver = claim.driver_name?.toLowerCase().includes(q) || false;
        const matchPhone = claim.driver_phone?.toLowerCase().includes(q) || false;
        if (!matchPlate && !matchModel && !matchDriver && !matchPhone) return false;
      }

      // Stage filter
      if (filterStage !== "ALL" && claim.timeline_step !== filterStage) {
        return false;
      }

      // Severity filter
      if (filterSeverity !== "ALL" && claim.severity !== filterSeverity) {
        return false;
      }

      // Fault filter
      if (filterFault !== "ALL" && claim.fault !== filterFault) {
        return false;
      }

      return true;
    });
  };

  const activeFiltered = filterClaimsList(activeClaims);
  const historyFiltered = filterClaimsList(historyClaims);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    filterStage !== "ALL" ||
    filterSeverity !== "ALL" ||
    filterFault !== "ALL";

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterStage("ALL");
    setFilterSeverity("ALL");
    setFilterFault("ALL");
  };

  // Filter vehicles by search query in the searchable combobox
  const filteredVehicles = vehicles.filter((v) => {
    if (!vehicleSearch.trim()) return true;
    const q = vehicleSearch.toLowerCase().trim();
    return (
      v.plate_number.toLowerCase().includes(q) ||
      (v.make_model && v.make_model.toLowerCase().includes(q)) ||
      (v.hub_city && v.hub_city.toLowerCase().includes(q)) ||
      (v.assigned_driver_name && v.assigned_driver_name.toLowerCase().includes(q))
    );
  });

  const selectedVehicle = vehicles.find((v) => v.id === newVehicleId);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-navy">Assurance & Gestion des Accidents</h2>
          <p className="text-sm text-gray-500">
            Suivi des véhicules accidentés, étapes du garage et restitution flotte.
          </p>
        </div>
        <button
          onClick={() => {
            setIsReporting(!isReporting);
            if (isReporting) {
              setNewVehicleId("");
              setVehicleSearch("");
              setIsDropdownOpen(false);
            }
          }}
          className="px-4 py-2.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <span>{isReporting ? "✕ Annuler" : "🚨 Déclarer un Accident"}</span>
        </button>
      </div>

      {/* KPI Summary Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {/* Card 1: Total Active Accidents */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
            <Car className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-black text-navy">{totalActive}</div>
            <div className="text-xs font-bold text-gray-600 truncate">Véhicules Accidentés</div>
            <div className="text-3xs text-red-600 font-semibold">Hors service actif</div>
          </div>
        </div>

        {/* Card 2: Severity Split */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-black text-navy flex items-baseline gap-1.5">
              <span className="text-red-600">{hardCount}</span>
              <span className="text-xs font-medium text-gray-400">/</span>
              <span className="text-amber-600">{softCount}</span>
            </div>
            <div className="text-xs font-bold text-gray-600 truncate">Lourde / Légère</div>
            <div className="text-3xs text-gray-400 font-medium">Répartition structurelle</div>
          </div>
        </div>

        {/* Card 3: Average Downtime */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-black text-navy">
              {avgDowntimeDays} <span className="text-xs font-bold text-gray-500">jours</span>
            </div>
            <div className="text-xs font-bold text-gray-600 truncate">Durée Moyenne d&apos;Arrêt</div>
            <div className="text-3xs text-gray-400 font-medium">Temps d&apos;immobilisation</div>
          </div>
        </div>

        {/* Card 4: Insurance Docs Pending */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-black text-navy">{insuranceDocsCount}</div>
            <div className="text-xs font-bold text-gray-600 truncate">Attente Assurance</div>
            <div className="text-3xs text-purple-700 font-semibold">Devis / Expertises en cours</div>
          </div>
        </div>
      </div>

      {/* Searchable Combobox for Reporting Accident */}
      {isReporting && (
        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm mb-6 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1 max-w-xl" ref={dropdownRef}>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                <span>
                  Sélectionner le véhicule <span className="text-red-500">*</span>
                </span>
                <span className="text-3xs text-gray-400 font-normal">
                  {vehicles.length} véhicules au parc
                </span>
              </label>

              {selectedVehicle ? (
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-xs text-navy bg-white px-2.5 py-1 rounded-lg border border-red-200 shadow-2xs">
                      🚗 {selectedVehicle.plate_number}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-gray-800">
                        {selectedVehicle.make_model || "Modèle non spécifié"}
                      </div>
                      <div className="text-2xs text-gray-500 flex items-center gap-2">
                        <span>📍 {selectedVehicle.hub_city || "Casablanca"}</span>
                        {selectedVehicle.assigned_driver_name && (
                          <span>· 👤 {selectedVehicle.assigned_driver_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewVehicleId("");
                      setVehicleSearch("");
                      setIsDropdownOpen(true);
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-800 bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <span>✕</span>
                    <span>Changer</span>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                      🔍
                    </span>
                    <input
                      type="text"
                      placeholder="Rechercher par immatriculation (ex: 26552, WW990...) ou modèle..."
                      value={vehicleSearch}
                      onFocus={() => setIsDropdownOpen(true)}
                      onChange={(e) => {
                        setVehicleSearch(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:outline-none transition-all placeholder:text-gray-400"
                    />
                    {vehicleSearch && (
                      <button
                        type="button"
                        onClick={() => setVehicleSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filtered Dropdown Popover */}
                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-50 divide-y divide-gray-100 animate-fadeIn">
                      {filteredVehicles.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">
                          Aucun véhicule trouvé pour &quot;{vehicleSearch}&quot;
                        </div>
                      ) : (
                        filteredVehicles.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setNewVehicleId(v.id);
                              setIsDropdownOpen(false);
                              setVehicleSearch("");
                            }}
                            className="w-full p-2.5 text-left hover:bg-red-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono font-bold text-xs bg-gray-100 group-hover:bg-red-100 group-hover:text-red-700 px-2 py-1 rounded text-navy transition-colors">
                                {v.plate_number}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-gray-800">
                                  {v.make_model || "Véhicule"}
                                </div>
                                <div className="text-3xs text-gray-400 flex items-center gap-1.5">
                                  <span>📍 {v.hub_city || "Casablanca"}</span>
                                  {v.assigned_driver_name && <span>· 👤 {v.assigned_driver_name}</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 group-hover:bg-red-200/50 group-hover:text-red-700">
                              {v.status || "Actif"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReportAccident}
                disabled={!newVehicleId}
                className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>🚨</span>
                <span>Créer Dossier Accident</span>
              </button>
              <button
                onClick={() => {
                  setIsReporting(false);
                  setNewVehicleId("");
                  setVehicleSearch("");
                  setIsDropdownOpen(false);
                }}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Quick Filters Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-xs mb-6 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filtrer par immatriculation, chauffeur, téléphone ou modèle de véhicule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Stage Filter */}
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy cursor-pointer transition-all"
            >
              <option value="ALL">Toutes les étapes</option>
              {TIMELINE_STEPS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.stepNum}. {s.shortLabel} - {s.label}
                </option>
              ))}
            </select>

            {/* Severity Filter */}
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy cursor-pointer transition-all"
            >
              <option value="ALL">Toutes gravités</option>
              <option value="HARD">🛑 Lourde (Structure)</option>
              <option value="SOFT">⚠️ Légère (Carrosserie)</option>
            </select>

            {/* Fault Filter */}
            <select
              value={filterFault}
              onChange={(e) => setFilterFault(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy cursor-pointer transition-all"
            >
              <option value="ALL">Toutes responsabilités</option>
              <option value="DRIVER">👤 Chauffeur</option>
              <option value="THIRD_PARTY">🚗 Tiers</option>
            </select>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Effacer tous les filtres"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>
            )}
          </div>
        </div>

        {/* Filtered Count Info */}
        <div className="flex items-center justify-between text-2xs text-gray-500 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span>
              {activeTab === "open" ? (
                <>
                  Affichage de <strong className="text-navy">{activeFiltered.length}</strong> sur{" "}
                  <strong>{activeClaims.length}</strong> dossier{activeClaims.length > 1 ? "s" : ""} en cours
                </>
              ) : (
                <>
                  Affichage de <strong className="text-navy">{historyFiltered.length}</strong> sur{" "}
                  <strong>{historyClaims.length}</strong> véhicule{historyClaims.length > 1 ? "s" : ""} rétabli{historyClaims.length > 1 ? "s" : ""}
                </>
              )}
            </span>
          </div>

          {hasActiveFilters && (
            <span className="text-navy font-bold flex items-center gap-1">
              <span>●</span> Filtres actifs
            </span>
          )}
        </div>
      </div>

      {/* Tabs: Dossiers En Cours vs Véhicules Rétablis */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-3 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("open")}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === "open"
              ? "bg-navy text-white shadow-md shadow-navy/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <span>🚨</span>
          <span>Dossiers En Cours</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              activeTab === "open" ? "bg-white/20 text-white" : "bg-red-100 text-red-700"
            }`}
          >
            {activeFiltered.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("restored")}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === "restored"
              ? "bg-navy text-white shadow-md shadow-navy/20"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <span>✅</span>
          <span>Véhicules Rétablis</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
              activeTab === "restored" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {historyFiltered.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="text-gray-400 text-sm py-12 text-center flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 animate-spin text-navy" />
          <span>Chargement des dossiers d&apos;assurance...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 pb-10 scrollbar-thin">
          {activeTab === "open" ? (
            <div>
              {activeFiltered.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 text-sm">
                  <div className="text-4xl mb-3">🎉</div>
                  <div className="font-bold text-gray-700 text-base mb-1">
                    {hasActiveFilters
                      ? "Aucun dossier ne correspond à vos filtres"
                      : "Aucun dossier d'accident en cours"}
                  </div>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mb-3">
                    {hasActiveFilters
                      ? "Essayez de modifier ou d'effacer vos critères de recherche."
                      : "Tous les véhicules sont en service ou rétablis. Utilisez \"Déclarer un Accident\" en cas de nouvel incident."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={handleResetFilters}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Effacer les filtres
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {activeFiltered.map((claim) => (
                    <AccidentCard key={claim.id} claim={claim} onUpdate={fetchClaims} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {historyFiltered.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 text-sm">
                  <div className="text-4xl mb-3">📋</div>
                  <div className="font-bold text-gray-700 text-base mb-1">
                    {hasActiveFilters
                      ? "Aucun véhicule rétabli ne correspond à vos filtres"
                      : "Aucun véhicule rétabli dans l'historique"}
                  </div>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mb-3">
                    {hasActiveFilters
                      ? "Essayez de modifier ou d'effacer vos critères de recherche."
                      : "Lorsqu'un véhicule termine son cycle de réparation et revient en service, il apparaît ici."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={handleResetFilters}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Effacer les filtres
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {historyFiltered.map((claim) => (
                    <AccidentCard key={claim.id} claim={claim} onUpdate={fetchClaims} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
