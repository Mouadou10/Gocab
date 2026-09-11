"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { formatDisplayPhone } from "@/lib/whatsapp";
import {
  Search,
  RefreshCw,
  X,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  User,
  Users,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Tag,
  MapPin,
  TrendingUp,
  Sparkles,
} from "lucide-react";

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
  callsInitiated?: number;
}

interface AgentActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLead?: (lead: any) => void;
  currentUserName?: string;
  currentUserRole?: string;
}

type PeriodType = "today" | "yesterday" | "7days" | "30days" | "all";

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
    callsInitiated: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodType>("today");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [viewMode, setViewMode] = useState<"MY" | "TEAM">("TEAM");
  const [availableAgents, setAvailableAgents] = useState<{ name: string; email: string; role: string }[]>([]);

  const isManager = currentUserRole === "ADMIN" || currentUserRole === "OPS_MANAGER" || currentUserRole === "BRAND_MANAGER";

  // When manager changes viewMode:
  useEffect(() => {
    if (!isManager) {
      setViewMode("MY");
      setSelectedAgent("");
    } else {
      if (viewMode === "MY") {
        setSelectedAgent(currentUserName);
      } else if (viewMode === "TEAM" && selectedAgent === currentUserName) {
        setSelectedAgent("ALL");
      }
    }
  }, [viewMode, isManager, currentUserName]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      if (isManager) {
        if (viewMode === "MY") {
          params.set("agent", currentUserName);
        } else if (selectedAgent && selectedAgent !== "ALL") {
          params.set("agent", selectedAgent);
        } else {
          params.set("agent", "ALL");
        }
      }

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
  }, [period, actionFilter, searchQuery, isManager, viewMode, selectedAgent, currentUserName]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Group logs chronologically by day
  const groupedLogs = useMemo(() => {
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const groups: { title: string; date: string; items: ActivityLogItem[] }[] = [];
    const map = new Map<string, ActivityLogItem[]>();

    for (const log of logs) {
      const logDate = new Date(log.created_at);
      const logDateStr = logDate.toDateString();
      if (!map.has(logDateStr)) {
        map.set(logDateStr, []);
      }
      map.get(logDateStr)!.push(log);
    }

    map.forEach((items, dateKey) => {
      let title = dateKey;
      if (dateKey === todayStr) {
        title = "Aujourd'hui";
      } else if (dateKey === yesterdayStr) {
        title = "Hier";
      } else {
        const d = new Date(dateKey);
        title = d.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        title = title.charAt(0).toUpperCase() + title.slice(1);
      }
      groups.push({ title, date: dateKey, items });
    });

    return groups;
  }, [logs]);

  if (!isOpen) return null;

  // Visual metadata per action type
  function getActionConfig(action: string) {
    switch (action) {
      case "STATUS_CHANGED":
        return {
          icon: <RefreshCw className="w-3.5 h-3.5" />,
          label: "Statut Prospect",
          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
          iconBg: "bg-blue-50 text-blue-600 border-blue-100",
          dotColor: "bg-blue-500",
        };
      case "TRAINING_STATUS_CHANGED":
        return {
          icon: <Calendar className="w-3.5 h-3.5" />,
          label: "Formation",
          badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
          iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100",
          dotColor: "bg-indigo-500",
        };
      case "RECALL_SET":
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          label: "Rappel Téléphonique",
          badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
          iconBg: "bg-amber-50 text-amber-700 border-amber-100",
          dotColor: "bg-amber-500",
        };
      case "TRAINING_DATE_SET":
        return {
          icon: <Calendar className="w-3.5 h-3.5" />,
          label: "Date Formation",
          badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
          iconBg: "bg-blue-50 text-blue-700 border-blue-100",
          dotColor: "bg-blue-500",
        };
      case "CALL_INITIATED":
        return {
          icon: <Phone className="w-3.5 h-3.5" />,
          label: "Appel Sortant",
          badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
          iconBg: "bg-sky-50 text-sky-600 border-sky-100",
          dotColor: "bg-sky-500",
        };
      case "WHATSAPP_SENT":
        return {
          icon: <MessageSquare className="w-3.5 h-3.5" />,
          label: "WhatsApp Envoyé",
          badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
          iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100",
          dotColor: "bg-emerald-500",
        };
      case "WHATSAPP_OPENED":
        return {
          icon: <MessageSquare className="w-3.5 h-3.5" />,
          label: "WhatsApp Web",
          badgeColor: "bg-teal-50 text-teal-800 border-teal-200",
          iconBg: "bg-teal-50 text-teal-600 border-teal-100",
          dotColor: "bg-teal-500",
        };
      case "PRESENCE_CONFIRMED":
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: "Présence Validée",
          badgeColor: "bg-green-50 text-green-800 border-green-200",
          iconBg: "bg-green-50 text-green-600 border-green-100",
          dotColor: "bg-green-500",
        };
      case "NOTE_ADDED":
        return {
          icon: <FileText className="w-3.5 h-3.5" />,
          label: "Note Agent",
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
          iconBg: "bg-purple-50 text-purple-600 border-purple-100",
          dotColor: "bg-purple-500",
        };
      case "KYC_UPDATED":
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
          label: "Dossier KYC",
          badgeColor: "bg-violet-50 text-violet-700 border-violet-200",
          iconBg: "bg-violet-50 text-violet-600 border-violet-100",
          dotColor: "bg-violet-500",
        };
      case "COLUMN_MOVED":
        return {
          icon: <ArrowRight className="w-3.5 h-3.5" />,
          label: "Étape Pipeline",
          badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
          iconBg: "bg-slate-100 text-slate-600 border-slate-200",
          dotColor: "bg-slate-500",
        };
      case "CITY_SET":
        return {
          icon: <MapPin className="w-3.5 h-3.5" />,
          label: "Ville / Hub",
          badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
          iconBg: "bg-rose-50 text-rose-600 border-rose-100",
          dotColor: "bg-rose-500",
        };
      default:
        return {
          icon: <Tag className="w-3.5 h-3.5" />,
          label: action,
          badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
          iconBg: "bg-slate-100 text-slate-600 border-slate-200",
          dotColor: "bg-slate-400",
        };
    }
  }

  function getRelativeTimeString(dateIso: string) {
    const date = new Date(dateIso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-navy/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-slate-50 h-full shadow-2xl flex flex-col z-10 animate-slide-left">
        {/* Header with Dark Navy Aesthetic */}
        <div className="bg-gradient-to-r from-navy via-[#1b3455] to-[#0f223a] px-6 py-4 text-white flex items-center justify-between border-b border-white/10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl border border-white/15 shadow-inner">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  {viewMode === "MY" || !isManager
                    ? "Mon Journal d'Activité"
                    : selectedAgent && selectedAgent !== "ALL"
                    ? `Journal de ${selectedAgent}`
                    : "Journal d'Activité d'Équipe"}
                </h2>
                <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-xs text-white/70">
                {viewMode === "MY" || !isManager
                  ? `Suivi en temps réel de toutes vos actions (${currentUserName})`
                  : "Historique en direct des actions, appels, rappels et messages de l'équipe"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              title="Actualiser le journal"
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Controls & Filter Strip */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 space-y-3 shadow-2xs">
          {/* Top Row: Manager Scope Toggle & Agent Dropdown */}
          {isManager && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-100">
              {/* Scope Switcher: Mon Journal vs Équipe */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("MY");
                    setSelectedAgent(currentUserName);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === "MY"
                      ? "bg-white text-navy shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Mon Journal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("TEAM");
                    setSelectedAgent("ALL");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === "TEAM"
                      ? "bg-white text-navy shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Vue Équipe</span>
                </button>
              </div>

              {/* Agent Selector (visible in Team mode) */}
              {viewMode === "TEAM" && availableAgents.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-semibold text-slate-500 whitespace-nowrap">Agent :</span>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  >
                    <option value="ALL">🌐 Tous les agents</option>
                    {availableAgents.map((ag) => (
                      <option key={ag.email} value={ag.name || ag.email}>
                        👤 {ag.name || ag.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Search Bar & Period Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, téléphone, statut, note..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Period Selector Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl shrink-0 text-2xs">
              <button
                type="button"
                onClick={() => setPeriod("today")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  period === "today"
                    ? "bg-white text-navy shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => setPeriod("yesterday")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  period === "yesterday"
                    ? "bg-white text-navy shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Hier
              </button>
              <button
                type="button"
                onClick={() => setPeriod("7days")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  period === "7days"
                    ? "bg-white text-navy shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                7 jours
              </button>
              <button
                type="button"
                onClick={() => setPeriod("all")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  period === "all"
                    ? "bg-white text-navy shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tout
              </button>
            </div>
          </div>

          {/* Action Type Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-2xs">
            <button
              type="button"
              onClick={() => setActionFilter("ALL")}
              className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer ${
                actionFilter === "ALL"
                  ? "bg-navy text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tous ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("RECALL_SET")}
              className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                actionFilter === "RECALL_SET"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
              }`}
            >
              <span>⏰ Rappels</span>
              <span className="font-mono">({stats.recallSet})</span>
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("STATUS")}
              className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                actionFilter === "STATUS"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60"
              }`}
            >
              <span>🔄 Statuts</span>
              <span className="font-mono">({stats.statusChanged})</span>
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("WHATSAPP")}
              className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                actionFilter === "WHATSAPP"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
              }`}
            >
              <span>💬 WhatsApp</span>
              <span className="font-mono">({stats.whatsappSent})</span>
            </button>
            {stats.callsInitiated !== undefined && stats.callsInitiated > 0 && (
              <button
                type="button"
                onClick={() => setActionFilter("CALL_INITIATED")}
                className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                  actionFilter === "CALL_INITIATED"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/60"
                }`}
              >
                <span>📞 Appels</span>
                <span className="font-mono">({stats.callsInitiated})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActionFilter("PRESENCE_CONFIRMED")}
              className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                actionFilter === "PRESENCE_CONFIRMED"
                  ? "bg-green-600 text-white shadow-xs"
                  : "bg-green-50 text-green-800 hover:bg-green-100 border border-green-200/60"
              }`}
            >
              <span>✅ Présences</span>
              <span className="font-mono">({stats.presenceConfirmed})</span>
            </button>
            <button
              type="button"
              onClick={() => setActionFilter("NOTE_ADDED")}
              className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                actionFilter === "NOTE_ADDED"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60"
              }`}
            >
              <span>📝 Notes</span>
              <span className="font-mono">({stats.notesAdded})</span>
            </button>
          </div>
        </div>

        {/* Content: Chronological Grouped Timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-navy/60" />
              <p className="text-xs font-semibold">Synchronisation des activités...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">
                📭
              </div>
              <h3 className="text-sm font-bold text-slate-700">Aucune activité trouvée</h3>
              <p className="text-xs max-w-sm mx-auto text-slate-500">
                {searchQuery
                  ? `Aucun résultat pour "${searchQuery}". Essayez un autre mot-clé ou effacez la recherche.`
                  : "Les appels, statuts modifiés, rappels et messages WhatsApp apparaîtront automatiquement ici au fil des actions."}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="px-3 py-1.5 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy/90 transition-colors"
                >
                  Effacer la recherche
                </button>
              )}
            </div>
          ) : (
            groupedLogs.map((group) => (
              <div key={group.date} className="space-y-3">
                {/* Date Group Header */}
                <div className="flex items-center gap-2 sticky top-0 bg-slate-50/95 backdrop-blur-xs py-1 z-5">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {group.title}
                  </span>
                  <span className="text-2xs font-semibold px-2 py-0.5 bg-slate-200/80 text-slate-600 rounded-full font-mono">
                    {group.items.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Group Activities */}
                <div className="space-y-2.5">
                  {group.items.map((log) => {
                    const config = getActionConfig(log.action);
                    const when = new Date(log.created_at);
                    const timeStr = when.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const relativeTime = getRelativeTimeString(log.created_at);

                    return (
                      <div
                        key={log.id}
                        className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all space-y-2.5"
                      >
                        {/* Header: Action Badge, Timestamp, and Agent */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-bold border ${config.badgeColor}`}
                            >
                              {config.icon}
                              <span>{config.label}</span>
                            </span>

                            <span className="text-2xs font-mono text-slate-400 font-semibold">
                              {timeStr} • <span className="text-slate-500">{relativeTime}</span>
                            </span>
                          </div>

                          {/* Agent Chip */}
                          <div className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 rounded-full text-2xs font-bold text-slate-700">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{log.agent}</span>
                          </div>
                        </div>

                        {/* Action Detail Text */}
                        <div className="pl-1 text-xs font-semibold text-slate-800 leading-relaxed">
                          {log.action === "NOTE_ADDED" ? (
                            <div className="p-2.5 bg-purple-50/50 border border-purple-100 rounded-xl text-purple-900 italic font-medium">
                              {log.detail || "Note enregistrée"}
                            </div>
                          ) : (
                            <p>{log.detail || config.label}</p>
                          )}
                        </div>

                        {/* Linked Candidate Card */}
                        {log.lead ? (
                          <div
                            onClick={() => {
                              if (onSelectLead) {
                                onSelectLead(log.lead);
                                onClose();
                              }
                            }}
                            className="p-2.5 bg-slate-50/80 hover:bg-blue-50/80 border border-slate-200/70 hover:border-blue-300 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer group"
                            title="Cliquer pour ouvrir le prospect dans le tiroir"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {log.lead.raw_name?.charAt(0) || "👤"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 group-hover:text-blue-900 truncate">
                                  {log.lead.raw_name}
                                </p>
                                <p className="text-3xs text-slate-500 font-mono flex items-center gap-1.5">
                                  <span>{formatDisplayPhone(log.lead.sanitized_phone)}</span>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5">
                                    <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                    {log.lead.city || "Casablanca"}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <span className="text-2xs text-blue-700 font-bold group-hover:translate-x-0.5 transition-transform shrink-0 flex items-center gap-0.5">
                              <span>Ouvrir</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        ) : (
                          <p className="text-3xs text-slate-400 pl-1 font-mono">
                            Candidat #{log.lead_id.slice(0, 8)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">
              {logs.length} action(s) trouvée(s)
            </span>
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
