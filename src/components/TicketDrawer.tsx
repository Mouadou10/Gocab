"use client";

/**
 * TicketDrawer Component
 * 
 * A sliding sidebar drawer for Driver Support agents to log support and maintenance requests:
 * - Ticket Types: Vidange, AdBleu, Repair, Accident / Insurance
 * - Vehicle Plate Number & Driver Details
 * - Option to auto-update vehicle status (e.g. to "In garage" or "Accident")
 */

import { useState, useEffect } from "react";
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

  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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

          {/* Vehicle Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select Vehicle Asset *
            </label>
            {vehicle ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-mono font-bold text-navy">
                🚗 {vehicle.plate_number} ({vehicle.make_model})
              </div>
            ) : (
              <select
                value={selectedVehicleId}
                onChange={(e) => handleVehicleSelect(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none bg-white"
              >
                <option value="">-- Choose a Vehicle --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number} - {v.make_model} ({v.hub_city})
                  </option>
                ))}
              </select>
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
