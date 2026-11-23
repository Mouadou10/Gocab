"use client";

import { useState, useEffect } from "react";
import { X, Send, CheckCircle2, AlertCircle, Users, Loader2, Car } from "lucide-react";
import toast from "react-hot-toast";
import {
  APPROVED_360_TEMPLATES,
  Approved360TemplateDef,
  formatDisplayPhone,
} from "@/lib/whatsapp";
import type { WhatsAppDirectTarget } from "./WhatsAppDirectModal";

interface BulkWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: WhatsAppDirectTarget[];
  onSentComplete?: () => void;
}

type SendStatus = "PENDING" | "SENDING" | "SENT" | "FAILED";

export default function BulkWhatsAppModal({
  isOpen,
  onClose,
  targets,
  onSentComplete,
}: BulkWhatsAppModalProps) {
  const [live360Templates, setLive360Templates] =
    useState<Approved360TemplateDef[]>(APPROVED_360_TEMPLATES);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("relance_impaye");
  const [isSending, setIsSending] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, SendStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/whatsapp/templates")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.templates) && data.templates.length > 0) {
          setLive360Templates(data.templates);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, SendStatus> = {};
      for (const t of targets) {
        initial[t.phoneNumber] = "PENDING";
      }
      setStatuses(initial);
      setErrors({});
      setIsSending(false);
    }
  }, [isOpen, targets]);

  if (!isOpen) return null;

  const activeTemplate =
    live360Templates.find((t) => t.name.toLowerCase() === selectedTemplateName.toLowerCase()) ||
    live360Templates.find((t) => t.name.toLowerCase() === "relance_impaye") ||
    live360Templates[0];

  const isRelanceImpaye = activeTemplate?.name.toLowerCase() === "relance_impaye";

  const buildPayloadForTarget = (target: WhatsAppDirectTarget) => {
    const plate = target.plateNumber || "Véhicule GoCab";
    const driverName = target.contactName || "Chauffeur";
    const arrears = String(Math.round(Math.abs(target.arrearsMAD || 0)));
    const templateParams = isRelanceImpaye ? [plate, driverName, arrears] : undefined;
    const finalText = isRelanceImpaye
      ? activeTemplate.template
          .replace(/\{\{1\}\}/g, plate)
          .replace(/\{\{2\}\}/g, driverName)
          .replace(/\{\{3\}\}/g, arrears)
      : activeTemplate.template;

    return {
      phoneNumber: target.phoneNumber,
      text: finalText,
      templateName: activeTemplate.name,
      templateLanguage: activeTemplate.language,
      templateParams,
      senderName: "GoCab Operations",
    };
  };

  const sampleTarget = targets[0];
  const samplePreview = sampleTarget ? buildPayloadForTarget(sampleTarget).text : activeTemplate?.template || "";

  const sentCount = Object.values(statuses).filter((s) => s === "SENT").length;
  const failedCount = Object.values(statuses).filter((s) => s === "FAILED").length;
  const completedCount = sentCount + failedCount;

  const handleBulkSend = async () => {
    if (isSending || targets.length === 0 || !activeTemplate) return;
    setIsSending(true);

    let okCount = 0;
    let errCount = 0;

    // Send in small batches of 3 to avoid saturating the API while staying fast
    const BATCH_SIZE = 3;
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (target) => {
          setStatuses((prev) => ({ ...prev, [target.phoneNumber]: "SENDING" }));
          try {
            const payload = buildPayloadForTarget(target);
            const res = await fetch("/api/whatsapp/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok && data.success && data.message?.status !== "FAILED") {
              okCount++;
              setStatuses((prev) => ({ ...prev, [target.phoneNumber]: "SENT" }));
            } else {
              errCount++;
              setStatuses((prev) => ({ ...prev, [target.phoneNumber]: "FAILED" }));
              setErrors((prev) => ({
                ...prev,
                [target.phoneNumber]: data?.error || data?.message?.error_reason || "Échec d'envoi",
              }));
            }
          } catch (err: any) {
            errCount++;
            setStatuses((prev) => ({ ...prev, [target.phoneNumber]: "FAILED" }));
            setErrors((prev) => ({
              ...prev,
              [target.phoneNumber]: err?.message || "Erreur réseau",
            }));
          }
        })
      );
    }

    setIsSending(false);
    if (okCount > 0 && errCount === 0) {
      toast.success(`✅ ${okCount} message(s) WhatsApp envoyé(s) avec succès !`);
      onSentComplete?.();
    } else if (okCount > 0) {
      toast.success(`⚠️ ${okCount} envoyé(s), ${errCount} échec(s).`);
      onSentComplete?.();
    } else {
      toast.error(`❌ Échec de l'envoi (${errCount} erreur(s)).`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#075E54] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Envoi Groupé WhatsApp Business (360dialog)</h3>
              <p className="text-2xs text-emerald-100">
                {targets.length} chauffeur(s) sélectionné(s) • Modèle officiel hors fenêtre 24h
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="p-1.5 rounded-xl hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Template Selector */}
          <div>
            <label className="block text-2xs font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">
              Modèle 360dialog à envoyer
            </label>
            <select
              value={activeTemplate?.name || "relance_impaye"}
              onChange={(e) => setSelectedTemplateName(e.target.value)}
              disabled={isSending}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-navy bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {live360Templates.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.title} ({t.language})
                </option>
              ))}
            </select>
          </div>

          {/* Personalized Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs font-extrabold uppercase tracking-wider text-gray-500">
                Aperçu personnalisé ({sampleTarget?.contactName || "Chauffeur"})
              </span>
              {isRelanceImpaye && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Variables auto : Plaque • Nom • Solde
                </span>
              )}
            </div>
            <div
              dir="auto"
              className="p-3.5 rounded-2xl bg-[#ECE5DD] text-gray-900 text-xs whitespace-pre-wrap leading-relaxed border border-emerald-200 font-medium"
            >
              {samplePreview}
            </div>
          </div>

          {/* Progress Bar (when sending or completed) */}
          {completedCount > 0 || isSending ? (
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-navy">
                  Progression : {completedCount} / {targets.length}
                </span>
                <span className="text-emerald-700">
                  {sentCount} envoyé(s) {failedCount > 0 ? `• ${failedCount} échec(s)` : ""}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${Math.round((completedCount / Math.max(targets.length, 1)) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Recipients List */}
          <div>
            <span className="block text-2xs font-extrabold uppercase tracking-wider text-gray-500 mb-1.5">
              Destinataires ({targets.length})
            </span>
            <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-2xl">
              {targets.map((t) => {
                const st = statuses[t.phoneNumber] || "PENDING";
                return (
                  <div key={t.phoneNumber} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-navy truncate">{t.contactName}</p>
                      <div className="flex items-center gap-2 text-2xs text-gray-500">
                        <span>{formatDisplayPhone(t.phoneNumber)}</span>
                        {t.plateNumber && (
                          <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-gray-700">
                            <Car className="w-3 h-3" />
                            {t.plateNumber}
                          </span>
                        )}
                        {typeof t.arrearsMAD === "number" && (
                          <span className="font-bold text-red-600">
                            {Math.round(Math.abs(t.arrearsMAD)).toLocaleString()} DH
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {st === "PENDING" && (
                        <span className="text-2xs font-semibold text-gray-400">En attente</span>
                      )}
                      {st === "SENDING" && (
                        <span className="inline-flex items-center gap-1 text-2xs font-bold text-amber-600">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Envoi...
                        </span>
                      )}
                      {st === "SENT" && (
                        <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Envoyé
                        </span>
                      )}
                      {st === "FAILED" && (
                        <span
                          className="inline-flex items-center gap-1 text-2xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full"
                          title={errors[t.phoneNumber] || "Erreur"}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Échec
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleBulkSend}
            disabled={isSending || targets.length === 0}
            className="px-5 py-2.5 rounded-xl bg-[#075E54] hover:bg-[#064e46] text-white text-xs font-extrabold flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Envoi en cours ({completedCount}/{targets.length})...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Envoyer à {targets.length} chauffeur(s)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
