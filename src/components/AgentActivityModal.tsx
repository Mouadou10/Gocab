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
  LayoutList,
  Table2,
  GraduationCap,
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
  leadsHandled?: number;
  statusChanged: number;
  trainingsFixed?: number;
  recallSet: number;
  whatsappSent: number;
  presenceConfirmed: number;
  notesAdded: number;
  callsInitiated?: number;
}

interface AgentActivitySummary {
  name: string;
  totalActions: number;
  leadsHandled: number;
  calls: number;
  trainingsFixed: number;
  statusChanges: number;
  recalls: number;
  presences: number;
  whatsapp: number;
  notes: number;
}

interface GroupedActivityEntry {
  groupId: string;
  lead_id: string;
  agent: string;
  created_at: string;
  lead?: LeadSummary | null;
  items: ActivityLogItem[];
}

interface AgentActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLead?: (lead: any) => void;
  currentUserName?: string;
  currentUserRole?: string;
}

type PeriodType = "today" | "yesterday" | "7days" | "30days" | "all";
type DisplayLayout = "cards" | "table";

const STATUS_FR_MAP: Record<string, { label: string; color: string }> = {
  "Not interested": {
    label: "🚫 Non intéressé",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
  "No response 1": {
    label: "📵 Pas de réponse 1 (NRP1)",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  "No response 2": {
    label: "📵 Pas de réponse 2 (NRP2)",
    color: "bg-orange-50 text-orange-800 border-orange-200",
  },
  "To Recall": {
    label: "⏰ À rappeler",
    color: "bg-amber-50 text-amber-800 border-amber-200",
  },
  "Training fixed": {
    label: "🎓 Formation fixée",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  Attended: {
    label: "✅ Présent en formation",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  Pending: {
    label: "⏳ En attente (Présent)",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "Assign vehicle": {
    label: "🚗 Prêt pour affectation",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  Preorder: {
    label: "📦 Précommande",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  Refused: {
    label: "❌ Refusé / Éliminé",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
  NEW_LEADS: {
    label: "🆕 Nouveau Lead",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
  BRAND_PRE_FILTER: {
    label: "📋 En Qualification (Leads)",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  TRAINING_PIPELINE: {
    label: "🎓 Pipeline Formation",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  ACTIVE_FLEET: {
    label: "🚖 Flotte Active",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

function getAgentBadgePalette(agentName: string) {
  const lower = (agentName || "").toLowerCase();
  if (lower.includes("kaoutar")) {
    return {
      bg: "bg-violet-50",
      text: "text-violet-800",
      border: "border-violet-200",
      avatar: "bg-violet-600 text-white",
      activePill: "bg-violet-600 text-white border-violet-600 shadow-xs",
    };
  }
  if (lower.includes("nour")) {
    return {
      bg: "bg-sky-50",
      text: "text-sky-800",
      border: "border-sky-200",
      avatar: "bg-sky-600 text-white",
      activePill: "bg-sky-600 text-white border-sky-600 shadow-xs",
    };
  }
  if (lower.includes("ayoub")) {
    return {
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-200",
      avatar: "bg-emerald-600 text-white",
      activePill: "bg-emerald-600 text-white border-emerald-600 shadow-xs",
    };
  }
  if (lower.includes("mehdi")) {
    return {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
      avatar: "bg-amber-600 text-white",
      activePill: "bg-amber-600 text-white border-amber-600 shadow-xs",
    };
  }
  return {
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-200",
    avatar: "bg-navy text-white",
    activePill: "bg-navy text-white border-navy shadow-xs",
  };
}

function getInitials(name: string) {
  const parts = (name || "Agent").trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || "AG").toUpperCase();
}

function formatHumanReadableDetail(action: string, detail: string | null) {
  if (!detail) return null;
  let cleaned = detail;

  // Replace raw English status codes with clean French labels
  Object.entries(STATUS_FR_MAP).forEach(([rawKey, meta]) => {
    if (cleaned.includes(rawKey)) {
      cleaned = cleaned.replace(rawKey, meta.label);
    }
  });

  if (action === "CALL_INITIATED") {
    return "Appel sortant effectué (+1 appel comptabilisé)";
  }

  return cleaned;
}

export default function AgentActivityModal({
  isOpen,
  onClose,
  onSelectLead,
  currentUserName = "Agent",
}: AgentActivityModalProps) {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    total: 0,
    leadsHandled: 0,
    statusChanged: 0,
    trainingsFixed: 0,
    recallSet: 0,
    whatsappSent: 0,
    presenceConfirmed: 0,
    notesAdded: 0,
    callsInitiated: 0,
  });
  const [agentSummaries, setAgentSummaries] = useState<AgentActivitySummary[]>([]);
  const [myCanonicalName, setMyCanonicalName] = useState<string>(currentUserName);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodType>("today");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  // Default to "MY" so every agent immediately sees their own personal history on open,
  // and can switch to "ALL" or any specific agent pill with 1 click.
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("MY");
  const [displayLayout, setDisplayLayout] = useState<DisplayLayout>("cards");

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("agent", selectedAgentFilter || "MY");

      const res = await fetch(`/api/activity?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.stats) setStats(data.stats);
        if (Array.isArray(data.agentSummaries)) {
          setAgentSummaries(data.agentSummaries);
        }
        if (data.myCanonicalName) {
          setMyCanonicalName(data.myCanonicalName);
        }
      }
    } catch (err) {
      console.error("Failed to fetch agent activity:", err);
    } finally {
      setIsLoading(false);
    }
  }, [period, actionFilter, searchQuery, selectedAgentFilter]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Smart Grouping:
  // Merge consecutive/simultaneous actions on the same lead by the same agent (within 3 minutes)
  // so 1 prospect interaction = 1 clean horizontal card instead of 3 stacked duplicate cards.
  const groupedByDay = useMemo(() => {
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    // First, merge logs by (day + lead_id + agent) within a 3-minute window
    const mergedEntries: GroupedActivityEntry[] = [];
    for (const log of logs) {
      const logTime = new Date(log.created_at).getTime();
      const logDateStr = new Date(log.created_at).toDateString();

      // Look for an existing entry on the same day, same lead_id, same agent within 3 minutes
      const existing = mergedEntries.find((entry) => {
        const entryDateStr = new Date(entry.created_at).toDateString();
        const entryTime = new Date(entry.created_at).getTime();
        return (
          entry.lead_id === log.lead_id &&
          entry.agent.toLowerCase() === log.agent.toLowerCase() &&
          entryDateStr === logDateStr &&
          Math.abs(entryTime - logTime) <= 3 * 60 * 1000
        );
      });

      if (existing) {
        // Avoid pushing exact duplicate action+detail
        const isDuplicate = existing.items.some(
          (i) => i.action === log.action && i.detail === log.detail
        );
        if (!isDuplicate) {
          existing.items.push(log);
        }
      } else {
        mergedEntries.push({
          groupId: log.id,
          lead_id: log.lead_id,
          agent: log.agent,
          created_at: log.created_at,
          lead: log.lead,
          items: [log],
        });
      }
    }

    // Group merged entries by calendar day
    const groups: { title: string; date: string; entries: GroupedActivityEntry[] }[] = [];
    const map = new Map<string, GroupedActivityEntry[]>();

    for (const entry of mergedEntries) {
      const dateStr = new Date(entry.created_at).toDateString();
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(entry);
    }

    map.forEach((entries, dateKey) => {
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
      groups.push({ title, date: dateKey, entries });
    });

    return groups;
  }, [logs]);

  if (!isOpen) return null;

  function renderActionBadge(item: ActivityLogItem, allItemsInGroup: ActivityLogItem[]) {
    const { action, detail } = item;

    // Hide redundant COLUMN_MOVED to BRAND_PRE_FILTER or TRAINING_PIPELINE if there is already a STATUS_CHANGED or TRAINING_STATUS_CHANGED in the same group
    if (action === "COLUMN_MOVED") {
      const hasSpecificStatus = allItemsInGroup.some(
        (other) =>
          other.action === "STATUS_CHANGED" ||
          other.action === "TRAINING_STATUS_CHANGED"
      );
      if (hasSpecificStatus) return null;
    }

    if (action === "STATUS_CHANGED" || action === "TRAINING_STATUS_CHANGED") {
      const rawValue = (detail || "")
        .replace(/^Statut\s*→\s*/i, "")
        .replace(/^Formation\s*→\s*/i, "")
        .trim();
      const mapped = STATUS_FR_MAP[rawValue];
      return (
        <span
          key={item.id}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
            mapped ? mapped.color : "bg-blue-50 text-blue-700 border-blue-200"
          }`}
        >
          <span>{mapped ? mapped.label : detail || "Statut modifié"}</span>
        </span>
      );
    }

    if (action === "CALL_INITIATED") {
      return (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-sky-50 text-sky-700 border-sky-200"
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Appel effectué (+1)</span>
        </span>
      );
    }

    if (action === "RECALL_SET") {
      return (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-amber-50 text-amber-800 border-amber-200"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{detail || "Rappel fixé"}</span>
        </span>
      );
    }

    if (action === "TRAINING_DATE_SET") {
      return (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-indigo-50 text-indigo-800 border-indigo-200"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{detail || "Date formation"}</span>
        </span>
      );
    }

    if (action === "PRESENCE_CONFIRMED") {
      return (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{detail || "Présence confirmée"}</span>
        </span>
      );
    }

    if (action === "WHATSAPP_SENT" || action === "WHATSAPP_OPENED") {
      return (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{detail || "WhatsApp envoyé"}</span>
        </span>
      );
    }

    if (action === "KYC_UPDATED") {
      return (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-violet-50 text-violet-700 border-violet-200"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{detail || "Documents KYC"}</span>
        </span>
      );
    }

    if (action === "CITY_SET") {
      return (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{detail || "Ville"}</span>
        </span>
      );
    }

    if (action === "NOTE_ADDED") {
      return null; // Rendered as a dedicated callout below badges
    }

    const humanDetail = formatHumanReadableDetail(action, detail);
    return (
      <span
        key={item.id}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-slate-100 text-slate-700 border-slate-200"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        <span>{humanDetail || action}</span>
      </span>
    );
  }

  function getRelativeTimeString(dateIso: string) {
    const date = new Date(dateIso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  function getLeadCurrentStatusBadge(lead?: LeadSummary | null) {
    if (!lead) return null;
    const rawKey =
      lead.board_column === "TRAINING_PIPELINE"
        ? lead.training_status || "TRAINING_PIPELINE"
        : lead.brand_status || lead.board_column;
    const mapped = rawKey ? STATUS_FR_MAP[rawKey] : null;
    if (!mapped) return null;
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${mapped.color}`}
      >
        {mapped.label}
      </span>
    );
  }

  const isViewingMyHistory =
    selectedAgentFilter === "MY" ||
    selectedAgentFilter.toLowerCase() === myCanonicalName.toLowerCase();

  const mySummary = agentSummaries.find(
    (s) => s.name.toLowerCase() === myCanonicalName.toLowerCase()
  );

  const totalTeamProspects = agentSummaries.reduce(
    (acc, s) => acc + s.leadsHandled,
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-navy/60 backdrop-blur-xs transition-opacity"
      />

      {/* Wider Slide-over Drawer Panel for effortless reading */}
      <div className="relative w-full max-w-4xl bg-slate-50 h-full shadow-2xl flex flex-col z-10 animate-slide-left">
        {/* Header with Dark Navy Aesthetic */}
        <div className="bg-gradient-to-r from-navy via-[#1b3455] to-[#0f223a] px-6 py-4 text-white flex items-center justify-between border-b border-white/10 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-xl border border-white/15 shadow-inner">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {isViewingMyHistory
                    ? `Mon Historique Personnel — ${myCanonicalName}`
                    : selectedAgentFilter === "ALL"
                    ? "Journal d'Activité de toute l'Équipe"
                    : `Historique de ${selectedAgentFilter}`}
                </h2>
                <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Synchronisé
                </span>
              </div>
              <p className="text-xs text-white/75 mt-0.5">
                {isViewingMyHistory
                  ? "Consultez vos prospects traités, appels, formations fixées et rappels"
                  : selectedAgentFilter === "ALL"
                  ? "Vue consolidée de tous les agents avec attribution claire sur chaque prospect"
                  : `Suivi détaillé des prospects traités et actions effectuées par ${selectedAgentFilter}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Display Mode Switcher (Cards vs Compact Table) */}
            <div className="hidden sm:flex items-center bg-white/10 p-1 rounded-xl border border-white/15 mr-1">
              <button
                type="button"
                onClick={() => setDisplayLayout("cards")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  displayLayout === "cards"
                    ? "bg-white text-navy shadow-xs"
                    : "text-white/80 hover:text-white"
                }`}
                title="Affichage en cartes groupées"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Cartes</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayLayout("table")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  displayLayout === "table"
                    ? "bg-white text-navy shadow-xs"
                    : "text-white/80 hover:text-white"
                }`}
                title="Affichage en tableau compact"
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Tableau</span>
              </button>
            </div>

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

        {/* Top Bar: Universal Agent Switcher (Mon Historique + Tous les Agents + Agent Pills) */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 space-y-3 shadow-2xs">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Sélection de l&apos;agent (Historique individuel ou Équipe)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Cliquez sur votre profil ou sur un agent pour filtrer
              </span>
            </div>

            {/* Interactive Agent Pills Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {/* 1. MON HISTORIQUE Button (Always first and prominent for every agent) */}
              <button
                type="button"
                onClick={() => setSelectedAgentFilter("MY")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                  isViewingMyHistory
                    ? "bg-navy text-white border-navy shadow-sm ring-2 ring-navy/15"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold ${
                    isViewingMyHistory
                      ? "bg-amber-400 text-navy"
                      : "bg-navy/10 text-navy"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span>Mon Historique</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isViewingMyHistory
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {mySummary ? `${mySummary.leadsHandled} prosp.` : "Moi"}
                    </span>
                  </div>
                </div>
              </button>

              {/* 2. VUE ÉQUIPE (ALL) Button */}
              <button
                type="button"
                onClick={() => setSelectedAgentFilter("ALL")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                  selectedAgentFilter === "ALL"
                    ? "bg-navy text-white border-navy shadow-sm ring-2 ring-navy/15"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold ${
                    selectedAgentFilter === "ALL"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span>Tous les agents</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      selectedAgentFilter === "ALL"
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {totalTeamProspects} prosp.
                  </span>
                </div>
              </button>

              <div className="h-6 w-px bg-slate-200 shrink-0 mx-0.5" />

              {/* 3. Individual Agent Pills with live counter */}
              {agentSummaries.map((ag) => {
                const palette = getAgentBadgePalette(ag.name);
                const isSelected =
                  selectedAgentFilter.toLowerCase() === ag.name.toLowerCase() ||
                  (selectedAgentFilter === "MY" &&
                    ag.name.toLowerCase() === myCanonicalName.toLowerCase());
                const isMe =
                  ag.name.toLowerCase() === myCanonicalName.toLowerCase();

                return (
                  <button
                    key={ag.name}
                    type="button"
                    onClick={() => setSelectedAgentFilter(isMe ? "MY" : ag.name)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? palette.activePill
                        : `${palette.bg} ${palette.text} ${palette.border} hover:opacity-90`
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${
                        isSelected ? "bg-white/20 text-white" : palette.avatar
                      }`}
                    >
                      {getInitials(ag.name)}
                    </span>
                    <div className="text-left leading-tight">
                      <div className="flex items-center gap-1">
                        <span>{ag.name}</span>
                        {isMe && (
                          <span
                            className={`text-[9px] uppercase px-1 rounded ${
                              isSelected
                                ? "bg-amber-400 text-navy font-extrabold"
                                : "bg-navy/10 text-navy font-bold"
                            }`}
                          >
                            Moi
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[10px] font-medium ${
                          isSelected ? "text-white/85" : "opacity-75"
                        }`}
                      >
                        {ag.leadsHandled} prospects • {ag.calls} appels
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* KPI Summary Strip for Current Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Prospects Traités
                </p>
                <p className="text-base font-extrabold text-navy font-mono">
                  {stats.leadsHandled ?? 0}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-navy/10 text-navy flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-sky-50/60 border border-sky-200/70 rounded-xl px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-sky-700/70">
                  Appels Effectués
                </p>
                <p className="text-base font-extrabold text-sky-800 font-mono">
                  {stats.callsInitiated ?? 0}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200/70 rounded-xl px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-indigo-700/70">
                  Formations Fixées
                </p>
                <p className="text-base font-extrabold text-indigo-800 font-mono">
                  {stats.trainingsFixed ?? 0}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-amber-800/70">
                  Rappels & Dates
                </p>
                <p className="text-base font-extrabold text-amber-800 font-mono">
                  {stats.recallSet ?? 0}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-xl px-3 py-2 flex items-center justify-between col-span-2 sm:col-span-1">
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-800/70">
                  Présences Validées
                </p>
                <p className="text-base font-extrabold text-emerald-800 font-mono">
                  {stats.presenceConfirmed ?? 0}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Search Bar & Period Selector Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un prospect par nom, téléphone, statut, note ou agent..."
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
                onClick={() => setPeriod("30days")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  period === "30days"
                    ? "bg-white text-navy shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                30 jours
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-2xs">
              <button
                type="button"
                onClick={() => setActionFilter("ALL")}
                className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer ${
                  actionFilter === "ALL"
                    ? "bg-navy text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Toutes les actions ({stats.total})
              </button>
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
                <span className="font-mono">({stats.callsInitiated ?? 0})</span>
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
                onClick={() => setActionFilter("RECALL_SET")}
                className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                  actionFilter === "RECALL_SET"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60"
                }`}
              >
                <span>⏰ Rappels & Dates</span>
                <span className="font-mono">({stats.recallSet})</span>
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("PRESENCE_CONFIRMED")}
                className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                  actionFilter === "PRESENCE_CONFIRMED"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
                }`}
              >
                <span>✅ Présences</span>
                <span className="font-mono">({stats.presenceConfirmed})</span>
              </button>
              <button
                type="button"
                onClick={() => setActionFilter("WHATSAPP")}
                className={`px-2.5 py-1 rounded-xl font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                  actionFilter === "WHATSAPP"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/60"
                }`}
              >
                <span>💬 WhatsApp</span>
                <span className="font-mono">({stats.whatsappSent})</span>
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
        </div>

        {/* Main Content: Smart Grouped Timeline OR Compact Table */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-navy/60" />
              <p className="text-xs font-semibold">
                Chargement de l&apos;historique d&apos;activité...
              </p>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">
                📭
              </div>
              <h3 className="text-sm font-bold text-slate-700">
                Aucune activité sur cette période
              </h3>
              <p className="text-xs max-w-md mx-auto text-slate-500">
                {searchQuery
                  ? `Aucun résultat pour "${searchQuery}". Essayez un autre mot-clé ou effacez la recherche.`
                  : isViewingMyHistory
                  ? "Vous n'avez pas encore d'actions enregistrées sur cette période. Changez la période (Hier, 7 jours, Tout) ou cliquez sur 'Tous les agents'."
                  : "Aucune action trouvée pour ce filtre. Essayez de sélectionner '7 jours' ou 'Tout'."}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {period === "today" && (
                  <button
                    type="button"
                    onClick={() => setPeriod("7days")}
                    className="px-3.5 py-1.5 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy/90 transition-colors cursor-pointer"
                  >
                    Voir les 7 derniers jours
                  </button>
                )}
                {selectedAgentFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSelectedAgentFilter("ALL")}
                    className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Voir toute l&apos;équipe
                  </button>
                )}
              </div>
            </div>
          ) : displayLayout === "table" ? (
            /* ── COMPACT TABLE VIEW ──────────────────────────────────────────── */
            <div className="space-y-6">
              {groupedByDay.map((group) => (
                <div key={group.date} className="space-y-2.5">
                  <div className="flex items-center gap-2 sticky top-0 bg-slate-50/95 backdrop-blur-xs py-1 z-5">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      {group.title}
                    </span>
                    <span className="text-2xs font-bold px-2 py-0.5 bg-navy/10 text-navy rounded-full font-mono">
                      {group.entries.length} prospect(s)
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-2.5 px-3.5 w-20">Heure</th>
                            <th className="py-2.5 px-3.5">Prospect</th>
                            <th className="py-2.5 px-3.5">Actions Effectuées</th>
                            <th className="py-2.5 px-3.5">Agent</th>
                            <th className="py-2.5 px-3.5 text-right">Fiche</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {group.entries.map((entry) => {
                            const when = new Date(entry.created_at);
                            const timeStr = when.toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            const agentPalette = getAgentBadgePalette(entry.agent);
                            const noteItems = entry.items.filter(
                              (i) => i.action === "NOTE_ADDED" && i.detail
                            );

                            return (
                              <tr
                                key={entry.groupId}
                                onClick={() => {
                                  if (entry.lead && onSelectLead) {
                                    onSelectLead(entry.lead);
                                    onClose();
                                  }
                                }}
                                className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                              >
                                <td className="py-2.5 px-3.5 font-mono text-xs font-bold text-slate-500 whitespace-nowrap">
                                  {timeStr}
                                </td>
                                <td className="py-2.5 px-3.5">
                                  {entry.lead ? (
                                    <div>
                                      <p className="font-bold text-slate-800">
                                        {entry.lead.raw_name}
                                      </p>
                                      <p className="text-[11px] text-slate-500 font-mono">
                                        {formatDisplayPhone(
                                          entry.lead.sanitized_phone
                                        )}{" "}
                                        • {entry.lead.city || "Casablanca"}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-mono">
                                      #{entry.lead_id.slice(0, 8)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {entry.items.map((it) =>
                                      renderActionBadge(it, entry.items)
                                    )}
                                  </div>
                                  {noteItems.map((n) => (
                                    <p
                                      key={n.id}
                                      className="mt-1 text-[11px] text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 italic"
                                    >
                                      {n.detail}
                                    </p>
                                  ))}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${agentPalette.bg} ${agentPalette.text} ${agentPalette.border}`}
                                  >
                                    <span
                                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${agentPalette.avatar}`}
                                    >
                                      {getInitials(entry.agent)}
                                    </span>
                                    <span>{entry.agent}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  {entry.lead && (
                                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-blue-600 hover:text-blue-800">
                                      <span>Ouvrir</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── SMART GROUPED CARDS VIEW (DEFAULT) ──────────────────────────── */
            groupedByDay.map((group) => (
              <div key={group.date} className="space-y-3">
                {/* Date Group Header */}
                <div className="flex items-center gap-2 sticky top-0 bg-slate-50/95 backdrop-blur-xs py-1 z-5">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    {group.title}
                  </span>
                  <span className="text-2xs font-bold px-2.5 py-0.5 bg-navy/10 text-navy rounded-full font-mono">
                    {group.entries.length} prospect(s) traité(s)
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Consolidated Prospect Interaction Cards */}
                <div className="space-y-2.5">
                  {group.entries.map((entry) => {
                    const when = new Date(entry.created_at);
                    const timeStr = when.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const relativeTime = getRelativeTimeString(entry.created_at);
                    const agentPalette = getAgentBadgePalette(entry.agent);
                    const noteItems = entry.items.filter(
                      (i) => i.action === "NOTE_ADDED" && i.detail
                    );

                    return (
                      <div
                        key={entry.groupId}
                        onClick={() => {
                          if (entry.lead && onSelectLead) {
                            onSelectLead(entry.lead);
                            onClose();
                          }
                        }}
                        className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Prospect Identity & Time */}
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            {/* Time Pill */}
                            <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 shrink-0 min-w-[60px]">
                              <span className="text-xs font-extrabold font-mono text-navy">
                                {timeStr}
                              </span>
                              <span className="text-[9px] font-semibold text-slate-500">
                                {relativeTime}
                              </span>
                            </div>

                            {/* Candidate Name, Phone, City */}
                            {entry.lead ? (
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                                    {entry.lead.raw_name}
                                  </p>
                                  {getLeadCurrentStatusBadge(entry.lead)}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5 flex-wrap">
                                  <span className="font-semibold text-slate-700">
                                    {formatDisplayPhone(
                                      entry.lead.sanitized_phone
                                    )}
                                  </span>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 font-sans text-slate-500">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {entry.lead.city || "Casablanca"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs font-mono text-slate-500">
                                Prospect #{entry.lead_id.slice(0, 8)}
                              </div>
                            )}
                          </div>

                          {/* Right: Clear Agent Attribution Badge & Open Action */}
                          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAgentFilter(
                                  entry.agent.toLowerCase() ===
                                    myCanonicalName.toLowerCase()
                                    ? "MY"
                                    : entry.agent
                                );
                              }}
                              title={`Filtrer l'historique de ${entry.agent}`}
                              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition-transform hover:scale-105 ${agentPalette.bg} ${agentPalette.text} ${agentPalette.border}`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${agentPalette.avatar}`}
                              >
                                {getInitials(entry.agent)}
                              </span>
                              <span>Traité par {entry.agent}</span>
                            </div>

                            {entry.lead && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 group-hover:bg-blue-600 text-slate-700 group-hover:text-white text-xs font-bold transition-colors">
                                <span>Fiche</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Consolidated Action Badges & Notes */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                            Actions :
                          </span>
                          {entry.items.map((it) =>
                            renderActionBadge(it, entry.items)
                          )}
                        </div>

                        {noteItems.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {noteItems.map((n) => (
                              <div
                                key={n.id}
                                className="p-2.5 bg-purple-50/70 border border-purple-200/70 rounded-xl text-xs text-purple-900 font-medium flex items-start gap-2"
                              >
                                <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                                <span>{n.detail}</span>
                              </div>
                            ))}
                          </div>
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
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-navy">
                {stats.leadsHandled ?? 0} prospect(s) traité(s)
              </span>
            </div>
            <span>•</span>
            <span className="font-medium text-slate-500">
              {logs.length} action(s) détaillée(s)
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
