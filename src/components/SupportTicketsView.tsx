"use client";

/**
 * SupportTicketsView Component — Maintenance, Vidange, AdBlue & Repair Ticket Hub
 * 
 * Features:
 * 1. Live Downtime Counter: Real-time calculation of elapsed days/hours/minutes per open ticket.
 * 2. 24h SLA Tracking: Countdown badge per ticket; KPI bar shows resolution rate vs 95% target.
 * 3. Fleet Performance Decision Tool: Allows managers to evaluate downtime and record
 *    payment waivers / cancelled payment days for drivers.
 * 4. Status updates & resolution with vehicle status restoration options.
 * 5. Drag and Drop Kanban Board UI.
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
import { useLiveSync } from "@/context/LiveSyncContext";
import toast from "react-hot-toast";
import TicketDrawer, { MaintenanceTicket as BaseMaintenanceTicket } from "./TicketDrawer";
import TicketKanbanColumn from "./TicketKanbanColumn";
import TicketKanbanCard from "./TicketKanbanCard";
import BonDeCommandeModal from "./BonDeCommandeModal";
import { BonDeCommandeData, getFormattedToday } from "@/lib/bonDeCommandeCatalog";

// Extend with SLA fields added in Sprint 2
export type MaintenanceTicket = BaseMaintenanceTicket & {
  sla_deadline?: string | null;
  sla_breached?: boolean;
};

const TICKET_COLUMNS = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;

export default function SupportTicketsView() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [showBreachedOnly, setShowBreachedOnly] = useState(false);
  
  // DND State
  const [activeDragTicket, setActiveDragTicket] = useState<MaintenanceTicket | null>(null);

  // Resolution Modal State
  const [resolvingTicket, setResolvingTicket] = useState<MaintenanceTicket | null>(null);
  const [repairCost, setRepairCost] = useState<string>("");
  const [garageName, setGarageName] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [isResolvingSubmitting, setIsResolvingSubmitting] = useState(false);

  // Drawer state for creating ticket
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Waiver Modal state
  const [waiverTicket, setWaiverTicket] = useState<MaintenanceTicket | null>(null);
  const [waivedDays, setWaivedDays] = useState<number>(1);
  const [waiverReason, setWaiverReason] = useState<string>("");
  const [isWaiverSubmitting, setIsWaiverSubmitting] = useState(false);

  // Bon de Commande Modal state
  const [bcTicket, setBcTicket] = useState<MaintenanceTicket | null>(null);
  const [bcInitialData, setBcInitialData] = useState<Partial<BonDeCommandeData> | null>(null);

  // Live timer tick every 10 seconds
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedType) params.set("type", selectedType);

      const res = await fetch(`/api/tickets?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedType]);

  // Live sync: auto-refreshes tickets when modified anywhere
  const { notifyMutation } = useLiveSync("tickets", fetchTickets);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  /** Formats elapsed downtime duration into readable Days, Hours, Minutes, Seconds string */
  function getDowntimeDuration(
    createdAt: string,
    resolvedAt: string | null,
    startedAt?: string | null,
    ticketType?: string
  ) {
    const isService = ticketType === "Vidange" || ticketType === "AdBleu";
    // If it's a Vidange/AdBleu and not started and not resolved yet, return "00m 00s"
    if (isService && !startedAt && !resolvedAt) {
      return "00m 00s";
    }

    const start = (startedAt ? new Date(startedAt) : new Date(createdAt)).getTime();
    const end = resolvedAt ? new Date(resolvedAt).getTime() : nowTimestamp;
    const diffMs = Math.max(0, end - start);

    const seconds = Math.floor((diffMs / 1000) % 60);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }

  async function handleCancelMission(ticket: MaintenanceTicket) {
    const confirmMsg = `⚠️ Annuler la mission de récupération pour le véhicule ${ticket.plate_number} ?\n\n• La tâche sera immédiatement retirée de la page Terrain.\n• Les agents de terrain recevront une notification Telegram d'annulation.\n• Le véhicule sera automatiquement débloqué (Statut: Actif).`;
    if (!confirm(confirmMsg)) return;

    const previousTickets = tickets;
    setTickets((prev) => prev.filter((t) => t.id !== ticket.id));

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`🚫 Mission annulée pour ${ticket.plate_number}. Agents terrain notifiés !`);
        notifyMutation("tickets");
      } else {
        setTickets(previousTickets);
        toast.error("Échec de l'annulation de la mission");
      }
    } catch (err) {
      setTickets(previousTickets);
      console.error("Failed to cancel mission:", err);
      toast.error("Erreur lors de l'annulation de la mission");
    }
  }

  async function handleDeleteTicket(id: string) {
    const ticketToDelete = tickets.find((t) => t.id === id);
    const isRecovery = ticketToDelete?.ticket_type === "VEHICLE_RECOVERY" || ticketToDelete?.ticket_type === "Vehicle Recovery";

    const promptText = isRecovery
      ? `⚠️ Annuler la mission et supprimer le ticket pour le véhicule ${ticketToDelete?.plate_number} ?\n\n• La tâche terrain sera retirée.\n• Les agents recevront une alerte Telegram d'annulation.\n• Le véhicule sera débloqué.`
      : "Are you sure you want to delete this ticket?";

    if (!confirm(promptText)) return;
    const previousTickets = tickets;
    // Optimistically remove immediately from UI
    setTickets((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(isRecovery ? `🚫 Mission annulée et ticket supprimé (${ticketToDelete?.plate_number})` : "Ticket deleted");
        notifyMutation("tickets");
      } else {
        setTickets(previousTickets);
        toast.error("Failed to delete ticket");
      }
    } catch (err) {
      setTickets(previousTickets);
      console.error("Failed to delete ticket:", err);
      toast.error("Error deleting ticket");
    }
  }

  async function handleSaveWaiver(e: React.FormEvent) {
    e.preventDefault();
    if (!waiverTicket) return;

    setIsWaiverSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${waiverTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_waived: true,
          waived_days: Number(waivedDays),
          waiver_reason: waiverReason,
        }),
      });

      if (res.ok) {
        toast.success("Payment waiver applied successfully");
        setWaiverTicket(null);
        fetchTickets();
        notifyMutation("tickets");
      } else {
        toast.error("Failed to apply waiver");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save waiver");
      console.error("Failed to save waiver:", err);
    } finally {
      setIsWaiverSubmitting(false);
    }
  }

  async function handleCancelWaiver(ticketId: string) {
    if (!confirm("Remove payment day waiver for this ticket?")) return;
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_waived: false,
          waived_days: 0,
          waiver_reason: null,
        }),
      });

      if (res.ok) {
        toast.success("Waiver removed");
        fetchTickets();
        notifyMutation("tickets");
      } else {
        toast.error("Failed to cancel waiver");
      }
    } catch (err: any) {
      toast.error(err.message || "Error cancelling waiver");
      console.error("Failed to cancel waiver:", err);
    }
  }

  async function handleSaveResolution(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvingTicket) return;

    setIsResolvingSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${resolvingTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          restore_vehicle_status: true,
          target_vehicle_status: "Actif",
          repair_cost: repairCost ? Number(repairCost) : null,
          garage_name: garageName ? garageName.trim() : null,
          resolution_notes: resolutionNotes ? resolutionNotes.trim() : null,
        }),
      });

      if (res.ok) {
        toast.success("Ticket resolved successfully");
        setResolvingTicket(null);
        fetchTickets();
        notifyMutation("tickets");
      } else {
        toast.error("Failed to resolve ticket");
      }
    } catch (err: any) {
      toast.error(err.message || "Error resolving ticket");
      console.error("Failed to resolve ticket:", err);
    } finally {
      setIsResolvingSubmitting(false);
    }
  }

  function handleOpenResolutionModal(ticket: MaintenanceTicket) {
    setResolvingTicket(ticket);
    setGarageName(ticket.garage_name || "");
    setRepairCost(ticket.repair_cost !== undefined && ticket.repair_cost !== null ? String(ticket.repair_cost) : "");
    setResolutionNotes(ticket.resolution_notes || "");
  }

  async function handleOpenBcModal(ticket: MaintenanceTicket) {
    setBcTicket(ticket);

    // Check if ticket already has attached bon de commande
    let existingBc: Partial<BonDeCommandeData> | null = null;
    if (ticket.resolution_notes) {
      try {
        const parsed = JSON.parse(ticket.resolution_notes);
        if (parsed && parsed.bon_de_commande) {
          existingBc = parsed.bon_de_commande;
        }
      } catch {
        // not JSON
      }
    }

    if (existingBc) {
      setBcInitialData(existingBc);
    } else {
      // Pre-fill from ticket & attempt to fetch vehicle details
      let makeModel = "";
      let mileage = "";
      let vin = "";

      try {
        const res = await fetch(`/api/vehicles?search=${encodeURIComponent(ticket.plate_number)}`);
        const data = await res.json();
        const v = data.vehicles?.find(
          (veh: any) =>
            veh.plate_number.toLowerCase() === ticket.plate_number.toLowerCase() ||
            veh.id === ticket.vehicle_id
        );
        if (v) {
          makeModel = v.make_model || "";
          mileage = v.current_mileage ? `${v.current_mileage.toLocaleString()} Km` : "";
          vin = v.vin || "";
        }
      } catch (err) {
        console.warn("Could not fetch vehicle details for BC:", err);
      }

      setBcInitialData({
        bc_number: "",
        date: getFormattedToday(),
        supplier_name: ticket.garage_name || "Hard Auto Services",
        vehicle_make_model: makeModel,
        vehicle_plate: ticket.plate_number,
        vehicle_mileage: mileage,
        vehicle_vin: vin,
        items:
          ticket.ticket_type === "Vidange"
            ? [{ id: "vidange_1", designation: "Vidange complète", quantity: 1, unit_price_ttc: 960, total_ttc: 960 }]
            : ticket.ticket_type === "AdBleu"
            ? [{ id: "adblue_1", designation: "AdBlue", quantity: 1, unit_price_ttc: 95, total_ttc: 95 }]
            : [],
        execution_delay: getFormattedToday(),
        observations: "N/A",
        validator_name: "Hamza RASSID",
        validator_role: "Gérant",
        validated: false,
      });
    }
  }

  async function handleSaveBc(savedBc: BonDeCommandeData) {
    if (!bcTicket) return;
    try {
      const res = await fetch(`/api/tickets/${bcTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repair_cost: savedBc.total_ttc,
          garage_name: savedBc.supplier_name,
          resolution_notes: JSON.stringify({ bon_de_commande: savedBc }),
        }),
      });

      if (res.ok) {
        toast.success("Bon de Commande validé et enregistré !");
        setBcTicket(null);
        setBcInitialData(null);
        fetchTickets();
        notifyMutation("tickets");
      } else {
        toast.error("Échec de l'enregistrement du Bon de Commande");
      }
    } catch (err) {
      console.error("Error saving Bon de Commande:", err);
      toast.error("Erreur réseau");
    }
  }

  async function handleStatusChange(ticket: MaintenanceTicket, newStatus: string, accidentStep?: string) {
    const previousTickets = tickets;
    // Optimistically update the ticket status & accident_step in local state immediately!
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              status: newStatus,
              started_at: newStatus === "IN_PROGRESS" && !t.started_at ? new Date().toISOString() : t.started_at,
              accident_step: accidentStep !== undefined ? accidentStep : (newStatus === "RESOLVED" ? "VEHICLE_BACK" : t.accident_step),
              resolved_at: newStatus === "RESOLVED" ? new Date().toISOString() : null,
            }
          : t
      )
    );

    try {
      const payload: any = { status: newStatus };
      if (newStatus === "IN_PROGRESS" && !ticket.started_at) {
        payload.started_at = new Date().toISOString();
      }
      if (accidentStep) {
        payload.accident_step = accidentStep;
      }
      if (newStatus === "RESOLVED") {
        payload.restore_vehicle_status = true;
        payload.target_vehicle_status = "Actif";
      }

      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          newStatus === "RESOLVED"
            ? "Ticket résolu avec succès"
            : newStatus === "IN_PROGRESS"
            ? (accidentStep ? `Étape enregistrée : ${accidentStep} (Passé En cours)` : "Ticket passé En cours")
            : "Ticket replacé en Ouvert"
        );
        notifyMutation("tickets");
        fetchTickets();
      } else {
        setTickets(previousTickets);
        toast.error("Échec de la mise à jour du statut");
      }
    } catch (err) {
      setTickets(previousTickets);
      console.error("Failed to update status:", err);
      toast.error("Erreur réseau");
    }
  }

  async function handleStartTicket(ticket: MaintenanceTicket) {
    try {
      const nowIso = new Date().toISOString();
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          started_at: nowIso,
          status: "IN_PROGRESS",
        }),
      });

      if (res.ok) {
        toast.success(`⏱️ Opération ${ticket.ticket_type} démarrée pour ${ticket.plate_number}!`);
        fetchTickets();
        notifyMutation("tickets");
      } else {
        toast.error("Échec du démarrage de l'opération");
      }
    } catch (err) {
      console.error("Failed to start ticket timer:", err);
      toast.error("Erreur lors du démarrage du chronomètre");
    }
  }

  async function handleStopTicket(ticket: MaintenanceTicket) {
    try {
      const nowIso = new Date().toISOString();
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          resolved_at: nowIso,
        }),
      });

      if (res.ok) {
        toast.success(`✅ Opération terminée & Ticket résolu automatiquement (${ticket.plate_number})`);
        fetchTickets();
        notifyMutation("tickets");
      } else {
        toast.error("Échec de la résolution du ticket");
      }
    } catch (err) {
      console.error("Failed to stop ticket:", err);
      toast.error("Erreur lors de l'arrêt du ticket");
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;
    if (activeData?.type === "Ticket") {
      setActiveDragTicket(activeData.ticket as MaintenanceTicket);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTicket = active.data.current?.type === "Ticket";
    const isOverColumn = over.data.current?.type === "Column" || TICKET_COLUMNS.includes(overId as any);

    if (isActiveTicket) {
      setTickets((tickets) => {
        const activeIndex = tickets.findIndex((t) => t.id === activeId);
        if (activeIndex === -1) return tickets;
        
        let newStatus = tickets[activeIndex].status;
        
        if (isOverColumn) {
           newStatus = overId as string;
        } else {
           const overIndex = tickets.findIndex((t) => t.id === overId);
           if (overIndex !== -1) {
             newStatus = tickets[overIndex].status;
           }
        }
        
        if (tickets[activeIndex].status !== newStatus) {
            const newTickets = [...tickets];
            newTickets[activeIndex] = { ...newTickets[activeIndex], status: newStatus };
            return newTickets;
        }

        return tickets;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const originalTicket = activeDragTicket;
    setActiveDragTicket(null);

    const { active, over } = event;
    if (!over || !originalTicket) {
      // Revert visual change if dropped outside any column
      fetchTickets();
      return;
    }

    const activeId = active.id as string;
    const sourceStatus = originalTicket.status;

    let targetStatus: string | null = null;

    if (TICKET_COLUMNS.includes(over.id as any)) {
      targetStatus = over.id as string;
    } else {
      const overTicket = tickets.find((t) => t.id === over.id);
      if (overTicket) {
        targetStatus = overTicket.status;
      }
    }

    if (!targetStatus || targetStatus === sourceStatus) {
      // Revert if dropped back in original column or invalid target
      fetchTickets();
      return;
    }

    try {
      const payload: any = { status: targetStatus };
      if (targetStatus === "RESOLVED") {
        payload.restore_vehicle_status = true;
        payload.target_vehicle_status = "Actif";
      }

      const res = await fetch(`/api/tickets/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          targetStatus === "RESOLVED"
            ? "Ticket marked as resolved"
            : `Ticket moved to ${targetStatus === "IN_PROGRESS" ? "In Progress" : "Open"}`
        );
        fetchTickets();
        notifyMutation("tickets");
      } else {
        toast.error("Failed to update status");
        fetchTickets();
      }
    } catch (err: any) {
      toast.error("Failed to update status");
      console.error("Failed to update status on drag end", err);
      fetchTickets();
    }
  };

  function getTicketsByStatus(status: string) {
    let filtered = tickets.filter((t) => t.status === status);
    if (showBreachedOnly) {
      filtered = filtered.filter((t) => {
        if (!t.sla_deadline) return false;
        return new Date(t.sla_deadline).getTime() < Date.now() && t.status !== "RESOLVED";
      });
    }
    return filtered;
  }

  /** Computes SLA countdown label for a ticket */
  function getSlaLabel(ticket: MaintenanceTicket): { label: string; color: string } | null {
    if (!ticket.sla_deadline || ticket.status === "RESOLVED") return null;
    const msLeft = new Date(ticket.sla_deadline).getTime() - Date.now();
    if (msLeft <= 0) return { label: "SLA BREACHED", color: "red" };
    const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
    const minsLeft = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    if (hoursLeft < 2) return { label: `⏰ ${hoursLeft}h ${minsLeft}m left`, color: "amber" };
    return { label: `✅ ${hoursLeft}h left`, color: "green" };
  }

  // SLA KPI calculations
  const openAndInProgress = tickets.filter((t) => t.status !== "RESOLVED");
  const breachedCount = openAndInProgress.filter(
    (t) => t.sla_deadline && new Date(t.sla_deadline).getTime() < Date.now()
  ).length;
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;
  const totalClosed = tickets.length;
  const slaResolutionRate = totalClosed > 0 ? Math.round((resolvedCount / totalClosed) * 100) : 0;
  const slaTarget = 95;

  return (
    <div className="flex flex-col h-full w-full max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🔧</span> Driver Support Kanban
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Drag and drop support tickets through resolution. Manage downtime and waivers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none w-48"
            />
            <span className="absolute left-3 top-2 text-gray-400 text-[10px]">🔍</span>
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none bg-white text-gray-700 font-medium cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="VEHICLE_RECOVERY">🚨 Vehicle Recovery</option>
            <option value="Vidange">🛢️ Vidange</option>
            <option value="AdBleu">💧 AdBleu</option>
            <option value="Repair">🔧 Repair</option>
            <option value="Accident">💥 Accident</option>
            <option value="Fourrière">🚔 Fourrière</option>
            <option value="Police Immobilization">🛑 Immobilisation Police</option>
            <option value="Custom">📋 Custom (BC)</option>
          </select>

          <button
            onClick={() => setShowBreachedOnly((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              showBreachedOnly
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-red-600 border-red-200 hover:bg-red-50"
            }`}
          >
            🚨 Breached SLA{breachedCount > 0 ? ` (${breachedCount})` : ""}
          </button>

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="px-4 py-2 bg-navy hover:bg-navy/95 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <span>➕</span> New Ticket
          </button>
        </div>
      </div>

      {/* SLA KPI Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-4 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700">24h SLA Resolution Rate</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              slaResolutionRate >= slaTarget ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}>
              {slaResolutionRate}% / Target: {slaTarget}%
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {breachedCount > 0 && (
              <span className="text-red-600 font-semibold">🚨 {breachedCount} ticket{breachedCount > 1 ? "s" : ""} breached SLA</span>
            )}
            <span>{resolvedCount} resolved of {totalClosed} total</span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              slaResolutionRate >= slaTarget ? "bg-green-500" : "bg-amber-500"
            }`}
            style={{ width: `${Math.min(slaResolutionRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Kanban Board Area */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
          Loading Kanban board…
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto pb-4 scrollbar-thin">
            <div className="flex gap-6 min-h-full pb-2">
              {TICKET_COLUMNS.map((col) => (
                <TicketKanbanColumn
                  key={col}
                  columnId={col}
                  tickets={getTicketsByStatus(col)}
                  getDowntimeDuration={getDowntimeDuration}
                  onWaiveClick={(t) => {
                    setWaiverTicket(t);
                    setWaivedDays(t.waived_days || 1);
                    setWaiverReason(t.waiver_reason || "");
                  }}
                  onDeleteClick={handleDeleteTicket}
                  onCancelMissionClick={handleCancelMission}
                  onCancelWaiverClick={handleCancelWaiver}
                  onResolveClick={handleOpenResolutionModal}
                  onStatusChange={handleStatusChange}
                  onStartClick={handleStartTicket}
                  onStopClick={handleStopTicket}
                  onBonDeCommandeClick={handleOpenBcModal}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeDragTicket ? (
              <div className="rotate-2 opacity-95 pointer-events-none w-[320px]">
                <TicketKanbanCard
                  ticket={activeDragTicket}
                  downtimeStr={getDowntimeDuration(activeDragTicket.created_at, activeDragTicket.resolved_at, activeDragTicket.started_at, activeDragTicket.ticket_type)}
                  isResolved={activeDragTicket.status === "RESOLVED"}
                  onWaiveClick={() => {}}
                  onDeleteClick={() => {}}
                  onCancelMissionClick={() => {}}
                  onCancelWaiverClick={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal / Drawer for Creating Ticket */}
      {isDrawerOpen && (
        <TicketDrawer
          onClose={() => setIsDrawerOpen(false)}
          onSaveSuccess={fetchTickets}
        />
      )}

      {/* Fleet Performance Payment Waiver Modal */}
      {waiverTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-navy flex items-center gap-2">
                <span>💸</span> Payment Waiver Tool
              </h3>
              <button
                onClick={() => setWaiverTicket(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1 font-mono">
              <div>🚗 <strong>Vehicle:</strong> {waiverTicket.plate_number}</div>
              <div>🛠️ <strong>Issue:</strong> {waiverTicket.ticket_type} - {waiverTicket.description}</div>
              <div>⏱️ <strong>Downtime:</strong> {getDowntimeDuration(waiverTicket.created_at, waiverTicket.resolved_at)}</div>
            </div>

            <form onSubmit={handleSaveWaiver} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Days to Waive *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="30"
                  required
                  value={waivedDays}
                  onChange={(e) => setWaivedDays(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Justification Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Excessive garage repair time"
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWaiverTicket(null)}
                  className="px-4 py-2 text-xs text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isWaiverSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  {isWaiverSubmitting ? "Saving..." : "Approve Waiver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Resolution Modal */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-navy flex items-center gap-2">
                <span>{resolvingTicket.status === "RESOLVED" ? "📝" : "✅"}</span>{" "}
                {resolvingTicket.status === "RESOLVED" ? "Resolution Details" : "Resolve Ticket"}
              </h3>
              <button
                onClick={() => setResolvingTicket(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 space-y-1 font-mono">
              <div>🚗 <strong>Vehicle:</strong> {resolvingTicket.plate_number}</div>
              <div>🛠️ <strong>Issue:</strong> {resolvingTicket.ticket_type} - {resolvingTicket.description}</div>
            </div>

            <form onSubmit={handleSaveResolution} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Garage Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Garage Auto Plus"
                  value={garageName}
                  onChange={(e) => setGarageName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Repair Cost MAD (Optional)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={repairCost}
                  onChange={(e) => setRepairCost(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  placeholder="Describe what was fixed or actions taken..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingTicket(null)}
                  className="px-4 py-2 text-xs text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolvingSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  {isResolvingSubmitting ? "Saving..." : resolvingTicket.status === "RESOLVED" ? "Save Details" : "Confirm & Resolve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bon de Commande Modal for viewing, editing, or printing */}
      {bcTicket && bcInitialData && (
        <BonDeCommandeModal
          isOpen={Boolean(bcTicket)}
          onClose={() => {
            setBcTicket(null);
            setBcInitialData(null);
          }}
          onSave={handleSaveBc}
          initialData={bcInitialData}
        />
      )}
    </div>
  );
}
