"use client";

/**
 * TicketDrawer Component
 * 
 * A sliding sidebar drawer for Driver Support agents to log support and maintenance requests:
 * - Ticket Types: Vidange, AdBleu, Repair, Accident / Insurance
 * - Vehicle Plate Number & Driver Details
 * - Option to auto-update vehicle status (e.g. to "In garage" or "Accident")
 */

import { useState, useEffect, useRef } from "react";
import { Search, Car, X, Check } from "lucide-react";
import { Vehicle } from "./VehicleDrawer";

export interface MaintenanceTicket {
  id: string;
  vehicle_id: string;
  plate_number: string;
  driver_name: string | null;
  driver_phone: string | null;
  ticket_type: string;
  description: string;
  status: string;
  field_status: string | null;
  priority: string;
  payment_waived: boolean;
  waived_days: number;
  waiver_reason: string | null;
  created_at: string;
  resolved_at: string | null;
}

const TICKET_TYPES = [
  { id: "VEHICLE_RECOVERY", label: "🚨 Blocage Véhicule / Récupération (Vehicle Recovery)", statusImpact: "Blocked" },
  { id: "Vidange", label: "🛢️ Vidange (Oil Change)", statusImpact: "Actif" },
  { id: "AdBleu", label: "💧 AdBleu Refill", statusImpact: "Actif" },
  { id: "Repair", label: "🔧 Repair / Mechanical", statusImpact: "Actif" },
  { id: "Accident", label: "💥 Accident / Insurance", statusImpact: "Accident" },
] as const;

interface TicketDrawerProps {
  vehicle?: Vehicle | null; // Optional vehicle pre-selected
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function TicketDrawer({
  vehicle,
  onClose,
  onSaveSuccess,
}: TicketDrawerProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicle?.id || "");
  const [plateNumber, setPlateNumber] = useState(vehicle?.plate_number || "");
  const [driverName, setDriverName] = useState(vehicle?.assigned_driver_name || "");
  const [driverPhone, setDriverPhone] = useState(vehicle?.assigned_driver_phone || "");
  
  const [ticketType, setTicketType] = useState<string>("Repair");
  const [priority, setPriority] = useState<string>("Normal");
  const [description, setDescription] = useState("");
  const [updateVehicleStatus, setUpdateVehicleStatus] = useState(true);

  // Searchable vehicle selector states
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Fetch vehicles if no pre-selected vehicle was passed
  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await fetch("/api/vehicles");
        const data = await res.json();
        setVehicles(data.vehicles || []);
      } catch (err) {
        console.error("Failed to load vehicles list:", err);
      }
    }
    loadVehicles();
  }, []);

  function handleVehicleSelect(vId: string) {
    setSelectedVehicleId(vId);
    const found = vehicles.find((v) => v.id === vId);
    if (found) {
      setPlateNumber(found.plate_number);
      setDriverName(found.assigned_driver_name || "");
      setDriverPhone(found.assigned_driver_phone || "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    if (!selectedVehicleId || !plateNumber) {
      setErrorMsg("Please select a valid vehicle.");
      return;
    }

    if (!description.trim()) {
      setErrorMsg("Please provide a description for the support ticket.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: selectedVehicleId,
          plate_number: plateNumber,
          driver_name: driverName || null,
          driver_phone: driverPhone || null,
          ticket_type: ticketType,
          priority,
          description,
          update_vehicle_status: updateVehicleStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to log ticket.");
      }

      onSaveSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while logging ticket.");
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
        className={`relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between z-10 transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="bg-navy px-6 py-5 flex items-center justify-between text-white">
          <div>
            <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
              <span>🎧</span> Log Support / Maintenance Ticket
            </h3>
            <p className="text-xs text-white/70 mt-0.5">
              Record incoming driver calls / WhatsApp requests
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
        <form id="ticket-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Vehicle Selection with Search by Immat */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
              <span>Select Vehicle Asset *</span>
              {!vehicle && (
                <span className="text-3xs font-medium text-gray-400">
                  {vehicles.length} véhicules disponibles
                </span>
              )}
            </label>
            {vehicle ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-mono font-bold text-navy flex items-center gap-2">
                <span>🚗</span>
                <span>{vehicle.plate_number} ({vehicle.make_model})</span>
              </div>
            ) : selectedVehicleId && vehicles.find((v) => v.id === selectedVehicleId) ? (
              (() => {
                const selected = vehicles.find((v) => v.id === selectedVehicleId)!;
                return (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-navy bg-white px-2 py-0.5 rounded-lg border border-blue-200 shadow-2xs">
                          🚗 {selected.plate_number}
                        </span>
                        <span className="text-xs font-bold text-gray-800">
                          {selected.make_model}
                        </span>
                      </div>
                      <p className="text-2xs text-gray-500 flex items-center gap-1.5 pt-0.5">
                        <span>📍 {selected.hub_city || "Casablanca"}</span>
                        {selected.assigned_driver_name && (
                          <span>· 👤 {selected.assigned_driver_name}</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicleId("");
                        setPlateNumber("");
                        setVehicleSearch("");
                        setIsDropdownOpen(true);
                      }}
                      className="text-2xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100/60 px-2.5 py-1.5 rounded-xl border border-blue-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      <span>Changer</span>
                    </button>
                  </div>
                );
              })()
            ) : (
              <div ref={dropdownRef} className="relative space-y-1">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Tapez l'immatriculation (ex: WW964984, 21524...)"
                    value={vehicleSearch}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setVehicleSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-navy/30 focus:border-navy focus:outline-none transition-all placeholder:text-gray-400"
                  />
                  {vehicleSearch && (
                    <button
                      type="button"
                      onClick={() => setVehicleSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtered Dropdown List */}
                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto z-50 divide-y divide-gray-100 animate-fadeIn">
                    {(() => {
                      const q = vehicleSearch.toLowerCase().trim();
                      const filtered = vehicles.filter((v) => {
                        if (!q) return true;
                        return (
                          v.plate_number.toLowerCase().includes(q) ||
                          v.make_model.toLowerCase().includes(q) ||
                          (v.hub_city && v.hub_city.toLowerCase().includes(q)) ||
                          (v.assigned_driver_name && v.assigned_driver_name.toLowerCase().includes(q))
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs text-gray-400">
                            Aucun véhicule trouvé pour &quot;{vehicleSearch}&quot;
                          </div>
                        );
                      }

                      return filtered.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            handleVehicleSelect(v.id);
                            setIsDropdownOpen(false);
                            setVehicleSearch("");
                          }}
                          className="w-full p-2.5 text-left hover:bg-blue-50/70 transition-colors flex items-center justify-between cursor-pointer group"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs bg-navy/5 group-hover:bg-navy/10 text-navy px-2 py-0.5 rounded-md border border-navy/10">
                                {v.plate_number}
                              </span>
                              <span className="text-xs font-semibold text-gray-800">
                                {v.make_model}
                              </span>
                            </div>
                            <p className="text-3xs text-gray-500">
                              📍 {v.hub_city || "Casablanca"}
                              {v.assigned_driver_name && ` · 👤 ${v.assigned_driver_name}`}
                            </p>
                          </div>
                          <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {v.status}
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Driver Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Driver Name
              </label>
              <input
                type="text"
                placeholder="Driver full name"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Driver Phone
              </label>
              <input
                type="text"
                placeholder="+212..."
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Ticket Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Request Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TICKET_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTicketType(t.id)}
                  className={`p-2.5 rounded-xl border text-xs text-left font-medium transition-all ${
                    ticketType === t.id
                      ? "border-navy bg-navy/5 text-navy font-bold shadow-xs"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Urgency / Priority
            </label>
            <div className="flex gap-2">
              {["Normal", "Urgent", "Critical"].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    priority === p
                      ? p === "Critical"
                        ? "bg-red-600 text-white border-red-600"
                        : p === "Urgent"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-navy text-white border-navy"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Issue / Request Details *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Describe driver's request, reported noise, oil change milestone, or accident situation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
            />
          </div>

          {/* Auto Vehicle Status Update Option */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-900">
            <input
              type="checkbox"
              id="update-status-check"
              checked={updateVehicleStatus}
              onChange={(e) => setUpdateVehicleStatus(e.target.checked)}
              className="mt-0.5 rounded text-navy focus:ring-navy cursor-pointer"
            />
            <label htmlFor="update-status-check" className="cursor-pointer select-none">
              <span className="font-bold">Auto-update Vehicle Status</span>
              <p className="text-[11px] text-blue-700 mt-0.5">
                Automatically set vehicle status to{" "}
                <span className="font-bold">
                  {ticketType === "Accident" ? '"Accident"' : '"Actif"'}
                </span>{" "}
                to initiate downtime counter tracking.
              </p>
            </label>
          </div>
        </form>

        {/* Footer */}
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
            form="ticket-form"
            disabled={isSubmitting}
            className="px-5 py-2 bg-navy hover:bg-navy/95 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            {isSubmitting ? "Creating..." : "Log Support Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
