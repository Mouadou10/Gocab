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
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
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

// Default Landing Page for each role on initial login
const ROLE_DEFAULT_LANDING_TAB: Record<string, TabType> = {
  LEAD_ACQUISITION_JR: "leads",
  FLEET_PERF_MANAGER:  "fleet",
  FIELD_SUPERVISOR:    "field",
  FINANCE_OFFICER:     "performance",
  OPS_MANAGER:         "dashboard",
  ADMIN:               "dashboard",
};


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
  "Assign vehicle",
  "Not attended",
  "No response",
  "Preorder",
] as const;

export default function KanbanBoard() {
  const { language, setLanguage, t, dir } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role || "ADMIN";
  const userName = session?.user?.name || "";

  const [rolePermissions, setRolePermissions] = useState<Record<string, TabType[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>(DEFAULT_ROLE_LABELS);

  const userRoleTabs = rolePermissions[userRole] || DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.ADMIN || [];
  const allowedTabs = userRoleTabs.includes("drivers") ? userRoleTabs : [...userRoleTabs, "drivers"];

  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [dailyCallsTarget, setDailyCallsTarget] = useState(34);
  const [dailyTrainingTarget, setDailyTrainingTarget] = useState(7);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [hasCelebratedToday, setHasCelebratedToday] = useState(false);

  useEffect(() => {
    if (session?.user && (session.user as any).mustChangePassword) {
      setShowPasswordChangeModal(true);
    }
  }, [session]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeColumnDragId, setActiveColumnDragId] = useState<string | null>(null);

  // Column order states
  const [leadsColumns, setLeadsColumns] = useState<string[]>([...LEADS_COLUMNS]);
  const [trainingColumns, setTrainingColumns] = useState<string[]>([...TRAINING_COLUMNS]);
  
  // Navigation & Settings State — persisted across refreshes
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isTabRestored, setIsTabRestored] = useState(false);
  const [whatsappTemplate, setWhatsappTemplate] = useState("");

  // Restore tab on mount/refresh or default to role's assigned page on sign in
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const urlTab = new URLSearchParams(window.location.search).get("tab") as TabType;
      const storedTab = (
        localStorage.getItem(`gocab_active_tab_${userRole}`) ||
        localStorage.getItem("gocab_active_tab")
      ) as TabType;

      const candidate = urlTab || storedTab;

      if (candidate && allowedTabs.includes(candidate)) {
        setActiveTab(candidate);
      } else {
        const defaultLanding =
          ROLE_DEFAULT_LANDING_TAB[userRole] ||
          (allowedTabs.length > 0 ? allowedTabs[0] : "dashboard");
        setActiveTab(defaultLanding);
      }
    } catch (e) {
      const defaultLanding =
        ROLE_DEFAULT_LANDING_TAB[userRole] ||
        (allowedTabs.length > 0 ? allowedTabs[0] : "dashboard");
      setActiveTab(defaultLanding);
    }
    setIsTabRestored(true);
  }, [userRole, allowedTabs]);

  // Tab switcher that saves state for page refreshes
  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "training") {
      fetchSettings();
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`gocab_active_tab_${userRole}`, tab);
        localStorage.setItem("gocab_active_tab", tab);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", tab);
        window.history.replaceState({}, "", url.toString());
      } catch (e) {}
    }
  };

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
            const merged: Record<string, TabType[]> = { ...DEFAULT_ROLE_PERMISSIONS };
            for (const [k, v] of Object.entries(parsed)) {
              const tabs = Array.isArray(v) ? (v as TabType[]) : [];
              if (!tabs.includes("drivers")) {
                tabs.push("drivers");
              }
              merged[k] = tabs;
            }
            setRolePermissions(merged);
          } catch (e) {}
        }
        if (data.settings.department_weekly_targets) {
          try {
            const targets = JSON.parse(data.settings.department_weekly_targets);
            if (targets.target_daily_calls) setDailyCallsTarget(Number(targets.target_daily_calls));
            if (targets.target_daily_training_fixed) setDailyTrainingTarget(Number(targets.target_daily_training_fixed));
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

  // Daily Performance Metrics for Target Gating
  const todayStr = new Date().toISOString().split("T")[0];

  const callsDoneToday = leads.filter((l) => {
    if (l.board_column === "NEW_LEADS") return false;
    if (!l.status_changed_at) return false;
    try {
      const d = new Date(l.status_changed_at);
      if (isNaN(d.getTime())) return false;
      return d.toISOString().split("T")[0] === todayStr;
    } catch {
      return false;
    }
  }).length;

  const trainingFixedToday = leads.filter((l) => {
    if (
      l.brand_status !== "Training fixed" &&
      l.board_column !== "TRAINING_PIPELINE" &&
      l.board_column !== "VEHICLE_ASSIGNMENT"
    )
      return false;
    if (!l.status_changed_at) return false;
    try {
      const d = new Date(l.status_changed_at);
      if (isNaN(d.getTime())) return false;
      return d.toISOString().split("T")[0] === todayStr;
    } catch {
      return false;
    }
  }).length;

  const isDailyTrainingGoalAchieved = trainingFixedToday >= dailyTrainingTarget;
  const totalNewLeadsInDB = leads.filter((l) => l.board_column === "NEW_LEADS").length;

  // Trigger celebration modal once when training goal is reached — ONLY for Lead Acquisition
  useEffect(() => {
    const isLeadAcquisition = activeTab === "leads" || userRole === "LEAD_ACQUISITION_JR";
    if (isLeadAcquisition && isDailyTrainingGoalAchieved && !hasCelebratedToday && leads.length > 0) {
      setShowCelebrationModal(true);
      setHasCelebratedToday(true);
    }
  }, [isDailyTrainingGoalAchieved, hasCelebratedToday, leads.length, activeTab, userRole]);

  /** Group leads dynamically based on their specific status/column. */
  function getLeadsByColumn(column: string): Lead[] {
    if (activeTab === "leads") {
      if (column === "NEW_LEADS") {
        const allNewLeads = leads
          .filter((l) => l.board_column === "NEW_LEADS")
          .sort((a, b) => {
            const getTimestamp = (item: any) => {
              try {
                const dateStr = item?.updated_at || item?.created_at;
                if (!dateStr) return 0;
                const time = new Date(dateStr).getTime();
                return isNaN(time) ? 0 : time;
              } catch {
                return 0;
              }
            };
            return getTimestamp(b) - getTimestamp(a);
          });

        // If daily training target is achieved or calls target reached, continue displaying the active queue
        let targetBatchCount = dailyCallsTarget - callsDoneToday;
        if (targetBatchCount <= 0 || isDailyTrainingGoalAchieved) {
          targetBatchCount = Math.max(15, Math.min(allNewLeads.length, dailyCallsTarget));
        }

        return allNewLeads.slice(0, Math.max(1, targetBatchCount));
      }
      if (column === "Training fixed") {
        return leads.filter((l) => {
          const isTrainingFixed =
            l.brand_status === "Training fixed" ||
            (l.board_column === "TRAINING_PIPELINE" &&
              (l.training_status === "Scheduled" || !l.training_status));
          
          if (!isTrainingFixed) return false;

          // Remove leads with previous/past training dates (only show today or future)
          if (l.reminder_date) {
            try {
              const d = new Date(l.reminder_date);
              if (!isNaN(d.getTime())) {
                const scheduledDateStr = d.toISOString().split("T")[0];
                if (scheduledDateStr < todayStr) {
                  return false;
                }
              }
            } catch {}
          }
          return true;
        });
      }
      return leads.filter(
        (l) => l.board_column === "BRAND_PRE_FILTER" && l.brand_status === column
      );
    } else {
      if (column === "Assign vehicle" || column === "VEHICLE_ASSIGNMENT" || column === "Accept offer") {
        return leads.filter(
          (l) =>
            l.board_column === "VEHICLE_ASSIGNMENT" ||
            l.training_status === "Assign vehicle" ||
            l.training_status === "Accept offer"
        );
      }
      // If training_status is unset but board_column is TRAINING_PIPELINE, fallback to "Scheduled"
      if (column === "Scheduled") {
        return leads.filter((l) => {
          if (l.board_column !== "TRAINING_PIPELINE") return false;
          if (l.training_status && l.training_status !== "Scheduled") return false;

          // If a scheduled training date is set in the future, hide until training date arrives!
          if (l.reminder_date) {
            try {
              const d = new Date(l.reminder_date);
              if (!isNaN(d.getTime())) {
                const scheduledDateStr = d.toISOString().split("T")[0];
                if (scheduledDateStr > todayStr) {
                  return false;
                }
              }
            } catch {}
          }
          return true;
        });
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

  /** Bring selected status column to 2nd position (right after NEW_LEADS) */
  function handleBringColumnToSecond(columnKey: string) {
    if (activeTab === "leads") {
      setLeadsColumns((prev) => {
        const withoutTarget = prev.filter((c) => c !== columnKey && c !== "NEW_LEADS");
        return ["NEW_LEADS", columnKey, ...withoutTarget];
      });
    } else {
      setTrainingColumns((prev) => {
        const withoutTarget = prev.filter((c) => c !== columnKey);
        if (withoutTarget.length > 0) {
          const first = withoutTarget[0];
          const rest = withoutTarget.slice(1);
          return [first, columnKey, ...rest];
        }
        return prev;
      });
    }
  }

  // ─── Drag & Drop Handlers ───────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Column") {
      setActiveColumnDragId(event.active.id as string);
      return;
    }
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // Handle Column Dragging
    if (active.data.current?.type === "Column") {
      setActiveColumnDragId(null);
      if (!over) return;
      if (active.id !== over.id) {
        if (activeTab === "leads") {
          const oldIndex = leadsColumns.indexOf(active.id as string);
          const newIndex = leadsColumns.indexOf(over.id as string);
          const newOrder = [...leadsColumns];
          newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, active.id as string);
          setLeadsColumns(newOrder);
        } else {
          const oldIndex = trainingColumns.indexOf(active.id as string);
          const newIndex = trainingColumns.indexOf(over.id as string);
          const newOrder = [...trainingColumns];
          newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, active.id as string);
          setTrainingColumns(newOrder);
        }
      }
      return;
    }

    setActiveDragId(null);
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
      if (targetColumn === "Assign vehicle" || targetColumn === "VEHICLE_ASSIGNMENT" || targetColumn === "Accept offer") {
        // Enforce KYC Document Checklist validation
        const isKycComplete =
          lead.has_cin &&
          lead.has_fiche_anthropometrique &&
          lead.has_confirmation_adresse &&
          lead.has_permis;

        if (!isKycComplete) {
          alert(
            "⚠️ Cannot assign vehicle: KYC Documents Checklist is incomplete!\nPlease verify CIN, Fiche anthropométrique, Confirmation d'adresse, and Permis first."
          );
          // Automatically open the details drawer to guide the user
          setSelectedLead(lead);
          return;
        }

        // Move to Vehicle Assignment immediately and open drawer to choose vehicle
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, board_column: "VEHICLE_ASSIGNMENT", training_status: "Assign vehicle" }
              : l
          )
        );
        try {
          await fetch(`/api/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_column: "VEHICLE_ASSIGNMENT", training_status: "Assign vehicle" }),
          });
          // Trigger WhatsApp thank you & Alert
          const waUrl = generateThankYouURL(lead.sanitized_phone);
          window.open(waUrl, "_blank");
          setSelectedLead(lead);
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

    if (active.data.current?.type === "Column") {
      return; // Handled in DragEnd
    }

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
        if (targetColumn === "Assign vehicle" || targetColumn === "VEHICLE_ASSIGNMENT" || targetColumn === "Accept offer") {
          if (lead.board_column !== "VEHICLE_ASSIGNMENT" || lead.training_status !== "Assign vehicle") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === leadId ? { ...l, board_column: "VEHICLE_ASSIGNMENT", training_status: "Assign vehicle" } : l
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
  const activeColumns = activeTab === "leads" ? leadsColumns : trainingColumns;

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
                onClick={() => handleSelectTab("dashboard")}
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
                onClick={() => handleSelectTab("leads")}
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
                onClick={() => handleSelectTab("training")}
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
                onClick={() => handleSelectTab("drivers")}
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
                onClick={() => handleSelectTab("fleet")}
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
                onClick={() => handleSelectTab("tickets")}
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
                onClick={() => handleSelectTab("performance")}
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
                onClick={() => handleSelectTab("field")}
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
                onClick={() => handleSelectTab("insurance")}
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
                onClick={() => handleSelectTab("settings")}
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
            {activeTab === "leads" && (
              <LeadsScorecard
                leads={leads}
                onSelectStatus={handleBringColumnToSecond}
              />
            )}
            {activeTab === "training" && (
              <TrainingScorecard
                leads={leads}
                onSelectStatus={handleBringColumnToSecond}
              />
            )}
            
            {/* Scrollable Horizontal Kanban Board Container */}
            <div className="flex-1 overflow-x-auto pb-4 scrollbar-thin">
              <div className="flex gap-5 min-h-[calc(100vh-14rem)] pb-2">
                <SortableContext items={activeColumns} strategy={horizontalListSortingStrategy}>
                  {activeColumns.map((col) => (
                    <KanbanColumn
                      key={col}
                      columnId={col}
                      leads={getLeadsByColumn(col)}
                      onCardClick={handleCardClick}
                      isDailyGoalAchieved={col === "NEW_LEADS" && isDailyTrainingGoalAchieved}
                      totalNewLeadsCount={col === "NEW_LEADS" ? totalNewLeadsInDB : undefined}
                      dailyTrainingFixedToday={trainingFixedToday}
                      dailyTrainingTarget={dailyTrainingTarget}
                      callsDoneToday={callsDoneToday}
                      dailyCallsTarget={dailyCallsTarget}
                    />
                  ))}
                </SortableContext>
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
        activeTab={activeTab}
      />

      {/* Reminder Alerts */}
      <ReminderAlert leads={leads} />

      {/* Target Reached Celebration Modal (Lead Acquisition Only) */}
      {showCelebrationModal && (activeTab === "leads" || userRole === "LEAD_ACQUISITION_JR") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-md w-full overflow-hidden text-center p-8 space-y-5">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-amber-400 via-emerald-400 to-teal-400 p-1 flex items-center justify-center shadow-lg">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-4xl animate-bounce">
                🏆
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black">
                <span>✨</span> OBJECTIF DU JOUR ATTEINT <span>✨</span>
              </div>
              <h2 className="text-2xl font-black text-navy tracking-tight">
                🎉 Félicitations ! 🎉
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                Bravo ! Vous avez atteint votre objectif de{" "}
                <strong>{dailyTrainingTarget} formations fixées</strong> aujourd&apos;hui avec{" "}
                <strong>{callsDoneToday} appels</strong> !
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-2xs">
                <span className="text-3xs font-bold text-gray-400 uppercase">Formations Fixées</span>
                <p className="text-lg font-black text-emerald-600 mt-0.5">
                  {trainingFixedToday} / {dailyTrainingTarget}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-2xs">
                <span className="text-3xs font-bold text-gray-400 uppercase">Appels Totaux</span>
                <p className="text-lg font-black text-navy mt-0.5">
                  {callsDoneToday}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCelebrationModal(false)}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Super ! Merci 🚀</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
