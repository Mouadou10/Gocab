"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MaintenanceTicket } from "./TicketDrawer";
import TicketKanbanCard from "./TicketKanbanCard";

interface TicketKanbanColumnProps {
  columnId: string;
  tickets: MaintenanceTicket[];
  getDowntimeDuration: (createdAt: string, resolvedAt: string | null) => string;
  onWaiveClick: (ticket: MaintenanceTicket) => void;
  onDeleteClick: (id: string) => void;
  onCancelWaiverClick: (id: string) => void;
}

const COLUMN_LABELS: Record<string, string> = {
  OPEN: "Open Tickets",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

const COLUMN_ACCENTS: Record<string, string> = {
  OPEN: "from-blue-500 to-blue-600",
  IN_PROGRESS: "from-amber-500 to-orange-500",
  RESOLVED: "from-emerald-500 to-emerald-600",
};

export default function TicketKanbanColumn({
  columnId,
  tickets,
  getDowntimeDuration,
  onWaiveClick,
  onDeleteClick,
  onCancelWaiverClick,
}: TicketKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col bg-gray-50/80 rounded-2xl min-h-[calc(100vh-14rem)] flex-1 min-w-[22rem]
        transition-all duration-200 border border-gray-200/50
        ${isOver ? "ring-2 ring-navy/30 bg-navy/5" : ""}
      `}
    >
      {/* Column Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-t-2xl bg-white border-b border-gray-100 shadow-sm z-10">
        <div
          className={`w-3 h-3 rounded-full bg-gradient-to-br ${
            COLUMN_ACCENTS[columnId] || "from-gray-400 to-gray-500"
          }`}
        />
        <h3 className="text-sm font-bold text-gray-800 tracking-wide">
          {COLUMN_LABELS[columnId] || columnId}
        </h3>
        <span className="ml-auto text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-mono">
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
              downtimeStr={getDowntimeDuration(ticket.created_at, ticket.resolved_at)}
              isResolved={ticket.status === "RESOLVED"}
              onWaiveClick={onWaiveClick}
              onDeleteClick={onDeleteClick}
              onCancelWaiverClick={onCancelWaiverClick}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs font-medium">No tickets in {COLUMN_LABELS[columnId]?.toLowerCase()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
