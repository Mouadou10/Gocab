"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { useLiveSync } from "@/context/LiveSyncContext";
import { MoroccanPlateBadge } from "./FieldSupervisorView";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldAlert,
  User,
  Plus,
  Search,
  Filter,
  Trash2,
  Check,
  X,
  Phone,
  ArrowRight,
  RefreshCw,
  Send,
  MessageSquare,
  Car,
  Tag,
  AlertCircle,
  FileText,
  Radio,
  SlidersHorizontal,
} from "lucide-react";

export interface VehicleIssueItem {
  id: string;
  vehicle_id: string | null;
  plate_number: string;
  driver_name: string | null;
  driver_phone: string | null;
  category: string;
  title: string;
  description: string;
  priority: string;
  status: string; // PENDING, IN_PROGRESS, SOLVED, TRANSFERRED
  reported_by_name: string;
  reported_by_role: string | null;
  reported_by_email: string | null;
  assigned_to_name: string | null;
  assigned_to_id: string | null;
  assigned_at: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  linked_ticket_id: string | null;
  linked_ticket_type: string | null;
  field_task_id: string | null;
  telegram_alert_sent: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { id: "MECANIQUE", label: "🔧 Mécanique / Panne", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "BRUIT_VOYANT", label: "⚠️ Bruit suspect / Voyant", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { id: "ACCIDENT", label: "💥 Accident / Dégât", color: "bg-red-100 text-red-800 border-red-200" },
  { id: "PNEU", label: "🛞 Pneu / Crevaison", color: "bg-slate-100 text-slate-800 border-slate-300" },
  { id: "TELEMATIQUE", label: "📡 Balise GPS / Télématique", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "PAPIERS", label: "📄 Papiers / Police / Fourrière", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "CHAUFFEUR", label: "👤 Incident / Retard Chauffeur", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "AUTRE", label: "📝 Autre Remarque", color: "bg-gray-100 text-gray-800 border-gray-200" },
];

const PRIORITIES = [
  { id: "Normal", label: "Normale", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "Urgent", label: "Urgente ⚡", badge: "bg-amber-100 text-amber-800 border-amber-300" },
  { id: "Critical", label: "Critique 🚨", badge: "bg-red-100 text-red-800 border-red-300 animate-pulse" },
];

export default function SharedVehicleHubView() {
  const { data: session } = useSession() || {};
  const userRole = session?.user?.role || "ADMIN";
  const userName = session?.user?.name || "Agent";

  // Access check: only Fleet Performance (or Admin/Ops) can assign the ticket to themselves
  const isFleetPerformance =
    userRole === "FLEET_PERF_MANAGER" || userRole === "ADMIN" || userRole === "OPS_MANAGER";

  const [issues, setIssues] = useState<VehicleIssueItem[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "SOLVED">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newCategory, setNewCategory] = useState("MECANIQUE");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("Normal");
  const [notifyTelegramOnCreate, setNotifyTelegramOnCreate] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Vehicle Autocomplete Dropdown State
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const plateDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to dismiss plate autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (plateDropdownRef.current && !plateDropdownRef.current.contains(event.target as Node)) {
        setIsPlateDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Solve Modal State
  const [solvingIssue, setSolvingIssue] = useState<VehicleIssueItem | null>(null);
  const [solveNotes, setSolveNotes] = useState("");
  const [isSubmittingSolve, setIsSubmittingSolve] = useState(false);

  // Transform to Support Ticket Modal State
  const [transformingIssue, setTransformingIssue] = useState<VehicleIssueItem | null>(null);
  const [transformTicketType, setTransformTicketType] = useState("Repair");
  const [transformGarageName, setTransformGarageName] = useState("Hard Auto Services");
  const [transformTelegramCheckbox, setTransformTelegramCheckbox] = useState(false);
  const [isSubmittingTransform, setIsSubmittingTransform] = useState(false);

  // Direct Telegram Transfer Modal State
  const [transferringIssue, setTransferringIssue] = useState<VehicleIssueItem | null>(null);
  const [transferTaskType, setTransferTaskType] = useState<"FIELD_VISIT" | "VEHICLE_RECOVERY" | "GARAGE_PICKUP">("FIELD_VISIT");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/vehicle-issues");
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
      }
    } catch (err) {
      console.error("Failed to load vehicle issues:", err);
      toast.error("Erreur de chargement du journal des véhicules");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
      }
    } catch (e) {
      console.error("Failed to fetch vehicles list:", e);
    }
  }, []);

  // Live Sync hook for real-time ticket/issue updates
  const { notifyMutation } = useLiveSync("tickets", fetchIssues);

  useEffect(() => {
    fetchIssues();
    fetchVehicles();
  }, [fetchIssues, fetchVehicles]);

  // Autocomplete vehicle suggestions based on immat search
  const plateSuggestions = useMemo(() => {
    const q = newPlate.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!q) return vehicles.slice(0, 6);
    return vehicles
      .filter((v) => {
        const pClean = (v.plate_number || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const dName = (v.assigned_driver_name || v.driverProfile?.fullName || "").toLowerCase();
        const model = (v.make_model || "").toLowerCase();
        return pClean.includes(q) || dName.includes(newPlate.toLowerCase()) || model.includes(newPlate.toLowerCase());
      })
      .slice(0, 8);
  }, [vehicles, newPlate]);

  const handleSelectVehicleSuggestion = (v: any) => {
    setNewPlate(v.plate_number || "");
    const dName = v.assigned_driver_name || v.driverProfile?.fullName || "";
    const dPhone = v.assigned_driver_phone || v.driverProfile?.phoneSanitized || "";
    if (dName) setNewDriverName(dName);
    if (dPhone) setNewDriverPhone(dPhone);
    setIsPlateDropdownOpen(false);
  };

  // Submit Create Issue
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim() || !newTitle.trim() || !newDescription.trim()) {
      toast.error("Veuillez renseigner le matricule, le titre et la description.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await fetch("/api/vehicle-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate_number: newPlate.trim(),
          driver_name: newDriverName.trim() || null,
          driver_phone: newDriverPhone.trim() || null,
          category: newCategory,
          title: newTitle.trim(),
          description: newDescription.trim(),
          priority: newPriority,
          reported_by_name: userName,
          reported_by_role: userRole,
          reported_by_email: session?.user?.email || null,
          transfer_field_supervisor: notifyTelegramOnCreate,
          notify_telegram: notifyTelegramOnCreate,
        }),
      });

      if (res.ok) {
        toast.success(
          notifyTelegramOnCreate
            ? "✅ Événement enregistré & mission envoyée sur Telegram !"
            : "✅ Événement ajouté au journal partagé !"
        );
        setIsCreateModalOpen(false);
        // Reset form
        setNewPlate("");
        setNewDriverName("");
        setNewDriverPhone("");
        setNewTitle("");
        setNewDescription("");
        setNewPriority("Normal");
        setNotifyTelegramOnCreate(false);
        notifyMutation("tickets");
        fetchIssues();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Échec de l'enregistrement");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Action: Fleet Performance assigns to themselves
  const handleAssignToMe = async (issue: VehicleIssueItem) => {
    if (!isFleetPerformance) {
      toast.error("Seuls les agents Fleet Performance peuvent prendre en charge un ticket.");
      return;
    }

    try {
      const res = await fetch(`/api/vehicle-issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSIGN",
          assigned_to_name: userName,
          assigned_to_id: (session?.user as any)?.id || null,
        }),
      });

      if (res.ok) {
        toast.success(`👍 Pris en charge par ${userName} !`);
        notifyMutation("tickets");
        fetchIssues();
      } else {
        toast.error("Échec de l'assignation");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  // Action: Mark as Solved
  const handleConfirmSolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solvingIssue) return;

    setIsSubmittingSolve(true);
    try {
      const res = await fetch(`/api/vehicle-issues/${solvingIssue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SOLVE",
          resolved_by_name: userName,
          resolution_notes: solveNotes.trim() || null,
          sync_maintenance_ticket: true,
        }),
      });

      if (res.ok) {
        toast.success("✅ Problème marqué comme résolu avec succès !");
        setSolvingIssue(null);
        setSolveNotes("");
        notifyMutation("tickets");
        fetchIssues();
      } else {
        toast.error("Échec de la clôture");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmittingSolve(false);
    }
  };

  // Action: Transform to Support Ticket
  const handleConfirmTransform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transformingIssue) return;

    setIsSubmittingTransform(true);
    try {
      const res = await fetch(`/api/vehicle-issues/${transformingIssue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRANSFORM_SUPPORT_TICKET",
          ticket_type: transformTicketType,
          garage_name: transformGarageName.trim() || null,
          transfer_field_supervisor: transformTelegramCheckbox,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(
          transformTelegramCheckbox
            ? "🔄 Ticket Support créé & alerte Telegram envoyée au Superviseur Terrain !"
            : "🔄 Ticket Support créé avec succès !"
        );
        setTransformingIssue(null);
        setTransformTelegramCheckbox(false);
        notifyMutation("tickets");
        fetchIssues();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Échec de la transformation");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmittingTransform(false);
    }
  };

  // Action: Direct Transfer to Field Supervisor via Telegram
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringIssue) return;

    setIsSubmittingTransfer(true);
    try {
      const res = await fetch(`/api/vehicle-issues/${transferringIssue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "TRANSFER_FIELD_SUPERVISOR",
          task_type: transferTaskType,
        }),
      });

      if (res.ok) {
        toast.success("🚀 Mission transmise au Superviseur Terrain & notifiée sur Telegram !");
        setTransferringIssue(null);
        notifyMutation("tickets");
        fetchIssues();
      } else {
        toast.error("Échec du transfert");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Delete issue
  const handleDeleteIssue = async (id: string) => {
    if (!confirm("Supprimer ce signalement du journal ?")) return;
    try {
      const res = await fetch(`/api/vehicle-issues/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Signalement supprimé");
        notifyMutation("tickets");
        fetchIssues();
      } else {
        toast.error("Échec de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((item) => {
      // Status
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      // Category
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      // Priority
      if (priorityFilter !== "ALL" && item.priority !== priorityFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const p = (item.plate_number || "").toLowerCase();
        const d = (item.driver_name || "").toLowerCase();
        const t = (item.title || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const by = (item.reported_by_name || "").toLowerCase();
        const to = (item.assigned_to_name || "").toLowerCase();
        if (!p.includes(q) && !d.includes(q) && !t.includes(q) && !desc.includes(q) && !by.includes(q) && !to.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [issues, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = issues.length;
    const pending = issues.filter((i) => i.status === "PENDING").length;
    const inProgress = issues.filter((i) => i.status === "IN_PROGRESS").length;
    const solved = issues.filter((i) => i.status === "SOLVED").length;
    const telegramCount = issues.filter((i) => i.telegram_alert_sent).length;
    return { total, pending, inProgress, solved, telegramCount };
  }, [issues]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-navy to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-blue-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl sm:text-3xl">🚘</span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                Journal Flotte & Opérations Partagé
              </h1>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-2xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
                Accès Tous Agents
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Espace central où chaque agent (Acquisition, Flotte, Terrain, Finance) peut signaler un incident ou une remarque sur un véhicule.
              La prise en charge est assurée par l&apos;équipe <strong>Fleet Performance</strong> avec escalade directe vers les <strong>Tickets Support</strong> et le <strong>Superviseur Terrain (Telegram)</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg hover:shadow-xl transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Signaler un Problème / Événement</span>
          </button>
        </div>

        {/* Quick Metric KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/5">
            <span className="text-3xs text-slate-400 font-bold block uppercase tracking-wider">Total Signalements</span>
            <span className="text-lg font-black text-white">{metrics.total}</span>
          </div>
          <div className="bg-amber-500/10 backdrop-blur-xs rounded-xl p-3 border border-amber-500/20">
            <span className="text-3xs text-amber-300 font-bold block uppercase tracking-wider">À Prendre en Charge</span>
            <span className="text-lg font-black text-amber-400">{metrics.pending}</span>
          </div>
          <div className="bg-blue-500/10 backdrop-blur-xs rounded-xl p-3 border border-blue-500/20">
            <span className="text-3xs text-blue-300 font-bold block uppercase tracking-wider">En Traitement Fleet</span>
            <span className="text-lg font-black text-blue-400">{metrics.inProgress}</span>
          </div>
          <div className="bg-emerald-500/10 backdrop-blur-xs rounded-xl p-3 border border-emerald-500/20">
            <span className="text-3xs text-emerald-300 font-bold block uppercase tracking-wider">Problèmes Résolus</span>
            <span className="text-lg font-black text-emerald-400">{metrics.solved}</span>
          </div>
          <div className="bg-purple-500/10 backdrop-blur-xs rounded-xl p-3 border border-purple-500/20 col-span-2 sm:col-span-1">
            <span className="text-3xs text-purple-300 font-bold block uppercase tracking-wider">Missions Telegram</span>
            <span className="text-lg font-black text-purple-400">📱 {metrics.telegramCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par immat, chauffeur, auteur, mot-clé..."
              className="w-full pl-9 pr-7 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-2xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Tous ({metrics.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "PENDING"
                  ? "bg-amber-500 text-white shadow-2xs font-black"
                  : "text-amber-700 dark:text-amber-400 hover:bg-amber-100/50"
              }`}
            >
              À Assigner ({metrics.pending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("IN_PROGRESS")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "IN_PROGRESS"
                  ? "bg-blue-600 text-white shadow-2xs font-black"
                  : "text-blue-700 dark:text-blue-400 hover:bg-blue-100/50"
              }`}
            >
              En Traitement ({metrics.inProgress})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("SOLVED")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === "SOLVED"
                  ? "bg-emerald-600 text-white shadow-2xs font-black"
                  : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50"
              }`}
            >
              Résolus ({metrics.solved})
            </button>
          </div>
        </div>

        {/* Category & Priority Selectors */}
        <div className="flex items-center gap-2 text-xs">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Toutes Catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Toutes Priorités</option>
            <option value="Normal">Normale</option>
            <option value="Urgent">Urgente ⚡</option>
            <option value="Critical">Critique 🚨</option>
          </select>

          <button
            type="button"
            onClick={fetchIssues}
            title="Rafraîchir"
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Issue Feed List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-xs font-semibold">Chargement des signalements véhicules...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-700">
          <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
            Aucun événement pour ces filtres
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Tous les véhicules sont en ordre ou aucun signalement ne correspond à votre recherche.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
          >
            + Signaler un événement maintenant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIssues.map((issue) => {
            const cat = CATEGORIES.find((c) => c.id === issue.category) || CATEGORIES[0];
            const isAssigned = Boolean(issue.assigned_to_name);
            const isAssignedToMe = issue.assigned_to_name === userName;
            const isSolved = issue.status === "SOLVED";

            return (
              <div
                key={issue.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  isSolved
                    ? "border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/20"
                    : issue.priority === "Critical"
                    ? "border-red-300 dark:border-red-900/60 ring-1 ring-red-400/40"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {/* Card Header Strip */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <MoroccanPlateBadge plate={issue.plate_number} />
                    
                    <div className="flex items-center gap-1.5">
                      {/* Priority */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          issue.priority === "Critical"
                            ? "bg-red-100 text-red-800 border-red-300 font-black"
                            : issue.priority === "Urgent"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {issue.priority === "Critical" ? "🚨 Critique" : issue.priority === "Urgent" ? "⚡ Urgent" : "Normal"}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSolved
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : isAssigned
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {isSolved ? "✅ Résolu" : isAssigned ? "⚡ En cours" : "⏳ En attente"}
                      </span>
                    </div>
                  </div>

                  {/* Driver Info */}
                  {issue.driver_name && (
                    <div className="flex items-center gap-2 text-2xs text-slate-600 dark:text-slate-400 font-semibold pt-0.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{issue.driver_name}</span>
                      {issue.driver_phone && (
                        <a
                          href={`tel:${issue.driver_phone}`}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-2.5 h-2.5" />
                          <span>{issue.driver_phone}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Category Pill */}
                  <div className="pt-1">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${cat.color}`}>
                      {cat.label}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 space-y-2">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                    {issue.title}
                  </h4>
                  <p className="text-2xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {issue.description}
                  </p>

                  {/* Resolution Notes if Solved */}
                  {isSolved && issue.resolution_notes && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 text-2xs text-emerald-900 dark:text-emerald-200 mt-2">
                      <span className="font-bold block mb-0.5">💡 Solution appliquée :</span>
                      <span>{issue.resolution_notes}</span>
                      {issue.resolved_by_name && (
                        <span className="block text-3xs text-emerald-600 dark:text-emerald-400 mt-1 italic">
                          Par {issue.resolved_by_name} le {new Date(issue.resolved_at || issue.updated_at).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Badges strip: Linked Support Ticket or Telegram Task */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {issue.linked_ticket_id && (
                      <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-md text-3xs font-bold">
                        <FileText className="w-3 h-3" />
                        <span>Ticket Support : {issue.linked_ticket_type || "Actif"}</span>
                      </span>
                    )}

                    {issue.telegram_alert_sent && (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md text-3xs font-bold">
                        <Send className="w-3 h-3 text-blue-500" />
                        <span>Mission Terrain (Telegram Envoyé)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Assignment & Reporter Footer */}
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-3xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>
                      Signalé par : <strong>{issue.reported_by_name}</strong>
                    </span>
                    <span>
                      {new Date(issue.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Assignment Status */}
                  <div className="flex items-center justify-between pt-0.5">
                    {isAssigned ? (
                      <span className="text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1">
                        <span>👀 Pris en charge par :</span>
                        <strong className="underline">{issue.assigned_to_name}</strong>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        ⏳ En attente de Fleet Performance
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons Bar */}
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
                  {/* 1. Take ownership (Fleet Performance only) */}
                  {!isSolved && !isAssigned && (
                    isFleetPerformance ? (
                      <button
                        type="button"
                        onClick={() => handleAssignToMe(issue)}
                        className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <User className="w-3 h-3" />
                        <span>Prendre en charge</span>
                      </button>
                    ) : (
                      <div className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl font-semibold text-3xs text-center cursor-not-allowed">
                        🔒 Réservé à Fleet Performance
                      </div>
                    )
                  )}

                  {/* Re-assign if already assigned and user is Fleet Performance */}
                  {!isSolved && isAssigned && !isAssignedToMe && isFleetPerformance && (
                    <button
                      type="button"
                      onClick={() => handleAssignToMe(issue)}
                      className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-3xs transition-colors"
                      title="Reprendre l'assignation sur moi"
                    >
                      M&apos;assigner
                    </button>
                  )}

                  {/* 2. Mark Solved Button */}
                  {!isSolved && (isAssignedToMe || isFleetPerformance) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSolvingIssue(issue);
                        setSolveNotes("");
                      }}
                      className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Résolu</span>
                    </button>
                  )}

                  {/* 3. Transform to Support Ticket */}
                  {!issue.linked_ticket_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setTransformingIssue(issue);
                        setTransformTicketType(
                          issue.category === "ACCIDENT"
                            ? "Accident"
                            : issue.category === "MECANIQUE"
                            ? "Repair"
                            : "Repair"
                        );
                        setTransformTelegramCheckbox(false);
                      }}
                      className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 rounded-xl font-bold text-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Créer un ticket support formel"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Ticket Support</span>
                    </button>
                  )}

                  {/* 4. Direct Transfer to Field Supervisor & Telegram */}
                  {!issue.telegram_alert_sent && (
                    <button
                      type="button"
                      onClick={() => {
                        setTransferringIssue(issue);
                        setTransferTaskType(
                          issue.category === "ACCIDENT" ? "GARAGE_PICKUP" : "FIELD_VISIT"
                        );
                      }}
                      className="py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-800 rounded-xl font-bold text-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Envoyer une mission au superviseur terrain avec alerte Telegram"
                    >
                      <Send className="w-3 h-3" />
                      <span>Terrain (Telegram)</span>
                    </button>
                  )}

                  {/* Delete button (Admin or author) */}
                  {(userRole === "ADMIN" || issue.reported_by_name === userName) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteIssue(issue.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer ml-auto"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: SIGNALE UN NOUVEL ÉVÉNEMENT VÉHICULE                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
            <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-black flex items-center gap-2">
                  <span>🚘</span>
                  <span>Signaler un Événement / Problème Véhicule</span>
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  Partagé avec toute l&apos;équipe GoCab. Traité par Fleet Performance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsPlateDropdownOpen(false);
                }}
                className="text-white/80 hover:text-white text-xl p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
              {/* Vehicle Plate with Dropdown Autocomplete */}
              <div ref={plateDropdownRef} className="relative">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Immatriculation (Matricule Véhicule) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Tapez le matricule (ex: 21527-Y-6 ou WW...)"
                  value={newPlate}
                  onFocus={() => setIsPlateDropdownOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setIsPlateDropdownOpen(false), 200);
                  }}
                  onChange={(e) => {
                    setNewPlate(e.target.value);
                    setIsPlateDropdownOpen(true);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {isPlateDropdownOpen && plateSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {plateSuggestions.map((v) => (
                      <div
                        key={v.id}
                        onMouseDown={() => handleSelectVehicleSuggestion(v)}
                        className="p-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-2xs bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                            {v.plate_number}
                          </span>
                          <span className="text-2xs text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                            {v.make_model}
                          </span>
                        </div>
                        <span className="text-3xs font-semibold text-slate-500">
                          {v.assigned_driver_name || "Sans chauffeur"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Driver Name & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nom du Chauffeur
                  </label>
                  <input
                    type="text"
                    placeholder="Nom complet"
                    value={newDriverName}
                    onFocus={() => setIsPlateDropdownOpen(false)}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone Chauffeur
                  </label>
                  <input
                    type="text"
                    placeholder="06XXXXXXXX"
                    value={newDriverPhone}
                    onFocus={() => setIsPlateDropdownOpen(false)}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Catégorie *
                  </label>
                  <select
                    value={newCategory}
                    onFocus={() => setIsPlateDropdownOpen(false)}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priorité *
                  </label>
                  <select
                    value={newPriority}
                    onFocus={() => setIsPlateDropdownOpen(false)}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Titre du problème (Court et précis) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Voyant moteur allumé sur autoroute / Bruit frein avant droit"
                  value={newTitle}
                  onFocus={() => setIsPlateDropdownOpen(false)}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Détails & Constatations du problème *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Expliquez ce qui s'est passé, les symptômes constatés, les démarches déjà entreprises, la localisation..."
                  value={newDescription}
                  onFocus={() => setIsPlateDropdownOpen(false)}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Telegram Checkbox */}
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="notifyTelegram"
                  checked={notifyTelegramOnCreate}
                  onChange={(e) => setNotifyTelegramOnCreate(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="notifyTelegram" className="cursor-pointer">
                  <span className="font-bold text-blue-900 dark:text-blue-200 block">
                    🚨 Créer une mission terrain & alerter le Superviseur sur Telegram
                  </span>
                  <span className="text-3xs text-blue-700 dark:text-blue-400 block mt-0.5">
                    Envoie immédiatement un message formaté dans le groupe Telegram terrain pour intervention physique.
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsPlateDropdownOpen(false);
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCreate ? "Enregistrement..." : "Enregistrer dans le Journal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: CLÔTURE DE PROBLÈME (SOLVE)                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {solvingIssue && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-emerald-200 dark:border-emerald-900 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <span>✅</span>
                  <span>Clôturer le Problème</span>
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Véhicule : <strong>{solvingIssue.plate_number}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSolvingIssue(null)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSolve} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Explication de la résolution (Comment le problème a été réglé) :
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Véhicule déposé chez Hard Auto, capteur remplacé, niveau d'huile refait, chauffeur a repris la route."
                  value={solveNotes}
                  onChange={(e) => setSolveNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSolvingIssue(null)}
                  className="px-4 py-2 text-slate-600 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSolve}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSolve ? "Clôture en cours..." : "Valider la Résolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: TRANSFORMER EN TICKET SUPPORT                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {transformingIssue && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-purple-200 dark:border-purple-900 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <span>🔄</span>
                  <span>Transformer en Ticket Support</span>
                </h3>
                <p className="text-xs text-purple-100 mt-0.5">
                  Véhicule : <strong>{transformingIssue.plate_number}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransformingIssue(null)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmTransform} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Type de Ticket Support *
                </label>
                <select
                  value={transformTicketType}
                  onChange={(e) => setTransformTicketType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                >
                  <option value="Repair">🔧 Réparation / Garage</option>
                  <option value="Vidange">🛢️ Vidange</option>
                  <option value="AdBleu">💧 AdBlue</option>
                  <option value="Accident">💥 Accident (Sinistre)</option>
                  <option value="VEHICLE_RECOVERY">🚨 Récupération Véhicule (Bloqué)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Garage / Fournisseur assigné :
                </label>
                <input
                  type="text"
                  value={transformGarageName}
                  onChange={(e) => setTransformGarageName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                />
              </div>

              {/* Telegram Checkbox */}
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="telegramCheckTransform"
                  checked={transformTelegramCheckbox}
                  onChange={(e) => setTransformTelegramCheckbox(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="telegramCheckTransform" className="cursor-pointer">
                  <span className="font-bold text-purple-950 dark:text-purple-200 block">
                    Créer aussi une mission terrain & envoyer sur Telegram
                  </span>
                  <span className="text-3xs text-purple-700 dark:text-purple-400 block">
                    Génère la tâche pour le superviseur terrain et publie l&apos;alerte instantanée sur le bot Telegram.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransformingIssue(null)}
                  className="px-4 py-2 text-slate-600 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransform}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTransform ? "Création..." : "Créer le Ticket Support"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 4: TRANSFERT DIRECT AU SUPERVISEUR TERRAIN & TELEGRAM    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {transferringIssue && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-red-200 dark:border-red-900 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <span>📱</span>
                  <span>Transférer au Superviseur Terrain (Telegram)</span>
                </h3>
                <p className="text-xs text-red-100 mt-0.5">
                  Véhicule : <strong>{transferringIssue.plate_number}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferringIssue(null)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Type d&apos;intervention terrain :
                </label>
                <select
                  value={transferTaskType}
                  onChange={(e) => setTransferTaskType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold cursor-pointer"
                >
                  <option value="FIELD_VISIT">🚗 Visite / Constat / Réparation Terrain</option>
                  <option value="VEHICLE_RECOVERY">🚨 Récupération Véhicule (Fourrière / Bloqué)</option>
                  <option value="GARAGE_PICKUP">🔧 Reprise Garage (Véhicule réparé)</option>
                </select>
              </div>

              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900 text-2xs text-red-900 dark:text-red-200">
                <span className="font-bold block mb-1">📢 Action immédiate :</span>
                <span>
                  Cette action crée une tâche dans la file et le calendrier du <strong>Superviseur Terrain</strong>, et publie instantanément une alerte d&apos;intervention dans le <strong>groupe Telegram</strong>.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferringIssue(null)}
                  className="px-4 py-2 text-slate-600 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTransfer ? "Envoi..." : "Confirmer & Envoyer l'Alerte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
