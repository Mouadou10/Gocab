"use client";

import { useState } from "react";

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
  vehicle: {
    plate_number: string;
    make_model: string;
  };
  driver?: {
    accidentClaims?: any[];
  } | null;
}

const TIMELINE_STEPS = [
  { id: "NEW_ACCIDENT", label: "New Accident" },
  { id: "CAR_IN_GARAGE", label: "Car in Garage" },
  { id: "STARTING_REPAIR", label: "Starting Repair" },
  { id: "INSURANCE_DOCS", label: "Insurance Docs" },
  { id: "READY_FOR_PICKUP", label: "Ready for Pickup" },
  { id: "VEHICLE_BACK", label: "Vehicle Back" },
];

export default function AccidentCard({ claim, onUpdate }: { claim: AccidentClaim; onUpdate: () => void }) {
  const [isUpdating, setIsUpdating] = useState(false);

  const calculateDays = (dateStr: string) => {
    const diffTime = Math.abs(new Date().getTime() - new Date(dateStr).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysInStatus = calculateDays(claim.step_updated_at);
  const totalDays = calculateDays(claim.created_at);

  const currentStepIndex = TIMELINE_STEPS.findIndex(s => s.id === claim.timeline_step);
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
      }
    } catch (err) {
      console.error("Failed to update accident claim", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const advanceTimeline = () => {
    if (currentStepIndex < TIMELINE_STEPS.length - 1) {
      handleUpdate("timeline_step", TIMELINE_STEPS[currentStepIndex + 1].id);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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

        <div className="text-right">
          <div className="text-3xl font-black text-navy">{daysInStatus}</div>
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Days in Status</div>
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
      <div className="p-5">
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
              className="px-6 py-2 bg-navy text-white rounded font-semibold text-sm hover:bg-navy/90 disabled:opacity-50 transition-colors"
            >
              {isUpdating ? "Updating..." : `Advance to: ${TIMELINE_STEPS[currentStepIndex + 1]?.label}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
