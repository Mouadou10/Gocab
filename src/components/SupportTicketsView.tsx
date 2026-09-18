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
import {
  Wrench,
  Search,
  Plus,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Check,
} from "lucide-react";
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
  const [selectedPriority, setSelectedPriority] = useState("");
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
            ? [{ id: "vidange_1", designation: "Vidange Castrol 5W30 ECT 5L (480dhs TTC) + Filtre à Huile (50Dhs TTC)", quantity: 1, unit_price_ttc: 530, total_ttc: 530 }]
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
    if (selectedPriority) {
      filtered = filtered.filter(
        (t) => t.priority?.toLowerCase() === selectedPriority.toLowerCase()
      );
    }
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
  const inProgressCount = tickets.filter((t) => t.status === "IN_PROGRESS").length;
  const breachedCount = openAndInProgress.filter(
    (t) => t.sla_deadline && new Date(t.sla_deadline).getTime() < Date.now()
  ).length;
  const resolvedCount = tickets.filter((t) => t.status === "RESOLVED").length;
  const totalCount = tickets.length;
  const slaResolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;
  const slaTarget = 95;

  const hasActiveFilters = Boolean(
    searchTerm || selectedType || selectedPriority || showBreachedOnly
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedType("");
    setSelectedPriority("");
    setShowBreachedOnly(false);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-[1600px] mx-auto">
      {/* 1. Top Header & Search/Filter Toolbar */}
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200/90 mb-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5 tracking-tight">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Wrench className="w-4 h-4" />
              </div>
              <span>Driver Support Kanban</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pilotez les pannes, récupérations et vidanges en temps réel. Suivi SLA 24h & exonérations.
            </p>
          </div>

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouveau Ticket</span>
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <input
              type="text"
              placeholder="Rechercher immatriculation, chauffeur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 absolute right-2.5 top-2.5 flex items-center justify-center text-[10px]"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border border-slate-200/90 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none bg-slate-50 font-medium text-slate-700 cursor-pointer"
          >
            <option value="">Tous les types</option>
            <option value="VEHICLE_RECOVERY">🚨 Récupération Véhicule</option>
            <option value="Vidange">🛢️ Vidange</option>
            <option value="AdBleu">💧 AdBlue</option>
            <option value="Repair">🔧 Réparation Garage</option>
            <option value="Accident">💥 Accident</option>
            <option value="Fourrière">🚔 Fourrière</option>
            <option value="Police Immobilization">🛑 Immobilisation Police</option>
            <option value="Custom">📋 Bon de Commande</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="border border-slate-200/90 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none bg-slate-50 font-medium text-slate-700 cursor-pointer"
          >
            <option value="">Toutes priorités</option>
            <option value="Critical">🔴 Critique</option>
            <option value="Urgent">🟠 Urgent</option>
            <option value="Normal">🟢 Normal</option>
          </select>

          <button
            type="button"
            onClick={() => setShowBreachedOnly((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              showBreachedOnly
                ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
            }`}
          >
            <span>🚨</span>
            <span>Hors SLA</span>
            {breachedCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  showBreachedOnly ? "bg-rose-700 text-white" : "bg-rose-100 text-rose-800"
                }`}
              >
                {breachedCount}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-2 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Effacer filtres</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Executive SLA Health & KPI Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 mb-4 shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5">
          {/* Card 1: 24h SLA Resolution Rate */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Taux Résolution 24h
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span
                  className={`text-xl font-black font-mono tracking-tight ${
                    slaResolutionRate >= slaTarget
                      ? "text-emerald-700"
                      : slaResolutionRate >= 75
                      ? "text-amber-700"
                      : "text-rose-700"
                  }`}
                >
                  {slaResolutionRate}%
                </span>
                <span className="text-[10px] text-slate-400 font-medium">/ obj. {slaTarget}%</span>
              </div>
            </div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                slaResolutionRate >= slaTarget
                  ? "bg-emerald-100 text-emerald-700"
                  : slaResolutionRate >= 75
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {slaResolutionRate >= slaTarget ? "🎯" : "⚠️"}
            </div>
          </div>

          {/* Card 2: Breached SLA */}
          <div
            onClick={() => setShowBreachedOnly((v) => !v)}
            className={`border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all ${
              showBreachedOnly
                ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                : breachedCount > 0
                ? "bg-rose-50/70 border-rose-200 text-rose-950 hover:bg-rose-100/60"
                : "bg-slate-50 border-slate-200/80 text-slate-800"
            }`}
          >
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider block ${
                  showBreachedOnly ? "text-rose-100" : "text-rose-700"
                }`}
              >
                Tickets Hors SLA
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span
                  className={`text-xl font-black font-mono tracking-tight ${
                    showBreachedOnly ? "text-white" : "text-rose-700"
                  }`}
                >
                  {breachedCount}
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    showBreachedOnly ? "text-rose-200" : "text-rose-600/80"
                  }`}
                >
                  {breachedCount > 0 ? "en dépassement" : "conforme"}
                </span>
              </div>
            </div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                showBreachedOnly ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-700"
              }`}
            >
              🚨
            </div>
          </div>

          {/* Card 3: In Progress Interventions */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Interventions En Cours
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-black font-mono tracking-tight text-amber-700">
                  {inProgressCount}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">chrono actif</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              ⏱️
            </div>
          </div>

          {/* Card 4: Resolved / Closed */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Résolus / Clôturés
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-black font-mono tracking-tight text-emerald-700">
                  {resolvedCount}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">sur {totalCount} total</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              ✅
            </div>
          </div>
        </div>

        {/* Progress Bar with Target Indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-semibold">Objectif SLA 24h</span>
            <span className="font-mono font-bold text-slate-700">
              {slaResolutionRate}% résolus (Cible: {slaTarget}%)
            </span>
          </div>
          <div className="relative w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                slaResolutionRate >= slaTarget
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                  : slaResolutionRate >= 75
                  ? "bg-gradient-to-r from-amber-500 to-orange-500"
                  : "bg-gradient-to-r from-rose-500 to-red-600"
              }`}
              style={{ width: `${Math.min(slaResolutionRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Kanban Board Area */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <div className="w-7 h-7 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          Chargement du Kanban...
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
                  downtimeStr={getDowntimeDuration(
                    activeDragTicket.created_at,
                    activeDragTicket.resolved_at,
                    activeDragTicket.started_at,
                    activeDragTicket.ticket_type
                  )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                  💸
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Outil d&apos;Exonération de Paiement
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Compensation pour immobilisation excessive
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWaiverTicket(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 space-y-1">
              <div>🚗 <strong>Véhicule :</strong> {waiverTicket.plate_number}</div>
              <div>🛠️ <strong>Panne :</strong> {waiverTicket.ticket_type} - {waiverTicket.description}</div>
              <div>⏱️ <strong>Downtime :</strong> {getDowntimeDuration(waiverTicket.created_at, waiverTicket.resolved_at)}</div>
            </div>

            <form onSubmit={handleSaveWaiver} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de jours à exonérer *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="30"
                  required
                  value={waivedDays}
                  onChange={(e) => setWaivedDays(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motif / Justification
                </label>
                <input
                  type="text"
                  placeholder="ex: Délai excessif de réparation au garage"
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWaiverTicket(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isWaiverSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isWaiverSubmitting ? "Enregistrement..." : "Approuver l'Exonération"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Resolution Modal */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                  {resolvingTicket.status === "RESOLVED" ? "📝" : "✅"}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {resolvingTicket.status === "RESOLVED" ? "Détails de Clôture" : "Clôturer & Rétablir le Véhicule"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Enregistrement des réparations & restitution
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResolvingTicket(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 space-y-1">
              <div>🚗 <strong>Véhicule :</strong> {resolvingTicket.plate_number}</div>
              <div>🛠️ <strong>Panne :</strong> {resolvingTicket.ticket_type} - {resolvingTicket.description}</div>
            </div>

            <form onSubmit={handleSaveResolution} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom du Garage (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="ex: Garage Auto Plus"
                  value={garageName}
                  onChange={(e) => setGarageName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Coût de Réparation en MAD (Optionnel)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={repairCost}
                  onChange={(e) => setRepairCost(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes de Clôture / Travaux réalisés
                </label>
                <textarea
                  placeholder="Décrire les réparations effectuées, pièces remplacées..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingTicket(null)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isResolvingSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isResolvingSubmitting
                    ? "Enregistrement..."
                    : resolvingTicket.status === "RESOLVED"
                    ? "Sauvegarder les Détails"
                    : "Confirmer & Résoudre"}
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
