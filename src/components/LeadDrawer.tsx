"use client";

/**
 * LeadDrawer Component
 * 
 * A sliding sidebar drawer (slides in from the right) that displays lead details
 * and handles status updates, city selection, KYC document checklists, preorder amounts,
 * and WhatsApp invitation/thank-you redirects.
 */

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import {
  generateTrainingInviteURL,
  generateThankYouURL,
  formatDisplayPhone,
  getTemplateForLeadStatus,
  formatLeadWhatsAppMessage,
  generateWhatsAppWebURL,
  LEAD_STATUS_TEMPLATES,
  LeadStatusTemplateDef,
} from "@/lib/whatsapp";

const BRAND_STATUS_OPTIONS = [
  "Not interested",
  "No response 1",
  "Training fixed",
  "To Recall",
  "Wrong number",
  "No response 2",
  "Already a client",
] as const;

const TRAINING_STATUS_OPTIONS = [
  "Scheduled",
  "Attended",
  "Attended and not interested",
  "Pending",
  "Refused the offer",
  "Assign vehicle",
  "Not attended",
  "No response",
  "Preorder",
] as const;

const MOROCCAN_CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tangier",
  "Fez",
  "Agadir",
  "Meknes",
  "Oujda",
  "Kenitra",
  "Tetouan",
  "Safi",
  "Mohammedia",
  "El Jadida",
  "Other",
] as const;

function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface Lead {
  id: string;
  raw_name: string;
  sanitized_phone: string;
  board_column: string;
  brand_status: string | null;
  training_status: string | null;
  reminder_date: string | null;
  preorder_amount: number | null;
  city: string | null;
  has_cin: boolean;
  has_fiche_anthropometrique: boolean;
  has_confirmation_adresse: boolean;
  has_permis: boolean;
  campaign_source: string;
  created_at: string;
  status_changed_at?: string | null;
  handled_by?: string | null;
  notes?: string | null;
  presence_confirmed?: boolean;
  presence_confirmed_at?: string | null;
}

interface LeadDrawerProps {
  lead: Lead;
  boardType: "leads" | "training";
  onClose: () => void;
  onUpdate: (updatedLead: Lead) => void;
  whatsappTemplate?: string;
  whatsappMissingDocsTemplate?: string;
  onOpenWhatsAppChat?: (phone: string, name: string) => void;
}

export default function LeadDrawer({
  lead,
  boardType,
  onClose,
  onUpdate,
  whatsappTemplate,
  whatsappMissingDocsTemplate,
  onOpenWhatsAppChat,
}: LeadDrawerProps) {
  const { data: session } = useSession();
  const [brandStatus, setBrandStatus] = useState(lead.board_column === "NEW_LEADS" ? "NEW_LEADS" : (lead.brand_status || ""));
  const [trainingStatus, setTrainingStatus] = useState(lead.training_status || "");
  const [city, setCity] = useState(lead.city || "");
  const [presenceConfirmed, setPresenceConfirmed] = useState(Boolean(lead.presence_confirmed));
  
  // KYC Checklist State
  const [hasCin, setHasCin] = useState(lead.has_cin);
  const [hasFiche, setHasFiche] = useState(lead.has_fiche_anthropometrique);
  const [hasConfirmation, setHasConfirmation] = useState(lead.has_confirmation_adresse);
  const [hasPermis, setHasPermis] = useState(lead.has_permis);

  const [trainingDate, setTrainingDate] = useState(
    lead.reminder_date ? new Date(lead.reminder_date).toISOString().split("T")[0] : ""
  );
  const [reminderDate, setReminderDate] = useState(
    lead.reminder_date ? lead.reminder_date.split("T")[0] : ""
  );
  const [preorderAmount, setPreorderAmount] = useState<string>(
    lead.preorder_amount !== null ? String(lead.preorder_amount) : ""
  );

  const [recallDate, setRecallDate] = useState(() => {
    if (lead.brand_status === "To Recall") {
      if (lead.reminder_date) {
        return new Date(lead.reminder_date).toISOString().split("T")[0];
      }
      return getTodayDateStr();
    }
    return "";
  });
  const [recallTime, setRecallTime] = useState(
    lead.brand_status === "To Recall" && lead.reminder_date
      ? new Date(lead.reminder_date).toTimeString().slice(0, 5)
      : ""
  );

  // Auto-default recallDate to today whenever Brand Status is set to "To Recall"
  useEffect(() => {
    if (boardType === "leads" && brandStatus === "To Recall" && !recallDate) {
      setRecallDate(getTodayDateStr());
    }
  }, [boardType, brandStatus, recallDate]);

  const [notes, setNotes] = useState<string>(lead.notes || "");
  const [isRecalled, setIsRecalled] = useState<boolean>(false);

  const [validationError, setValidationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Available vehicles state for Assign vehicle status
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

  // Fetch available vehicles when Assign vehicle is selected
  useEffect(() => {
    if (trainingStatus === "Assign vehicle" || trainingStatus === "Accept offer") {
      setIsLoadingVehicles(true);
      fetch("/api/vehicles")
        .then((res) => res.json())
        .then((data) => {
          if (data.vehicles) {
            setVehicles(data.vehicles);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingVehicles(false));
    }
  }, [trainingStatus]);

  // Trigger slide-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // WhatsApp Direct Hub State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [waMessageText, setWaMessageText] = useState<string>("");
  const [isManualEdit, setIsManualEdit] = useState<boolean>(false);
  const [isSendingWa, setIsSendingWa] = useState<boolean>(false);
  const [waSentSuccessAt, setWaSentSuccessAt] = useState<string | null>(null);
  const [waDeliveryMode, setWaDeliveryMode] = useState<string | null>(null);
  const [recentWaMessages, setRecentWaMessages] = useState<any[]>([]);
  const [isLoadingWaHistory, setIsLoadingWaHistory] = useState<boolean>(false);

  // ── Activity Log ──────────────────────────────────────────────────────────
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [newLogText, setNewLogText] = useState("");
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  const fetchActivityLog = React.useCallback(() => {
    setIsLoadingActivity(true);
    fetch(`/api/leads/${lead.id}/activity`)
      .then((r) => r.json())
      .then((d) => setActivityLogs(d.logs || []))
      .catch(() => setActivityLogs([]))
      .finally(() => setIsLoadingActivity(false));
  }, [lead.id]);

  useEffect(() => {
    fetchActivityLog();
  }, [fetchActivityLog]);

  const handleAddActivityLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogText.trim() || isSubmittingLog) return;
    setIsSubmittingLog(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "NOTE_ADDED",
          detail: newLogText.trim(),
          agent: session?.user?.name || session?.user?.email || "Agent",
        }),
      });
      if (res.ok) {
        setNewLogText("");
        fetchActivityLog();
        toast.success("Événement consigné au journal");
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmittingLog(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  // Missing documents list for KYC template
  const missingDocsList: string[] = [];
  if (!hasCin) missingDocsList.push("Carte Nationale d'Identité (CIN)");
  if (!hasFiche) missingDocsList.push("Fiche anthropométrique (Casier judiciaire)");
  if (!hasConfirmation) missingDocsList.push("Confirmation / Justificatif d'adresse");
  if (!hasPermis) missingDocsList.push("Permis de conduire (2+ ans)");

  // Active status key based on board
  const activeStatusKey = boardType === "leads" ? (brandStatus || "NEW_LEADS") : (trainingStatus || "Scheduled");

  // Re-generate or update template text when active status or context fields change
  useEffect(() => {
    if (isManualEdit) return;

    const resolvedTemplate = getTemplateForLeadStatus(
      boardType,
      activeStatusKey,
      whatsappTemplate,
      whatsappMissingDocsTemplate
    );

    setSelectedTemplateId(resolvedTemplate.id);

    const formatted = formatLeadWhatsAppMessage(resolvedTemplate.template, {
      name: lead.raw_name,
      city: city || lead.city || "Casablanca",
      date: trainingDate || recallDate || "",
      time: recallTime ? recallTime : undefined,
      missingDocs: missingDocsList,
      amount: preorderAmount ? `${preorderAmount} MAD` : undefined,
    });

    setWaMessageText(formatted);
  }, [
    activeStatusKey,
    boardType,
    city,
    trainingDate,
    recallDate,
    recallTime,
    hasCin,
    hasFiche,
    hasConfirmation,
    hasPermis,
    preorderAmount,
    whatsappTemplate,
    whatsappMissingDocsTemplate,
    isManualEdit,
  ]);

  // Handle template selection from dropdown
  const handleSelectCustomTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const found = LEAD_STATUS_TEMPLATES.find((t) => t.id === templateId);
    if (found) {
      let tmplText = found.template;
      if (found.id === "LEADS_TRAINING_FIXED" && whatsappTemplate?.trim()) {
        tmplText = whatsappTemplate.trim();
      } else if (found.id === "TRAINING_PENDING_KYC" && whatsappMissingDocsTemplate?.trim()) {
        tmplText = whatsappMissingDocsTemplate.trim();
      }

      const formatted = formatLeadWhatsAppMessage(tmplText, {
        name: lead.raw_name,
        city: city || lead.city || "Casablanca",
        date: trainingDate || recallDate || "",
        time: recallTime ? recallTime : undefined,
        missingDocs: missingDocsList,
        amount: preorderAmount ? `${preorderAmount} MAD` : undefined,
      });
      setWaMessageText(formatted);
      setIsManualEdit(false);
    }
  };

  // Reset template to active status default
  const handleResetTemplate = () => {
    setIsManualEdit(false);
    const resolvedTemplate = getTemplateForLeadStatus(
      boardType,
      activeStatusKey,
      whatsappTemplate,
      whatsappMissingDocsTemplate
    );
    setSelectedTemplateId(resolvedTemplate.id);
    const formatted = formatLeadWhatsAppMessage(resolvedTemplate.template, {
      name: lead.raw_name,
      city: city || lead.city || "Casablanca",
      date: trainingDate || recallDate || "",
      time: recallTime ? recallTime : undefined,
      missingDocs: missingDocsList,
      amount: preorderAmount ? `${preorderAmount} MAD` : undefined,
    });
    setWaMessageText(formatted);
    toast.success("Modèle réinitialisé au statut actif");
  };

  // Fetch recent message history with this lead
  const fetchRecentWaMessages = async () => {
    if (!lead?.sanitized_phone) return;
    setIsLoadingWaHistory(true);
    try {
      const convRes = await fetch(
        `/api/whatsapp/conversations?search=${encodeURIComponent(lead.sanitized_phone)}`
      );
      if (convRes.ok) {
        const convData = await convRes.json();
        const convList = convData.conversations || [];
        if (convList.length > 0) {
          const convId = convList[0].id;
          const msgRes = await fetch(`/api/whatsapp/messages?conversationId=${convId}`);
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            const msgs = msgData.messages || [];
            setRecentWaMessages(msgs.slice(-3));
          }
        }
      }
    } catch (e) {
      console.error("Failed to load recent WhatsApp messages:", e);
    } finally {
      setIsLoadingWaHistory(false);
    }
  };

  useEffect(() => {
    fetchRecentWaMessages();
  }, [lead?.sanitized_phone]);

  // Send message via GoCab WhatsApp CRM API (Meta Cloud API / DB CRM)
  const handleSendWhatsAppApi = async () => {
    if (!waMessageText.trim()) {
      toast.error("Le message WhatsApp est vide");
      return;
    }
    setIsSendingWa(true);
    try {
      const res = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: lead.sanitized_phone,
          text: waMessageText.trim(),
          senderName: session?.user?.name || session?.user?.email || "GoCab Operations",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setWaSentSuccessAt(timeNow);
        setWaDeliveryMode(data.mode || "SENT");
        toast.success("✓ Message WhatsApp envoyé avec succès !");
        fetchRecentWaMessages();
        // Consigner l'envoi dans le journal d'activité
        fetch(`/api/leads/${lead.id}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "WHATSAPP_SENT",
            detail: `Message WhatsApp envoyé : "${waMessageText.slice(0, 60)}${waMessageText.length > 60 ? "..." : ""}"`,
            agent: session?.user?.name || session?.user?.email || "Agent",
          }),
        }).then(() => fetchActivityLog()).catch(() => {});
      } else {
        toast.error(data.error || "Échec d'envoi du message WhatsApp");
      }
    } catch (err: any) {
      console.error("Send WhatsApp error:", err);
      toast.error(err.message || "Erreur lors de l'envoi WhatsApp");
    } finally {
      setIsSendingWa(false);
    }
  };

  // Open message in WhatsApp Web / wa.me
  const handleOpenWhatsAppWeb = () => {
    const url = generateWhatsAppWebURL(lead.sanitized_phone, waMessageText);
    window.open(url, "_blank");
    fetch(`/api/leads/${lead.id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "WHATSAPP_OPENED",
        detail: "Discussion ouverte sur WhatsApp Web",
        agent: session?.user?.name || session?.user?.email || "Agent",
      }),
    }).then(() => fetchActivityLog()).catch(() => {});
  };

  // Jump to full WhatsApp CRM tab
  const handleJumpToWhatsAppCrm = () => {
    if (onOpenWhatsAppChat) {
      onOpenWhatsAppChat(lead.sanitized_phone, lead.raw_name);
    } else {
      try {
        localStorage.setItem("gocab_target_whatsapp_phone", lead.sanitized_phone);
      } catch (e) {}
      onClose();
    }
  };

  const showDatePicker =
    (boardType === "leads" && brandStatus === "Training fixed") ||
    (boardType === "training" && (trainingStatus === "Scheduled" || !trainingStatus));
  const showRecallPicker = boardType === "leads" && brandStatus === "To Recall";
  const showReminderPicker = boardType === "training" && trainingStatus === "Pending";
  const showPreorderInput = boardType === "training" && trainingStatus === "Preorder";

  async function handleSave() {
    setValidationError("");
    setIsSubmitting(true);

    try {
      const payload: Record<string, any> = {
        city: city || null,
        notes: notes || null,
      };

      if (isRecalled) {
        payload.is_recalled = true;
        payload.mark_as_called = true;
      }

      if (boardType === "leads") {
        if (brandStatus === "NEW_LEADS" || !brandStatus) {
          payload.board_column = "NEW_LEADS";
          payload.brand_status = null;
        } else if (brandStatus === "Training fixed") {
          // Move from leads page to training page
          payload.board_column = "TRAINING_PIPELINE";
          payload.training_status = "Scheduled"; // first status for moved leads
          payload.brand_status = "Training fixed";

          if (trainingDate) {
            const date = new Date(trainingDate);
            payload.reminder_date = date.toISOString(); // Use reminder_date to track scheduled training date

            // Auto-trigger WhatsApp confirmation message if not already sent in drawer
            if (!waSentSuccessAt) {
              const waUrl = generateWhatsAppWebURL(lead.sanitized_phone, waMessageText);
              window.open(waUrl, "_blank");
            }
          }
        } else if (brandStatus === "To Recall") {
          // Move to To Recall with scheduled recall datetime
          payload.board_column = "BRAND_PRE_FILTER";
          payload.brand_status = "To Recall";

          const effectiveRecallDate = recallDate || getTodayDateStr();
          if (effectiveRecallDate) {
            if (recallTime) {
              // Specific time: YYYY-MM-DDTHH:MM:00
              payload.reminder_date = new Date(`${effectiveRecallDate}T${recallTime}:00`).toISOString();
            } else {
              // Only date: scheduled for midnight (end of day)
              payload.reminder_date = new Date(`${effectiveRecallDate}T23:59:59.999`).toISOString();
            }
          }
        } else {
          // Any other brand status means it's no longer a new lead
          payload.board_column = "BRAND_PRE_FILTER";
          payload.brand_status = brandStatus;
        }
      } else {
        payload.training_status = trainingStatus;
        
        // Save checklist state
        payload.has_cin = hasCin;
        payload.has_fiche_anthropometrique = hasFiche;
        payload.has_confirmation_adresse = hasConfirmation;
        payload.has_permis = hasPermis;

        if (trainingStatus === "Scheduled" || !trainingStatus) {
          payload.board_column = "TRAINING_PIPELINE";
          payload.training_status = "Scheduled";
          payload.brand_status = "Training fixed";
          if (trainingDate) {
            payload.reminder_date = new Date(trainingDate).toISOString();
          }
        } else if (trainingStatus === "Assign vehicle" || trainingStatus === "Accept offer") {
          // Validation checklist check: All 4 documents must be checked
          const isKycComplete = hasCin && hasFiche && hasConfirmation && hasPermis;
          if (!isKycComplete) {
            setValidationError(
              "⚠️ KYC Checklist Incomplete! Please verify CIN, Fiche anthropométrique, Confirmation d'adresse, and Permis to proceed to Assign vehicle."
            );
            setIsSubmitting(false);
            return;
          }

          // Move to vehicle assignment
          payload.board_column = "VEHICLE_ASSIGNMENT";
          payload.training_status = "Assign vehicle";
          if (selectedVehicleId) {
            payload.assigned_vehicle_id = selectedVehicleId;
          }

          // Auto-trigger WhatsApp thank-you message if not already sent
          if (!waSentSuccessAt) {
            const waUrl = generateThankYouURL(lead.sanitized_phone);
            window.open(waUrl, "_blank");
          }

          // Fire unlock alert
          setTimeout(() => {
            alert("🚗 Assign Vehicle Module Unlocked");
          }, 300);
        } else if (trainingStatus === "Pending") {
          payload.board_column = "TRAINING_PIPELINE";
          if (reminderDate) {
            payload.reminder_date = new Date(reminderDate).toISOString();
          }
        } else if (trainingStatus === "Preorder") {
          payload.board_column = "TRAINING_PIPELINE";
          payload.preorder_amount = preorderAmount ? parseFloat(preorderAmount) : null;
        } else {
        }
      }

      // Record agent attribution
      payload.handled_by = session?.user?.name || session?.user?.email || lead.handled_by || "Agent";
      payload.presence_confirmed = presenceConfirmed;

      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Lead updated successfully");
        // Refresh activity log before closing so it's ready next open
        fetchActivityLog();
        onUpdate(data.lead);
        handleClose();
      } else if (res.status === 422) {
        toast.error("Validation failed");
      } else {
        toast.error("Failed to update lead");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save updates");
      console.error("Failed to save updates:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for transition animation to complete
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
        <div className="bg-navy px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="text-base font-bold tracking-tight">{lead.raw_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-white/70 font-mono">{formatDisplayPhone(lead.sanitized_phone)}</p>
              <button
                type="button"
                onClick={handleJumpToWhatsAppCrm}
                title="Accéder au CRM WhatsApp"
                className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                <span>💬 CRM Chat</span>
              </button>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Card */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-xs text-gray-600 space-y-2">
            <p><span className="font-semibold text-gray-800">Source:</span> {lead.campaign_source}</p>
            <p><span className="font-semibold text-gray-800">Created At:</span> {new Date(lead.created_at).toLocaleString()}</p>
          </div>

          {/* City Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
              <span>📍</span> Choose City
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
            >
              <option value="">Select City...</option>
              {MOROCCAN_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdowns & Board Specific Flow */}
          {boardType === "leads" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Brand Status
                </label>
                <select
                  value={brandStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setBrandStatus(newStatus);
                    setTrainingDate("");
                    setIsManualEdit(false);
                    setWaSentSuccessAt(null);
                    if (newStatus === "To Recall" && !recallDate) {
                      setRecallDate(getTodayDateStr());
                    }
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
                >
                  <option value="">Select Brand Status...</option>
                  <option value="NEW_LEADS">✨ New Leads (Return to Intake)</option>
                  {BRAND_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional Date Picker for Training fixed */}
              {showDatePicker && (
                <div className="animate-slide-down">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Choose Training Date
                  </label>
                  <input
                    type="date"
                    value={trainingDate}
                    onChange={(e) => setTrainingDate(e.target.value)}
                    min={getTodayDateStr()}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
                  />
                  <p className="text-xs text-gray-500 mt-2 leading-normal">
                    📌 Setting <strong>Training fixed</strong> will automatically send the customized WhatsApp invitation and move the driver to the Training board.
                  </p>
                </div>
              )}

              {/* Conditional Recall Date & Time Picker for "To Recall" */}
              {showRecallPicker && (
                <div className="animate-slide-down p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span>📅</span>
                      <span>Programmer la Date & Heure du Rappel</span>
                    </label>
                    <span className="text-3xs font-semibold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full">
                      Auto-Retour New Leads
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-3xs font-bold text-amber-900 mb-1">
                        Date du Rappel *
                      </label>
                      <input
                        type="date"
                        value={recallDate}
                        onChange={(e) => setRecallDate(e.target.value)}
                        min={getTodayDateStr()}
                        className="w-full border border-amber-300 bg-white rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-3xs font-bold text-amber-900 mb-1">
                        Heure du Rappel (Optionnel)
                      </label>
                      <input
                        type="time"
                        value={recallTime}
                        onChange={(e) => setRecallTime(e.target.value)}
                        className="w-full border border-amber-300 bg-white rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  {/* Quick shortcuts */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-3xs text-amber-800 font-semibold">Raccourcis :</span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setMinutes(d.getMinutes() + 15);
                        setRecallDate(d.toISOString().split("T")[0]);
                        setRecallTime(d.toTimeString().slice(0, 5));
                      }}
                      className="px-2 py-0.5 bg-amber-100/90 hover:bg-amber-200 text-amber-900 rounded-lg text-3xs font-bold transition-colors cursor-pointer"
                    >
                      +15 min
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setMinutes(d.getMinutes() + 30);
                        setRecallDate(d.toISOString().split("T")[0]);
                        setRecallTime(d.toTimeString().slice(0, 5));
                      }}
                      className="px-2 py-0.5 bg-amber-100/90 hover:bg-amber-200 text-amber-900 rounded-lg text-3xs font-bold transition-colors cursor-pointer"
                    >
                      +30 min
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setHours(d.getHours() + 2);
                        setRecallDate(d.toISOString().split("T")[0]);
                        setRecallTime(d.toTimeString().slice(0, 5));
                      }}
                      className="px-2 py-0.5 bg-amber-100/90 hover:bg-amber-200 text-amber-900 rounded-lg text-3xs font-bold transition-colors cursor-pointer"
                    >
                      +2h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setRecallDate(tomorrow.toISOString().split("T")[0]);
                        setRecallTime("11:00");
                      }}
                      className="px-2 py-0.5 bg-amber-100/90 hover:bg-amber-200 text-amber-900 rounded-lg text-3xs font-bold transition-colors cursor-pointer"
                    >
                      Demain à 11h
                    </button>
                  </div>

                  <p className="text-2xs text-amber-800/80 leading-tight">
                    ℹ️ <strong>Règle automatique :</strong> Si l&apos;heure est fixée, le prospect retournera en haut de la colonne <strong>New Leads</strong> dès que l&apos;heure arrive. Si seule la date est fixée, il restera dans &quot;To Recall&quot; et retournera dans &quot;New Leads&quot; à minuit.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Training Status Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Training Status
                </label>
                <select
                  value={trainingStatus || "Scheduled"}
                  onChange={(e) => {
                    setTrainingStatus(e.target.value);
                    setReminderDate("");
                    setPreorderAmount("");
                    setIsManualEdit(false);
                    setWaSentSuccessAt(null);
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
                >
                  <option value="">Select Training Status...</option>
                  {TRAINING_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional Date Picker for Scheduled in Training Tab */}
              {(trainingStatus === "Scheduled" || !trainingStatus) && (
                <div className="animate-slide-down p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-1.5">
                  <label className="block text-xs font-bold text-navy flex items-center gap-1.5">
                    <span>📅</span> Date de Formation Prévue
                  </label>
                  <input
                    type="date"
                    value={trainingDate}
                    onChange={(e) => setTrainingDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full border border-blue-300 bg-white rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
                  />
                  <p className="text-2xs text-blue-900/70 leading-tight">
                    📌 La modification de la date est synchronisée instantanément sur la colonne <strong>Training Fixed</strong> (Prospects) et sur le tableau de Formation.
                  </p>
                </div>
              )}

              {/* Call to Confirm Presence Checkbox */}
              <div className="p-3.5 bg-gray-50 border border-gray-200/80 rounded-2xl flex items-center gap-3 hover:bg-emerald-50/50 hover:border-emerald-200 transition-colors">
                <input
                  type="checkbox"
                  id="drawer-presence-confirmed"
                  checked={presenceConfirmed}
                  onChange={(e) => setPresenceConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label
                  htmlFor="drawer-presence-confirmed"
                  className="text-xs font-semibold text-gray-800 cursor-pointer flex-1 flex items-center justify-between"
                >
                  <span>📞 Appel de confirmation de présence effectué</span>
                  {presenceConfirmed && (
                    <span className="text-2xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      ✓ Confirmé
                    </span>
                  )}
                </label>
              </div>

              {/* Conditional Date Picker for Pending */}
              {showReminderPicker && (
                <div className="animate-slide-down">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Set Reminder Date
                  </label>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
                  />
                </div>
              )}

              {/* Conditional Input for Preorder Vehicle Amount */}
              {showPreorderInput && (
                <div className="animate-slide-down">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Preorder Amount Given (MAD)
                  </label>
                  <input
                    type="number"
                    value={preorderAmount}
                    onChange={(e) => setPreorderAmount(e.target.value)}
                    min="0"
                    placeholder="Enter amount given"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy font-mono"
                  />
                </div>
              )}

              {/* Conditional Vehicle Selection for Assign vehicle */}
              {(trainingStatus === "Assign vehicle" || trainingStatus === "Accept offer") && (
                <div className="animate-slide-down p-4 bg-emerald-50/80 border border-emerald-300 rounded-2xl space-y-3">
                  {(() => {
                    const availableList = vehicles.filter((v) => {
                      const isAvail = v.status === "Available" || v.status === "DISPONIBLE";
                      if (!isAvail && v.id !== selectedVehicleId) return false;
                      if (!vehicleSearch.trim()) return true;
                      const q = vehicleSearch.toLowerCase();
                      return (
                        v.plate_number.toLowerCase().includes(q) ||
                        v.make_model.toLowerCase().includes(q) ||
                        (v.hub_city && v.hub_city.toLowerCase().includes(q))
                      );
                    });

                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-black text-emerald-950 flex items-center gap-1.5">
                            <span>🚗</span>
                            <span>Affecter un Véhicule Disponible</span>
                          </label>
                          <span className="text-3xs font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                            {availableList.length} Disponible(s)
                          </span>
                        </div>

                        <input
                          type="text"
                          placeholder="🔍 Rechercher immatriculation, modèle, ville..."
                          value={vehicleSearch}
                          onChange={(e) => setVehicleSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-400 outline-none"
                        />

                        {isLoadingVehicles ? (
                          <div className="py-3 text-center text-xs text-gray-500">Chargement des véhicules...</div>
                        ) : availableList.length === 0 ? (
                          <div className="py-3 text-center text-xs text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                            Aucun véhicule disponible trouvé.
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                            {availableList.map((v) => {
                              const isSelected = selectedVehicleId === v.id;
                              return (
                                <div
                                  key={v.id}
                                  onClick={() => setSelectedVehicleId(isSelected ? "" : v.id)}
                                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                    isSelected
                                      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm font-bold"
                                      : "bg-white text-gray-800 border-emerald-200 hover:bg-emerald-100/60"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold tracking-tight">{v.plate_number}</span>
                                      <span className={`text-3xs px-1.5 py-0.2 rounded font-medium ${
                                        isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                                      }`}>
                                        {v.hub_city}
                                      </span>
                                    </div>
                                    <p className={`text-2xs mt-0.5 ${isSelected ? "text-emerald-100" : "text-gray-500"}`}>
                                      {v.make_model} {v.year ? `(${v.year})` : ""} {v.current_mileage ? `• ${v.current_mileage.toLocaleString()} KM` : ""}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {isSelected ? (
                                      <span className="text-xs bg-white text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                        ✓ Sélectionné
                                      </span>
                                    ) : (
                                      <span className="text-3xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                        Choisir
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {selectedVehicleId && (
                          <p className="text-3xs text-emerald-800 font-medium">
                            ✓ Ce véhicule sera automatiquement affecté au chauffeur et passera au statut <strong>ACTIF</strong>.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* KYC Checklist Section */}
              <div className="bg-gray-50 border border-gray-200/60 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                  📁 Required KYC Documents Checklist
                </h4>
                
                <div className="space-y-2.5 pt-1">
                  <label className="flex items-center gap-3 text-sm text-gray-700 hover:text-gray-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasCin}
                      onChange={(e) => setHasCin(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-gray-300 text-navy focus:ring-navy cursor-pointer accent-navy"
                    />
                    <span>CIN (National ID Card)</span>
                  </label>

                  <label className="flex items-center gap-3 text-sm text-gray-700 hover:text-gray-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasFiche}
                      onChange={(e) => setHasFiche(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-gray-300 text-navy focus:ring-navy cursor-pointer accent-navy"
                    />
                    <span>Fiche anthropométrique (Criminal Record)</span>
                  </label>

                  <label className="flex items-center gap-3 text-sm text-gray-700 hover:text-gray-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasConfirmation}
                      onChange={(e) => setHasConfirmation(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-gray-300 text-navy focus:ring-navy cursor-pointer accent-navy"
                    />
                    <span>Confirmation d'adresse (Proof of Address)</span>
                  </label>

                  <label className="flex items-center gap-3 text-sm text-gray-700 hover:text-gray-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPermis}
                      onChange={(e) => setHasPermis(e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-gray-300 text-navy focus:ring-navy cursor-pointer accent-navy"
                    />
                    <span>Permis (Driver's License)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Recalled Status Checkbox (Leads pipeline only, for any lead not in new lead status) */}
          {boardType === "leads" && (lead.board_column !== "NEW_LEADS" || (brandStatus && brandStatus !== "NEW_LEADS")) && (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecalled}
                  onChange={(e) => setIsRecalled(e.target.checked)}
                  className="mt-0.5 w-4.5 h-4.5 rounded text-navy border-gray-300 focus:ring-navy cursor-pointer accent-navy"
                />
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-navy flex items-center gap-1.5">
                      <span>📞</span>
                      <span>Marquer comme Rappelé (+1 Appel Comptabilisé)</span>
                    </span>
                    {isRecalled && (
                      <span className="text-3xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Comptabilisé
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-gray-500">
                    Cochez cette case si vous avez rappelé ce prospect. Dès l&apos;enregistrement, cet appel sera comptabilisé dans vos objectifs journaliers.
                  </p>
                </div>
              </label>
              {lead.status_changed_at && (
                <div className="pt-2 border-t border-blue-200/50 text-3xs text-gray-400 font-mono flex items-center justify-between">
                  <span>Dernier appel / statut :</span>
                  <span className="font-semibold text-gray-600">
                    {new Date(lead.status_changed_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* WHATSAPP INTERFACE & STATUS-DRIVEN CRM HUB */}
          {/* ========================================================= */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 border-2 border-emerald-200/80 rounded-2xl p-4.5 space-y-4 shadow-xs">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs text-base font-bold">
                  💬
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-gray-900 tracking-tight">
                      WhatsApp CRM Direct
                    </h4>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full border border-emerald-200">
                      En direct
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono">
                    {formatDisplayPhone(lead.sanitized_phone)}
                  </p>
                </div>
              </div>

              {/* Jump to full CRM Tab */}
              <button
                type="button"
                onClick={handleJumpToWhatsAppCrm}
                title="Ouvrir dans l'interface complète WhatsApp CRM"
                className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 text-2xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <span>Accéder au CRM</span>
                <span className="text-xs">↗</span>
              </button>
            </div>

            {/* Template Selector & Status Indicator */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-2xs">
                <label className="font-bold text-emerald-950 flex items-center gap-1">
                  <span>⚡</span> Modèle adapté au statut :
                </label>
                <span className="font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  {activeStatusKey || "Statut actuel"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectCustomTemplate(e.target.value)}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-800 font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                >
                  <optgroup label="Modèle recommandé pour ce statut">
                    {(() => {
                      const matched = getTemplateForLeadStatus(
                        boardType,
                        activeStatusKey,
                        whatsappTemplate,
                        whatsappMissingDocsTemplate
                      );
                      return (
                        <option value={matched.id}>
                          {matched.icon} {matched.title} (Recommandé)
                        </option>
                      );
                    })()}
                  </optgroup>
                  <optgroup label="Autres modèles disponibles">
                    {LEAD_STATUS_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.icon} {tmpl.title} ({tmpl.category})
                      </option>
                    ))}
                  </optgroup>
                </select>

                {isManualEdit && (
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    title="Réinitialiser au texte initial du statut"
                    className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-3xs font-bold shrink-0 transition-colors"
                  >
                    ↺ Reset
                  </button>
                )}
              </div>
            </div>

            {/* Message Textarea */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span className="text-3xs text-emerald-900/70 font-semibold">
                  Aperçu & Personnalisation du message :
                </span>
                <span className="text-3xs font-mono">{waMessageText.length} car.</span>
              </div>

              <textarea
                rows={4}
                value={waMessageText}
                onChange={(e) => {
                  setWaMessageText(e.target.value);
                  setIsManualEdit(true);
                }}
                placeholder="Écrivez le message WhatsApp..."
                className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-xs text-gray-800 focus:ring-2 focus:ring-emerald-400 focus:outline-none font-sans leading-relaxed resize-none shadow-inner"
              />

              {/* Tags info pill */}
              <div className="flex items-center gap-1.5 flex-wrap text-3xs text-emerald-900/60 pt-0.5">
                <span className="font-semibold text-emerald-900">Variables insérées :</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-emerald-100">Nom: {lead.raw_name.split(" ")[0]}</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-emerald-100">Ville: {city || lead.city || "Casablanca"}</span>
                {(trainingDate || recallDate) && (
                  <span className="bg-white px-1.5 py-0.5 rounded border border-emerald-100">Date: {trainingDate || recallDate}</span>
                )}
              </div>
            </div>

            {/* Success feedback badge */}
            {waSentSuccessAt && (
              <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between animate-fadeIn">
                <span className="flex items-center gap-1.5 font-bold">
                  <span>✓</span> Message WhatsApp envoyé à {waSentSuccessAt}
                </span>
                <span className="text-3xs font-mono bg-white px-1.5 py-0.5 rounded text-emerald-800">
                  {waDeliveryMode === "META_CLOUD_API" ? "Meta API Direct" : "GoCab CRM"}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSendWhatsAppApi}
                disabled={isSendingWa || !waMessageText.trim()}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSendingWa ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>⚡</span>
                )}
                <span>Envoyer via WhatsApp API</span>
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsAppWeb}
                disabled={!waMessageText.trim()}
                className="w-full py-2.5 px-3 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>💬</span>
                <span>Ouvrir WhatsApp Web</span>
              </button>
            </div>

            {/* Mini Message History */}
            {recentWaMessages.length > 0 && (
              <div className="pt-2 border-t border-emerald-100/80 space-y-1.5">
                <div className="flex items-center justify-between text-3xs font-bold text-emerald-900">
                  <span>Derniers messages échangés :</span>
                  <button
                    type="button"
                    onClick={handleJumpToWhatsAppCrm}
                    className="text-emerald-700 hover:underline cursor-pointer"
                  >
                    Voir toute la discussion ({recentWaMessages.length})
                  </button>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {recentWaMessages.map((m: any) => (
                    <div
                      key={m.id}
                      className={`p-2 rounded-lg text-3xs leading-relaxed ${
                        m.direction === "OUTBOUND"
                          ? "bg-white border border-emerald-100 text-gray-700 ml-4"
                          : "bg-emerald-100/70 border border-emerald-200 text-emerald-950 mr-4"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px] text-gray-400 mb-0.5">
                        <span className="font-bold text-gray-600">{m.direction === "OUTBOUND" ? "Vous" : lead.raw_name}</span>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="line-clamp-2">{m.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              📝 Notes
              <span className="text-[10px] font-normal text-gray-500">(Optional context or history)</span>
            </label>
            <textarea
              rows={4}
              placeholder="Add notes about this prospect..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy resize-none"
            />
          </div>

          {/* ── Activity Log (Embedded in scrollable body) ────────────────────── */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <button
              type="button"
              onClick={() => setShowActivityLog((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/80 transition-colors text-xs font-bold text-slate-700"
            >
              <span className="flex items-center gap-2">
                <span>📋</span>
                Journal d&apos;activité
                {activityLogs.length > 0 && (
                  <span className="bg-navy/10 text-navy text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {activityLogs.length}
                  </span>
                )}
              </span>
              <span className="text-slate-400 text-xs">{showActivityLog ? "▲" : "▼"}</span>
            </button>

            {showActivityLog && (
              <div>
                {/* Quick Add Log Entry */}
                <form onSubmit={handleAddActivityLog} className="p-2.5 bg-slate-50/70 border-b border-slate-100 flex gap-2">
                  <input
                    type="text"
                    value={newLogText}
                    onChange={(e) => setNewLogText(e.target.value)}
                    placeholder="Consigner un événement (ex: Candidat injoignable, rappel demandé)..."
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy/30"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingLog || !newLogText.trim()}
                    className="px-3 py-1.5 bg-navy text-white rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-navy/90 transition-colors shrink-0 cursor-pointer"
                  >
                    {isSubmittingLog ? "..." : "+ Ajouter"}
                  </button>
                </form>

                {isLoadingActivity ? (
                  <div className="flex items-center justify-center py-6 text-xs text-slate-400">
                    <span className="animate-spin mr-2">⏳</span> Chargement...
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Aucune activité enregistrée pour ce candidat.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {activityLogs.map((log: any, idx: number) => {
                      const actionIcons: Record<string, string> = {
                        STATUS_CHANGED: "🔄",
                        TRAINING_STATUS_CHANGED: "🎓",
                        RECALL_SET: "⏰",
                        PRESENCE_CONFIRMED: "✅",
                        NOTE_ADDED: "📝",
                        KYC_UPDATED: "📄",
                        COLUMN_MOVED: "➡️",
                        CITY_SET: "📍",
                        PREORDER_SET: "💰",
                        WHATSAPP_SENT: "💬",
                        WHATSAPP_OPENED: "📱",
                      };
                      const icon = actionIcons[log.action] || "🔹";
                      const when = new Date(log.created_at);
                      const timeLabel =
                        when.toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        }) +
                        " " +
                        when.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      return (
                        <div key={log.id || idx} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                          <span className="text-base mt-0.5 shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-800 leading-snug">{log.detail || log.action}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[120px]">{log.agent}</span>
                              <span className="text-[10px] text-slate-300">•</span>
                              <span className="text-[10px] text-slate-400">{timeLabel}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Validation Errors & Footer Actions */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex flex-col gap-3">
          {validationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl leading-normal">
              {validationError}
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                isSubmitting ||
                (boardType === "leads" && !brandStatus) ||
                (boardType === "training" && !trainingStatus) ||
                (showDatePicker && !trainingDate)
              }
              className="px-5 py-2.5 bg-navy hover:bg-navy/95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
