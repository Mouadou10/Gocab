"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  Car,
  Clock,
  ShieldAlert,
  FileText,
  Phone,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Trash2,
  RotateCcw,
  User,
  ArrowRight,
  Send,
  Calendar,
  X,
  Image as ImageIcon,
  Paperclip,
  Download,
  Eye,
  UploadCloud,
  ExternalLink,
  Plus,
  Copy,
  Check,
  Building2,
  DollarSign,
  ShieldCheck,
  BookmarkCheck,
  Share2,
  RefreshCw,
} from "lucide-react";
import { useLiveSync } from "@/context/LiveSyncContext";
import { resolveVehicleFleetManager } from "@/lib/fleet-managers";
import RedFlagBadge from "./RedFlagBadge";
import {
  AccidentClaim,
  AccidentComment,
  AccidentDocument,
  DOCUMENT_CATEGORIES,
  TIMELINE_STEPS,
  InsuranceDossierInfo,
  InsuranceNoteItem,
} from "./AccidentCard";

interface InsuranceVehicleDetailProps {
  claim: AccidentClaim;
  onUpdate: () => void;
  onCloseMobile?: () => void;
}

export const INSURANCE_COMPANIES = [
  "Sanlam",
  "Wafa Assurance",
  "RMA Watanya",
  "AXA Assurances Maroc",
  "Saham Assurance",
  "AtlantaSanad",
  "Mutuelle Taamine Chaabi",
  "CAT (Compagnie d'Assurances Transport)",
  "Autre Compagnie",
];

export const GARAGE_OPTIONS = ["Emergence", "Zri9a", "Hard auto"] as const;
export type GarageOption = (typeof GARAGE_OPTIONS)[number];

export const INSURANCE_DOSSIER_STATUSES = [
  { id: "DECLARED", label: "1. Déclaration enregistrée", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "EXPERT_ASSIGNED", label: "2. Expert désigné (RdV fixé)", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "REPORT_FILED", label: "3. Rapport d'expertise déposé", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "APPROVAL_GRANTED", label: "4. Accord de prise en charge validé", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "GARAGE_AUTHORIZED", label: "5. Travaux garage autorisés", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "INVOICE_VALIDATED", label: "6. Facture & Quittance validées", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { id: "SETTLED", label: "7. Dossier indemnisé & Clôturé", color: "bg-green-100 text-green-800 border-green-200" },
  { id: "RECOURSE_IN_PROGRESS", label: "8. Recours contre tiers en cours", color: "bg-rose-100 text-rose-800 border-rose-200" },
];

export default function InsuranceVehicleDetail({
  claim,
  onUpdate,
  onCloseMobile,
}: InsuranceVehicleDetailProps) {
  const { data: session } = useSession() || {};
  const { notifyMutation } = useLiveSync("tickets");

  // Active sub-tab inside the right detail view
  // "insurance": Featured Insurance Company Follow-up
  // "status": Status & 6-step Timeline
  // "docs": Photos & Documents Gallery
  // "vehicle": Full vehicle & driver specs
  // "comments": Full comments log
  const [activeSubTab, setActiveSubTab] = useState<"insurance" | "status" | "docs" | "vehicle" | "comments">("insurance");

  const [isUpdating, setIsUpdating] = useState(false);
  const [isCopiedPlate, setIsCopiedPlate] = useState(false);
  const [isConfirmingFleet, setIsConfirmingFleet] = useState(false);
  const [isNotifyingManager, setIsNotifyingManager] = useState(false);
  const [fallbackManagerWaUrl, setFallbackManagerWaUrl] = useState<string | null>(null);

  // Parse comments and extract insurance dossier metadata if present
  let commentsList: AccidentComment[] = [];
  try {
    if (claim.comments) {
      commentsList = JSON.parse(claim.comments);
      if (!Array.isArray(commentsList)) commentsList = [];
    }
  } catch {
    commentsList = [];
  }

  const dossierMeta = commentsList.find((c: any) => c.id === "INSURANCE_DOSSIER_META") as InsuranceDossierInfo | undefined;

  const resolvedManagerKey = resolveVehicleFleetManager(claim.vehicle as any);
  const resolvedFleetManagerName =
    dossierMeta?.fleet_manager_name ||
    (resolvedManagerKey === "mehdi elyattouti" ? "Mehdi Elyattouti" : "Mohamed Aziz");
  const isFleetCreated = Boolean(dossierMeta?.fleet_created_on_gocab_fleet);
  const isFleetWhatsappNotified = Boolean(dossierMeta?.fleet_whatsapp_notified);

  // Insurance Dossier Form States
  const [claimNumber, setClaimNumber] = useState(dossierMeta?.claim_number || "");
  const [insuranceCompany, setInsuranceCompany] = useState(dossierMeta?.insurance_company || "Sanlam");
  const [garageName, setGarageName] = useState(dossierMeta?.garage_name || "Emergence");
  const [policyNumber, setPolicyNumber] = useState(dossierMeta?.policy_number || (claim.vehicle as any).insurance_policy_number || "");
  const [insuranceStatus, setInsuranceStatus] = useState(dossierMeta?.claim_status || "DECLARED");
  const [declarationDate, setDeclarationDate] = useState(dossierMeta?.declaration_date || "");
  const [expertName, setExpertName] = useState(dossierMeta?.expert_name || "");
  const [expertPhone, setExpertPhone] = useState(dossierMeta?.expert_phone || "");
  const [expertiseDate, setExpertiseDate] = useState(dossierMeta?.expertise_date || "");
  const [estimatedCost, setEstimatedCost] = useState<number | string>(dossierMeta?.estimated_amount || 0);
  const [coveredAmount, setCoveredAmount] = useState<number | string>(dossierMeta?.covered_amount || 0);
  const [franchiseAmount, setFranchiseAmount] = useState<number | string>(dossierMeta?.franchise_amount || 0);
  const [payoutStatus, setPayoutStatus] = useState(dossierMeta?.payout_status || "PENDING");
  const [isSavingDossier, setIsSavingDossier] = useState(false);

  // New note specific to the insurance company
  const [newInsuranceNote, setNewInsuranceNote] = useState("");
  const [insuranceAuthorName, setInsuranceAuthorName] = useState(
    session?.user?.name || "Inspecteur Assureur"
  );
  const [isSavingInsuranceNote, setIsSavingInsuranceNote] = useState(false);

  // Sync form states whenever selected claim changes
  useEffect(() => {
    let parsed: AccidentComment[] = [];
    try {
      if (claim.comments) parsed = JSON.parse(claim.comments);
    } catch {}
    const meta = parsed.find((c: any) => c.id === "INSURANCE_DOSSIER_META") as InsuranceDossierInfo | undefined;

    setClaimNumber(meta?.claim_number || "");
    setInsuranceCompany(meta?.insurance_company || "Sanlam");
    setGarageName(meta?.garage_name || "Emergence");
    setPolicyNumber(meta?.policy_number || (claim as any).vehicle?.insurance_policy_number || "");
    setInsuranceStatus(meta?.claim_status || "DECLARED");
    setDeclarationDate(meta?.declaration_date || (claim.created_at ? claim.created_at.split("T")[0] : ""));
    setExpertName(meta?.expert_name || "");
    setExpertPhone(meta?.expert_phone || "");
    setExpertiseDate(meta?.expertise_date || "");
    setEstimatedCost(meta?.estimated_amount || 0);
    setCoveredAmount(meta?.covered_amount || 0);
    setFranchiseAmount(meta?.franchise_amount || 0);
    setPayoutStatus(meta?.payout_status || "PENDING");
  }, [claim.id, claim.comments]);

  // Documents list
  let documentsList: AccidentDocument[] = [];
  try {
    if (claim.documents) {
      documentsList = JSON.parse(claim.documents);
      if (!Array.isArray(documentsList)) documentsList = [];
    }
  } catch {
    documentsList = [];
  }

  // General comments & Timeline states
  const [generalCommentText, setGeneralCommentText] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);

  // Document upload state
  const [uploadCategory, setUploadCategory] = useState<
    "CONSTAT" | "DEVIS" | "PHOTOS" | "EXPERTISE" | "FACTURE" | "AUTRE"
  >("CONSTAT");
  const [filterDocCategory, setFilterDocCategory] = useState<string>("ALL");
  const [previewDoc, setPreviewDoc] = useState<AccidentDocument | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Telegram Mission modal
  const [openTelegramModal, setOpenTelegramModal] = useState(false);
  const [missionTaskType, setMissionTaskType] = useState<"GARAGE_PICKUP" | "VEHICLE_RECOVERY" | "FIELD_VISIT">(
    claim.timeline_step === "READY_FOR_PICKUP" || claim.timeline_step === "CAR_IN_GARAGE"
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

  // Calculate days in status and total
  const calculateDays = (dateStr: string) => {
    if (!dateStr) return 0;
    const diff = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const daysInStatus = calculateDays(claim.step_updated_at || claim.created_at);
  const totalDays = calculateDays(claim.created_at);

  const currentStepIndex = TIMELINE_STEPS.findIndex((s) => s.id === claim.timeline_step);
  const currentStepDef = TIMELINE_STEPS[currentStepIndex] || TIMELINE_STEPS[0];
  const isCompleted = claim.timeline_step === "VEHICLE_BACK";

  // Days color badge
  const getDaysBadge = (days: number) => {
    if (days <= 3) {
      return {
        bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
        dot: "bg-emerald-500",
        label: `${days}j - Normal`,
      };
    } else if (days <= 7) {
      return {
        bg: "bg-amber-50 text-amber-800 border-amber-200",
        dot: "bg-amber-500",
        label: `${days}j - Vigilance`,
      };
    } else {
      return {
        bg: "bg-red-50 text-red-800 border-red-300",
        dot: "bg-red-500 animate-pulse",
        label: `${days}j - Immobilisation Critique`,
      };
    }
  };

  const daysBadge = getDaysBadge(daysInStatus);

  // WhatsApp link
  const getWhatsAppLink = (phone: string | null) => {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned) return null;
    if (cleaned.startsWith("0")) cleaned = "212" + cleaned.slice(1);
    else if (!cleaned.startsWith("212")) cleaned = "212" + cleaned;
    return `https://wa.me/${cleaned}`;
  };

  const handleCopyPlate = () => {
    navigator.clipboard.writeText(claim.vehicle.plate_number);
    setIsCopiedPlate(true);
    toast.success("Immatriculation copiée !");
    setTimeout(() => setIsCopiedPlate(false), 2000);
  };

  // Save insurance dossier metadata to DB via PATCH /api/accidents/[id]
  const handleSaveInsuranceDossier = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingDossier(true);
    try {
      const author = session?.user?.name || session?.user?.email || "Agent Assurance";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_INSURANCE_DOSSIER",
          author,
          insurance_dossier: {
            claim_number: claimNumber,
            insurance_company: insuranceCompany,
            garage_name: garageName,
            policy_number: policyNumber,
            claim_status: insuranceStatus,
            declaration_date: declarationDate,
            expert_name: expertName,
            expert_phone: expertPhone,
            expertise_date: expertiseDate,
            estimated_amount: Number(estimatedCost) || 0,
            covered_amount: Number(coveredAmount) || 0,
            franchise_amount: Number(franchiseAmount) || 0,
            payout_status: payoutStatus,
          },
        }),
      });

      if (res.ok) {
        toast.success("✓ Dossier Assureur mis à jour avec succès !", { icon: "🛡️" });
        onUpdate();
      } else {
        toast.error("Échec de l'enregistrement du dossier d'assurance");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsSavingDossier(false);
    }
  };

  // Add insurance follow-up note
  const handleAddInsuranceNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsuranceNote.trim()) return;
    setIsSavingInsuranceNote(true);
    try {
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_INSURANCE_NOTE",
          note: newInsuranceNote.trim(),
          author: insuranceAuthorName.trim() || "Expertise / Assureur",
        }),
      });

      if (res.ok) {
        toast.success("Note assureur ajoutée au journal");
        setNewInsuranceNote("");
        onUpdate();
      } else {
        toast.error("Échec de l'ajout de la note");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsSavingInsuranceNote(false);
    }
  };

  // Update status step
  const handleStepClick = async (stepId: string) => {
    if (stepId === claim.timeline_step || isUpdating) return;
    setIsUpdating(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeline_step: stepId,
          author: agentName,
          comment: generalCommentText.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Étape mise à jour avec succès");
        setGeneralCommentText("");
        onUpdate();
      } else {
        toast.error("Échec du changement d'étape");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsUpdating(false);
    }
  };

  // Update severity or fault
  const handleUpdateField = async (field: "severity" | "fault", value: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        toast.success("Modification enregistrée");
        onUpdate();
      } else {
        toast.error("Échec de la mise à jour");
      }
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setIsUpdating(false);
    }
  };

  // Upload file (Photo or PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 15 Mo)");
      return;
    }

    setIsUploadingDoc(true);
    const toastId = toast.loading("Téléchargement du document en cours...");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileDataUrl = reader.result as string;
        const author = session?.user?.name || session?.user?.email || "Agent";

        const res = await fetch(`/api/accidents/${claim.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "UPLOAD_DOCUMENT",
            author,
            document: {
              name: file.name,
              fileUrl: fileDataUrl,
              fileType: file.type || "application/octet-stream",
              category: uploadCategory,
              stage: claim.timeline_step,
              size: file.size,
            },
          }),
        });

        toast.dismiss(toastId);
        if (res.ok) {
          toast.success(`Document "${file.name}" ajouté avec succès !`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          onUpdate();
        } else {
          toast.error("Échec du téléversement du document");
        }
        setIsUploadingDoc(false);
      };

      reader.onerror = () => {
        toast.dismiss(toastId);
        toast.error("Erreur de lecture du fichier");
        setIsUploadingDoc(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Erreur réseau");
      setIsUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!confirm(`Supprimer le document "${docName}" ?`)) return;
    try {
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "DELETE_DOCUMENT",
          documentId: docId,
          author: session?.user?.name || "Agent",
        }),
      });

      if (res.ok) {
        toast.success("Document supprimé");
        onUpdate();
      } else {
        toast.error("Échec de la suppression");
      }
    } catch (e) {
      toast.error("Erreur réseau");
    }
  };

  // Save general comment
  const handleSaveGeneralComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalCommentText.trim()) return;
    setIsSavingComment(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: generalCommentText.trim(),
          timeline_step: claim.timeline_step,
          author: agentName,
        }),
      });

      if (res.ok) {
        toast.success("Commentaire consigné au journal");
        setGeneralCommentText("");
        onUpdate();
      } else {
        toast.error("Échec de l'enregistrement");
      }
    } catch (e) {
      toast.error("Erreur réseau");
    } finally {
      setIsSavingComment(false);
    }
  };

  // Confirm accident created on GoCab Fleet directly from CRM
  const handleConfirmCreatedOnFleet = async () => {
    if (isConfirmingFleet) return;
    setIsConfirmingFleet(true);
    try {
      const agentName = session?.user?.name || resolvedFleetManagerName;
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "CONFIRM_CREATED_ON_FLEET",
          author: agentName,
        }),
      });
      if (res.ok) {
        toast.success("Accident marqué comme « Créé sur GoCab Fleet » !");
        notifyMutation("tickets");
        notifyMutation("all");
        onUpdate();
      } else {
        toast.error("Échec de la validation GoCab Fleet");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsConfirmingFleet(false);
    }
  };

  // Send / resend WhatsApp notification to the owning Fleet Manager
  const handleNotifyFleetManagerWhatsApp = async () => {
    if (isNotifyingManager) return;
    setIsNotifyingManager(true);
    try {
      const agentName = session?.user?.name || "Agent";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "NOTIFY_FLEET_MANAGER_WHATSAPP",
          author: agentName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const waNotif = data.whatsappNotification;
        if (waNotif?.waMeFallbackUrl) {
          setFallbackManagerWaUrl(waNotif.waMeFallbackUrl);
        }
        if (waNotif?.sent) {
          toast.success(
            `WhatsApp envoyé à ${waNotif.managerName} avec le bouton « ✅ Créé sur Fleet » !`
          );
        } else {
          toast.error(
            waNotif?.error ||
              `Envoi direct impossible — utilisez le bouton WhatsApp Web de secours.`
          );
        }
        notifyMutation("tickets");
        notifyMutation("all");
        onUpdate();
      } else {
        toast.error("Échec de l'envoi WhatsApp au gestionnaire");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsNotifyingManager(false);
    }
  };

  // Dispatch Telegram Mission to Field Supervisor
  const handleDispatchMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionAssignedTo.trim() && !missionDescription.trim()) {
      toast.error("Veuillez sélectionner un superviseur ou saisir une description");
      return;
    }
    setIsSubmittingMission(true);
    try {
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "DISPATCH_TELEGRAM_MISSION",
          task_type: missionTaskType,
          priority: missionPriority,
          assigned_to: missionAssignedTo.trim() || null,
          description:
            missionDescription.trim() ||
            `[Sinistre ${claim.vehicle?.plate_number}] Intervention terrain requise pour le véhicule accidenté.`,
          scheduled_date: missionScheduledDate || null,
          scheduled_time: missionScheduledTime || null,
          send_telegram: missionSendTelegram,
          author: session?.user?.name || "Agent Assurance",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(
          missionSendTelegram
            ? "🚀 Mission terrain créée & notifiée sur Telegram !"
            : "🚀 Mission terrain créée avec succès !"
        );
        setOpenTelegramModal(false);
        notifyMutation("tickets");
        notifyMutation("all");
        onUpdate();
      } else {
        toast.error(data.error || "Échec de la création de la mission");
      }
    } catch (err: any) {
      console.error("Error creating telegram mission:", err);
      toast.error(err?.message || "Erreur réseau");
    } finally {
      setIsSubmittingMission(false);
    }
  };

  // Reopen claim
  const handleReopenClaim = async () => {
    setIsUpdating(true);
    try {
      const agentName = session?.user?.name || "Agent";
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
        toast.success("Dossier réouvert et replacé dans les dossiers en cours !");
        onUpdate();
      } else {
        toast.error("Échec de la réouverture");
      }
    } catch (e) {
      toast.error("Erreur lors de la réouverture");
    } finally {
      setIsUpdating(false);
    }
  };

  // Filtered docs
  const filteredDocs = documentsList.filter((d) => {
    if (filterDocCategory === "ALL") return true;
    return d.category === filterDocCategory;
  });

  const insuranceNotesList: InsuranceNoteItem[] = dossierMeta?.insurance_notes || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER: VEHICLE IMMAT, STATUS DAYS, QUICK CALL & ACTIONS        */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-navy via-navy-light to-navy text-white shrink-0 shadow-sm border-b border-navy-light">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Immat & Main Vehicle Identity */}
          <div className="flex items-center gap-3">
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Retour à la liste des véhicules"
              >
                ←
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="font-mono text-xl sm:text-2xl font-black bg-white text-navy px-3 py-1 rounded-xl shadow-md border-2 border-amber-400 tracking-wider flex items-center gap-1.5">
                <span>🚗</span>
                <span>{claim.vehicle.plate_number}</span>
              </span>

              <button
                type="button"
                onClick={handleCopyPlate}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Copier l'immatriculation"
              >
                {isCopiedPlate ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="hidden sm:block">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{claim.vehicle.make_model || "Véhicule Flotte GoCab"}</span>
                {(claim.vehicle as any).year && (
                  <span className="text-white/70 text-xs">({(claim.vehicle as any).year})</span>
                )}
              </div>
              <div className="text-2xs text-white/75 flex items-center gap-2 flex-wrap">
                <span>📍 {(claim.vehicle as any).hub_city || "Casablanca"}</span>
                {(claim.vehicle as any).current_mileage > 0 && (
                  <span>· 🛣️ {((claim.vehicle as any).current_mileage).toLocaleString()} KM</span>
                )}
                <span>· 🛡️ {insuranceCompany || "Sanlam"}</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 border border-amber-300/30 font-bold">
                  🏬 Garage: {garageName || "Emergence"}
                </span>
              </div>
            </div>
          </div>

          {/* Days In Status Banner & Fast Action Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Days in status indicator */}
            <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xs flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-300" />
              <div className="text-right">
                <div className="text-xs font-black text-amber-300 flex items-center gap-1">
                  <span>{daysInStatus} jour{daysInStatus > 1 ? "s" : ""}</span>
                  <span className="text-white/70 font-normal">dans ce statut</span>
                </div>
                <div className="text-3xs text-white/80">
                  Étape : <strong>{currentStepDef.label}</strong>
                </div>
              </div>
            </div>

            {/* Total downtime */}
            <div className="px-3 py-1.5 rounded-xl bg-red-500/20 border border-red-400/30 text-white flex items-center gap-1.5 text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5 text-red-300" />
              <span>Arrêt total: {totalDays}j</span>
            </div>

            {/* Reopen button if completed */}
            {isCompleted && (
              <button
                type="button"
                onClick={handleReopenClaim}
                disabled={isUpdating}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réouvrir</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Driver Strip with Phone & WhatsApp Callouts */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-white/90">
            <User className="w-3.5 h-3.5 text-amber-300" />
            <span>Chauffeur :</span>
            <span className="font-bold text-white">
              {claim.driver_name || "Non affecté"}
            </span>
            {claim.is_driver_red_flagged && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-3xs font-extrabold uppercase">
                🚩 Red Flag
              </span>
            )}
          </div>

          {claim.driver_phone && (
            <div className="flex items-center gap-2">
              <a
                href={`tel:${claim.driver_phone}`}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-2xs font-bold flex items-center gap-1 transition-colors"
              >
                <Phone className="w-3 h-3 text-emerald-300" />
                <span>{claim.driver_phone}</span>
              </a>

              {getWhatsAppLink(claim.driver_phone) && (
                <a
                  href={getWhatsAppLink(claim.driver_phone)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-2xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 1B. GOCAB FLEET SYNC & FLEET MANAGER WHATSAPP BANNER                   */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div
        className={`px-4 py-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 ${
          isFleetCreated
            ? "bg-emerald-50 border-emerald-200"
            : "bg-amber-50/80 border-amber-200"
        }`}
      >
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm ${
              isFleetCreated
                ? "bg-emerald-600 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {isFleetCreated ? "✅" : "📲"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-black ${
                  isFleetCreated ? "text-emerald-950" : "text-amber-950"
                }`}
              >
                {isFleetCreated
                  ? "Accident créé & synchronisé sur GoCab Fleet"
                  : "En attente de création sur GoCab Fleet"}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-navy">
                👤 Gestionnaire : {resolvedFleetManagerName}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 truncate">
              {isFleetCreated ? (
                <>
                  Confirmé par{" "}
                  <strong>{dossierMeta?.fleet_created_by || resolvedFleetManagerName}</strong>
                  {dossierMeta?.fleet_created_at
                    ? ` le ${new Date(dossierMeta.fleet_created_at).toLocaleString("fr-FR")}`
                    : ""}
                  {dossierMeta?.fleet_created_source === "WHATSAPP_BUTTON"
                    ? " · via bouton WhatsApp"
                    : dossierMeta?.fleet_created_source === "WEB_LINK"
                    ? " · via lien WhatsApp"
                    : ""}
                </>
              ) : isFleetWhatsappNotified ? (
                <>
                  Alerte WhatsApp envoyée à <strong>{resolvedFleetManagerName}</strong>
                  {dossierMeta?.fleet_whatsapp_notified_at
                    ? ` (${new Date(dossierMeta.fleet_whatsapp_notified_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })})`
                    : ""}{" "}
                  — En attente du clic sur « ✅ Créé sur Fleet ».
                </>
              ) : (
                <>
                  Notifiez <strong>{resolvedFleetManagerName}</strong> sur WhatsApp ou validez dès que l&apos;accident est créé sur GoCab Fleet.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {!isFleetCreated && (
            <button
              type="button"
              onClick={handleConfirmCreatedOnFleet}
              disabled={isConfirmingFleet}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-2xs font-extrabold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isConfirmingFleet ? "Validation..." : "✅ Créé sur GoCab Fleet"}
              </span>
            </button>
          )}

          {!isFleetCreated && (
            <button
              type="button"
              onClick={handleNotifyFleetManagerWhatsApp}
              disabled={isNotifyingManager}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-gray-50 disabled:opacity-60 text-navy border border-gray-300 text-2xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title={`Envoyer / Relancer la notification WhatsApp à ${resolvedFleetManagerName}`}
            >
              <RefreshCw className={`w-3 h-3 ${isNotifyingManager ? "animate-spin" : ""}`} />
              <span>{isFleetWhatsappNotified ? "Relancer WhatsApp" : "Notifier WhatsApp"}</span>
            </button>
          )}

          {!isFleetCreated && fallbackManagerWaUrl && (
            <a
              href={fallbackManagerWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-2xs font-bold flex items-center gap-1 transition-all"
            >
              <MessageCircle className="w-3 h-3" />
              <span>WhatsApp Web</span>
            </a>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 2. SUB-TABS NAVIGATION: FEATURED INSURANCE / STATUS / DOCS / VEHICLE    */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="px-4 bg-gray-50 border-b border-gray-200 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab("insurance")}
          className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === "insurance"
              ? "border-emerald-600 text-emerald-900 bg-white shadow-2xs"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>🛡️ Suivi Assureur & Sinistre</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded-full">
            Espace Compagnie
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("status")}
          className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === "status"
              ? "border-navy text-navy bg-white shadow-2xs"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <Clock className="w-4 h-4 text-blue-600" />
          <span>🚗 Statuts & Étapes Garage</span>
          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full">
            {currentStepIndex + 1}/6
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("docs")}
          className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === "docs"
              ? "border-purple-600 text-purple-900 bg-white shadow-2xs"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <ImageIcon className="w-4 h-4 text-purple-600" />
          <span>📸 Photos & Documents</span>
          <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded-full">
            {documentsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("vehicle")}
          className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === "vehicle"
              ? "border-amber-600 text-amber-900 bg-white shadow-2xs"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <Car className="w-4 h-4 text-amber-600" />
          <span>ℹ️ Fiche Véhicule & Chauffeur</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("comments")}
          className={`py-3 px-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === "comments"
              ? "border-gray-700 text-gray-900 bg-white shadow-2xs"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <MessageCircle className="w-4 h-4 text-gray-600" />
          <span>💬 Journal d&apos;Échange</span>
          <span className="text-[10px] bg-gray-200 text-gray-800 font-bold px-1.5 py-0.2 rounded-full">
            {commentsList.length}
          </span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 3. SUB-TAB CONTENT PANELS                                              */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ==================================================================== */}
        {/* TAB 1: 🛡️ SUIVI COMPAGNIE D'ASSURANCE (PORTAIL PARTAGÉ)               */}
        {/* ==================================================================== */}
        {activeSubTab === "insurance" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Banner: Portail Compagnie */}
            <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                    <span>Espace Suivi Compagnie d&apos;Assurance & Cabinet d&apos;Expertise</span>
                    <span className="text-3xs bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Accès Partagé
                    </span>
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Mise à jour du numéro de sinistre, expertise chiffrée, accord de prise en charge et consignation des échanges.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveInsuranceDossier}
                  disabled={isSavingDossier}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingDossier ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <BookmarkCheck className="w-4 h-4" />}
                  <span>Enregistrer Dossier Assureur</span>
                </button>
              </div>
            </div>

            {/* Insurance Claim Form */}
            <form onSubmit={handleSaveInsuranceDossier} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h5 className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                  <span>📋</span> Identification du Dossier & Compagnie
                </h5>
                <span className="text-2xs font-semibold text-gray-500">
                  Dernière mise à jour : {dossierMeta?.updated_at ? new Date(dossierMeta.updated_at).toLocaleDateString("fr-FR") : "Récente"} {dossierMeta?.updated_by ? `par ${dossierMeta.updated_by}` : ""}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Claim Reference # */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    N° de Sinistre Assureur <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ex: SIN-2026-CAS-0849"
                    value={claimNumber}
                    onChange={(e) => setClaimNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Insurance Company */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    Compagnie d&apos;Assurance
                  </label>
                  <select
                    value={insuranceCompany}
                    onChange={(e) => setInsuranceCompany(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none cursor-pointer"
                  >
                    {INSURANCE_COMPANIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Garage de Réparation */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    Garage de Réparation <span className="text-amber-600 font-extrabold">*</span>
                  </label>
                  <select
                    value={garageName}
                    onChange={(e) => setGarageName(e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50/70 border border-amber-300 rounded-xl font-bold text-amber-950 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:outline-none cursor-pointer"
                  >
                    {GARAGE_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* Policy Number */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    N° Police / Contrat
                  </label>
                  <input
                    type="text"
                    placeholder="ex: POL-984210-2026"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Insurance Claim Status */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    Statut Avancement Assureur
                  </label>
                  <select
                    value={insuranceStatus}
                    onChange={(e) => setInsuranceStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-emerald-50/70 border border-emerald-300 text-emerald-950 rounded-xl font-black text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none cursor-pointer"
                  >
                    {INSURANCE_DOSSIER_STATUSES.map((st) => (
                      <option key={st.id} value={st.id}>{st.label}</option>
                    ))}
                  </select>
                </div>

                {/* Declaration Date */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    Date Déclaration Sinistre
                  </label>
                  <input
                    type="date"
                    value={declarationDate}
                    onChange={(e) => setDeclarationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Expertise Date */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    Date Expertise / Visite
                  </label>
                  <input
                    type="date"
                    value={expertiseDate}
                    onChange={(e) => setExpertiseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Expert Name */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    Nom & Cabinet de l&apos;Expert
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Cabinet Bennani Expertise"
                    value={expertName}
                    onChange={(e) => setExpertName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Expert Phone */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    Téléphone Expert
                  </label>
                  <input
                    type="text"
                    placeholder="ex: +212 6 61 23 45 67"
                    value={expertPhone}
                    onChange={(e) => setExpertPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-mono text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Payout Status */}
                <div>
                  <label className="block text-2xs font-bold text-gray-700 mb-1">
                    Règlement / Indemnisation
                  </label>
                  <select
                    value={payoutStatus}
                    onChange={(e) => setPayoutStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none cursor-pointer"
                  >
                    <option value="PENDING">En attente d&apos;accord</option>
                    <option value="ACCORD_VALIDE">Accord validé par la compagnie</option>
                    <option value="INDEMNISE">Indemnisé / Quittance payée</option>
                    <option value="REFUSED">Dossier sans suite / Refus</option>
                  </select>
                </div>
              </div>

              {/* Financial Chiffrage Box */}
              <div className="pt-4 border-t border-gray-100">
                <h6 className="text-2xs font-black text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Chiffrage Financier & Prise en Charge (MAD)</span>
                </h6>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <span className="text-3xs font-bold text-gray-500 uppercase block mb-1">
                      Devis Réparation Estimé
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={estimatedCost}
                        onChange={(e) => setEstimatedCost(e.target.value)}
                        className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-gray-900 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                      />
                      <span className="text-2xs font-bold text-gray-500">MAD</span>
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                    <span className="text-3xs font-bold text-emerald-800 uppercase block mb-1">
                      Montant Pris en Charge
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={coveredAmount}
                        onChange={(e) => setCoveredAmount(e.target.value)}
                        className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-emerald-300 font-mono font-black text-emerald-900 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none"
                      />
                      <span className="text-2xs font-bold text-emerald-700">MAD</span>
                    </div>
                  </div>

                  <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                    <span className="text-3xs font-bold text-amber-800 uppercase block mb-1">
                      Franchise Applicable
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={franchiseAmount}
                        onChange={(e) => setFranchiseAmount(e.target.value)}
                        className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-amber-300 font-mono font-bold text-amber-900 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:outline-none"
                      />
                      <span className="text-2xs font-bold text-amber-700">MAD</span>
                    </div>
                  </div>

                  <div className="bg-navy/5 p-3 rounded-xl border border-navy/20">
                    <span className="text-3xs font-bold text-navy uppercase block mb-1">
                      Reste à Charge GoCab
                    </span>
                    <div className="text-sm font-black font-mono text-navy py-1.5">
                      {Math.max(0, (Number(estimatedCost) || 0) - (Number(coveredAmount) || 0)).toLocaleString()} MAD
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingDossier}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingDossier ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <BookmarkCheck className="w-4 h-4" />}
                  <span>Enregistrer les Données Assureur</span>
                </button>
              </div>
            </form>

            {/* Insurance Follow-Up Notes & Direct Feedback */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h5 className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                  <span>💬</span> Instructions & Notes de Suivi Assureur ({insuranceNotesList.length})
                </h5>
                <span className="text-2xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Échanges Compagnie / Flotte
                </span>
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddInsuranceNote} className="space-y-2.5 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between text-2xs font-bold text-gray-700">
                  <label>Ajouter une note de suivi (Assureur ou Gestionnaire Sinistre) :</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400 font-normal">Auteur:</span>
                    <input
                      type="text"
                      value={insuranceAuthorName}
                      onChange={(e) => setInsuranceAuthorName(e.target.value)}
                      placeholder="Nom / Organisme"
                      className="bg-white border border-gray-300 rounded px-2 py-0.5 text-2xs font-bold text-gray-800"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    value={newInsuranceNote}
                    onChange={(e) => setNewInsuranceNote(e.target.value)}
                    placeholder="Exemple : Rapport d'expertise favorable, accord pièces d'origine accordé. En attente facture carrosserie."
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:outline-none resize-none leading-relaxed"
                  />
                  <button
                    type="submit"
                    disabled={!newInsuranceNote.trim() || isSavingInsuranceNote}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 h-[4.5rem]"
                  >
                    {isSavingInsuranceNote ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Ajouter Note</span>
                  </button>
                </div>
              </form>

              {/* Feed of Notes */}
              {insuranceNotesList.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  Aucune note d&apos;échange spécifique pour l&apos;assureur pour le moment.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                  {insuranceNotesList.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-2xs text-gray-500">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <span>👤</span> {n.author}
                        </span>
                        <span className="font-mono text-gray-400">
                          {new Date(n.created_at).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-gray-800 leading-relaxed font-sans">{n.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: 🚗 STATUTS & ÉTAPES GARAGE (CHRONOLOGIE COMPLETE)             */}
        {/* ==================================================================== */}
        {activeSubTab === "status" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Current status summary banner */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <span className="text-lg">{currentStepDef.icon}</span>
                </div>
                <div>
                  <div className="text-2xs font-bold text-blue-700 uppercase">Étape Active</div>
                  <h4 className="text-base font-black text-navy">{currentStepDef.label}</h4>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Enregistré depuis <strong>{daysInStatus} jour{daysInStatus > 1 ? "s" : ""}</strong> dans cette étape.
                  </div>
                </div>
              </div>

              {/* Severity & Fault Fast Toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={claim.severity || "HARD"}
                  onChange={(e) => handleUpdateField("severity", e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 cursor-pointer shadow-2xs"
                >
                  <option value="HARD">🛑 Gravité Lourde (Structure)</option>
                  <option value="SOFT">⚠️ Gravité Légère (Carrosserie)</option>
                </select>

                <select
                  value={claim.fault || "DRIVER"}
                  onChange={(e) => handleUpdateField("fault", e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-800 cursor-pointer shadow-2xs"
                >
                  <option value="DRIVER">👤 Responsabilité Chauffeur</option>
                  <option value="THIRD_PARTY">🚗 Responsabilité Tiers</option>
                </select>
              </div>
            </div>

            {/* Visual 6-Step Stepper */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
              <h5 className="text-xs font-black text-navy uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <span>Avancement du Véhicule au Garage</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-2xs font-bold font-mono">
                    🏬 Garage : {garageName || "Emergence"}
                  </span>
                </span>
                <span className="text-2xs font-normal text-gray-400">Cliquez sur une étape pour changer</span>
              </h5>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {TIMELINE_STEPS.map((s, idx) => {
                  const isCurrent = s.id === claim.timeline_step;
                  const isPast = idx < currentStepIndex;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleStepClick(s.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[5.5rem] ${
                        isCurrent
                          ? "bg-navy text-white border-navy shadow-md ring-2 ring-navy/20"
                          : isPast
                          ? "bg-emerald-50 text-emerald-950 border-emerald-200 hover:bg-emerald-100"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-base">{s.icon}</span>
                        <span className={`text-3xs font-extrabold px-1.5 py-0.5 rounded ${
                          isCurrent ? "bg-white/20 text-white" : isPast ? "bg-emerald-200/80 text-emerald-900" : "bg-gray-200 text-gray-600"
                        }`}>
                          #{s.stepNum}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight">{s.shortLabel}</div>
                        <div className={`text-3xs mt-0.5 truncate ${isCurrent ? "text-white/80" : "text-gray-400"}`}>
                          {s.label}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Advance with comment */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Note optionnelle pour ce changement d'étape..."
                  value={generalCommentText}
                  onChange={(e) => setGeneralCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:outline-none"
                />

                {currentStepIndex < TIMELINE_STEPS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => handleStepClick(TIMELINE_STEPS[currentStepIndex + 1].id)}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-navy hover:bg-navy-light text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span>Passer à {TIMELINE_STEPS[currentStepIndex + 1].shortLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Telegram Mission Dispatch to Field Supervisor */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h6 className="text-xs font-bold text-gray-900">
                    Alerter le Superviseur Terrain (Telegram)
                  </h6>
                  <p className="text-2xs text-gray-500">
                    {claim.fieldTask
                      ? `Mission active : ${claim.fieldTask.task_type} (Statut: ${claim.fieldTask.status})`
                      : "Créer une mission pour reprise du véhicule au garage ou récupération sur le terrain."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!missionDescription) {
                    setMissionDescription(
                      `Intervention requise pour ${claim.vehicle.plate_number} (${claim.vehicle.make_model || ""}) - ${
                        claim.severity === "HARD" ? "Dommages lourds (structure)." : "Dommages légers."
                      } Chauffeur : ${claim.driver_name || "Non assigné"}. Prise en charge terrain requise.`
                    );
                  }
                  setOpenTelegramModal(true);
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>🚀 Mission Terrain Telegram</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: 📸 PHOTOS & DOCUMENTS (GALLERY & UPLOAD)                      */}
        {/* ==================================================================== */}
        {activeSubTab === "docs" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Upload Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xs font-bold text-gray-500 uppercase">Filtrer :</span>
                {["ALL", "CONSTAT", "PHOTOS", "DEVIS", "EXPERTISE", "FACTURE", "AUTRE"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterDocCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                      filterDocCategory === cat
                        ? "bg-purple-600 text-white shadow-2xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat === "ALL" ? "Tous" : cat}
                  </button>
                ))}
              </div>

              {/* Upload Input */}
              <div className="flex items-center gap-2">
                <select
                  value={uploadCategory}
                  onChange={(e: any) => setUploadCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 cursor-pointer"
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingDoc}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isUploadingDoc ? "Upload..." : "Ajouter Photo / PDF"}</span>
                </button>
              </div>
            </div>

            {/* Documents & Photos Grid */}
            {filteredDocs.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 space-y-2">
                <ImageIcon className="w-8 h-8 text-gray-300 mx-auto" />
                <div className="font-bold text-gray-700 text-sm">Aucun document dans cette catégorie</div>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Ajoutez les photos des dégâts, le constat amiable ou le rapport d&apos;expertise via le bouton ci-dessus.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocs.map((doc) => {
                  const isImage = doc.fileType?.startsWith("image/") || doc.fileUrl?.startsWith("data:image");

                  return (
                    <div
                      key={doc.id}
                      className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group"
                    >
                      {/* Image Preview or PDF Header */}
                      {isImage ? (
                        <div
                          onClick={() => setPreviewDoc(doc)}
                          className="h-44 bg-gray-100 overflow-hidden relative cursor-pointer group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={doc.fileUrl}
                            alt={doc.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                            <Eye className="w-4 h-4" />
                            <span>Agrandir</span>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => window.open(doc.fileUrl, "_blank")}
                          className="h-32 bg-purple-50 flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-purple-100/70 transition-colors"
                        >
                          <FileText className="w-8 h-8 text-purple-600 mb-1" />
                          <span className="text-2xs font-bold text-purple-900 uppercase">Document PDF</span>
                        </div>
                      )}

                      {/* Doc Details */}
                      <div className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-2xs">
                          <span className="font-extrabold text-purple-900 bg-purple-100 px-2 py-0.5 rounded">
                            {doc.category}
                          </span>
                          <span className="text-gray-400 font-mono">
                            {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-gray-800 truncate" title={doc.name}>
                          {doc.name}
                        </div>

                        {doc.author && (
                          <div className="text-3xs text-gray-400">
                            Ajouté par : {doc.author}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-1.5">
                            {isImage ? (
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-2xs font-bold flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Voir</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => window.open(doc.fileUrl, "_blank")}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-2xs font-bold flex items-center gap-1"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Ouvrir</span>
                              </button>
                            )}

                            <a
                              href={doc.fileUrl}
                              download={doc.name}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-2xs font-bold flex items-center gap-1"
                              title="Télécharger"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id, doc.name)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: ℹ️ FICHE VEHICULE & CHAUFFEUR                                */}
        {/* ==================================================================== */}
        {activeSubTab === "vehicle" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Technical specs */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
              <h5 className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                <span>🚗</span> Spécifications Techniques du Véhicule
              </h5>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-3xs text-gray-400 uppercase block font-bold">Immatriculation</span>
                  <span className="font-mono font-black text-sm text-navy">{claim.vehicle.plate_number}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-3xs text-gray-400 uppercase block font-bold">Marque & Modèle</span>
                  <span className="font-bold text-gray-800">{claim.vehicle.make_model || "N/A"}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-3xs text-gray-400 uppercase block font-bold">Année</span>
                  <span className="font-bold text-gray-800">{(claim.vehicle as any).year || "N/A"}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-3xs text-gray-400 uppercase block font-bold">Ville / Hub</span>
                  <span className="font-bold text-gray-800">{(claim.vehicle as any).hub_city || "Casablanca"}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-3xs text-gray-400 uppercase block font-bold">Kilométrage Compteur</span>
                  <span className="font-mono font-bold text-gray-800">{((claim.vehicle as any).current_mileage || 0).toLocaleString()} KM</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-3xs text-gray-400 uppercase block font-bold">Code Châssis (VIN)</span>
                  <span className="font-mono text-2xs text-gray-800">{(claim.vehicle as any).vin || "Non renseigné"}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-3xs text-gray-400 uppercase block font-bold">Statut Flotte Global</span>
                  <span className="font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    {(claim.vehicle as any).status || "Accident"}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-3xs text-gray-400 uppercase block font-bold">Arrêt Total Dossier</span>
                  <span className="font-bold text-gray-800">{totalDays} jours</span>
                </div>
                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl">
                  <span className="text-3xs text-amber-800 uppercase block font-bold">Garage de Réparation</span>
                  <span className="font-extrabold text-amber-950 text-xs flex items-center gap-1">
                    <span>🏬</span> {garageName || "Emergence"}
                  </span>
                </div>
              </div>
            </div>

            {/* Regulatory compliance expirations */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
              <h5 className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                <span>🛡️</span> Échéances Réglementaires & Assurances
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-3xs text-gray-500 uppercase block font-bold mb-1">Assureur & Police</span>
                  <div className="font-bold text-gray-900 flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>{insuranceCompany || "Sanlam"}</span>
                  </div>
                  <div className="font-mono text-2xs text-gray-600 mt-0.5">
                    {(claim.vehicle as any).insurance_policy_number || policyNumber || "Police N/A"}
                  </div>
                  <div className="text-3xs text-gray-400 mt-1">
                    Expire le : {(claim.vehicle as any).insurance_expiry_date ? new Date((claim.vehicle as any).insurance_expiry_date).toLocaleDateString("fr-FR") : "N/A"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-3xs text-gray-500 uppercase block font-bold mb-1">Taxe Vignette</span>
                  <div className="font-semibold text-gray-800">
                    {(claim.vehicle as any).vignette_expiry_date ? new Date((claim.vehicle as any).vignette_expiry_date).toLocaleDateString("fr-FR") : "N/A"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-3xs text-gray-500 uppercase block font-bold mb-1">Visite Technique</span>
                  <div className="font-semibold text-gray-800">
                    {(claim.vehicle as any).technical_inspection_expiry ? new Date((claim.vehicle as any).technical_inspection_expiry).toLocaleDateString("fr-FR") : "N/A"}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-3xs text-gray-500 uppercase block font-bold mb-1">Autorisation Circulation</span>
                  <div className="font-semibold text-gray-800">
                    {(claim.vehicle as any).autorisation_expiry_date ? new Date((claim.vehicle as any).autorisation_expiry_date).toLocaleDateString("fr-FR") : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Driver Profile */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
              <h5 className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-2">
                <span>👤</span> Profil & Historique Chauffeur
              </h5>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-gray-900">{claim.driver_name || "Chauffeur non affecté"}</span>
                    {claim.is_driver_red_flagged && (
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-3xs font-extrabold uppercase">
                        🚩 Red Flag : {claim.driver_red_flag_reason || "Signalé"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 flex items-center gap-3">
                    <span>Téléphone : <strong>{claim.driver_phone || "Non renseigné"}</strong></span>
                    {(claim.driver as any)?.cinNumber && (
                      <span>· CIN : <strong>{(claim.driver as any).cinNumber}</strong></span>
                    )}
                  </div>
                </div>

                {claim.driver_phone && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${claim.driver_phone}`}
                      className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Appeler</span>
                    </a>
                    {getWhatsAppLink(claim.driver_phone) && (
                      <a
                        href={getWhatsAppLink(claim.driver_phone)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: 💬 JOURNAL D'ÉCHANGE & HISTORIQUE                            */}
        {/* ==================================================================== */}
        {activeSubTab === "comments" && (
          <div className="space-y-5 animate-fadeIn">
            {/* Add note */}
            <form onSubmit={handleSaveGeneralComment} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <label className="block text-xs font-black text-navy uppercase tracking-wider">
                Consigner un événement ou commentaire au journal :
              </label>
              <div className="flex items-start gap-2">
                <textarea
                  rows={2}
                  value={generalCommentText}
                  onChange={(e) => setGeneralCommentText(e.target.value)}
                  placeholder="Écrivez un commentaire relatif à ce sinistre ou aux réparations..."
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-800 focus:bg-white focus:outline-none resize-none"
                />
                <button
                  type="submit"
                  disabled={!generalCommentText.trim() || isSavingComment}
                  className="px-4 py-2 bg-navy hover:bg-navy-light text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 h-[4.5rem]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>

            {/* List of comments */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <h5 className="text-xs font-black text-navy uppercase tracking-wider border-b border-gray-100 pb-2">
                Historique Chronologique ({commentsList.filter((c: any) => c.id !== "INSURANCE_DOSSIER_META").length})
              </h5>

              {commentsList.filter((c: any) => c.id !== "INSURANCE_DOSSIER_META").length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  Aucun commentaire consigné pour le moment.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                  {commentsList
                    .filter((c: any) => c.id !== "INSURANCE_DOSSIER_META")
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-2xs text-gray-500">
                          <span className="font-bold text-navy flex items-center gap-1.5">
                            <span>👤</span> {item.author || "Agent"}
                          </span>
                          <span className="font-mono text-gray-400">
                            {new Date(item.created_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-gray-800 font-sans leading-relaxed">{item.comment}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 4. LIGHTBOX PREVIEW MODAL FOR PHOTOS & DOCUMENTS                       */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-navy text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold truncate">
                <span>📸 {previewDoc.name}</span>
                <span className="text-2xs bg-white/20 px-2 py-0.5 rounded uppercase font-mono">
                  {previewDoc.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.fileUrl}
                  download={previewDoc.name}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/5 min-h-[300px]">
              {previewDoc.fileType?.startsWith("image/") || previewDoc.fileUrl?.startsWith("data:image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.name}
                  className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-md"
                />
              ) : (
                <div className="text-center p-8 text-gray-500 space-y-3">
                  <FileText className="w-16 h-16 text-purple-600 mx-auto" />
                  <div className="font-bold text-gray-800">{previewDoc.name}</div>
                  <a
                    href={previewDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-purple-700"
                  >
                    <ExternalLink className="w-4 h-4" /> Ouvrir dans un nouvel onglet
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* 5. MODAL: DISPATCH TELEGRAM MISSION TO FIELD SUPERVISOR                */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {openTelegramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h5 className="text-sm font-black flex items-center gap-2">
                  <span>🚀</span> Créer & Déclencher une Mission Terrain
                </h5>
                <p className="text-xs text-purple-100 mt-0.5 truncate">
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 font-bold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none cursor-pointer"
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
                            : "bg-purple-600 text-white border-purple-600 shadow-sm"
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none cursor-pointer"
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
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
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
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Notification Telegram checkbox */}
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="telegramAlertCheckDetail"
                  checked={missionSendTelegram}
                  onChange={(e) => setMissionSendTelegram(e.target.checked)}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="telegramAlertCheckDetail" className="text-2xs text-purple-900 cursor-pointer">
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
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-all"
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
    </div>
  );
}
