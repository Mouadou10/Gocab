"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MaintenanceTicket } from "./TicketDrawer";

interface TicketKanbanCardProps {
  ticket: MaintenanceTicket;
  downtimeStr: string;
  onWaiveClick: (ticket: MaintenanceTicket) => void;
  onDeleteClick: (id: string) => void;
  onCancelWaiverClick: (id: string) => void;
  isResolved: boolean;
}

export default function TicketKanbanCard({
  ticket,
  downtimeStr,
  onWaiveClick,
  onDeleteClick,
  onCancelWaiverClick,
  isResolved,
}: TicketKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    data: {
      type: "Ticket",
      ticket,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white rounded-xl shadow-sm border p-4 flex flex-col gap-3 relative group
        ${isDragging ? "opacity-50 border-navy ring-2 ring-navy/30 scale-[1.02]" : "border-gray-200 hover:shadow-md hover:border-gray-300"}
      `}
    >
      {/* Drag Handle & Header */}
      <div className="flex items-start justify-between">
        <div 
          {...attributes} 
          {...listeners}
          className="flex-1 cursor-grab active:cursor-grabbing hover:bg-gray-50 -ml-2 p-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-200 text-xs">
            🚗 {ticket.plate_number}
          </span>
        </div>

        {/* Priority Badge */}
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider whitespace-nowrap mt-1 ${
            ticket.priority === "Critical"
              ? "bg-red-100 text-red-700 border border-red-200"
              : ticket.priority === "Urgent"
              ? "bg-amber-100 text-amber-700 border border-amber-200"
              : "bg-gray-100 text-gray-600 border border-gray-200"
          }`}
        >
          {ticket.priority}
        </span>
      </div>

      {/* Type & Field Status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-navy/10 text-navy whitespace-nowrap">
          {ticket.ticket_type === "Vidange" && "🛢️ Vidange"}
          {ticket.ticket_type === "AdBleu" && "💧 AdBleu"}
          {ticket.ticket_type === "Repair" && "🔧 Repair"}
          {ticket.ticket_type === "Accident" && "💥 Accident"}
          {!["Vidange", "AdBleu", "Repair", "Accident"].includes(ticket.ticket_type) && ticket.ticket_type}
        </span>
        
        {isResolved && ticket.field_status && ticket.field_status !== "COMPLETED" && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider flex items-center gap-1">
            <span>🛡️</span> {ticket.field_status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100 line-clamp-3">
        {ticket.description}
      </p>

      {/* Driver details */}
      {(ticket.driver_name || ticket.driver_phone) && (
        <div className="text-xs text-gray-600 font-medium flex items-center gap-2">
          <span>👤 {ticket.driver_name || "Driver"}</span>
          {ticket.driver_phone && <span className="font-mono text-gray-500">({ticket.driver_phone})</span>}
        </div>
      )}

      {/* Downtime Counter Box */}
      <div
        className={`p-2.5 rounded-xl border text-center w-full ${
          isResolved
            ? "bg-gray-50 border-gray-200 text-gray-600"
            : "bg-amber-50/80 border-amber-200 text-amber-900"
        }`}
      >
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
          {isResolved ? "Total Downtime" : "⏱️ Elapsed Downtime"}
        </div>
        <div className="text-base font-black font-mono tracking-tight text-navy">
          {downtimeStr}
        </div>
        <div className="text-[9px] text-gray-400 mt-1 truncate">
          {new Date(ticket.created_at).toLocaleString()}
        </div>
      </div>

      {/* Fleet Performance Payment Waiver */}
      {ticket.payment_waived ? (
        <div className="flex flex-col gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] p-2 rounded-xl">
          <div className="font-bold flex items-center justify-between">
            <span>💸 {ticket.waived_days} Day(s) Waived</span>
            <button
              onClick={() => onCancelWaiverClick(ticket.id)}
              className="text-red-600 hover:underline px-1"
            >
              Remove
            </button>
          </div>
          {ticket.waiver_reason && <span className="italic opacity-80 leading-tight">"{ticket.waiver_reason}"</span>}
        </div>
      ) : (
        <div className="text-[10px] text-gray-400 italic">
          No payment waiver recorded.
        </div>
      )}

      {/* Action Buttons (visible on hover or always on touch devices via media query, but let's just make them visible at the bottom) */}
      <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100">
        <button
          onClick={() => onWaiveClick(ticket)}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
        >
          💸 Waive Payment
        </button>
        <button
          onClick={() => onDeleteClick(ticket.id)}
          className="text-xs text-gray-400 hover:text-red-600 transition-colors"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
