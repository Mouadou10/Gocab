"use client";

/**
 * AddExpenseModal Component
 *
 * Form modal to log a financial expense or fee on a vehicle at any time:
 * - When retrieving a car from repair (garage) or police impoundment (fourrière)
 * - Or general fleet costs (vidange, tires, towing, administrative)
 * - Supports 0 MAD amounts (warranties, free release) and driver recharge.
 */

import { useState, useEffect } from "react";
import {
  DollarSign,
  X,
  Car,
  Wrench,
  ShieldAlert,
  Calendar,
  Receipt,
  FileText,
  Building,
  User,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";
import toast from "react-hot-toast";

export const EXPENSE_CATEGORIES = [
  { key: "REPAIR", label: "🔧 Réparation / Garage", group: "Maintenance & Réparations" },
  { key: "POLICE", label: "🚔 Fourrière / Amende Police", group: "Incidents & Infractions" },
  { key: "MAINTENANCE", label: "🛢️ Entretien Régulier (Vidange/Filtres)", group: "Maintenance & Réparations" },
  { key: "ACCIDENT", label: "💥 Sinistre / Carrosserie", group: "Incidents & Infractions" },
  { key: "TOWING", label: "🚛 Remorquage / Dépannage", group: "Assistance" },
  { key: "PARKING", label: "🅿️ Gardiennage / Stationnement", group: "Exploitation" },
  { key: "TIRES", label: "🛞 Pneumatiques", group: "Maintenance & Réparations" },
  { key: "ADMINISTRATIVE", label: "📄 Administratif / Vignette / Visite", group: "Réglementaire" },
  { key: "OTHER", label: "❓ Autre Frais", group: "Divers" },
] as const;

interface VehicleOption {
  id: string;
  plate_number: string;
  brand?: string;
  model?: string;
  make_model?: string;
  status: string;
  assigned_driver_name?: string | null;
}

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialVehicle?: VehicleOption | null;
  initialCategory?: string;
}

export default function AddExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  initialVehicle,
  initialCategory = "REPAIR",
}: AddExpenseModalProps) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [vehicleId, setVehicleId] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [amountMAD, setAmountMAD] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paidBy, setPaidBy] = useState<"COMPANY" | "DRIVER" | "INSURANCE">("COMPANY");
  const [isRechargeable, setIsRechargeable] = useState(false);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [newVehicleStatus, setNewVehicleStatus] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      // Fetch vehicles for selection
      fetch("/api/vehicles")
        .then((res) => res.json())
        .then((data) => {
          if (data.vehicles) setVehicles(data.vehicles);
        })
        .catch((err) => console.error("Failed to load vehicles:", err));

      if (initialVehicle) {
        setVehicleId(initialVehicle.id);
      }
      if (initialCategory) {
        setCategory(initialCategory);
      }
    }
  }, [isOpen, initialVehicle, initialCategory]);

  if (!isOpen) return null;

  const selectedVehicleObj = vehicles.find((v) => v.id === vehicleId) || initialVehicle;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!vehicleId && !selectedVehicleObj) {
      toast.error("Veuillez sélectionner un véhicule");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create the Expense Record
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          plate_number: selectedVehicleObj?.plate_number,
          category,
          amount_mad: amountMAD,
          description,
          invoice_number: invoiceNumber,
          paid_by: paidBy,
          is_rechargeable: isRechargeable,
          paid_at: paidAt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Échec de l'enregistrement du frais");
        return;
      }

      // 2. Optionally update vehicle status if specified (e.g. from In garage -> Available)
      if (newVehicleStatus && vehicleId) {
        await fetch(`/api/vehicles/${vehicleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newVehicleStatus }),
        });
      }

      toast.success(
        amountMAD === 0
          ? `Frais enregistré (0 MAD - Pris en charge / Gratuit)`
          : `Frais de ${amountMAD.toLocaleString()} MAD enregistré avec succès!`
      );

      onSuccess();
      onClose();

      // Reset form
      setAmountMAD(0);
      setDescription("");
      setInvoiceNumber("");
      setIsRechargeable(false);
      setNewVehicleStatus("");
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy via-[#1e3a5f] to-[#0f1e35] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <DollarSign className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Enregistrer un Frais Véhicule</h3>
              <p className="text-xs text-white/70">Réparation, fourrière police, entretien ou dépenses flotte</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Vehicle Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Véhicule Concerné <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Car className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <select
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              >
                <option value="">-- Choisir un véhicule --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number} — {v.make_model || `${v.brand || ""} ${v.model || ""}`} ({v.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Dropdown (DD List) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Catégorie de Frais (DD List) <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy font-medium"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Amount in MAD */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700">
                Montant Payé (MAD) <span className="text-red-500">*</span>
              </label>
              <span className="text-2xs text-gray-400 font-medium">Peut être 0 MAD (ex: garantie, gratuité)</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={amountMAD}
                onChange={(e) => setAmountMAD(parseFloat(e.target.value) || 0)}
                className="w-full pl-3.5 pr-14 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              />
              <span className="absolute right-3.5 top-3 text-xs font-bold text-gray-400">MAD</span>
            </div>
          </div>

          {/* Description & Garage */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Détails & Garage / Motif
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Ex: Changement plaquettes garage Dacia, Fourrière Ain Sebaa..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              />
            </div>
          </div>

          {/* Grid: Invoice # and Payment Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                N° Facture / Reçu
              </label>
              <div className="relative">
                <Receipt className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="FAC-2026-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Date de Paiement
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                />
              </div>
            </div>
          </div>

          {/* Paid By & Driver Recharge */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70 space-y-2.5">
            <label className="block text-2xs font-bold uppercase tracking-wider text-gray-500">
              Prise en charge financière
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPaidBy("COMPANY")}
                className={`py-1.5 px-2 rounded-xl border text-center font-medium transition-all ${
                  paidBy === "COMPANY"
                    ? "bg-navy text-white border-navy shadow-2xs font-bold"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
              >
                🏢 GoCab
              </button>
              <button
                type="button"
                onClick={() => setPaidBy("DRIVER")}
                className={`py-1.5 px-2 rounded-xl border text-center font-medium transition-all ${
                  paidBy === "DRIVER"
                    ? "bg-navy text-white border-navy shadow-2xs font-bold"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
              >
                👤 Chauffeur
              </button>
              <button
                type="button"
                onClick={() => setPaidBy("INSURANCE")}
                className={`py-1.5 px-2 rounded-xl border text-center font-medium transition-all ${
                  paidBy === "INSURANCE"
                    ? "bg-navy text-white border-navy shadow-2xs font-bold"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
              >
                🛡️ Assurance
              </button>
            </div>

            {paidBy === "COMPANY" && amountMAD > 0 && (
              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="recharge-toggle"
                  checked={isRechargeable}
                  onChange={(e) => setIsRechargeable(e.target.checked)}
                  className="w-4 h-4 rounded text-navy focus:ring-navy cursor-pointer"
                />
                <label htmlFor="recharge-toggle" className="text-xs text-gray-700 cursor-pointer">
                  Recharger ce montant au compte du chauffeur (ajouter aux impayés)
                </label>
              </div>
            )}
          </div>

          {/* Optional: Update vehicle status upon car recovery */}
          {selectedVehicleObj && (selectedVehicleObj.status === "In garage" || selectedVehicleObj.status === "impounded by police" || selectedVehicleObj.status === "Accident") && (
            <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 space-y-1.5">
              <label className="block text-xs font-bold text-blue-900">
                🔄 Mise à jour du statut du véhicule (Récupération)
              </label>
              <select
                value={newVehicleStatus}
                onChange={(e) => setNewVehicleStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs text-blue-950 font-medium"
              >
                <option value="">Conserver le statut actuel ({selectedVehicleObj.status})</option>
                <option value="Available">🟢 Remettre en service : Disponible (Available)</option>
                <option value="Actif">🔵 Remettre en service : Actif sur route (Actif)</option>
              </select>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-navy hover:bg-navy/90 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 text-gold" />
                  <span>Enregistrer le frais</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
