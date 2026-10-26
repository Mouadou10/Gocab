"use client";

import { useState, useEffect } from "react";
import {
  X,
  Send,
  MessageCircle,
  Car,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Phone,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  formatDisplayPhone,
  normalizeWhatsAppPhone,
  APPROVED_360_TEMPLATES,
  Approved360TemplateDef,
  detectApproved360Template,
  formatTemplateForWhatsAppWeb,
  formatLeadWhatsAppMessage,
} from "@/lib/whatsapp";

export interface WhatsAppDirectTarget {
  phoneNumber: string;
  contactName: string;
  contactType?: "DRIVER" | "LEAD" | "UNKNOWN";
  plateNumber?: string;
  arrearsMAD?: number;
  unpaidDays?: number;
  defaultMessage?: string;
}

interface WhatsAppDirectModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: WhatsAppDirectTarget | null;
  onOpenFullChat?: (phone: string) => void;
}

export default function WhatsAppDirectModal({
  isOpen,
  onClose,
  target,
  onOpenFullChat,
}: WhatsAppDirectModalProps) {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentSuccessAt, setSentSuccessAt] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<string | null>(null);
  const [live360Templates, setLive360Templates] =
    useState<Approved360TemplateDef[]>(APPROVED_360_TEMPLATES);
  const [selected360Template, setSelected360Template] =
    useState<Approved360TemplateDef | null>(null);

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
    if (target) {
      const detected = detectApproved360Template(target.defaultMessage || "", live360Templates);
      if (detected) {
        setSelected360Template(detected);
        setMessageText(detected.template);
      } else if (target.contactType === "LEAD" && !target.defaultMessage) {
        const fallbackLeadTpl = live360Templates[0] || APPROVED_360_TEMPLATES[0];
        setSelected360Template(fallbackLeadTpl);
        setMessageText(fallbackLeadTpl.template);
      } else {
        setSelected360Template(null);
        setMessageText(target.defaultMessage || "");
      }
      setSentSuccessAt(null);
      setDeliveryMode(null);
    }
  }, [target, live360Templates]);

  if (!isOpen || !target) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    try {
      const matchedTpl =
        selected360Template || detectApproved360Template(messageText, live360Templates);

      const res = await fetch("/api/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: target.phoneNumber,
          text: matchedTpl ? matchedTpl.template : messageText.trim(),
          templateName: matchedTpl ? matchedTpl.name : undefined,
          templateLanguage: matchedTpl ? matchedTpl.language : undefined,
          senderName: "GoCab Operations",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.message?.status !== "FAILED") {
        const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setSentSuccessAt(timeNow);
        setDeliveryMode(data.mode || "360DIALOG_WABA");
        toast.success(
          matchedTpl
            ? `✓ Modèle officiel 360dialog "${matchedTpl.name}" envoyé avec succès !`
            : "✓ Message WhatsApp envoyé directement avec succès !",
          {
            icon: "🚀",
            duration: 4000,
          }
        );
      } else {
        const errorDetail =
          data.apiError ||
          data.error ||
          data.message?.error_message ||
          "Échec d'envoi API (Vérifiez la configuration 360dialog ou la fenêtre Meta 24h)";
        toast.error(`⚠️ Échec d'envoi: ${errorDetail}`, { duration: 6000 });
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur réseau");
    } finally {
      setIsSending(false);
    }
  };

  const quickTemplates: Array<{
    title: string;
    text: string;
    tpl360?: Approved360TemplateDef;
  }> =
    target.contactType === "LEAD"
      ? live360Templates.map((tmpl) => ({
          title: `${tmpl.icon} ${tmpl.title} (360dialog ${tmpl.language})`,
          text:
            (tmpl.bodyParamCount ?? 0) > 0
              ? formatLeadWhatsAppMessage(tmpl.template, {
                  name: target.contactName,
                  city: "Casablanca",
                  templateId: tmpl.id,
                })
              : tmpl.template,
          tpl360: tmpl,
        }))
      : [
          {
            title: "💰 Relance Impayé",
            text: `Bonjour ${target.contactName},\n\nNous vous contactons concernant votre versement GoCab (${target.plateNumber ? `véhicule ${target.plateNumber}` : "votre contrat"}).\nVotre solde d'impayé actuel est de : ${target.arrearsMAD || 0} MAD.\nMerci de procéder à la régularisation dès aujourd'hui afin d'éviter toute suspension de contrat.\n\nL'équipe GoCab Operations.`,
          },
          {
            title: "🚨 Alerte 3e Jour",
            text: `Bonjour ${target.contactName},\n\nURGENT : Nous constatons 3 jours consécutifs sans versement pour votre véhicule ${target.plateNumber || ""}.\nSolde dû : ${target.arrearsMAD || 0} MAD.\nSans versement immédiat avant 18h, le protocole d'immobilisation et de récupération du véhicule sera automatiquement enclenché.\n\nL'équipe GoCab Contentieux.`,
          },
          ...live360Templates.map((tmpl) => ({
            title: `${tmpl.icon} ${tmpl.title} (360dialog ${tmpl.language})`,
            text: tmpl.template,
            tpl360: tmpl,
          })),
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">
                  Envoi Direct WhatsApp Business
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white/20 text-white uppercase tracking-wider">
                  API Vérifiée
                </span>
              </div>
              <p className="text-xs text-white/80">
                Ligne officielle GoCab · Sans passer par WhatsApp Web ni mobile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contact Strip */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-navy text-white font-bold flex items-center justify-center text-xs">
              {target.contactName.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-900">{target.contactName}</p>
              <p className="font-mono text-[11px] text-gray-500">
                {formatDisplayPhone(target.phoneNumber)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {target.plateNumber && (
              <span className="px-2 py-1 bg-white text-navy border border-gray-200 rounded-lg font-mono font-bold text-xs flex items-center gap-1">
                <Car className="w-3.5 h-3.5 text-navy/70" />
                {target.plateNumber}
              </span>
            )}
            {(target.arrearsMAD || 0) > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-lg font-bold text-xs flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {target.arrearsMAD?.toLocaleString()} MAD
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Quick Templates */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              Modèles Rapides & 360dialog Approuvés
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickTemplates.map((t, idx) => {
                const isSelectedTpl =
                  Boolean(t.tpl360) && selected360Template?.name === t.tpl360?.name;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelected360Template(t.tpl360 || null);
                      setMessageText(t.text);
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      isSelectedTpl
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                        : t.tpl360
                        ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200"
                        : "bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 text-gray-700 border-gray-200"
                    }`}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
          </div>

          {selected360Template && (
            <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-2 text-xs text-emerald-950">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                  360dialog Approuvé
                </span>
                <span className="font-bold">
                  {selected360Template.name} ({selected360Template.language.toUpperCase()})
                </span>
                {selected360Template.headerFormat === "LOCATION" && (
                  <span className="text-[11px] text-emerald-800 font-semibold">
                    · 📍 Carte GPS Maârif incluse
                  </span>
                )}
                <span className="text-[11px] text-emerald-700">
                  · Envoi API garanti hors fenêtre 24h
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected360Template(null);
                  setMessageText("");
                }}
                className="text-[10px] font-bold text-gray-600 hover:text-red-700 px-2 py-0.5 rounded bg-white border border-gray-200 cursor-pointer shrink-0"
              >
                ✕ Texte libre
              </button>
            </div>
          )}

          {/* Message Area */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-800">
              {selected360Template
                ? `Aperçu officiel du modèle 360dialog (${selected360Template.name})`
                : "Message à transmettre"}
            </label>
            <textarea
              rows={6}
              readOnly={Boolean(
                selected360Template && (selected360Template.bodyParamCount ?? 0) === 0
              )}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Rédigez votre message WhatsApp..."
              className={`w-full p-3 border rounded-2xl text-xs font-sans text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs leading-relaxed ${
                selected360Template
                  ? "bg-emerald-50/40 border-emerald-300"
                  : "bg-white border-gray-300"
              }`}
            />
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>
                {selected360Template
                  ? "✅ Ce modèle officiel contourne la fenêtre Meta 24h et inclut l'en-tête GPS Maârif."
                  : "Le texte libre requiert une fenêtre 24h ouverte. Sinon choisissez un modèle 360dialog ci-dessus."}
              </span>
              <span>{messageText.length} caractères</span>
            </div>
          </div>

          {/* Success Banner */}
          {sentSuccessAt && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800 animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Envoyé avec succès à <strong>{sentSuccessAt}</strong> via 360dialog Cloud API.
                </span>
              </div>
              {onOpenFullChat && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFullChat(target.phoneNumber);
                  }}
                  className="font-bold underline text-emerald-900 hover:text-emerald-700 cursor-pointer"
                >
                  Voir dans CRM
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          {onOpenFullChat ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullChat(target.phoneNumber);
              }}
              className="px-3.5 py-2 text-xs font-bold text-navy hover:text-navy/80 hover:bg-navy/5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Ouvrir la discussion complète</span>
            </button>
          ) : (
            <span className="text-[10px] text-gray-400 font-medium">
              Expéditeur : +212 6 62 14 51 09 (GoCab SARL)
            </span>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl transition-all cursor-pointer"
            >
              Fermer
            </button>
            <a
              href={`https://wa.me/${normalizeWhatsAppPhone(target.phoneNumber)}${
                messageText.trim()
                  ? `?text=${encodeURIComponent(
                      selected360Template
                        ? formatTemplateForWhatsAppWeb(selected360Template, messageText)
                        : messageText.trim()
                    )}`
                  : ""
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Envoyer directement via WhatsApp Web ou application mobile (sans restriction de fenêtre 24h Meta)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>WhatsApp Web</span>
            </a>
            <button
              type="button"
              onClick={handleSend}
              disabled={!messageText.trim() || isSending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Envoi en cours…</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Envoyer via WhatsApp API</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
