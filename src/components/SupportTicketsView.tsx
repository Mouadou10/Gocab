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
import toast from "react-hot-toast";
import TicketDrawer, { MaintenanceTicket as BaseMaintenanceTicket } from "./TicketDrawer";
import TicketKanbanColumn from "./TicketKanbanColumn";
import TicketKanbanCard from "./TicketKanbanCard";

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
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedType) params.set("type", selectedType);

      const res = await fetch(`/api/tickets?${params.toString()}`);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedType]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  /** Formats elapsed downtime duration into readable Days, Hours, Minutes string */
  function getDowntimeDuration(createdAt: string, resolvedAt: string | null) {
    const start = new Date(createdAt).getTime();
    const end = resolvedAt ? new Date(resolvedAt).getTime() : nowTimestamp;
    const diffMs = Math.max(0, end - start);

    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  async function handleDeleteTicket(id: string) {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Ticket deleted");
        fetchTickets();
      } else {
        toast.error("Failed to delete ticket");
      }
    } catch (err) {
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
          garage_name: garageName,
          resolution_notes: resolutionNotes,
        }),
      });

      if (res.ok) {
        toast.success("Ticket resolved successfully");
        setResolvingTicket(null);
        fetchTickets();
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
    setActiveDragTicket(null);
    const { active, over } = event;
    if (!over) return;

    const activeTicket = tickets.find((t) => t.id === active.id);
    if (!activeTicket) return;

    let targetStatus = activeTicket.status;

    if (TICKET_COLUMNS.includes(over.id as any)) {
      targetStatus = over.id as string;
    } else {
      const overTicket = tickets.find((t) => t.id === over.id);
      if (overTicket) {
        targetStatus = overTicket.status;
      }
    }

    if (targetStatus === activeTicket.status) return;

    if (targetStatus === "RESOLVED") {
      setResolvingTicket(activeTicket);
      setRepairCost("");
      setGarageName("");
      setResolutionNotes("");
    } else {
      try {
        await fetch(`/api/tickets/${activeTicket.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        toast.success("Ticket status updated");
        fetchTickets();
      } catch (err: any) {
        toast.error("Failed to update status");
        console.error("Failed to update status on drag end", err);
        fetchTickets();
      }
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
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none bg-white text-gray-700 font-medium"
          >
            <option value="">All Types</option>
            <option value="Vidange">🛢️ Vidange</option>
            <option value="AdBleu">💧 AdBleu</option>
            <option value="Repair">🔧 Repair</option>
            <option value="Accident">💥 Accident</option>
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
                  onCancelWaiverClick={handleCancelWaiver}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeDragTicket ? (
              <div className="rotate-2 opacity-95 pointer-events-none w-[320px]">
                <TicketKanbanCard
                  ticket={activeDragTicket}
                  downtimeStr={getDowntimeDuration(activeDragTicket.created_at, activeDragTicket.resolved_at)}
                  isResolved={activeDragTicket.status === "RESOLVED"}
                  onWaiveClick={() => {}}
                  onDeleteClick={() => {}}
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
                <span>✅</span> Resolve Ticket
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
                  Resolution Notes
                </label>
                <textarea
                  required
                  placeholder="Describe what was fixed..."
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
                  {isResolvingSubmitting ? "Resolving..." : "Confirm & Resolve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
