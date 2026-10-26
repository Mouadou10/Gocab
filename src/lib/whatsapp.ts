/**
 * WhatsApp URL & CRM Utility Helpers
 *
 * Generates wa.me deep-links with pre-filled messages
 * for training invitations, thank-you notes, status templates, and CRM integration.
 * 100% client-safe (no Node/DB imports).
 */

export const GOCAB_HQ_LOCATION = {
  latitude: 33.566063,
  longitude: -7.6362229,
  name: "GoCab Rent",
  address: "زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف",
  mapsUrl:
    "https://www.google.com/maps/place/33%C2%B033'57.8%22N+7%C2%B038'10.4%22W/@33.566063,-7.6387978,17z/data=!3m1!4b1!4m4!3m3!8m2!3d33.566063!4d-7.6362229?hl=en&entry=ttu&g_ep=EgoyMDI2MTAwNy4wIKXMDSoASAFQAw%3D%3D",
};

export const DEFAULT_INVITE_TEMPLATE =
  `نؤكد لكم موعد تكوينكم على الساعة 3 زوالا \nيقع مكتبنا في: زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف، يمكنكم معرفة موقعنا عبر رابط غوغل مابس: ${GOCAB_HQ_LOCATION.mapsUrl}\n إلى اللقاء قريباً`;

export const DEFAULT_MISSING_DOCS_TEMPLATE =
  "Bonjour {name},\n\nAfin de finaliser votre dossier chauffeur GoCab ({city}) et de vous attribuer votre véhicule, merci de nous transmettre les documents manquants suivants :\n{missing_docs}\n\nVous pouvez nous envoyer des photos bien lisibles directement sur ce numéro WhatsApp.\n\nL'équipe GoCab Recrutement.";

/**
 * Official Approved 360dialog / WhatsApp Business Cloud API Templates for Lead Acquisition
 * Sourced directly from 360dialog Hub (+212 6 62 14 51 09, Status: Approved, Lang: ar, Category: MARKETING)
 */
export interface Approved360TemplateDef {
  id: string;
  name: string;
  language: string;
  category: string;
  status?: string;
  title: string;
  badge: string;
  icon: string;
  description: string;
  defaultTime?: string;
  headerFormat?: "LOCATION" | "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO" | "NONE";
  headerText?: string;
  bodyParamCount?: number;
  buttonLabel?: string;
  buttonUrl?: string;
  hasDynamicButtonUrl?: boolean;
  template: string;
}

export const APPROVED_360_TEMPLATES: Approved360TemplateDef[] = [
  {
    id: "formation",
    name: "formation",
    language: "ar",
    category: "MARKETING",
    status: "approved",
    title: "formation (Session 15h00)",
    badge: "Approuvé 360dialog",
    icon: "🎓",
    description:
      "Convocation officielle 15h00 avec carte GPS Maârif & bouton Localisation (Approuvé 360dialog)",
    defaultTime: "3:00 مساءً (15h00)",
    headerFormat: "LOCATION",
    bodyParamCount: 0,
    buttonLabel: "Localisation",
    buttonUrl: GOCAB_HQ_LOCATION.mapsUrl,
    hasDynamicButtonUrl: false,
    template:
      `نؤكد لكم موعد تكوينكم على الساعة 3 زوالا \nيقع مكتبنا في: زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف، يمكنكم معرفة موقعنا عبر رابط غوغل مابس: ${GOCAB_HQ_LOCATION.mapsUrl}\n إلى اللقاء قريباً`,
  },
  {
    id: "vendredi",
    name: "vendredi",
    language: "ar",
    category: "MARKETING",
    status: "approved",
    title: "vendredi (Session Vendredi 11h00)",
    badge: "Approuvé 360dialog",
    icon: "🕌",
    description:
      "Convocation spéciale vendredi 11h00 avec carte GPS Maârif & bouton Localisation (Approuvé 360dialog)",
    defaultTime: "11:00 صباحاً (11h00)",
    headerFormat: "LOCATION",
    bodyParamCount: 0,
    buttonLabel: "Localisation",
    buttonUrl: GOCAB_HQ_LOCATION.mapsUrl,
    hasDynamicButtonUrl: false,
    template:
      "مرحباً، نؤكد لكم موعد تكوينكم مع GoCab يوم الجمعة على الساعة 11 صباحاً. يقع مكتبنا في: زنقة العربي الدغمي، عمارة 96، الطابق الأول، رقم 5، المعاريف، يمكنكم معرفة موقعنا عبر رابط غوغل مابس:",
  },
];

/**
 * Returns the approved 360dialog template by ID/name from an optional dynamic list, falling back to "formation"
 */
export function getApproved360Template(
  templateId?: string | null,
  availableTemplates: Approved360TemplateDef[] = APPROVED_360_TEMPLATES
): Approved360TemplateDef {
  const pool = availableTemplates.length > 0 ? availableTemplates : APPROVED_360_TEMPLATES;
  if (templateId) {
    const exact = pool.find(
      (t) => t.id === templateId || t.name.toLowerCase() === templateId.toLowerCase()
    );
    if (exact) return exact;
  }
  return pool.find((t) => t.name === "formation") || pool[0] || APPROVED_360_TEMPLATES[0];
}

/**
 * Automatically resolves whether to use "vendredi" or "formation" based on training date
 */
export function resolve360TemplateByDate(
  trainingDate?: string | Date | null,
  availableTemplates: Approved360TemplateDef[] = APPROVED_360_TEMPLATES
): Approved360TemplateDef {
  if (!trainingDate) return getApproved360Template("formation", availableTemplates);
  try {
    const d = typeof trainingDate === "string" ? new Date(trainingDate) : trainingDate;
    if (!isNaN(d.getTime()) && d.getDay() === 5) {
      return getApproved360Template("vendredi", availableTemplates); // Friday
    }
  } catch (_) {}
  return getApproved360Template("formation", availableTemplates);
}

/**
 * Detects if a message string matches one of the approved 360dialog templates
 */
export function detectApproved360Template(
  messageText: string,
  availableTemplates: Approved360TemplateDef[] = APPROVED_360_TEMPLATES
): Approved360TemplateDef | null {
  const norm = (messageText || "").trim();
  if (!norm) return null;
  const pool = availableTemplates.length > 0 ? availableTemplates : APPROVED_360_TEMPLATES;

  for (const tpl of pool) {
    const tplBody = (tpl.template || "").trim();
    if (!tplBody) continue;
    if (norm === tplBody || norm.includes(tplBody)) {
      return tpl;
    }
  }

  // Match distinctive Arabic phrases from GoCab's approved templates
  if (norm.includes("موعد تكوينكم") && norm.includes("الجمعة")) {
    return getApproved360Template("vendredi", pool);
  }
  if (norm.includes("موعد تكوينكم") && (norm.includes("3 زوالا") || norm.includes("المعاريف"))) {
    return getApproved360Template("formation", pool);
  }
  return null;
}

/**
 * Formats a template's text for WhatsApp Web (appends static button URL if not already in body)
 */
export function formatTemplateForWhatsAppWeb(tpl: Approved360TemplateDef, customText?: string): string {
  const base = (customText ?? tpl.template).trim();
  if (tpl.buttonUrl && !base.includes("http")) {
    return `${base}\n${tpl.buttonUrl}`;
  }
  return base;
}

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

export interface LeadStatusTemplateDef {
  id: string;
  statusKeys: string[];
  board: "leads" | "training" | "both";
  title: string;
  category: "Intake" | "Formation" | "Relance" | "Documents" | "Véhicule" | "Général";
  icon: string;
  template: string;
  description: string;
}

/**
 * Standard Status-Driven GoCab WhatsApp Templates for Leads & Training Pipelines
 */
export const LEAD_STATUS_TEMPLATES: LeadStatusTemplateDef[] = [
  {
    id: "LEADS_NEW",
    statusKeys: ["NEW_LEADS"],
    board: "leads",
    title: "👋 Premier Contact (Nouveau Prospect)",
    category: "Intake",
    icon: "✨",
    description: "Message d'accueil et qualification pour les nouveaux leads entrants",
    template:
      "Bonjour {name},\n\nNous avons bien reçu votre candidature pour rejoindre GoCab en tant que chauffeur partenaire à {city}.\n\nÊtes-vous toujours disponible pour échanger sur nos offres de véhicules disponibles ?\n\nMerci de nous répondre directement sur ce numéro WhatsApp.\nL'équipe GoCab Recrutement.",
  },
  {
    id: "LEADS_TRAINING_FIXED",
    statusKeys: ["Training fixed"],
    board: "leads",
    title: "🎓 Convocation Session Formation",
    category: "Formation",
    icon: "📅",
    description: "Convocation officielle à la formation avec date, heure et pièces obligatoires",
    template: DEFAULT_INVITE_TEMPLATE,
  },
  {
    id: "LEADS_NO_RESP_1",
    statusKeys: ["No response 1"],
    board: "leads",
    title: "📞 1ère Relance (Appel sans réponse)",
    category: "Relance",
    icon: "📞",
    description: "Première relance amicale suite à une tentative d'appel restée sans réponse",
    template:
      "Bonjour {name},\n\nNous avons tenté de vous joindre concernant votre inscription chauffeur chez GoCab ({city}), sans succès.\n\nMerci de nous indiquer l'horaire qui vous conviendrait pour un court appel d'information.\n\nCordialement,\nL'équipe GoCab Recrutement.",
  },
  {
    id: "LEADS_NO_RESP_2",
    statusKeys: ["No response 2"],
    board: "leads",
    title: "⏳ 2ème Relance d'Urgence",
    category: "Relance",
    icon: "⏳",
    description: "Seconde relance soulignant la disponibilité limitée des places de formation",
    template:
      "Bonjour {name},\n\nNous essayons à nouveau de vous contacter suite à votre demande GoCab. Les places pour les sessions de formation à {city} se remplissent vite.\n\nSi vous souhaitez toujours obtenir votre véhicule, merci de nous confirmer votre intérêt par retour de message.\n\nL'équipe GoCab.",
  },
  {
    id: "LEADS_TO_RECALL",
    statusKeys: ["To Recall"],
    board: "leads",
    title: "📅 Confirmation de Rappel Téléphonique",
    category: "Relance",
    icon: "⏰",
    description: "Confirmation du créneau convenu pour le rappel téléphonique",
    template:
      "Bonjour {name},\n\nSuite à notre échange, nous avons bien noté de vous rappeler le {date}{time} pour faire le point sur votre dossier GoCab.\n\nÀ très bientôt,\nL'équipe GoCab.",
  },
  {
    id: "LEADS_NOT_INTERESTED",
    statusKeys: ["Not interested"],
    board: "leads",
    title: "👋 Clôture Candidature",
    category: "Général",
    icon: "📂",
    description: "Message courtois pour clore un dossier lorsque le prospect n'est pas intéressé",
    template:
      "Bonjour {name},\n\nNous vous remercions pour votre intérêt pour GoCab. Nous avons bien pris note de votre décision. Votre dossier reste archivé si votre situation évolue à l'avenir.\n\nNous vous souhaitons une excellente continuation.",
  },
  {
    id: "TRAINING_SCHEDULED",
    statusKeys: ["Scheduled"],
    board: "training",
    title: "🎓 Rappel de Présence Formation",
    category: "Formation",
    icon: "📌",
    description: "Rappel des détails de la formation et vérification de présence",
    template:
      "Bonjour {name},\n\nNous vous rappelons que votre session de formation chauffeur GoCab est prévue pour le {date}.\nLieu : Agence GoCab ({city}).\n\nDocuments obligatoires à présenter :\n- Permis de conduire original (2+ ans)\n- Carte Nationale d'Identité (CIN)\n- Fiche anthropométrique\n\nMerci de confirmer votre présence en répondant 'OUI' à ce message.",
  },
  {
    id: "TRAINING_NOT_ATTENDED",
    statusKeys: ["Not attended"],
    board: "training",
    title: "⚠️ Relance Absence Formation",
    category: "Relance",
    icon: "⚠️",
    description: "Relance suite à une absence à la session de formation avec proposition de nouvelle date",
    template:
      "Bonjour {name},\n\nNous avons constaté votre absence aujourd'hui à la session de formation GoCab à {city}.\n\nSouhaitez-vous reprogrammer votre session sur un autre créneau ? Merci de nous répondre pour convenir d'une nouvelle date rapidement.\n\nL'équipe GoCab Formation.",
  },
  {
    id: "TRAINING_PENDING_KYC",
    statusKeys: ["Pending"],
    board: "training",
    title: "📁 Relance Documents Manquants (KYC)",
    category: "Documents",
    icon: "📁",
    description: "Relance pour compléter le dossier avec la liste personnalisée des pièces manquantes",
    template: DEFAULT_MISSING_DOCS_TEMPLATE,
  },
  {
    id: "TRAINING_PREORDER",
    statusKeys: ["Preorder"],
    board: "training",
    title: "💰 Reçu & Confirmation d'Acompte",
    category: "Véhicule",
    icon: "💰",
    description: "Accusé de réception de l'acompte versé pour la réservation du véhicule",
    template:
      "Bonjour {name},\n\nNous confirmons la bonne réception de votre acompte de {amount} MAD pour la réservation de votre véhicule GoCab.\n\nVotre dossier est désormais prioritaire pour l'attribution dès disponibilité.\n\nL'équipe GoCab.",
  },
  {
    id: "TRAINING_ASSIGN_VEHICLE",
    statusKeys: ["Assign vehicle", "Accept offer"],
    board: "training",
    title: "🚗 Véhicule Prêt — Attribution & Remise des Clés",
    category: "Véhicule",
    icon: "🚗",
    description: "Félicitations et convocation à l'agence pour la signature et la remise des clés",
    template:
      "Félicitations {name} !\n\nVotre véhicule GoCab est prêt pour la mise à disposition. Veuillez vous présenter à notre agence GoCab ({city}) avec vos pièces originales pour la signature du contrat et la remise des clés.\n\nBienvenue dans l'équipe GoCab !",
  },
  {
    id: "TRAINING_ATTENDED",
    statusKeys: ["Attended"],
    board: "training",
    title: "✅ Formation Validée avec Succès",
    category: "Formation",
    icon: "✅",
    description: "Félicitations pour la formation réussie et annonce des prochaines étapes",
    template:
      "Bonjour {name},\n\nFélicitations pour la validation de votre formation GoCab à {city} ! Votre dossier est en cours de préparation pour l'attribution de votre véhicule.\n\nNous vous contacterons très prochainement.",
  },
];

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
 * Resolves the template definition matching a given lead status and pipeline board
 */
export function getTemplateForLeadStatus(
  boardType: "leads" | "training",
  status: string,
  customInviteTemplate?: string,
  customMissingDocsTemplate?: string
): LeadStatusTemplateDef {
  const normStatus = status?.trim() || "";

  let matched = LEAD_STATUS_TEMPLATES.find((t) => {
    if (t.board !== "both" && t.board !== boardType) return false;
    return t.statusKeys.some(
      (k) => k.toLowerCase() === normStatus.toLowerCase()
    );
  });

  if (!matched) {
    matched = LEAD_STATUS_TEMPLATES.find((t) =>
      t.statusKeys.some((k) => k.toLowerCase() === normStatus.toLowerCase())
    );
  }

  // Default fallback if no status matches
  if (!matched) {
    matched =
      boardType === "leads"
        ? LEAD_STATUS_TEMPLATES[0] // LEADS_NEW
        : LEAD_STATUS_TEMPLATES[6]; // TRAINING_SCHEDULED
  }

  // Override with custom settings template if available
  let activeTemplateText = matched.template;
  if (matched.id === "LEADS_TRAINING_FIXED" && customInviteTemplate?.trim()) {
    activeTemplateText = customInviteTemplate.trim();
  } else if (
    matched.id === "TRAINING_PENDING_KYC" &&
    customMissingDocsTemplate?.trim()
  ) {
    activeTemplateText = customMissingDocsTemplate.trim();
  }

  return {
    ...matched,
    template: activeTemplateText,
  };
}

export interface SubstitutionContext {
  name?: string;
  city?: string;
  date?: string;
  time?: string;
  missingDocs?: string[];
  amount?: string;
  templateId?: string;
}

/**
 * Replaces placeholder variables ({name}, {city}, {date}, {time}, {missing_docs}, {amount})
 * cleanly with lead data.
 */
export function formatLeadWhatsAppMessage(
  rawTemplate: string,
  ctx: SubstitutionContext
): string {
  if (!rawTemplate) return "";

  let text = rawTemplate;
  const leadName = ctx.name?.trim() || "Chauffeur";
  const city = ctx.city?.trim() || "Casablanca";

  // Name
  text = text.replace(/\{name\}|\{\{name\}\}/gi, leadName);

  // City
  text = text.replace(/\{city\}|\{\{city\}\}/gi, city);

  // Date formatting
  let dateFormatted = ctx.date || "";
  if (ctx.date) {
    try {
      const parsed = new Date(ctx.date);
      if (!isNaN(parsed.getTime())) {
        dateFormatted = parsed.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    } catch (e) {}
  }
  text = text.replace(/\{date\}|\{\{date\}\}/gi, dateFormatted);

  // Time formatting - intelligent handling of Arabic vs French templates
  const isArabic = /[\u0600-\u06FF]/.test(rawTemplate) || ctx.templateId === "formation" || ctx.templateId === "vendredi";
  let defaultTimeStr = "15:00";
  if (ctx.templateId === "vendredi" || rawTemplate.includes("الجمعة")) {
    defaultTimeStr = "11:00 صباحاً";
  } else if (isArabic) {
    defaultTimeStr = "3:00 مساءً (15h00)";
  }

  const rawTime = ctx.time?.trim();
  let timeReplacement = "";
  if (isArabic) {
    timeReplacement = rawTime ? rawTime.replace(/^à\s*/i, "") : defaultTimeStr;
  } else {
    timeReplacement = rawTime ? (rawTime.startsWith("à ") ? rawTime : ` à ${rawTime}`) : " à 15:00";
  }
  text = text.replace(/\{time\}|\{\{time\}\}/gi, timeReplacement);

  // Missing documents
  let missingDocsString = "";
  if (Array.isArray(ctx.missingDocs) && ctx.missingDocs.length > 0) {
    missingDocsString = ctx.missingDocs.map((doc) => `- ${doc}`).join("\n");
  } else {
    missingDocsString = "- Pièce d'identité (CIN)\n- Permis de conduire";
  }
  text = text.replace(/\{missing_docs\}|\{\{missing_docs\}\}/gi, missingDocsString);

  // Amount
  const amountStr = ctx.amount ? `${ctx.amount}` : "l'acompte";
  text = text.replace(/\{amount\}|\{\{amount\}\}/gi, amountStr);

  return text;
}

/**
 * Generates a clean WhatsApp Web / App url for any phone and text.
 */
export function generateWhatsAppWebURL(phone: string, text: string): string {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Legacy invitation URL generator backward compatibility.
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

  const formattedDate = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const activeTemplate = template || DEFAULT_INVITE_TEMPLATE;

  const message = activeTemplate
    .replace(/\{name\}|\{\{name\}\}/g, name)
    .replace(/\{date\}|\{\{date\}\}/g, formattedDate)
    .replace(/\{time\}|\{\{time\}\}/g, sessionLabel)
    .replace(/\{city\}|\{\{city\}\}/g, "Casablanca");

  const cleanPhone = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Legacy thank-you URL generator backward compatibility.
 */
export function generateThankYouURL(phone: string): string {
  const message = "شكراً لثقتكم، نتمنى لكم رحلة موفقة مع GoCab.";
  const cleanPhone = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
