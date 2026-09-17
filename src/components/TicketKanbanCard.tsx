"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Clock,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  Trash2,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  User,
  Flame,
} from "lucide-react";
import toast from "react-hot-toast";
import { MaintenanceTicket } from "./TicketDrawer";

interface TicketKanbanCardProps {
  ticket: MaintenanceTicket;
  downtimeStr: string;
  onWaiveClick: (ticket: MaintenanceTicket) => void;
  onDeleteClick: (id: string) => void;
  onCancelMissionClick?: (ticket: MaintenanceTicket) => void;
  onCancelWaiverClick: (id: string) => void;
  onResolveClick?: (ticket: MaintenanceTicket) => void;
  onStatusChange?: (ticket: MaintenanceTicket, newStatus: string, accidentStep?: string) => void;
  onStartClick?: (ticket: MaintenanceTicket) => void;
  onStopClick?: (ticket: MaintenanceTicket) => void;
  onBonDeCommandeClick?: (ticket: MaintenanceTicket) => void;
  isResolved: boolean;
}

// Arabic letter mapping for Moroccan plates (e.g. Y -> ي, A -> أ, etc.)
const ARABIC_LETTER_MAP: Record<string, string> = {
  a: "أ",
  b: "ب",
  d: "د",
  h: "هـ",
  w: "و",
  y: "ي",
  j: "ج",
  m: "م",
  s: "س",
  t: "ت",
};

/**
 * Moroccan License Plate badge [ 26555 | ي | 6 ] or [ WW | 964987 ]
 */
function MoroccanPlateBadge({ plate }: { plate: string | null | undefined }) {
  if (!plate) return <span className="text-gray-400 italic text-xs font-mono">Sans matricule</span>;
  const clean = plate.trim();

  // Provisional WW plate
  if (/^ww/i.test(clean)) {
    const num = clean.replace(/^ww[-–\s]*/i, "");
    return (
      <div className="inline-flex items-center gap-1.5 bg-red-600 text-white font-mono font-black text-xs px-2.5 py-0.5 rounded-md tracking-wider shadow-2xs border border-red-700">
        <span className="text-[10px] font-extrabold tracking-normal">WW</span>
        <span className="text-white/60">|</span>
        <span>{num}</span>
      </div>
    );
  }

  // Moroccan standard plate (numbers - letter - region)
  const parts = clean.split(/[-–|/\s]+/).filter(Boolean);
  if (parts.length === 3) {
    const rawLetter = parts[1].toLowerCase();
    const arabicChar = ARABIC_LETTER_MAP[rawLetter] || parts[1];

    return (
      <div className="inline-flex items-center bg-gray-950 text-white font-mono font-bold text-xs px-2.5 py-0.5 rounded-md tracking-wide shadow-2xs border border-gray-800">
        <span className="tracking-wider">{parts[0]}</span>
        <span className="mx-1.5 text-gray-500 font-normal">|</span>
        <span className="text-amber-400 font-black" title={parts[1]}>
          {arabicChar}
        </span>
        <span className="mx-1.5 text-gray-500 font-normal">|</span>
        <span className="text-gray-200">{parts[2]}</span>
      </div>
    );
  }

  // Fallback
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-950 text-white font-mono font-bold text-xs px-2.5 py-0.5 rounded-md tracking-wider shadow-2xs border border-gray-800">
      <span>🚗</span>
      <span>{clean}</span>
    </div>
  );
}

export default function TicketKanbanCard({
  ticket,
  downtimeStr,
  onWaiveClick,
  onDeleteClick,
  onCancelMissionClick,
  onCancelWaiverClick,
  onResolveClick,
  onStatusChange,
  onStartClick,
  onStopClick,
  onBonDeCommandeClick,
  isResolved,
}: TicketKanbanCardProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);

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

  const isRecovery = ticket.ticket_type === "VEHICLE_RECOVERY" || ticket.ticket_type === "Vehicle Recovery";

  // Clean phone number for WhatsApp and dialer
  const cleanPhone = ticket.driver_phone?.replace(/[^\d+]/g, "") || "";
  const whatsappNumber = cleanPhone.startsWith("+")
    ? cleanPhone.replace("+", "")
    : cleanPhone.startsWith("0")
    ? "212" + cleanPhone.slice(1)
    : cleanPhone;

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    toast.success("Numéro copié !");
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  // Priority styles
  const isCritical = ticket.priority?.toLowerCase() === "critical";
  const isUrgent = ticket.priority?.toLowerCase() === "urgent";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-white rounded-2xl shadow-xs border flex flex-col gap-3 relative group transition-all duration-200 p-4
        ${
          isDragging
            ? "opacity-50 border-blue-600 ring-4 ring-blue-500/20 scale-[1.02] shadow-xl z-50"
            : "border-gray-200/90 hover:border-gray-300 hover:shadow-md"
        }
      `}
    >
      {/* 1. Header: Drag Handle, Moroccan Plate, Priority Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-600 p-1 -ml-1 rounded-md hover:bg-gray-100 transition-colors shrink-0"
            title="Glisser pour déplacer le ticket"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <MoroccanPlateBadge plate={ticket.plate_number} />
        </div>

        {/* Priority Badge */}
        <div className="shrink-0">
          {isCritical ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 tracking-wider shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
              CRITIQUE
            </span>
          ) : isUrgent ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 tracking-wider">
              <Flame className="w-3 h-3 text-amber-600" />
              URGENT
            </span>
          ) : (
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 tracking-wider">
              {ticket.priority || "NORMAL"}
            </span>
          )}
        </div>
      </div>

      {/* 2. Ticket Category & Sub-Badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {isRecovery ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <span className="text-sm">🚨</span>
            <span>Récupération Véhicule</span>
          </span>
        ) : ticket.ticket_type === "Accident" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200">
            <span className="text-sm">💥</span>
            <span>Dossier Accident</span>
          </span>
        ) : ticket.ticket_type === "Vidange" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
            <span className="text-sm">🛢️</span>
            <span>Vidange Moteur</span>
          </span>
        ) : ticket.ticket_type === "AdBleu" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="text-sm">💧</span>
            <span>AdBlue</span>
          </span>
        ) : ticket.ticket_type === "Repair" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <span className="text-sm">🔧</span>
            <span>Réparation Garage</span>
          </span>
        ) : ticket.ticket_type === "Fourrière" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-100 text-stone-800 border border-stone-200">
            <span className="text-sm">🚔</span>
            <span>Fourrière Municipale</span>
          </span>
        ) : ticket.ticket_type === "Police Immobilization" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-800 border border-red-200">
            <span className="text-sm">🛑</span>
            <span>Immobilisation Police</span>
          </span>
        ) : ticket.ticket_type === "Custom" ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <span className="text-sm">📋</span>
            <span>Bon de Commande</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {ticket.ticket_type}
          </span>
        )}

        {/* Field Status Tag (if any) */}
        {ticket.field_status && ticket.field_status !== "COMPLETED" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3 text-amber-700" />
            {ticket.field_status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* 3. Vehicle Recovery Banner (Status-Aware UX) */}
      {isRecovery && (
        <>
          {/* A. If Resolved: Show Clean Completion Banner without Cancel Mission */}
          {isResolved ? (
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-emerald-900">Véhicule Récupéré & Restitué</span>
                  <p className="text-[10px] text-emerald-700">Handover validé par le superviseur terrain</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono">
                DISPONIBLE
              </span>
            </div>
          ) : (
            /* B. If Open or In Progress: Show Active Mission with Action Controls */
            <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl p-3 flex flex-col gap-2.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                  </span>
                  <span className="text-xs font-bold text-red-900 truncate">
                    {ticket.status === "IN_PROGRESS"
                      ? "⏳ Mission Terrain En Cours"
                      : "🚨 Mission Terrain Déclarée"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onCancelMissionClick) {
                      onCancelMissionClick(ticket);
                    } else {
                      onDeleteClick(ticket.id);
                    }
                  }}
                  className="text-[11px] font-bold text-red-700 hover:text-red-900 bg-white hover:bg-red-100 border border-red-200 rounded-lg px-2.5 py-1 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                  title="Annuler la mission de récupération, notifier les agents terrain et débloquer le véhicule"
                >
                  <span>🚫</span>
                  <span>Annuler Mission</span>
                </button>
              </div>

              {ticket.status === "OPEN" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onStatusChange?.(ticket, "IN_PROGRESS");
                  }}
                  className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Démarrer la mission terrain et passer le ticket En cours"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Démarrer la mission (Passer En cours)</span>
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* 4. Description / Mission Instructions */}
      {ticket.description && (
        <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-2.5 text-xs text-slate-700 leading-relaxed flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
          <span className="line-clamp-3 font-normal">{ticket.description}</span>
        </div>
      )}

      {/* 5. Driver Interactive Contact Capsule */}
      {(ticket.driver_name || ticket.driver_phone) && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
              {ticket.driver_name ? ticket.driver_name.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
            </div>
            <div className="truncate">
              <span className="font-bold text-slate-800 text-xs truncate block">
                {ticket.driver_name || "Chauffeur"}
              </span>
              {ticket.driver_phone && (
                <span className="font-mono text-[10px] text-slate-500 block truncate">
                  {ticket.driver_phone}
                </span>
              )}
            </div>
          </div>

          {/* Direct Communication Buttons */}
          {ticket.driver_phone && (
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`tel:${cleanPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors"
                title={`Appeler ${ticket.driver_name || ticket.driver_phone}`}
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-slate-600 hover:text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 transition-colors"
                title="Discuter sur WhatsApp"
              >
                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
              </a>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(ticket.driver_phone!);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
                title="Copier le numéro"
              >
                {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 6. Attached Bon de Commande or Quick Add */}
      {(() => {
        let attachedBc: any = null;
        if (ticket.resolution_notes) {
          try {
            const parsed = JSON.parse(ticket.resolution_notes);
            if (parsed && parsed.bon_de_commande) {
              attachedBc = parsed.bon_de_commande;
            }
          } catch {
            // not JSON
          }
        }

        if (attachedBc) {
          return (
            <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="leading-tight truncate">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Bon de Commande</span>
                    {attachedBc.bc_number ? (
                      <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded text-[10px] font-bold">
                        N° {attachedBc.bc_number}
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[10px] font-bold">
                        Validé
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-600 font-semibold font-mono mt-0.5">
                    {attachedBc.total_ttc ? Number(attachedBc.total_ttc).toLocaleString() : 0} MAD TTC
                    {attachedBc.items && ` · ${attachedBc.items.length} art.`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onBonDeCommandeClick?.(ticket)}
                className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                title="Ouvrir et imprimer le Bon de Commande"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer</span>
              </button>
            </div>
          );
        }

        if (
          ticket.ticket_type === "Vidange" ||
          ticket.ticket_type === "AdBleu" ||
          ticket.ticket_type === "Custom" ||
          ticket.ticket_type === "Repair"
        ) {
          return (
            <button
              type="button"
              onClick={() => onBonDeCommandeClick?.(ticket)}
              className="w-full py-2 px-3 bg-blue-50/60 hover:bg-blue-100/70 text-blue-700 border border-blue-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>+ Créer Bon de Commande</span>
            </button>
          );
        }

        return null;
      })()}

      {/* 7. Downtime Counter / Start & Stop Stopwatch */}
      {(() => {
        const isServiceTicket = ticket.ticket_type === "Vidange" || ticket.ticket_type === "AdBleu";
        const hasStarted = Boolean(ticket.started_at);

        // State A: Resolved Ticket
        if (isResolved) {
          return (
            <div className="p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 text-center w-full shadow-2xs">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Durée Totale d&apos;Intervention</span>
              </div>
              <div className="text-lg font-black font-mono tracking-tight text-emerald-950 tabular-nums">
                {downtimeStr}
              </div>
              <div className="text-[10px] text-emerald-700/80 mt-0.5">
                {ticket.started_at && ticket.resolved_at ? (
                  <span>
                    {new Date(ticket.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} →{" "}
                    {new Date(ticket.resolved_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : (
                  <span>Résolu le {new Date(ticket.resolved_at || ticket.created_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          );
        }

        // State B: Running Timer
        if (hasStarted) {
          return (
            <div className="p-3.5 rounded-xl border-2 border-amber-300 bg-amber-50/90 text-center w-full flex flex-col items-center gap-1.5 shadow-xs">
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-700" />
                  <span>Chrono Intervention</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  EN COURS
                </span>
              </div>

              <div className="py-1 text-center w-full">
                <div className="text-2xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                  {downtimeStr}
                </div>
                <div className="text-[10px] text-amber-800 font-medium mt-0.5">
                  Démarré à {new Date(ticket.started_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              </div>

              {onStopClick && (
                <button
                  type="button"
                  onClick={() => onStopClick(ticket)}
                  className="w-full mt-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Terminer & Résoudre</span>
                </button>
              )}
            </div>
          );
        }

        // State C: Vidange / AdBleu Waiting to Start
        if (isServiceTicket) {
          return (
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-center w-full flex flex-col items-center gap-2 shadow-2xs">
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Service {ticket.ticket_type}</span>
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  ⏸ En attente
                </span>
              </div>

              <div className="text-center">
                <div className="text-xs text-slate-600 font-medium">
                  Le chauffeur n&apos;a pas encore commencé
                </div>
                <div className="text-[10px] text-slate-400">
                  Créé à {new Date(ticket.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {onStartClick && (
                <button
                  type="button"
                  onClick={() => onStartClick(ticket)}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Démarrer l&apos;opération ({ticket.ticket_type})</span>
                </button>
              )}
            </div>
          );
        }

        // State D: Regular Downtime Box
        return (
          <div className="p-2.5 rounded-xl border border-amber-200/90 bg-amber-50/80 text-center w-full shadow-2xs">
            <div className="text-[10px] font-bold text-amber-900/80 uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-amber-700" />
              <span>Downtime Écoulé</span>
            </div>
            <div className="text-lg font-black font-mono tracking-tight text-slate-900 tabular-nums">
              {downtimeStr}
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5 truncate">
              Déclaré le {new Date(ticket.created_at).toLocaleString()}
            </div>
          </div>
        );
      })()}

      {/* 8. Fleet Performance Payment Waiver Chip */}
      {ticket.payment_waived ? (
        <div className="flex flex-col gap-1 bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] p-2.5 rounded-xl">
          <div className="font-bold flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>💸</span>
              <span>{ticket.waived_days} Jour(s) Exonéré(s)</span>
            </span>
            <button
              type="button"
              onClick={() => onCancelWaiverClick(ticket.id)}
              className="text-red-600 hover:text-red-800 text-[10px] font-semibold hover:underline"
            >
              Retirer
            </button>
          </div>
          {ticket.waiver_reason && (
            <span className="italic opacity-80 leading-tight text-[10px]">
              &quot;{ticket.waiver_reason}&quot;
            </span>
          )}
        </div>
      ) : null}

      {/* 9. Resolution Details Box (if resolved) */}
      {isResolved &&
        (ticket.garage_name ||
          (ticket.repair_cost !== undefined && ticket.repair_cost !== null) ||
          ticket.resolution_notes) && (
          <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs p-2.5 rounded-xl space-y-1">
            <div className="font-bold text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>🔧</span>
                <span>Infos Clôture</span>
              </span>
              {ticket.repair_cost !== undefined && ticket.repair_cost !== null && (
                <span className="font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[11px]">
                  {ticket.repair_cost.toLocaleString()} MAD
                </span>
              )}
            </div>
            {ticket.garage_name && (
              <div className="text-[11px] text-emerald-800">
                📍 <strong>Garage :</strong> {ticket.garage_name}
              </div>
            )}
            {ticket.resolution_notes && (
              <p className="text-[10px] text-emerald-700 italic line-clamp-2">
                &quot;{ticket.resolution_notes}&quot;
              </p>
            )}
          </div>
        )}

      {/* 10. Accident Pipeline Stage Stepper OR Regular Status Buttons */}
      {ticket.ticket_type === "Accident" ? (
        <div className="bg-red-50/90 border border-red-200 rounded-xl p-3 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-red-900 uppercase tracking-wider flex items-center gap-1">
              <span>🚨</span>
              <span>Dossier Accident</span>
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                ticket.status === "RESOLVED"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : ticket.status === "IN_PROGRESS"
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}
            >
              {ticket.status === "RESOLVED"
                ? "✅ Résolu"
                : ticket.status === "IN_PROGRESS"
                ? "⏳ En cours"
                : "🔵 Ouvert"}
            </span>
          </div>

          <select
            value={
              ticket.status === "RESOLVED"
                ? "VEHICLE_BACK"
                : ticket.accident_step === "VEHICLE_BACK"
                ? "VEHICLE_BACK"
                : ticket.accident_step ||
                  (ticket.status === "IN_PROGRESS" ? "CAR_IN_GARAGE" : "NEW_ACCIDENT")
            }
            onChange={(e) => {
              const selectedStep = e.target.value;
              let targetColumnStatus = "IN_PROGRESS";
              if (selectedStep === "VEHICLE_BACK") {
                targetColumnStatus = "RESOLVED";
              } else if (selectedStep === "NEW_ACCIDENT") {
                targetColumnStatus = "OPEN";
              } else {
                targetColumnStatus = "IN_PROGRESS";
              }
              onStatusChange?.(ticket, targetColumnStatus, selectedStep);
            }}
            className="w-full bg-white border border-red-300 rounded-lg py-1.5 px-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer shadow-2xs"
          >
            <option value="NEW_ACCIDENT">1. 🔴 Nouvel Accident (Initial / Ouvert)</option>
            <option value="CAR_IN_GARAGE">2. 🚙 Au Garage (En cours)</option>
            <option value="STARTING_REPAIR">3. 🔧 Début Réparation (En cours)</option>
            <option value="INSURANCE_DOCS">4. 📑 Dossier Assurance (En cours)</option>
            <option value="READY_FOR_PICKUP">5. ⏳ Prêt pour Récupération (En cours)</option>
            <option value="VEHICLE_BACK">6. ✅ Véhicule Rétabli (Résolu)</option>
          </select>

          <div className="flex items-center justify-between pt-0.5">
            <p className="text-[10px] text-slate-500 italic">
              {ticket.status === "RESOLVED"
                ? "Dossier clos & véhicule rétabli."
                : "Changer d'étape synchronise la colonne."}
            </p>
            {ticket.status !== "RESOLVED" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onStatusChange?.(ticket, "RESOLVED", "VEHICLE_BACK");
                }}
                className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-md px-2.5 py-1 transition-colors cursor-pointer whitespace-nowrap shadow-2xs flex items-center gap-1"
                title="Clôturer le dossier accident et déplacer dans Résolu"
              >
                <Check className="w-3 h-3 text-emerald-700" />
                <span>Marquer Résolu</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Regular Ticket Quick Status Buttons */
        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/80 gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
            Statut :
          </span>
          <div className="flex items-center gap-1.5">
            {ticket.status !== "OPEN" && (
              <button
                type="button"
                onClick={() => onStatusChange?.(ticket, "OPEN")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-200 transition-colors shadow-2xs cursor-pointer"
                title="Passer en Ouvert"
              >
                🔵 Ouvert
              </button>
            )}
            {ticket.status !== "IN_PROGRESS" && (
              <button
                type="button"
                onClick={() => onStatusChange?.(ticket, "IN_PROGRESS")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-amber-50 text-amber-700 border border-slate-200 hover:border-amber-200 transition-colors shadow-2xs cursor-pointer"
                title="Passer en cours de traitement"
              >
                ⏳ En cours
              </button>
            )}
            {ticket.status !== "RESOLVED" && (
              <button
                type="button"
                onClick={() =>
                  onResolveClick ? onResolveClick(ticket) : onStatusChange?.(ticket, "RESOLVED")
                }
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                title="Marquer comme résolu"
              >
                ✅ Résolu
              </button>
            )}
          </div>
        </div>
      )}

      {/* 11. Action Buttons Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onWaiveClick(ticket)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
          >
            💸 Exonérer
          </button>
          {onResolveClick && (
            <button
              type="button"
              onClick={() => onResolveClick(ticket)}
              className="text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              {isResolved ? "📝 Détails" : "✅ Résoudre"}
            </button>
          )}
        </div>

        {isRecovery && !isResolved ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onCancelMissionClick) {
                onCancelMissionClick(ticket);
              } else {
                onDeleteClick(ticket.id);
              }
            }}
            className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors cursor-pointer bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg px-2.5 py-1"
            title="Annuler la mission de récupération et débloquer le véhicule"
          >
            <span>🚫</span>
            <span>Annuler Mission</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteClick(ticket.id);
            }}
            className="text-xs text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
            title="Supprimer le ticket"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

