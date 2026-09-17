"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
          isRecovery
            ? "bg-red-50 text-red-700 border border-red-200"
            : "bg-navy/10 text-navy"
        }`}>
          {ticket.ticket_type === "Vidange" && "🛢️ Vidange"}
          {ticket.ticket_type === "AdBleu" && "💧 AdBleu"}
          {ticket.ticket_type === "Repair" && "🔧 Repair"}
          {ticket.ticket_type === "Accident" && "💥 Accident"}
          {ticket.ticket_type === "Fourrière" && "🚔 Fourrière"}
          {ticket.ticket_type === "Police Immobilization" && "🛑 Immobilisation Police"}
          {isRecovery && "🚨 Vehicle Recovery"}
          {ticket.ticket_type === "Custom" && "📋 Custom (BC)"}
          {!["Vidange", "AdBleu", "Repair", "Accident", "Fourrière", "Police Immobilization", "VEHICLE_RECOVERY", "Vehicle Recovery", "Custom"].includes(ticket.ticket_type) && ticket.ticket_type}
        </span>
        
        {isResolved && ticket.field_status && ticket.field_status !== "COMPLETED" && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider flex items-center gap-1">
            <span>🛡️</span> {ticket.field_status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Vehicle Recovery Active Mission Alert Banner */}
      {isRecovery && (
        <div className="bg-red-50/90 border border-red-200 rounded-xl p-3 flex flex-col gap-2 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
              <span className="text-[11px] font-bold text-red-800 truncate">
                {ticket.status === "IN_PROGRESS" ? "⏳ Mission Terrain En Cours" : "🚨 Mission Terrain Déclarée"}
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
              className="text-[11px] font-bold text-red-700 hover:text-red-900 bg-white hover:bg-red-100 border border-red-200 rounded-md px-2 py-0.5 transition-all shadow-2xs cursor-pointer"
              title="Annuler la mission de récupération, notifier les agents terrain et débloquer le véhicule"
            >
              🚫 Cancel Mission
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
              className="w-full py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              title="Démarrer la mission terrain et passer le ticket En cours"
            >
              ▶ Démarrer la mission (Passer En cours)
            </button>
          )}
        </div>
      )}


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

      {/* Bon de Commande Section */}
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
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200/90 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-base">📄</span>
                <div className="leading-tight truncate">
                  <div className="text-xs font-bold text-navy flex items-center gap-1.5">
                    <span>Bon de Commande</span>
                    {attachedBc.bc_number ? (
                      <span className="font-mono bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded text-[10px]">
                        N° {attachedBc.bc_number}
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[10px] font-bold">
                        Validé
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-600 font-semibold font-mono">
                    {attachedBc.total_ttc ? Number(attachedBc.total_ttc).toLocaleString() : 0} MAD TTC
                    {attachedBc.items && ` · ${attachedBc.items.length} art.`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onBonDeCommandeClick?.(ticket)}
                className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 hover:border-blue-400 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                title="Ouvrir et imprimer le Bon de Commande"
              >
                <span>🖨️</span>
                <span>Imprimer</span>
              </button>
            </div>
          );
        }

        if (ticket.ticket_type === "Vidange" || ticket.ticket_type === "AdBleu" || ticket.ticket_type === "Custom" || ticket.ticket_type === "Repair") {
          return (
            <button
              type="button"
              onClick={() => onBonDeCommandeClick?.(ticket)}
              className="w-full py-1.5 px-2.5 bg-blue-50/70 hover:bg-blue-100/80 text-blue-800 border border-blue-200/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <span>📝</span>
              <span>+ Bon de Commande</span>
            </button>
          );
        }

        return null;
      })()}

      {/* Downtime Counter / Start & Stop Timer Box */}
      {(() => {
        const isServiceTicket = ticket.ticket_type === "Vidange" || ticket.ticket_type === "AdBleu";
        const hasStarted = Boolean(ticket.started_at);

        // State 1: Resolved Ticket
        if (isResolved) {
          return (
            <div className="p-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 text-center w-full shadow-2xs">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                <span>✅</span> Durée totale d&apos;intervention
              </div>
              <div className="text-base font-black font-mono tracking-tight text-emerald-950">
                {downtimeStr}
              </div>
              <div className="text-[9px] text-emerald-700/80 mt-0.5">
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

        // State 2: Timer is Running / In Progress
        if (hasStarted) {
          return (
            <div className="p-3 rounded-xl border-2 border-amber-300 bg-amber-50/90 text-center w-full flex flex-col items-center gap-1.5 shadow-sm">
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                  <span>⏱️</span> Chrono Intervention
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  EN COURS
                </span>
              </div>

              <div className="py-1 text-center w-full">
                <div className="text-xl font-black font-mono tracking-tight text-navy">
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
                  className="w-full mt-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/25 transition-all cursor-pointer"
                >
                  <span className="text-sm">⏹️</span>
                  <span>Stop (Terminer & Résoudre)</span>
                </button>
              )}
              <span className="text-[9px] text-gray-500 italic">
                Arrête le compteur et passe le ticket en &quot;Résolu&quot;
              </span>
            </div>
          );
        }

        // State 3: Vidange / AdBleu Waiting to Start
        if (isServiceTicket) {
          return (
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-center w-full flex flex-col items-center gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                  <span>⏱️</span> Service {ticket.ticket_type}
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  ⏸️ En attente
                </span>
              </div>

              <div className="py-0.5 text-center">
                <div className="text-xs text-gray-600 font-medium">
                  Le chauffeur n&apos;a pas encore commencé
                </div>
                <div className="text-[10px] text-gray-400">
                  Créé à {new Date(ticket.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {onStartClick && (
                <button
                  type="button"
                  onClick={() => onStartClick(ticket)}
                  className="w-full mt-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <span className="text-sm">▶️</span>
                  <span>Start (Démarrer {ticket.ticket_type})</span>
                </button>
              )}
              <span className="text-[9px] text-gray-500 italic">
                Cliquer dès que le chauffeur commence l&apos;opération
              </span>
            </div>
          );
        }

        // State 4: Other ticket types (Default Downtime Box)
        return (
          <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/80 text-center w-full">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
              ⏱️ Elapsed Downtime
            </div>
            <div className="text-base font-black font-mono tracking-tight text-navy">
              {downtimeStr}
            </div>
            <div className="text-[9px] text-gray-400 mt-1 truncate">
              {new Date(ticket.created_at).toLocaleString()}
            </div>
          </div>
        );
      })()}

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

      {/* Resolution Details (if available) */}
      {isResolved && (ticket.garage_name || (ticket.repair_cost !== undefined && ticket.repair_cost !== null) || ticket.resolution_notes) && (
        <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-[10px] p-2.5 rounded-xl space-y-1">
          <div className="font-bold text-emerald-800 flex items-center justify-between">
            <span>🔧 Resolution Info</span>
            {ticket.repair_cost !== undefined && ticket.repair_cost !== null && (
              <span className="font-mono font-bold bg-emerald-100 text-emerald-850 px-1.5 py-0.5 rounded">
                {ticket.repair_cost.toLocaleString()} MAD
              </span>
            )}
          </div>
          {ticket.garage_name && (
            <div className="text-[10px] text-emerald-700">
              📍 <strong>Garage:</strong> {ticket.garage_name}
            </div>
          )}
          {ticket.resolution_notes && (
            <p className="text-[10px] text-emerald-700 italic line-clamp-2">
              "{ticket.resolution_notes}"
            </p>
          )}
        </div>
      )}

      {/* Accident Pipeline Status Selector OR Regular Status Controls */}
      {ticket.ticket_type === "Accident" ? (
        <div className="bg-red-50/80 border border-red-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-2xs">
            <span className="font-bold text-red-800 uppercase tracking-wider flex items-center gap-1">
              <span>🚨</span> Statut Dossier Accident
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              ticket.status === "RESOLVED"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : ticket.status === "IN_PROGRESS"
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : "bg-blue-100 text-blue-800 border border-blue-200"
            }`}>
              {ticket.status === "RESOLVED" ? "✅ Résolu" : ticket.status === "IN_PROGRESS" ? "⏳ En cours" : "🔵 Ouvert"}
            </span>
          </div>

          <select
            value={
              ticket.status === "RESOLVED"
                ? "VEHICLE_BACK"
                : (ticket.accident_step === "VEHICLE_BACK"
                    ? "VEHICLE_BACK"
                    : ticket.accident_step ||
                      (ticket.status === "IN_PROGRESS"
                        ? "CAR_IN_GARAGE"
                        : "NEW_ACCIDENT"))
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
            className="w-full bg-white border border-red-300 rounded-lg py-1.5 px-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer shadow-2xs"
          >
            <option value="NEW_ACCIDENT">1. 🔴 Nouvel Accident (Initial / Ouvert)</option>
            <option value="CAR_IN_GARAGE">2. 🚙 Au Garage (En cours)</option>
            <option value="STARTING_REPAIR">3. 🔧 Début Réparation (En cours)</option>
            <option value="INSURANCE_DOCS">4. 📑 Dossier Assurance (En cours)</option>
            <option value="READY_FOR_PICKUP">5. ⏳ Prêt pour Récupération (En cours)</option>
            <option value="VEHICLE_BACK">6. ✅ Véhicule Rétabli (Résolu)</option>
          </select>
          <div className="flex items-center justify-between pt-0.5">
            <p className="text-[10px] text-gray-500 italic">
              {ticket.status === "RESOLVED"
                ? "Dossier clos & véhicule rétabli."
                : "Sélectionner Résolu déplace le ticket directement."}
            </p>
            {ticket.status !== "RESOLVED" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onStatusChange?.(ticket, "RESOLVED", "VEHICLE_BACK");
                }}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded px-2 py-0.5 transition-colors cursor-pointer whitespace-nowrap"
                title="Clôturer le dossier accident et déplacer dans Résolu"
              >
                ✅ Marquer Résolu
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Regular Ticket Quick Status Buttons */
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-200/80 gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 pl-1">
            Statut :
          </span>
          <div className="flex items-center gap-1.5">
            {ticket.status !== "OPEN" && (
              <button
                type="button"
                onClick={() => onStatusChange?.(ticket, "OPEN")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-blue-50 text-blue-700 border border-gray-200 hover:border-blue-200 transition-colors shadow-2xs cursor-pointer"
                title="Passer en Ouvert"
              >
                🔵 Ouvert
              </button>
            )}
            {ticket.status !== "IN_PROGRESS" && (
              <button
                type="button"
                onClick={() => onStatusChange?.(ticket, "IN_PROGRESS")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-amber-50 text-amber-700 border border-gray-200 hover:border-amber-200 transition-colors shadow-2xs cursor-pointer"
                title="Passer en cours de traitement"
              >
                ⏳ En cours
              </button>
            )}
            {ticket.status !== "RESOLVED" && (
              <button
                type="button"
                onClick={() => onResolveClick ? onResolveClick(ticket) : onStatusChange?.(ticket, "RESOLVED")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-emerald-50 text-emerald-700 border border-gray-200 hover:border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                title="Marquer comme résolu"
              >
                ✅ Résolu
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onWaiveClick(ticket)}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
          >
            💸 Waive
          </button>
          {onResolveClick && (
            <button
              onClick={() => onResolveClick(ticket)}
              className="text-xs font-semibold text-navy hover:text-navy/80 transition-colors"
            >
              {isResolved ? "📝 Details" : "✅ Resolve"}
            </button>
          )}
        </div>
        {isRecovery ? (
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
            className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors cursor-pointer bg-red-50 hover:bg-red-100 border border-red-200 rounded-md px-2 py-1"
            title="Annuler la mission de récupération et débloquer le véhicule"
          >
            🚫 Cancel Mission
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteClick(ticket.id);
            }}
            className="text-xs text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
          >
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  );
}
