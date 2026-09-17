"use client";

/**
 * FieldSupervisorView — Physical Field Intervention Task Queue
 *
 * Three task categories:
 * 1. 🚨 Vehicle Recovery — impounded/accident/blocked vehicles needing retrieval
 * 2. 🔧 Garage Pickup — resolved maintenance tickets, vehicle ready to return
 * 3. 📋 Monthly Checkups — auto-generated vehicle mechanical inspections with scoring
 *
 * Includes mechanical inspection form with 10-point scored checklist and 
 * month-over-month health score comparison.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { useLiveSync } from "@/context/LiveSyncContext";
import CarModel3D from "./CarModel3D";
import FieldMobileQuickActions from "./FieldMobileQuickActions";
import AttestationModal, { AttestationData } from "./AttestationModal";
import {
  Phone,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  RotateCcw,
  User,
  ShieldAlert,
  ClipboardCheck,
  Plus,
  Play,
  Key,
  FileText,
  AlertOctagon,
  Calendar,
  ExternalLink,
  Car,
  Check,
  X,
  History,
  AlertCircle,
} from "lucide-react";

interface FieldTask {
  id: string;
  task_type: string;
  vehicle_id: string | null;
  plate_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  description: string;
  status: string;
  priority: string;
  linked_ticket_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  failure_reason?: string | null;
  has_key?: boolean;
  has_carte_grise?: boolean;
  has_assurance?: boolean;
  recovery_duration_hours?: number | null;
  recovery_notes?: string | null;
  created_at: string;
}

interface CheckupDue {
  vehicle_id: string;
  plate_number: string;
  make_model: string;
  assigned_driver_name: string | null;
  assigned_driver_phone: string | null;
  previous_health_score: number | null;
  previous_inspection_date: string | null;
  document_name?: string | null;
  document_expiry_date?: string | null;
  autorisation_expiry_date?: string | null;
  insurance_expiry_date?: string | null;
  vignette_expiry_date?: string | null;
  technical_inspection_expiry?: string | null;
  days_left?: number | null;
  is_expired?: boolean;
  urgent_docs?: {
    name: string;
    date: string;
    days_left: number;
    is_expired: boolean;
  }[];
}

interface VehicleInspection {
  id: string;
  vehicle_id: string;
  plate_number: string;
  inspector_name: string;
  inspection_date: string;
  current_mileage: number;
  brakes_score: number;
  tires_score: number;
  engine_score: number;
  oil_level_score: number;
  lights_score: number;
  suspension_score: number;
  body_condition_score: number;
  interior_score: number;
  battery_score: number;
  exhaust_score: number;
  health_score: number;
  previous_health_score: number;
  notes: string | null;
  vehicle?: {
    make_model: string;
    plate_number: string;
    vin: string | null;
    assigned_driver_name: string | null;
    driver_cin: string;
  } | null;
}

const SCORE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Critical", color: "#b91c1c", bg: "#fecaca" },
  2: { label: "Poor", color: "#c2410c", bg: "#fed7aa" },
  3: { label: "Fair", color: "#b45309", bg: "#fef3c7" },
  4: { label: "Good", color: "#15803d", bg: "#dcfce7" },
  5: { label: "Excellent", color: "#047857", bg: "#a7f3d0" },
};

const CHECKPOINT_LABELS: Record<string, { label: string; icon: string; hint: string }> = {
  brakes_score: { label: "Freins", icon: "🛑", hint: "Plaquettes, disques, liquide" },
  tires_score: { label: "Pneus", icon: "🔘", hint: "Profondeur dessin, pression, usure" },
  engine_score: { label: "Moteur", icon: "⚙️", hint: "Bruit, performances, fuites" },
  oil_level_score: { label: "Niveau Huile", icon: "🛢️", hint: "Niveau, couleur, viscosité" },
  lights_score: { label: "Éclairage", icon: "💡", hint: "Phares, feux stop, clignotants" },
  suspension_score: { label: "Suspension", icon: "🔧", hint: "Amortisseurs, ressorts, confort" },
  body_condition_score: { label: "Carrosserie", icon: "🚗", hint: "Bosses, rayures, peinture" },
  interior_score: { label: "Habitacle", icon: "💺", hint: "Sièges, tableau de bord, climatisation" },
  battery_score: { label: "Batterie", icon: "🔋", hint: "Tension, cosses, démarrage" },
  exhaust_score: { label: "Échappement", icon: "💨", hint: "Ligne échappement, AdBleu" },
};

const TASK_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  VEHICLE_RECOVERY: { icon: "🚨", label: "Récupération de Véhicule", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  GARAGE_PICKUP: { icon: "🔧", label: "Retrait au Garage", color: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200" },
  MONTHLY_CHECKUP: { icon: "📋", label: "Contrôle Mensuel", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
};

const ARABIC_LETTER_MAP: Record<string, string> = {
  a: "أ",
  b: "ب",
  d: "د",
  h: "هـ",
  w: "و",
  y: "ي",
  j: "ج",
  m: "م",
  s: "س",
  t: "ت",
};

/**
 * Moroccan License Plate formatter
 * Authentic Moroccan plate badge [ 21527 | ي | 6 ] or [ WW | 964987 ]
 */
function MoroccanPlateBadge({ plate }: { plate: string | null | undefined }) {
  if (!plate) return <span className="text-gray-400 italic text-xs font-mono">Sans matricule</span>;
  const clean = plate.trim();

  // Provisional WW plate
  if (/^ww/i.test(clean)) {
    const num = clean.replace(/^ww[-–\s]*/i, "");
    return (
      <div className="inline-flex items-center gap-1.5 bg-red-600 text-white font-mono font-black text-xs px-2.5 py-1 rounded-md tracking-wider shadow-2xs border border-red-700">
        <span className="text-[10px] font-extrabold tracking-normal">WW</span>
        <span className="text-white/60">|</span>
        <span>{num}</span>
      </div>
    );
  }

  // Moroccan standard plate (numbers - letter - region)
  const parts = clean.split(/[-–|/\s]+/).filter(Boolean);
  if (parts.length === 3) {
    const rawLetter = parts[1].toLowerCase();
    const arabicChar = ARABIC_LETTER_MAP[rawLetter] || parts[1];

    return (
      <div className="inline-flex items-center bg-gray-950 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-md tracking-wide shadow-2xs border border-gray-800">
        <span className="tracking-wider">{parts[0]}</span>
        <span className="mx-1.5 text-gray-500 font-normal">|</span>
        <span className="text-amber-400 font-black font-arabic" title={parts[1]}>
          {arabicChar}
        </span>
        <span className="mx-1.5 text-gray-500 font-normal">|</span>
        <span className="text-gray-200">{parts[2]}</span>
      </div>
    );
  }

  // Fallback
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-950 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-md tracking-wider shadow-2xs border border-gray-800">
      <span>🚗</span>
      <span>{clean}</span>
    </div>
  );
}

export default function FieldSupervisorView() {
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tabs: ALL, VEHICLE_RECOVERY, GARAGE_PICKUP, MONTHLY_CHECKUP, COMPLETED
  const [activeTab, setActiveTab] = useState<"ALL" | "VEHICLE_RECOVERY" | "GARAGE_PICKUP" | "MONTHLY_CHECKUP" | "COMPLETED">("ALL");

  // Filters
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Create task modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTaskType, setNewTaskType] = useState("VEHICLE_RECOVERY");
  const [newPlate, setNewPlate] = useState("");
  const [newDriver, setNewDriver] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("Urgent");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Checkups due state
  const [checkupsDue, setCheckupsDue] = useState<CheckupDue[]>([]);

  // Inspection form modal
  const [inspectionVehicle, setInspectionVehicle] = useState<CheckupDue | null>(null);
  const [inspectorName, setInspectorName] = useState("");
  const [inspMileage, setInspMileage] = useState("");
  const [inspNotes, setInspNotes] = useState("");
  const [damagedParts, setDamagedParts] = useState<string[]>([]);
  const [inspScores, setInspScores] = useState<Record<string, number>>({
    brakes_score: 0,
    tires_score: 0,
    engine_score: 0,
    oil_level_score: 0,
    lights_score: 0,
    suspension_score: 0,
    body_condition_score: 0,
    interior_score: 0,
    battery_score: 0,
    exhaust_score: 0,
  });

  // Past inspections viewer
  const [viewInspections, setViewInspections] = useState<VehicleInspection[] | null>(null);
  const [viewPlate, setViewPlate] = useState("");

  // Generated Attestation Modal State
  const [attestationData, setAttestationData] = useState<AttestationData | null>(null);
  const [showAttestationModal, setShowAttestationModal] = useState(false);

  // Failure Modal
  const [failingTask, setFailingTask] = useState<FieldTask | null>(null);
  const [failureReason, setFailureReason] = useState("");

  // Recovery Handover Checklist Modal State
  const [recoveryModalTask, setRecoveryModalTask] = useState<FieldTask | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [hasCarteGrise, setHasCarteGrise] = useState(true);
  const [hasAssurance, setHasAssurance] = useState(true);
  const [recoveryNotes, setRecoveryNotes] = useState("");
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);

  // In-card delete confirmation state (task ID being confirmed for deletion)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Vider la file confirmation state
  const [isClearingQueue, setIsClearingQueue] = useState(false);

  const handleOpenRecoveryModal = (task: FieldTask) => {
    setRecoveryModalTask(task);
    setHasKey(true);
    setHasCarteGrise(true);
    setHasAssurance(true);
    setRecoveryNotes("");
  };

  const handleConfirmRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryModalTask) return;
    setIsRecoverySubmitting(true);
    try {
      const res = await fetch(`/api/field-tasks/${recoveryModalTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          has_key: hasKey,
          has_carte_grise: hasCarteGrise,
          has_assurance: hasAssurance,
          recovery_notes: recoveryNotes,
        }),
      });

      if (res.ok) {
        toast.success("✅ Véhicule récupéré avec succès ! Clôturé et replacé en Available.");
        setRecoveryModalTask(null);
        fetchTasks();
        notifyMutation("tickets");
      } else {
        toast.error("Échec de la validation de la récupération");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la récupération");
    } finally {
      setIsRecoverySubmitting(false);
    }
  };

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all tasks so our KPI counts stay completely accurate regardless of search/filter
      const res = await fetch(`/api/field-tasks`, { cache: "no-store" });
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Failed to fetch field tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDueCheckups = useCallback(async () => {
    try {
      const res = await fetch(`/api/inspections/due`);
      const data = await res.json();
      setCheckupsDue(data.checkupsDue || []);
    } catch (err) {
      console.error("Failed to fetch due checkups:", err);
    }
  }, []);

  const handleRefreshAll = useCallback(() => {
    fetchTasks();
    fetchDueCheckups();
  }, [fetchTasks, fetchDueCheckups]);

  // Live sync: auto-refreshes tasks when tickets or fleet status updates
  const { notifyMutation } = useLiveSync("tickets", handleRefreshAll);

  useEffect(() => {
    fetchTasks();
    fetchDueCheckups();
  }, [fetchTasks, fetchDueCheckups]);

  // Create task
  const handleCreateTask = async () => {
    if (!newDesc) {
      toast.error("Veuillez saisir une description");
      return;
    }
    try {
      const res = await fetch("/api/field-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: newTaskType,
          plate_number: newPlate || null,
          driver_name: newDriver || null,
          description: newDesc,
          priority: newPriority,
          assigned_to: newAssignedTo || null,
          due_date: newDueDate || null,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewPlate("");
        setNewDriver("");
        setNewDesc("");
        setNewPriority("Urgent");
        setNewAssignedTo("");
        setNewDueDate("");
        toast.success("Tâche terrain créée avec succès !");
        fetchTasks();
      } else {
        toast.error("Échec de la création de la tâche");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur réseau");
      console.error("Failed to create task:", err);
    }
  };

  // Update task status
  const handleStatusUpdate = async (task: FieldTask, newStatus: string, failReason?: string) => {
    try {
      const res = await fetch(`/api/field-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, failure_reason: failReason }),
      });
      if (res.ok) {
        toast.success(
          newStatus === "IN_PROGRESS"
            ? "▶ Mission démarrée ! Ticket Support synchronisé en cours."
            : newStatus === "COMPLETED"
            ? "✅ Mission validée et complétée !"
            : "Statut mis à jour"
        );
        fetchTasks();
        notifyMutation("tickets");
      } else {
        toast.error("Échec de la mise à jour");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
      console.error("Failed to update task:", err);
    }
  };

  const handleFailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failingTask || !failureReason.trim()) return;
    await handleStatusUpdate(failingTask, "FAILED", failureReason);
    setFailingTask(null);
    setFailureReason("");
  };

  // Submit inspection
  const handleSubmitInspection = async () => {
    if (!inspectionVehicle || !inspectorName) return;

    const finalNotes =
      damagedParts.length > 0
        ? `[Dommages visuels 3D : ${damagedParts.join(", ")}]\n${inspNotes}`
        : inspNotes;

    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: inspectionVehicle.vehicle_id,
          plate_number: inspectionVehicle.plate_number,
          inspector_name: inspectorName,
          current_mileage: Number(inspMileage) || 0,
          ...inspScores,
          notes: finalNotes || null,
        }),
      });

      const data = await res.json();

      setInspectionVehicle(null);
      setInspectorName("");
      setInspMileage("");
      setInspNotes("");
      setDamagedParts([]);
      setInspScores({
        brakes_score: 0,
        tires_score: 0,
        engine_score: 0,
        oil_level_score: 0,
        lights_score: 0,
        suspension_score: 0,
        body_condition_score: 0,
        interior_score: 0,
        battery_score: 0,
        exhaust_score: 0,
      });

      if (data.attestationData) {
        setAttestationData(data.attestationData);
        setShowAttestationModal(true);
        toast.success("Inspection enregistrée — Attestation générée !");
      } else {
        toast.success("Contrôle validé avec succès");
      }

      fetchDueCheckups();
    } catch (err: any) {
      toast.error(err.message || "Échec de l'enregistrement");
      console.error("Failed to submit inspection:", err);
    }
  };

  // View past inspections for a vehicle
  const handleViewHistory = async (plateNumber: string, vehicleId: string) => {
    try {
      const res = await fetch(`/api/inspections?vehicle_id=${vehicleId}`);
      const data = await res.json();
      setViewInspections(data.inspections || []);
      setViewPlate(plateNumber);
    } catch (err) {
      console.error("Failed to fetch inspections:", err);
    }
  };

  // Delete task
  const handleDeleteTask = async (id: string) => {
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeletingTaskId(null);
    try {
      const res = await fetch(`/api/field-tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Tâche supprimée");
        notifyMutation("tickets");
      } else {
        setTasks(prevTasks);
        toast.error("Échec de la suppression");
      }
    } catch (err) {
      setTasks(prevTasks);
      console.error("Failed to delete task:", err);
      toast.error("Erreur lors de la suppression");
    }
  };

  // WhatsApp link formatter
  const getWhatsAppLink = (phone: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (!cleaned) return null;
    let full = cleaned;
    if (full.startsWith("0")) {
      full = "212" + full.substring(1);
    } else if (!full.startsWith("212")) {
      full = "212" + full;
    }
    return `https://wa.me/${full}`;
  };

  // KPI Calculations across all tasks
  const pendingRecoveries = tasks.filter((t) => t.task_type === "VEHICLE_RECOVERY" && t.status !== "COMPLETED").length;
  const pendingPickups = tasks.filter((t) => t.task_type === "GARAGE_PICKUP" && t.status !== "COMPLETED").length;
  const checkupsDueCount = checkupsDue.length;
  const completedTodayCount = tasks.filter(
    (t) => t.status === "COMPLETED" && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString()
  ).length;

  const totalActiveTasks = tasks.filter((t) => t.status !== "COMPLETED").length;
  const totalCompletedTasks = tasks.filter((t) => t.status === "COMPLETED").length;

  // Filter Tasks List based on search, status, priority, and active tab
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Tab filter
      if (activeTab === "VEHICLE_RECOVERY" && task.task_type !== "VEHICLE_RECOVERY") return false;
      if (activeTab === "GARAGE_PICKUP" && task.task_type !== "GARAGE_PICKUP") return false;
      if (activeTab === "MONTHLY_CHECKUP" && task.task_type !== "MONTHLY_CHECKUP") return false;
      if (activeTab === "COMPLETED" && task.status !== "COMPLETED") return false;
      if (activeTab !== "COMPLETED" && activeTab !== "ALL" && task.status === "COMPLETED") return false;

      // Status filter
      if (filterStatus !== "ALL" && task.status !== filterStatus) return false;

      // Priority filter
      if (filterPriority !== "ALL" && task.priority !== filterPriority) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchPlate = task.plate_number?.toLowerCase().includes(q) || false;
        const matchDriver = task.driver_name?.toLowerCase().includes(q) || false;
        const matchPhone = task.driver_phone?.toLowerCase().includes(q) || false;
        const matchDesc = task.description?.toLowerCase().includes(q) || false;
        if (!matchPlate && !matchDriver && !matchPhone && !matchDesc) return false;
      }

      return true;
    });
  }, [tasks, activeTab, filterStatus, filterPriority, searchTerm]);

  // Group filtered tasks by type
  const recoveryTasks = filteredTasks.filter((t) => t.task_type === "VEHICLE_RECOVERY");
  const pickupTasks = filteredTasks.filter((t) => t.task_type === "GARAGE_PICKUP");

  const hasActiveFilters = searchTerm.trim() !== "" || filterStatus !== "ALL" || filterPriority !== "ALL";

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterStatus("ALL");
    setFilterPriority("ALL");
  };

  // Inspection avg for form preview
  const inspAvg = (() => {
    const vals = Object.values(inspScores).filter((v) => v > 0);
    return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  })();

  // Render an individual Task Card
  const renderTaskCard = (task: FieldTask) => {
    const isCompleted = task.status === "COMPLETED";
    const isPending = task.status === "PENDING";
    const isInProgress = task.status === "IN_PROGRESS";
    const isFailed = task.status === "FAILED";

    const waLink = getWhatsAppLink(task.driver_phone);

    // Calculate hours since creation
    const hoursElapsed = Math.max(0.1, (Date.now() - new Date(task.created_at).getTime()) / (1000 * 3600));

    return (
      <div
        key={task.id}
        className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5 relative ${
          isCompleted
            ? "border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/20 dark:bg-emerald-950/10 opacity-90"
            : isFailed
            ? "border-red-200 dark:border-red-950/60 bg-red-50/10"
            : isInProgress
            ? "border-blue-300 dark:border-blue-800 ring-1 ring-blue-500/20"
            : "border-gray-200 dark:border-slate-800"
        }`}
      >
        {/* Row 1: Header (Plate, Type, Priority & Status Badges) */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2.5 mb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <MoroccanPlateBadge plate={task.plate_number} />

              {/* Task Type Badge */}
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  task.task_type === "VEHICLE_RECOVERY"
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : task.task_type === "GARAGE_PICKUP"
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}
              >
                {task.task_type === "VEHICLE_RECOVERY" && "🚨 Récupération"}
                {task.task_type === "GARAGE_PICKUP" && "🔧 Retrait Garage"}
                {task.task_type === "MONTHLY_CHECKUP" && "📋 Contrôle"}
              </span>

              {/* Priority Badge */}
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  task.priority === "Critical"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : task.priority === "Urgent"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-800 dark:text-gray-300"
                }`}
              >
                {task.priority === "Critical" ? "🛑 Critique" : task.priority === "Urgent" ? "⚠️ Urgent" : "Normal"}
              </span>
            </div>

            {/* Right Status & Delete confirmation */}
            <div className="flex items-center gap-2">
              {/* Status Badge */}
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
                  isCompleted
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : isInProgress
                    ? "bg-blue-100 text-blue-800 border border-blue-200 animate-pulse"
                    : isFailed
                    ? "bg-red-100 text-red-800 border border-red-200"
                    : "bg-yellow-100 text-yellow-800 border border-yellow-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isCompleted
                      ? "bg-emerald-600"
                      : isInProgress
                      ? "bg-blue-600"
                      : isFailed
                      ? "bg-red-600"
                      : "bg-yellow-600"
                  }`}
                />
                <span>
                  {isCompleted
                    ? "Complété"
                    : isInProgress
                    ? "En cours"
                    : isFailed
                    ? "Échec"
                    : "En attente"}
                </span>
              </span>

              {/* Delete button or confirmation */}
              {deletingTaskId === task.id ? (
                <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-200 animate-fadeIn">
                  <span className="text-3xs font-bold text-red-700 px-1">Supprimer ?</span>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-2xs bg-red-600 text-white font-bold px-2 py-0.5 rounded hover:bg-red-700 cursor-pointer"
                  >
                    Oui
                  </button>
                  <button
                    onClick={() => setDeletingTaskId(null)}
                    className="text-2xs bg-gray-200 text-gray-700 font-medium px-1.5 py-0.5 rounded hover:bg-gray-300 cursor-pointer"
                  >
                    Non
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeletingTaskId(task.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Supprimer cette tâche"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Driver & Assignment Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 py-2 px-3 rounded-xl bg-gray-50/80 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800/80 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-navy/10 text-navy dark:bg-white/10 dark:text-white flex items-center justify-center font-bold text-xs shrink-0">
                <User className="w-3 h-3" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {task.driver_name || "Chauffeur non renseigné"}
                </div>
                {task.driver_phone && (
                  <div className="text-3xs text-gray-500 font-mono">{task.driver_phone}</div>
                )}
              </div>
              {task.assigned_to && (
                <span className="ml-1 text-3xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  👮 {task.assigned_to}
                </span>
              )}
            </div>

            {/* Quick Contact Chips */}
            {task.driver_phone && (
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`tel:${task.driver_phone}`}
                  className="inline-flex items-center gap-1 text-3xs font-bold bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 hover:bg-navy hover:text-white border border-gray-200 dark:border-slate-600 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                  title="Appeler le chauffeur"
                >
                  <Phone className="w-3 h-3 text-blue-600" />
                  <span>Appeler</span>
                </a>

                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-3xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-300 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                    title="Ouvrir WhatsApp direct"
                  >
                    <MessageCircle className="w-3 h-3 text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Row 3: Mission Instructions / Reason */}
          {task.description && (
            <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-gray-800 dark:text-gray-200 mb-2.5 flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">📋</span>
              <p className="leading-relaxed font-medium whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Failure Alert Box if Failed */}
          {isFailed && task.failure_reason && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-800 dark:text-red-300 flex items-start gap-2 mb-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Motif de l&apos;échec :</strong> {task.failure_reason}
              </div>
            </div>
          )}

          {/* Row 4: Recovery Duration & Handover Verification Result */}
          {task.task_type === "VEHICLE_RECOVERY" && (
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {/* Duration Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs ${
                  isCompleted
                    ? "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-gray-300"
                    : hoursElapsed >= 4
                    ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
                    : hoursElapsed >= 2
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {isCompleted
                    ? `Durée opération : ${task.recovery_duration_hours ?? "—"}h`
                    : `${hoursElapsed.toFixed(1)}h depuis blocage`}
                </span>
              </span>

              {/* Handover Verified Pills for completed recovery */}
              {isCompleted && (
                <div className="flex flex-wrap items-center gap-1.5 text-2xs">
                  <span
                    className={`px-2 py-0.5 rounded font-bold border ${
                      task.has_key
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    🔑 Clé : {task.has_key ? "✓" : "✗"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold border ${
                      task.has_carte_grise
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    📄 CG : {task.has_carte_grise ? "✓" : "✗"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold border ${
                      task.has_assurance
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    🛡️ Assur : {task.has_assurance ? "✓" : "✗"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Recovery Notes */}
          {isCompleted && task.recovery_notes && (
            <div className="text-2xs text-gray-500 italic mt-1.5">
              📝 Observations : {task.recovery_notes}
            </div>
          )}

          {/* Completed Timestamp */}
          {task.completed_at && (
            <div className="text-3xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>
                Clôturé le {new Date(task.completed_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
          )}
        </div>

        {/* Row 5: Action Buttons */}
        {!isCompleted && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
            {task.task_type === "VEHICLE_RECOVERY" ? (
              <>
                {isPending && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleStatusUpdate(task, "IN_PROGRESS");
                    }}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    title="Démarrer la mission et passer le ticket support en cours"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Démarrer la mission</span>
                  </button>
                )}

                {isInProgress && (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                    <span>Mission en cours</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenRecoveryModal(task)}
                  className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  title="Ouvrir la checklist de restitution et clôturer la récupération"
                >
                  <span>⚡</span>
                  <span>Récupérer (Checklist Handover)</span>
                </button>

                {isInProgress && (
                  <button
                    type="button"
                    onClick={() => {
                      setFailingTask(task);
                      setFailureReason("");
                    }}
                    className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold border border-red-200 transition-colors cursor-pointer"
                  >
                    Signaler Échec
                  </button>
                )}
              </>
            ) : task.task_type === "GARAGE_PICKUP" ? (
              <>
                {isPending && (
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate(task, "IN_PROGRESS")}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Démarrer le Retrait</span>
                  </button>
                )}

                {isInProgress && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(task, "COMPLETED")}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmer Réception Véhicule</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFailingTask(task);
                        setFailureReason("");
                      }}
                      className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold border border-red-200 transition-colors cursor-pointer"
                    >
                      Échec
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {isPending && (
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate(task, "IN_PROGRESS")}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    ▶ Démarrer
                  </button>
                )}
                {task.task_type === "MONTHLY_CHECKUP" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectionVehicle(task as any);
                        setInspectorName("");
                      }}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>Inspection Form</span>
                    </button>
                    {task.vehicle_id && task.plate_number && (
                      <button
                        type="button"
                        onClick={() => handleViewHistory(task.plate_number!, task.vehicle_id!)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Historique</span>
                      </button>
                    )}
                  </>
                )}
                {isInProgress && (
                  <button
                    type="button"
                    onClick={() => handleStatusUpdate(task, "COMPLETED")}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    ✅ Valider
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Section Container (for Recovery & Pickup)
  const renderSection = (title: string, type: string, sectionTasks: FieldTask[]) => {
    const config = TASK_TYPE_CONFIG[type] || TASK_TYPE_CONFIG.VEHICLE_RECOVERY;
    const pending = sectionTasks.filter((t) => t.status !== "COMPLETED").length;

    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 ${config.bg} dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800`}>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{config.icon}</span>
            <h3 className={`text-base font-bold ${config.color} dark:text-white`}>
              {title}
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${
                type === "VEHICLE_RECOVERY" ? "bg-red-600" : "bg-amber-600"
              }`}
            >
              {pending}
            </span>
          </div>

          {/* Vider la file button (for Vehicle Recovery) */}
          {type === "VEHICLE_RECOVERY" && sectionTasks.length > 0 && (
            <div>
              {isClearingQueue ? (
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 shadow-2xs animate-fadeIn">
                  <span className="text-2xs font-bold text-red-700 dark:text-red-400">
                    Vider toutes les tâches ?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const prevTasks = tasks;
                      setTasks((prev) => prev.filter((t) => t.task_type !== "VEHICLE_RECOVERY"));
                      setIsClearingQueue(false);
                      try {
                        const res = await fetch("/api/field-tasks?type=VEHICLE_RECOVERY", { method: "DELETE" });
                        if (res.ok) {
                          toast.success("File de récupération vidée avec succès");
                          notifyMutation("tickets");
                        } else {
                          setTasks(prevTasks);
                          toast.error("Échec du vidage de la file");
                        }
                      } catch (e) {
                        setTasks(prevTasks);
                        console.error(e);
                        toast.error("Erreur réseau");
                      }
                    }}
                    className="text-2xs bg-red-600 text-white font-bold px-2 py-1 rounded-lg hover:bg-red-700 cursor-pointer"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsClearingQueue(false)}
                    className="text-2xs bg-gray-200 text-gray-700 font-medium px-2 py-1 rounded-lg hover:bg-gray-300 cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsClearingQueue(true)}
                  className="px-3 py-1.5 text-xs font-bold text-red-700 hover:text-red-900 bg-white dark:bg-slate-800 hover:bg-red-50 border border-red-200 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="Vider la liste des missions de récupération"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vider la file</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Section Cards Content */}
        <div className="p-4 sm:p-5">
          {sectionTasks.length === 0 ? (
            <div className="py-12 text-center bg-gray-50/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
              <span className="text-3xl block mb-2">{config.icon}</span>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Aucune tâche de {title.toLowerCase()} en cours
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Les nouvelles interventions apparaîtront ici automatiquement dès leur assignation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sectionTasks.map(renderTaskCard)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Checkups Due Section
  const renderCheckupsDueSection = () => {
    const config = TASK_TYPE_CONFIG["MONTHLY_CHECKUP"];
    const pending = checkupsDue.length;

    // Filter checkups by search
    const filteredCheckups = checkupsDue.filter((v) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        v.plate_number.toLowerCase().includes(q) ||
        v.make_model.toLowerCase().includes(q) ||
        (v.assigned_driver_name && v.assigned_driver_name.toLowerCase().includes(q)) ||
        (v.assigned_driver_phone && v.assigned_driver_phone.toLowerCase().includes(q))
      );
    });

    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-blue-50/70 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📋</span>
            <h3 className="text-base font-bold text-blue-900 dark:text-white">
              Contrôles Techniques Mensuels Dus
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white bg-blue-600">
              {pending}
            </span>
          </div>
          <span className="text-2xs text-gray-500 font-medium">
            Inspections mécaniques programmées pour le parc
          </span>
        </div>

        {/* List of Vehicles Due for Checkup */}
        <div className="p-4 sm:p-5">
          {filteredCheckups.length === 0 ? (
            <div className="py-12 text-center bg-gray-50/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
              <span className="text-3xl block mb-2">🎉</span>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Tous les contrôles mensuels sont à jour !
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Aucun véhicule du parc n&apos;est en retard pour son inspection périodique.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredCheckups.map((vehicle) => {
                const waLink = getWhatsAppLink(vehicle.assigned_driver_phone);

                return (
                  <div
                    key={vehicle.vehicle_id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3.5"
                  >
                    <div>
                      {/* Plate & Model */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <MoroccanPlateBadge plate={vehicle.plate_number} />
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            {vehicle.make_model}
                          </span>
                        </div>

                        {/* Health Score Pill */}
                        {vehicle.previous_health_score !== null && (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                              vehicle.previous_health_score >= 4
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : vehicle.previous_health_score >= 3
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            ⭐ {vehicle.previous_health_score} / 5
                          </span>
                        )}
                      </div>

                      {/* Expiry Alerts */}
                      {vehicle.urgent_docs && vehicle.urgent_docs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {vehicle.urgent_docs.map((doc, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded-lg text-2xs font-bold border flex items-center gap-1 ${
                                doc.is_expired
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              <span>{doc.is_expired ? "🚨" : "⚠️"}</span>
                              <span>
                                {doc.name} : {doc.is_expired ? `Expiré (${Math.abs(doc.days_left)}j retard)` : `Expire dans ${doc.days_left}j`}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Driver Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-xl bg-gray-50/80 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800/80 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {vehicle.assigned_driver_name || "Sans chauffeur"}
                          </div>
                        </div>

                        {vehicle.assigned_driver_phone && (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${vehicle.assigned_driver_phone}`}
                              className="inline-flex items-center gap-1 text-3xs font-bold bg-white text-gray-700 hover:bg-navy hover:text-white border border-gray-200 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                            >
                              <Phone className="w-3 h-3 text-blue-600" />
                              <span>Appeler</span>
                            </a>
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-3xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-300 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                              >
                                <MessageCircle className="w-3 h-3 text-emerald-600" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Previous inspection date info */}
                      {vehicle.previous_inspection_date && (
                        <div className="text-3xs text-gray-400 font-medium">
                          Dernier contrôle : {new Date(vehicle.previous_inspection_date).toLocaleDateString("fr-FR")}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleViewHistory(vehicle.plate_number, vehicle.vehicle_id)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Historique</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInspectionVehicle(vehicle);
                          setInspectorName("");
                        }}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Réaliser l&apos;Inspection</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col space-y-6">
      {/* Mobile-Optimized Supervisor Quick Actions */}
      <FieldMobileQuickActions
        onSearchPlate={(plate) => setSearchTerm(plate)}
        onStartInspection={() => {
          if (checkupsDue.length > 0) {
            setInspectionVehicle(checkupsDue[0]);
            setInspectorName("");
          } else {
            toast.success("Tous les contrôles mensuels sont à jour !");
          }
        }}
        pendingRecoveriesCount={pendingRecoveries}
      />

      {/* Top Header & New Task Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🛡️</span> Superviseur Terrain — Tâches & Contrôles
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Récupérations de véhicules bloqués, retraits en garage et inspections techniques.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Tâche</span>
        </button>
      </div>

      {/* KPI Metrics Row (Clickable Quick Filters) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Récupérations (Recovery) */}
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "VEHICLE_RECOVERY" ? "ALL" : "VEHICLE_RECOVERY")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === "VEHICLE_RECOVERY"
              ? "bg-red-50 dark:bg-red-950/40 border-red-500 ring-2 ring-red-500/20"
              : "bg-white dark:bg-slate-900 hover:border-red-300 border-gray-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
              Récupérations
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400">
            {pendingRecoveries}
          </div>
          <div className="text-3xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Véhicules bloqués à récupérer
          </div>
        </button>

        {/* Card 2: Retraits Garages (Pickups) */}
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "GARAGE_PICKUP" ? "ALL" : "GARAGE_PICKUP")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === "GARAGE_PICKUP"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/20"
              : "bg-white dark:bg-slate-900 hover:border-amber-300 border-gray-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Retraits Garages
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {pendingPickups}
          </div>
          <div className="text-3xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Véhicules prêts après réparation
          </div>
        </button>

        {/* Card 3: Checkups Dus */}
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "MONTHLY_CHECKUP" ? "ALL" : "MONTHLY_CHECKUP")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === "MONTHLY_CHECKUP"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20"
              : "bg-white dark:bg-slate-900 hover:border-blue-300 border-gray-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Checkups Dus
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
            {checkupsDueCount}
          </div>
          <div className="text-3xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Inspections à réaliser ce mois
          </div>
        </button>

        {/* Card 4: Validés Aujourd'hui */}
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "COMPLETED" ? "ALL" : "COMPLETED")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs ${
            activeTab === "COMPLETED"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-slate-900 hover:border-emerald-300 border-gray-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Validés Aujourd&apos;hui
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {completedTodayCount}
          </div>
          <div className="text-3xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Interventions finalisées
          </div>
        </button>
      </div>

      {/* Category Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "ALL"
              ? "bg-navy text-white shadow-md shadow-navy/20"
              : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-slate-800"
          }`}
        >
          <span>📋</span>
          <span>Toutes les Tâches</span>
          <span className={`px-2 py-0.5 rounded-full text-3xs font-mono font-bold ${
            activeTab === "ALL" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
          }`}>
            {totalActiveTasks}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("VEHICLE_RECOVERY")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "VEHICLE_RECOVERY"
              ? "bg-navy text-white shadow-md shadow-navy/20"
              : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-slate-800"
          }`}
        >
          <span>🚨</span>
          <span>Récupérations</span>
          <span className={`px-2 py-0.5 rounded-full text-3xs font-mono font-bold ${
            activeTab === "VEHICLE_RECOVERY" ? "bg-white/20 text-white" : "bg-red-100 text-red-700"
          }`}>
            {pendingRecoveries}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("GARAGE_PICKUP")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "GARAGE_PICKUP"
              ? "bg-navy text-white shadow-md shadow-navy/20"
              : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-slate-800"
          }`}
        >
          <span>🔧</span>
          <span>Retraits Garages</span>
          <span className={`px-2 py-0.5 rounded-full text-3xs font-mono font-bold ${
            activeTab === "GARAGE_PICKUP" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
          }`}>
            {pendingPickups}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MONTHLY_CHECKUP")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "MONTHLY_CHECKUP"
              ? "bg-navy text-white shadow-md shadow-navy/20"
              : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-slate-800"
          }`}
        >
          <span>📋</span>
          <span>Contrôles Dus</span>
          <span className={`px-2 py-0.5 rounded-full text-3xs font-mono font-bold ${
            activeTab === "MONTHLY_CHECKUP" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-800"
          }`}>
            {checkupsDueCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COMPLETED")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "COMPLETED"
              ? "bg-navy text-white shadow-md shadow-navy/20"
              : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 border border-gray-200 dark:border-slate-800"
          }`}
        >
          <span>✅</span>
          <span>Clôturés</span>
          <span className={`px-2 py-0.5 rounded-full text-3xs font-mono font-bold ${
            activeTab === "COMPLETED" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
          }`}>
            {totalCompletedTasks}
          </span>
        </button>
      </div>

      {/* Search & Quick Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par immatriculation, chauffeur, téléphone..."
              className="w-full pl-10 pr-9 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status & Priority Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy cursor-pointer transition-all"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="PENDING">En attente</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="COMPLETED">Complété</option>
              <option value="FAILED">Échoué</option>
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy cursor-pointer transition-all"
            >
              <option value="ALL">Toutes priorités</option>
              <option value="Critical">🛑 Critique</option>
              <option value="Urgent">⚠️ Urgent</option>
              <option value="Normal">⚪ Normal</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Effacer tous les filtres"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>
            )}
          </div>
        </div>

        {/* Filtered count info */}
        <div className="flex items-center justify-between text-2xs text-gray-500 pt-2 border-t border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <span>
              Affichage de <strong className="text-navy dark:text-white">{filteredTasks.length}</strong> tâche{filteredTasks.length > 1 ? "s" : ""}
            </span>
          </div>

          {hasActiveFilters && (
            <span className="text-navy dark:text-indigo-400 font-bold flex items-center gap-1">
              <span>●</span> Filtres actifs
            </span>
          )}
        </div>
      </div>

      {/* Main Task Queues Content */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
          <Clock className="w-5 h-5 animate-spin text-navy" />
          <span>Chargement des interventions terrain...</span>
        </div>
      ) : (
        <div className="space-y-6 pb-12">
          {/* Active Tab Logic */}
          {activeTab === "ALL" && (
            <>
              {renderSection("Vehicle Recovery", "VEHICLE_RECOVERY", recoveryTasks)}
              {renderSection("Garage Pickup", "GARAGE_PICKUP", pickupTasks)}
              {renderCheckupsDueSection()}
            </>
          )}

          {activeTab === "VEHICLE_RECOVERY" && (
            renderSection("Vehicle Recovery", "VEHICLE_RECOVERY", recoveryTasks)
          )}

          {activeTab === "GARAGE_PICKUP" && (
            renderSection("Garage Pickup", "GARAGE_PICKUP", pickupTasks)
          )}

          {activeTab === "MONTHLY_CHECKUP" && (
            renderCheckupsDueSection()
          )}

          {activeTab === "COMPLETED" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 flex items-center justify-between bg-emerald-50/70 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">✅</span>
                  <h3 className="text-base font-bold text-emerald-900 dark:text-white">
                    Historique des Missions Clôturées
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white bg-emerald-600">
                    {filteredTasks.length}
                  </span>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                {filteredTasks.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm">
                    Aucune mission clôturée correspondant aux critères.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredTasks.map(renderTaskCard)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-7 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🛡️</span>
              <span>Créer une Tâche Terrain</span>
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Type de Tâche *
                </label>
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="VEHICLE_RECOVERY">🚨 Récupération de Véhicule</option>
                  <option value="GARAGE_PICKUP">🔧 Retrait au Garage</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Matricule</label>
                  <input
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    placeholder="ex: 21527-Y-6"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Nom Chauffeur</label>
                  <input
                    value={newDriver}
                    onChange={(e) => setNewDriver(e.target.value)}
                    placeholder="Nom du chauffeur"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Priorité</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Critical">Critique</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Assigné à</label>
                  <input
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    placeholder="Nom du superviseur"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {newTaskType === "MONTHLY_CHECKUP" && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Date d&apos;échéance</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Description / Consignes *</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Consignes précises pour le superviseur terrain..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreateTask}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Créer la Tâche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Mechanical Inspection Form Modal */}
      {inspectionVehicle && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-7 w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl my-auto border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span>📋</span>
              <span>Contrôle Mécanique du Véhicule</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
              Véhicule : <strong className="text-slate-900 dark:text-white">{inspectionVehicle.plate_number}</strong> • Notez chaque élément de 1 (Critique) à 5 (Excellent)
            </p>

            <div className="mb-5">
              <h4 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                Rapport Visuel 3D des Dommages
              </h4>
              <CarModel3D damagedParts={damagedParts} onChange={setDamagedParts} />
            </div>

            {/* Overall Score Preview */}
            <div
              className={`p-4 rounded-xl text-center mb-5 border-2 transition-all ${
                inspAvg >= 4
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
                  : inspAvg >= 3
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                  : inspAvg >= 1
                  ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              }`}
            >
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score Global de Santé</div>
              <div
                className={`text-3xl sm:text-4xl font-extrabold mt-1 ${
                  inspAvg >= 4
                    ? "text-emerald-600 dark:text-emerald-400"
                    : inspAvg >= 3
                    ? "text-amber-600 dark:text-amber-400"
                    : inspAvg >= 1
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-400"
                }`}
              >
                {inspAvg > 0 ? `${inspAvg} / 5` : "—"}
              </div>
            </div>

            {/* Inputs: 1 col on mobile, 2 cols on laptop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Nom de l&apos;Inspecteur *</label>
                <input
                  type="text"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  placeholder="Votre nom"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Kilométrage Actuel (KM)</label>
                <input
                  type="number"
                  value={inspMileage}
                  onChange={(e) => setInspMileage(e.target.value)}
                  placeholder="ex: 45000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Scored Checkpoints */}
            <div className="flex flex-col gap-2.5 mb-5">
              {Object.entries(CHECKPOINT_LABELS).map(([key, cp]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl w-7 text-center">{cp.icon}</span>
                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{cp.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{cp.hint}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
                    {[1, 2, 3, 4, 5].map((score) => {
                      const sl = SCORE_LABELS[score];
                      const isSelected = inspScores[key] === score;
                      return (
                        <button
                          type="button"
                          key={score}
                          onClick={() => setInspScores({ ...inspScores, [key]: score })}
                          title={sl.label}
                          className="flex-1 sm:flex-initial w-10 sm:w-9 h-10 sm:h-9 rounded-lg font-bold text-sm transition-all cursor-pointer flex items-center justify-center active:scale-95 border-2 shadow-xs"
                          style={{
                            borderColor: isSelected ? sl.color : "#e2e8f0",
                            background: isSelected ? sl.bg : "#ffffff",
                            color: isSelected ? sl.color : "#94a3b8",
                          }}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Remarques de l&apos;Inspecteur</label>
              <textarea
                value={inspNotes}
                onChange={(e) => setInspNotes(e.target.value)}
                rows={3}
                placeholder="Problèmes constatés, recommandations..."
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setInspectionVehicle(null);
                  setDamagedParts([]);
                }}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmitInspection}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Valider l&apos;Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Past Inspections History Modal */}
      {viewInspections !== null && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📊</span> Historique des Contrôles — {viewPlate}
              </h3>
              <button
                type="button"
                onClick={() => setViewInspections(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            {viewInspections.length === 0 ? (
              <div className="py-12 text-center text-slate-400">Aucun contrôle antérieur trouvé.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {viewInspections.map((insp) => {
                  const delta = insp.health_score - insp.previous_health_score;
                  const hasPrev = insp.previous_health_score > 0;
                  return (
                    <div key={insp.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 p-3.5 sm:p-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {new Date(insp.inspection_date).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="mx-2 text-slate-400">•</span>
                          <span>par {insp.inspector_name}</span>
                          <span className="mx-2 text-slate-400">•</span>
                          <span className="font-semibold">{insp.current_mileage.toLocaleString()} KM</span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setAttestationData({
                                fullName: insp.vehicle?.assigned_driver_name || "",
                                cin: insp.vehicle?.driver_cin || "",
                                brand: insp.vehicle?.make_model || "",
                                immat: insp.plate_number,
                                chassisNumber: insp.vehicle?.vin || "",
                                date: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(insp.inspection_date)),
                                inspectionId: insp.id,
                              });
                              setShowAttestationModal(true);
                            }}
                            title="Générer et imprimer l'attestation de location"
                            className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <span>🖨️</span> Attestation
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`text-xl sm:text-2xl font-black ${
                              insp.health_score >= 4 ? "text-emerald-600 dark:text-emerald-400" : insp.health_score >= 3 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                            }`}>
                              {insp.health_score}/5
                            </span>
                            {hasPrev && (
                              <span className={`text-xs font-bold ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                                {delta > 0 ? `▲ +${delta.toFixed(1)}` : delta < 0 ? `▼ ${delta.toFixed(1)}` : "→ 0"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {Object.entries(CHECKPOINT_LABELS).map(([key, cp]) => {
                          const val = (insp as any)[key] as number;
                          const sl = SCORE_LABELS[val] || { label: "N/A", color: "#9ca3af", bg: "#f3f4f6" };
                          return (
                            <div key={key} className="text-center p-2 rounded-lg border border-slate-200 dark:border-slate-700/60" style={{ background: val > 0 ? sl.bg : "#f8fafc" }}>
                              <div className="text-base">{cp.icon}</div>
                              <div className="text-xs font-bold" style={{ color: val > 0 ? sl.color : "#94a3b8" }}>{val > 0 ? val : "—"}</div>
                              <div className="text-[10px] text-slate-600 truncate">{cp.label}</div>
                            </div>
                          );
                        })}
                      </div>
                      {insp.notes && (
                        <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          📝 {insp.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setViewInspections(null)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-600 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Fail Task Modal */}
      {failingTask && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-red-200 dark:border-red-900/50">
            <div className="p-4 sm:p-5 border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 flex items-center justify-between">
              <h3 className="text-base font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-600" />
                <span>Signaler un Échec de Mission</span>
              </h3>
              <button
                type="button"
                onClick={() => setFailingTask(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleFailSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Motif de l&apos;échec ou du blocage *
                </label>
                <input
                  required
                  autoFocus
                  placeholder="ex: Chauffeur injoignable, fourrière fermée, police requise..."
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setFailingTask(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Enregistrer l&apos;Échec
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Vehicle Recovery Handover Checklist Modal */}
      {recoveryModalTask && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl border border-red-200 dark:border-red-900/50 my-auto">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-black flex items-center gap-2">
                  <span>🚨</span>
                  <span>Récupération de Véhicule Bloqué</span>
                </h3>
                <p className="text-xs text-red-100 mt-1">
                  Checklist de restitution & réintégration automatique dans la flotte active.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecoveryModalTask(null)}
                className="text-white/80 hover:text-white text-xl p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRecovery} className="p-5 sm:p-6 space-y-4">
              {/* Vehicle & Duration Strip */}
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <MoroccanPlateBadge plate={recoveryModalTask.plate_number} />
                  <span className="bg-red-600 text-white px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
                    ⏱️ {Math.max(0.1, (Date.now() - new Date(recoveryModalTask.created_at).getTime()) / (1000 * 3600)).toFixed(1)}h écoulées
                  </span>
                </div>
                {recoveryModalTask.driver_name && (
                  <div className="text-xs text-red-900 dark:text-red-200 font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Chauffeur : <strong>{recoveryModalTask.driver_name}</strong> {recoveryModalTask.driver_phone ? `(${recoveryModalTask.driver_phone})` : ""}</span>
                  </div>
                )}
                {recoveryModalTask.description && (
                  <div className="text-2xs text-red-700 dark:text-red-300 italic bg-white/60 dark:bg-slate-800/60 p-2 rounded-lg border border-red-100 dark:border-red-900/30">
                    Motif : {recoveryModalTask.description}
                  </div>
                )}
              </div>

              {/* Handover Checklist Elements */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  📋 Éléments Physiques Récupérés :
                </label>

                {/* Key Checklist Item */}
                <div
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    hasKey
                      ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50"
                      : "bg-red-50/80 border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔑</span>
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">Clé du Véhicule</div>
                      <div className="text-3xs text-gray-500 dark:text-gray-400">Clé physique ou double officiel récupéré</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasKey(!hasKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                      hasKey ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                    }`}
                  >
                    {hasKey ? "✓ Récupérée" : "✗ Manquante"}
                  </button>
                </div>

                {/* Carte Grise Checklist Item */}
                <div
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    hasCarteGrise
                      ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50"
                      : "bg-red-50/80 border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📄</span>
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">Carte Grise Originale</div>
                      <div className="text-3xs text-gray-500 dark:text-gray-400">Certificat d&apos;immatriculation du véhicule</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasCarteGrise(!hasCarteGrise)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                      hasCarteGrise ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                    }`}
                  >
                    {hasCarteGrise ? "✓ Récupérée" : "✗ Manquante"}
                  </button>
                </div>

                {/* Assurance Checklist Item */}
                <div
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    hasAssurance
                      ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50"
                      : "bg-red-50/80 border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🛡️</span>
                    <div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">Attestation d&apos;Assurance</div>
                      <div className="text-3xs text-gray-500 dark:text-gray-400">Papier d&apos;assurance valide dans la boîte à gants</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasAssurance(!hasAssurance)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                      hasAssurance ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                    }`}
                  >
                    {hasAssurance ? "✓ Récupérée" : "✗ Manquante"}
                  </button>
                </div>
              </div>

              {/* Notes & Observations */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Remarques / Observations sur l&apos;état du véhicule :
                </label>
                <textarea
                  rows={2}
                  value={recoveryNotes}
                  onChange={(e) => setRecoveryNotes(e.target.value)}
                  placeholder="Ex: Véhicule stationné au dépôt, état carrosserie conforme, propreté OK..."
                  className="w-full px-3.5 py-2 text-xs border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                />
              </div>

              {/* Notice */}
              <div className="text-2xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                ℹ️ <strong>Action automatique :</strong> En validant, le ticket de support sera clôturé (<em>RESOLVED</em>) et le véhicule sera réactivé avec le statut <strong>Available</strong>.
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRecoveryModalTask(null)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isRecoverySubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <span>{isRecoverySubmitting ? "Validation..." : "✅ Confirmer la Récupération"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Generated Attestation Modal */}
      {attestationData && (
        <AttestationModal
          data={attestationData}
          isOpen={showAttestationModal}
          onClose={() => setShowAttestationModal(false)}
        />
      )}
    </div>
  );
}

