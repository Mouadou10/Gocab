/**
 * WhatsApp URL & CRM Utility Helpers
 *
 * Generates wa.me deep-links with pre-filled messages
 * for training invitations, thank-you notes, and CRM templates.
 * 100% client-safe (no Node/DB imports).
 */

const DEFAULT_INVITE_TEMPLATE =
  "السلام عليكم {name}،\nتم تأكيد موعد التدريب الخاص بكم يوم {date} على الساعة {time}.\nنتطلع للقائكم في GoCab.\nشكراً لكم.";

/**
 * Normalizes phone numbers to comparable digits-only format (e.g. 2126XXXXXXXX).
 */
export function normalizeWhatsAppPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  // Local Moroccan phone: 06... or 07... -> 2126... or 2127...
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "212" + digits.slice(1);
  } else if (digits.length === 9) {
    digits = "212" + digits;
  }
  return digits;
}

/**
 * Formats a clean phone for display (e.g. +212 6XX-XXXXXX)
 */
export function formatDisplayPhone(phone: string): string {
  const norm = normalizeWhatsAppPhone(phone);
  if (norm.startsWith("212") && norm.length >= 11) {
    return `+212 ${norm.slice(3, 5)} ${norm.slice(5, 8)}-${norm.slice(8)}`;
  }
  return phone.startsWith("+") ? phone : `+${norm}`;
}

/**
 * Standard GoCab CRM Quick Reply Templates
 */
export const GOCAB_WHATSAPP_TEMPLATES = [
  {
    id: "PAYMENT_DAILY_REMINDER",
    title: "💰 Rappel Versement Journalier (300 MAD)",
    category: "Recouvrement",
    text: "Bonjour {{name}},\n\nNous vous rappelons que votre versement journalier GoCab de 300 MAD est attendu aujourd'hui.\nSolde actuel : {{arrears}} MAD.\n\nMerci de procéder au règlement pour maintenir votre véhicule actif.\nL'équipe GoCab Operations.",
  },
  {
    id: "PAYMENT_WEEKLY_REMINDER",
    title: "🗓️ Rappel Versement Hebdo (1800 MAD)",
    category: "Recouvrement",
    text: "Bonjour {{name}},\n\nVotre versement hebdomadaire GoCab de 1,800 MAD est attendu ce lundi.\nSolde actuel : {{arrears}} MAD.\n\nMerci de procéder au versement dès aujourd'hui.\nL'équipe GoCab Operations.",
  },
  {
    id: "TRAINING_INVITATION",
    title: "🎓 Convocation Formation Chauffeur",
    category: "Recrutement",
    text: "Bonjour {{name}},\n\nVotre session de formation chauffeur GoCab est confirmée pour le {{date}} à 10h00 à notre agence.\n\nDocuments obligatoires à présenter :\n- Permis de conduire original (2+ ans)\n- Carte Nationale d'Identité (CIN)\n- Fiche anthropométrique\n\nMerci de confirmer votre présence par retour de message.",
  },
  {
    id: "MISSING_DOCS",
    title: "📄 Relance Documents Manquants",
    category: "Recrutement",
    text: "Bonjour {{name}},\n\nAfin de valider votre dossier et de procéder à l'attribution de votre véhicule GoCab, merci de nous envoyer une photo lisible de votre CIN et de votre permis de conduire recto/verso.\n\nL'équipe GoCab Recrutement.",
  },
  {
    id: "RECOVERY_WARNING",
    title: "🚨 Alerte Blocage Télématique (Impayé)",
    category: "Urgent",
    text: "URGENT {{name}},\n\nVotre véhicule GoCab ({{plate}}) présente un impayé de {{arrears}} MAD depuis plusieurs jours.\n\nSans régularisation dans les plus brefs délais, une procédure d'immobilisation télématique et de récupération sur le terrain sera déclenchée.\nContactez le bureau GoCab sans attendre.",
  },
  {
    id: "SUPPORT_RESOLVED",
    title: "✅ Véhicule Disponible / Réparation Terminée",
    category: "Support",
    text: "Bonjour {{name}},\n\nL'intervention technique sur votre véhicule ({{plate}}) est terminée. Votre véhicule est prêt et disponible pour reprise de service.\n\nBonne route avec GoCab !",
  },
];

/**
 * Generates a WhatsApp invitation URL with custom template.
 * Substitutes {name}, {date}, and {time}.
 * - Monday–Thursday → 3:00 PM (3:00 مساءً)
 * - Friday → 11:00 AM (11:00 صباحاً)
 *
 * @param phone    - Sanitized phone number (e.g., "+212612345678")
 * @param name     - Lead raw name
 * @param date     - The training session date
 * @param template - Custom template string from settings
 * @returns        - Full wa.me URL with encoded message
 */
export function generateTrainingInviteURL(
  phone: string,
  name: string,
  date: Date,
  template?: string
): string {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const isFriday = dayOfWeek === 5;
  const sessionLabel = isFriday ? "11:00 صباحاً" : "3:00 مساءً";

  // Format the date as DD/MM/YYYY
  const formattedDate = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const activeTemplate = template || DEFAULT_INVITE_TEMPLATE;

  const message = activeTemplate
    .replace(/{name}/g, name)
    .replace(/{date}/g, formattedDate)
    .replace(/{time}/g, sessionLabel);

  // Strip the "+" for wa.me format
  const cleanPhone = phone.replace("+", "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates a WhatsApp thank-you URL after offer acceptance.
 *
 * @param phone - Sanitized phone number (e.g., "+212612345678")
 * @returns     - Full wa.me URL with encoded Arabic message
 */
export function generateThankYouURL(phone: string): string {
  const message = "شكراً لثقتكم، نتمنى لكم رحلة موفقة مع GoCab.";
  const cleanPhone = phone.replace("+", "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
