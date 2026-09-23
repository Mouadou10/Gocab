"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Inbox, Clock, CheckCircle2, AlertCircle, Archive } from "lucide-react";
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
  isSearching?: boolean;
  showArchived?: boolean;
  totalArchivedCount?: number;
  onToggleShowArchived?: () => void;
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
    label: "Résolus & Archivés",
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
  isSearching = false,
  showArchived = false,
  totalArchivedCount = 0,
  onToggleShowArchived,
}: TicketKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const isResolvedColumn = columnId === "RESOLVED";

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

  // Dynamic header sublabel & badge for RESOLVED column
  let displaySublabel = config.sublabel;
  let displayBadge = `${tickets.length}`;

  if (isResolvedColumn) {
    if (isSearching) {
      displaySublabel = tickets.length > 0 ? "Historique trouvé" : "Aucun historique trouvé";
      displayBadge = `${tickets.length}`;
    } else if (showArchived) {
      displaySublabel = "Historique complet affiché";
      displayBadge = `${tickets.length}`;
    } else {
      displaySublabel = "Archivés pour clarté";
      displayBadge = totalArchivedCount > 0 ? `${totalArchivedCount} archivés` : "0";
    }
  }

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
              {displaySublabel}
            </p>
          </div>
        </div>

        <span
          className={`text-xs font-black font-mono px-2.5 py-0.5 rounded-full border shadow-2xs ${config.badgeBg} ${config.badgeText}`}
        >
          {displayBadge}
        </span>
      </div>

      {/* Drop Zone + Card List */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {/* Banner indicator when resolved tickets are shown due to search or explicit toggle */}
        {isResolvedColumn && isSearching && tickets.length > 0 && (
          <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 rounded-xl px-3 py-2 text-xs">
            <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
              <span>🔍</span> {tickets.length} ticket(s) résolu(s) dans l&apos;historique
            </span>
          </div>
        )}

        {isResolvedColumn && !isSearching && showArchived && tickets.length > 0 && (
          <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
            <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
              <span>📂</span> Historique complet ({tickets.length})
            </span>
            {onToggleShowArchived && (
              <button
                type="button"
                onClick={onToggleShowArchived}
                className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
              >
                Masquer
              </button>
            )}
          </div>
        )}

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

        {/* Empty States */}
        {tickets.length === 0 && (
          isResolvedColumn ? (
            !isSearching && !showArchived ? (
              /* Archive Collapsed Placeholder */
              <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                <div className="w-13 h-13 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-3 shadow-2xs">
                  <Archive className="w-6 h-6 stroke-[1.75]" />
                </div>
                <p className="text-xs font-black text-slate-800">
                  {totalArchivedCount > 0 ? `${totalArchivedCount} tickets clôturés archivés` : "Tickets résolus archivés"}
                </p>
                <p className="text-[11px] text-slate-400 max-w-[240px] mt-1.5 leading-relaxed">
                  Pour garder le Kanban fluide, les tickets résolus sont archivés. Recherchez une plaque ou un chauffeur pour consulter tout son historique.
                </p>
                {totalArchivedCount > 0 && onToggleShowArchived && (
                  <button
                    type="button"
                    onClick={onToggleShowArchived}
                    className="mt-4 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 hover:border-emerald-400 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <Archive className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Afficher l&apos;historique ({totalArchivedCount})</span>
                  </button>
                )}
              </div>
            ) : (
              /* Search resulted in 0 resolved tickets */
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
                  <CheckCircle2 className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-xs font-bold text-slate-700">Aucun historique pour cette recherche</p>
                <p className="text-[11px] text-slate-400 max-w-[220px] mt-1 leading-relaxed">
                  Aucun ticket résolu archivé ne correspond aux critères saisis.
                </p>
              </div>
            )
          ) : (
            /* Regular Empty State for OPEN & IN_PROGRESS */
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3">
                <EmptyIcon className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-xs font-bold text-slate-700">{config.emptyTitle}</p>
              <p className="text-[11px] text-slate-400 max-w-[220px] mt-1 leading-relaxed">
                {config.emptySubtitle}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

