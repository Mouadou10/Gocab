"use client";

/**
 * LeadDrawer Component
 * 
 * A sliding sidebar drawer (slides in from the right) that displays lead details
 * and handles status updates, city selection, KYC document checklists, preorder amounts,
 * and WhatsApp invitation/thank-you redirects.
 */

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { generateTrainingInviteURL, generateThankYouURL } from "@/lib/whatsapp";

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
  "Accept offer",
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
  notes?: string | null;
}

interface LeadDrawerProps {
  lead: Lead;
  boardType: "leads" | "training";
  onClose: () => void;
  onUpdate: (updatedLead: Lead) => void;
  whatsappTemplate?: string;
}

export default function LeadDrawer({
  lead,
  boardType,
  onClose,
  onUpdate,
  whatsappTemplate,
}: LeadDrawerProps) {
  const [brandStatus, setBrandStatus] = useState(lead.board_column === "NEW_LEADS" ? "NEW_LEADS" : (lead.brand_status || ""));
  const [trainingStatus, setTrainingStatus] = useState(lead.training_status || "");
  const [city, setCity] = useState(lead.city || "");
  
  // KYC Checklist State
  const [hasCin, setHasCin] = useState(lead.has_cin);
  const [hasFiche, setHasFiche] = useState(lead.has_fiche_anthropometrique);
  const [hasConfirmation, setHasConfirmation] = useState(lead.has_confirmation_adresse);
  const [hasPermis, setHasPermis] = useState(lead.has_permis);

  const [trainingDate, setTrainingDate] = useState("");
  const [reminderDate, setReminderDate] = useState(
    lead.reminder_date ? lead.reminder_date.split("T")[0] : ""
  );
  const [preorderAmount, setPreorderAmount] = useState<string>(
    lead.preorder_amount !== null ? String(lead.preorder_amount) : ""
  );

  const [notes, setNotes] = useState<string>(lead.notes || "");


  const [validationError, setValidationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Trigger slide-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const showDatePicker = boardType === "leads" && brandStatus === "Training fixed";
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

            // Auto-trigger WhatsApp confirmation message
            const waUrl = generateTrainingInviteURL(
              lead.sanitized_phone,
              lead.raw_name,
              date,
              whatsappTemplate
            );
            window.open(waUrl, "_blank");
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

        if (trainingStatus === "Accept offer") {
          // Validation checklist check: All 4 documents must be checked
          const isKycComplete = hasCin && hasFiche && hasConfirmation && hasPermis;
          if (!isKycComplete) {
            setValidationError(
              "⚠️ KYC Checklist Incomplete! Please verify CIN, Fiche anthropométrique, Confirmation d'adresse, and Permis to proceed to Accept offer."
            );
            setIsSubmitting(false);
            return;
          }

          // Move to vehicle assignment
          payload.board_column = "VEHICLE_ASSIGNMENT";

          // Auto-trigger WhatsApp thank-you message
          const waUrl = generateThankYouURL(lead.sanitized_phone);
          window.open(waUrl, "_blank");

          // Fire unlock alert
          setTimeout(() => {
            alert("🚗 Assign Vehicle Module Unlocked");
          }, 300);
        } else if (trainingStatus === "Pending" && reminderDate) {
          payload.reminder_date = new Date(reminderDate).toISOString();
        } else if (trainingStatus === "Preorder") {
          payload.preorder_amount = preorderAmount ? parseFloat(preorderAmount) : null;
        }
      }

      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Lead updated successfully");
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
        <div className="bg-navy px-6 py-5 flex items-center justify-between text-white">
          <div>
            <h3 className="text-base font-bold tracking-tight">{lead.raw_name}</h3>
            <p className="text-xs text-white/70 font-mono mt-0.5">{lead.sanitized_phone}</p>
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
                    setBrandStatus(e.target.value);
                    setTrainingDate("");
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
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/40 focus:border-navy"
                  />
                  <p className="text-xs text-gray-500 mt-2 leading-normal">
                    📌 Setting <strong>Training fixed</strong> will automatically send the customized WhatsApp invitation and move the driver to the Training board.
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
                  value={trainingStatus}
                  onChange={(e) => {
                    setTrainingStatus(e.target.value);
                    setReminderDate("");
                    setPreorderAmount("");
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
                (showDatePicker && !trainingDate) ||
                (showReminderPicker && !reminderDate) ||
                (showPreorderInput && !preorderAmount)
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
