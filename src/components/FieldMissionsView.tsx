"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveSync } from "@/context/LiveSyncContext";
import {
  Calendar,
  Clock,
  Plus,
  Play,
  CheckCircle2,
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
  Phone,
  MessageSquare,
  Search,
  X,
  Check,
  Send,
  Camera,
  Share2,
  ExternalLink,
  MapPin,
  AlertOctagon,
  FileText,
  Key,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  Info,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { MoroccanPlateBadge, FieldTask } from "@/components/FieldSupervisorView";
import RedFlagBadge from "@/components/RedFlagBadge";

interface FieldSupervisorOption {
  id: string;
  name: string;
  fullName: string;
  email: string;
  role: string;
  region?: string;
  scheduled_tasks_count?: number;
}

const FIELD_SUPERVISOR_DEFAULTS: FieldSupervisorOption[] = [
  { id: "ayoub-rassid", name: "Ayoub Rassid", fullName: "Ayoub Rassid", email: "ayoub.rassid@gocab.io", role: "FIELD_SUPERVISOR", region: "CASABLANCA" },
  { id: "hamza-rassid", name: "Hamza Rassid", fullName: "Hamza Rassid", email: "hamza.rassid@gocab.io", role: "FIELD_SUPERVISOR", region: "CASABLANCA" },
  { id: "mohamed-aziz", name: "Mohamed Aziz", fullName: "Mohamed Aziz", email: "mohamed.aziz@gocab.io", role: "FLEET_PERF_MANAGER", region: "CASABLANCA" },
];

const TASK_TYPE_META: Record<string, { label: string; icon: string; color: string; badgeBg: string; border: string }> = {
  VEHICLE_RECOVERY: {
    label: "Récupération Véhicule",
    icon: "🚨",
    color: "text-red-700 dark:text-red-400",
    badgeBg: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    border: "border-l-red-500",
  },
  REPAIR: {
    label: "Dépôt Garage / Réparation",
    icon: "🛠️",
    color: "text-orange-800 dark:text-orange-300",
    badgeBg: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    border: "border-l-orange-500",
  },
  EMERGENCY_REPAIR: {
    label: "Dépôt Garage Urgence",
    icon: "🛠️",
    color: "text-orange-800 dark:text-orange-300",
    badgeBg: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
    border: "border-l-orange-500",
  },
  GARAGE_PICKUP: {
    label: "Reprise au Garage",
    icon: "🔧",
    color: "text-amber-800 dark:text-amber-300",
    badgeBg: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    border: "border-l-amber-500",
  },
  MONTHLY_CHECKUP: {
    label: "Contrôle Mensuel",
    icon: "🔍",
    color: "text-blue-700 dark:text-blue-300",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    border: "border-l-blue-500",
  },
  FIELD_INSPECTION: {
    label: "Constat / Expertise",
    icon: "📋",
    color: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    border: "border-l-purple-500",
  },
  FIELD_VISIT: {
    label: "Constat / Expertise",
    icon: "📋",
    color: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    border: "border-l-purple-500",
  },
  OTHER: {
    label: "Autre Mission",
    icon: "📌",
    color: "text-slate-700 dark:text-slate-300",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    border: "border-l-slate-500",
  },
};

function getWhatsAppUrl(phone: string | null | undefined, driverName?: string | null, plate?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = "212" + digits.slice(1);
  else if (!digits.startsWith("212")) digits = "212" + digits;
  const greeting = `Bonjour ${driverName || "Monsieur"}, je suis agent de l'équipe terrain GoCab concernant votre véhicule ${plate || ""}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
}

export interface FieldMissionsViewProps {
  standalone?: boolean;
  onBackToAgenda?: () => void;
}

function FieldMissionsContent({ standalone = false, onBackToAgenda }: FieldMissionsViewProps) {
  const searchParams = useSearchParams();
  const initialAgent = searchParams.get("agent") || "";
  const initialTaskId = searchParams.get("taskId") || "";
  const initialDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const initialSearch = searchParams.get("search") || "";

  // State
  const [selectedAgent, setSelectedAgent] = useState<string>(initialAgent);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [supervisors, setSupervisors] = useState<FieldSupervisorOption[]>(FIELD_SUPERVISOR_DEFAULTS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [telegramUser, setTelegramUser] = useState<string | null>(null);

  const { notifyMutation } = useLiveSync("tickets", () => fetchTasks(true));
  useLiveSync("all", () => fetchTasks(true));

  // Completion modal state
  const [completingTask, setCompletingTask] = useState<FieldTask | null>(null);
  const [completionHasKey, setCompletionHasKey] = useState<boolean>(true);
  const [completionHasCarteGrise, setCompletionHasCarteGrise] = useState<boolean>(true);
  const [completionHasAssurance, setCompletionHasAssurance] = useState<boolean>(true);
  const [completionNotes, setCompletionNotes] = useState<string>("");
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState<boolean>(false);

  // Failure modal state
  const [failingTask, setFailingTask] = useState<FieldTask | null>(null);
  const [failureReasonPreset, setFailureReasonPreset] = useState<string>("Chauffeur introuvable / Injoignable");
  const [failureCustomReason, setFailureCustomReason] = useState<string>("");
  const [isSubmittingFailure, setIsSubmittingFailure] = useState<boolean>(false);

  // Create task modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createTaskType, setCreateTaskType] = useState<string>("VEHICLE_RECOVERY");
  const [createPlate, setCreatePlate] = useState<string>("");
  const [createDriver, setCreateDriver] = useState<string>("");
  const [createPhone, setCreatePhone] = useState<string>("");
  const [createDesc, setCreateDesc] = useState<string>("");
  const [createPriority, setCreatePriority] = useState<string>("Urgent");
  const [createAssignedTo, setCreateAssignedTo] = useState<string>(initialAgent || "Ayoub Rassid");
  const [createScheduledTime, setCreateScheduledTime] = useState<string>("");
  const [createDuration, setCreateDuration] = useState<number>(1.0);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Vehicles for autocomplete selection
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [createVehicleId, setCreateVehicleId] = useState<string | null>(null);
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const plateDropdownRef = useRef<HTMLDivElement>(null);

  // Load vehicles list for instant search
  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await fetch("/api/vehicles");
        if (res.ok) {
          const data = await res.json();
          setVehicles(data.vehicles || []);
        }
      } catch (err) {
        console.error("Failed to load vehicles in missions view:", err);
      }
    }
    loadVehicles();
  }, []);

  // Dismiss plate popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (plateDropdownRef.current && !plateDropdownRef.current.contains(event.target as Node)) {
        setIsPlateDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter vehicle suggestions
  const plateSuggestions = useMemo(() => {
    const q = createPlate.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!q) {
      return vehicles.slice(0, 8);
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

  const handleSelectVehicle = (v: any) => {
    setCreatePlate(v.plate_number || "");
    setCreateVehicleId(v.id || null);
    const dName = v.assigned_driver_name || v.driverProfile?.fullName || "";
    const dPhone = v.assigned_driver_phone || v.driverProfile?.phoneSanitized || "";
    if (dName) setCreateDriver(dName);
    if (dPhone) setCreatePhone(dPhone);
    setIsPlateDropdownOpen(false);
  };

  // Initialize Telegram WebApp if loaded inside Telegram
  useEffect(() => {
    if (typeof window !== "undefined") {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready?.();
        tg.expand?.();
        const user = tg.initDataUnsafe?.user;
        if (user) {
          const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username;
          setTelegramUser(userName);
          // If no initial agent was given, try matching with telegram user name
          if (!initialAgent) {
            const matched = FIELD_SUPERVISOR_DEFAULTS.find(
              (s) => s.name.toLowerCase().includes(userName.toLowerCase()) || userName.toLowerCase().includes(s.name.toLowerCase())
            );
            if (matched) {
              setSelectedAgent(matched.name);
            }
          }
        }
      }
    }
  }, [initialAgent]);

  // Fetch supervisors
  const fetchSupervisors = useCallback(async () => {
    try {
      const res = await fetch(`/api/field-supervisors?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.supervisors) && data.supervisors.length > 0) {
          setSupervisors(data.supervisors);
        }
      }
    } catch {
      // Fallback already seeded
    }
  }, [selectedDate]);

  // Fetch tasks
  const fetchTasks = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const res = await fetch(`/api/field-tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      } else {
        toast.error("Impossible de charger les missions.");
      }
    } catch {
      toast.error("Erreur de connexion.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSupervisors();
    fetchTasks();
  }, [fetchSupervisors, fetchTasks]);

  // Auto-highlight task if taskId is provided in URL
  useEffect(() => {
    if (initialTaskId && tasks.length > 0) {
      const target = tasks.find((t) => t.id === initialTaskId);
      if (target) {
        if (target.assigned_to) setSelectedAgent(target.assigned_to);
        if (target.scheduled_date) setSelectedDate(target.scheduled_date);
        const el = document.getElementById(`task-card-${initialTaskId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, [initialTaskId, tasks]);

  // Filter tasks based on agent, date, tab, search
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Search query (if searching, allow searching across ALL tasks without agent restrictions)
      const hasSearch = searchQuery.trim().length > 0;
      if (hasSearch) {
        const q = searchQuery.toLowerCase().trim();
        const inPlate = (t.plate_number || "").toLowerCase().includes(q);
        const inDriver = (t.driver_name || "").toLowerCase().includes(q);
        const inPhone = (t.driver_phone || "").toLowerCase().includes(q);
        const inDesc = (t.description || "").toLowerCase().includes(q);
        if (!inPlate && !inDriver && !inPhone && !inDesc) return false;
        // Search match found! Skip date/agent restrictions so user can find any vehicle immediately
        return true;
      }

      // 2. Agent filter (if selected)
      if (selectedAgent === "UNASSIGNED") {
        if (t.assigned_to) return false;
      } else if (selectedAgent && selectedAgent !== "ALL") {
        const rawAssigned = (t.assigned_to || "").toLowerCase().trim();
        const cleanAssigned = rawAssigned.replace(/\s*\([^)]*\)/g, "").trim();
        const rawAgent = selectedAgent.toLowerCase().trim();
        const cleanAgent = rawAgent.replace(/\s*\([^)]*\)/g, "").trim();
        const matchesAgent =
          rawAssigned === rawAgent ||
          cleanAssigned === cleanAgent ||
          cleanAssigned.includes(cleanAgent) ||
          cleanAgent.includes(cleanAssigned) ||
          cleanAssigned.replace(/[\s._-]+/g, "") === cleanAgent.replace(/[\s._-]+/g, "");

        // Also show unassigned tasks waiting for assignment so field agents can see and claim them
        const isUnassignedPending = !t.assigned_to && t.status !== "COMPLETED";
        if (!matchesAgent && !isUnassignedPending) return false;
      }

      // 3. Date filter: if task is scheduled for this date, or if unscheduled and pending, or overdue incomplete
      if (selectedDate) {
        const tDate = t.scheduled_date ? t.scheduled_date.trim().split("T")[0] : null;
        const isPastIncomplete = Boolean(tDate && tDate < selectedDate && t.status !== "COMPLETED");
        const matchesDate = tDate === selectedDate || (!tDate && t.status !== "COMPLETED") || isPastIncomplete;
        if (!matchesDate) return false;
      }

      // 4. Status tab filter
      if (activeTab === "PENDING" && t.status !== "PENDING") return false;
      if (activeTab === "IN_PROGRESS" && t.status !== "IN_PROGRESS") return false;
      if (activeTab === "COMPLETED" && t.status !== "COMPLETED") return false;

      return true;
    });
  }, [tasks, selectedAgent, selectedDate, activeTab, searchQuery]);

  // Counts for tabs & badges
  const agentTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!selectedAgent || selectedAgent === "ALL") return true;
      if (selectedAgent === "UNASSIGNED") return !t.assigned_to;
      const rawAssigned = (t.assigned_to || "").toLowerCase().trim();
      const cleanAssigned = rawAssigned.replace(/\s*\([^)]*\)/g, "").trim();
      const rawAgent = selectedAgent.toLowerCase().trim();
      const cleanAgent = rawAgent.replace(/\s*\([^)]*\)/g, "").trim();
      const matchesAgent =
        rawAssigned === rawAgent ||
        cleanAssigned === cleanAgent ||
        cleanAssigned.includes(cleanAgent) ||
        cleanAgent.includes(cleanAssigned) ||
        cleanAssigned.replace(/[\s._-]+/g, "") === cleanAgent.replace(/[\s._-]+/g, "");

      return matchesAgent || (!t.assigned_to && t.status !== "COMPLETED");
    });
  }, [tasks, selectedAgent]);

  const stats = useMemo(() => {
    const todayTasks = agentTasks.filter((t) => {
      const tDate = t.scheduled_date ? t.scheduled_date.trim().split("T")[0] : null;
      const isPastIncomplete = Boolean(tDate && tDate < selectedDate && t.status !== "COMPLETED");
      return tDate === selectedDate || (!tDate && t.status !== "COMPLETED") || isPastIncomplete;
    });
    return {
      total: todayTasks.length,
      pending: todayTasks.filter((t) => t.status === "PENDING").length,
      inProgress: todayTasks.filter((t) => t.status === "IN_PROGRESS").length,
      completed: todayTasks.filter((t) => t.status === "COMPLETED").length,
    };
  }, [agentTasks, selectedDate]);

  // Actions
  const handleStartTask = async (task: FieldTask) => {
    try {
      const res = await fetch(`/api/field-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          assigned_to: selectedAgent && selectedAgent !== "ALL" ? selectedAgent : task.assigned_to,
        }),
      });
      if (res.ok) {
        toast.success(`🚀 Mission démarrée pour ${task.plate_number || "le véhicule"} !`);
        fetchTasks(true);
      } else {
        toast.error("Erreur lors du démarrage.");
      }
    } catch {
      toast.error("Erreur réseau.");
    }
  };

  const handleOpenCompletionModal = (task: FieldTask) => {
    setCompletingTask(task);
    setCompletionHasKey(task.has_key !== undefined ? Boolean(task.has_key) : true);
    setCompletionHasCarteGrise(task.has_carte_grise !== undefined ? Boolean(task.has_carte_grise) : true);
    setCompletionHasAssurance(task.has_assurance !== undefined ? Boolean(task.has_assurance) : true);
    setCompletionNotes(task.recovery_notes || "");
    setCompletionPhotos([]);
  };

  const handleSubmitCompletion = async () => {
    if (!completingTask) return;
    setIsSubmittingCompletion(true);
    try {
      const agentName = selectedAgent && selectedAgent !== "ALL" ? selectedAgent : completingTask.assigned_to || "Superviseur Terrain";
      const res = await fetch(`/api/field-tasks/${completingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          completed_by: agentName,
          has_key: completionHasKey,
          has_carte_grise: completionHasCarteGrise,
          has_assurance: completionHasAssurance,
          recovery_notes: completionNotes.trim() || "Mission validée et terminée par l'agent terrain via Telegram.",
        }),
      });

      if (res.ok) {
        toast.success(`🎉 Mission terminée avec succès pour ${completingTask.plate_number || "le véhicule"} !`);
        setCompletingTask(null);
        notifyMutation("tickets");
        fetchTasks(true);
      } else {
        toast.error("Erreur lors de la validation.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  const handleOpenFailureModal = (task: FieldTask) => {
    setFailingTask(task);
    setFailureReasonPreset("Chauffeur introuvable / Injoignable");
    setFailureCustomReason("");
  };

  const handleSubmitFailure = async () => {
    if (!failingTask) return;
    setIsSubmittingFailure(true);
    try {
      const reason = failureCustomReason.trim() ? `${failureReasonPreset} - ${failureCustomReason.trim()}` : failureReasonPreset;
      const res = await fetch(`/api/field-tasks/${failingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "FAILED",
          failure_reason: reason,
        }),
      });

      if (res.ok) {
        toast.error(`Échec signalé : ${failingTask.plate_number || "Véhicule"}`);
        setFailingTask(null);
        notifyMutation("tickets");
        fetchTasks(true);
      } else {
        toast.error("Erreur lors de l'enregistrement.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setIsSubmittingFailure(false);
    }
  };

  const handleResendTelegram = async (taskId: string) => {
    try {
      const res = await fetch(`/api/field-tasks/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: selectedAgent || "Agent Terrain" }),
      });
      if (res.ok) {
        toast.success("📢 Alerte renvoyée sur Telegram !");
      } else {
        toast.error("Échec de l'envoi Telegram.");
      }
    } catch {
      toast.error("Erreur réseau.");
    }
  };

  const handleCreateMission = async () => {
    if (!createDesc.trim()) {
      toast.error("Veuillez saisir une description ou instruction.");
      return;
    }
    setIsSubmittingCreate(true);
    try {
      const res = await fetch("/api/field-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: createTaskType,
          vehicle_id: createVehicleId || null,
          plate_number: createPlate.trim() || null,
          driver_name: createDriver.trim() || null,
          driver_phone: createPhone.trim() || null,
          description: createDesc.trim(),
          priority: createPriority,
          assigned_to: createAssignedTo || "Ayoub Rassid",
          scheduled_date: selectedDate,
          scheduled_time: createScheduledTime ? createScheduledTime.trim() : null,
          duration_hours: createDuration,
          triggered_by: telegramUser ? `Agent Telegram (${telegramUser})` : "Agent Terrain",
        }),
      });

      if (res.ok) {
        toast.success(
          createScheduledTime
            ? `✅ Mission planifiée à ${createScheduledTime} et envoyée sur Telegram !`
            : "✅ Mission créée (heure libre) et envoyée sur Telegram !"
        );
        setIsCreateModalOpen(false);
        setCreateDesc("");
        setCreatePlate("");
        setCreateDriver("");
        setCreatePhone("");
        setCreateScheduledTime("");
        setCreateVehicleId(null);
        notifyMutation("tickets");
        fetchTasks(true);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Échec de création.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) {
          setCompletionPhotos((prev) => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url);
    toast.success("📋 Lien de la mission copié !");
  };

  // Date navigation helpers
  const handleDateOffset = (days: number) => {
    const cur = new Date(selectedDate + "T12:00:00");
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().split("T")[0]);
  };

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(selectedDate + "T12:00:00");
      return new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d);
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className={`bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${standalone ? "min-h-screen pb-20 select-none" : "min-h-[750px] pb-12 rounded-2xl"}`}>
      <Toaster position="top-center" />

      {/* CRM Desktop Banner when accessed inside CRM tabs */}
      {!standalone && (
        <div className="bg-gradient-to-r from-sky-600 to-blue-700 text-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">📱</span>
              <h1 className="text-lg font-black tracking-tight">Missions Terrain & Dispatch Telegram</h1>
              <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Temps Réel
              </span>
            </div>
            <p className="text-xs text-sky-100 max-w-2xl leading-relaxed">
              Vue interactive des missions telle que reçue par les agents sur Telegram (Ayoub Rassid, Hamza Rassid, Mohamed Aziz). Créez et dispatchez des missions instantanément avec notifications interactives.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const url = typeof window !== "undefined" ? `${window.location.origin}/field-missions` : "https://gocab-crm.vercel.app/field-missions";
                navigator.clipboard.writeText(url);
                toast.success("Lien Telegram public copié ! Partagez-le avec les agents.");
              }}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/20 active:scale-95 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Copier Lien Telegram</span>
            </button>
            <a
              href="/field-missions"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ouvrir Plein Écran</span>
            </a>
            {onBackToAgenda && (
              <button
                type="button"
                onClick={onBackToAgenda}
                className="px-3.5 py-2 bg-sky-800/80 hover:bg-sky-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-sky-400/30 active:scale-95 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Voir Agenda Terrain</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Mobile Bar / Telegram Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs px-3 sm:px-6 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm font-black text-sm">
              GC
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
                  Missions Terrain
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  <Smartphone className="w-2.5 h-2.5" />
                  <span>Telegram</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px] sm:max-w-xs">
                {telegramUser ? `Connecté : ${telegramUser}` : "Interventions & Récupérations GoCab"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchTasks(true)}
              disabled={isRefreshing}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Copier le lien Telegram"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Créer Mission</span>
              <span className="sm:hidden">Créer</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 pt-3 space-y-3.5">
        {/* Controls Card: Agent Switcher + Date Navigation */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
          {/* Agent Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-blue-500" />
                <span>Agent Terrain Destinataire</span>
              </span>
              <span className="text-slate-400 font-normal lowercase">
                {selectedAgent && selectedAgent !== "ALL" ? `${agentTasks.length} mission(s) attribuée(s)` : "Toute l'équipe"}
              </span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedAgent("ALL")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                  selectedAgent === "ALL" || !selectedAgent
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60"
                }`}
              >
                <span className="truncate">Tous les agents</span>
                <span className="text-[10px] opacity-70 ml-1">{tasks.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAgent("UNASSIGNED")}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                  selectedAgent === "UNASSIGNED"
                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60"
                }`}
              >
                <span className="truncate">⏳ À assigner</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                    selectedAgent === "UNASSIGNED"
                      ? "bg-white/20 text-white"
                      : tasks.filter((t) => !t.assigned_to && t.status !== "COMPLETED").length > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 font-extrabold"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {tasks.filter((t) => !t.assigned_to && t.status !== "COMPLETED").length}
                </span>
              </button>

              {supervisors.map((sup) => {
                const isSelected = selectedAgent === sup.name || selectedAgent === sup.fullName;
                const count = tasks.filter(
                  (t) => t.assigned_to === sup.name || t.assigned_to === sup.fullName
                ).length;

                return (
                  <button
                    key={sup.id}
                    type="button"
                    onClick={() => setSelectedAgent(sup.name)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60"
                    }`}
                  >
                    <span className="truncate">{sup.name.split(" ")[0]}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Selector Row */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleDateOffset(-1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Jour précédent"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleDateOffset(1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Jour suivant"
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 capitalize hidden sm:inline">
                {formattedDate}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedDate === new Date().toISOString().split("T")[0]
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              Aujourd&apos;hui
            </button>
          </div>
        </section>

        {/* Quick KPI Stat Counter Pills */}
        <section className="grid grid-cols-4 gap-2">
          <div
            onClick={() => setActiveTab("ALL")}
            className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer text-center ${
              activeTab === "ALL"
                ? "bg-blue-50/70 border-blue-400 dark:bg-blue-950/40 dark:border-blue-700 shadow-2xs"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight">
              {stats.total}
            </div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">Total</div>
          </div>

          <div
            onClick={() => setActiveTab("PENDING")}
            className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer text-center ${
              activeTab === "PENDING"
                ? "bg-amber-50/70 border-amber-400 dark:bg-amber-950/40 dark:border-amber-700 shadow-2xs"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 leading-tight">
              {stats.pending}
            </div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">À faire</div>
          </div>

          <div
            onClick={() => setActiveTab("IN_PROGRESS")}
            className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer text-center ${
              activeTab === "IN_PROGRESS"
                ? "bg-indigo-50/70 border-indigo-400 dark:bg-indigo-950/40 dark:border-indigo-700 shadow-2xs"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 leading-tight flex items-center justify-center gap-1">
              <span>{stats.inProgress}</span>
              {stats.inProgress > 0 && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
            </div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">En cours</div>
          </div>

          <div
            onClick={() => setActiveTab("COMPLETED")}
            className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer text-center ${
              activeTab === "COMPLETED"
                ? "bg-emerald-50/70 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700 shadow-2xs"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">
              {stats.completed}
            </div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">Terminées</div>
          </div>
        </section>

        {/* Search Input */}
        <section className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par immatriculation, chauffeur, téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </section>

        {/* Tasks List */}
        <section className="space-y-3">
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Chargement des missions en direct...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-xl">
                🏁
              </div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                Aucune mission {activeTab !== "ALL" ? `dans cet onglet (${activeTab})` : "pour cette date"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Toutes les interventions de{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedAgent && selectedAgent !== "ALL" ? selectedAgent : "l'équipe"}
                </span>{" "}
                pour le {formattedDate} sont à jour.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer une mission maintenant</span>
              </button>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const meta = TASK_TYPE_META[task.task_type] || {
                label: task.task_type,
                icon: "📌",
                color: "text-slate-700",
                badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
                border: "border-l-slate-400",
              };
              const waUrl = getWhatsAppUrl(task.driver_phone, task.driver_name, task.plate_number);
              const isSelectedTarget = task.id === initialTaskId;

              return (
                <div
                  key={task.id}
                  id={`task-card-${task.id}`}
                  className={`bg-white dark:bg-slate-900 border ${
                    isSelectedTarget
                      ? "ring-2 ring-blue-500 border-blue-400 shadow-md"
                      : "border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700"
                  } border-l-4 ${meta.border} rounded-2xl p-3.5 sm:p-4 space-y-3 transition-all`}
                >
                  {/* Card Header: Type + Status + Time */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${meta.badgeBg}`}>
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>

                      {task.priority && (
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                            task.priority === "Critical"
                              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800"
                              : task.priority === "Urgent"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800"
                              : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {task.priority}
                        </span>
                      )}

                      {Boolean(task.scheduled_date && task.scheduled_date < selectedDate && task.status !== "COMPLETED") && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Reportée du {task.scheduled_date}</span>
                        </span>
                      )}

                      {task.scheduled_time ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{task.scheduled_time} ({task.duration_hours || 1}h)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3 text-sky-600" />
                          <span>⚡ Heure libre</span>
                        </span>
                      )}

                      {/* Quick time adjustment for field agents */}
                      {task.status !== "COMPLETED" && (
                        <select
                          value={task.scheduled_time || ""}
                          onChange={async (e) => {
                            const newTime = e.target.value;
                            try {
                              const res = await fetch(`/api/field-tasks/${task.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  scheduled_time: newTime || null,
                                }),
                              });
                              if (res.ok) {
                                toast.success(newTime ? `Créneau fixé à ${newTime}` : "Créneau passé en Heure libre");
                                fetchTasks(true);
                              }
                            } catch {
                              toast.error("Erreur mise à jour créneau");
                            }
                          }}
                          className="text-[10px] font-bold bg-transparent border-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0 underline decoration-dotted"
                          title="Modifier le créneau horaire de la mission"
                        >
                          <option value="">⚡ Libre</option>
                          {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Status Pill */}
                    <div>
                      {task.status === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Terminée</span>
                        </span>
                      ) : task.status === "IN_PROGRESS" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                          <span>En cours</span>
                        </span>
                      ) : task.status === "FAILED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Échec</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <span>À traiter</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vehicle & Plate Section */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <MoroccanPlateBadge plate={task.plate_number} />
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {task.task_type === "GARAGE_PICKUP" ? "Reprise Garage / Réparé" : "Véhicule Opérationnel"}
                      </div>
                    </div>

                    {!task.assigned_to ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const agentToAssign =
                            selectedAgent && selectedAgent !== "ALL" && selectedAgent !== "UNASSIGNED"
                              ? selectedAgent
                              : telegramUser || "Ayoub Rassid";
                          try {
                            const res = await fetch(`/api/field-tasks/${task.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ assigned_to: agentToAssign, status: "IN_PROGRESS" }),
                            });
                            if (res.ok) {
                              toast.success(`✋ Mission prise en charge par ${agentToAssign} !`);
                              fetchTasks(true);
                            }
                          } catch {
                            toast.error("Erreur d'attribution");
                          }
                        }}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Prendre en charge cette mission"
                      >
                        <span>✋ Prendre en charge</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{task.assigned_to}</span>
                      </span>
                    )}
                  </div>

                  {/* Driver Contact Box */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold">
                        👤
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {task.driver_name || "Chauffeur non renseigné"}
                          </span>
                          <RedFlagBadge reason={task.driver_red_flag_reason} />
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {task.driver_phone || "Pas de numéro"}
                        </span>
                      </div>
                    </div>

                    {/* Direct Contact Buttons */}
                    {task.driver_phone && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <a
                          href={`tel:${task.driver_phone}`}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Appeler</span>
                        </a>

                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description / Telematics Context */}
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60 leading-relaxed font-normal">
                    {task.description}
                  </div>

                  {/* Completed Checklist Recap if completed */}
                  {task.status === "COMPLETED" && (
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-2.5 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Checklist Remise Validée</span>
                        </span>
                        {task.recovery_duration_hours && (
                          <span>Durée constatée : {task.recovery_duration_hours}h</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] opacity-90">
                        <span>Clé : {task.has_key ? "✅ Oui" : "❌ Non"}</span>
                        <span>Carte Grise : {task.has_carte_grise ? "✅ Oui" : "❌ Non"}</span>
                        <span>Assurance : {task.has_assurance ? "✅ Oui" : "❌ Non"}</span>
                      </div>
                      {task.recovery_notes && (
                        <p className="text-[11px] italic opacity-85 pt-1 border-t border-emerald-200 dark:border-emerald-800/40">
                          &ldquo;{task.recovery_notes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Failure reason if failed */}
                  {task.status === "FAILED" && task.failure_reason && (
                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-xl p-2.5 text-xs text-rose-800 dark:text-rose-300">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Motif d&apos;échec :</span>
                      </div>
                      <p className="mt-0.5">{task.failure_reason}</p>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleResendTelegram(task.id)}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      title="Renvoyer l'alerte Telegram"
                    >
                      <Send className="w-3 h-3" />
                      <span>Rappel Telegram</span>
                    </button>

                    <div className="flex items-center gap-2 ml-auto">
                      {task.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => handleStartTask(task)}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Démarrer</span>
                        </button>
                      )}

                      {task.status === "IN_PROGRESS" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenFailureModal(task)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                          >
                            Échec
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenCompletionModal(task)}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Valider & Terminer</span>
                          </button>
                        </>
                      )}

                      {task.status === "COMPLETED" && (
                        <button
                          type="button"
                          onClick={() => handleOpenCompletionModal(task)}
                          className="px-3 py-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-medium"
                        >
                          Modifier compte-rendu
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      {/* MODAL 1: Clôture & Checklist Terrain (Handover) */}
      {completingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Clôture de la Mission
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {completingTask.plate_number} · {completingTask.driver_name || "Chauffeur"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompletingTask(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Checklist items */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Checklist Documents & Clés
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCompletionHasKey(!completionHasKey)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    completionHasKey
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700 shadow-2xs font-extrabold"
                      : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-medium opacity-60"
                  }`}
                >
                  <Key className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                  <span className="text-xs block">Clé du véhicule</span>
                  <span className="text-[10px] block mt-0.5">{completionHasKey ? "✅ Récupérée" : "❌ Manquante"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompletionHasCarteGrise(!completionHasCarteGrise)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    completionHasCarteGrise
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700 shadow-2xs font-extrabold"
                      : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-medium opacity-60"
                  }`}
                >
                  <FileText className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                  <span className="text-xs block">Carte Grise</span>
                  <span className="text-[10px] block mt-0.5">{completionHasCarteGrise ? "✅ Récupérée" : "❌ Manquante"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompletionHasAssurance(!completionHasAssurance)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    completionHasAssurance
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700 shadow-2xs font-extrabold"
                      : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-medium opacity-60"
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                  <span className="text-xs block">Assurance</span>
                  <span className="text-[10px] block mt-0.5">{completionHasAssurance ? "✅ Récupérée" : "❌ Manquante"}</span>
                </button>
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Compte-rendu d&apos;intervention
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {[
                  "Véhicule récupéré et sécurisé",
                  "Chauffeur coopératif, documents conformes",
                  "Véhicule convoyé et déposé au garage",
                  "Batterie rechargée / Véhicule redémarré",
                  "Véhicule stationné au parking sécurisé",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      setCompletionNotes((prev) => (prev ? `${prev} · ${chip}` : chip))
                    }
                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Détails du constat, état du véhicule, lieu où il est déposé..."
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Photo Attachment */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                <span>Photos Terrain (Preuve & État)</span>
                <span className="text-[10px] text-slate-400">{completionPhotos.length} photo(s)</span>
              </label>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <label className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors shrink-0">
                  <Camera className="w-5 h-5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 mt-1">Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {completionPhotos.map((p, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <img src={p} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setCompletionPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletingTask(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmittingCompletion}
                onClick={handleSubmitCompletion}
                className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmittingCompletion ? "Validation..." : "Confirmer la Clôture"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Signaler un Échec */}
      {failingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Signaler un Échec d&apos;Intervention</span>
              </h3>
              <button
                type="button"
                onClick={() => setFailingTask(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Motif principal
              </label>
              <div className="space-y-1.5">
                {[
                  "Chauffeur introuvable / Injoignable",
                  "Véhicule non localisé à l'adresse",
                  "Refus de restitution (Assistance police requise)",
                  "Véhicule accidenté / Dépanneuse requise",
                  "Autre motif",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setFailureReasonPreset(reason)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      failureReasonPreset === reason
                        ? "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700 font-bold"
                        : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Précisions supplémentaires
              </label>
              <textarea
                rows={2}
                value={failureCustomReason}
                onChange={(e) => setFailureCustomReason(e.target.value)}
                placeholder="Explication ou consignes pour le support..."
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFailingTask(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmittingFailure}
                onClick={handleSubmitFailure}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                {isSubmittingFailure ? "Envoi..." : "Valider l'Échec"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Créer une Nouvelle Mission */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Nouvelle Mission Terrain
                  </h3>
                  <p className="text-[11px] text-slate-500">Transmise immédiatement sur Telegram</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type de mission */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Type d&apos;intervention
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  { type: "VEHICLE_RECOVERY", label: "🚨 Récupération", desc: "Impayé / Blocage" },
                  { type: "REPAIR", label: "🛠️ Réparation Urgence", desc: "Emmener au garage" },
                  { type: "GARAGE_PICKUP", label: "🔧 Reprise Garage", desc: "Véhicule réparé" },
                  { type: "MONTHLY_CHECKUP", label: "🔍 Contrôle Mensuel", desc: "Visite technique" },
                  { type: "FIELD_INSPECTION", label: "📋 Constat Sinistre", desc: "Expertise terrain" },
                  { type: "OTHER", label: "📌 Autre Mission", desc: "Sur mesure / Divers" },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setCreateTaskType(item.type)}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      createTaskType === item.type
                        ? "bg-blue-50 text-blue-800 border-blue-400 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700 font-bold ring-1 ring-blue-400/40"
                        : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{item.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Context Chips for REPAIR & OTHER */}
            {createTaskType === "REPAIR" && (
              <div className="p-2.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-xl space-y-1.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 text-orange-800 dark:text-orange-300 font-extrabold text-xs">
                  <Wrench className="w-3.5 h-3.5 text-orange-600" />
                  <span>Dépôt au Garage d&apos;Urgence</span>
                </div>
                <p className="text-[11px] text-orange-700 dark:text-orange-300/80 leading-tight">
                  Sélectionnez le véhicule dans la flotte ci-dessous pour ordonner à l&apos;agent de le déposer au garage d&apos;urgence.
                </p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[
                    "🛠️ Garage d'urgence Hard Auto Services",
                    "🚨 Panne moteur / Remorquage",
                    "⚠️ Problème freins / Sécurité urgente",
                    "💥 Dépôt carrosserie suite choc",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setCreateDesc((prev) => (prev ? `${prev} · ${chip}` : chip));
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200 hover:bg-orange-100 transition-all cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {createTaskType === "OTHER" && (
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 animate-fadeIn">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-extrabold text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Autre Mission Personnalisée</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                  Intervention sur mesure hors catégories habituelles. Renseignez le motif et les instructions ci-dessous.
                </p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[
                    "📄 Livraison contrat / Documents",
                    "🔑 Récupération double des clés",
                    "📍 Vérification stationnement / GPS",
                    "🤝 Entretien chauffeur sur place",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setCreateDesc((prev) => (prev ? `${prev} · ${chip}` : chip));
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Plate & Driver with Autocomplete Fleet Picker */}
            <div className="grid grid-cols-2 gap-2">
              <div ref={plateDropdownRef} className="relative">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>
                    Matricule{" "}
                    {createTaskType === "OTHER" ? (
                      <span className="text-[9px] font-normal text-slate-400 lowercase">(optionnel)</span>
                    ) : (
                      "*"
                    )}
                  </span>
                  {vehicles.length > 0 && (
                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                      {vehicles.length} flotte
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder={createTaskType === "OTHER" ? "Optionnel..." : "26517-Y-6 ou WW..."}
                  value={createPlate}
                  onFocus={() => setIsPlateDropdownOpen(true)}
                  onChange={(e) => {
                    setCreatePlate(e.target.value.toUpperCase());
                    setIsPlateDropdownOpen(true);
                  }}
                  className="w-full p-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500/20"
                />

                {/* Suggestions Popover */}
                {isPlateDropdownOpen && plateSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-48 overflow-y-auto z-50 py-1 divide-y divide-slate-100 dark:divide-slate-700 text-left animate-fadeIn">
                    <div className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900/60 text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Véhicules en flotte</span>
                      <span>{plateSuggestions.length} trouvés</span>
                    </div>
                    {plateSuggestions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectVehicle(v);
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between gap-1.5 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 block">
                            🚗 {v.plate_number}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                            {v.make_model || "Véhicule GoCab"}
                          </span>
                        </div>
                        {v.assigned_driver_name && (
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[90px] shrink-0 text-right">
                            👤 {v.assigned_driver_name.split(" ")[0]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Priorité
                </label>
                <select
                  value={createPriority}
                  onChange={(e) => setCreatePriority(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="Critical">🔴 Critique (Immédiat)</option>
                  <option value="Urgent">🟠 Urgent (Aujourd&apos;hui)</option>
                  <option value="Normal">🟡 Normal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Chauffeur
                </label>
                <input
                  type="text"
                  placeholder="Nom complet"
                  value={createDriver}
                  onChange={(e) => setCreateDriver(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  placeholder="06... ou +212..."
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full p-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Agent Assignee & Schedule */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Assigner à
                </label>
                <select
                  value={createAssignedTo}
                  onChange={(e) => setCreateAssignedTo(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Créneau horaire
                </label>
                <select
                  value={createScheduledTime}
                  onChange={(e) => setCreateScheduledTime(e.target.value)}
                  className="w-full p-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  <option value="">⚡ Heure libre (Au choix de l&apos;agent)</option>
                  {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map((t) => (
                    <option key={t} value={t}>
                      {t} (1h)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Instructions & Motif de mission
              </label>
              <textarea
                rows={3}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Motif d'intervention, adresse ou repère GPS, arriérés de paiement..."
                className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSubmittingCreate}
                onClick={handleCreateMission}
                className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmittingCreate ? "Création..." : "Envoyer la Mission"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FieldMissionsView(props: FieldMissionsViewProps = {}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[500px] bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 rounded-2xl">
          <div className="text-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">Chargement des Missions Terrain...</p>
          </div>
        </div>
      }
    >
      <FieldMissionsContent {...props} />
    </Suspense>
  );
}
