"use client";

/**
 * KanbanColumn Component
 *
 * A single column in the Kanban board. Acts as a drop zone for
 * @dnd-kit and renders a list of LeadCards.
 */

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { Inbox } from "lucide-react";
import LeadCard from "./LeadCard";

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

/** Maps DB enum & statuses to user-friendly column titles. */
const COLUMN_LABELS: Record<string, string> = {
  // Leads Page
  NEW_LEADS: "New Leads",
  "Not interested": "Not Interested",
  "No response 1": "No Response 1",
  "Training fixed": "Training Fixed",
  "To Recall": "To Recall",
  "Wrong number": "Wrong Number",
  "No response 2": "No Response 2",
  "Already a client": "Already a Client",

  // Training Page
  Scheduled: "Scheduled",
  Attended: "Attended",
  "Attended and not interested": "Attended & Not Interested",
  Pending: "Pending",
  "Refused the offer": "Refused Offer",
  "Assign vehicle": "Assign Vehicle",
  "Accept offer": "Assign Vehicle",
  "Not attended": "Not Attended",
  "No response": "No Response",
  Preorder: "Preorder",
  VEHICLE_ASSIGNMENT: "Assign Vehicle",
};

/** Column-specific accent colors (left border gradient). */
const COLUMN_ACCENTS: Record<string, string> = {
  NEW_LEADS: "from-blue-500 to-blue-600",
  "Training fixed": "from-teal-500 to-emerald-500",
  "Already a client": "from-olive to-green-600",
  Scheduled: "from-indigo-500 to-purple-500",
  "Assign vehicle": "from-emerald-500 to-teal-600",
  "Accept offer": "from-emerald-500 to-teal-600",
  VEHICLE_ASSIGNMENT: "from-emerald-500 to-teal-600",
  Pending: "from-amber-500 to-orange-500",
  Preorder: "from-pink-500 to-rose-500",
};

interface KanbanColumnProps {
  columnId: string;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  isDailyGoalAchieved?: boolean;
  totalNewLeadsCount?: number;
  dailyTrainingFixedToday?: number;
  dailyTrainingTarget?: number;
  callsDoneToday?: number;
  dailyCallsTarget?: number;
}

export default function KanbanColumn({
  columnId,
  leads,
  onCardClick,
  isDailyGoalAchieved,
  totalNewLeadsCount,
  dailyTrainingFixedToday,
  dailyTrainingTarget,
  callsDoneToday,
  dailyCallsTarget,
}: KanbanColumnProps) {
  const { setNodeRef, isOver, attributes, listeners, transform, transition } = useSortable({
    id: columnId,
    data: { type: "Column", columnId },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  const isNewLeadsColumn = columnId === "NEW_LEADS";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex flex-col glass-panel rounded-3xl min-h-[calc(100vh-14rem)] w-72 min-w-[18rem] flex-shrink-0
        transition-all duration-300
        ${isOver ? "ring-2 ring-navy/40 bg-navy/5 scale-[1.01]" : ""}
      `}
    >
      {/* Column Header */}
      <div 
        className="flex items-center gap-3 px-5 py-4 rounded-t-3xl bg-white/50 border-b border-gray-100 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {/* Accent dot */}
        <div
          className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${
            COLUMN_ACCENTS[columnId] || "from-gray-400 to-gray-500"
          }`}
        />
        <h3 className="text-xs font-bold text-gray-700 tracking-wide uppercase">
          {COLUMN_LABELS[columnId] || columnId}
        </h3>
        <span
          className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
            isNewLeadsColumn && isDailyGoalAchieved
              ? "bg-emerald-100 text-emerald-800 font-black"
              : isNewLeadsColumn
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-150 text-gray-500"
          }`}
        >
          {isNewLeadsColumn && isDailyGoalAchieved
            ? "✅ Atteint"
            : isNewLeadsColumn && totalNewLeadsCount !== undefined
            ? `${leads.length} / ${totalNewLeadsCount}`
            : leads.length}
        </span>
      </div>

      {/* Drop Zone + Card List */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {/* Goal Achieved Top Banner for New Leads Column */}
        {isNewLeadsColumn && isDailyGoalAchieved && (
          <div className="p-4 text-center bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/70 border-2 border-emerald-300 rounded-2xl shadow-xs space-y-2.5 animate-fadeIn mb-3">
            <div className="flex items-center justify-center gap-2 text-2xl animate-bounce">
              <span>🎉</span>
              <span>🏆</span>
            </div>
            <div>
              <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                Félicitations ! Objectif Atteint !
              </h4>
              <p className="text-3xs text-emerald-800 font-medium mt-0.5 leading-snug">
                Vous avez atteint l&apos;objectif du jour de{" "}
                <strong>{dailyTrainingTarget} formations fixées</strong> ! 🚀
              </p>
            </div>
            <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-200 w-full space-y-1 text-3xs font-bold text-emerald-900 shadow-2xs">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">🎯 Formations :</span>
                <span className="text-emerald-700 font-black">
                  {dailyTrainingFixedToday} / {dailyTrainingTarget} ✅
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">📞 Appels :</span>
                <span className="text-navy font-black">{callsDoneToday} appels</span>
              </div>
            </div>
            <div className="text-xs flex items-center justify-center gap-1.5 pt-0.5">
              <span>🥳</span>
              <span>🌟</span>
              <span>✨</span>
              <span>🚗</span>
              <span>💨</span>
            </div>
          </div>
        )}

        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onCardClick(lead)}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400/80">
            <Inbox className="w-10 h-10 mb-3 stroke-[1.5]" />
            <p className="text-[11px] font-medium tracking-wide uppercase">No Cards Here</p>
          </div>
        )}
      </div>
    </div>
  );
}
