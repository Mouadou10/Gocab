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
  Flag,
  MessageSquare,
  Send,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import WhatsAppDirectModal from "./WhatsAppDirectModal";
import RedFlagBadge from "./RedFlagBadge";

export interface Vehicle {
  id: string;
  plate_number: string;
  brand: string;
  model: string;
  make_model?: string;
  year: number;
  current_mileage: number;
  status: string;
}

export interface DriverProfile {
  consecutiveUnpaidDays?: number;
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
  isRedFlagged?: boolean;
  redFlagReason?: string | null;
  redFlaggedAt?: string | null;
  redFlaggedBy?: string | null;
  comments?: Array<{
    id: string;
    driverId?: string;
    authorName: string;
    authorRole?: string | null;
    content: string;
    createdAt: string;
  }>;
  _count?: {
    comments: number;
  };
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
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cinNumber, setCinNumber] = useState("");
  const [contractType, setContractType] = useState("STANDARD");
  const [assignedVehicleId, setAssignedVehicleId] = useState<string>("");
  const [currentArrearsMAD, setCurrentArrearsMAD] = useState<number>(0);
  const [defaultStage, setDefaultStage] = useState("NOMINAL");
  const [isKycVerified, setIsKycVerified] = useState(true);

  // Red Flag & Team Comments
  const [isRedFlagged, setIsRedFlagged] = useState(false);
  const [redFlagReason, setRedFlagReason] = useState("");
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagModalReason, setFlagModalReason] = useState("");
  const [isTogglingFlag, setIsTogglingFlag] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

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
      setIsRedFlagged(Boolean(driver.isRedFlagged));
      setRedFlagReason(driver.redFlagReason || "");
      setComments(driver.comments || []);

      // Fetch latest comments
      fetch(`/api/drivers/${driver.id}/comments`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.comments)) {
            setComments(data.comments);
          }
        })
        .catch(() => {});

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

  async function handleApplyFlag(reasonToApply?: string) {
    if (!driver) return;
    setIsTogglingFlag(true);
    const chosenReason = reasonToApply || flagModalReason || "Signalé par le gestionnaire de flotte";
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isRedFlagged: true,
          redFlagReason: chosenReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur de signalement");
        return;
      }
      setIsRedFlagged(true);
      setRedFlagReason(chosenReason);
      setIsFlagModalOpen(false);
      setFlagModalReason("");
      toast.success("🚩 Chauffeur signalé (Red Flag) !");
      onUpdate();
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsTogglingFlag(false);
    }
  }

  async function handleRemoveFlag() {
    if (!driver) return;
    if (!confirm(`Retirer le signalement (Red Flag) pour ${driver.fullName} ?`)) {
      return;
    }
    setIsTogglingFlag(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isRedFlagged: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      setIsRedFlagged(false);
      setRedFlagReason("");
      toast.success("Signalement Red Flag retiré");
      onUpdate();
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsTogglingFlag(false);
    }
  }

  async function handleAddComment() {
    if (!driver || !newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur d'ajout de note");
        return;
      }
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
        toast.success("Commentaire ajouté");
        onUpdate();
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmittingComment(false);
    }
  }

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
            <div className="flex-1 mr-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{driver.fullName}</h2>
                {isRedFlagged && (
                  <RedFlagBadge reason={redFlagReason} />
                )}
                {driver.isKycVerified && (
                  <span className="p-1 bg-emerald-500/20 text-emerald-300 rounded-full" title="KYC Vérifié">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                )}
                {/* Red Flag Toggle Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isRedFlagged) {
                      handleRemoveFlag();
                    } else {
                      setIsFlagModalOpen(true);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isRedFlagged
                      ? "bg-rose-500 text-white shadow-md shadow-rose-950/40 hover:bg-rose-600 ring-2 ring-rose-300"
                      : "bg-white/10 hover:bg-rose-500/30 text-white/90 hover:text-white border border-white/20"
                  }`}
                  title={isRedFlagged ? "Chauffeur signalé (Red Flag) · Cliquez pour retirer" : "Signaler ce chauffeur (Red Flag)"}
                >
                  <Flag className={`w-3.5 h-3.5 ${isRedFlagged ? "fill-white text-white" : "text-rose-400"}`} />
                  <span>{isRedFlagged ? "🚩 Red Flagged" : "🚩 Red Flag"}</span>
                </button>
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
            <button
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
              title="Envoyer un WhatsApp direct depuis le CRM"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Direct</span>
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Red Flag Warning Banner */}
            {isRedFlagged && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 shadow-2xs animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-500 text-white rounded-xl shadow-xs shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black uppercase tracking-wider text-rose-900">Chauffeur Signalé (Red Flag)</p>
                      <RedFlagBadge reason={redFlagReason} />
                    </div>
                    <p className="text-xs font-bold text-rose-800 mt-1">{redFlagReason || "Signalé par le gestionnaire de flotte"}</p>
                    {(driver.redFlaggedBy || driver.redFlaggedAt) && (
                      <p className="text-3xs text-rose-600 mt-1 font-medium">
                        Signalé {driver.redFlaggedBy ? `par ${driver.redFlaggedBy}` : ""} {driver.redFlaggedAt ? `le ${new Date(driver.redFlaggedAt).toLocaleDateString("fr-FR")}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFlag}
                  disabled={isTogglingFlag}
                  className="px-2.5 py-1.5 bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 text-2xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs shrink-0"
                  title="Retirer le signalement Red Flag"
                >
                  {isTogglingFlag ? "..." : "Retirer"}
                </button>
              </div>
            )}
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

              {/* Payment / Contract Type */}
              <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/70 space-y-2">
                <label className="block text-2xs font-bold uppercase tracking-wider text-blue-900">
                  Type de Paiement / Formule Contrat
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setContractType("DAILY")}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all flex flex-col items-center gap-0.5 ${
                      contractType === "DAILY" || contractType === "STANDARD"
                        ? "bg-navy text-white border-navy shadow-xs"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span>📅 Journalier (DAILY)</span>
                    <span className={`text-3xs font-normal ${contractType === "DAILY" || contractType === "STANDARD" ? "text-gold" : "text-gray-500"}`}>
                      300 MAD / jour (Lun-Sam)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContractType("WEEKLY")}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all flex flex-col items-center gap-0.5 ${
                      contractType === "WEEKLY"
                        ? "bg-navy text-white border-navy shadow-xs"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <span>🗓️ Hebdo (WEEKLY)</span>
                    <span className={`text-3xs font-normal ${contractType === "WEEKLY" ? "text-gold" : "text-gray-500"}`}>
                      1 800 MAD chaque Lundi
                    </span>
                  </button>
                </div>
              </div>

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

            {/* Team Comments & Collaboration */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-navy" />
                  Commentaires Équipe ({comments.length})
                </span>
                <span className="text-3xs font-semibold text-slate-500">Historique partagé</span>
              </div>

              {/* Add Comment */}
              <div className="space-y-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Laisser un commentaire ou une observation sur ce chauffeur..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={isSubmittingComment || !newComment.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-xl hover:bg-navy/90 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <Send className="w-3 h-3 text-gold" />
                    <span>{isSubmittingComment ? "Envoi..." : "Publier commentaire"}</span>
                  </button>
                </div>
              </div>

              {/* Comments Feed */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-center py-2 text-3xs text-slate-400 font-medium">
                    Aucun commentaire pour le moment.
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-bold text-slate-800">{c.authorName}</span>
                        <span className="text-3xs text-slate-400">
                          {new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))
                )}
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

      {/* Red Flag Confirmation & Reason Modal */}
      {isFlagModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-100 text-rose-600 rounded-xl">🚩</span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Signaler ce Chauffeur (Red Flag)</h3>
                  <p className="text-2xs text-gray-500 font-medium">{driver.fullName} · {driver.cinNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFlagModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-2xs font-bold uppercase tracking-wider text-gray-600">
                Motifs fréquents (cliquez pour sélectionner) :
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Arriérés impayés récurrents",
                  "Véhicule non restitué / Introuvable",
                  "Conduite dangereuse / Infraction grave",
                  "Injoignable / Contact rompu",
                  "Comportement agressif / Litige",
                  "Défaut documents / Faux permis",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFlagModalReason(reason)}
                    className={`px-2.5 py-1 rounded-lg text-2xs font-semibold transition-all cursor-pointer ${
                      flagModalReason === reason
                        ? "bg-rose-500 text-white shadow-xs"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Précisions / Motif détaillé :
                </label>
                <textarea
                  value={flagModalReason}
                  onChange={(e) => setFlagModalReason(e.target.value)}
                  placeholder="Précisez la raison du signalement pour l'équipe..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsFlagModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleApplyFlag()}
                disabled={isTogglingFlag}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5 fill-white" />
                <span>{isTogglingFlag ? "Enregistrement..." : "Confirmer le Red Flag"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <WhatsAppDirectModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        target={{
          phoneNumber: driver.phoneSanitized,
          contactName: driver.fullName,
          contactType: "DRIVER",
          plateNumber: driver.assignedVehicle?.plate_number,
          arrearsMAD: driver.currentArrearsMAD,
          unpaidDays: driver.consecutiveUnpaidDays,
          defaultMessage: `Bonjour ${driver.fullName},\n\nNous vous contactons depuis le siège GoCab (${driver.assignedVehicle?.plate_number ? `véhicule ${driver.assignedVehicle.plate_number}` : "votre contrat"}).\n\nL'équipe GoCab Operations.`,
        }}
        onOpenFullChat={(phone) => {
          try {
            localStorage.setItem("gocab_target_whatsapp_phone", phone);
          } catch (e) {}
          onClose();
          window.dispatchEvent(new CustomEvent("gocab_navigate_tab", { detail: "whatsapp" }));
        }}
      />
    </div>
  );
}

