"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Inbox, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { MaintenanceTicket } from "./TicketDrawer";
import TicketKanbanCard from "./TicketKanbanCard";

interface TicketKanbanColumnProps {
  columnId: string;
  tickets: MaintenanceTicket[];
  getDowntimeDuration: (
    createdAt: string,
    resolvedAt: string | null,
    startedAt?: string | null,
    ticketType?: string
  ) => string;
  onWaiveClick: (ticket: MaintenanceTicket) => void;
  onDeleteClick: (id: string) => void;
  onCancelMissionClick?: (ticket: MaintenanceTicket) => void;
  onCancelWaiverClick: (id: string) => void;
  onResolveClick?: (ticket: MaintenanceTicket) => void;
  onStatusChange?: (ticket: MaintenanceTicket, newStatus: string, accidentStep?: string) => void;
  onStartClick?: (ticket: MaintenanceTicket) => void;
  onStopClick?: (ticket: MaintenanceTicket) => void;
  onBonDeCommandeClick?: (ticket: MaintenanceTicket) => void;
}

const COLUMN_CONFIG: Record<
  string,
  {
    label: string;
    sublabel: string;
    dotColor: string;
    badgeBg: string;
    badgeText: string;
    borderAccent: string;
    emptyIcon: any;
    emptyTitle: string;
    emptySubtitle: string;
  }
> = {
  OPEN: {
    label: "Tickets Ouverts",
    sublabel: "En attente de prise en charge",
    dotColor: "bg-blue-600 shadow-blue-500/50",
    badgeBg: "bg-blue-50 border-blue-200",
    badgeText: "text-blue-700",
    borderAccent: "border-t-blue-500",
    emptyIcon: Inbox,
    emptyTitle: "Aucun ticket ouvert",
    emptySubtitle: "Tous les tickets récents ont été pris en charge.",
  },
  IN_PROGRESS: {
    label: "En Cours",
    sublabel: "Interventions actives",
    dotColor: "bg-amber-500 shadow-amber-500/50 animate-pulse",
    badgeBg: "bg-amber-50 border-amber-200",
    badgeText: "text-amber-700",
    borderAccent: "border-t-amber-500",
    emptyIcon: Clock,
    emptyTitle: "Aucune intervention en cours",
    emptySubtitle: "Glissez un ticket ici ou cliquez sur Démarrer pour lancer le chrono.",
  },
  RESOLVED: {
    label: "Résolus & Clôturés",
    sublabel: "Véhicules rétablis",
    dotColor: "bg-emerald-600 shadow-emerald-500/50",
    badgeBg: "bg-emerald-50 border-emerald-200",
    badgeText: "text-emerald-700",
    borderAccent: "border-t-emerald-500",
    emptyIcon: CheckCircle2,
    emptyTitle: "Aucun ticket résolu",
    emptySubtitle: "Les tickets clôturés apparaîtront ici.",
  },
};

export default function TicketKanbanColumn({
  columnId,
  tickets,
  getDowntimeDuration,
  onWaiveClick,
  onDeleteClick,
  onCancelMissionClick,
  onCancelWaiverClick,
  onResolveClick,
  onStatusChange,
  onStartClick,
  onStopClick,
  onBonDeCommandeClick,
}: TicketKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const config = COLUMN_CONFIG[columnId] || {
    label: columnId,
    sublabel: "",
    dotColor: "bg-slate-400 shadow-slate-400/50",
    badgeBg: "bg-slate-100 border-slate-200",
    badgeText: "text-slate-700",
    borderAccent: "border-t-slate-400",
    emptyIcon: Inbox,
    emptyTitle: "Aucun élément",
    emptySubtitle: "",
  };

  const EmptyIcon = config.emptyIcon;

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col bg-slate-50/70 rounded-2xl min-h-[calc(100vh-14rem)] flex-1 min-w-[22rem]
        transition-all duration-200 border border-slate-200/70 border-t-4 ${config.borderAccent}
        ${isOver ? "ring-2 ring-blue-500/40 bg-blue-50/30 scale-[1.005]" : ""}
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3.5 rounded-t-xl bg-white border-b border-slate-100 shadow-2xs z-10">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full shadow-xs ${config.dotColor}`}
          />
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {config.label}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              {config.sublabel}
            </p>
          </div>
        </div>

        <span
          className={`text-xs font-black font-mono px-2.5 py-0.5 rounded-full border shadow-2xs ${config.badgeBg} ${config.badgeText}`}
        >
          {tickets.length}
        </span>
      </div>

      {/* Drop Zone + Card List */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map((ticket) => (
            <TicketKanbanCard
              key={ticket.id}
              ticket={ticket}
              downtimeStr={getDowntimeDuration(
                ticket.created_at,
                ticket.resolved_at,
                ticket.started_at,
                ticket.ticket_type
              )}
              isResolved={ticket.status === "RESOLVED"}
              onWaiveClick={onWaiveClick}
              onDeleteClick={onDeleteClick}
              onCancelMissionClick={onCancelMissionClick}
              onCancelWaiverClick={onCancelWaiverClick}
              onResolveClick={onResolveClick}
              onStatusChange={onStatusChange}
              onStartClick={onStartClick}
              onStopClick={onStopClick}
              onBonDeCommandeClick={onBonDeCommandeClick}
            />
          ))}
        </SortableContext>

        {/* Modern Empty State */}
        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
              <EmptyIcon className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-xs font-bold text-slate-700">{config.emptyTitle}</p>
            <p className="text-[11px] text-slate-400 max-w-[220px] mt-1 leading-relaxed">
              {config.emptySubtitle}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

