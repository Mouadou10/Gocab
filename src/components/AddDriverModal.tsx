"use client";

/**
 * AddDriverModal Component
 *
 * Form modal to manually create a new DriverProfile with vehicle assignment.
 */

import { useState, useEffect } from "react";
import { UserPlus, X, Car, Phone, ShieldCheck, CreditCard, Hash, Calendar } from "lucide-react";
import toast from "react-hot-toast";

interface VehicleOption {
  id: string;
  plate_number: string;
  brand: string;
  model: string;
  status: string;
}

interface AddDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddDriverModal({
  isOpen,
  onClose,
  onSuccess,
}: AddDriverModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cinNumber, setCinNumber] = useState("");
  const [age, setAge] = useState<number>(28);
  const [licenseSeniority, setLicenseSeniority] = useState<number>(3);
  const [contractType, setContractType] = useState("STANDARD");
  const [assignedVehicleId, setAssignedVehicleId] = useState("");
  const [currentArrearsMAD, setCurrentArrearsMAD] = useState<number>(0);
  const [defaultStage, setDefaultStage] = useState("NOMINAL");

  useEffect(() => {
    if (isOpen) {
      // Fetch available vehicles
      fetch("/api/vehicles")
        .then((res) => res.json())
        .then((data) => {
          if (data.vehicles) {
            setVehicles(data.vehicles.filter((v: any) => v.status === "Available" || v.status === "Disponible"));
          }
        })
        .catch((err) => console.error("Error fetching vehicles:", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim() || !phone.trim()) {
      toast.error("Veuillez renseigner le nom et le téléphone");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          cinNumber,
          age,
          licenseSeniority,
          contractType,
          assignedVehicleId: assignedVehicleId || null,
          currentArrearsMAD,
          defaultStage,
          isKycVerified: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Échec de l'ajout du chauffeur");
        return;
      }

      toast.success(`Chauffeur ${fullName} ajouté avec succès!`);
      onSuccess();
      onClose();

      // Reset form
      setFullName("");
      setPhone("");
      setCinNumber("");
      setAge(28);
      setLicenseSeniority(3);
      setContractType("STANDARD");
      setAssignedVehicleId("");
      setCurrentArrearsMAD(0);
      setDefaultStage("NOMINAL");
    } catch (err: any) {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy via-[#1e3a5f] to-[#0f1e35] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <UserPlus className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Nouveau Profil Chauffeur</h3>
              <p className="text-xs text-white/70">Créer et enregistrer un chauffeur dans la flotte GoCab</p>
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
          {/* Personal Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Informations Personnelles</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nom Complet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Karim Benali"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="06 12 34 56 78"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  N° CIN / CNIE
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Ex: BE123456"
                    value={cinNumber}
                    onChange={(e) => setCinNumber(e.target.value.toUpperCase())}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Âge
                </label>
                <input
                  type="number"
                  min="21"
                  max="70"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ancienneté Permis (Ans)
                </label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  value={licenseSeniority}
                  onChange={(e) => setLicenseSeniority(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Operational & Contract Status */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Contrat & Véhicule</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Formule Contrat / Type de Paiement
                </label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                >
                  <option value="DAILY">📅 Journalier — 300 MAD / jour (Lun-Sam)</option>
                  <option value="WEEKLY">🗓️ Hebdomadaire — 1 800 MAD chaque Lundi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Véhicule Assigné (Optionnel)
                </label>
                <div className="relative">
                  <Car className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <select
                    value={assignedVehicleId}
                    onChange={(e) => setAssignedVehicleId(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  >
                    <option value="">-- Aucun véhicule assigné --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate_number} — {v.brand} {v.model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Impayés initiaux (MAD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={currentArrearsMAD}
                  onChange={(e) => setCurrentArrearsMAD(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Statut / Étape Recouvrement
                </label>
                <select
                  value={defaultStage}
                  onChange={(e) => setDefaultStage(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                >
                  <option value="NOMINAL">🟢 NOMINAL (En règle)</option>
                  <option value="DAY_1_WARNING">🟡 DAY 1 WARNING (Alerte J1)</option>
                  <option value="DAY_2_ACTION">🟠 DAY 2 ACTION (Action J2)</option>
                  <option value="DAY_3_BLOCK">🔴 DAY 3 BLOCK (Blocage véhicule)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
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
                  <UserPlus className="w-4 h-4 text-gold" />
                  <span>Créer le chauffeur</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
