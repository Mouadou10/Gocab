"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "en" | "fr" | "ar";

export interface Translations {
  // Navigation & General
  appName: string;
  appSubtitle: string;
  home: string;
  leads: string;
  training: string;
  drivers: string;
  fleet: string;
  support: string;
  perf: string;
  field: string;
  insurance: string;
  settings: string;
  signOut: string;
  autoClosing: string;
  reminderDue: string;
  followUpWhatsapp: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  create: string;
  saving: string;
  search: string;
  filter: string;
  all: string;
  status: string;
  actions: string;

  // Executive Dashboard
  executiveDashboard: string;
  executiveSubtitle: string;
  leadConversion: string;
  fleetUtilization: string;
  totalDowntime: string;
  totalLeadsImported: string;
  vehiclesOnRoad: string;
  cumulativeDowntimeDays: string;
  leadProgression: string;
  fleetStatusDist: string;
  weeklyExecutiveReport: string;
  opsPerformanceKpiHealth: string;
  alertsActive: string;
  targetAchieved: string;
  viewReport: string;

  // Weekly Department Targets
  weeklyDepartmentTargets: string;
  departmentTargetsSubtitle: string;
  saveDepartmentTargets: string;
  resetDefaults: string;
  leadAcquisitionJr: string;
  weeklyNewLeadsTarget: string;
  trainingShowupRate: string;
  kycCompletionTarget: string;
  fleetPerfAndChurn: string;
  activeFleetUtilization: string;
  maxAllowedDowntime: string;
  weeklyChurnLimit: string;
  fieldOpsAndRecovery: string;
  monthlyInspectionRate: string;
  gpsActiveRate: string;
  assetRecoveryRate: string;
  supportAndSla: string;
  slaResolutionTarget: string;
  maxOpenTickets: string;
  financeAndCollections: string;
  dailyClearingRate: string;
  targetWeeklyCollections: string;

  // Roles & Team
  rolePermissions: string;
  rolePermissionsSubtitle: string;
  teamMembers: string;
  teamMembersSubtitle: string;
  addTeamMember: string;
  createNewRole: string;
  saveAllPermissions: string;
  user: string;
  email: string;
  region: string;
  currentRole: string;
  changeRole: string;
  whatsappTemplates: string;

  // Collections & Financial Ledger
  dailyContract: string;
  weeklyContract: string;
  redAlert3rdDay: string;
  expectedToday: string;
  collectedToday: string;
  remainingToCollect: string;
  totalArrears: string;
  consecutiveUnpaidDays: string;
  riskImmobilization: string;
  opportunityLoss: string;
  recordPayment: string;
  onTrack: string;
}

export const DICTIONARY: Record<Language, Translations> = {
  en: {
    appName: "GoCab CRM",
    appSubtitle: "GROWTH & KYC MODULE",
    home: "Home",
    leads: "Leads",
    training: "Training",
    drivers: "Drivers",
    fleet: "Fleet",
    support: "Support",
    perf: "Collections & Perf",
    field: "Field",
    insurance: "Insurance",
    settings: "Settings",
    signOut: "Sign Out",
    autoClosing: "auto-closing",
    reminderDue: "Reminder Due",
    followUpWhatsapp: "Follow up on WhatsApp",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    saving: "Saving…",
    search: "Search...",
    filter: "Filter",
    all: "All",
    status: "Status",
    actions: "Actions",

    // Collections & Financial Ledger
    dailyContract: "Daily (300 MAD/day Mon-Sat)",
    weeklyContract: "Weekly (1,800 MAD every Monday)",
    redAlert3rdDay: "Critical Non-Payment (3rd Day)",
    expectedToday: "Expected Today",
    collectedToday: "Collected Today",
    remainingToCollect: "Remaining to Collect",
    totalArrears: "Total Accumulated Arrears",
    consecutiveUnpaidDays: "Unpaid Days",
    riskImmobilization: "Risk of Immobilization",
    opportunityLoss: "Opportunity Loss (250 MAD/day)",
    recordPayment: "Validate Payment",
    onTrack: "Up to Date",

    executiveDashboard: "Executive Dashboard",
    executiveSubtitle: "Overview of GoCab operational performance across 3 pillars",
    leadConversion: "LEAD CONVERSION",
    fleetUtilization: "FLEET UTILIZATION",
    totalDowntime: "TOTAL DOWNTIME",
    totalLeadsImported: "total leads imported",
    vehiclesOnRoad: "Vehicles on the road",
    cumulativeDowntimeDays: "Cumulative lost operational days",
    leadProgression: "Lead Funnel Progression",
    fleetStatusDist: "Fleet Status Distribution",
    weeklyExecutiveReport: "Weekly Executive Report",
    opsPerformanceKpiHealth: "Operations Performance & KPI Health",
    alertsActive: "KPI Alerts Active",
    targetAchieved: "All department operational targets are currently meeting expectations.",
    viewReport: "View Report",

    weeklyDepartmentTargets: "Weekly Department Goals & Thresholds",
    departmentTargetsSubtitle: "Define the performance benchmarks for each operational pillar. The system calculates live variances and escalations against these targets.",
    saveDepartmentTargets: "Save Department Targets",
    resetDefaults: "Reset Defaults",
    leadAcquisitionJr: "Lead Acquisition (Junior)",
    weeklyNewLeadsTarget: "Weekly New Leads Target",
    trainingShowupRate: "Training Show-Up Rate",
    kycCompletionTarget: "KYC Verified (4/4 Docs) Target",
    fleetPerfAndChurn: "Fleet Performance & Churn",
    activeFleetUtilization: "Active Fleet Utilization Rate",
    maxAllowedDowntime: "Max Allowed Avg Downtime",
    weeklyChurnLimit: "Weekly Churn Limit (Max)",
    fieldOpsAndRecovery: "Field Operations & Recovery",
    monthlyInspectionRate: "Monthly Physical Inspection Rate",
    gpsActiveRate: "GPS Telematics Active Rate",
    assetRecoveryRate: "Asset Recovery Rate",
    supportAndSla: "Support & 24h SLA",
    slaResolutionTarget: "24h SLA Resolution Target",
    maxOpenTickets: "Max Open Tickets Backlog",
    financeAndCollections: "Finance & Collections",
    dailyClearingRate: "Daily Clearing Rate",
    targetWeeklyCollections: "Target Weekly Collections",

    rolePermissions: "Role & Tab Access Control",
    rolePermissionsSubtitle: "Select which tabs are accessible for each role. Changes apply to all team members assigned to that role.",
    teamMembers: "Team Member Accounts",
    teamMembersSubtitle: "Manage your real team members, change roles, or remove accounts.",
    addTeamMember: "Add Team Member",
    createNewRole: "Create New Role",
    saveAllPermissions: "Save All Permissions",
    user: "User",
    email: "Email",
    region: "Region",
    currentRole: "Current Role & Tab Access",
    changeRole: "Change Role",
    whatsappTemplates: "WhatsApp Templates",
  },
  fr: {
    appName: "GoCab CRM",
    appSubtitle: "MODULE CROISSANCE & KYC",
    home: "Accueil",
    leads: "Prospects",
    training: "Formation",
    drivers: "Chauffeurs",
    fleet: "Flotte",
    support: "Support",
    perf: "Encaissements & Perf",
    field: "Terrain",
    insurance: "Assurance",
    settings: "Paramètres",
    signOut: "Déconnexion",
    autoClosing: "fermeture auto",
    reminderDue: "Rappel en attente",
    followUpWhatsapp: "Relancer sur WhatsApp",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    create: "Créer",
    saving: "Enregistrement…",
    search: "Rechercher...",
    filter: "Filtrer",
    all: "Tous",
    status: "Statut",
    actions: "Actions",

    // Collections & Financial Ledger
    dailyContract: "Journalier (300 DH/j Lun-Sam)",
    weeklyContract: "Hebdomadaire (1 800 DH chaque Lundi)",
    redAlert3rdDay: "Non-Paiement Critique (3e Jour)",
    expectedToday: "Attendu Aujourd'hui",
    collectedToday: "Encaissé Aujourd'hui",
    remainingToCollect: "Reste à Encaisser",
    totalArrears: "Total Arriérés & Impayés",
    consecutiveUnpaidDays: "Jours sans versement",
    riskImmobilization: "Risque d'Immobilisation Véhicule",
    opportunityLoss: "Perte d'Opportunité (250 DH/j)",
    recordPayment: "Valider Paiement",
    onTrack: "À Jour",

    executiveDashboard: "Tableau de Bord Exécutif",
    executiveSubtitle: "Aperçu des performances opérationnelles de GoCab sur les 3 piliers",
    leadConversion: "CONVERSION PROSPECTS",
    fleetUtilization: "UTILISATION FLOTTE",
    totalDowntime: "IMMOBILISATION TOTALE",
    totalLeadsImported: "prospects totaux importés",
    vehiclesOnRoad: "Véhicules en circulation",
    cumulativeDowntimeDays: "Jours d'indisponibilité cumulés",
    leadProgression: "Progression du Tunnel Prospects",
    fleetStatusDist: "Répartition des Statuts de la Flotte",
    weeklyExecutiveReport: "Rapport Hebdomadaire Exécutif",
    opsPerformanceKpiHealth: "Performance Opérationnelle & Santé KPI",
    alertsActive: "Alertes KPI Actives",
    targetAchieved: "Tous les objectifs opérationnels des départements sont actuellement atteints.",
    viewReport: "Voir le Rapport",

    weeklyDepartmentTargets: "Objectifs & Seuils Hebdomadaires par Département",
    departmentTargetsSubtitle: "Définissez les indicateurs de performance pour chaque pilier opérationnel. Le système calcule les écarts et alertes en temps réel.",
    saveDepartmentTargets: "Enregistrer les Objectifs",
    resetDefaults: "Rétablir par Défaut",
    leadAcquisitionJr: "Acquisition de Prospects (Junior)",
    weeklyNewLeadsTarget: "Objectif Hebdo Nouveaux Prospects",
    trainingShowupRate: "Taux de Présence à la Formation",
    kycCompletionTarget: "Objectif KYC Validé (4/4 Documents)",
    fleetPerfAndChurn: "Performance Flotte & Churn",
    activeFleetUtilization: "Taux d'Utilisation de la Flotte Active",
    maxAllowedDowntime: "Immobilisation Moyenne Max Autorisée",
    weeklyChurnLimit: "Limite Hebdomadaire de Churn (Max)",
    fieldOpsAndRecovery: "Opérations Terrain & Récupération",
    monthlyInspectionRate: "Taux d'Inspection Physique Mensuel",
    gpsActiveRate: "Taux d'Activité Télématique GPS",
    assetRecoveryRate: "Taux de Récupération des Véhicules",
    supportAndSla: "Support & SLA 24h",
    slaResolutionTarget: "Objectif de Résolution SLA 24h",
    maxOpenTickets: "Nombre Max de Tickets en Attente",
    financeAndCollections: "Finance & Recouvrement",
    dailyClearingRate: "Taux d'Encaissement Journalier",
    targetWeeklyCollections: "Objectif Hebdo Recouvrement (MAD)",

    rolePermissions: "Contrôle d'Accès par Rôle & Onglet",
    rolePermissionsSubtitle: "Sélectionnez les onglets accessibles pour chaque rôle. S'applique à tous les membres de l'équipe.",
    teamMembers: "Comptes de l'Équipe",
    teamMembersSubtitle: "Gérez les membres de l'équipe, changez les rôles ou supprimez des comptes.",
    addTeamMember: "Ajouter un Collaborateur",
    createNewRole: "Créer un Nouveau Rôle",
    saveAllPermissions: "Enregistrer les Permissions",
    user: "Collaborateur",
    email: "E-mail",
    region: "Région",
    currentRole: "Rôle Actuel & Onglets",
    changeRole: "Changer de Rôle",
    whatsappTemplates: "Modèles WhatsApp",
  },
  ar: {
    appName: "GoCab CRM",
    appSubtitle: "وحدة النمو والتحقق من الهوية",
    home: "الرئيسية",
    leads: "المرشحين",
    training: "التدريب",
    drivers: "السائقين",
    fleet: "الأسطول",
    support: "الدعم الفني",
    perf: "التحصيل والأداء",
    field: "الميدان",
    insurance: "التأمين",
    settings: "الإعدادات",
    signOut: "تسجيل الخروج",
    autoClosing: "إغلاق تلقائي",
    reminderDue: "موعد تذكير",
    followUpWhatsapp: "متابعة عبر واتساب",
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    create: "إنشاء",
    saving: "جارٍ الحفظ…",
    search: "بحث...",
    filter: "تصفية",
    all: "الكل",
    status: "الحالة",
    actions: "الإجراءات",

    // Collections & Financial Ledger
    dailyContract: "يومي (300 درهم/يوم من الإثنين للسبت)",
    weeklyContract: "أسبوعي (1,800 درهم كل إثنين)",
    redAlert3rdDay: "تنبيه أحمر حرج (اليوم الثالث بدون سداد)",
    expectedToday: "المبلغ المتوقع اليوم",
    collectedToday: "المحصل اليوم",
    remainingToCollect: "المتبقي للتحصيل",
    totalArrears: "إجمالي المستحقات المتأخرة",
    consecutiveUnpaidDays: "أيام عدم السداد",
    riskImmobilization: "خطر إيقاف وحجز المركبة",
    opportunityLoss: "فقدان فرصة الدخل (250 درهم/يوم)",
    recordPayment: "تأكيد الدفع",
    onTrack: "مستوفى السداد",

    executiveDashboard: "لوحة التحكم التنفيذية",
    executiveSubtitle: "نظرة عامة على الأداء التشغيلي لـ GoCab عبر الركائز الثلاث",
    leadConversion: "تحويل المرشحين",
    fleetUtilization: "تشغيل الأسطول",
    totalDowntime: "إجمالي التوقف",
    totalLeadsImported: "إجمالي المرشحين المستوردين",
    vehiclesOnRoad: "مركبات في الخدمة",
    cumulativeDowntimeDays: "أيام التوقف التراكمية",
    leadProgression: "مسار تقدم المرشحين",
    fleetStatusDist: "توزيع حالة الأسطول",
    weeklyExecutiveReport: "التقرير الأسبوعي التنفيذي",
    opsPerformanceKpiHealth: "مؤشرات الأداء التشغيلي",
    alertsActive: "تنبيهات أداء نشطة",
    targetAchieved: "جميع الأهداف التشغيلية للأقسام تحقق التوقعات حالياً.",
    viewReport: "عرض التقرير",

    weeklyDepartmentTargets: "الأهداف الأسبوعية للأقسام والحدود التشغيلية",
    departmentTargetsSubtitle: "حدد معايير الأداء لكل ركيزة تشغيلية. يحسب النظام الفروقات والتنبيهات المباشرة مقابل هذه الأهداف.",
    saveDepartmentTargets: "حفظ أهداف الأقسام",
    resetDefaults: "استعادة الافتراضي",
    leadAcquisitionJr: "استقطاب المرشحين (مبتدئ)",
    weeklyNewLeadsTarget: "هدف المرشحين الجدد أسبوعياً",
    trainingShowupRate: "نسبة الحضور للتدريب",
    kycCompletionTarget: "هدف اكتمال الوثائق (4/4)",
    fleetPerfAndChurn: "أداء الأسطول ونسبة التوقف",
    activeFleetUtilization: "نسبة تشغيل الأسطول النشط",
    maxAllowedDowntime: "الحد الأقصى لمتوسط أيام التوقف",
    weeklyChurnLimit: "الحد الأقصى لإنهاء العقود أسبوعياً",
    fieldOpsAndRecovery: "العمليات الميدانية والاسترداد",
    monthlyInspectionRate: "نسبة الفحص الميداني الشهري",
    gpsActiveRate: "نسبة اتصال أجهزة التتبع GPS",
    assetRecoveryRate: "نسبة استرداد المركبات",
    supportAndSla: "الدعم الفني ومستوى الخدمة 24h",
    slaResolutionTarget: "هدف حل التذاكر خلال 24 ساعة",
    maxOpenTickets: "الحد الأقصى للتذاكر المعلقة",
    financeAndCollections: "المالية والتحصيل اليومي",
    dailyClearingRate: "نسبة التحصيل اليومي",
    targetWeeklyCollections: "المبلغ المستهدف تحصيله أسبوعياً (درهم)",

    rolePermissions: "التحكم في صلاحيات الأدوار والصفحات",
    rolePermissionsSubtitle: "حدد الصفحات المتاحة لكل دور. تطبق التغييرات على جميع أعضاء الفريق.",
    teamMembers: "حسابات أعضاء الفريق",
    teamMembersSubtitle: "إدارة أعضاء الفريق، وتغيير الأدوار، وحذف الحسابات.",
    addTeamMember: "إضافة عضو جديد",
    createNewRole: "إنشاء دور مخصص",
    saveAllPermissions: "حفظ جميع الصلاحيات",
    user: "المستخدم",
    email: "البريد الإلكتروني",
    region: "المنطقة",
    currentRole: "الدور الحالي والصفحات المتاحة",
    changeRole: "تغيير الدور",
    whatsappTemplates: "قوالب رسائل واتساب",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr"); // Default to French for Casablanca ops

  useEffect(() => {
    // Read saved language from localStorage
    const saved = localStorage.getItem("gocab_lang") as Language;
    if (saved && (saved === "en" || saved === "fr" || saved === "ar")) {
      setLanguageState(saved);
      document.documentElement.dir = saved === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = saved;
    } else {
      document.documentElement.dir = "ltr";
      document.documentElement.lang = "fr";
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("gocab_lang", lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  };

  const dir = language === "ar" ? "rtl" : "ltr";
  const t = DICTIONARY[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
