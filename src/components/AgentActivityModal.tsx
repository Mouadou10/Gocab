"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatDisplayPhone } from "@/lib/whatsapp";

interface LeadSummary {
  id: string;
  raw_name: string;
  sanitized_phone: string;
  board_column: string;
  brand_status: string | null;
  training_status: string | null;
  city: string | null;
}

interface ActivityLogItem {
  id: string;
  lead_id: string;
  agent: string;
  action: string;
  detail: string | null;
  created_at: string;
  lead?: LeadSummary | null;
}

interface ActivityStats {
  total: number;
  statusChanged: number;
  recallSet: number;
  whatsappSent: number;
  presenceConfirmed: number;
  notesAdded: number;
}

interface AgentActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLead?: (lead: any) => void;
  currentUserName?: string;
  currentUserRole?: string;
}

export default function AgentActivityModal({
  isOpen,
  onClose,
  onSelectLead,
  currentUserName = "Agent",
  currentUserRole = "AGENT",
}: AgentActivityModalProps) {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    total: 0,
    statusChanged: 0,
    recallSet: 0,
    whatsappSent: 0,
    presenceConfirmed: 0,
    notesAdded: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState<"today" | "7days" | "all">("today");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [availableAgents, setAvailableAgents] = useState<{ name: string; email: string; role: string }[]>([]);

  const isManager = currentUserRole === "ADMIN" || currentUserRole === "OPS_MANAGER";

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (selectedAgent) params.set("agent", selectedAgent);

      const res = await fetch(`/api/activity?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.stats) setStats(data.stats);
        if (Array.isArray(data.availableAgents) && data.availableAgents.length > 0) {
          setAvailableAgents(data.availableAgents);
        }
      }
    } catch (err) {
      console.error("Failed to fetch agent activity:", err);
    } finally {
      setIsLoading(false);
    }
  }, [period, actionFilter, selectedAgent]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  if (!isOpen) return null;

  const actionIcons: Record<string, string> = {
    STATUS_CHANGED: "🔄",
    TRAINING_STATUS_CHANGED: "🎓",
    RECALL_SET: "⏰",
    PRESENCE_CONFIRMED: "✅",
    NOTE_ADDED: "📝",
    KYC_UPDATED: "📄",
    COLUMN_MOVED: "➡️",
    CITY_SET: "📍",
    PREORDER_SET: "💰",
    WHATSAPP_SENT: "💬",
    WHATSAPP_OPENED: "📱",
  };

  const actionLabels: Record<string, string> = {
    STATUS_CHANGED: "Statut",
    TRAINING_STATUS_CHANGED: "Formation",
    RECALL_SET: "Rappel",
    PRESENCE_CONFIRMED: "Présence",
    NOTE_ADDED: "Note",
    KYC_UPDATED: "KYC / Docs",
    COLUMN_MOVED: "Déplacement",
    CITY_SET: "Ville",
    PREORDER_SET: "Précommande",
    WHATSAPP_SENT: "WhatsApp",
    WHATSAPP_OPENED: "WhatsApp Web",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-navy/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-xl bg-slate-50 h-full shadow-2xl flex flex-col z-10 animate-slide-left">
        {/* Header */}
        <div className="bg-navy px-6 py-4 text-white flex items-center justify-between border-b border-white/10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl border border-white/15 shadow-inner">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  {isManager && selectedAgent && selectedAgent !== "ALL"
                    ? `Journal de ${selectedAgent}`
                    : isManager && selectedAgent === "ALL"
                    ? "Journal d'activité d'Équipe"
                    : "Mon Journal d'Activité"}
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Live
                </span>
              </div>
              <p className="text-xs text-white/70">
                Historique de vos actions, appels, statuts et messages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              title="Rafraîchir"
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 space-y-3 shadow-xs">
          {/* Manager: Agent Selector */}
          {isManager && availableAgents.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
                Filtrer par Agent :
              </label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
              >
                <option value="">Mon Journal ({currentUserName})</option>
                <option value="ALL">🌐 Tous les agents (Vue Globale)</option>
                {availableAgents.map((ag) => (
                  <option key={ag.email} value={ag.name || ag.email}>
                    👤 {ag.name || ag.email} ({ag.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Period Selector Pills */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPeriod("today")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === "today"
                    ? "bg-white text-navy shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => setPeriod("7days")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === "7days"
                    ? "bg-white text-navy shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                7 derniers jours
              </button>
              <button
                type="button"
                onClick={() => setPeriod("all")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === "all"
                    ? "bg-white text-navy shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tout
              </button>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              <strong className="text-navy font-bold">{logs.length}</strong> action(s)
            </span>
          </div>

          {/* Action Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-2xs">
            <button
              type="button"
              onClick={() => setActionFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer ${
                actionFilter === "ALL"
                  ? "bg-navy text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tous ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("RECALL_SET")}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                actionFilter === "RECALL_SET"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
              }`}
            >
              <span>⏰ Rappels</span>
              <span className="font-mono">({stats.recallSet})</span>
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("STATUS_CHANGED")}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                actionFilter === "STATUS_CHANGED"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60"
              }`}
            >
              <span>🔄 Statuts</span>
              <span className="font-mono">({stats.statusChanged})</span>
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("WHATSAPP_SENT")}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                actionFilter === "WHATSAPP_SENT"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
              }`}
            >
              <span>💬 WhatsApp</span>
              <span className="font-mono">({stats.whatsappSent})</span>
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("PRESENCE_CONFIRMED")}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                actionFilter === "PRESENCE_CONFIRMED"
                  ? "bg-green-600 text-white"
                  : "bg-green-50 text-green-800 hover:bg-green-100 border border-green-200/60"
              }`}
            >
              <span>✅ Présences</span>
              <span className="font-mono">({stats.presenceConfirmed})</span>
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("NOTE_ADDED")}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1 ${
                actionFilter === "NOTE_ADDED"
                  ? "bg-purple-600 text-white"
                  : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60"
              }`}
            >
              <span>📝 Notes</span>
              <span className="font-mono">({stats.notesAdded})</span>
            </button>
          </div>
        </div>

        {/* Content: Timeline List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <span className="animate-spin text-3xl">⏳</span>
              <p className="text-xs font-semibold">Chargement du journal d&apos;activité...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400 space-y-2">
              <span className="text-4xl">📭</span>
              <h3 className="text-sm font-bold text-slate-700">Aucune activité enregistrée</h3>
              <p className="text-xs max-w-sm mx-auto text-slate-500">
                Vos actions (appels, changements de statut, rappels fixés, messages WhatsApp) apparaîtront automatiquement ici au fil de votre travail.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => {
                const icon = actionIcons[log.action] || "🔹";
                const actionBadge = actionLabels[log.action] || log.action;
                const when = new Date(log.created_at);
                const timeStr = when.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const dateStr = when.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                });

                return (
                  <div
                    key={log.id}
                    className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-base shrink-0 border border-slate-200/60 mt-0.5">
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-2xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                              {actionBadge}
                            </span>
                            <span className="text-2xs text-slate-400 font-semibold">
                              {dateStr} à {timeStr}
                            </span>
                            {isManager && (
                              <span className="text-2xs bg-navy/5 text-navy px-2 py-0.5 rounded-full font-bold">
                                {log.agent}
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-semibold text-slate-800 leading-snug break-words">
                            {log.detail || log.action}
                          </p>

                          {/* Linked Candidate Card */}
                          {log.lead ? (
                            <div
                              onClick={() => {
                                if (onSelectLead) {
                                  onSelectLead(log.lead);
                                  onClose();
                                }
                              }}
                              className="mt-2.5 p-2.5 bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer group"
                              title="Cliquer pour ouvrir le prospect dans le tiroir"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs">👤</span>
                                <div>
                                  <p className="text-xs font-bold text-slate-800 group-hover:text-blue-900 truncate">
                                    {log.lead.raw_name}
                                  </p>
                                  <p className="text-3xs text-slate-500 font-mono">
                                    {formatDisplayPhone(log.lead.sanitized_phone)} • {log.lead.city || "Casablanca"}
                                  </p>
                                </div>
                              </div>
                              <span className="text-2xs text-blue-700 font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
                                Ouvrir →
                              </span>
                            </div>
                          ) : (
                            <p className="text-3xs text-slate-400 mt-1 font-mono">
                              Lead #{log.lead_id.slice(0, 8)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Journal synchronisé en temps réel</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
