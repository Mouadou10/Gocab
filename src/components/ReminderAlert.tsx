"use client";

/**
 * ReminderAlert Component
 *
 * Polls for leads with reminder_date <= now() and displays
 * dismissible toast alerts with a WhatsApp follow-up link.
 * Checks on mount and every 60 seconds.
 */

import { useState, useEffect, useCallback } from "react";
import { generateThankYouURL } from "@/lib/whatsapp";

interface Lead {
  id: string;
  raw_name: string;
  sanitized_phone: string;
  board_column: string;
  brand_status: string | null;
  training_status: string | null;
  reminder_date: string | null;
  campaign_source: string;
  created_at: string;
}

interface ReminderAlertProps {
  leads: Lead[];
}

export default function ReminderAlert({ leads }: ReminderAlertProps) {
  const [dueLeads, setDueLeads] = useState<Lead[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  /** Check which leads have reminders that are due. */
  const checkReminders = useCallback(() => {
    const now = new Date();
    const due = leads.filter((lead) => {
      if (!lead.reminder_date) return false;
      if (dismissedIds.has(lead.id)) return false;
      return new Date(lead.reminder_date) <= now;
    });
    setDueLeads(due);
  }, [leads, dismissedIds]);

  useEffect(() => {
    checkReminders();

    // Re-check every 60 seconds
    const interval = setInterval(checkReminders, 60_000);

    // Also check on window focus (user returns to tab)
    const handleFocus = () => checkReminders();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkReminders]);

  function dismiss(leadId: string) {
    setDismissedIds((prev) => new Set(prev).add(leadId));
    setDueLeads((prev) => prev.filter((l) => l.id !== leadId));
  }

  if (dueLeads.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 max-w-sm">
      {dueLeads.map((lead) => (
        <div
          key={lead.id}
          className="bg-white border-l-4 border-amber-500 shadow-lg rounded-lg p-4 animate-slide-up"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <span className="text-amber-500">⏰</span>
                Reminder Due
              </p>
              <p className="text-xs text-gray-600 mt-1">
                <span className="font-medium">{lead.raw_name}</span>
                {" · "}
                <span className="font-mono">{lead.sanitized_phone}</span>
              </p>
              <a
                href={generateThankYouURL(lead.sanitized_phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-green-700 hover:text-green-800 transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Follow up on WhatsApp
              </a>
            </div>
            <button
              onClick={() => dismiss(lead.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
              aria-label="Dismiss reminder"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
