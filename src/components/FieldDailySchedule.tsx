"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

function parseTimeToMinutes(t: string): number {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function calculateDurationBetween(start: string, end: string): number {
  const startM = parseTimeToMinutes(start);
  let endM = parseTimeToMinutes(end);
  if (endM <= startM) {
    endM += 1440;
  }
  const diffHours = (endM - startM) / 60;
  return Math.max(0.5, Math.round(diffHours * 10) / 10);
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

  // Slot Quick-Assign & Complete Modal state
  const [assigningSlotTime, setAssigningSlotTime] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignModalDate, setAssignModalDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [assignModalStartTime, setAssignModalStartTime] = useState<string>("09:00");
  const [assignModalEndTime, setAssignModalEndTime] = useState<string>("10:00");
  const [assignModalDuration, setAssignModalDuration] = useState<number>(1.0);
  const [selectedPoolTaskId, setSelectedPoolTaskId] = useState<string | null>(null);
  const [editingScheduledTask, setEditingScheduledTask] = useState<FieldTask | null>(null);

  // Completion toggle & handover checklist
  const [assignModalIsCompleted, setAssignModalIsCompleted] = useState<boolean>(false);
  const [assignModalCompletedDate, setAssignModalCompletedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [assignModalCompletedTime, setAssignModalCompletedTime] = useState<string>("10:00");
  const [assignModalHasKey, setAssignModalHasKey] = useState<boolean>(true);
  const [assignModalHasCarteGrise, setAssignModalHasCarteGrise] = useState<boolean>(true);
  const [assignModalHasAssurance, setAssignModalHasAssurance] = useState<boolean>(true);
  const [assignModalRecoveryNotes, setAssignModalRecoveryNotes] = useState<string>("");
  const [isSubmittingAssign, setIsSubmittingAssign] = useState<boolean>(false);

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

  // Vehicle suggestion & autocomplete state
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const plateDropdownRef = useRef<HTMLDivElement>(null);

  // Load vehicles list for instant search
  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await fetch("/api/vehicles");
        const data = await res.json();
        setVehicles(data.vehicles || []);
      } catch (err) {
        console.error("Failed to load vehicles list:", err);
      }
    }
    loadVehicles();
  }, []);

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

  // Filter vehicle suggestions based on immat search
  const plateSuggestions = useMemo(() => {
    const q = createPlate.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!q) {
      return vehicles.slice(0, 6);
    }
    return vehicles
      .filter((v) => {
        const pClean = (v.plate_number || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const dName = (v.assigned_driver_name || v.driverProfile?.fullName || "").toLowerCase();
        const model = (v.make_model || "").toLowerCase();
        return pClean.includes(q) || dName.includes(createPlate.toLowerCase()) || model.includes(createPlate.toLowerCase());
      })
      .slice(0, 8);
  }, [vehicles, createPlate]);

  // Handle vehicle suggestion selection
  const handleSelectVehicleSuggestion = (v: any) => {
    setCreatePlate(v.plate_number || "");
    const dName = v.assigned_driver_name || v.driverProfile?.fullName || "";
    const dPhone = v.assigned_driver_phone || v.driverProfile?.phoneSanitized || "";
    if (dName) setCreateDriver(dName);
    if (dPhone) setCreatePhone(dPhone);
    setIsPlateDropdownOpen(false);
  };

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

  // Current active task in assign/complete modal
  const currentModalTask = useMemo(() => {
    if (editingScheduledTask) return editingScheduledTask;
    if (selectedPoolTaskId) {
      return poolTasks.find((t) => t.id === selectedPoolTaskId) || tasks.find((t) => t.id === selectedPoolTaskId) || null;
    }
    return poolTasks[0] || null;
  }, [editingScheduledTask, selectedPoolTaskId, poolTasks, tasks]);

  const isCurrentTaskRecovery = useMemo(() => {
    if (!currentModalTask) return false;
    return currentModalTask.task_type === "VEHICLE_RECOVERY" || currentModalTask.task_type?.includes("Recovery");
  }, [currentModalTask]);

  const openAssignModal = (slotTime: string, preselectedTaskId?: string, taskToEdit?: FieldTask) => {
    setAssigningSlotTime(slotTime);
    setEditingScheduledTask(taskToEdit || null);

    const initialDate = taskToEdit?.scheduled_date || selectedDate;
    const initialStart = taskToEdit?.scheduled_time || slotTime || "09:00";
    const initialDur = taskToEdit?.duration_hours && taskToEdit.duration_hours > 0 ? taskToEdit.duration_hours : 1.0;
    const initialEnd = computeEndTime(initialStart, initialDur);

    setAssignModalDate(initialDate);
    setAssignModalStartTime(initialStart);
    setAssignModalDuration(initialDur);
    setAssignModalEndTime(initialEnd);

    const targetTaskId = taskToEdit
      ? taskToEdit.id
      : (preselectedTaskId || (poolTasks.length > 0 ? poolTasks[0].id : null));
    setSelectedPoolTaskId(targetTaskId);

    const isAlreadyDone = taskToEdit?.status === "COMPLETED";
    setAssignModalIsCompleted(isAlreadyDone);
    setAssignModalCompletedDate(initialDate);
    setAssignModalCompletedTime(initialEnd);
    setAssignModalHasKey(taskToEdit?.has_key ?? true);
    setAssignModalHasCarteGrise(taskToEdit?.has_carte_grise ?? true);
    setAssignModalHasAssurance(taskToEdit?.has_assurance ?? true);
    setAssignModalRecoveryNotes(taskToEdit?.recovery_notes || "");

    setIsAssignModalOpen(true);
  };

  const handleStartTimeChange = (newStart: string) => {
    setAssignModalStartTime(newStart);
    const newEnd = computeEndTime(newStart, assignModalDuration);
    setAssignModalEndTime(newEnd);
    setAssignModalCompletedTime(newEnd);
  };

  const handleEndTimeChange = (newEnd: string) => {
    setAssignModalEndTime(newEnd);
    const dur = calculateDurationBetween(assignModalStartTime, newEnd);
    setAssignModalDuration(dur);
    setAssignModalCompletedTime(newEnd);
  };

  const handleDurationPreset = (dur: number) => {
    setAssignModalDuration(dur);
    const newEnd = computeEndTime(assignModalStartTime, dur);
    setAssignModalEndTime(newEnd);
    setAssignModalCompletedTime(newEnd);
  };

  // Confirm schedule or complete mission
  const handleConfirmAssignOrComplete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetTaskId = editingScheduledTask ? editingScheduledTask.id : selectedPoolTaskId;
    if (!targetTaskId) {
      toast.error("Veuillez sélectionner une tâche à planifier.");
      return;
    }

    const taskObj = currentModalTask;
    const isRecovery = isCurrentTaskRecovery;
    const agentName = currentSupervisor?.name || currentSupervisor?.id || "HAMZA RASSID";

    setIsSubmittingAssign(true);
    try {
      const payload: any = {
        scheduled_date: assignModalDate,
        scheduled_time: assignModalStartTime,
        duration_hours: assignModalDuration,
        assigned_to: agentName,
      };

      if (assignModalIsCompleted) {
        payload.status = "COMPLETED";
        const completedDateTimeStr = `${assignModalCompletedDate}T${assignModalCompletedTime || assignModalEndTime}:00`;
        const completedDate = new Date(completedDateTimeStr);
        payload.completed_at = isNaN(completedDate.getTime()) ? new Date() : completedDate;

        if (isRecovery) {
          payload.has_key = assignModalHasKey;
          payload.has_carte_grise = assignModalHasCarteGrise;
          payload.has_assurance = assignModalHasAssurance;
          payload.recovery_notes = assignModalRecoveryNotes;
          payload.recovery_duration_hours = assignModalDuration;
        }
      }

      const res = await fetch(`/api/field-tasks/${targetTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (assignModalIsCompleted) {
          toast.success(
            isRecovery
              ? `✅ Véhicule ${taskObj?.plate_number || ""} récupéré avec succès (${assignModalStartTime} ➔ ${assignModalCompletedTime}) !`
              : `✅ Mission clôturée avec succès (${assignModalStartTime} ➔ ${assignModalCompletedTime}) !`
          );
        } else {
          toast.success(
            `📅 Mission ${taskObj?.plate_number || ""} planifiée le ${assignModalDate} de ${assignModalStartTime} à ${assignModalEndTime} (${assignModalDuration}h) pour ${agentName}`
          );
        }
        setIsAssignModalOpen(false);
        setAssigningSlotTime(null);
        setEditingScheduledTask(null);
        onTaskUpdated();
        fetchSupervisors();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Erreur lors de l'enregistrement");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur réseau");
    } finally {
      setIsSubmittingAssign(false);
    }
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
                      <div
                        onClick={() => openAssignModal(task.scheduled_time || hour, undefined, task)}
                        className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-xl px-2.5 py-1.5 shrink-0 min-w-[70px] cursor-pointer transition-colors group/time shadow-2xs"
                        title="Modifier la date, l'heure ou clôturer cette mission"
                      >
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono group-hover/time:text-blue-600">{hour}</span>
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
                              const supName = currentSupervisor?.name || currentSupervisor?.fullName || "Superviseur Terrain";
                              fetch(`/api/field-tasks/${task.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  status: "COMPLETED",
                                  completed_by: supName,
                                  author: supName,
                                }),
                              }).then(() => {
                                toast.success("Mission clôturée & 'Mission Complete' notifiée sur Telegram !");
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

                      {/* Edit Horaires / Clôturer direct button */}
                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => openAssignModal(task.scheduled_time || hour, undefined, task)}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                          title="Modifier la date, l'heure ou clôturer cette mission"
                        >
                          <Clock className="w-3.5 h-3.5" />
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
                        onClick={() => openAssignModal(hour)}
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
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          onClick={() => openAssignModal(nextFree || "09:00", t.id)}
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

      {/* MODAL 1: Slot Schedule & Completion Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Clock className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    {editingScheduledTask
                      ? `Modifier / Clôturer : ${editingScheduledTask.plate_number || "Mission"}`
                      : `Planifier une mission — Agenda ${currentSupervisor?.name || ""}`}
                  </h3>
                  <p className="text-2xs text-blue-100 font-medium">
                    {editingScheduledTask
                      ? `Créneau actuel : ${editingScheduledTask.scheduled_time || ""} (${editingScheduledTask.scheduled_date || ""})`
                      : `Configurez la date, les heures de début et fin, ou validez l'intervention terminée.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssigningSlotTime(null);
                  setEditingScheduledTask(null);
                }}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Task Selection (If assigning from backlog pool) */}
              {!editingScheduledTask && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>🎯 Mission à traiter</span>
                      <span className="text-3xs bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-full font-mono">
                        {poolTasks.length} disponible(s)
                      </span>
                    </label>
                  </div>

                  {poolTasks.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      Aucune mission en attente dans la file.
                    </div>
                  ) : poolTasks.length === 1 ? (
                    // Single task auto-selected
                    <div className="p-3.5 rounded-xl border-2 border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <MoroccanPlateBadge plate={poolTasks[0].plate_number} />
                          <span className="font-bold text-slate-900 dark:text-white">
                            {poolTasks[0].driver_name || "Sans chauffeur"}
                          </span>
                          {poolTasks[0].driver_phone && (
                            <span className="text-3xs text-slate-400 font-mono">({poolTasks[0].driver_phone})</span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-3xs font-bold ${
                            poolTasks[0].task_type === "VEHICLE_RECOVERY"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {poolTasks[0].task_type === "VEHICLE_RECOVERY"
                            ? "🚨 Récupération"
                            : poolTasks[0].task_type === "GARAGE_PICKUP"
                            ? "🔧 Retrait Garage"
                            : "📋 Contrôle"}
                        </span>
                      </div>
                      <p className="text-2xs text-slate-600 dark:text-slate-400 italic line-clamp-2">
                        {poolTasks[0].description}
                      </p>
                    </div>
                  ) : (
                    // Multiple tasks list with selectable card
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {poolTasks.map((pt) => {
                        const isSelected = selectedPoolTaskId === pt.id;
                        const isRec = pt.task_type === "VEHICLE_RECOVERY";
                        return (
                          <div
                            key={pt.id}
                            onClick={() => setSelectedPoolTaskId(pt.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected
                                ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 ring-1 ring-blue-500 shadow-2xs"
                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <MoroccanPlateBadge plate={pt.plate_number} />
                              <div className="min-w-0 truncate">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-2xs block truncate">
                                  {pt.driver_name || "Sans chauffeur"}
                                </span>
                                <span className="text-3xs text-slate-500 dark:text-slate-400 italic truncate block">
                                  {pt.description}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                isRec
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {isRec ? "🚨 Récupération" : "Contrôle"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* If editing an existing task, show summary */}
              {editingScheduledTask && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MoroccanPlateBadge plate={editingScheduledTask.plate_number} />
                      <span className="font-bold text-slate-900 dark:text-white">
                        {editingScheduledTask.driver_name || "Sans chauffeur"}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-3xs font-bold ${
                        editingScheduledTask.task_type === "VEHICLE_RECOVERY"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}
                    >
                      {editingScheduledTask.task_type === "VEHICLE_RECOVERY"
                        ? "🚨 Récupération"
                        : editingScheduledTask.task_type === "GARAGE_PICKUP"
                        ? "🔧 Retrait Garage"
                        : "📋 Contrôle"}
                    </span>
                  </div>
                  <p className="text-2xs text-slate-600 dark:text-slate-400 italic">
                    {editingScheduledTask.description}
                  </p>
                </div>
              )}

              {/* SECTION: Date, Start Time, End Time & Duration */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Date & Horaires d&apos;intervention :</span>
                  </span>
                  <span className="text-3xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
                    ⏱️ Durée : {assignModalDuration}h
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Date Input */}
                  <div>
                    <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Date d&apos;intervention *
                    </label>
                    <input
                      type="date"
                      value={assignModalDate}
                      onChange={(e) => {
                        setAssignModalDate(e.target.value);
                        setAssignModalCompletedDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* Start Time Input */}
                  <div>
                    <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Heure de début *
                    </label>
                    <input
                      type="time"
                      value={assignModalStartTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* End Time Input */}
                  <div>
                    <label className="block text-3xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Heure de fin *
                    </label>
                    <input
                      type="time"
                      value={assignModalEndTime}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Duration Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-3xs font-semibold text-slate-400 mr-1">Raccourcis durée :</span>
                  {[0.5, 1.0, 1.5, 2.0, 3.0, 4.0].map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => handleDurationPreset(d)}
                      className={`px-2 py-0.5 rounded-lg text-3xs font-bold transition-all cursor-pointer ${
                        assignModalDuration === d
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-600"
                      }`}
                    >
                      {d}h {d === 0.5 ? "(30min)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: Option "Mission déjà terminée sur le terrain ?" */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  assignModalIsCompleted
                    ? "bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 shadow-2xs"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={assignModalIsCompleted}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAssignModalIsCompleted(checked);
                      if (checked && !assignModalCompletedTime) {
                        setAssignModalCompletedTime(assignModalEndTime || assignModalStartTime);
                      }
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>✅ Mission déjà terminée sur le terrain ?</span>
                      <span className="text-3xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded">
                        Intervention effectuée
                      </span>
                    </span>
                    <p className="text-3xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Cochez si l&apos;agent a déjà réalisé cette intervention. Vous pourrez choisir l&apos;heure exacte de fin et valider la restitution du véhicule.
                    </p>
                  </div>
                </label>

                {assignModalIsCompleted && (
                  <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-900/60 space-y-3 animate-fadeIn">
                    {/* Date & Heure de fin d'achèvement */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-3xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                          Date de réalisation
                        </label>
                        <input
                          type="date"
                          value={assignModalCompletedDate}
                          onChange={(e) => setAssignModalCompletedDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-3xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                          Heure de fin / clôture *
                        </label>
                        <input
                          type="time"
                          value={assignModalCompletedTime}
                          onChange={(e) => setAssignModalCompletedTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-bold font-mono rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Restitution Handover Checklist (for vehicle recovery / car need to get back) */}
                    {isCurrentTaskRecovery && (
                      <div className="space-y-2 pt-1">
                        <label className="block text-3xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                          📋 Checklist Restitution Véhicule (Handover) :
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setAssignModalHasKey(!assignModalHasKey)}
                            className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              assignModalHasKey
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900"
                            }`}
                          >
                            <span>🔑 Clé</span>
                            <span className="text-3xs font-black">{assignModalHasKey ? "✓ Récupérée" : "✗ Manquante"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAssignModalHasCarteGrise(!assignModalHasCarteGrise)}
                            className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              assignModalHasCarteGrise
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900"
                            }`}
                          >
                            <span>📄 Carte Grise</span>
                            <span className="text-3xs font-black">{assignModalHasCarteGrise ? "✓ Récupérée" : "✗ Manquante"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAssignModalHasAssurance(!assignModalHasAssurance)}
                            className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              assignModalHasAssurance
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900"
                            }`}
                          >
                            <span>🛡️ Assurance</span>
                            <span className="text-3xs font-black">{assignModalHasAssurance ? "✓ Récupérée" : "✗ Manquante"}</span>
                          </button>
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Observations sur l'état du véhicule (pneu de secours, état carrosserie, lieu dépôt...)"
                            value={assignModalRecoveryNotes}
                            onChange={(e) => setAssignModalRecoveryNotes(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="text-3xs text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                          ℹ️ <strong>Action automatique :</strong> En validant, le véhicule sera remis en statut <strong>Available (Au parc)</strong>, l&apos;ancien chauffeur dissocié et le ticket support résolu.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssigningSlotTime(null);
                  setEditingScheduledTask(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>

              <button
                type="button"
                disabled={isSubmittingAssign || (!editingScheduledTask && poolTasks.length === 0)}
                onClick={() => handleConfirmAssignOrComplete()}
                className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 ${
                  assignModalIsCompleted
                    ? "bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800"
                    : "bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
                }`}
              >
                {isSubmittingAssign ? (
                  <span>Enregistrement...</span>
                ) : assignModalIsCompleted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isCurrentTaskRecovery
                        ? "✅ Valider la Récupération & Clôturer"
                        : "✅ Clôturer la mission terminée"}
                    </span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>
                      Planifier ({assignModalStartTime} ➔ {assignModalEndTime})
                    </span>
                  </>
                )}
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
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Plate & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div ref={plateDropdownRef} className="relative">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Immatriculation (Matricule) *</span>
                    {vehicles.length > 0 && (
                      <span className="text-3xs font-medium text-slate-400">
                        {vehicles.length} véhicules en flotte
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tapez l'immat (ex: 21527-Y-6 ou WW...)"
                    value={createPlate}
                    onFocus={() => setIsPlateDropdownOpen(true)}
                    onChange={(e) => {
                      setCreatePlate(e.target.value);
                      setIsPlateDropdownOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />

                  {/* Suggestions Popover */}
                  {isPlateDropdownOpen && plateSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-56 overflow-y-auto z-50 py-1 divide-y divide-slate-100 dark:divide-slate-700/60 animate-fadeIn">
                      <div className="px-3 py-1 bg-slate-50 dark:bg-slate-900/60 text-3xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Véhicules suggérés</span>
                        <span>{plateSuggestions.length} trouvés</span>
                      </div>
                      {plateSuggestions.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectVehicleSuggestion(v);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50/80 dark:hover:bg-slate-700/70 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/60 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              🚗 {v.plate_number}
                            </span>
                            <span className="text-2xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                              {v.make_model}
                            </span>
                          </div>
                          {(v.assigned_driver_name || v.driverProfile?.fullName) ? (
                            <div className="text-right shrink-0">
                              <span className="text-3xs text-slate-600 dark:text-slate-300 font-semibold block">
                                👤 {v.assigned_driver_name || v.driverProfile?.fullName}
                              </span>
                              {(v.assigned_driver_phone || v.driverProfile?.phoneSanitized) && (
                                <span className="text-3xs text-slate-400 font-mono block">
                                  {v.assigned_driver_phone || v.driverProfile?.phoneSanitized}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-3xs text-amber-600 dark:text-amber-400 font-medium shrink-0">
                              Sans chauffeur
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priorité
                  </label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
