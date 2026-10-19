"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  MessageSquare,
  Calendar,
  User,
  Clock,
  Send,
  Trash2,
  Car,
  Phone,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  History,
  FileText,
  Flag,
} from "lucide-react";
import toast from "react-hot-toast";
import RedFlagBadge from "./RedFlagBadge";

export interface DriverCommentItem {
  id: string;
  driverId?: string;
  authorName: string;
  authorRole?: string | null;
  content: string;
  commentDate?: string | null;
  createdAt: string;
}

interface DriverDailyCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: {
    id: string;
    fullName: string;
    phoneSanitized: string;
    cinNumber?: string;
    vehicle?: {
      plate_number: string;
      make_model?: string;
    } | null;
    comments?: DriverCommentItem[];
    todayComment?: string | null;
    isRedFlagged?: boolean;
    redFlagReason?: string | null;
  } | null;
  targetDate: string; // YYYY-MM-DD
  currentUserName: string;
  currentUserRole?: string;
  onCommentSaved: (driverId: string, newComment: DriverCommentItem) => void;
  onCommentDeleted?: (driverId: string, commentId: string) => void;
}

const QUICK_TAGS = [
  "📞 Chauffeur contacté, promet de payer à 16h",
  "⚠️ Chauffeur injoignable après plusieurs tentatives",
  "🚗 Véhicule au garage pour révision / panne",
  "🏥 Urgence personnelle / chauffeur indisponible",
  "💸 Versement partiel promis en fin de journée",
  "✅ Versement effectué par virement bancaire",
];

export default function DriverDailyCommentModal({
  isOpen,
  onClose,
  driver,
  targetDate,
  currentUserName,
  currentUserRole = "Fleet Manager",
  onCommentSaved,
  onCommentDeleted,
}: DriverDailyCommentModalProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyList, setHistoryList] = useState<DriverCommentItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // Fetch comments history for this driver
  const fetchComments = useCallback(async () => {
    if (!driver?.id) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}/comments?date=${targetDate}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.comments)) {
          setHistoryList(data.comments);
        }
      }
    } catch (e) {
      console.error("Error loading driver comments:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [driver?.id, targetDate]);

  useEffect(() => {
    if (isOpen && driver) {
      // Pre-fill with existing comment list if already provided, or fetch fresh
      if (driver.comments && driver.comments.length > 0) {
        setHistoryList(driver.comments);
      }
      fetchComments();
      setContent("");
    }
  }, [isOpen, driver, fetchComments]);

  if (!isOpen || !driver) return null;

  // Format target date in French
  const formattedTargetDate = (() => {
    try {
      const d = new Date(`${targetDate}T12:00:00Z`);
      return d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return targetDate;
    }
  })();

  // Separate comments into "Comments for this specific date" and "Prior / Other days history"
  const commentsForTargetDate = historyList.filter(
    (c) => (c.commentDate || c.createdAt.split("T")[0]) === targetDate
  );

  const commentsHistoryOtherDays = historyList.filter(
    (c) => (c.commentDate || c.createdAt.split("T")[0]) !== targetDate
  );

  // Submit a new comment linked to the selected date
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Veuillez saisir un commentaire");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          commentDate: targetDate,
          authorName: currentUserName,
          authorRole: currentUserRole,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Échec de l'enregistrement");
      }

      const data = await res.json();
      const savedComment: DriverCommentItem = {
        ...data.comment,
        commentDate: data.comment.commentDate || targetDate,
      };

      toast.success(`Note enregistrée pour le ${targetDate} !`);
      setContent("");
      setHistoryList((prev) => [savedComment, ...prev]);
      onCommentSaved(driver.id, savedComment);
    } catch (err: any) {
      console.error("Error saving comment:", err);
      toast.error(err.message || "Erreur lors de l'enregistrement de la note");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete a specific comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Voulez-vous supprimer ce commentaire de l'historique ?")) return;

    setDeletingCommentId(commentId);
    try {
      const res = await fetch(`/api/drivers/${driver.id}/comments?commentId=${commentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Échec de la suppression");
      }

      toast.success("Commentaire supprimé");
      setHistoryList((prev) => prev.filter((c) => c.id !== commentId));
      if (onCommentDeleted) {
        onCommentDeleted(driver.id, commentId);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de suppression");
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy via-[#1b3453] to-[#0d1e38] text-white p-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 bg-gold/20 text-gold rounded-xl border border-gold/30">
                <MessageSquare className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {driver.fullName}
              </h2>
              {driver.isRedFlagged && (
                <RedFlagBadge reason={driver.redFlagReason} />
              )}
              {driver.vehicle?.plate_number && (
                <span className="font-mono text-2xs font-black bg-white/15 px-2 py-0.5 rounded-lg border border-white/20">
                  🚗 {driver.vehicle.plate_number}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-2xs text-white/70 flex-wrap">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-gold" />
                {driver.phoneSanitized}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-gold font-bold">
                <Calendar className="w-3 h-3 text-gold" />
                Date active : <span className="capitalize text-white font-extrabold">{formattedTargetDate}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Red Flag Warning Banner */}
          {driver.isRedFlagged && (
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-pulse">
              <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-red-900 uppercase tracking-wider">
                    Chauffeur Fiché Red Flag
                  </span>
                  <RedFlagBadge reason={driver.redFlagReason} />
                </div>
                <p className="text-xs text-red-800 font-semibold mt-1">
                  Ce chauffeur fait l&apos;objet d&apos;un signalement critique. Toute note ou échange doit faire l&apos;objet d&apos;une attention renforcée.
                </p>
                {driver.redFlagReason && (
                  <p className="text-xs text-red-700 mt-1 bg-white/90 rounded-lg px-2.5 py-1 border border-red-200 inline-block font-medium">
                    Motif : {driver.redFlagReason}
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Section 1: Write Comment for Active Date */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-navy" />
                <span>Nouvelle observation pour le {targetDate}</span>
              </label>
              <span className="text-[10px] font-bold text-gray-500">
                Auteur : <strong className="text-navy">{currentUserName}</strong>
              </span>
            </div>

            {/* Quick tag chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-3xs font-extrabold text-gray-400 uppercase tracking-wider mr-1">
                Rapide :
              </span>
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setContent(tag)}
                  className="px-2 py-1 bg-white hover:bg-gold/10 hover:border-gold/40 text-gray-700 text-3xs font-semibold rounded-lg border border-gray-200 transition-all cursor-pointer shadow-2xs"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Rédigez une observation pour ${driver.fullName} le ${targetDate}... (Ex: Promesse de paiement, problème mécanique, accord exceptionnel)`}
                rows={3}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs text-slate-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all resize-none shadow-inner"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-3xs text-gray-400 font-medium">
                  💡 Cette note sera horodatée au <strong>{targetDate}</strong> et conservée dans l&apos;historique permanent.
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !content.trim()}
                  className="px-4 py-2 bg-navy hover:bg-navy/90 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                >
                  <Send className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
                  <span>{isSubmitting ? "Enregistrement..." : "Enregistrer la note"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Comments for the Selected Date (if any already written) */}
          {commentsForTargetDate.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-navy uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Note(s) enregistrée(s) pour le {targetDate} ({commentsForTargetDate.length})</span>
                </h3>
                <span className="text-3xs bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  Visible pour cette date
                </span>
              </div>

              <div className="space-y-2">
                {commentsForTargetDate.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200/80 shadow-2xs space-y-1.5 hover:border-emerald-300 transition-all"
                  >
                    <div className="flex items-center justify-between text-2xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-950 flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-700" />
                          {c.authorName}
                        </span>
                        {c.authorRole && (
                          <span className="text-3xs bg-white text-gray-600 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold">
                            {c.authorRole}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 font-mono text-3xs">
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(c.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          disabled={deletingCommentId === c.id}
                          className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                          title="Supprimer cette note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Full Historical Log (Other Days / Previous Comments) */}
          <div className="space-y-2.5 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-gray-600" />
                <span>Historique antérieur & Journaux précédents ({commentsHistoryOtherDays.length})</span>
              </h3>
              <span className="text-3xs text-gray-400 font-medium">
                Archives journalières
              </span>
            </div>

            {isLoadingHistory ? (
              <div className="p-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-spin text-navy" />
                <span>Chargement de l&apos;historique...</span>
              </div>
            ) : commentsHistoryOtherDays.length === 0 ? (
              <div className="p-6 text-center bg-gray-50/60 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-xs space-y-1">
                <p className="font-semibold text-gray-600">Aucun commentaire antérieur pour ce chauffeur.</p>
                <p className="text-3xs text-gray-400">
                  Les notes enregistrées pour aujourd&apos;hui seront automatiquement visibles dans cet historique les jours suivants.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {commentsHistoryOtherDays.map((c) => {
                  const cDate = c.commentDate || c.createdAt.split("T")[0];
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 bg-white rounded-xl border border-gray-200/90 shadow-2xs space-y-1.5 hover:border-gray-300 transition-all"
                    >
                      <div className="flex items-center justify-between text-2xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-gray-100 text-navy font-bold font-mono rounded-md text-3xs border border-gray-200">
                            🗓️ {cDate}
                          </span>
                          <span className="font-bold text-gray-800 flex items-center gap-1">
                            <User className="w-3 h-3 text-gray-500" />
                            {c.authorName}
                          </span>
                          {c.authorRole && (
                            <span className="text-3xs bg-gray-50 text-gray-500 px-1.5 py-0.2 rounded border border-gray-200 font-medium">
                              {c.authorRole}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 font-mono text-3xs">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(c.createdAt).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            disabled={deletingCommentId === c.id}
                            className="p-1 hover:text-red-600 transition-colors cursor-pointer"
                            title="Supprimer ce commentaire"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed pl-1">
                        {c.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-2xs text-gray-500">
          <span>
            Total commentaires enregistrés : <strong className="text-navy">{historyList.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-xl border border-gray-200 transition-colors cursor-pointer shadow-2xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
