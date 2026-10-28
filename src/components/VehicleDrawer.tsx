"use client";

/**
 * VehicleDrawer Component
 * 
 * A sliding sidebar drawer (slides in from the right) that allows Onboarding Specialists
 * and Fleet Managers to enter or update vehicle information and regulatory document expirations:
 * - Plate Number / Immatriculation
 * - Make & Model, Year, VIN, Odometer Mileage
 * - Insurance Expiration & Policy Number
 * - Vignette Tax Expiration / Due Date
 * - Autorisation de Circulation Expiration
 * - Visite Technique Expiration
 */

import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import AddExpenseModal, { EXPENSE_CATEGORIES } from "./AddExpenseModal";
import AttestationModal, { AttestationData } from "./AttestationModal";
import BonDeCommandeModal from "./BonDeCommandeModal";
import { BonDeCommandeData, getFormattedToday } from "@/lib/bonDeCommandeCatalog";
import { Plus, DollarSign, Receipt, Calendar, FileText, Printer, Shield, CheckCircle, Clock, AlertCircle, Wrench, Droplet, FileCheck, Flag, Paperclip } from "lucide-react";
import VehicleDocumentsModal from "./VehicleDocumentsModal";
import RedFlagBadge from "./RedFlagBadge";
import NationalBlacklistBadge from "./NationalBlacklistBadge";
import NationalBlacklistAlertBanner from "./NationalBlacklistAlertBanner";
import { matchNationalBlacklist } from "@/lib/services/nationalBlacklistMatcher";
import { isMehdiPlate } from "@/lib/fleet-managers";

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
  "missing_document",
  "missing_key",
  "Accident",
  "Blocked",
] as const;

export interface Vehicle {
  id: string;
  plate_number: string;
  make_model: string;
  year: number;
  vin: string | null;
  current_mileage: number;
  hub_city: string;
  status: string;
  insurance_expiry_date: string | null;
  insurance_policy_number: string | null;
  vignette_expiry_date: string | null;
  autorisation_expiry_date: string | null;
  technical_inspection_expiry: string | null;
  assigned_driver_name: string | null;
  assigned_driver_phone: string | null;
  historical_driver_name?: string | null;
  historical_driver_phone?: string | null;
  assigned_supervisor?: string | null;
  assigned_collector?: string | null;
  is_current_working_car?: boolean;
  is_driver_red_flagged?: boolean;
  driver_red_flag_reason?: string | null;
  driverProfile?: {
    id: string;
    fullName: string;
    phoneSanitized: string;
    cinNumber?: string | null;
    isRedFlagged?: boolean;
    redFlagReason?: string | null;
  } | null;
  total_expenses_mad?: number;
  documents?: string | null;
  notes: string | null;
  created_at: string;
}

interface VehicleDrawerProps {
  vehicle?: Vehicle | null; // If provided, edit mode; else create mode
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function VehicleDrawer({
  vehicle,
  onClose,
  onSaveSuccess,
}: VehicleDrawerProps) {
  const [plateNumber, setPlateNumber] = useState(vehicle?.plate_number || "");
  const [makeModel, setMakeModel] = useState(vehicle?.make_model || "");
  const [year, setYear] = useState<number>(vehicle?.year || new Date().getFullYear());
  const [vin, setVin] = useState(vehicle?.vin || "");
  const [currentMileage, setCurrentMileage] = useState<number>(vehicle?.current_mileage || 0);
  const [hubCity, setHubCity] = useState(vehicle?.hub_city || "Casablanca");
  const [status, setStatus] = useState(vehicle?.status || "Available");

  // Regulatory Compliance Dates
  const [insuranceExpiry, setInsuranceExpiry] = useState(
    vehicle?.insurance_expiry_date ? vehicle.insurance_expiry_date.split("T")[0] : ""
  );
  const [insurancePolicy, setInsurancePolicy] = useState(vehicle?.insurance_policy_number || "");
  
  const [vignetteExpiry, setVignetteExpiry] = useState(
    vehicle?.vignette_expiry_date ? vehicle.vignette_expiry_date.split("T")[0] : ""
  );
  
  const [autorisationExpiry, setAutorisationExpiry] = useState(
    vehicle?.autorisation_expiry_date ? vehicle.autorisation_expiry_date.split("T")[0] : ""
  );
  
  const [technicalInspectionExpiry, setTechnicalInspectionExpiry] = useState(
    vehicle?.technical_inspection_expiry ? vehicle.technical_inspection_expiry.split("T")[0] : ""
  );

  const [assignedDriverName, setAssignedDriverName] = useState(vehicle?.assigned_driver_name || "");
  const [assignedDriverPhone, setAssignedDriverPhone] = useState(vehicle?.assigned_driver_phone || "");
  const [assignedDriverId, setAssignedDriverId] = useState(vehicle?.driverProfile?.id || "");
  const isDedicatedMehdi = isMehdiPlate(vehicle?.plate_number || plateNumber);
  const [assignedSupervisor, setAssignedSupervisor] = useState(
    isMehdiPlate(vehicle?.plate_number) ? "mehdi elyattouti" : (vehicle?.assigned_supervisor || vehicle?.assigned_collector || "Mohamed Aziz")
  );
  const [assignedCollector, setAssignedCollector] = useState(
    isMehdiPlate(vehicle?.plate_number) ? "mehdi elyattouti" : (vehicle?.assigned_collector || vehicle?.assigned_supervisor || "Mohamed Aziz")
  );
  const [notes, setNotes] = useState(vehicle?.notes || "");

  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<any[]>([]);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Vidange tracking and document states
  const [vidangeStats, setVidangeStats] = useState<{
    total: number;
    simpleCount: number;
    completeCount: number;
    history: any[];
  } | null>(null);
  const [bonsDeCommande, setBonsDeCommande] = useState<any[]>([]);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<{
    grandTotalSpentMad: number;
    totalBcMad: number;
    totalBcHt: number;
    totalBcTva: number;
    totalOtherExpensesMad: number;
    totalExpensesMad: number;
    expensesCount: number;
    bonsDeCommandeCount: number;
    expensesByCategory: Record<string, number>;
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Modals state
  const [isAttestationOpen, setIsAttestationOpen] = useState(false);
  const [attestationData, setAttestationData] = useState<AttestationData | null>(null);
  const [isBcModalOpen, setIsBcModalOpen] = useState(false);
  const [selectedBc, setSelectedBc] = useState<BonDeCommandeData | null>(null);
  const [isNewBcModalOpen, setIsNewBcModalOpen] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  async function loadExpenses() {
    if (!vehicle?.id) return;
    try {
      const res = await fetch(`/api/expenses?vehicle_id=${vehicle.id}`);
      const data = await res.json();
      if (data.expenses) {
        setVehicleExpenses(data.expenses);
      }
    } catch (err) {
      console.error("Failed to load vehicle expenses:", err);
    }
  }

  async function loadVehicleDetails() {
    if (!vehicle?.id) return;
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.vidangeStats) setVidangeStats(data.vidangeStats);
        if (data.bonsDeCommande) setBonsDeCommande(data.bonsDeCommande);
        if (data.attestations) setAttestations(data.attestations);
        if (data.financialSummary) setFinancialSummary(data.financialSummary);
        if (data.expenses) setVehicleExpenses(data.expenses);
        if (data.vehicle?.driverProfile) {
          if (!assignedDriverId && data.vehicle.driverProfile.id) {
            setAssignedDriverId(data.vehicle.driverProfile.id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load vehicle details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  }

  async function handleCreateBcSave(bcData: BonDeCommandeData) {
    if (!vehicle) return;
    try {
      const summaryItems = (bcData.items || [])
        .map((i) => `${i.designation || "Prestation"} (x${i.quantity || 1})`)
        .join(", ");
      const isVidange = (bcData.items || []).some((it) =>
        (it.designation || "").toLowerCase().includes("vidange")
      );
      const ticketType = isVidange ? "Vidange" : "Repair";

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicle.id,
          plate_number: vehicle.plate_number,
          driver_name: vehicle.assigned_driver_name || null,
          driver_phone: vehicle.assigned_driver_phone || null,
          ticket_type: ticketType,
          priority: "Normal",
          description: `[Bon de Commande ${bcData.bc_number ? "N° " + bcData.bc_number : ""}] ${summaryItems || "Prestation"} · Total: ${bcData.total_ttc} MAD TTC`,
          update_vehicle_status: false,
          repair_cost: bcData.total_ttc,
          garage_name: bcData.supplier_name,
          resolution_notes: JSON.stringify({ bon_de_commande: bcData }),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Échec de création du Bon de Commande");
      }

      toast.success("Bon de Commande validé et dépense financière enregistrée !");
      setIsNewBcModalOpen(false);
      loadVehicleDetails();
      loadExpenses();
      onSaveSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement du Bon de Commande");
    }
  }

  useEffect(() => {
    async function loadDrivers() {
      try {
        const url = `/api/drivers?unassigned=true${vehicle?.id ? `&current_vehicle_id=${vehicle.id}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        setAvailableDrivers(data.drivers || []);
      } catch (err) {
        console.error("Failed to load drivers:", err);
      }
    }
    loadDrivers();
    loadExpenses();
    loadVehicleDetails();
  }, [vehicle?.id]);

  function handleOpenNewAttestation() {
    const todayFormatted = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    setAttestationData({
      vehicleId: vehicle?.id,
      fullName: assignedDriverName || vehicle?.driverProfile?.fullName || "",
      cin: vehicle?.driverProfile?.cinNumber || "",
      brand: makeModel || vehicle?.make_model || "",
      immat: plateNumber || vehicle?.plate_number || "",
      chassisNumber: vin || vehicle?.vin || "",
      date: todayFormatted,
    });
    setIsAttestationOpen(true);
  }

  function handleOpenBc(bcData: any) {
    setSelectedBc(bcData);
    setIsBcModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const payload = {
        plate_number: plateNumber,
        make_model: makeModel,
        year: Number(year),
        vin: vin || null,
        current_mileage: Number(currentMileage),
        hub_city: hubCity,
        status,
        insurance_expiry_date: insuranceExpiry || null,
        insurance_policy_number: insurancePolicy || null,
        vignette_expiry_date: vignetteExpiry || null,
        autorisation_expiry_date: autorisationExpiry || null,
        technical_inspection_expiry: technicalInspectionExpiry || null,
        assigned_driver_id: assignedDriverId || null,
        assigned_supervisor: isMehdiPlate(vehicle?.plate_number || plateNumber) ? "mehdi elyattouti" : (assignedSupervisor || "Mohamed Aziz"),
        assigned_collector: isMehdiPlate(vehicle?.plate_number || plateNumber) ? "mehdi elyattouti" : (assignedCollector || assignedSupervisor || "Mohamed Aziz"),
        notes: notes || null,
      };

      const url = vehicle ? `/api/vehicles/${vehicle.id}` : "/api/vehicles";
      const method = vehicle ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save vehicle data.");
      }

      toast.success(vehicle ? "Vehicle updated successfully" : "Vehicle added successfully");
      onSaveSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving.");
      setErrorMsg(err.message || "An error occurred while saving.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }

  const selectedDriverProfile = availableDrivers.find((d: any) => d.id === assignedDriverId) || vehicle?.driverProfile;
  const isDriverRedFlagged = Boolean(
    selectedDriverProfile?.isRedFlagged ||
    vehicle?.is_driver_red_flagged ||
    (selectedDriverProfile && selectedDriverProfile.isRedFlagged)
  );
  const redFlagReason = selectedDriverProfile?.redFlagReason || vehicle?.driver_red_flag_reason || vehicle?.driverProfile?.redFlagReason;
  const currentDriverDisplayName = selectedDriverProfile?.fullName || assignedDriverName || vehicle?.assigned_driver_name;
  const nationalMatch = useMemo(
    () => matchNationalBlacklist(currentDriverDisplayName),
    [currentDriverDisplayName]
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Drawer Panel */}
      <div
        className={`relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between z-10 transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="bg-navy px-6 py-5 flex items-center justify-between text-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                <span>🚗</span> {vehicle ? `Edit Vehicle (${vehicle.plate_number})` : "Register New Vehicle"}
              </h3>
              {isDriverRedFlagged && (
                <RedFlagBadge reason={redFlagReason} />
              )}
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              Enter vehicle identification and compliance expiry dates
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Form */}
        <form id="vehicle-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Red Flag Warning Alert Banner */}
          {isDriverRedFlagged && (
            <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-pulse">
              <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-red-900 uppercase tracking-wider">
                    Alerte Sécurité Flotte : Chauffeur Red Flag
                  </span>
                  <RedFlagBadge reason={redFlagReason} />
                </div>
                <p className="text-xs font-semibold text-red-800 mt-1">
                  Le chauffeur associé à ce véhicule ({currentDriverDisplayName ? <strong>{currentDriverDisplayName}</strong> : "non spécifié"}) est fiché <strong>RED FLAG</strong>.
                </p>
                {redFlagReason && (
                  <p className="text-xs text-red-700 mt-1 bg-white/80 rounded-lg px-2.5 py-1 border border-red-200 inline-block font-medium">
                    Motif : {redFlagReason}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Section 1: Vehicle Identity */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-navy uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
              <span>📋</span> Vehicle Identification
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Plate Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 12345-A-6"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Make & Model *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dacia Logan"
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  min="2010"
                  max="2030"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Current Odometer (KM)
                </label>
                <input
                  type="number"
                  min="0"
                  value={currentMileage}
                  onChange={(e) => setCurrentMileage(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Regional Hub *
                </label>
                <select
                  value={hubCity}
                  onChange={(e) => setHubCity(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-2.5 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none"
                >
                  {HUB_CITIES.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                VIN / Chassis Number
              </label>
              <input
                type="text"
                placeholder="17-character VIN string"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono uppercase"
              />
            </div>
          </div>

          {/* Section 2: Regulatory Document Expirations */}
          <div className="space-y-4 bg-gray-50 border border-gray-200/80 rounded-2xl p-4">
            <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
              <span>📅</span> Regulatory Expirations & Reminders
            </h4>

            {/* Insurance Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  🛡️ Insurance Expiry
                </label>
                <input
                  type="date"
                  value={insuranceExpiry}
                  onChange={(e) => setInsuranceExpiry(e.target.value)}
                  className="w-full border border-gray-300 bg-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Policy Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. POL-99214"
                  value={insurancePolicy}
                  onChange={(e) => setInsurancePolicy(e.target.value)}
                  className="w-full border border-gray-300 bg-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Vignette Tax & Autorisation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  🏷️ Vignette Tax Due Date
                </label>
                <input
                  type="date"
                  value={vignetteExpiry}
                  onChange={(e) => setVignetteExpiry(e.target.value)}
                  className="w-full border border-gray-300 bg-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  📄 Autorisation Expiry
                </label>
                <input
                  type="date"
                  value={autorisationExpiry}
                  onChange={(e) => setAutorisationExpiry(e.target.value)}
                  className="w-full border border-gray-300 bg-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Technical Inspection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                🔧 Visite Technique Expiry
              </label>
              <input
                type="date"
                value={technicalInspectionExpiry}
                onChange={(e) => setTechnicalInspectionExpiry(e.target.value)}
                className="w-full border border-gray-300 bg-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Status & Assignment */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-navy uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
              <span>⚙️</span> Operational Status
            </h4>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vehicle Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-navy/30 focus:outline-none"
              >
                {!VEHICLE_STATUSES.includes(status as any) && status && (
                  <option value={status}>{status}</option>
                )}
                {VEHICLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Assign Driver
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {nationalMatch.isBlacklisted && (
                      <NationalBlacklistBadge match={nationalMatch} size="xs" />
                    )}
                    {isDriverRedFlagged && (
                      <RedFlagBadge reason={redFlagReason} />
                    )}
                  </div>
                </div>
                <select
                  value={assignedDriverId}
                  onChange={(e) => setAssignedDriverId(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:outline-none ${
                    nationalMatch.isBlacklisted || isDriverRedFlagged
                      ? "border-red-400 bg-red-50/40 text-red-950 focus:ring-red-500/30"
                      : "border-gray-300 focus:ring-navy/30"
                  }`}
                >
                  <option value="">-- Unassigned --</option>
                  {availableDrivers.map((d: any) => (
                    <option key={d.id} value={d.id} className={d.isRedFlagged ? "text-red-700 font-bold bg-red-50" : ""}>
                      {d.isRedFlagged ? "🚩 [RED FLAG] " : ""}{d.fullName} ({d.phoneSanitized}){d.isRedFlagged ? ` — ⚠️ ${d.redFlagReason || "Signalement actif"}` : ""}
                    </option>
                  ))}
                  {/* Keep the old text-based fallback visible if no driver profile is linked but name exists */}
                  {!assignedDriverId && assignedDriverName && !availableDrivers.find(d => d.fullName === assignedDriverName) && (
                    <option value="" disabled>Legacy: {assignedDriverName}</option>
                  )}
                </select>

                {/* National Blacklist Alert Banner */}
                {nationalMatch.isBlacklisted && (
                  <div className="mt-2.5">
                    <NationalBlacklistAlertBanner
                      match={nationalMatch}
                      candidateName={currentDriverDisplayName}
                    />
                  </div>
                )}

                {isDriverRedFlagged && !nationalMatch.isBlacklisted && (
                  <div className="mt-2 p-2.5 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                    <span className="text-sm">🚩</span>
                    <div className="flex-1">
                      <p className="font-bold">Attention : Conducteur sous surveillance Red Flag</p>
                      <p className="text-3xs sm:text-xs text-red-700 mt-0.5">
                        {redFlagReason || "Ce chauffeur a été signalé (impayés, sinistres fréquents ou problème d'intégrité)."}
                      </p>
                    </div>
                  </div>
                )}
                {vehicle?.historical_driver_name && !assignedDriverId && !assignedDriverName && (
                  <div className="mt-2 p-2 bg-amber-50/90 border border-amber-200/90 rounded-xl text-3xs sm:text-xs text-amber-900 flex items-center gap-1.5">
                    <span>🕒</span>
                    <span>
                      Dernier conducteur historique : <strong>{vehicle.historical_driver_name}</strong> (Ce véhicule n&apos;est plus son véhicule actuel).
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">👤 Gestionnaire de Flotte (Fleet Manager)</span>
                  {isDedicatedMehdi && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                      Verrouillé Mehdi
                    </span>
                  )}
                </label>
                <select
                  value={isDedicatedMehdi ? "mehdi elyattouti" : assignedSupervisor}
                  disabled={isDedicatedMehdi}
                  onChange={(e) => {
                    setAssignedSupervisor(e.target.value);
                    setAssignedCollector(e.target.value);
                  }}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none ${
                    isDedicatedMehdi
                      ? "bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed"
                      : "border-gray-300 text-slate-900"
                  }`}
                >
                  <option value="">-- Non assigné --</option>
                  <option value="Mohamed Aziz">Mohamed Aziz (Portefeuille Général)</option>
                  <option value="mehdi elyattouti">Mehdi Elyattouti (26 Véhicules Dédiés)</option>
                  <option value="Salma Abouri">Salma Abouri</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                placeholder="Additional vehicle or garage notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
              />
            </div>

            {/* Financial, Maintenance & Documents (When viewing existing vehicle) */}
            {vehicle && (
              <>
                {/* Section 4: Financial & Expenses History */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <span>💸</span> Bilan Financier & Dépenses ({vehicleExpenses.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddExpenseOpen(true)}
                      className="flex items-center gap-1 text-xs font-bold text-navy bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-700" />
                      <span>Ajouter Frais</span>
                    </button>
                  </div>

                  {/* Financial Spend Summary Card */}
                  <div className="p-3 bg-gradient-to-br from-navy/5 via-blue-50/40 to-navy/10 rounded-2xl border border-navy/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                        Total Dépensé sur ce Véhicule :
                      </span>
                      <span className="font-mono font-black text-navy text-base">
                        {(financialSummary?.grandTotalSpentMad ?? vehicleExpenses.reduce((s, e) => s + (e.amount_mad || 0), 0)).toLocaleString()} MAD TTC
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-navy/10 text-[11px]">
                      {financialSummary && financialSummary.totalBcMad > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-blue-100/80 text-blue-900 font-semibold border border-blue-200">
                          📋 Bons de Commande : <strong>{financialSummary.totalBcMad.toLocaleString()} MAD</strong> ({financialSummary.bonsDeCommandeCount} BC)
                        </span>
                      )}
                      {financialSummary && financialSummary.totalOtherExpensesMad > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100/80 text-amber-900 font-semibold border border-amber-200">
                          🔧 Autres Frais : <strong>{financialSummary.totalOtherExpensesMad.toLocaleString()} MAD</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {vehicleExpenses.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Historique des Lignes de Frais & Interventions :
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {vehicleExpenses.map((exp: any) => {
                          const isFromBc = exp.invoice_number?.startsWith("BC") || exp.description?.includes("[Bon de Commande");
                          return (
                            <div
                              key={exp.id}
                              className="p-2.5 bg-gray-50 hover:bg-gray-100/80 rounded-xl border border-gray-200 text-xs flex items-center justify-between gap-2 transition-colors"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-gray-800">
                                    {EXPENSE_CATEGORIES.find((c) => c.key === exp.category)?.label || exp.category}
                                  </span>
                                  {isFromBc && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                      📋 {exp.invoice_number || "Bon de Commande"}
                                    </span>
                                  )}
                                </div>
                                {exp.description && (
                                  <p className="text-2xs text-gray-500 truncate max-w-[240px]">{exp.description}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-navy">{exp.amount_mad.toLocaleString()} MAD</p>
                                <p className="text-2xs text-gray-400">
                                  {new Date(exp.paid_at).toLocaleDateString("fr-FR")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
                      Aucun frais enregistré pour ce véhicule.
                    </div>
                  )}
                </div>

              {/* Section 5: Suivi des Vidanges (Huile Moteur) */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <span>🛢️</span> Suivi des Vidanges ({vidangeStats?.total || 0})
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {vidangeStats?.simpleCount || 0} Simple
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {vidangeStats?.completeCount || 0} Complète
                      </span>
                    </div>
                  </div>

                  {vidangeStats && vidangeStats.history.length > 0 ? (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="text-amber-900 font-bold block">
                            Total Vidanges Effectuées (Tickets Résolus) : {vidangeStats.total}
                          </span>
                          <span className="text-[11px] text-amber-700">
                            {vidangeStats.simpleCount} simples (huile + filtre) · {vidangeStats.completeCount} complètes (tous filtres)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-amber-900">
                            Dernière : {new Date(vidangeStats.history[0].date).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {vidangeStats.history.map((vid: any) => (
                          <div
                            key={vid.ticket_id}
                            className="p-2.5 bg-white border border-gray-200 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs hover:border-navy/30 transition-all"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    vid.type === "Vidange Complète"
                                      ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  }`}
                                >
                                  {vid.type}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    vid.is_solved
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  {vid.is_solved ? "✓ Résolue" : "⏳ En cours"}
                                </span>
                                <span className="font-semibold text-gray-800 text-[11px] truncate">
                                  {vid.garage}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400">
                                {new Date(vid.date).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                                {vid.bc_number ? ` · Réf: ${vid.bc_number}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right">
                                <p className="font-bold text-navy text-xs">
                                  {vid.cost ? `${vid.cost.toLocaleString()} MAD` : "-"}
                                </p>
                              </div>
                              {vid.bc_data && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenBc(vid.bc_data)}
                                  className="p-1.5 text-navy hover:bg-navy/10 rounded-lg border border-gray-200 transition-colors"
                                  title="Voir / Imprimer le Bon de Commande"
                                >
                                  <Printer className="w-3.5 h-3.5 text-navy" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
                      Aucune vidange enregistrée pour ce véhicule.
                    </div>
                  )}
                </div>

                {/* Section 6: Documents & Attestations */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <span>📑</span> Documents & Attestations
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsDocsModalOpen(true)}
                        className="flex items-center gap-1 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 shadow-2xs transition-colors"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-purple-700" />
                        <span>Pièces Jointes & Photos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNewBcModalOpen(true)}
                        className="flex items-center gap-1 text-xs font-bold text-navy bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-navy" />
                        <span>Nouveau Bon de Commande</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenNewAttestation}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Attestation</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Saved Bons de Commande */}
                    <div className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                      <span>Bons de Commande Enregistrés ({bonsDeCommande.length})</span>
                      {financialSummary && financialSummary.totalBcMad > 0 && (
                        <span className="text-navy font-bold text-xs bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          Total Engagé : {financialSummary.totalBcMad.toLocaleString()} MAD TTC
                        </span>
                      )}
                    </div>

                    {bonsDeCommande.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {bonsDeCommande.map((item: any, idx: number) => {
                          const bc = item.bc;
                          return (
                            <div
                              key={idx}
                              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-navy text-xs">
                                    {bc.bc_number || `BC #${idx + 1}`}
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    · {bc.items?.length || 0} article(s)
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-400">
                                  {bc.date || new Date(item.created_at).toLocaleDateString("fr-FR")} · {bc.supplier_name || "Hard Auto Services"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="font-extrabold text-navy text-xs">
                                  {bc.total_ttc?.toLocaleString() || 0} MAD
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenBc(bc)}
                                  className="px-2 py-1 bg-white hover:bg-navy hover:text-white text-navy font-semibold rounded-lg border border-slate-300 text-[11px] transition-colors flex items-center gap-1 shadow-2xs"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Imprimer</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-2.5 bg-gray-50 rounded-xl text-center text-[11px] text-gray-400">
                        Aucun Bon de Commande enregistré pour ce véhicule.
                      </div>
                    )}

                    {/* Saved Attestations / Inspections */}
                    {attestations.length > 0 && (
                      <div className="pt-2 border-t border-gray-100 space-y-1.5">
                        <span className="text-xs font-semibold text-gray-700 block">
                          Attestations d'Inspection ({attestations.length})
                        </span>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {attestations.map((att: any) => (
                            <div
                              key={att.id}
                              className="p-2 bg-emerald-50/50 border border-emerald-100 rounded-lg text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-emerald-950">
                                  Inspection du {att.date}
                                </span>
                                <p className="text-[10px] text-gray-500">
                                  Inspecteur: {att.inspector} · {att.mileage?.toLocaleString() || 0} KM
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setAttestationData({
                                    ...att.attestationData,
                                    vehicleId: vehicle?.id,
                                  });
                                  setIsAttestationOpen(true);
                                }}
                                className="px-2 py-1 bg-white hover:bg-emerald-700 hover:text-white text-emerald-800 font-semibold rounded-md border border-emerald-200 text-[10px] transition-colors flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Réimprimer</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </form>

        {/* Add Expense Modal */}
        <AddExpenseModal
          isOpen={isAddExpenseOpen}
          onClose={() => setIsAddExpenseOpen(false)}
          onSuccess={() => {
            loadExpenses();
            onSaveSuccess();
          }}
          initialVehicle={vehicle}
        />

        {/* Attestation Modal */}
        {attestationData && (
          <AttestationModal
            data={attestationData}
            isOpen={isAttestationOpen}
            onClose={() => {
              setIsAttestationOpen(false);
              setAttestationData(null);
            }}
            onSaveSuccess={() => {
              onSaveSuccess();
            }}
          />
        )}

        {/* Bon De Commande Modal (View / Print) */}
        {selectedBc && (
          <BonDeCommandeModal
            key={selectedBc.bc_number || "view-bc"}
            isOpen={isBcModalOpen}
            onClose={() => {
              setIsBcModalOpen(false);
              setSelectedBc(null);
            }}
            initialData={selectedBc}
            readOnly={true}
          />
        )}

        {/* New Bon De Commande Modal (Create & Save directly for this Vehicle) */}
        {isNewBcModalOpen && (
          <BonDeCommandeModal
            key={vehicle?.id ? `${vehicle.id}-new-bc` : "new-bc"}
            isOpen={isNewBcModalOpen}
            onClose={() => setIsNewBcModalOpen(false)}
            onSave={handleCreateBcSave}
            initialData={{
              vehicle_plate: plateNumber,
              vehicle_make_model: makeModel,
              vehicle_mileage: currentMileage ? currentMileage.toString() : "",
              vehicle_vin: vin || "",
              date: getFormattedToday(),
            }}
            readOnly={false}
          />
        )}

        {/* Vehicle Documents & Photos Modal */}
        {vehicle && (
          <VehicleDocumentsModal
            isOpen={isDocsModalOpen}
            onClose={() => setIsDocsModalOpen(false)}
            vehicle={vehicle}
            onDocumentsUpdated={(updatedDocs) => {
              if (vehicle) {
                vehicle.documents = JSON.stringify(updatedDocs);
              }
            }}
          />
        )}

        {/* Footer Actions */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="vehicle-form"
            disabled={isSubmitting}
            className="px-5 py-2 bg-navy hover:bg-navy/95 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            {isSubmitting ? "Saving..." : vehicle ? "Update Vehicle" : "Register Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}
