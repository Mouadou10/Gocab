"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  Car,
  Phone,
  Building,
  DollarSign,
  Camera,
  CheckCircle2,
  Wrench,
  Trash2,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  FileText,
  X,
  Maximize2,
  Edit3,
  MessageSquare,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import RedFlagBadge from "./RedFlagBadge";
import EditRepairReminderModal, { RepairCommentItem } from "./EditRepairReminderModal";

export interface RepairReminderItem {
  id: string;
  vehicle_id?: string | null;
  plate_number: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  reminder_date: string;
  reminder_time?: string | null;
  garage_name?: string | null;
  repair_type: string;
  title: string;
  description: string;
  photos: {
    id: string;
    name: string;
    fileUrl: string;
    fileType: string;
    size?: number;
    uploaded_at?: string;
  }[];
  estimated_cost_mad?: number;
  priority: "Normal" | "Urgent" | "Critical";
  status: "PENDING" | "DUE" | "IN_REPAIR" | "COMPLETED" | "CANCELLED";
  agent_notes?: string | null;
  comments?: RepairCommentItem[];
  created_by?: string | null;
  created_at: string;
  vehicle_make_model?: string;
  vehicle_hub_city?: string;
  vehicle_status?: string;
  is_driver_red_flagged?: boolean;
  driver_red_flag_reason?: string | null;
  is_due_today?: boolean;
  is_overdue?: boolean;
  is_due_or_overdue?: boolean;
}

interface RepairReminderCardProps {
  reminder: RepairReminderItem;
  onUpdate: () => void;
}

export default function RepairReminderCard({
  reminder,
  onUpdate,
}: RepairReminderCardProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(reminder.reminder_date);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalTab, setEditModalTab] = useState<"photos" | "comments" | "details">("photos");

  const commentsList = (() => {
    if (Array.isArray(reminder.comments) && reminder.comments.length > 0) {
      return reminder.comments;
    }
    if (reminder.agent_notes) {
      try {
        const parsed = JSON.parse(reminder.agent_notes);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      return [
        {
          id: "note-1",
          author: reminder.created_by || "Agent",
          content: reminder.agent_notes,
          created_at: reminder.created_at,
        },
      ];
    }
    return [];
  })();

  // Calculate days difference
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remDate = new Date(reminder.reminder_date);
  remDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((remDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/insurance/repair-reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(
          newStatus === "IN_REPAIR"
            ? "🔧 Véhicule marqué comme déposé au garage !"
            : newStatus === "COMPLETED"
            ? "✅ Réparation validée et terminée !"
            : "Statut mis à jour !"
        );
        onUpdate();
      } else {
        toast.error("Échec de la mise à jour");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReschedule = async () => {
    if (!newDate) return;
    try {
      const res = await fetch(`/api/insurance/repair-reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_date: newDate,
          status: "PENDING",
        }),
      });
      if (res.ok) {
        toast.success(`📅 Date de rappel reportée au ${newDate} !`);
        setIsRescheduling(false);
        onUpdate();
      } else {
        toast.error("Échec du report");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer le rappel de réparation pour ${reminder.plate_number} ?`)) return;
    try {
      const res = await fetch(`/api/insurance/repair-reminders/${reminder.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Rappel supprimé");
        onUpdate();
      }
    } catch {
      toast.error("Erreur de suppression");
    }
  };

  return (
    <div
      className={`bg-white rounded-3xl border-2 transition-all shadow-xs overflow-hidden flex flex-col justify-between ${
        reminder.status === "COMPLETED"
          ? "border-emerald-200/80 bg-emerald-50/10"
          : reminder.status === "IN_REPAIR"
          ? "border-purple-300 bg-purple-50/10"
          : reminder.is_overdue
          ? "border-red-500 bg-red-50/20 shadow-md ring-2 ring-red-400/20"
          : reminder.is_due_today
          ? "border-amber-500 bg-amber-50/20 shadow-md ring-2 ring-amber-400/20"
          : "border-gray-200/80 hover:border-navy/30"
      }`}
    >
      {/* Top Banner / Due Alert */}
      {reminder.status === "PENDING" && (
        <div
          className={`px-4 py-2 text-xs font-black flex items-center justify-between ${
            reminder.is_overdue
              ? "bg-red-600 text-white animate-pulse"
              : reminder.is_due_today
              ? "bg-amber-500 text-white animate-pulse"
              : "bg-navy/5 text-navy border-b border-gray-100"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {reminder.is_overdue
                ? `🚨 DÉPÔT EN RETARD (${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? "s" : ""} de retard)`
                : reminder.is_due_today
                ? "⚠️ À DÉPOSER AU GARAGE AUJOURD'HUI !"
                : `⏰ Dépôt prévu dans ${diffDays} jour${diffDays > 1 ? "s" : ""} (${reminder.reminder_date})`}
            </span>
          </div>

          {reminder.reminder_time && (
            <span className="text-3xs font-mono opacity-90">
              Heure : {reminder.reminder_time}
            </span>
          )}
        </div>
      )}

      {/* Main Card Content */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header: Plate & Driver */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-black text-xs bg-navy text-white px-2.5 py-1 rounded-xl shadow-xs">
                🚗 {reminder.plate_number}
              </span>
              <span className="text-xs font-extrabold text-gray-900">
                {reminder.vehicle_make_model || "Véhicule"}
              </span>
              <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {reminder.repair_type}
              </span>
            </div>

            {/* Driver information strip */}
            <div className="flex items-center gap-2 text-xs pt-0.5 flex-wrap">
              <span className="text-gray-500 font-semibold flex items-center gap-1">
                👤 {reminder.driver_name || "Non assigné"}
              </span>
              {reminder.driver_phone && (
                <a
                  href={`tel:${reminder.driver_phone}`}
                  className="font-mono text-2xs text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <Phone className="w-3 h-3" />
                  <span>{reminder.driver_phone}</span>
                </a>
              )}
              {reminder.is_driver_red_flagged && (
                <RedFlagBadge reason={reminder.driver_red_flag_reason} />
              )}
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`px-2.5 py-1 rounded-xl text-2xs font-black uppercase tracking-wider shrink-0 ${
              reminder.status === "COMPLETED"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : reminder.status === "IN_REPAIR"
                ? "bg-purple-100 text-purple-900 border border-purple-200"
                : reminder.is_overdue
                ? "bg-red-100 text-red-900 border border-red-300"
                : reminder.is_due_today
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-blue-100 text-blue-900 border border-blue-200"
            }`}
          >
            {reminder.status === "COMPLETED"
              ? "✅ Réparé"
              : reminder.status === "IN_REPAIR"
              ? "🔧 Au Garage"
              : reminder.is_overdue
              ? "🚨 Échu"
              : reminder.is_due_today
              ? "⚡ Dû Aujourd'hui"
              : "⏳ En Attente"}
          </span>
        </div>

        {/* Work Description */}
        <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100 space-y-1">
          <p className="text-xs font-bold text-gray-900">{reminder.title}</p>
          {reminder.description && (
            <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
              {reminder.description}
            </p>
          )}

          {/* Garage & Cost Details */}
          <div className="flex items-center justify-between text-2xs text-gray-500 pt-2 border-t border-gray-200/50 flex-wrap gap-2">
            <span className="flex items-center gap-1 font-semibold text-gray-700">
              <Building className="w-3.5 h-3.5 text-navy" />
              <span>{reminder.garage_name || "Garage non spécifié"}</span>
            </span>

            {Number(reminder.estimated_cost_mad) > 0 && (
              <span className="font-mono font-black text-navy text-xs bg-navy/5 px-2 py-0.5 rounded-lg border border-navy/10">
                Coût Estimé : {Number(reminder.estimated_cost_mad).toLocaleString()} MAD
              </span>
            )}
          </div>
        </div>

        {/* Comments & Tracking Section */}
        {commentsList.length > 0 ? (
          <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-amber-700" />
                <span>Commentaires & Suivi ({commentsList.length})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditModalTab("comments");
                  setIsEditModalOpen(true);
                }}
                className="text-3xs text-amber-800 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Écrire</span>
              </button>
            </div>

            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {commentsList.map((c: any, i: number) => (
                <div key={c.id || i} className="text-2xs bg-white/90 p-2 rounded-xl border border-amber-100 shadow-3xs space-y-0.5">
                  <div className="flex items-center justify-between text-3xs text-gray-400">
                    <span className="font-bold text-gray-800">{c.author || "Agent"}</span>
                    {c.created_at && (
                      <span className="font-mono">
                        {new Date(c.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap leading-tight">{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => {
                setEditModalTab("comments");
                setIsEditModalOpen(true);
              }}
              className="text-2xs text-gray-500 hover:text-navy flex items-center gap-1 font-semibold hover:underline cursor-pointer"
            >
              <MessageSquare className="w-3 h-3 text-gray-400" />
              <span>+ Écrire un commentaire ou note de suivi</span>
            </button>
          </div>
        )}

        {/* Photo Gallery Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1">
              <Camera className="w-3 h-3 text-navy" />
              <span>Photos de Dommages ({reminder.photos?.length || 0})</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditModalTab("photos");
                  setIsEditModalOpen(true);
                }}
                className="text-3xs text-navy font-bold hover:underline flex items-center gap-0.5 cursor-pointer bg-navy/5 px-2 py-0.5 rounded-lg border border-navy/10"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Ajouter photo</span>
              </button>
              {reminder.photos && reminder.photos.length > 0 && (
                <span className="text-3xs text-gray-400">Cliquez pour agrandir</span>
              )}
            </div>
          </div>

          {(!reminder.photos || reminder.photos.length === 0) ? (
            <div
              onClick={() => {
                setEditModalTab("photos");
                setIsEditModalOpen(true);
              }}
              className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center text-2xs text-gray-400 hover:border-navy hover:text-navy cursor-pointer transition-colors"
            >
              + Cliquez pour ajouter des photos de dommages
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {reminder.photos.map((photo, idx) => (
                <div
                  key={photo.id || idx}
                  onClick={() => setSelectedPhoto(photo.fileUrl)}
                  className="relative group rounded-xl overflow-hidden aspect-video bg-gray-900 border border-gray-200 cursor-pointer shadow-2xs hover:border-navy transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.fileUrl}
                    alt={photo.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reschedule inline date picker if open */}
        {isRescheduling && (
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 animate-fadeIn">
            <label className="text-xs font-bold text-amber-900 block">
              Nouvelle Date de Dépôt Garage :
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-navy focus:outline-none"
              />
              <button
                type="button"
                onClick={handleReschedule}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setIsRescheduling(false)}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 sm:p-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {reminder.status !== "IN_REPAIR" && reminder.status !== "COMPLETED" && (
            <button
              type="button"
              disabled={isUpdatingStatus}
              onClick={() => handleUpdateStatus("IN_REPAIR")}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Déposé au Garage</span>
            </button>
          )}

          {reminder.status === "IN_REPAIR" && (
            <button
              type="button"
              disabled={isUpdatingStatus}
              onClick={() => handleUpdateStatus("COMPLETED")}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Réparation Terminée</span>
            </button>
          )}

          {reminder.status !== "COMPLETED" && (
            <button
              type="button"
              onClick={() => setIsRescheduling(!isRescheduling)}
              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold border border-gray-200 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
            >
              <Calendar className="w-3 h-3 text-gray-500" />
              <span>Reporter Date</span>
            </button>
          )}

          {/* Edit Sinistre Button */}
          <button
            type="button"
            onClick={() => {
              setEditModalTab("photos");
              setIsEditModalOpen(true);
            }}
            className="px-3 py-1.5 bg-navy hover:bg-[#1a3454] text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Modifier photos, ajouter des commentaires et mettre à jour le sinistre"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Modifier Sinistre</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
          title="Supprimer ce rappel"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Edit Sinistre & Photos Modal */}
      {isEditModalOpen && (
        <EditRepairReminderModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={onUpdate}
          reminder={reminder}
          initialTab={editModalTab}
        />
      )}

      {/* Lightbox / Zoom Modal for Photo */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhoto}
              alt="Photo Dommage Véhicule"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
