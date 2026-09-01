"use client";

import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useLanguage } from "@/context/LanguageContext";

const MOROCCAN_CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tangier",
  "Agadir",
  "Fez",
  "Meknes",
  "Oujda",
  "Kenitra",
  "Tetouan",
  "Safi",
  "Mohammedia",
  "El Jadida",
  "Other",
] as const;

const CAMPAIGN_SOURCES = [
  "Direct Phone Call",
  "Walk-in Agency",
  "WhatsApp Inbound",
  "Facebook / Meta Ads",
  "Instagram Lead",
  "TikTok Ads",
  "Driver Referral",
  "Manual Entry",
] as const;

const TRAINING_STATUSES = [
  { key: "Scheduled", label: "Scheduled (Programmé)", icon: "📅" },
  { key: "Attended", label: "Attended (Présent)", icon: "✅" },
  { key: "Attended and not interested", label: "Attended & Not Interested", icon: "🚫" },
  { key: "Pending", label: "Pending (En attente)", icon: "⏳" },
  { key: "Refused the offer", label: "Refused Offer (Refusé)", icon: "❌" },
  { key: "Assign vehicle", label: "Assign Vehicle (Affectation)", icon: "🚗" },
  { key: "Not attended", label: "Not Attended (Absent)", icon: "⚠️" },
  { key: "No response", label: "No Response (Injoignable)", icon: "📞" },
  { key: "Preorder", label: "Preorder (Précommande)", icon: "💵" },
] as const;

const LEADS_STATUSES = [
  { key: "NEW_LEADS", label: "New Lead (Nouveau)" },
  { key: "Not Interested", label: "Not Interested (Non intéressé)" },
  { key: "No response 1", label: "No response 1 (Injoignable 1)" },
  { key: "No response 2", label: "No response 2 (Injoignable 2)" },
  { key: "To Recall", label: "To Recall (À rappeler)" },
  { key: "Wrong Number", label: "Wrong Number (Faux numéro)" },
  { key: "Already Client", label: "Already Client (Déjà client)" },
  { key: "Training fixed", label: "Training Fixed (Formation fixée)" },
] as const;

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadAdded: () => void;
  activeTab?: string;
}

export default function AddLeadModal({ isOpen, onClose, onLeadAdded, activeTab = "leads" }: AddLeadModalProps) {
  const { t, language } = useLanguage();

  // Destination pipeline: "leads" vs "training"
  const [pipeline, setPipeline] = useState<"leads" | "training">(
    activeTab === "training" ? "training" : "leads"
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Casablanca");
  const [campaignSource, setCampaignSource] = useState("Direct Phone Call");
  const [age, setAge] = useState<string>("25");
  const [permisSeniority, setPermisSeniority] = useState<string>("3");
  const [isResident, setIsResident] = useState<boolean>(true);

  // Training & Leads status selection
  const [trainingStatus, setTrainingStatus] = useState<string>("Scheduled");
  const [leadStatus, setLeadStatus] = useState<string>("NEW_LEADS");
  const [trainingDate, setTrainingDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [preorderAmount, setPreorderAmount] = useState<string>("");

  // KYC Checklist
  const [hasCin, setHasCin] = useState<boolean>(false);
  const [hasPermis, setHasPermis] = useState<boolean>(true);
  const [hasFiche, setHasFiche] = useState<boolean>(false);
  const [hasConfirmation, setHasConfirmation] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Synchronize pipeline with activeTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setPipeline(activeTab === "training" ? "training" : "leads");
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Veuillez saisir le nom complet du prospect.");
      return;
    }

    if (!phone.trim()) {
      setErrorMsg("Veuillez saisir le numéro de téléphone.");
      return;
    }

    // Determine target board_column and statuses
    let targetBoardColumn = "NEW_LEADS";
    let targetBrandStatus: string | null = null;
    let targetTrainingStatus: string | null = null;
    let targetReminderDate: string | null = null;
    let targetPreorderAmount: number | null = null;

    if (pipeline === "training") {
      if (trainingStatus === "Assign vehicle" || trainingStatus === "VEHICLE_ASSIGNMENT") {
        targetBoardColumn = "VEHICLE_ASSIGNMENT";
        targetBrandStatus = "Training fixed";
        targetTrainingStatus = "Assign vehicle";
      } else {
        targetBoardColumn = "TRAINING_PIPELINE";
        targetBrandStatus = "Training fixed";
        targetTrainingStatus = trainingStatus;
      }

      if (trainingStatus === "Scheduled") {
        targetReminderDate = trainingDate ? `${trainingDate}T12:00:00.000Z` : null;
      }

      if (trainingStatus === "Preorder" && preorderAmount) {
        targetPreorderAmount = parseFloat(preorderAmount);
      }
    } else {
      // Leads pipeline
      if (leadStatus === "NEW_LEADS") {
        targetBoardColumn = "NEW_LEADS";
        targetBrandStatus = null;
      } else if (leadStatus === "Training fixed") {
        targetBoardColumn = "TRAINING_PIPELINE";
        targetBrandStatus = "Training fixed";
        targetTrainingStatus = "Scheduled";
        targetReminderDate = trainingDate ? `${trainingDate}T12:00:00.000Z` : null;
      } else {
        targetBoardColumn = "BRAND_PRE_FILTER";
        targetBrandStatus = leadStatus;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          city,
          campaign_source: campaignSource,
          board_column: targetBoardColumn,
          brand_status: targetBrandStatus,
          training_status: targetTrainingStatus,
          reminder_date: targetReminderDate,
          preorder_amount: targetPreorderAmount,
          age: age ? parseInt(age, 10) : null,
          permis_seniority_years: permisSeniority ? parseInt(permisSeniority, 10) : null,
          is_resident: isResident,
          has_cin: hasCin,
          has_permis: hasPermis,
          has_fiche_anthropometrique: hasFiche,
          has_confirmation_adresse: hasConfirmation,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'ajout du prospect");
      }

      toast.success(
        language === "fr"
          ? `✅ Prospect ${data.lead.raw_name} ajouté avec succès !`
          : language === "ar"
          ? `✅ تم إضافة المرشح ${data.lead.raw_name} بنجاح!`
          : `✅ Lead ${data.lead.raw_name} added successfully!`
      );

      // Reset Form
      setName("");
      setPhone("");
      setCity("Casablanca");
      setCampaignSource("Direct Phone Call");
      setAge("25");
      setPermisSeniority("3");
      setIsResident(true);
      setHasCin(false);
      setHasPermis(true);
      setHasFiche(false);
      setHasConfirmation(false);
      setTrainingStatus("Scheduled");
      setLeadStatus("NEW_LEADS");
      setPreorderAmount("");

      onLeadAdded();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-navy to-navy/90 text-white flex items-center justify-between border-b border-navy/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg shadow-inner">
              👤➕
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                {language === "fr" ? "Nouveau Prospect" : language === "ar" ? "إضافة مرشح جديد" : "Add New Lead"}
              </h2>
              <p className="text-xs text-white/70">
                {pipeline === "training"
                  ? language === "fr"
                    ? "Ajout direct dans la Formation"
                    : "Direct Training candidate entry"
                  : language === "fr"
                  ? "Saisie manuelle d'un chauffeur candidat"
                  : "Manual driver candidate registration"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Pipeline Selector Switch (Leads vs Training) */}
        <div className="px-6 pt-4 pb-2 bg-gray-50/70 border-b border-gray-200/60">
          <label className="block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Destination Pipeline
          </label>
          <div className="grid grid-cols-2 gap-2 bg-gray-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPipeline("leads")}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                pipeline === "leads"
                  ? "bg-white text-navy shadow-xs font-black"
                  : "text-gray-600 hover:text-navy"
              }`}
            >
              <span>💼</span>
              <span>Leads Acquisition</span>
            </button>
            <button
              type="button"
              onClick={() => setPipeline("training")}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                pipeline === "training"
                  ? "bg-white text-navy shadow-xs font-black"
                  : "text-gray-600 hover:text-navy"
              }`}
            >
              <span>🎓</span>
              <span>Training Pipeline</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Full Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {language === "fr" ? "Nom & Prénom *" : language === "ar" ? "الاسم الكامل *" : "Full Name *"}
              </label>
              <input
                type="text"
                required
                placeholder="ex: Mohamed El Idrissi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {language === "fr" ? "Téléphone (Maroc) *" : language === "ar" ? "رقم الهاتف *" : "Phone Number *"}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="06 12 34 56 78"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Status Selection based on chosen pipeline */}
          {pipeline === "training" ? (
            <div className="p-4 bg-purple-50/70 border border-purple-200/80 rounded-2xl space-y-3">
              <div>
                <label className="block text-xs font-black text-purple-950 mb-1 flex items-center gap-1.5">
                  <span>🎓</span>
                  <span>Statut Training (Colonne de Destination) *</span>
                </label>
                <select
                  value={trainingStatus}
                  onChange={(e) => setTrainingStatus(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-purple-300 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-purple-400 outline-none"
                >
                  {TRAINING_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.icon} {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* If Scheduled, select training date */}
              {trainingStatus === "Scheduled" && (
                <div className="animate-fadeIn">
                  <label className="block text-2xs font-bold text-purple-900 mb-1 flex items-center gap-1">
                    <span>📅</span>
                    <span>Date de la Session de Formation *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={trainingDate}
                    onChange={(e) => setTrainingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-purple-400 outline-none"
                  />
                  <p className="text-3xs text-purple-700 mt-1">
                    Le prospect apparaîtra dans la colonne &quot;Scheduled&quot; à la date de formation indiquée.
                  </p>
                </div>
              )}

              {/* If Preorder, enter amount */}
              {trainingStatus === "Preorder" && (
                <div className="animate-fadeIn">
                  <label className="block text-2xs font-bold text-purple-900 mb-1 flex items-center gap-1">
                    <span>💵</span>
                    <span>Montant Précommande (MAD)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="ex: 1500"
                    value={preorderAmount}
                    onChange={(e) => setPreorderAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-purple-400 outline-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2">
              <div>
                <label className="block text-xs font-black text-navy mb-1 flex items-center gap-1.5">
                  <span>💼</span>
                  <span>Statut Initial du Prospect</span>
                </label>
                <select
                  value={leadStatus}
                  onChange={(e) => setLeadStatus(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-navy/30 outline-none"
                >
                  {LEADS_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {leadStatus === "Training fixed" && (
                <div className="animate-fadeIn pt-1">
                  <label className="block text-2xs font-bold text-navy mb-1 flex items-center gap-1">
                    <span>📅</span>
                    <span>Date de Formation *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={trainingDate}
                    onChange={(e) => setTrainingDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-navy/30 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* City & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {language === "fr" ? "Ville" : language === "ar" ? "المدينة" : "City"}
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all outline-none"
              >
                {MOROCCAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {language === "fr" ? "Canal / Source" : language === "ar" ? "المصدر" : "Source Channel"}
              </label>
              <select
                value={campaignSource}
                onChange={(e) => setCampaignSource(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all outline-none"
              >
                {CAMPAIGN_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* KYC Documents Checklist */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700">
              {language === "fr" ? "Documents KYC en possession :" : language === "ar" ? "وثائق الملف المتوفرة:" : "KYC Documents on Hand:"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                onClick={() => setHasPermis(!hasPermis)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                  hasPermis ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                <span>🚘</span>
                <span>Permis B</span>
                <span className="ml-auto text-xs">{hasPermis ? "✓" : "○"}</span>
              </label>

              <label
                onClick={() => setHasCin(!hasCin)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                  hasCin ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                <span>🪪</span>
                <span>CIN</span>
                <span className="ml-auto text-xs">{hasCin ? "✓" : "○"}</span>
              </label>

              <label
                onClick={() => setHasFiche(!hasFiche)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                  hasFiche ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                <span>📑</span>
                <span>Fiche Anthropo.</span>
                <span className="ml-auto text-xs">{hasFiche ? "✓" : "○"}</span>
              </label>

              <label
                onClick={() => setHasConfirmation(!hasConfirmation)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                  hasConfirmation ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold" : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                <span>🏠</span>
                <span>Conf. Adresse</span>
                <span className="ml-auto text-xs">{hasConfirmation ? "✓" : "○"}</span>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
            >
              {language === "fr" ? "Annuler" : language === "ar" ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === "fr" ? "Enregistrement..." : language === "ar" ? "جاري الحفظ..." : "Saving..."}</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>{language === "fr" ? "Ajouter le Prospect" : language === "ar" ? "إضافة المرشح" : "Add Lead"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
