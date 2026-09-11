"use client";

/**
 * ReminderAlert Component
 *
 * Header notification bell with badge counter for due reminders.
 * Replaces intrusive floating toast stacks with a sleek, clickable notification popover.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, BellRing, Clock, Calendar, MessageSquare, Check, CheckCheck, X, User } from "lucide-react";
import { generateThankYouURL } from "@/lib/whatsapp";

interface Lead {
  id: string;
  raw_name: string;
  sanitized_phone: string;
  board_column: string;
  brand_status: string | null;
  training_status: string | null;
  reminder_date: string | null;
  campaign_source?: string;
  created_at?: string;
}

interface ReminderAlertProps {
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
}

const STORAGE_KEY = "gocab_dismissed_reminders_v1";

function getStoredDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveStoredDismissedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

function formatPhone(phone: string): string {
  if (!phone) return "";
  if (phone.startsWith("+212") && phone.length === 13) {
    return `${phone.slice(0, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}`;
  }
  return phone;
}

function formatReminderDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeStr = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const dateFormatted = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

    if (isToday) {
      return `Aujourd'hui à ${timeStr}`;
    }
    return `${dateFormatted} à ${timeStr}`;
  } catch {
    return dateStr;
  }
}

export default function ReminderAlert({ leads, onSelectLead }: ReminderAlertProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize dismissed IDs from localStorage
  useEffect(() => {
    setDismissedIds(getStoredDismissedIds());
  }, []);

  // Filter due leads
  const dueLeads = leads
    .filter((lead) => {
      if (!lead.reminder_date) return false;
      if (lead.board_column === "NEW_LEADS") return false;
      if (dismissedIds.has(lead.id)) return false;
      const d = new Date(lead.reminder_date);
      return !isNaN(d.getTime()) && d <= new Date();
    })
    .sort((a, b) => new Date(b.reminder_date!).getTime() - new Date(a.reminder_date!).getTime());

  const count = dueLeads.length;

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Dismiss single reminder
  const handleDismiss = (leadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = new Set(dismissedIds);
    updated.add(leadId);
    setDismissedIds(updated);
    saveStoredDismissedIds(updated);
  };

  // Dismiss all current due reminders
  const handleDismissAll = () => {
    const updated = new Set(dismissedIds);
    dueLeads.forEach((l) => updated.add(l.id));
    setDismissedIds(updated);
    saveStoredDismissedIds(updated);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Small Notification Icon with Badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? "bg-navy text-white border-navy shadow-sm"
            : count > 0
            ? "bg-amber-50/80 hover:bg-amber-100 text-amber-900 border-amber-200 shadow-2xs hover:shadow-xs"
            : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200 shadow-2xs hover:shadow-xs"
        }`}
        title={count > 0 ? `${count} rappel(s) en attente` : "Notifications & Rappels"}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        {count > 0 ? (
          <BellRing className={`w-4 h-4 ${isOpen ? "text-white" : "text-amber-600 animate-pulse"}`} />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {/* Small number badge */}
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-navy text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔔</span>
              <div>
                <h4 className="text-xs font-bold tracking-tight">Rappels & Notifications</h4>
                <p className="text-[10px] text-slate-300">
                  {count > 0 ? `${count} rappel(s) en retard` : "Aucun rappel en retard"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {count > 0 && (
                <button
                  type="button"
                  onClick={handleDismissAll}
                  className="text-[10px] font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  title="Tout marquer comme vu"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Tout effacer</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List of Due Reminders */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 overscroll-contain">
            {count === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-bold text-lg">
                  ✓
                </div>
                <p className="text-xs font-bold text-slate-800">Vous êtes à jour !</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Aucun prospect n&apos;est en attente de rappel pour le moment.
                </p>
              </div>
            ) : (
              dueLeads.map((lead) => {
                const isTraining =
                  lead.brand_status === "Training fixed" ||
                  lead.board_column === "TRAINING_PIPELINE";

                return (
                  <div
                    key={lead.id}
                    className="p-3.5 hover:bg-slate-50 transition-colors group relative flex flex-col gap-2"
                  >
                    {/* Top row: Name, status badge, dismiss */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-slate-900 truncate">
                            {lead.raw_name}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                              isTraining
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {isTraining ? "Formation" : lead.brand_status || "Rappel"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {formatPhone(lead.sanitized_phone)}
                        </p>
                      </div>

                      {/* Dismiss button */}
                      <button
                        type="button"
                        onClick={(e) => handleDismiss(lead.id, e)}
                        className="text-slate-300 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200/60 transition-colors shrink-0"
                        title="Marquer comme vu"
                        aria-label="Ignorer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Due timestamp indicator */}
                    {lead.reminder_date && (
                      <div className="flex items-center gap-1.5 text-[10px] text-rose-600 font-semibold">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>Prévu : {formatReminderDate(lead.reminder_date)}</span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {/* WhatsApp Button */}
                      <a
                        href={generateThankYouURL(lead.sanitized_phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>

                      {/* Open Lead Drawer Button */}
                      {onSelectLead && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onSelectLead(lead);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-navy hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                        >
                          <User className="w-3 h-3" />
                          <span>Ouvrir Fiche</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {count > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
              <span>{count} rappel(s) nécessitant une attention</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="font-bold text-slate-700 hover:text-navy cursor-pointer"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
