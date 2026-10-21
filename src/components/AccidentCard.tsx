"use client";

import { useState, useEffect, useRef } from "react";
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
  X,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Download,
  Eye,
  UploadCloud,
  ExternalLink,
  Plus,
} from "lucide-react";
import RedFlagBadge from "./RedFlagBadge";

export interface AccidentComment {
  id: string;
  timeline_step: string;
  comment?: string;
  author?: string | null;
  created_at: string;
  [key: string]: any;
}

export interface InsuranceNoteItem {
  id: string;
  note: string;
  author: string;
  created_at: string;
}

export interface InsuranceDossierInfo {
  claim_number?: string;
  insurance_company?: string;
  garage_name?: string;
  policy_number?: string;
  claim_status?: string;
  declaration_date?: string;
  expert_name?: string;
  expert_phone?: string;
  expertise_date?: string;
  estimated_amount?: number;
  covered_amount?: number;
  franchise_amount?: number;
  payout_status?: string;
  insurance_notes?: InsuranceNoteItem[];
  updated_at?: string;
  updated_by?: string;
}

export interface AccidentDocument {
  id: string;
  name: string;
  fileUrl: string; // Base64 data URL
  fileType: string; // e.g. "application/pdf", "image/jpeg", "image/png"
  category: "CONSTAT" | "DEVIS" | "PHOTOS" | "EXPERTISE" | "FACTURE" | "AUTRE";
  stage: string; // e.g. "NEW_ACCIDENT", "CAR_IN_GARAGE", etc.
  size?: number | null;
  author?: string | null;
  created_at: string;
}

export const DOCUMENT_CATEGORIES = [
  { id: "CONSTAT", label: "Constat Amiable", icon: "📝", badgeColor: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "DEVIS", label: "Devis Réparation", icon: "📋", badgeColor: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "PHOTOS", label: "Photos Sinistre", icon: "📸", badgeColor: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "EXPERTISE", label: "Rapport d'Expertise", icon: "🔍", badgeColor: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "FACTURE", label: "Facture / Quittance", icon: "🧾", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "AUTRE", label: "Autre Document", icon: "📁", badgeColor: "bg-gray-100 text-gray-700 border-gray-200" },
] as const;

export interface AccidentClaim {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  is_driver_red_flagged?: boolean;
  driver_red_flag_reason?: string | null;
  severity: "HARD" | "SOFT" | null;
  fault: "DRIVER" | "THIRD_PARTY" | null;
  timeline_step: "NEW_ACCIDENT" | "CAR_IN_GARAGE" | "STARTING_REPAIR" | "INSURANCE_DOCS" | "READY_FOR_PICKUP" | "VEHICLE_BACK";
  step_updated_at: string;
  created_at: string;
  comments?: string | null;
  documents?: string | null;
  vehicle: {
    plate_number: string;
    make_model: string;
  };
  driver?: {
    isRedFlagged?: boolean;
    redFlagReason?: string | null;
    accidentClaims?: any[];
  } | null;
  fieldTask?: {
    id: string;
    task_type: string;
    status: string;
    priority: string;
    description: string;
    assigned_to?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    created_at: string;
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

  // Telegram Mission modal states
  const [openTelegramModal, setOpenTelegramModal] = useState(false);
  const [missionTaskType, setMissionTaskType] = useState<"GARAGE_PICKUP" | "VEHICLE_RECOVERY" | "FIELD_VISIT">(
    claim.timeline_step === "READY_FOR_PICKUP" || claim.timeline_step === "CAR_IN_GARAGE" || claim.timeline_step === "STARTING_REPAIR"
      ? "GARAGE_PICKUP"
      : "VEHICLE_RECOVERY"
  );
  const [missionPriority, setMissionPriority] = useState<"Normal" | "Urgent" | "Critical">("Urgent");
  const [missionAssignedTo, setMissionAssignedTo] = useState(claim.fieldTask?.assigned_to || "");
  const [supervisorsList, setSupervisorsList] = useState<string[]>([
    "HAMZA RASSID",
    "Ayoub Rassid",
    "Mohamed Abed",
  ]);
  const [missionDescription, setMissionDescription] = useState("");
  const [missionScheduledDate, setMissionScheduledDate] = useState("");
  const [missionScheduledTime, setMissionScheduledTime] = useState("");
  const [missionSendTelegram, setMissionSendTelegram] = useState(true);
  const [isSubmittingMission, setIsSubmittingMission] = useState(false);
  const [isSendingReadyTelegram, setIsSendingReadyTelegram] = useState(false);

  // Document states
  const [showDocsDrawer, setShowDocsDrawer] = useState(true);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<
    "CONSTAT" | "DEVIS" | "PHOTOS" | "EXPERTISE" | "FACTURE" | "AUTRE"
  >("DEVIS");
  const [previewDoc, setPreviewDoc] = useState<AccidentDocument | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [isUploadBoxOpen, setIsUploadBoxOpen] = useState(false);
  const [filterDocCategory, setFilterDocCategory] = useState<string>("ALL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch field supervisors for mission assignment
  useEffect(() => {
    async function fetchSupervisors() {
      try {
        const res = await fetch("/api/field-supervisors");
        if (res.ok) {
          const data = await res.json();
          const names = (data.supervisors || [])
            .map((s: any) => s.fullName || s.name)
            .filter(Boolean);
          if (names.length > 0) {
            setSupervisorsList(Array.from(new Set(["HAMZA RASSID", "Ayoub Rassid", "Mohamed Abed", ...names])));
          }
        }
      } catch (e) {
        // Fallback default list remains
      }
    }
    fetchSupervisors();
  }, []);

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

  // Parse documents safely
  let documentsList: AccidentDocument[] = [];
  try {
    if (claim.documents) {
      documentsList = JSON.parse(claim.documents);
      if (!Array.isArray(documentsList)) documentsList = [];
    }
  } catch {
    documentsList = [];
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

  const handleDispatchMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingMission(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DISPATCH_TELEGRAM_MISSION",
          task_type: missionTaskType,
          priority: missionPriority,
          assigned_to: missionAssignedTo.trim() || null,
          description:
            missionDescription.trim() ||
            `[Sinistre ${claim.vehicle.plate_number}] Prise en charge terrain requise pour le véhicule.`,
          scheduled_date: missionScheduledDate || null,
          scheduled_time: missionScheduledTime || null,
          send_telegram: missionSendTelegram,
          author: agentName,
        }),
      });

      if (res.ok) {
        toast.success(
          missionSendTelegram
            ? "🚀 Mission terrain créée & notifiée sur Telegram !"
            : "📋 Mission terrain créée avec succès !"
        );
        setOpenTelegramModal(false);
        onUpdate();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Échec de la création de la mission");
      }
    } catch (err) {
      console.error("Error creating telegram mission:", err);
      toast.error("Erreur réseau");
    } finally {
      setIsSubmittingMission(false);
    }
  };

  const handleResendReadyTelegram = async () => {
    setIsSendingReadyTelegram(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "NOTIFY_READY_TELEGRAM",
          author: agentName,
          comment: "Rappel : Véhicule réparé au garage et prêt pour récupération & convoyage.",
        }),
      });

      if (res.ok) {
        toast.success("📱 Alerte 'Véhicule Prêt' renvoyée avec succès sur Telegram !");
        onUpdate();
      } else {
        toast.error("Échec de l'envoi de l'alerte Telegram");
      }
    } catch (err) {
      console.error("Failed to notify telegram:", err);
      toast.error("Erreur réseau");
    } finally {
      setIsSendingReadyTelegram(false);
    }
  };

  const advanceTimeline = async () => {
    if (currentStepIndex >= TIMELINE_STEPS.length - 1) return;
    const nextStep = TIMELINE_STEPS[currentStepIndex + 1];

    setIsUpdating(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const payload: any = {
        timeline_step: nextStep.id,
        author: agentName,
      };

      if (commentText.trim()) {
        payload.comment = commentText.trim();
      }

      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (nextStep.id === "VEHICLE_BACK") {
          toast.success("✅ Véhicule rétabli en flotte & alerte 'Mission Complete' envoyée sur Telegram !");
        } else if (nextStep.id === "READY_FOR_PICKUP") {
          toast.success(
            commentText.trim()
              ? "🚗 Véhicule marqué prêt & alerte Telegram envoyée avec note !"
              : "🚗 Véhicule marqué prêt & alerte Telegram envoyée au Superviseur Terrain !"
          );
        } else {
          toast.success(
            commentText.trim()
              ? `Étape avancée à ${nextStep.shortLabel} avec note enregistrée`
              : `Étape avancée à ${nextStep.shortLabel}`
          );
        }
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
      const payload: any = {
        timeline_step: targetStep.id,
        author: agentName,
      };

      if (commentText.trim()) {
        payload.comment = commentText.trim();
      }

      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (targetStep.id === "VEHICLE_BACK") {
          toast.success("✅ Véhicule rétabli en flotte & alerte 'Mission Complete' envoyée sur Telegram !");
        } else if (targetStep.id === "READY_FOR_PICKUP") {
          toast.success("🚗 Véhicule marqué prêt & alerte Telegram envoyée au Superviseur Terrain !");
        } else {
          toast.success(`Étape mise à jour vers : ${targetStep.shortLabel}`);
        }
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

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocCategoryDef = (catId: string) => {
    const found = DOCUMENT_CATEGORIES.find((c) => c.id === catId);
    return found || { id: catId, label: catId, icon: "📁", badgeColor: "bg-gray-100 text-gray-700 border-gray-200" };
  };

  const downloadDocument = (doc: AccidentDocument) => {
    try {
      const link = document.createElement("a");
      link.href = doc.fileUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Téléchargement de "${doc.name}"`);
    } catch (e) {
      console.error("Download error:", e);
      window.open(doc.fileUrl, "_blank");
    }
  };

  const processFile = (file: File): Promise<{ name: string; fileType: string; size: number; fileUrl: string }> => {
    return new Promise((resolve, reject) => {
      // PDF document
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > 8 * 1024 * 1024) {
          return reject(new Error("Le fichier PDF est trop volumineux (max 8 Mo)."));
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            fileType: "application/pdf",
            size: file.size,
            fileUrl: reader.result as string,
          });
        };
        reader.onerror = () => reject(new Error("Erreur de lecture du PDF."));
        reader.readAsDataURL(file);
        return;
      }

      // Photos (JPEG, PNG, WEBP)
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const maxDim = 1600;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              return resolve({
                name: file.name,
                fileType: file.type || "image/jpeg",
                size: file.size,
                fileUrl: reader.result as string,
              });
            }
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
            const approxSize = Math.round((compressedDataUrl.length * 3) / 4);
            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            resolve({
              name: cleanName,
              fileType: "image/jpeg",
              size: approxSize,
              fileUrl: compressedDataUrl,
            });
          };
          img.onerror = () => {
            resolve({
              name: file.name,
              fileType: file.type || "image/jpeg",
              size: file.size,
              fileUrl: reader.result as string,
            });
          };
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Erreur de lecture de l'image."));
        reader.readAsDataURL(file);
        return;
      }

      // Other generic files
      if (file.size > 5 * 1024 * 1024) {
        return reject(new Error("Le fichier est trop volumineux (max 5 Mo)."));
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          fileType: file.type || "application/octet-stream",
          size: file.size,
          fileUrl: reader.result as string,
        });
      };
      reader.onerror = () => reject(new Error("Erreur lors de la lecture du fichier."));
      reader.readAsDataURL(file);
    });
  };

  const handleUploadDocument = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingDoc(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent Assurance";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const processed = await processFile(file);
        const res = await fetch(`/api/accidents/${claim.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "UPLOAD_DOCUMENT",
            document: {
              name: processed.name,
              fileUrl: processed.fileUrl,
              fileType: processed.fileType,
              category: uploadCategory,
              stage: claim.timeline_step,
              size: processed.size,
              author: agentName,
            },
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Échec du téléversement");
        }
      }
      toast.success(`${files.length} document(s) ajouté(s) avec succès !`);
      setIsUploadBoxOpen(false);
      setShowDocsDrawer(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUpdate();
    } catch (err: any) {
      console.error("Failed to upload document:", err);
      toast.error(err.message || "Erreur lors du téléversement");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!confirm(`Supprimer définitivement le document "${docName}" ?`)) return;
    setDeletingDocId(docId);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent Assurance";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_DOCUMENT",
          documentId: docId,
          author: agentName,
        }),
      });

      if (res.ok) {
        toast.success(`"${docName}" supprimé avec succès`);
        if (previewDoc?.id === docId) {
          setPreviewDoc(null);
        }
        onUpdate();
      } else {
        toast.error("Échec de la suppression");
      }
    } catch (err) {
      console.error("Delete doc error:", err);
      toast.error("Erreur réseau");
    } finally {
      setDeletingDocId(null);
    }
  };

  const getStepBadge = (stepId: string) => {
    const step = TIMELINE_STEPS.find((s) => s.id === stepId);
    return step || { shortLabel: stepId, label: stepId, badgeColor: "bg-gray-100 text-gray-700 border-gray-200" };
  };

  const waLink = getWhatsAppLink(claim.driver_phone);

  return (
    <div className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border overflow-hidden flex flex-col justify-between ${
      claim.is_driver_red_flagged || claim.driver?.isRedFlagged ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
    }`}>
      {/* 1. Header with Moroccan Plate, Model & Downtime Badge */}
      <div>
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-r from-gray-50/70 to-white">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <MoroccanPlateBadge plate={claim.vehicle.plate_number} />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 shadow-2xs">
                <span>💥</span> Sinistre
              </span>
              {(claim.is_driver_red_flagged || claim.driver?.isRedFlagged) && (
                <RedFlagBadge reason={claim.driver_red_flag_reason || claim.driver?.redFlagReason} />
              )}
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
        <div className={`px-4 sm:px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2.5 ${
          claim.is_driver_red_flagged || claim.driver?.isRedFlagged ? "bg-red-50/40" : "bg-gray-50/60"
        }`}>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              claim.is_driver_red_flagged || claim.driver?.isRedFlagged ? "bg-red-600 text-white" : "bg-navy/10 text-navy"
            }`}>
              {claim.is_driver_red_flagged || claim.driver?.isRedFlagged ? "🚩" : <User className="w-3.5 h-3.5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-gray-900 truncate">
                  {claim.driver_name || "Chauffeur non assigné"}
                </span>
                {(claim.is_driver_red_flagged || claim.driver?.isRedFlagged) && (
                  <RedFlagBadge reason={claim.driver_red_flag_reason || claim.driver?.redFlagReason} />
                )}
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

          {/* Quick Communication Buttons & Telegram Mission Action */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {claim.fieldTask && claim.fieldTask.status !== "COMPLETED" && (
              <span
                className="inline-flex items-center gap-1.5 text-2xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg shadow-2xs"
                title={`Mission ${claim.fieldTask.task_type} active : ${claim.fieldTask.description}${claim.fieldTask.assigned_to ? ` • Assigné à : ${claim.fieldTask.assigned_to}` : ""}`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span>
                  📱 Terrain (
                  {claim.fieldTask.task_type === "GARAGE_PICKUP"
                    ? "Reprise Garage"
                    : claim.fieldTask.task_type === "VEHICLE_RECOVERY"
                    ? "Récupération"
                    : "Visite"}
                  {claim.fieldTask.assigned_to ? ` • 👮 ${claim.fieldTask.assigned_to}` : ""}
                  )
                </span>
              </span>
            )}

            {claim.fieldTask && claim.fieldTask.status === "COMPLETED" && (
              <span
                className="inline-flex items-center gap-1 text-2xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg shadow-2xs"
                title="Mission terrain effectuée et clôturée avec succès"
              >
                <span>🎉</span>
                <span>
                  Mission Complete
                  {claim.fieldTask.assigned_to ? ` (👮 ${claim.fieldTask.assigned_to})` : ""}
                </span>
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setMissionDescription(
                  `[Sinistre ${claim.vehicle.plate_number}] Étape : ${currentStepDef.label}. ${
                    claim.severity === "HARD" ? "Dommages lourds (structure)." : "Dommages légers (carrosserie)."
                  } Chauffeur : ${claim.driver_name || "Non assigné"}. Prise en charge terrain requise.`
                );
                setOpenTelegramModal(true);
              }}
              className="inline-flex items-center gap-1 text-2xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 px-2.5 py-1 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Créer une mission pour le Superviseur Terrain et envoyer l'alerte sur Telegram"
            >
              <Send className="w-3 h-3 text-blue-600" />
              <span>Mission Telegram</span>
            </button>

            {claim.driver_phone && (
              <>
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
              </>
            )}
          </div>
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4" />
                    Véhicule Rétabli en Flotte (Clos)
                  </span>
                  <span className="text-2xs text-gray-500 hidden sm:inline">
                    Le véhicule a repris son service actif.
                  </span>
                  <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-lg shadow-2xs">
                    <span>🎉</span>
                    <span>Mission Complete</span>
                    {claim.fieldTask?.assigned_to && (
                      <span className="text-emerald-950 font-normal ml-0.5">
                        • 👮 {claim.fieldTask.assigned_to}
                      </span>
                    )}
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
              <div className="w-full flex flex-wrap items-center justify-between p-3.5 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-xl font-medium text-xs shadow-2xs gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">⏳</span>
                  <div>
                    <div className="font-bold text-yellow-950">
                      Prêt pour récupération : En attente du superviseur terrain pour le convoyage.
                    </div>
                    <div className="text-2xs text-yellow-800 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Alerte Telegram transmise au Superviseur Terrain</span>
                      {claim.fieldTask?.assigned_to ? (
                        <span className="bg-yellow-200/80 text-yellow-950 border border-yellow-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          👮 Pris en charge par : {claim.fieldTask.assigned_to}
                        </span>
                      ) : (
                        <span className="text-yellow-700 italic text-[10px]">
                          (En attente d&apos;attribution)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResendReadyTelegram}
                    disabled={isUpdating || isSendingReadyTelegram}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Renvoyer l'alerte 'Véhicule Prêt' dans le groupe Telegram"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingReadyTelegram ? "Envoi..." : "Relancer Telegram"}</span>
                  </button>

                  <button
                    onClick={advanceTimeline}
                    disabled={isUpdating}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-bold text-xs transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>Clôturer manuellement</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
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

      {/* 5. Documents & Pièces Jointes (Photos & PDF) */}
      <div className="border-t border-gray-100 bg-slate-50/70 p-4 sm:p-5 space-y-3">
        {/* Documents Header & Toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setShowDocsDrawer(!showDocsDrawer)}
              className="flex items-center gap-1.5 font-bold text-xs text-gray-800 uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer"
            >
              <span>📁</span>
              <span>Pièces Jointes & Photos</span>
            </button>
            <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-navy text-white shadow-2xs">
              {documentsList.length}
            </span>
            {documentsList.length > 0 && (
              <span className="text-2xs text-gray-500 hidden sm:inline">
                ({documentsList.filter((d) => d.fileType.startsWith("image/")).length} photo(s),{" "}
                {documentsList.filter((d) => d.fileType === "application/pdf" || d.name.toLowerCase().endsWith(".pdf")).length} PDF)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsUploadBoxOpen(!isUploadBoxOpen);
                if (!showDocsDrawer) setShowDocsDrawer(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-navy hover:bg-navy/90 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isUploadBoxOpen ? "Fermer l'envoi" : "Ajouter Photo / PDF"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDocsDrawer(!showDocsDrawer)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-md transition-colors cursor-pointer"
              title={showDocsDrawer ? "Masquer la section documents" : "Afficher les documents"}
            >
              {showDocsDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Upload Box / Dropzone */}
        {isUploadBoxOpen && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-blue-300 p-4 space-y-3.5 animate-fadeIn shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-navy flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Téléverser des pièces justificatives</span>
              </span>
              <button
                type="button"
                onClick={() => setIsUploadBoxOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-3xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Catégorie de la pièce jointe :
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {DOCUMENT_CATEGORIES.map((cat) => {
                  const isSelected = uploadCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setUploadCategory(cat.id as any)}
                      className={`px-2.5 py-1.5 rounded-lg text-2xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer text-left ${
                        isSelected
                          ? "bg-navy text-white border-navy shadow-2xs"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dropzone Area */}
            <div
              onClick={() => !isUploadingDoc && fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isUploadingDoc
                  ? "bg-gray-50 border-gray-300 cursor-not-allowed"
                  : "bg-blue-50/40 hover:bg-blue-50 border-blue-200 hover:border-blue-400"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                multiple
                className="hidden"
                disabled={isUploadingDoc}
                onChange={(e) => handleUploadDocument(e.target.files)}
              />

              {isUploadingDoc ? (
                <div className="space-y-2 flex flex-col items-center">
                  <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <div className="text-xs font-bold text-blue-900">
                    Traitement & enregistrement en cours...
                  </div>
                  <div className="text-3xs text-gray-500">
                    Optimisation haute résolution et stockage sécurisé
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-2 shadow-2xs">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-gray-800">
                    Cliquez pour choisir vos fichiers ou glissez-déposez ici
                  </div>
                  <div className="text-2xs text-gray-500 mt-1">
                    Formats acceptés : <strong className="text-gray-700">PDF, JPG, PNG, WEBP</strong> (jusqu&apos;à 8 Mo)
                  </div>
                  <div className="mt-2 text-3xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Catégorie sélectionnée : {getDocCategoryDef(uploadCategory).label}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Documents Content (when drawer is open) */}
        {showDocsDrawer && (
          <div className="space-y-2.5">
            {documentsList.length === 0 ? (
              !isUploadBoxOpen && (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4 text-center space-y-1.5">
                  <div className="text-2xs text-gray-500 italic">
                    Aucune photo ni document PDF attaché à ce sinistre pour le moment.
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUploadBoxOpen(true)}
                    className="inline-flex items-center gap-1 text-2xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Joindre un constat amiable, un devis de réparation ou des photos de dégâts</span>
                  </button>
                </div>
              )
            ) : (
              <>
                {/* Category Filter Pills (if multiple categories) */}
                {documentsList.length > 2 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-3xs">
                    <button
                      type="button"
                      onClick={() => setFilterDocCategory("ALL")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filterDocCategory === "ALL"
                          ? "bg-navy text-white shadow-2xs"
                          : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      Tous ({documentsList.length})
                    </button>
                    {DOCUMENT_CATEGORIES.map((cat) => {
                      const count = documentsList.filter((d) => d.category === cat.id).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setFilterDocCategory(cat.id)}
                          className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer whitespace-nowrap ${
                            filterDocCategory === cat.id
                              ? "bg-navy text-white shadow-2xs"
                              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                          }`}
                        >
                          {cat.icon} {cat.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Documents Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {documentsList
                    .filter((doc) => filterDocCategory === "ALL" || doc.category === filterDocCategory)
                    .map((doc) => {
                      const catDef = getDocCategoryDef(doc.category);
                      const isPdf = doc.fileType === "application/pdf" || doc.name.toLowerCase().endsWith(".pdf");
                      const stepDef = TIMELINE_STEPS.find((s) => s.id === doc.stage);

                      return (
                        <div
                          key={doc.id}
                          className="bg-white rounded-xl border border-gray-200 p-2.5 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all flex flex-col justify-between group"
                        >
                          {/* Card Top: Category & Stage */}
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span
                                className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 ${catDef.badgeColor}`}
                              >
                                <span>{catDef.icon}</span>
                                <span className="truncate max-w-[110px]">{catDef.label}</span>
                              </span>

                              {stepDef && (
                                <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {stepDef.shortLabel}
                                </span>
                              )}
                            </div>

                            {/* Thumbnail / Preview Area */}
                            <div
                              onClick={() => setPreviewDoc(doc)}
                              className="w-full h-24 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden flex items-center justify-center cursor-pointer group-hover:opacity-95 transition-all relative"
                            >
                              {isPdf ? (
                                <div className="flex flex-col items-center justify-center text-rose-600 gap-1 p-2">
                                  <FileText className="w-8 h-8" />
                                  <span className="text-[10px] font-black tracking-wider uppercase bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                                    PDF
                                  </span>
                                </div>
                              ) : (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={doc.fileUrl}
                                    alt={doc.name}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                                    <Eye className="w-4 h-4 mr-1" />
                                    <span>Aperçu</span>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* File Name & Details */}
                            <div className="mt-2 min-w-0">
                              <div
                                onClick={() => setPreviewDoc(doc)}
                                className="text-xs font-bold text-gray-900 truncate hover:text-blue-600 cursor-pointer"
                                title={doc.name}
                              >
                                {doc.name}
                              </div>
                              <div className="text-[10px] text-gray-400 flex items-center justify-between mt-0.5">
                                <span>{formatFileSize(doc.size)}</span>
                                <span>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</span>
                              </div>
                              {doc.author && (
                                <div className="text-[9px] text-gray-500 truncate mt-0.5">
                                  Ajouté par : <span className="font-semibold">{doc.author}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Preview, Download, Delete */}
                          <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="flex-1 py-1 px-1.5 rounded-lg text-2xs font-bold bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              title="Voir directement dans le CRM"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Voir</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => downloadDocument(doc)}
                              className="flex-1 py-1 px-1.5 rounded-lg text-2xs font-bold bg-gray-100 hover:bg-navy text-gray-700 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              title="Télécharger sur votre appareil"
                            >
                              <Download className="w-3 h-3" />
                              <span>Télécharger</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id, doc.name)}
                              disabled={deletingDocId === doc.id}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                              title="Supprimer cette pièce jointe"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 6. Compact Comments & Activity Drawer */}
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
              onClick={() => {
                setIsUploadBoxOpen(true);
                setShowDocsDrawer(true);
              }}
              className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-all shrink-0 cursor-pointer shadow-2xs border border-gray-200"
              title="Joindre une photo ou document PDF (Devis, constat...)"
            >
              <Paperclip className="w-3.5 h-3.5 text-navy" />
              <span className="hidden sm:inline text-3xs">Joindre</span>
            </button>
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

      {/* 6. Modal: Création & Envoi Mission Telegram Superviseur Terrain */}
      {openTelegramModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-blue-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-navy text-white flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="font-black text-base flex items-center gap-2">
                  <span>📱</span>
                  <span>Mission Terrain & Alerte Telegram</span>
                </h3>
                <p className="text-xs text-blue-100 mt-0.5 truncate">
                  Immat : <strong className="font-mono text-white">{claim.vehicle.plate_number}</strong>
                  {claim.vehicle.make_model ? ` (${claim.vehicle.make_model})` : ""}
                  {claim.driver_name ? ` • Chauffeur : ${claim.driver_name}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenTelegramModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchMission} className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Type de mission */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Type d&apos;intervention terrain :
                </label>
                <select
                  value={missionTaskType}
                  onChange={(e) => setMissionTaskType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="GARAGE_PICKUP">🔧 Reprise au Garage (Véhicule réparé / Convoyage)</option>
                  <option value="VEHICLE_RECOVERY">🚨 Récupération Véhicule (Accidenté / Fourrière / Dépannage)</option>
                  <option value="FIELD_VISIT">🚗 Visite / Constat terrain / Expertise sinistre</option>
                </select>
              </div>

              {/* Priorité */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Niveau d&apos;urgence / Priorité :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Normal", "Urgent", "Critical"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setMissionPriority(lvl)}
                      className={`py-2 px-3 rounded-xl font-bold text-center border transition-all cursor-pointer ${
                        missionPriority === lvl
                          ? lvl === "Critical"
                            ? "bg-red-600 text-white border-red-600 shadow-sm"
                            : lvl === "Urgent"
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {lvl === "Critical" ? "🚨 Critique" : lvl === "Urgent" ? "⚡ Urgent" : "🟢 Normal"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Superviseur Terrain Assigné */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Superviseur Terrain Assigné (Prise en charge) :
                </label>
                <select
                  value={missionAssignedTo}
                  onChange={(e) => setMissionAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer"
                >
                  <option value="">-- À attribuer par l&apos;équipe terrain --</option>
                  {supervisorsList.map((sup) => (
                    <option key={sup} value={sup}>
                      👮 {sup}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Heure d'intervention souhaitée */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Date prévue (optionnel) :
                  </label>
                  <input
                    type="date"
                    value={missionScheduledDate}
                    onChange={(e) => setMissionScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Heure prévue (optionnel) :
                  </label>
                  <input
                    type="time"
                    value={missionScheduledTime}
                    onChange={(e) => setMissionScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Description / Instructions détaillées */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Instructions & détails de la mission :
                </label>
                <textarea
                  rows={3}
                  value={missionDescription}
                  onChange={(e) => setMissionDescription(e.target.value)}
                  placeholder="Ex : Récupérer le véhicule réparé au garage et le rapatrier au parc, vérifier carrosserie..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Notification Telegram checkbox */}
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="telegramAlertCheck"
                  checked={missionSendTelegram}
                  onChange={(e) => setMissionSendTelegram(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="telegramAlertCheck" className="text-2xs text-blue-900 cursor-pointer">
                  <span className="font-bold block">Alerter instantanément sur Telegram</span>
                  <span>
                    Publie automatiquement une alerte formatée avec immatriculation, étape du sinistre et coordonnées dans le groupe Telegram du <strong>Superviseur Terrain</strong>.
                  </span>
                </label>
              </div>

              {/* Actions footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenTelegramModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMission}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmittingMission
                      ? "Création en cours..."
                      : missionSendTelegram
                      ? "Créer & Envoyer sur Telegram"
                      : "Créer la Mission"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: In-CRM Preview (Image Lightbox & Embedded PDF Viewer) */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[94vh]">
            {/* Header */}
            <div className="p-4 bg-navy text-white flex items-center justify-between shrink-0 gap-3">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="text-2xl">
                  {previewDoc.fileType === "application/pdf" || previewDoc.name.toLowerCase().endsWith(".pdf")
                    ? "📄"
                    : "📸"}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
                      {previewDoc.name}
                    </h3>
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                        getDocCategoryDef(previewDoc.category).badgeColor
                      }`}
                    >
                      {getDocCategoryDef(previewDoc.category).label}
                    </span>
                  </div>
                  <div className="text-2xs text-gray-300 flex items-center gap-2 mt-0.5">
                    {previewDoc.size && <span>{formatFileSize(previewDoc.size)}</span>}
                    {previewDoc.author && <span>• Ajouté par : {previewDoc.author}</span>}
                    <span>• {new Date(previewDoc.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadDocument(previewDoc)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  title="Télécharger directement le fichier"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Télécharger</span>
                </button>

                <a
                  href={previewDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 bg-gray-900/95 p-2 sm:p-4 overflow-auto flex items-center justify-center min-h-[350px]">
              {previewDoc.fileType === "application/pdf" || previewDoc.name.toLowerCase().endsWith(".pdf") ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <iframe
                    src={previewDoc.fileUrl}
                    title={previewDoc.name}
                    className="w-full h-[70vh] rounded-2xl border border-gray-700 bg-white shadow-2xl"
                  />
                  <div className="mt-2 text-center text-2xs text-gray-400">
                    Si le PDF ne s&apos;affiche pas dans votre navigateur,{" "}
                    <button
                      type="button"
                      onClick={() => downloadDocument(previewDoc)}
                      className="text-blue-400 hover:text-blue-300 underline font-bold cursor-pointer"
                    >
                      cliquez ici pour le télécharger
                    </button>
                    .
                  </div>
                </div>
              ) : (
                <div className="relative max-w-full max-h-[75vh] flex items-center justify-center p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewDoc.fileUrl}
                    alt={previewDoc.name}
                    className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl border border-gray-800"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600 shrink-0">
              <span className="text-2xs text-gray-500">
                Immatriculation : <strong className="font-mono text-gray-800">{claim.vehicle.plate_number}</strong>
                {claim.driver_name ? ` • Chauffeur : ${claim.driver_name}` : ""}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteDocument(previewDoc.id, previewDoc.name)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold flex items-center gap-1 text-2xs px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ce document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 font-bold rounded-xl text-gray-800 transition-colors cursor-pointer text-xs"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
