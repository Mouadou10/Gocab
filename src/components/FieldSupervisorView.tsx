"use client";

/**
 * FieldSupervisorView — Physical Field Intervention Task Queue
 *
 * Three task categories:
 * 1. 🚨 Vehicle Recovery — impounded/accident vehicles needing retrieval
 * 2. 🔧 Garage Pickup — resolved maintenance tickets, vehicle ready to return
 * 3. 📋 Monthly Checkups — auto-generated vehicle mechanical inspections with scoring
 *
 * Includes mechanical inspection form with 10-point scored checklist and 
 * month-over-month health score comparison.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import CarModel3D from "./CarModel3D";

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
}

const SCORE_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Critical", color: "#b91c1c", bg: "#fecaca" },
  2: { label: "Poor", color: "#c2410c", bg: "#fed7aa" },
  3: { label: "Fair", color: "#b45309", bg: "#fef3c7" },
  4: { label: "Good", color: "#15803d", bg: "#dcfce7" },
  5: { label: "Excellent", color: "#047857", bg: "#a7f3d0" },
};

const CHECKPOINT_LABELS: Record<string, { label: string; icon: string; hint: string }> = {
  brakes_score: { label: "Brakes", icon: "🛑", hint: "Brake pads, discs, fluid" },
  tires_score: { label: "Tires", icon: "🔘", hint: "Tread depth, pressure, condition" },
  engine_score: { label: "Engine", icon: "⚙️", hint: "Noise, performance, leaks" },
  oil_level_score: { label: "Oil Level", icon: "🛢️", hint: "Level, color, viscosity" },
  lights_score: { label: "Lights", icon: "💡", hint: "Headlights, tail, indicators" },
  suspension_score: { label: "Suspension", icon: "🔧", hint: "Shocks, springs, ride comfort" },
  body_condition_score: { label: "Body Condition", icon: "🚗", hint: "Dents, scratches, rust, paint" },
  interior_score: { label: "Interior", icon: "💺", hint: "Seats, dashboard, AC, cleanliness" },
  battery_score: { label: "Battery", icon: "🔋", hint: "Battery health, terminals" },
  exhaust_score: { label: "Exhaust", icon: "💨", hint: "Exhaust system, emissions (AdBleu)" },
};

const TASK_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  VEHICLE_RECOVERY: { icon: "🚨", label: "Vehicle Recovery", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
  GARAGE_PICKUP: { icon: "🔧", label: "Garage Pickup", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  MONTHLY_CHECKUP: { icon: "📋", label: "Monthly Checkup", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
};

export default function FieldSupervisorView() {
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Create task modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTaskType, setNewTaskType] = useState("VEHICLE_RECOVERY");
  const [newPlate, setNewPlate] = useState("");
  const [newDriver, setNewDriver] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("Normal");
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
    brakes_score: 0, tires_score: 0, engine_score: 0, oil_level_score: 0,
    lights_score: 0, suspension_score: 0, body_condition_score: 0,
    interior_score: 0, battery_score: 0, exhaust_score: 0,
  });

  // Past inspections viewer
  const [viewInspections, setViewInspections] = useState<VehicleInspection[] | null>(null);
  const [viewPlate, setViewPlate] = useState("");

  const [failingTask, setFailingTask] = useState<FieldTask | null>(null);
  const [failureReason, setFailureReason] = useState("");

  // Recovery Handover Checklist Modal State
  const [recoveryModalTask, setRecoveryModalTask] = useState<FieldTask | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [hasCarteGrise, setHasCarteGrise] = useState(true);
  const [hasAssurance, setHasAssurance] = useState(true);
  const [recoveryNotes, setRecoveryNotes] = useState("");
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);

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
        toast.success("✅ Véhicule récupéré avec succès ! Le ticket a été clôturé et le véhicule est désormais Disponible.");
        setRecoveryModalTask(null);
        fetchTasks();
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
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("type", filterType);

      const res = await fetch(`/api/field-tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Failed to fetch field tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, filterStatus, filterType]);

  const fetchDueCheckups = useCallback(async () => {
    try {
      const res = await fetch(`/api/inspections/due`);
      const data = await res.json();
      setCheckupsDue(data.checkupsDue || []);
    } catch (err) {
      console.error("Failed to fetch due checkups:", err);
    }
  }, []);

  useEffect(() => { 
    fetchTasks(); 
    fetchDueCheckups();
  }, [fetchTasks, fetchDueCheckups]);

  // Create task
  const handleCreateTask = async () => {
    if (!newDesc) return;
    try {
      await fetch("/api/field-tasks", {
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
      setShowCreateModal(false);
      setNewPlate(""); setNewDriver(""); setNewDesc(""); setNewPriority("Normal"); setNewAssignedTo(""); setNewDueDate("");
      toast.success("Field task created successfully");
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || "Failed to create task");
      console.error("Failed to create task:", err);
    }
  };

  // Update task status
  const handleStatusUpdate = async (task: FieldTask, newStatus: string, failReason?: string) => {
    try {
      await fetch(`/api/field-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, failure_reason: failReason }),
      });
      toast.success("Task status updated");
      fetchTasks();
    } catch (err: any) {
      toast.error(err.message || "Failed to update task status");
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
    
    // Append damaged parts to notes
    const finalNotes = damagedParts.length > 0 
      ? `[Visual Damages: ${damagedParts.join(", ")}]\n${inspNotes}` 
      : inspNotes;

    try {
      await fetch("/api/inspections", {
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
      setInspectionVehicle(null);
      setInspectorName(""); setInspMileage(""); setInspNotes(""); setDamagedParts([]);
      setInspScores({
        brakes_score: 0, tires_score: 0, engine_score: 0, oil_level_score: 0,
        lights_score: 0, suspension_score: 0, body_condition_score: 0,
        interior_score: 0, battery_score: 0, exhaust_score: 0,
      });
      toast.success("Inspection submitted successfully");
      fetchDueCheckups();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit inspection");
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
    try {
      await fetch(`/api/field-tasks/${id}`, { method: "DELETE" });
      fetchTasks();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  // Group tasks by type
  const recoveryTasks = tasks.filter((t) => t.task_type === "VEHICLE_RECOVERY");
  const pickupTasks = tasks.filter((t) => t.task_type === "GARAGE_PICKUP");
  const checkupTasks = tasks.filter((t) => t.task_type === "MONTHLY_CHECKUP");

  // Inspection avg for form preview
  const inspAvg = (() => {
    const vals = Object.values(inspScores).filter((v) => v > 0);
    return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  })();

  const renderTaskCard = (task: FieldTask) => {
    const config = TASK_TYPE_CONFIG[task.task_type] || TASK_TYPE_CONFIG.VEHICLE_RECOVERY;
    const isCompleted = task.status === "COMPLETED";
    return (
      <div key={task.id} style={{
        background: isCompleted ? "#f9fafb" : "#fff",
        border: `1px solid ${isCompleted ? "#e5e7eb" : config.border}`,
        borderRadius: 10, padding: 16, opacity: isCompleted ? 0.7 : 1,
        transition: "all 0.2s",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{config.icon}</span>
            <span style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 15 }}>{task.plate_number || "No Plate"}</span>
            {task.assigned_to && (
              <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#e0e7ff", color: "#4338ca", fontWeight: 600 }}>
                👤 {task.assigned_to}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{
              padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
              background: task.priority === "Critical" ? "#fecaca" : task.priority === "Urgent" ? "#fef3c7" : "#e5e7eb",
              color: task.priority === "Critical" ? "#b91c1c" : task.priority === "Urgent" ? "#92400e" : "#374151",
            }}>{task.priority}</span>
            <span style={{
              padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
              background: task.status === "COMPLETED" ? "#dcfce7" : task.status === "IN_PROGRESS" ? "#dbeafe" : task.status === "FAILED" ? "#fef2f2" : "#fef3c7",
              color: task.status === "COMPLETED" ? "#15803d" : task.status === "IN_PROGRESS" ? "#1d4ed8" : task.status === "FAILED" ? "#dc2626" : "#92400e",
            }}>{task.status}</span>
          </div>
        </div>

        {task.status === "FAILED" && task.failure_reason && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "8px 12px", borderRadius: 6, fontSize: 13, marginBottom: 8 }}>
            <strong>Failed:</strong> {task.failure_reason}
          </div>
        )}

        {task.driver_name && (
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
            Driver: <strong>{task.driver_name}</strong> {task.driver_phone && `(${task.driver_phone})`}
          </div>
        )}

        <p style={{ margin: "4px 0 10px", fontSize: 13, color: "#374151", lineHeight: 1.4 }}>{task.description}</p>

        {task.due_date && (
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
            📅 Due: {new Date(task.due_date).toLocaleDateString()}
          </div>
        )}

        {task.task_type === "VEHICLE_RECOVERY" && (
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}>
              ⏱️ {task.status === "COMPLETED" 
                ? `Durée: ${task.recovery_duration_hours ?? 'N/A'}h` 
                : `${Math.max(0.1, (Date.now() - new Date(task.created_at).getTime()) / (1000 * 3600)).toFixed(1)}h depuis blocage`}
            </span>

            {task.status === "COMPLETED" && (
              <span style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>
                [Clé: {task.has_key ? "✓" : "✗"} · CG: {task.has_carte_grise ? "✓" : "✗"} · Assur: {task.has_assurance ? "✓" : "✗"}]
              </span>
            )}
          </div>
        )}

        {task.completed_at && (
          <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 8 }}>
            ✅ Completed: {new Date(task.completed_at).toLocaleString()}
          </div>
        )}

        {!isCompleted && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {task.task_type === "VEHICLE_RECOVERY" ? (
              <button 
                onClick={() => handleOpenRecoveryModal(task)}
                style={{ 
                  padding: "6px 14px", 
                  background: "#b91c1c", 
                  color: "#fff", 
                  border: "none", 
                  borderRadius: 8, 
                  fontSize: 12, 
                  fontWeight: 700, 
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 4px rgba(185, 28, 28, 0.2)"
                }}
              >
                ⚡ Récupérer (Checklist Handover)
              </button>
            ) : (
              <>
                {task.status === "PENDING" && (
                  <button onClick={() => handleStatusUpdate(task, "IN_PROGRESS")}
                    style={{ padding: "5px 12px", background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    ▶ Start
                  </button>
                )}
                {task.task_type === "MONTHLY_CHECKUP" && task.status !== "COMPLETED" && (
                  <button onClick={() => { setInspectionVehicle(task as any); setInspectorName(""); }}
                    style={{ padding: "5px 12px", background: "#e0e7ff", color: "#4338ca", border: "1px solid #c7d2fe", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    📝 Inspection Form
                  </button>
                )}
                {task.task_type === "MONTHLY_CHECKUP" && task.vehicle_id && task.plate_number && (
                  <button onClick={() => handleViewHistory(task.plate_number!, task.vehicle_id!)}
                    style={{ padding: "5px 12px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    📊 History
                  </button>
                )}
                {(task.status === "IN_PROGRESS" || (task.task_type !== "MONTHLY_CHECKUP")) && (
                  <>
                    <button onClick={() => handleStatusUpdate(task, "COMPLETED")}
                      style={{ padding: "5px 12px", background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      ✅ Complete
                    </button>
                    <button onClick={() => { setFailingTask(task); setFailureReason(""); }}
                      style={{ padding: "5px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      ❌ Fail
                    </button>
                  </>
                )}
              </>
            )}
            <button onClick={() => handleDeleteTask(task.id)}
              style={{ padding: "5px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              🗑
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, type: string, sectionTasks: FieldTask[]) => {
    const config = TASK_TYPE_CONFIG[type];
    const pending = sectionTasks.filter((t) => t.status !== "COMPLETED").length;
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: config.bg, border: `1px solid ${config.border}`,
          borderRadius: "12px 12px 0 0",
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: config.color }}>
            {config.icon} {config.label}
            {pending > 0 && (
              <span style={{
                marginLeft: 8, padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: config.color, color: "#fff",
              }}>{pending}</span>
            )}
          </h3>
        </div>
        <div style={{
          border: `1px solid ${config.border}`, borderTop: "none",
          borderRadius: "0 0 12px 12px", padding: 12,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {sectionTasks.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              No {config.label.toLowerCase()} tasks.
            </div>
          ) : (
            sectionTasks.map(renderTaskCard)
          )}
        </div>
      </div>
    );
  };

  const renderCheckupsDueSection = () => {
    const config = TASK_TYPE_CONFIG["MONTHLY_CHECKUP"];
    const pending = checkupsDue.length;
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: config.bg, border: `1px solid ${config.border}`,
          borderRadius: "12px 12px 0 0",
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: config.color }}>
            {config.icon} Monthly Checkups Due
            {pending > 0 && (
              <span style={{
                marginLeft: 8, padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: config.color, color: "#fff",
              }}>{pending}</span>
            )}
          </h3>
        </div>
        <div style={{
          border: `1px solid ${config.border}`, borderTop: "none",
          borderRadius: "0 0 12px 12px", padding: 12,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {checkupsDue.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              No monthly checkups due!
            </div>
          ) : (
            checkupsDue.map((vehicle) => (
              <div key={vehicle.vehicle_id} style={{
                background: "#fff",
                border: `1px solid ${config.border}`,
                borderRadius: 10, padding: 16,
                transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{config.icon}</span>
                    <span style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 15 }}>{vehicle.plate_number}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{vehicle.make_model}</span>
                  </div>
                </div>

                {vehicle.assigned_driver_name && (
                  <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                    Driver: <strong>{vehicle.assigned_driver_name}</strong> {vehicle.assigned_driver_phone && `(${vehicle.assigned_driver_phone})`}
                  </div>
                )}
                
                {vehicle.previous_health_score !== null && (
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
                    Last Score: <strong>{vehicle.previous_health_score}/5</strong> 
                    <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 6 }}>
                      ({new Date(vehicle.previous_inspection_date!).toLocaleDateString()})
                    </span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  <button onClick={() => { setInspectionVehicle(vehicle); setInspectorName(""); }}
                    style={{ padding: "5px 12px", background: "#e0e7ff", color: "#4338ca", border: "1px solid #c7d2fe", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    📝 Inspection Form
                  </button>
                  <button onClick={() => handleViewHistory(vehicle.plate_number, vehicle.vehicle_id)}
                    style={{ padding: "5px 12px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    📊 History
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
            🛡️ Field Supervisor — Task Queue
          </h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Vehicle recovery, garage pickups, and monthly mechanical inspections.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Search plate, driver..."
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, width: 200 }}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <button onClick={() => setShowCreateModal(true)}
            style={{
              padding: "8px 16px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14,
            }}>
            + New Task
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fef2f2", padding: 16, borderRadius: 10, border: "1px solid #fca5a5" }}>
          <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Recovery</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#b91c1c", marginTop: 2 }}>{recoveryTasks.filter((t) => t.status !== "COMPLETED").length}</div>
        </div>
        <div style={{ background: "#fff7ed", padding: 16, borderRadius: 10, border: "1px solid #fed7aa" }}>
          <div style={{ fontSize: 11, color: "#c2410c", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Garage Pickup</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#c2410c", marginTop: 2 }}>{pickupTasks.filter((t) => t.status !== "COMPLETED").length}</div>
        </div>
        <div style={{ background: "#eff6ff", padding: 16, borderRadius: 10, border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Checkups Due</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1d4ed8", marginTop: 2 }}>{checkupsDue.length}</div>
        </div>
        <div style={{ background: "#f0fdf4", padding: 16, borderRadius: 10, border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 11, color: "#15803d", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Completed Today</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#15803d", marginTop: 2 }}>
            {tasks.filter((t) => t.status === "COMPLETED" && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString()).length}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>Loading tasks...</div>
      ) : (
        <>
          {renderSection("Vehicle Recovery", "VEHICLE_RECOVERY", recoveryTasks)}
          {renderSection("Garage Pickup", "GARAGE_PICKUP", pickupTasks)}
          {renderCheckupsDueSection()}
        </>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 460, maxWidth: "90vw", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>🛡️ Create Field Task</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Task Type *</label>
                <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}>
                  <option value="VEHICLE_RECOVERY">🚨 Vehicle Recovery</option>
                  <option value="GARAGE_PICKUP">🔧 Garage Pickup</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Vehicle Plate</label>
                  <input value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="e.g. 12345-A-6"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Driver Name</label>
                  <input value={newDriver} onChange={(e) => setNewDriver(e.target.value)} placeholder="Driver name"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Priority</label>
                  <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}>
                    <option>Normal</option>
                    <option>Urgent</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Assigned To</label>
                  <input value={newAssignedTo} onChange={(e) => setNewAssignedTo(e.target.value)} placeholder="Supervisor name"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
              </div>
              {newTaskType === "MONTHLY_CHECKUP" && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Due Date</label>
                  <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Description *</label>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Task details..."
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreateModal(false)}
                style={{ padding: "8px 18px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreateTask}
                style={{ padding: "8px 18px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Mechanical Inspection Form Modal */}
      {inspectionVehicle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 580, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.15)", margin: "20px 0" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>
              📋 Vehicle Mechanical Inspection
            </h3>
            <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: 14 }}>
              Vehicle: <strong>{inspectionVehicle.plate_number}</strong> • Rate each checkpoint from 1 (Critical) to 5 (Excellent)
            </p>

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#374151" }}>Advanced 3D Damage Report</h4>
              <CarModel3D damagedParts={damagedParts} onChange={setDamagedParts} />
            </div>

            {/* Overall Score Preview */}
            <div style={{
              background: inspAvg >= 4 ? "#f0fdf4" : inspAvg >= 3 ? "#fffbeb" : inspAvg >= 1 ? "#fef2f2" : "#f9fafb",
              border: `2px solid ${inspAvg >= 4 ? "#bbf7d0" : inspAvg >= 3 ? "#fde68a" : inspAvg >= 1 ? "#fca5a5" : "#e5e7eb"}`,
              borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 18,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>Overall Health Score</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: inspAvg >= 4 ? "#15803d" : inspAvg >= 3 ? "#b45309" : inspAvg >= 1 ? "#b91c1c" : "#9ca3af" }}>
                {inspAvg > 0 ? `${inspAvg} / 5` : "—"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Inspector Name *</label>
                <input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} placeholder="Your name"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Current Mileage (KM)</label>
                <input type="number" value={inspMileage} onChange={(e) => setInspMileage(e.target.value)} placeholder="e.g. 45000"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Scored Checkpoints */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {Object.entries(CHECKPOINT_LABELS).map(([key, cp]) => (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb",
                }}>
                  <span style={{ fontSize: 18, width: 28 }}>{cp.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a2e" }}>{cp.label}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{cp.hint}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((score) => {
                      const sl = SCORE_LABELS[score];
                      const isSelected = inspScores[key] === score;
                      return (
                        <button key={score} onClick={() => setInspScores({ ...inspScores, [key]: score })}
                          title={sl.label}
                          style={{
                            width: 34, height: 34, borderRadius: 6, border: `2px solid ${isSelected ? sl.color : "#e5e7eb"}`,
                            background: isSelected ? sl.bg : "#fff", color: isSelected ? sl.color : "#9ca3af",
                            fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.15s",
                          }}>
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Inspector Notes</label>
              <textarea value={inspNotes} onChange={(e) => setInspNotes(e.target.value)} rows={3} placeholder="Issues found, recommendations..."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => { setInspectionVehicle(null); setDamagedParts([]); }}
                style={{ padding: "8px 18px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSubmitInspection}
                style={{ padding: "8px 18px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                Submit Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past Inspections History Modal */}
      {viewInspections !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 640, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>
              📊 Inspection History — {viewPlate}
            </h3>
            {viewInspections.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>No previous inspections found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {viewInspections.map((insp, idx) => {
                  const delta = insp.health_score - insp.previous_health_score;
                  const hasPrev = insp.previous_health_score > 0;
                  return (
                    <div key={insp.id} style={{ background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>
                            {new Date(insp.inspection_date).toLocaleDateString()}
                          </span>
                          <span style={{ margin: "0 8px", color: "#9ca3af" }}>•</span>
                          <span style={{ color: "#6b7280", fontSize: 13 }}>by {insp.inspector_name}</span>
                          <span style={{ margin: "0 8px", color: "#9ca3af" }}>•</span>
                          <span style={{ color: "#6b7280", fontSize: 13 }}>{insp.current_mileage.toLocaleString()} KM</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 22, fontWeight: 800,
                            color: insp.health_score >= 4 ? "#15803d" : insp.health_score >= 3 ? "#b45309" : "#b91c1c",
                          }}>
                            {insp.health_score}/5
                          </span>
                          {hasPrev && (
                            <span style={{
                              fontSize: 13, fontWeight: 700,
                              color: delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : "#6b7280",
                            }}>
                              {delta > 0 ? `▲ +${delta.toFixed(1)}` : delta < 0 ? `▼ ${delta.toFixed(1)}` : "→ 0"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                        {Object.entries(CHECKPOINT_LABELS).map(([key, cp]) => {
                          const val = (insp as any)[key] as number;
                          const sl = SCORE_LABELS[val] || { label: "N/A", color: "#9ca3af", bg: "#f3f4f6" };
                          return (
                            <div key={key} style={{ textAlign: "center", padding: "6px 4px", borderRadius: 6, background: val > 0 ? sl.bg : "#f3f4f6" }}>
                              <div style={{ fontSize: 14 }}>{cp.icon}</div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: val > 0 ? sl.color : "#9ca3af" }}>{val > 0 ? val : "—"}</div>
                              <div style={{ fontSize: 9, color: "#9ca3af" }}>{cp.label}</div>
                            </div>
                          );
                        })}
                      </div>
                      {insp.notes && (
                        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#374151", fontStyle: "italic" }}>
                          📝 {insp.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setViewInspections(null)}
                style={{ padding: "8px 18px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Fail Task Modal */}
      {failingTask && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 400, borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", background: "#fef2f2" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#991b1b", fontWeight: 700 }}>Fail Task</h3>
            </div>
            <form onSubmit={handleFailSubmit} style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Reason for failure *</label>
                <input required autoFocus placeholder="e.g. Driver didn't answer, Garage was closed" value={failureReason} onChange={e => setFailureReason(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setFailingTask(null)} style={{ padding: "8px 16px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "8px 16px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Submit Failure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Recovery Handover Checklist Modal */}
      {recoveryModalTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", border: "1px solid #fee2e2" }}>
            
            {/* Modal Header */}
            <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #991b1b, #b91c1c)", color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🚨</span> Récupération de Véhicule Bloqué
                </h3>
                <button 
                  type="button" 
                  onClick={() => setRecoveryModalTask(null)} 
                  style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", opacity: 0.8 }}
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.9 }}>
                Checklist de restitution & réintégration automatique dans le pool Disponible
              </p>
            </div>

            <form onSubmit={handleConfirmRecovery} style={{ padding: 24 }}>
              
              {/* Vehicle & KPI Strip */}
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 14, marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#991b1b" }}>
                    🚗 {recoveryModalTask.plate_number || "Véhicule"}
                  </span>
                  <span style={{ background: "#991b1b", color: "#fff", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    ⏱️ {Math.max(0.1, (Date.now() - new Date(recoveryModalTask.created_at).getTime()) / (1000 * 3600)).toFixed(1)}h écoulées
                  </span>
                </div>
                {recoveryModalTask.driver_name && (
                  <div style={{ fontSize: 12, color: "#7f1d1d" }}>
                    Chauffeur: <strong>{recoveryModalTask.driver_name}</strong> {recoveryModalTask.driver_phone && `(${recoveryModalTask.driver_phone})`}
                  </div>
                )}
                {recoveryModalTask.description && (
                  <div style={{ fontSize: 11, color: "#991b1b", marginTop: 4, fontStyle: "italic" }}>
                    Motif: {recoveryModalTask.description}
                  </div>
                )}
              </div>

              {/* Document & Key Handover Checklist */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>
                  📋 Checklist des Éléments Récupérés :
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  
                  {/* Key Checkbox */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 10,
                    background: hasKey ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${hasKey ? "#bbf7d0" : "#fecaca"}`,
                    transition: "all 0.2s"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🔑</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Clé du Véhicule</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>Clé physique ou double récupéré</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasKey(!hasKey)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: hasKey ? "#16a34a" : "#dc2626",
                        color: "#fff"
                      }}
                    >
                      {hasKey ? "✓ Récupérée" : "✗ Manquante"}
                    </button>
                  </div>

                  {/* Carte Grise Checkbox */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 10,
                    background: hasCarteGrise ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${hasCarteGrise ? "#bbf7d0" : "#fecaca"}`,
                    transition: "all 0.2s"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Carte Grise Originale</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>Certificat d'immatriculation</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasCarteGrise(!hasCarteGrise)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: hasCarteGrise ? "#16a34a" : "#dc2626",
                        color: "#fff"
                      }}
                    >
                      {hasCarteGrise ? "✓ Récupérée" : "✗ Manquante"}
                    </button>
                  </div>

                  {/* Assurance Checkbox */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 10,
                    background: hasAssurance ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${hasAssurance ? "#bbf7d0" : "#fecaca"}`,
                    transition: "all 0.2s"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🛡️</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Attestation d'Assurance</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>Document d'assurance en cours</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasAssurance(!hasAssurance)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: hasAssurance ? "#16a34a" : "#dc2626",
                        color: "#fff"
                      }}
                    >
                      {hasAssurance ? "✓ Récupérée" : "✗ Manquante"}
                    </button>
                  </div>

                </div>
              </div>

              {/* Notes & Remarks */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                  Remarques / Observations sur l'état du véhicule :
                </label>
                <textarea
                  rows={2}
                  value={recoveryNotes}
                  onChange={(e) => setRecoveryNotes(e.target.value)}
                  placeholder="Ex: Véhicule stationné au dépôt, carrosserie intacte..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
              </div>

              {/* Auto Action Note */}
              <div style={{ fontSize: 11, color: "#64748b", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, marginBottom: 18, border: "1px solid #e2e8f0" }}>
                ℹ️ <strong>Action automatique :</strong> En validant, le ticket de support sera clôturé (<em>RESOLVED</em>) et le véhicule passera immédiatement au statut <strong>Available</strong>.
              </div>

              {/* Modal Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRecoveryModalTask(null)}
                  style={{
                    padding: "10px 18px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isRecoverySubmitting}
                  style={{
                    padding: "10px 20px",
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
                    opacity: isRecoverySubmitting ? 0.6 : 1
                  }}
                >
                  {isRecoverySubmitting ? "Validation…" : "✅ Confirmer la Récupération"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
