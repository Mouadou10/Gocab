"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Phone,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Trash2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  User,
  ArrowRight,
  ShieldAlert,
  Send,
  Calendar,
} from "lucide-react";

export interface AccidentComment {
  id: string;
  comment: string;
  timeline_step: string;
  author?: string | null;
  created_at: string;
}

export interface AccidentClaim {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  severity: "HARD" | "SOFT" | null;
  fault: "DRIVER" | "THIRD_PARTY" | null;
  timeline_step: "NEW_ACCIDENT" | "CAR_IN_GARAGE" | "STARTING_REPAIR" | "INSURANCE_DOCS" | "READY_FOR_PICKUP" | "VEHICLE_BACK";
  step_updated_at: string;
  created_at: string;
  comments?: string | null;
  vehicle: {
    plate_number: string;
    make_model: string;
  };
  driver?: {
    accidentClaims?: any[];
  } | null;
}

export const TIMELINE_STEPS = [
  {
    id: "NEW_ACCIDENT",
    stepNum: 1,
    shortLabel: "Déclaré",
    label: "Nouveau Sinistre",
    icon: "🚨",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
  },
  {
    id: "CAR_IN_GARAGE",
    stepNum: 2,
    shortLabel: "Garage",
    label: "Entrée Garage",
    icon: "🏬",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "STARTING_REPAIR",
    stepNum: 3,
    shortLabel: "Réparation",
    label: "Travaux en Cours",
    icon: "🔧",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "INSURANCE_DOCS",
    stepNum: 4,
    shortLabel: "Assurance",
    label: "Expertise & Papiers",
    icon: "📄",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    id: "READY_FOR_PICKUP",
    stepNum: 5,
    shortLabel: "Prêt",
    label: "Prêt Récupération",
    icon: "⏳",
    badgeColor: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
  {
    id: "VEHICLE_BACK",
    stepNum: 6,
    shortLabel: "Rétabli",
    label: "Véhicule Rétabli",
    icon: "✅",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
] as const;

/**
 * Moroccan License Plate formatter
 * Renders authentic Moroccan style plate: [ 12345 | أ | 6 ] or [ WW | 964987 ]
 */
function MoroccanPlateBadge({ plate }: { plate: string }) {
  const clean = (plate || "").trim();

  // Provisional WW plate
  if (/^ww/i.test(clean)) {
    const num = clean.replace(/^ww[-–\s]*/i, "");
    return (
      <div className="inline-flex items-center gap-1.5 bg-red-600 text-white font-mono font-black text-xs px-2.5 py-1 rounded-md tracking-wider shadow-2xs border border-red-700">
        <span className="text-[10px] font-extrabold tracking-normal">WW</span>
        <span className="text-white/60">|</span>
        <span>{num}</span>
      </div>
    );
  }

  // Moroccan standard plate (numbers - letter - region)
  const parts = clean.split(/[-–|/\s]+/).filter(Boolean);
  if (parts.length === 3) {
    return (
      <div className="inline-flex items-center bg-gray-950 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-md tracking-wide shadow-2xs border border-gray-800">
        <span className="tracking-wider">{parts[0]}</span>
        <span className="mx-1.5 text-gray-500 font-normal">|</span>
        <span className="text-amber-400 font-black">{parts[1]}</span>
        <span className="mx-1.5 text-gray-500 font-normal">|</span>
        <span className="text-gray-200">{parts[2]}</span>
      </div>
    );
  }

  // Fallback
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-950 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-md tracking-wider shadow-2xs border border-gray-800">
      <span>🚗</span>
      <span>{clean}</span>
    </div>
  );
}

export default function AccidentCard({
  claim,
  onUpdate,
}: {
  claim: AccidentClaim;
  onUpdate: () => void;
}) {
  const { data: session } = useSession() || {};
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  // Comment field & history accordion states
  const [commentText, setCommentText] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Parse comments safely
  let commentsList: AccidentComment[] = [];
  try {
    if (claim.comments) {
      commentsList = JSON.parse(claim.comments);
      if (!Array.isArray(commentsList)) commentsList = [];
    }
  } catch {
    commentsList = [];
  }

  const calculateDays = (dateStr: string) => {
    if (!dateStr) return 0;
    const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysInStatus = calculateDays(claim.step_updated_at);
  const totalDays = calculateDays(claim.created_at);

  const currentStepIndex = TIMELINE_STEPS.findIndex((s) => s.id === claim.timeline_step);
  const currentStepDef = TIMELINE_STEPS[currentStepIndex] || TIMELINE_STEPS[0];
  const isCompleted = claim.timeline_step === "VEHICLE_BACK";

  // Calculate driver history of faults if driver is loaded
  const driverAtFaultCount =
    claim.driver?.accidentClaims?.filter((c: any) => c.fault === "DRIVER").length || 0;

  // Format WhatsApp number
  const getWhatsAppLink = (phone: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (!cleaned) return null;
    // Moroccan phone numbers typically start with 06 or 07
    let full = cleaned;
    if (full.startsWith("0")) {
      full = "212" + full.substring(1);
    } else if (!full.startsWith("212")) {
      full = "212" + full;
    }
    return `https://wa.me/${full}`;
  };

  // Downtime severity styling
  const getDowntimeBadge = (days: number) => {
    if (days <= 3) {
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
        label: `${days}j - Normal`,
      };
    } else if (days <= 7) {
      return {
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
        label: `${days}j - Attention`,
      };
    } else {
      return {
        bg: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500 animate-pulse",
        label: `${days}j - Critique`,
      };
    }
  };

  const downtimeInfo = getDowntimeBadge(totalDays);
  const latestComment = commentsList.length > 0 ? commentsList[0] : null;

  const handleReopen = async () => {
    setIsUpdating(true);
    setIsReopening(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reopen: true,
          timeline_step: "CAR_IN_GARAGE",
          comment: "Dossier accident réouvert par l'agent depuis la flotte.",
          author: agentName,
        }),
      });

      if (res.ok) {
        toast.success("Dossier accident réouvert ! Replacé dans les dossiers en cours.");
        onUpdate();
      } else {
        toast.error("Échec de la réouverture du dossier");
      }
    } catch (err) {
      console.error("Failed to reopen accident ticket:", err);
      toast.error("Erreur lors de la réouverture");
    } finally {
      setIsUpdating(false);
      setIsReopening(false);
    }
  };

  const handleUpdate = async (field: string, value: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast.success("Mise à jour enregistrée");
        onUpdate();
      } else {
        toast.error("Échec de la mise à jour");
      }
    } catch (err) {
      console.error("Failed to update accident claim", err);
      toast.error("Erreur de mise à jour");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveCommentOnly = async () => {
    if (!commentText.trim()) return;
    setIsSavingComment(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: commentText.trim(),
          timeline_step: claim.timeline_step,
          author: agentName,
        }),
      });

      if (res.ok) {
        toast.success(`Note enregistrée pour l'étape ${currentStepDef.shortLabel}`);
        setCommentText("");
        setShowDrawer(true);
        onUpdate();
      } else {
        toast.error("Échec de l'enregistrement de la note");
      }
    } catch (err) {
      console.error("Failed to save comment:", err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSavingComment(false);
    }
  };

  const advanceTimeline = async () => {
    if (currentStepIndex >= TIMELINE_STEPS.length - 1) return;
    const nextStep = TIMELINE_STEPS[currentStepIndex + 1];

    setIsUpdating(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const payload: any = { timeline_step: nextStep.id };

      if (commentText.trim()) {
        payload.comment = commentText.trim();
        payload.author = agentName;
      }

      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          commentText.trim()
            ? `Étape avancée à ${nextStep.shortLabel} avec note enregistrée`
            : `Étape avancée à ${nextStep.shortLabel}`
        );
        setCommentText("");
        onUpdate();
      } else {
        toast.error("Échec du changement d'étape");
      }
    } catch (err) {
      console.error("Failed to advance timeline", err);
      toast.error("Erreur réseau");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStepClick = async (targetStepId: string) => {
    if (targetStepId === claim.timeline_step || isUpdating || isCompleted) return;
    const targetStep = TIMELINE_STEPS.find((s) => s.id === targetStepId);
    if (!targetStep) return;

    setIsUpdating(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const payload: any = { timeline_step: targetStep.id };

      if (commentText.trim()) {
        payload.comment = commentText.trim();
        payload.author = agentName;
      }

      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(`Étape mise à jour vers : ${targetStep.shortLabel}`);
        setCommentText("");
        onUpdate();
      } else {
        toast.error("Échec du changement d'étape");
      }
    } catch (err) {
      console.error("Failed to switch step", err);
      toast.error("Erreur réseau");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/accidents/${claim.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Dossier d'accident supprimé avec succès");
        onUpdate();
      } else {
        toast.error("Échec de la suppression");
      }
    } catch (err) {
      console.error("Error deleting accident", err);
      toast.error("Erreur réseau");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStepBadge = (stepId: string) => {
    const step = TIMELINE_STEPS.find((s) => s.id === stepId);
    return step || { shortLabel: stepId, label: stepId, badgeColor: "bg-gray-100 text-gray-700 border-gray-200" };
  };

  const waLink = getWhatsAppLink(claim.driver_phone);

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-200 overflow-hidden flex flex-col justify-between">
      {/* 1. Header with Moroccan Plate, Model & Downtime Badge */}
      <div>
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-gray-50/70 to-white">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <MoroccanPlateBadge plate={claim.vehicle.plate_number} />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 shadow-2xs">
                <span>💥</span> Sinistre
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
              <span>{claim.vehicle.make_model || "Véhicule"}</span>
              <span className="text-gray-300">•</span>
              <span className="text-2xs font-normal text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" />
                Déclaré le {new Date(claim.created_at).toLocaleDateString("fr-FR")}
              </span>
            </div>
          </div>

          {/* Right Metrics & Delete confirmation */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs ${downtimeInfo.bg}`}
                title={`Immobilisé depuis ${totalDays} jours au total`}
              >
                <span className={`w-2 h-2 rounded-full ${downtimeInfo.dot}`} />
                <span>{downtimeInfo.label}</span>
              </span>

              {/* Delete Record button / Confirmation */}
              {isDeleting ? (
                <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200 animate-fadeIn">
                  <span className="text-3xs font-bold text-red-700 px-1">Supprimer ?</span>
                  <button
                    onClick={handleDelete}
                    disabled={isUpdating}
                    className="text-2xs bg-red-600 text-white font-bold px-2 py-0.5 rounded hover:bg-red-700 cursor-pointer transition-colors"
                  >
                    Oui
                  </button>
                  <button
                    onClick={() => setIsDeleting(false)}
                    className="text-2xs bg-gray-200 text-gray-700 font-medium px-1.5 py-0.5 rounded hover:bg-gray-300 cursor-pointer"
                  >
                    Non
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsDeleting(true)}
                  disabled={isUpdating}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Supprimer ce dossier"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <span className="text-3xs text-gray-500 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-400" />
              Dans cette étape : <strong className="text-gray-700 font-mono">{daysInStatus}j</strong>
            </span>
          </div>
        </div>

        {/* 2. Driver Info & Fast Contact Chips */}
        <div className="px-4 sm:px-5 py-3 bg-gray-50/60 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-gray-900 truncate">
                {claim.driver_name || "Chauffeur non assigné"}
              </div>
              {claim.driver_phone && (
                <div className="text-2xs text-gray-500 font-mono">
                  {claim.driver_phone}
                </div>
              )}
            </div>

            {/* Recidivism pill if driver had prior accidents */}
            {driverAtFaultCount > 0 && (
              <span
                className="ml-1 px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0"
                title={`${driverAtFaultCount} accident(s) précédent(s) avec responsabilité chauffeur`}
              >
                ⚠️ {driverAtFaultCount} sinistre{driverAtFaultCount > 1 ? "s" : ""} répété{driverAtFaultCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Quick Communication Buttons */}
          {claim.driver_phone && (
            <div className="flex items-center gap-1.5">
              <a
                href={`tel:${claim.driver_phone}`}
                className="inline-flex items-center gap-1 text-2xs font-bold bg-white text-navy hover:bg-navy hover:text-white border border-gray-300 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                title="Appeler directement le chauffeur"
              >
                <Phone className="w-3 h-3 text-blue-600" />
                <span>Appeler</span>
              </a>

              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-2xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                  title="Ouvrir WhatsApp direct"
                >
                  <MessageCircle className="w-3 h-3 text-emerald-600" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* 3. Segmented Controls: Severity & Fault */}
        <div className="p-4 sm:p-5 border-b border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Severity Segmented Toggle */}
          <div>
            <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              <span>Gravité des Dommages</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleUpdate("severity", "HARD")}
                disabled={isUpdating || isCompleted}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  claim.severity === "HARD"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <span>🛑</span>
                <span>Lourde (Structure)</span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdate("severity", "SOFT")}
                disabled={isUpdating || isCompleted}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  claim.severity === "SOFT"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <span>⚠️</span>
                <span>Légère (Carrosserie)</span>
              </button>
            </div>
          </div>

          {/* Fault Segmented Toggle */}
          <div>
            <label className="block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Responsabilité du Sinistre</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleUpdate("fault", "DRIVER")}
                disabled={isUpdating || isCompleted}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  claim.fault === "DRIVER"
                    ? "bg-navy text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <span>👤</span>
                <span>Chauffeur</span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdate("fault", "THIRD_PARTY")}
                disabled={isUpdating || isCompleted}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  claim.fault === "THIRD_PARTY"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                }`}
              >
                <span>🚗</span>
                <span>Tiers (Autre)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. Interactive 6-Stage Repair Pipeline Stepper */}
        <div className="p-4 sm:p-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-navy" />
              <span>Pipeline de Réparation & Assurance</span>
            </label>
            <span className="text-2xs font-bold text-navy bg-navy/5 px-2 py-0.5 rounded-md">
              Étape {currentStepIndex + 1} / {TIMELINE_STEPS.length} : {currentStepDef.label}
            </span>
          </div>

          {/* Stepper Graphic with all 6 stages */}
          <div className="relative my-4">
            {/* Background Line */}
            <div className="absolute left-6 right-6 top-3.5 h-1 bg-gray-200 -z-0 rounded-full" />

            {/* Filled Progress Line */}
            <div
              className="absolute left-6 top-3.5 h-1 bg-navy -z-0 rounded-full transition-all duration-500"
              style={{
                width: `calc(${
                  (currentStepIndex / (TIMELINE_STEPS.length - 1)) * 100
                }% - 3rem)`,
              }}
            />

            {/* Stage Nodes */}
            <div className="relative z-10 flex justify-between items-start">
              {TIMELINE_STEPS.map((step, idx) => {
                const isPast = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const isFuture = idx > currentStepIndex;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepClick(step.id)}
                    disabled={isUpdating || isCompleted}
                    className={`flex flex-col items-center group cursor-pointer focus:outline-none ${
                      isCompleted ? "cursor-default" : ""
                    }`}
                    title={`Cliquer pour passer à : ${step.label}`}
                  >
                    {/* Node Circle */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border-2 ${
                        isCurrent
                          ? "bg-navy text-white border-navy ring-4 ring-navy/20 scale-110 shadow-md"
                          : isPast
                          ? "bg-navy text-white border-navy"
                          : "bg-white text-gray-400 border-gray-300 group-hover:border-navy group-hover:text-navy"
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span>{step.stepNum}</span>
                      )}
                    </div>

                    {/* Stage Label Under Node */}
                    <div className="mt-1.5 text-center">
                      <div
                        className={`text-2xs whitespace-nowrap transition-colors ${
                          isCurrent
                            ? "font-extrabold text-navy"
                            : isPast
                            ? "font-semibold text-gray-700"
                            : "font-medium text-gray-400 group-hover:text-gray-600"
                        }`}
                      >
                        {step.shortLabel}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stepper Action Bar */}
          <div className="mt-6 flex justify-end">
            {isCompleted ? (
              <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4" />
                    Véhicule Rétabli en Flotte (Clos)
                  </span>
                  <span className="text-2xs text-gray-500 hidden sm:inline">
                    Le véhicule a repris son service actif.
                  </span>
                </div>

                {/* Reopen Toggle Switch */}
                <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
                  <span className="text-xs font-bold text-gray-700">Rouvrir le dossier</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isReopening}
                    onClick={handleReopen}
                    disabled={isUpdating}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 ${
                      isReopening ? "bg-amber-500" : "bg-gray-300 hover:bg-amber-400"
                    }`}
                    title="Rouvrir le dossier et le renvoyer en atelier de réparation"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isReopening ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : claim.timeline_step === "READY_FOR_PICKUP" ? (
              <div className="w-full flex items-center justify-between p-3 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-xl font-medium text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">⏳</span>
                  <span>
                    <strong>Prêt pour récupération :</strong> En attente du superviseur terrain pour le convoyage.
                  </span>
                </div>
                <button
                  onClick={advanceTimeline}
                  disabled={isUpdating}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold text-xs transition-colors shadow-2xs flex items-center gap-1"
                >
                  <span>Clôturer manuellement</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={advanceTimeline}
                disabled={isUpdating}
                className="w-full sm:w-auto px-6 py-2.5 bg-navy text-white rounded-xl font-bold text-xs hover:bg-navy/90 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {isUpdating
                    ? "Mise à jour..."
                    : commentText.trim()
                    ? `Valider & passer à : ${TIMELINE_STEPS[currentStepIndex + 1]?.shortLabel}`
                    : `Passer à : ${TIMELINE_STEPS[currentStepIndex + 1]?.shortLabel}`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Compact Comments & Activity Drawer */}
      <div className="border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5 space-y-3">
        {/* Accordion Toggle Bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowDrawer(!showDrawer)}
            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity cursor-pointer min-w-0"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800 uppercase tracking-wider">
              <span>💬</span>
              <span>Notes & Suivi Dossier</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-navy/10 text-navy">
              {commentsList.length}
            </span>

            {/* Snippet of latest note if drawer is collapsed */}
            {!showDrawer && latestComment && (
              <span className="text-2xs text-gray-500 font-normal italic truncate max-w-xs hidden md:inline ml-2">
                &ldquo;{latestComment.comment}&rdquo;
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowDrawer(!showDrawer)}
            className="flex items-center gap-1 text-2xs font-bold text-navy hover:text-navy/80 px-2 py-1 rounded-lg hover:bg-navy/5 transition-colors cursor-pointer shrink-0"
          >
            <span>{showDrawer ? "Masquer" : "Afficher l'historique"}</span>
            {showDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Quick Comment Input (Always accessible or inside drawer) */}
        <div className="bg-white rounded-xl border border-gray-200 p-2.5 sm:p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-3xs font-bold text-gray-500 uppercase tracking-wider">
            <span>
              Note pour l&apos;étape :{" "}
              <strong className="text-navy">{currentStepDef.shortLabel}</strong>
            </span>
            {session?.user?.name && (
              <span className="text-gray-400 font-normal">
                Auteur : {session.user.name}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <textarea
              rows={showDrawer ? 2 : 1}
              placeholder={`Ajouter une note ou devis pour ${currentStepDef.shortLabel}...`}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={isSavingComment || isUpdating}
              className="flex-1 text-xs text-gray-800 placeholder-gray-400 bg-gray-50/50 border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy focus:bg-white transition-all resize-none"
            />
            <button
              type="button"
              onClick={handleSaveCommentOnly}
              disabled={!commentText.trim() || isSavingComment || isUpdating}
              className="px-3.5 bg-navy hover:bg-navy/90 text-white font-bold text-xs rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-all shrink-0 cursor-pointer shadow-2xs"
              title="Enregistrer cette note dans l'historique"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isSavingComment ? "..." : "Enregistrer"}
              </span>
            </button>
          </div>
        </div>

        {/* Expanded History Drawer */}
        {showDrawer && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            {commentsList.length === 0 ? (
              <div className="text-2xs text-gray-400 italic bg-white rounded-xl border border-dashed border-gray-200 p-3 text-center">
                Aucune note enregistrée pour ce dossier d&apos;accident.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                {commentsList.map((c) => {
                  const badge = getStepBadge(c.timeline_step);
                  return (
                    <div
                      key={c.id}
                      className="bg-white border border-gray-200 rounded-xl p-2.5 sm:p-3 shadow-2xs space-y-1 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.badgeColor}`}
                          >
                            {badge.shortLabel}
                          </span>
                          {c.author && (
                            <span className="text-2xs font-bold text-gray-700 flex items-center gap-1">
                              <span>👤</span> {c.author}
                            </span>
                          )}
                        </div>
                        <span className="text-3xs text-gray-400 font-mono">
                          {new Date(c.created_at).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap pl-0.5">
                        {c.comment}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
