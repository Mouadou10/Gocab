"use client";

/**
 * DriverDrawer Component
 *
 * Sliding slide-over drawer to view full driver information,
 * update vehicle assignment, manage arrears & stage, or delete profile.
 */

import { useState, useEffect } from "react";
import {
  X,
  Phone,
  MessageCircle,
  Car,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  Calendar,
  Trash2,
  Save,
  CheckCircle2,
  ArrowRightLeft,
} from "lucide-react";
import toast from "react-hot-toast";

interface Vehicle {
  id: string;
  plate_number: string;
  brand: string;
  model: string;
  year: number;
  current_mileage: number;
  status: string;
}

interface DriverProfile {
  id: string;
  cinNumber: string;
  fullName: string;
  phoneSanitized: string;
  age: number;
  licenseSeniority: number;
  isKycVerified: boolean;
  contractType: string;
  monthlyTripCount: number;
  currentArrearsMAD: number;
  defaultStage: string;
  assignedVehicleId: string | null;
  assignedVehicle?: Vehicle | null;
}

interface DriverDrawerProps {
  driver: DriverProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function DriverDrawer({
  driver,
  isOpen,
  onClose,
  onUpdate,
}: DriverDrawerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cinNumber, setCinNumber] = useState("");
  const [contractType, setContractType] = useState("STANDARD");
  const [assignedVehicleId, setAssignedVehicleId] = useState<string>("");
  const [currentArrearsMAD, setCurrentArrearsMAD] = useState<number>(0);
  const [defaultStage, setDefaultStage] = useState("NOMINAL");
  const [isKycVerified, setIsKycVerified] = useState(true);

  useEffect(() => {
    if (driver) {
      setFullName(driver.fullName || "");
      setPhone(driver.phoneSanitized || "");
      setCinNumber(driver.cinNumber || "");
      setContractType(driver.contractType || "STANDARD");
      setAssignedVehicleId(driver.assignedVehicleId || "");
      setCurrentArrearsMAD(driver.currentArrearsMAD || 0);
      setDefaultStage(driver.defaultStage || "NOMINAL");
      setIsKycVerified(driver.isKycVerified);

      // Fetch available vehicles
      fetch("/api/vehicles")
        .then((res) => res.json())
        .then((data) => {
          if (data.vehicles) {
            setAvailableVehicles(
              data.vehicles.filter(
                (v: Vehicle) =>
                  v.status === "Available" ||
                  v.status === "Disponible" ||
                  v.id === driver.assignedVehicleId
              )
            );
          }
        })
        .catch((err) => console.error("Error fetching vehicles:", err));
    }
  }, [driver]);

  if (!isOpen || !driver) return null;

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/drivers/${driver?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          cinNumber,
          contractType,
          assignedVehicleId: assignedVehicleId || null,
          currentArrearsMAD,
          defaultStage,
          isKycVerified,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur de mise à jour");
        return;
      }

      toast.success("Profil chauffeur mis à jour!");
      onUpdate();
      onClose();
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le profil de ${driver?.fullName} ?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/drivers/${driver?.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Échec de la suppression");
        return;
      }

      toast.success("Chauffeur supprimé avec succès");
      onUpdate();
      onClose();
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsDeleting(false);
    }
  }

  const cleanPhone = driver.phoneSanitized.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-navy/40 backdrop-blur-xs animate-fadeIn">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-6 bg-gradient-to-r from-navy via-[#1e3a5f] to-[#0f1e35] text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{driver.fullName}</h2>
                {driver.isKycVerified && (
                  <span className="p-1 bg-emerald-500/20 text-emerald-300 rounded-full" title="KYC Vérifié">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                )}
              </div>
              <p className="text-xs text-white/70 mt-0.5">{driver.phoneSanitized} · {driver.cinNumber}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Action Contact Bar */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-gray-100">
            <a
              href={`tel:${driver.phoneSanitized}`}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-white text-navy font-semibold text-xs rounded-xl border border-gray-200 shadow-2xs hover:bg-gray-50 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-navy" />
              <span>Appeler</span>
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-2xs transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Assigned Vehicle Card */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-navy" />
                  Véhicule Assigné
                </span>
                {driver.assignedVehicle ? (
                  <span className="text-2xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">
                    Actif sur route
                  </span>
                ) : (
                  <span className="text-2xs font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md">
                    Sans véhicule
                  </span>
                )}
              </div>

              <div>
                <label className="block text-2xs font-semibold text-gray-500 mb-1">
                  Changer le véhicule attribué
                </label>
                <select
                  value={assignedVehicleId}
                  onChange={(e) => setAssignedVehicleId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                >
                  <option value="">-- Aucun véhicule (Chauffeur en attente) --</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number} — {v.brand} {v.model} ({v.current_mileage} km)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Arrears & Stage Status */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Recouvrement & Finance</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-gray-700 mb-1">
                    Impayés (MAD)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={currentArrearsMAD}
                      onChange={(e) => setCurrentArrearsMAD(Number(e.target.value))}
                      className={`w-full px-3 py-2 bg-gray-50 border rounded-xl text-xs font-bold ${
                        currentArrearsMAD > 0 ? "border-amber-400 text-amber-900 bg-amber-50/50" : "border-gray-200"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-gray-700 mb-1">
                    Statut Recouvrement
                  </label>
                  <select
                    value={defaultStage}
                    onChange={(e) => setDefaultStage(e.target.value)}
                    className="w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20"
                  >
                    <option value="NOMINAL">🟢 En règle</option>
                    <option value="DAY_1_WARNING">🟡 Alerte J1</option>
                    <option value="DAY_2_ACTION">🟠 Action J2</option>
                    <option value="DAY_3_BLOCK">🔴 Blocage J3</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Détails du Chauffeur</h3>
              
              <div>
                <label className="block text-2xs font-semibold text-gray-700 mb-1">Nom Complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-semibold text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-gray-700 mb-1">N° CIN</label>
                  <input
                    type="text"
                    value={cinNumber}
                    onChange={(e) => setCinNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-gray-700 mb-1">Type de Contrat</label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                >
                  <option value="STANDARD">STANDARD</option>
                  <option value="PREMIUM">PREMIUM</option>
                  <option value="FLEX">FLEX</option>
                  <option value="PROBATION">PÉRIODE D'ESSAI</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="kyc-toggle"
                  checked={isKycVerified}
                  onChange={(e) => setIsKycVerified(e.target.checked)}
                  className="w-4 h-4 rounded text-navy focus:ring-navy cursor-pointer"
                />
                <label htmlFor="kyc-toggle" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Dossier KYC Vérifié & Conforme
                </label>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
              title="Supprimer le profil chauffeur"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-200/50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 text-gold" />
                <span>{isSaving ? "Enregistrement..." : "Enregistrer"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
