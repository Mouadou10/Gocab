"use client";

/**
 * LeadCard Component
 *
 * Displays a single lead on the Kanban board. Supports:
 * - Drag handle via @dnd-kit useSortable
 * - Click-to-open the appropriate modal (based on column)
 * - WhatsApp action buttons for "Training fixed" and "Accept offer" states
 * - Olive green border highlight for accepted offers
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateTrainingInviteURL, generateThankYouURL } from "@/lib/whatsapp";

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

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isAccepted = lead.training_status === "Accept offer";
  const isTrainingFixed = lead.brand_status === "Training fixed";

  const kycCount = [
    lead.has_cin,
    lead.has_fiche_anthropometrique,
    lead.has_confirmation_adresse,
    lead.has_permis,
  ].filter(Boolean).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group bg-white rounded-2xl shadow-sm border transition-all duration-300
        hover:shadow-lg hover:scale-[1.02] cursor-pointer relative overflow-hidden
        ${isAccepted ? "border-olive/50 ring-1 ring-olive/20" : "border-gray-200/60 hover:border-navy/40"}
        ${isDragging ? "opacity-50 shadow-2xl scale-105 rotate-2 z-50 ring-2 ring-navy" : ""}
      `}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center py-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      {/* Card Content — clickable to open modal */}
      <div onClick={onClick} className="px-4 pb-3 space-y-2">
        {/* Name + Phone */}
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight">
            {lead.raw_name}
          </p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {lead.sanitized_phone}
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-1.5">
          {lead.city && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              📍 {lead.city}
            </span>
          )}
          {lead.brand_status && (
            <span
              className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isTrainingFixed
                  ? "bg-olive/10 text-olive"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {lead.brand_status}
            </span>
          )}
          {lead.training_status && (
            <span
              className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isAccepted
                  ? "bg-olive/10 text-olive"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              {lead.training_status}
            </span>
          )}
        </div>

        {/* KYC indicator for training phase or if any doc checked */}
        {(lead.board_column === "TRAINING_PIPELINE" ||
          lead.board_column === "VEHICLE_ASSIGNMENT" ||
          kycCount > 0) && (
          <p className={`text-[10px] flex items-center gap-1 font-semibold ${
            kycCount === 4 ? "text-olive" : "text-gray-500"
          }`}>
            <span>📁</span> KYC Check: {kycCount}/4
          </p>
        )}

        {/* Reminder indicator */}
        {lead.reminder_date && (
          <p className="text-[10px] text-amber-600 flex items-center gap-1">
            <span>⏰</span>
            Reminder: {new Date(lead.reminder_date).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* WhatsApp Action Buttons */}
      {(isTrainingFixed || isAccepted) && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-50">
          {isTrainingFixed && !isAccepted && (
            <a
              href={generateTrainingInviteURL(
                lead.sanitized_phone,
                lead.raw_name,
                lead.reminder_date ? new Date(lead.reminder_date) : new Date()
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Send Invite
            </a>
          )}
          {isAccepted && (
            <a
              href={generateThankYouURL(lead.sanitized_phone)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 bg-olive hover:bg-olive/90 text-white text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Send Thank You
            </a>
          )}
        </div>
      )}
    </div>
  );
}
