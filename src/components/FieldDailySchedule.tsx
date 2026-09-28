"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Play,
  CheckCircle2,
  Trash2,
  Phone,
  MessageSquare,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Car,
  Wrench,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Search,
  X,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import { MoroccanPlateBadge, FieldTask } from "./FieldSupervisorView";

export interface FieldSupervisorInfo {
  id: string;
  name: string;
  fullName: string;
  email: string;
  role: string;
  region?: string;
  scheduled_tasks_count?: number;
  total_scheduled_hours?: number;
  is_full?: boolean;
  available_hours?: number;
  occupied_slots?: string[];
  suggested_date?: string;
  suggested_time?: string;
}

interface FieldDailyScheduleProps {
  tasks: FieldTask[];
  onTaskUpdated: () => void;
  onOpenRecoveryModal: (task: FieldTask) => void;
  onOpenInspectionModal?: (vehicleId: string, plate: string) => void;
}

const WORKING_HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

const DURATION_PRESETS = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0];

function getWhatsAppLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) clean = "212" + clean.slice(1);
  else if (!clean.startsWith("212")) clean = "212" + clean;
  return `https://wa.me/${clean}`;
}

function computeEndTime(startTime: string, durationHours: number): string {
  const [hStr, mStr] = startTime.split(":");
  let totalMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + Math.round(durationHours * 60);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
}

export default function FieldDailySchedule({
  tasks,
  onTaskUpdated,
  onOpenRecoveryModal,
  onOpenInspectionModal,
}: FieldDailyScheduleProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [supervisors, setSupervisors] = useState<FieldSupervisorInfo[]>([]);
  const [isLoadingSupervisors, setIsLoadingSupervisors] = useState(false);

  // Slot Quick-Assign Modal state
  const [assigningSlotTime, setAssigningSlotTime] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Create Task Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSlotTime, setCreateSlotTime] = useState<string>("09:00");
  const [createTaskType, setCreateTaskType] = useState<string>("VEHICLE_RECOVERY");
  const [createPlate, setCreatePlate] = useState<string>("");
  const [createDriver, setCreateDriver] = useState<string>("");
  const [createPhone, setCreatePhone] = useState<string>("");
  const [createDesc, setCreateDesc] = useState<string>("");
  const [createPriority, setCreatePriority] = useState<string>("Urgent");
  const [createDuration, setCreateDuration] = useState<number>(1.0);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Pool search filter
  const [poolSearch, setPoolSearch] = useState("");

  // In-card delete confirmation state (task ID being confirmed for deletion)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // 1. Fetch supervisors and their workloads whenever selectedDate changes
  const fetchSupervisors = useCallback(async () => {
    setIsLoadingSupervisors(true);
    try {
      const res = await fetch(`/api/field-supervisors?date=${selectedDate}`);
      const data = await res.json();
      const sups: FieldSupervisorInfo[] = (data.supervisors || []).filter(
        (s: FieldSupervisorInfo) => s.role === "FIELD_SUPERVISOR" || s.role === "SENIOR_FIELD_SUPERVISOR"
      );
      setSupervisors(sups);

      // Default select first supervisor if none selected or if currently selected is not in the list
      if ((!selectedAgentId || !sups.some((s) => s.id === selectedAgentId)) && sups.length > 0) {
        setSelectedAgentId(sups[0].id);
      }
    } catch (err) {
      console.error("Failed to load supervisors:", err);
    } finally {
      setIsLoadingSupervisors(false);
    }
  }, [selectedDate, selectedAgentId]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  // Current active supervisor object
  const currentSupervisor = useMemo(() => {
    return supervisors.find((s) => s.id === selectedAgentId || s.name === selectedAgentId) || supervisors[0] || null;
  }, [supervisors, selectedAgentId]);

  // 2. Identify Tasks: Scheduled for this Agent on this Date vs Unscheduled Pool
  const { scheduledTasksMap, spanningSlotsMap, poolTasks, agentTotalHours, agentIsFull } = useMemo(() => {
    const scheduledMap: Record<string, FieldTask> = {};
    const spanMap: Record<string, { parentTime: string; task: FieldTask }> = {};
    const pool: FieldTask[] = [];

    const activeAgentKey = currentSupervisor ? currentSupervisor.name : selectedAgentId;
    const activeAgentId = currentSupervisor ? currentSupervisor.id : selectedAgentId;

    tasks.forEach((task) => {
      // Exclude completed or failed from the backlog pool
      const isArchived = task.status === "COMPLETED" || task.status === "FAILED";

      // Match agent: either matches this agent or unassigned
      const isAssignedToThisAgent =
        task.assigned_to === activeAgentId ||
        task.assigned_to === activeAgentKey ||
        (task.assigned_to && currentSupervisor?.fullName && task.assigned_to === currentSupervisor.fullName);

      if (task.scheduled_date === selectedDate && isAssignedToThisAgent && task.scheduled_time) {
        scheduledMap[task.scheduled_time] = task;

        // If duration > 1h, calculate spanned subsequent slots
        const dur = task.duration_hours && task.duration_hours > 0 ? task.duration_hours : 1.0;
        if (dur > 1.0) {
          const startH = parseInt(task.scheduled_time.split(":")[0], 10);
          for (let i = 1; i < Math.ceil(dur); i++) {
            const nextSlot = `${(startH + i).toString().padStart(2, "0")}:00`;
            spanMap[nextSlot] = { parentTime: task.scheduled_time, task };
          }
        }
      } else if (!task.scheduled_date || !task.scheduled_time) {
        if (!isArchived) {
          pool.push(task);
        }
      }
    });

    // Compute total hours booked for this agent on this date
    const totalHrs = Object.values(scheduledMap).reduce((sum, t) => {
      return sum + (t.duration_hours && t.duration_hours > 0 ? t.duration_hours : 1.0);
    }, 0);

    return {
      scheduledTasksMap: scheduledMap,
      spanningSlotsMap: spanMap,
      poolTasks: pool,
      agentTotalHours: Number(totalHrs.toFixed(1)),
      agentIsFull: totalHrs >= 8.0,
    };
  }, [tasks, selectedDate, currentSupervisor, selectedAgentId]);

  // Filter pool tasks by search
  const filteredPoolTasks = useMemo(() => {
    if (!poolSearch.trim()) return poolTasks;
    const q = poolSearch.toLowerCase();
    return poolTasks.filter(
      (t) =>
        t.plate_number?.toLowerCase().includes(q) ||
        t.driver_name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
    );
  }, [poolTasks, poolSearch]);

  // Date Navigation handlers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  // Schedule task into a slot
  const handleAssignTaskToSlot = async (taskId: string, slotTime: string, duration: number = 1.0) => {
    try {
      const agentName = currentSupervisor?.name || currentSupervisor?.id || "HAMZA RASSID";
      const res = await fetch(`/api/field-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_date: selectedDate,
          scheduled_time: slotTime,
          duration_hours: duration,
          assigned_to: agentName,
        }),
      });

      if (res.ok) {
        toast.success(`Mission planifiée à ${slotTime} (${duration}h) pour ${agentName}`);
        setIsAssignModalOpen(false);
        setAssigningSlotTime(null);
        onTaskUpdated();
        fetchSupervisors();
      } else {
        toast.error("Erreur lors de la planification");
      }
    } catch (e) {
      toast.error("Erreur réseau");
    }
  };

  // Update duration on an already scheduled task
  const handleUpdateDuration = async (task: FieldTask, newDuration: number) => {
    try {
      const res = await fetch(`/api/field-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_hours: newDuration,
        }),
      });

      if (res.ok) {
        toast.success(`Durée ajustée à ${newDuration}h`);
        onTaskUpdated();
        fetchSupervisors();
      } else {
        toast.error("Échec de mise à jour de la durée");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  // Unassign task from slot (return to pool)
  const handleUnscheduleTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/field-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_date: null,
          scheduled_time: null,
        }),
      });

      if (res.ok) {
        toast.success("Mission renvoyée dans la file d'attente");
        onTaskUpdated();
        fetchSupervisors();
      } else {
        toast.error("Échec du retrait");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  // Delete task completely (cancels linked maintenance ticket and unblocks vehicle)
  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/field-tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Mission et ticket supprimés avec succès");
        setDeletingTaskId(null);
        onTaskUpdated();
        fetchSupervisors();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Échec de la suppression");
      }
    } catch (err) {
      console.error("Failed to delete field task:", err);
      toast.error("Erreur réseau lors de la suppression");
    }
  };

  // Auto-schedule remaining pool tasks into today's empty slots
  const handleAutoSchedule = async () => {
    if (poolTasks.length === 0) {
      toast("Aucune tâche en attente à planifier.");
      return;
    }

    if (agentIsFull) {
      toast.error(`Journée complète pour ${currentSupervisor?.name || "cet agent"} (8h déjà planifiées).`);
      return;
    }

    // Find all free slots today
    const freeSlots = WORKING_HOURS.filter(
      (h) => !scheduledTasksMap[h] && !spanningSlotsMap[h]
    );

    if (freeSlots.length === 0) {
      toast.error("Aucun créneau libre disponible pour cette journée.");
      return;
    }

    let scheduledCount = 0;
    const agentName = currentSupervisor?.name || currentSupervisor?.id || "HAMZA RASSID";

    for (let i = 0; i < Math.min(poolTasks.length, freeSlots.length); i++) {
      const task = poolTasks[i];
      const slot = freeSlots[i];

      try {
        await fetch(`/api/field-tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduled_date: selectedDate,
            scheduled_time: slot,
            duration_hours: 1.0,
            assigned_to: agentName,
          }),
        });
        scheduledCount++;
      } catch (err) {
        console.error("Auto-schedule item error:", err);
      }
    }

    toast.success(`⚡ ${scheduledCount} mission(s) auto-planifiée(s) pour ${agentName} !`);
    onTaskUpdated();
    fetchSupervisors();
  };

  // Handle direct task creation by the agent
  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDesc.trim()) {
      toast.error("Veuillez renseigner une description.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const agentName = currentSupervisor?.name || currentSupervisor?.id || "HAMZA RASSID";
      const res = await fetch("/api/field-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: createTaskType,
          plate_number: createPlate.trim() || null,
          driver_name: createDriver.trim() || null,
          driver_phone: createPhone.trim() || null,
          description: createDesc.trim(),
          priority: createPriority,
          assigned_to: agentName,
          scheduled_date: selectedDate,
          scheduled_time: createSlotTime,
          duration_hours: createDuration,
        }),
      });

      if (res.ok) {
        toast.success(`Mission créée et planifiée à ${createSlotTime} (${createDuration}h) !`);
        setIsCreateModalOpen(false);
        setCreateDesc("");
        setCreatePlate("");
        setCreateDriver("");
        setCreatePhone("");
        onTaskUpdated();
        fetchSupervisors();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Échec de création de la mission");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Format date display (e.g., "Lundi 28 Septembre 2026")
  const formattedDateTitle = useMemo(() => {
    try {
      const d = new Date(selectedDate + "T12:00:00");
      return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(d);
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar: Agent Dropdown, Date Selector & Daily Workload Gauge */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Agent Dropdown (DD) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Agent Terrain :</span>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  👤 {s.name} {s.is_full ? "🔴 (Complet 8h)" : `🟢 (${s.available_hours || 8}h libres)`}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Workload Status Pill */}
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-2xs ${
              agentIsFull
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60"
                : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              {agentTotalHours}h / 8h planifiées{" "}
              {agentIsFull ? "• Journée Complète" : `• ${Math.max(0, 8 - agentTotalHours)}h disponibles`}
            </span>
          </div>
        </div>

        {/* Center: Date Navigator */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Jour précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-900 dark:text-white bg-transparent border-none focus:outline-none cursor-pointer capitalize"
            />
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Jour suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1 text-2xs font-bold bg-white dark:bg-slate-700 hover:bg-blue-50 text-blue-700 dark:text-blue-300 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors shadow-2xs cursor-pointer ml-1"
          >
            Aujourd&apos;hui
          </button>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {poolTasks.length > 0 && !agentIsFull && (
            <button
              type="button"
              onClick={handleAutoSchedule}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Planifier automatiquement les tâches en attente dans les créneaux libres"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-remplir ({poolTasks.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCreateSlotTime("09:00");
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Mission</span>
          </button>
        </div>
      </div>

      {/* Capacity Alert Banner if Agent is Full (8h) */}
      {agentIsFull && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-xl text-lg">
              ⚠️
            </span>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                {currentSupervisor?.name || "Cet agent"} a atteint sa capacité maximale pour cette journée (8h planifiées).
              </h4>
              <p className="text-3xs text-amber-700 dark:text-amber-400 mt-0.5">
                Pour ajouter d&apos;autres tâches, sélectionnez un autre jour ou confiez-les à un autre agent disponible.
              </p>
            </div>
          </div>

          {currentSupervisor?.suggested_date && (
            <button
              type="button"
              onClick={() => setSelectedDate(currentSupervisor.suggested_date!)}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-amber-100 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center"
            >
              <span>Voir le prochain créneau ({currentSupervisor.suggested_date} à 09:00)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 2. Main Daily Split Layout: Timeline Grid (Left 2/3) + Remaining Tasks Pool (Right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Hourly Schedule Grid (8 of 12 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                Agenda du {formattedDateTitle}
              </h3>
            </div>
            <span className="text-2xs font-semibold text-slate-500">
              Heures ouvrables : 08h00 — 18h00 (Créneaux de 1h modulables)
            </span>
          </div>

          {/* Timeline Slots */}
          <div className="space-y-2.5 pt-1">
            {WORKING_HOURS.map((hour) => {
              const task = scheduledTasksMap[hour];
              const spanInfo = spanningSlotsMap[hour];

              // Case A: A task starts at this hour
              if (task) {
                const duration = task.duration_hours && task.duration_hours > 0 ? task.duration_hours : 1.0;
                const endTime = computeEndTime(hour, duration);
                const isCompleted = task.status === "COMPLETED";
                const isInProgress = task.status === "IN_PROGRESS";
                const isRecovery = task.task_type === "VEHICLE_RECOVERY";
                const waLink = getWhatsAppLink(task.driver_phone);

                return (
                  <div
                    key={hour}
                    className={`rounded-xl border p-3.5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs ${
                      isCompleted
                        ? "bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50"
                        : isInProgress
                        ? "bg-blue-50/50 border-blue-300 ring-1 ring-blue-400/30 dark:bg-blue-950/30 dark:border-blue-800"
                        : isRecovery
                        ? "bg-red-50/30 border-red-200 dark:bg-red-950/20 dark:border-red-900/50"
                        : "bg-slate-50/80 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700"
                    }`}
                  >
                    {/* Time & Task Header */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shrink-0 min-w-[70px]">
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{hour}</span>
                        <span className="text-[10px] text-slate-400 font-mono">➔ {endTime}</span>
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <MoroccanPlateBadge plate={task.plate_number} />
                          <span
                            className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                              isRecovery
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                : task.task_type === "GARAGE_PICKUP"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {isRecovery
                              ? "🚨 Récupération"
                              : task.task_type === "GARAGE_PICKUP"
                              ? "🔧 Retrait Garage"
                              : "📋 Checkup Terrain"}
                          </span>

                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              task.priority === "Critical"
                                ? "bg-red-600 text-white"
                                : task.priority === "Urgent"
                                ? "bg-amber-500 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {task.priority}
                          </span>

                          {/* Duration Badge & Modifier */}
                          <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-2xs font-bold text-slate-700 dark:text-slate-300">
                            <span>⏱️ {duration}h</span>
                            <div className="flex items-center gap-0.5 ml-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateDuration(task, Math.max(0.5, duration - 0.5))}
                                disabled={duration <= 0.5}
                                className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] disabled:opacity-30 cursor-pointer"
                                title="Réduire la durée de 30 min"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateDuration(task, Math.min(4.0, duration + 0.5))}
                                disabled={duration >= 4.0}
                                className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] disabled:opacity-30 cursor-pointer"
                                title="Augmenter la durée de 30 min"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Driver & Description */}
                        {task.driver_name && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <span>👤 {task.driver_name}</span>
                            {task.driver_phone && (
                              <span className="text-3xs text-slate-400 font-mono">({task.driver_phone})</span>
                            )}
                          </div>
                        )}

                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 italic">
                          {task.description}
                        </p>
                      </div>
                    </div>

                    {/* Task Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {/* Driver Communication links */}
                      {task.driver_phone && (
                        <div className="flex items-center gap-1 mr-1">
                          <a
                            href={`tel:${task.driver_phone}`}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-blue-600 transition-colors"
                            title="Appeler le chauffeur"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 transition-colors"
                              title="Message WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* State actions */}
                      {task.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => {
                            fetch(`/api/field-tasks/${task.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "IN_PROGRESS" }),
                            }).then(() => {
                              toast.success("Mission démarrée !");
                              onTaskUpdated();
                            });
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Démarrer</span>
                        </button>
                      )}

                      {task.status === "IN_PROGRESS" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isRecovery) {
                              onOpenRecoveryModal(task);
                            } else {
                              fetch(`/api/field-tasks/${task.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "COMPLETED" }),
                              }).then(() => {
                                toast.success("Mission clôturée avec succès !");
                                onTaskUpdated();
                              });
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Clôturer</span>
                        </button>
                      )}

                      {/* Unschedule button (Return to pool) */}
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleUnscheduleTask(task.id)}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Retirer du créneau et remettre dans la file d'attente"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete button or confirmation */}
                      {!isCompleted && (
                        deletingTaskId === task.id ? (
                          <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 p-1 rounded-lg border border-red-200 dark:border-red-900/60 animate-fadeIn">
                            <span className="text-3xs font-bold text-red-700 dark:text-red-300 px-0.5">Supprimer ?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-2xs bg-red-600 text-white font-bold px-1.5 py-0.5 rounded hover:bg-red-700 cursor-pointer"
                            >
                              Oui
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingTaskId(null)}
                              className="text-2xs bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium px-1 py-0.5 rounded hover:bg-gray-300 cursor-pointer"
                            >
                              Non
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingTaskId(task.id)}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Supprimer définitivement la mission"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              }

              // Case B: Slot is part of an ongoing multi-hour mission starting earlier
              if (spanInfo) {
                return (
                  <div
                    key={hour}
                    className="rounded-xl border border-dashed border-blue-200 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 px-4 py-2.5 flex items-center justify-between text-2xs text-slate-500"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-400">{hour}</span>
                      <span className="italic flex items-center gap-1">
                        <span>↳ Suite de la mission de {spanInfo.parentTime}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          ({spanInfo.task.plate_number})
                        </span>
                      </span>
                    </div>
                    <span className="text-3xs text-blue-600 dark:text-blue-400 font-semibold">Créneau occupé</span>
                  </div>
                );
              }

              // Case C: Empty Slot — Ready to schedule!
              return (
                <div
                  key={hour}
                  className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-white dark:bg-slate-900/60 p-3 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-slate-400 group-hover:text-blue-600 transition-colors">
                      {hour}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Créneau libre (1 heure)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {poolTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningSlotTime(hour);
                          setIsAssignModalOpen(true);
                        }}
                        className="px-3 py-1 bg-slate-50 hover:bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-blue-300 border border-slate-200 dark:border-slate-700 rounded-lg text-2xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Planifier mission</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setCreateSlotTime(hour);
                        setIsCreateModalOpen(true);
                      }}
                      className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title="Créer une nouvelle mission pour ce créneau"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Remaining Tasks Pool (4 of 12 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">📥</span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Missions en Attente
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono">
                {poolTasks.length}
              </span>
            </div>

            <p className="text-3xs text-slate-400 leading-normal">
              Tâches non encore affectées à un créneau horaire. Glissez-les ou cliquez pour les planifier dans l&apos;agenda de {currentSupervisor?.name}.
            </p>

            {/* Search inside pool */}
            {poolTasks.length > 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filtrer immat, chauffeur..."
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* List of Unscheduled Task Cards */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredPoolTasks.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs space-y-1">
                  <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500" />
                  <p className="font-bold text-slate-700 dark:text-slate-300">File d&apos;attente vide</p>
                  <p className="text-3xs">Toutes les missions actives sont planifiées dans les agendas !</p>
                </div>
              ) : (
                filteredPoolTasks.map((t) => {
                  const isRec = t.task_type === "VEHICLE_RECOVERY";
                  // Find next free slot today for quick 1-click schedule
                  const nextFree = WORKING_HOURS.find(
                    (h) => !scheduledTasksMap[h] && !spanningSlotsMap[h]
                  );

                  return (
                    <div
                      key={t.id}
                      className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 hover:border-blue-400 transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <MoroccanPlateBadge plate={t.plate_number} />
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isRec
                                ? "bg-red-100 text-red-700"
                                : t.task_type === "GARAGE_PICKUP"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {isRec ? "🚨 Récupération" : t.task_type === "GARAGE_PICKUP" ? "🔧 Retrait Garage" : "Contrôle"}
                          </span>

                          {/* Delete button or confirmation */}
                          {deletingTaskId === t.id ? (
                            <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 p-1 rounded-lg border border-red-200 dark:border-red-900/60 animate-fadeIn">
                              <span className="text-3xs font-bold text-red-700 dark:text-red-300 px-0.5">Supprimer ?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(t.id)}
                                className="text-2xs bg-red-600 text-white font-bold px-1.5 py-0.5 rounded hover:bg-red-700 cursor-pointer"
                              >
                                Oui
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingTaskId(null)}
                                className="text-2xs bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium px-1 py-0.5 rounded hover:bg-gray-300 cursor-pointer"
                              >
                                Non
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingTaskId(t.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                              title="Supprimer la mission"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {t.driver_name && (
                        <div className="text-2xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <span>👤 {t.driver_name}</span>
                        </div>
                      )}

                      <p className="text-3xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                        {t.description}
                      </p>

                      {/* Quick schedule buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        {nextFree && !agentIsFull ? (
                          <button
                            type="button"
                            onClick={() => handleAssignTaskToSlot(t.id, nextFree, 1.0)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-2xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <span>⚡ Planifier à {nextFree}</span>
                          </button>
                        ) : (
                          <span className="text-3xs text-amber-600 font-bold">
                            {agentIsFull ? "Agent complet aujourd'hui" : "Aucun créneau libre"}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setAssigningSlotTime(nextFree || "09:00");
                            setIsAssignModalOpen(true);
                          }}
                          className="text-3xs font-semibold text-slate-500 hover:text-blue-600 cursor-pointer"
                        >
                          Choisir l&apos;heure...
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Slot Quick Picker Modal */}
      {isAssignModalOpen && assigningSlotTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Planifier un créneau : {assigningSlotTime} ({formattedDateTitle})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssigningSlotTime(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Sélectionnez une mission parmi les {poolTasks.length} tâches en attente à assigner à{" "}
              <strong className="text-slate-800 dark:text-white">{currentSupervisor?.name}</strong> :
            </p>

            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {poolTasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Aucune tâche restante en attente.
                </div>
              ) : (
                poolTasks.map((pt) => (
                  <div
                    key={pt.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MoroccanPlateBadge plate={pt.plate_number} />
                        <span className="text-2xs font-bold text-slate-700 dark:text-slate-300 truncate">
                          {pt.driver_name || "Sans chauffeur"}
                        </span>
                      </div>
                      <p className="text-3xs text-slate-500 line-clamp-1 italic">{pt.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {deletingTaskId === pt.id ? (
                        <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 p-1 rounded-lg border border-red-200 dark:border-red-900/60 animate-fadeIn">
                          <span className="text-3xs font-bold text-red-700 dark:text-red-300 px-0.5">Supprimer ?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(pt.id)}
                            className="text-2xs bg-red-600 text-white font-bold px-1.5 py-0.5 rounded hover:bg-red-700 cursor-pointer"
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTaskId(null)}
                            className="text-2xs bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium px-1 py-0.5 rounded hover:bg-gray-300 cursor-pointer"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingTaskId(pt.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer la mission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleAssignTaskToSlot(pt.id, assigningSlotTime, 1.0)}
                        className="px-2.5 py-1 bg-blue-600 text-white text-2xs font-bold rounded-lg shadow-2xs group-hover:scale-105 transition-transform shrink-0 cursor-pointer"
                      >
                        Affecter (1h)
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssigningSlotTime(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create New Mission directly on a slot */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Nouvelle Mission Terrain — Agenda de {currentSupervisor?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTaskSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Date & Time Slot */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Heure du créneau *
                  </label>
                  <select
                    value={createSlotTime}
                    onChange={(e) => setCreateSlotTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  >
                    {WORKING_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h} {scheduledTasksMap[h] ? "(Occupé)" : "(Libre)"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Durée estimée *
                  </label>
                  <select
                    value={createDuration}
                    onChange={(e) => setCreateDuration(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    {DURATION_PRESETS.map((d) => (
                      <option key={d} value={d}>
                        {d} heure(s) {d === 1.0 ? "(Par défaut)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Task Type */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Type de Mission *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "VEHICLE_RECOVERY", label: "🚨 Récupération Véhicule" },
                    { id: "GARAGE_PICKUP", label: "🔧 Retrait Garage (Accident)" },
                    { id: "MONTHLY_CHECKUP", label: "📋 Contrôle Technique" },
                    { id: "FIELD_VISIT", label: "🚗 Visite / Constat Terrain" },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setCreateTaskType(t.id)}
                      className={`p-2 rounded-xl border font-bold text-left transition-all ${
                        createTaskType === t.id
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Plate & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Immatriculation (Matricule)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: 21527-Y-6 ou WW..."
                    value={createPlate}
                    onChange={(e) => setCreatePlate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priorité
                  </label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 font-bold"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Critical">Critique (Bloqué)</option>
                  </select>
                </div>
              </div>

              {/* Driver Name & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nom du Chauffeur
                  </label>
                  <input
                    type="text"
                    placeholder="Nom complet..."
                    value={createDriver}
                    onChange={(e) => setCreateDriver(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone Chauffeur
                  </label>
                  <input
                    type="text"
                    placeholder="06... / +212..."
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description & Consignes *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Motif de l'intervention, adresse du garage ou localisation terrain..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 resize-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 bg-navy hover:bg-navy/90 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingCreate ? "Enregistrement..." : "Créer et Planifier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
