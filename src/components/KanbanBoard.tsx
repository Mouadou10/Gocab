"use client";

/**
 * KanbanBoard — Main Component (Tabs + Full Status columns + Sidebar Drawer + Settings Version)
 *
 * Toggles between:
 * 1. Leads Page (Columns for all Brand pre-filter statuses)
 * 2. Training Page (Columns for all Training statuses)
 * 3. Settings (Custom WhatsApp invite configuration)
 *
 * Implements @dnd-kit drag-and-drop and sliding sidebar drawer detail views.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import KanbanColumn from "./KanbanColumn";
import CSVUploader from "./CSVUploader";
import FleetView from "./FleetView";
import SupportTicketsView from "./SupportTicketsView";
import FleetPerformanceView from "./FleetPerformanceView";
import FieldSupervisorView from "./FieldSupervisorView";
import LeadDrawer from "./LeadDrawer";
import SettingsView from "./SettingsView";
import ReminderAlert from "./ReminderAlert";
import LeadsScorecard from "./LeadsScorecard";
import TrainingScorecard from "./TrainingScorecard";
import InsuranceView from "./InsuranceView";
import DashboardView from "./DashboardView";
import DriversView from "./DriversView";
import PasswordChangeModal from "./PasswordChangeModal";
import AddLeadModal from "./AddLeadModal";
import GoCabLogo from "./GoCabLogo";
import { useLanguage } from "@/context/LanguageContext";
import { generateThankYouURL } from "@/lib/whatsapp";

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
  age?: number | null;
  permis_seniority_years?: number | null;
  is_resident?: boolean | null;
}

// Default Role → tabs fallback
const DEFAULT_ROLE_PERMISSIONS: Record<string, TabType[]> = {
  LEAD_ACQUISITION_JR:  ["dashboard", "leads", "training", "drivers"],
  FLEET_PERF_MANAGER:   ["dashboard", "drivers", "fleet", "tickets", "performance"],
  FIELD_SUPERVISOR:     ["dashboard", "drivers", "fleet", "field", "tickets"],
  FINANCE_OFFICER:      ["dashboard", "drivers", "performance", "insurance"],
  OPS_MANAGER:          ["dashboard", "leads", "training", "drivers", "fleet", "tickets", "performance", "field", "insurance", "settings"],
  ADMIN:                ["dashboard", "leads", "training", "drivers", "fleet", "tickets", "performance", "field", "insurance", "settings"],
};

const DEFAULT_ROLE_LABELS: Record<string, string> = {
  LEAD_ACQUISITION_JR: "Lead Acquisition",
  FLEET_PERF_MANAGER:  "Fleet Performance",
  FIELD_SUPERVISOR:    "Field Supervisor",
  FINANCE_OFFICER:     "Finance Officer",
  OPS_MANAGER:         "Ops Manager",
  ADMIN:               "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  LEAD_ACQUISITION_JR: "bg-blue-100 text-blue-700",
  FLEET_PERF_MANAGER:  "bg-amber-100 text-amber-700",
  FIELD_SUPERVISOR:    "bg-green-100 text-green-700",
  FINANCE_OFFICER:     "bg-purple-100 text-purple-700",
  OPS_MANAGER:         "bg-navy/10 text-navy",
  ADMIN:               "bg-red-100 text-red-700",
};

type TabType = "dashboard" | "leads" | "training" | "drivers" | "fleet" | "tickets" | "performance" | "field" | "insurance" | "settings";


const LEADS_COLUMNS = [
  "NEW_LEADS",
  "Not interested",
  "No response 1",
  "Training fixed",
  "To Recall",
  "Wrong number",
  "No response 2",
  "Already a client",
] as const;

const TRAINING_COLUMNS = [
  "Scheduled",
  "Attended",
  "Attended and not interested",
  "Pending",
  "Refused the offer",
  "Accept offer",
  "Not attended",
  "No response",
  "Preorder",
  "VEHICLE_ASSIGNMENT",
] as const;

export default function KanbanBoard() {
  const { language, setLanguage, t, dir } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role || "ADMIN";
  const userName = session?.user?.name || "";

  const [rolePermissions, setRolePermissions] = useState<Record<string, TabType[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>(DEFAULT_ROLE_LABELS);

  const allowedTabs = rolePermissions[userRole] || rolePermissions.ADMIN || DEFAULT_ROLE_PERMISSIONS.ADMIN;

  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

  useEffect(() => {
    if (session?.user && (session.user as any).mustChangePassword) {
      setShowPasswordChangeModal(true);
    }
  }, [session]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  
  // Navigation & Settings State — default to first allowed tab
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [whatsappTemplate, setWhatsappTemplate] = useState("");

  // Drawer state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  /** Fetch all leads from the API. */
  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Fetch settings on mount. */
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) {
        if (data.settings.whatsapp_invite_template) {
          setWhatsappTemplate(data.settings.whatsapp_invite_template);
        }
        if (data.settings.role_tab_permissions) {
          try {
            const parsed = JSON.parse(data.settings.role_tab_permissions);
            setRolePermissions(parsed);
          } catch (e) {}
        }
        if (data.settings.custom_role_labels) {
          try {
            const parsedLabels = JSON.parse(data.settings.custom_role_labels);
            setRoleLabels((prev) => ({ ...prev, ...parsedLabels }));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchSettings();

    // Auto-refresh the board every 1 minute to sync updates
    const interval = setInterval(fetchLeads, 60000);
    return () => clearInterval(interval);
  }, [fetchLeads, fetchSettings]);

  /** Group leads dynamically based on their specific status/column. */
  function getLeadsByColumn(column: string): Lead[] {
    if (activeTab === "leads") {
      if (column === "NEW_LEADS") {
        return leads.filter((l) => l.board_column === "NEW_LEADS");
      }
      return leads.filter(
        (l) => l.board_column === "BRAND_PRE_FILTER" && l.brand_status === column
      );
    } else {
      if (column === "VEHICLE_ASSIGNMENT") {
        return leads.filter((l) => l.board_column === "VEHICLE_ASSIGNMENT");
      }
      // If training_status is unset but board_column is TRAINING_PIPELINE, fallback to "Scheduled"
      if (column === "Scheduled") {
        return leads.filter(
          (l) =>
            l.board_column === "TRAINING_PIPELINE" &&
            (l.training_status === "Scheduled" || !l.training_status)
        );
      }
      return leads.filter(
        (l) => l.board_column === "TRAINING_PIPELINE" && l.training_status === column
      );
    }
  }

  /** Handle clicking on a card — open sliding detail drawer. */
  function handleCardClick(lead: Lead) {
    setSelectedLead(lead);
  }

  /** After drawer update, update the lead in state. */
  function handleLeadUpdate(updatedLead: Lead) {
    setLeads((prev) =>
      prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
    );
  }

  // ─── Drag & Drop Handlers ───────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;

    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Determine target column
    let targetColumn: string;
    const overLead = leads.find((l) => l.id === over.id);
    if (overLead) {
      // If dropped over a card, map to its corresponding column
      if (activeTab === "leads") {
        targetColumn = overLead.board_column === "NEW_LEADS" ? "NEW_LEADS" : (overLead.brand_status || "NEW_LEADS");
      } else {
        targetColumn = overLead.board_column === "VEHICLE_ASSIGNMENT" ? "VEHICLE_ASSIGNMENT" : (overLead.training_status || "Scheduled");
      }
    } else {
      targetColumn = over.id as string;
    }

    // We do NOT return early here because handleDragOver has already updated the 
    // local lead state to targetColumn for optimistic drag feedback. If we check
    // currentColumn === targetColumn, it will always be true and abort the API call!

    // Handle Leads Tab Drops
    if (activeTab === "leads") {
      if (targetColumn === "NEW_LEADS") {
        // Optimistic update
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, board_column: "NEW_LEADS", brand_status: null } : l
          )
        );
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_column: "NEW_LEADS", brand_status: null }),
          });
        } catch (err) {
          fetchLeads();
        }
      } else if (targetColumn === "Training fixed") {
        // Move to Training Pipeline immediately, and open drawer to prompt for date
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, board_column: "TRAINING_PIPELINE", brand_status: targetColumn, training_status: "Scheduled" } : l
          )
        );
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_column: "TRAINING_PIPELINE", brand_status: targetColumn, training_status: "Scheduled" }),
          });
          setSelectedLead({ ...lead, brand_status: "Training fixed" });
        } catch (err) {
          fetchLeads();
        }
      } else {
        // Move to Brand Pre-Filter status
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, board_column: "BRAND_PRE_FILTER", brand_status: targetColumn } : l
          )
        );
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_column: "BRAND_PRE_FILTER", brand_status: targetColumn }),
          });
        } catch (err) {
          fetchLeads();
        }
      }
    }
    // Handle Training Tab Drops
    else if (activeTab === "training") {
      if (targetColumn === "VEHICLE_ASSIGNMENT" || targetColumn === "Accept offer") {
        // Enforce KYC Document Checklist validation
        const isKycComplete =
          lead.has_cin &&
          lead.has_fiche_anthropometrique &&
          lead.has_confirmation_adresse &&
          lead.has_permis;

        if (!isKycComplete) {
          alert(
            "⚠️ Cannot accept offer: KYC Documents Checklist is incomplete!\nPlease verify CIN, Fiche anthropométrique, Confirmation d'adresse, and Permis first."
          );
          // Automatically open the details drawer to guide the user
          setSelectedLead(lead);
          return;
        }

        // Move to Vehicle Assignment / Accept offer immediately
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, board_column: "VEHICLE_ASSIGNMENT", training_status: "Accept offer" }
              : l
          )
        );
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_column: "VEHICLE_ASSIGNMENT", training_status: "Accept offer" }),
          });
          // Trigger WhatsApp thank you & Alert
          const waUrl = generateThankYouURL(lead.sanitized_phone);
          window.open(waUrl, "_blank");
          setTimeout(() => {
            alert("🚗 Assign Vehicle Module Unlocked");
          }, 300);
        } catch (err) {
          fetchLeads();
        }
      } else if (targetColumn === "Pending") {
        // Move to Pending immediately and open drawer
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, board_column: "TRAINING_PIPELINE", training_status: targetColumn } : l
          )
        );
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_column: "TRAINING_PIPELINE", training_status: targetColumn }),
          });
          setSelectedLead({ ...lead, training_status: "Pending" });
        } catch (err) {
          fetchLeads();
        }
      } else if (targetColumn === "Preorder") {
        // Move to Preorder immediately and open drawer
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, board_column: "TRAINING_PIPELINE", training_status: targetColumn } : l
          )
        );
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_column: "TRAINING_PIPELINE", training_status: targetColumn }),
          });
          setSelectedLead({ ...lead, training_status: "Preorder" });
        } catch (err) {
          fetchLeads();
        }
      } else {
        // Standard training status move
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, board_column: "TRAINING_PIPELINE", training_status: targetColumn } : l
          )
        );
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_column: "TRAINING_PIPELINE", training_status: targetColumn }),
          });
        } catch (err) {
          fetchLeads();
        }
      }
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    let targetColumn: string;
    const overLead = leads.find((l) => l.id === over.id);
    if (overLead) {
      if (activeTab === "leads") {
        targetColumn = overLead.board_column === "NEW_LEADS" ? "NEW_LEADS" : (overLead.brand_status || "NEW_LEADS");
      } else {
        targetColumn = overLead.board_column === "VEHICLE_ASSIGNMENT" ? "VEHICLE_ASSIGNMENT" : (overLead.training_status || "Scheduled");
      }
    } else {
      targetColumn = over.id as string;
    }

    // Move optimistically for drag feedback across all columns
    if (activeTab === "leads") {
        if (targetColumn === "NEW_LEADS") {
          if (lead.board_column !== "NEW_LEADS") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === leadId ? { ...l, board_column: "NEW_LEADS", brand_status: null } : l
              )
            );
          }
        } else {
          if (lead.brand_status !== targetColumn || lead.board_column !== "BRAND_PRE_FILTER") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === leadId ? { ...l, board_column: "BRAND_PRE_FILTER", brand_status: targetColumn } : l
              )
            );
          }
        }
      } else {
        if (targetColumn === "VEHICLE_ASSIGNMENT") {
          if (lead.board_column !== "VEHICLE_ASSIGNMENT") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === leadId ? { ...l, board_column: "VEHICLE_ASSIGNMENT", training_status: "Accept offer" } : l
              )
            );
          }
        } else {
          if (lead.training_status !== targetColumn || lead.board_column !== "TRAINING_PIPELINE") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === leadId ? { ...l, board_column: "TRAINING_PIPELINE", training_status: targetColumn } : l
              )
            );
          }
        }
      }
    }

  const activeLead = activeDragId ? leads.find((l) => l.id === activeDragId) : null;

  // Active columns arrays based on current tab
  const activeColumns = activeTab === "leads" ? LEADS_COLUMNS : TRAINING_COLUMNS;

  // Tab count indicators
  const leadsCount = leads.filter(
    (l) => l.board_column === "NEW_LEADS" || l.board_column === "BRAND_PRE_FILTER"
  ).length;
  const trainingCount = leads.filter(
    (l) => l.board_column === "TRAINING_PIPELINE" || l.board_column === "VEHICLE_ASSIGNMENT"
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading leads…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Top Header & Navigation Bar (Minimalist) */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          
          {/* Logo + Title */}
          <div className="flex items-center gap-4">
            <GoCabLogo className="w-10 h-10" />
            <div>
              <h1 className="text-gray-900 text-lg font-extrabold tracking-tight">{t.appName}</h1>
              <p className="text-gray-500 text-[10px] font-semibold tracking-widest uppercase">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Navigation Tabs - Pill Shaped with Role Gating */}
          <div className="flex flex-wrap items-center bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/50">
            {allowedTabs.includes("dashboard") && (
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "dashboard"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                📊 {t.home}
              </button>
            )}

            {allowedTabs.includes("leads") && (
              <button
                onClick={() => setActiveTab("leads")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "leads"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                💼 {t.leads}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    activeTab === "leads" ? "bg-navy/10 text-navy" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {leadsCount}
                </span>
              </button>
            )}

            {allowedTabs.includes("training") && (
              <button
                onClick={() => {
                  setActiveTab("training");
                  fetchSettings();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "training"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                🎓 {t.training}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    activeTab === "training" ? "bg-navy/10 text-navy" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {trainingCount}
                </span>
              </button>
            )}

            {allowedTabs.includes("drivers") && (
              <button
                onClick={() => setActiveTab("drivers")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "drivers"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                🚖 {t.drivers || "Chauffeurs"}
              </button>
            )}

            {allowedTabs.includes("fleet") && (
              <button
                onClick={() => setActiveTab("fleet")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "fleet"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                🚗 {t.fleet}
              </button>
            )}

            {allowedTabs.includes("tickets") && (
              <button
                onClick={() => setActiveTab("tickets")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "tickets"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                🔧 {t.support}
              </button>
            )}

            {allowedTabs.includes("performance") && (
              <button
                onClick={() => setActiveTab("performance")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "performance"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                📈 {t.perf}
              </button>
            )}

            {allowedTabs.includes("field") && (
              <button
                onClick={() => setActiveTab("field")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "field"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                🛡️ {t.field}
              </button>
            )}

            {allowedTabs.includes("insurance") && (
              <button
                onClick={() => setActiveTab("insurance")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "insurance"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                📝 {t.insurance}
              </button>
            )}

            {allowedTabs.includes("settings") && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "settings"
                    ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50 font-bold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                }`}
              >
                ⚙️ {t.settings}
              </button>
            )}
          </div>

          {/* Right side: Language Selector + CSV uploader + User badge + Sign out */}
          <div className="flex items-center gap-3">
            {/* Language Switcher Pill */}
            <div className="flex items-center bg-gray-100/90 p-1 rounded-xl border border-gray-200/60 shadow-inner">
              <button
                type="button"
                onClick={() => setLanguage("fr")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  language === "fr" ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
                title="Français"
              >
                🇫🇷 FR
              </button>
              <button
                type="button"
                onClick={() => setLanguage("ar")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  language === "ar" ? "bg-white text-navy shadow-sm font-semibold" : "text-gray-500 hover:text-gray-900"
                }`}
                title="العربية (Arabic)"
              >
                🇲🇦 عربي
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  language === "en" ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
                title="English"
              >
                🇬🇧 EN
              </button>
            </div>

            {(activeTab === "leads" || activeTab === "training") && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLeadModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all hover:shadow cursor-pointer"
                  title={language === "fr" ? "Ajouter un prospect manuellement" : language === "ar" ? "إضافة مرشح جديد يدوياً" : "Add lead manually"}
                >
                  <span>👤➕</span>
                  <span>{language === "fr" ? "Nouveau Prospect" : language === "ar" ? "إضافة مرشح" : "Add Lead"}</span>
                </button>
                <CSVUploader onUploadComplete={fetchLeads} />
              </div>
            )}
            
            {/* User info badge */}
            {userName && (
              <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-800 leading-none">{userName}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[userRole] || "bg-gray-100 text-gray-600"}`}>
                    {roleLabels[userRole] || DEFAULT_ROLE_LABELS[userRole] || userRole}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title={t.signOut}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Board Grid / Settings View / Fleet / Tickets / Performance / Field */}
      <main className="px-6 py-6 flex-1 w-full overflow-hidden flex flex-col">
        {activeTab === "dashboard" ? (
          <DashboardView />
        ) : activeTab === "settings" ? (
          <SettingsView />
        ) : activeTab === "drivers" ? (
          <DriversView />
        ) : activeTab === "fleet" ? (
          <FleetView />
        ) : activeTab === "tickets" ? (
          <SupportTicketsView />
        ) : activeTab === "performance" ? (
          <FleetPerformanceView />
        ) : activeTab === "field" ? (
          <FieldSupervisorView />
        ) : activeTab === "insurance" ? (
          <InsuranceView />
        ) : (

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {activeTab === "leads" && <LeadsScorecard leads={leads} />}
            {activeTab === "training" && <TrainingScorecard leads={leads} />}
            
            {/* Scrollable Horizontal Kanban Board Container */}
            <div className="flex-1 overflow-x-auto pb-4 scrollbar-thin">
              <div className="flex gap-5 min-h-[calc(100vh-14rem)] pb-2">
                {activeColumns.map((col) => (
                  <KanbanColumn
                    key={col}
                    columnId={col}
                    leads={getLeadsByColumn(col)}
                    onCardClick={handleCardClick}
                  />
                ))}
              </div>
            </div>

            {/* Drag Overlay — ghost card while dragging */}
            <DragOverlay>
              {activeLead ? (
                <div className="bg-white rounded-xl shadow-2xl border-2 border-navy/30 p-4 rotate-2 opacity-95">
                  <p className="font-semibold text-gray-900 text-sm">{activeLead.raw_name}</p>
                  <p className="text-xs text-gray-500 font-mono">{activeLead.sanitized_phone}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {/* Sliding Sidebar Drawer Detail View */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          boardType={activeTab === "leads" ? "leads" : "training"}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleLeadUpdate}
          whatsappTemplate={whatsappTemplate}
        />
      )}

      {/* Mandatory First-Login Password Change Modal */}
      {showPasswordChangeModal && session?.user && (
        <PasswordChangeModal
          userEmail={session.user.email}
          userName={session.user.name}
          onPasswordChanged={() => setShowPasswordChangeModal(false)}
        />
      )}

      {/* Manual Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddLeadModalOpen}
        onClose={() => setIsAddLeadModalOpen(false)}
        onLeadAdded={fetchLeads}
      />

      {/* Reminder Alerts */}
      <ReminderAlert leads={leads} />
    </div>
  );
}
