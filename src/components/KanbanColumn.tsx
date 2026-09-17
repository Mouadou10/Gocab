"use client";

/**
 * KanbanColumn Component
 *
 * A single column in the Kanban board. Acts as a drop zone for
 * @dnd-kit and renders a list of LeadCards.
 */

import React, { useState } from "react";
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
  presence_confirmed?: boolean;
  presence_confirmed_at?: string | null;
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
  onLeadUpdate?: (lead: Lead) => void;
  isDailyGoalAchieved?: boolean;
  totalNewLeadsCount?: number;
  dailyTrainingFixedToday?: number;
  dailyTrainingTarget?: number;
  callsDoneToday?: number;
  dailyCallsTarget?: number;
  trainingDateFilter?: string;
  onTrainingDateFilterChange?: (date: string) => void;
  availableTrainingDates?: { date: string; label: string; count: number }[];
  totalTrainingFixedCount?: number;
}

export default function KanbanColumn({
  columnId,
  leads = [],
  onCardClick,
  onLeadUpdate,
  isDailyGoalAchieved,
  totalNewLeadsCount,
  dailyTrainingFixedToday,
  dailyTrainingTarget,
  callsDoneToday,
  dailyCallsTarget,
  trainingDateFilter,
  onTrainingDateFilterChange,
  availableTrainingDates,
  totalTrainingFixedCount,
}: KanbanColumnProps) {
  const safeLeads = Array.isArray(leads) ? leads : [];
  const { setNodeRef, isOver, attributes, listeners, transform, transition } = useSortable({
    id: columnId,
    data: { type: "Column", columnId },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  const isNewLeadsColumn = columnId === "NEW_LEADS";
  const [isGoalBannerExpanded, setIsGoalBannerExpanded] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex flex-col glass-panel rounded-3xl min-h-[calc(100vh-14rem)] w-80 min-w-[20rem] flex-shrink-0
        transition-all duration-300
        ${isOver ? "ring-2 ring-navy/40 bg-navy/5 scale-[1.01]" : ""}
      `}
    >
      {/* Column Header */}
      <div 
        className="flex items-center gap-2.5 px-4 py-3.5 rounded-t-3xl bg-white/70 backdrop-blur-sm border-b border-slate-100 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {/* Accent dot */}
        <div
          className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${
            COLUMN_ACCENTS[columnId] || "from-gray-400 to-gray-500"
          }`}
        />
        <h3 className="text-xs font-black text-slate-800 tracking-wide uppercase">
          {COLUMN_LABELS[columnId] || columnId}
        </h3>
        <span
          className={`ml-auto text-3xs font-extrabold px-2 py-0.5 rounded-full font-mono shadow-3xs ${
            isNewLeadsColumn && isDailyGoalAchieved
              ? "bg-emerald-100 text-emerald-800 font-black border border-emerald-200"
              : isNewLeadsColumn
              ? "bg-blue-100 text-blue-800 border border-blue-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          {isNewLeadsColumn && isDailyGoalAchieved
            ? "✅ Atteint"
            : isNewLeadsColumn && totalNewLeadsCount !== undefined
            ? `${safeLeads.length} / ${totalNewLeadsCount}`
            : safeLeads.length}
        </span>
      </div>

      {/* Interactive Date Filter Strip for Training Fixed / Scheduled Column */}
      {(columnId === "Training fixed" || columnId === "Scheduled") && onTrainingDateFilterChange && (
        <div
          className="px-3 py-2 bg-emerald-50/70 border-b border-emerald-100/80 flex flex-col gap-1.5 cursor-default"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Quick Filter Buttons & Clear */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onTrainingDateFilterChange("TODAY")}
                className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer shrink-0 ${
                  trainingDateFilter === "TODAY"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                }`}
                title="Aujourd'hui"
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => onTrainingDateFilterChange("ALL")}
                className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer shrink-0 ${
                  trainingDateFilter === "ALL"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                }`}
                title="Toutes les dates"
              >
                Toutes ({totalTrainingFixedCount || safeLeads.length})
              </button>
            </div>
            {trainingDateFilter && trainingDateFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => onTrainingDateFilterChange("ALL")}
                className="text-3xs text-slate-400 hover:text-rose-600 font-bold px-1 py-0.5 rounded cursor-pointer"
                title="Effacer filtre date"
              >
                ✕ Effacer
              </button>
            )}
          </div>

          {/* Date Picker Input (Full width, never cuts off) */}
          <div className="relative w-full">
            <input
              type="date"
              value={
                trainingDateFilter &&
                trainingDateFilter !== "ALL" &&
                trainingDateFilter !== "TODAY" &&
                trainingDateFilter !== "TOMORROW"
                  ? trainingDateFilter
                  : ""
              }
              onChange={(e) => onTrainingDateFilterChange(e.target.value || "ALL")}
              className="w-full bg-white border border-emerald-200 rounded-lg px-2.5 py-1 text-2xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 shadow-3xs cursor-pointer"
              title="Choisir une date spécifique"
            />
          </div>

          {/* Quick Date Pills */}
          {availableTrainingDates && availableTrainingDates.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none pt-0.5">
              {availableTrainingDates.slice(0, 7).map((qd) => (
                <button
                  key={qd.date}
                  type="button"
                  onClick={() => onTrainingDateFilterChange(qd.date)}
                  className={`px-2 py-0.5 rounded-md text-3xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    trainingDateFilter === qd.date
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "bg-emerald-100/90 text-emerald-900 hover:bg-emerald-200 border border-emerald-200/60"
                  }`}
                >
                  {qd.label} ({qd.count})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drop Zone + Card List */}
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
        {/* Goal Achieved Compact Victory Ribbon */}
        {isNewLeadsColumn && isDailyGoalAchieved && (
          <div className="p-2.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border border-emerald-300 rounded-2xl shadow-2xs mb-2 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none shrink-0">🏆</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase text-emerald-950 tracking-tight whitespace-nowrap">
                    Objectif Atteint !
                  </p>
                  <p className="text-[10px] font-bold text-emerald-700 font-mono leading-none mt-0.5 whitespace-nowrap">
                    {dailyTrainingFixedToday} / {dailyTrainingTarget} fixées ✅
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGoalBannerExpanded(!isGoalBannerExpanded)}
                className="px-2 py-1 rounded-lg text-3xs font-bold text-emerald-800 bg-white/90 hover:bg-white border border-emerald-200 shadow-3xs transition-all cursor-pointer shrink-0"
              >
                {isGoalBannerExpanded ? "Réduire" : "Détails"}
              </button>
            </div>

            {isGoalBannerExpanded && (
              <div className="mt-2.5 pt-2 border-t border-emerald-200/70 space-y-1.5 animate-fadeIn">
                <p className="text-3xs text-emerald-800 font-medium leading-snug">
                  Bravo à l&apos;équipe pour avoir dépassé la cible du jour ! 🚀
                </p>
                <div className="bg-white/95 p-2 rounded-xl border border-emerald-200 space-y-1 text-3xs font-bold text-emerald-900 shadow-3xs">
                  <div className="flex justify-between items-center">
                    <span>🎯 Formations fixées :</span>
                    <span className="text-emerald-700 font-mono font-black">{dailyTrainingFixedToday} / {dailyTrainingTarget}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>📞 Appels passés :</span>
                    <span className="text-slate-800 font-mono font-black">{callsDoneToday} appels</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <SortableContext
          items={safeLeads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {safeLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onCardClick(lead)}
              onLeadUpdate={onLeadUpdate}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {safeLeads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400/80">
            <Inbox className="w-10 h-10 mb-3 stroke-[1.5]" />
            <p className="text-[11px] font-medium tracking-wide uppercase">No Cards Here</p>
          </div>
        )}
      </div>
    </div>
  );
}
