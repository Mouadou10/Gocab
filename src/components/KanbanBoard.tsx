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
import GoCabLogo from "./GoCabLogo";
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
}

type TabType = "dashboard" | "leads" | "training" | "fleet" | "tickets" | "performance" | "field" | "insurance" | "settings";


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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  
  // Navigation & Settings State
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [whatsappTemplate, setWhatsappTemplate] = useState("");

  // Drawer state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

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
      if (data.settings && data.settings.whatsapp_invite_template) {
        setWhatsappTemplate(data.settings.whatsapp_invite_template);
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
              <h1 className="text-gray-900 text-lg font-extrabold tracking-tight">GoCab CRM</h1>
              <p className="text-gray-500 text-[10px] font-semibold tracking-widest uppercase">
                Growth & KYC Module
              </p>
            </div>
          </div>

          {/* Navigation Tabs - Pill Shaped */}
          <div className="flex flex-wrap items-center bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/50">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "dashboard"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              📊 Home
            </button>

            <button
              onClick={() => setActiveTab("leads")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "leads"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              💼 Leads
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === "leads" ? "bg-navy/10 text-navy" : "bg-gray-200 text-gray-500"
                }`}
              >
                {leadsCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("training");
                fetchSettings();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "training"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              🎓 Training
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === "training" ? "bg-navy/10 text-navy" : "bg-gray-200 text-gray-500"
                }`}
              >
                {trainingCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("fleet")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "fleet"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              🚗 Fleet
            </button>

            <button
              onClick={() => setActiveTab("tickets")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "tickets"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              🔧 Support
            </button>

            <button
              onClick={() => setActiveTab("performance")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "performance"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              📈 Perf
            </button>

            <button
              onClick={() => setActiveTab("field")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "field"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              🛡️ Field
            </button>

            <button
              onClick={() => setActiveTab("insurance")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "insurance"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              📝 Insurance
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === "settings"
                  ? "bg-white text-navy shadow-sm ring-1 ring-gray-200/50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
              }`}
            >
              ⚙️
            </button>
          </div>

          {/* CSV File Upload Section */}
          <div className="flex items-center gap-4">
            {(activeTab === "leads" || activeTab === "training") && <CSVUploader onUploadComplete={fetchLeads} />}
            <div className="hidden xl:flex items-center gap-2 text-gray-500 text-xs font-medium px-3 py-1.5 bg-gray-100 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              SQLite (Sync)
            </div>
          </div>

        </div>
      </header>

      {/* Main Board Grid / Settings View / Fleet / Tickets / Performance / Field */}
      <main className="px-6 py-6 flex-1 w-full overflow-hidden flex flex-col">
        {activeTab === "dashboard" ? (
          <DashboardView />
        ) : activeTab === "settings" ? (
          <SettingsView />
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

      {/* Reminder Alerts */}
      <ReminderAlert leads={leads} />
    </div>
  );
}
