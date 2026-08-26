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

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

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
  "Blocked",
  "In garage",
  "In service",
  "Accident",
  "impounded by police",
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
  driverProfile?: { id: string; fullName: string; phoneSanitized: string } | null;
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
  const [notes, setNotes] = useState(vehicle?.notes || "");

  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

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
  }, [vehicle?.id]);

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
            <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
              <span>🚗</span> {vehicle ? `Edit Vehicle (${vehicle.plate_number})` : "Register New Vehicle"}
            </h3>
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none"
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign Driver
                </label>
                <select
                  value={assignedDriverId}
                  onChange={(e) => setAssignedDriverId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none"
                >
                  <option value="">-- Unassigned --</option>
                  {availableDrivers.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName} ({d.phoneSanitized})
                    </option>
                  ))}
                  {/* Keep the old text-based fallback visible if no driver profile is linked but name exists */}
                  {!assignedDriverId && assignedDriverName && !availableDrivers.find(d => d.fullName === assignedDriverName) && (
                    <option value="" disabled>Legacy: {assignedDriverName}</option>
                  )}
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
          </div>
        </form>

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
