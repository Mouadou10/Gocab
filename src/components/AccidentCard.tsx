"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

export interface AccidentComment {
  id: string;
  comment: string;
  timeline_step: string;
  author?: string | null;
  created_at: string;
}

export interface AccidentClaim {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  severity: "HARD" | "SOFT" | null;
  fault: "DRIVER" | "THIRD_PARTY" | null;
  timeline_step: "NEW_ACCIDENT" | "CAR_IN_GARAGE" | "STARTING_REPAIR" | "INSURANCE_DOCS" | "READY_FOR_PICKUP" | "VEHICLE_BACK";
  step_updated_at: string;
  created_at: string;
  comments?: string | null;
  vehicle: {
    plate_number: string;
    make_model: string;
  };
  driver?: {
    accidentClaims?: any[];
  } | null;
}

const TIMELINE_STEPS = [
  { id: "NEW_ACCIDENT", label: "New Accident", color: "bg-red-50 text-red-700 border-red-200" },
  { id: "CAR_IN_GARAGE", label: "Car in Garage", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "STARTING_REPAIR", label: "Starting Repair", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "INSURANCE_DOCS", label: "Insurance Docs", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "READY_FOR_PICKUP", label: "Ready for Pickup", color: "bg-yellow-50 text-yellow-800 border-yellow-200" },
  { id: "VEHICLE_BACK", label: "Vehicle Back", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

export default function AccidentCard({ claim, onUpdate }: { claim: AccidentClaim; onUpdate: () => void }) {
  const { data: session } = useSession();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Comment field & history states
  const [commentText, setCommentText] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Parse comments safely
  let commentsList: AccidentComment[] = [];
  try {
    if (claim.comments) {
      commentsList = JSON.parse(claim.comments);
      if (!Array.isArray(commentsList)) commentsList = [];
    }
  } catch {
    commentsList = [];
  }

  const calculateDays = (dateStr: string) => {
    const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysInStatus = calculateDays(claim.step_updated_at);
  const totalDays = calculateDays(claim.created_at);

  const currentStepIndex = TIMELINE_STEPS.findIndex(s => s.id === claim.timeline_step);
  const currentStepDef = TIMELINE_STEPS[currentStepIndex] || TIMELINE_STEPS[0];
  const isCompleted = claim.timeline_step === "VEHICLE_BACK";

  // Calculate driver history of faults if driver is loaded
  const driverAtFaultCount = claim.driver?.accidentClaims?.filter(c => c.fault === "DRIVER").length || 0;

  const handleUpdate = async (field: string, value: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        onUpdate();
      } else {
        toast.error("Failed to update claim");
      }
    } catch (err) {
      console.error("Failed to update accident claim", err);
      toast.error("Error updating claim");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveCommentOnly = async () => {
    if (!commentText.trim()) return;
    setIsSavingComment(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: commentText.trim(),
          timeline_step: claim.timeline_step,
          author: agentName,
        }),
      });

      if (res.ok) {
        toast.success(`Comment saved for ${currentStepDef.label}`);
        setCommentText(""); // empty the comment field
        setShowHistory(true); // make sure history is visible
        onUpdate();
      } else {
        toast.error("Failed to save comment");
      }
    } catch (err) {
      console.error("Failed to save comment:", err);
      toast.error("Error saving comment");
    } finally {
      setIsSavingComment(false);
    }
  };

  const advanceTimeline = async () => {
    if (currentStepIndex >= TIMELINE_STEPS.length - 1) return;
    const nextStep = TIMELINE_STEPS[currentStepIndex + 1];
    
    setIsUpdating(true);
    try {
      const agentName = session?.user?.name || session?.user?.email || "Agent";
      const payload: any = { timeline_step: nextStep.id };
      
      // If user typed a comment before advancing, bundle & save it with this status transition
      if (commentText.trim()) {
        payload.comment = commentText.trim();
        payload.author = agentName;
      }

      const res = await fetch(`/api/accidents/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (commentText.trim()) {
          toast.success(`Advanced to ${nextStep.label} & note saved`);
          setCommentText(""); // empty the comment field
          setShowHistory(true);
        } else {
          toast.success(`Advanced to ${nextStep.label}`);
        }
        onUpdate();
      } else {
        toast.error("Failed to advance status");
      }
    } catch (err) {
      console.error("Failed to advance timeline", err);
      toast.error("Error advancing status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/accidents/${claim.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Accident record deleted");
        onUpdate();
      } else {
        toast.error("Failed to delete accident");
      }
    } catch (err) {
      console.error("Error deleting accident", err);
      toast.error("Error deleting accident");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStepBadge = (stepId: string) => {
    const step = TIMELINE_STEPS.find(s => s.id === stepId);
    return step || { label: stepId, color: "bg-gray-100 text-gray-700 border-gray-200" };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between">
      {/* Top Details */}
      <div>
        <div className="p-5 border-b border-gray-100 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-bold text-navy">{claim.vehicle.plate_number}</h3>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                ACCIDENT
              </span>
            </div>
            <p className="text-sm text-gray-500 font-medium">{claim.vehicle.make_model}</p>
            
            <div className="mt-3 text-sm text-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5">📅</span> 
                <span>Happened: <strong>{new Date(claim.created_at).toLocaleDateString()}</strong> ({totalDays} days ago)</span>
              </div>
              {claim.driver_name && (
                <div className="flex items-center gap-2">
                  <span className="w-5">👤</span>
                  <span>Driver: <strong>{claim.driver_name}</strong> {claim.driver_phone ? `(${claim.driver_phone})` : ""}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="text-3xl font-black text-navy">{daysInStatus}</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Days in Status</div>
            
            {isDeleting ? (
              <div className="flex gap-2 items-center mt-1">
                <span className="text-[10px] text-red-500 font-bold">Sure?</span>
                <button onClick={handleDelete} className="text-[10px] text-white bg-red-600 px-2 py-1 rounded hover:bg-red-700">Yes</button>
                <button onClick={() => setIsDeleting(false)} className="text-[10px] text-gray-600 bg-gray-100 border border-gray-300 px-2 py-1 rounded hover:bg-gray-200">No</button>
              </div>
            ) : (
              <button
                onClick={() => setIsDeleting(true)}
                disabled={isUpdating}
                className="text-[11px] text-red-500 hover:text-red-700 font-semibold hover:underline disabled:opacity-50 transition-colors"
              >
                Delete Record
              </button>
            )}
          </div>
        </div>

        {/* Selectors */}
        <div className="bg-gray-50 p-4 border-b border-gray-100 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Severity</label>
            <select 
              className="w-full bg-white border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy transition-colors"
              value={claim.severity || ""}
              onChange={(e) => handleUpdate("severity", e.target.value)}
              disabled={isUpdating || isCompleted}
            >
              <option value="" disabled>Select severity...</option>
              <option value="HARD">🛑 Hard (Major structural)</option>
              <option value="SOFT">⚠️ Soft (Cosmetic/Minor)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Fault</label>
            <select 
              className="w-full bg-white border border-gray-200 rounded p-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy transition-colors"
              value={claim.fault || ""}
              onChange={(e) => handleUpdate("fault", e.target.value)}
              disabled={isUpdating || isCompleted}
            >
              <option value="" disabled>Who is at fault?</option>
              <option value="DRIVER">Driver</option>
              <option value="THIRD_PARTY">Third Party (Other)</option>
            </select>
            {claim.driver_name && (
              <div className="text-[10px] text-gray-500 mt-1 font-medium">
                History: {driverAtFaultCount} previous at-fault accidents
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="p-5 pb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-4 uppercase">Repair Pipeline</label>
          
          <div className="relative flex justify-between items-center mb-6">
            {/* Progress Bar Background */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded"></div>
            
            {/* Active Progress Bar */}
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-navy rounded transition-all duration-500"
              style={{ width: `${(currentStepIndex / (TIMELINE_STEPS.length - 1)) * 100}%` }}
            ></div>

            {/* Dots */}
            {TIMELINE_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isActive = idx === currentStepIndex;
              
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div 
                    className={`w-4 h-4 rounded-full border-2 transition-colors duration-300 ${
                      isActive ? "bg-white border-navy ring-4 ring-navy/20" :
                      isPast ? "bg-navy border-navy" : "bg-white border-gray-300"
                    }`}
                    title={step.label}
                  ></div>
                  {isActive && (
                    <div className="absolute top-6 whitespace-nowrap text-xs font-bold text-navy">
                      {step.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Button */}
          <div className="flex justify-end mt-8">
            {isCompleted ? (
              <span className="px-4 py-2 bg-green-100 text-green-800 rounded font-bold text-sm">
                ✅ Vehicle Restored
              </span>
            ) : claim.timeline_step === "READY_FOR_PICKUP" ? (
              <div className="px-4 py-2 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded font-semibold text-sm">
                ⏳ Waiting for Field Supervisor Pickup...
              </div>
            ) : (
              <button
                onClick={advanceTimeline}
                disabled={isUpdating}
                className="px-6 py-2 bg-navy text-white rounded font-semibold text-sm hover:bg-navy/90 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
              >
                <span>{isUpdating ? "Updating..." : commentText.trim() ? `Advance & Log Note: ${TIMELINE_STEPS[currentStepIndex + 1]?.label}` : `Advance to: ${TIMELINE_STEPS[currentStepIndex + 1]?.label}`}</span>
                <span>➔</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Agent Comments & Status Notes Section */}
      <div className="border-t border-gray-100 bg-gray-50/70 p-5 space-y-3.5">
        {/* Header & Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>💬</span> Agent Status Comments
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy/10 text-navy font-mono">
              {commentsList.length}
            </span>
          </div>

          {commentsList.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-semibold text-navy hover:text-navy/80 flex items-center gap-1 transition-colors"
            >
              <span>{showHistory ? "▲ Hide History" : "▼ View History"}</span>
              <span className="text-gray-400 font-mono">({commentsList.length})</span>
            </button>
          )}
        </div>

        {/* Comment Input Field */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
              <span>✏️</span> Comment for status:{" "}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${currentStepDef.color}`}>
                {currentStepDef.label}
              </span>
            </span>
            {session?.user?.name && (
              <span className="text-[10px] text-gray-400 font-medium">
                👤 {session.user.name}
              </span>
            )}
          </div>

          <textarea
            rows={2}
            placeholder={`Add a comment for ${currentStepDef.label} (e.g. expert report, garage contact, estimate, insurance docs)...`}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            disabled={isSavingComment || isUpdating}
            className="w-full text-xs text-gray-800 placeholder-gray-400 bg-gray-50/40 border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy focus:bg-white transition-all resize-none"
          />

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[10px] text-gray-400 italic">
              Saved per status and archived in history timeline.
            </span>
            <button
              type="button"
              onClick={handleSaveCommentOnly}
              disabled={!commentText.trim() || isSavingComment || isUpdating}
              className="px-4 py-1.5 bg-navy hover:bg-navy/90 text-white font-bold text-xs rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-xs transition-all"
            >
              <span>💾</span>
              <span>{isSavingComment ? "Saving..." : "Save Comment"}</span>
            </button>
          </div>
        </div>

        {/* History of Comments */}
        {showHistory && (
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>Comments History</span>
              <span className="text-[10px] font-normal text-gray-400 font-mono">
                {commentsList.length} note{commentsList.length === 1 ? "" : "s"} logged
              </span>
            </div>

            {commentsList.length === 0 ? (
              <div className="text-xs text-gray-400 italic bg-white rounded-lg border border-dashed border-gray-200 p-3 text-center">
                No comments recorded yet. Enter a note above to record status updates.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {commentsList.map((c) => {
                  const badge = getStepBadge(c.timeline_step);
                  return (
                    <div
                      key={c.id}
                      className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs space-y-1.5 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          {c.author && (
                            <span className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                              <span>👤</span> {c.author}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                          {new Date(c.created_at).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap pl-0.5">
                        {c.comment}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
