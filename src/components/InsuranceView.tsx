"use client";

import { useState, useEffect, useCallback } from "react";
import AccidentCard, { AccidentClaim } from "./AccidentCard";

export default function InsuranceView() {
  const [claims, setClaims] = useState<AccidentClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // States for reporting a new accident
  const [isReporting, setIsReporting] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState("");
  const [vehicles, setVehicles] = useState<{ id: string; plate_number: string }[]>([]);

  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/accidents");
      const data = await res.json();
      if (data.success) {
        setClaims(data.claims);
      }
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/vehicles");
      const data = await res.json();
      // Allow selecting any vehicle to ensure we can create claims for legacy "Accident" status vehicles
      setVehicles(data.vehicles || []);
    } catch (err) {
      console.error("Failed to fetch vehicles for accident reporting", err);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchVehicles();
  }, [fetchClaims, fetchVehicles]);

  const handleReportAccident = async () => {
    if (!newVehicleId) return;
    try {
      const res = await fetch("/api/accidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: newVehicleId }),
      });
      if (res.ok) {
        setIsReporting(false);
        setNewVehicleId("");
        fetchClaims(); // Refresh list
        fetchVehicles(); // Refresh vehicle list
      }
    } catch (err) {
      console.error("Error reporting accident:", err);
    }
  };

  // Separate active claims and completed (Vehicle Back) claims
  const activeClaims = claims.filter(c => c.timeline_step !== "VEHICLE_BACK");
  const historyClaims = claims.filter(c => c.timeline_step === "VEHICLE_BACK");

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-navy">Insurance & Accidents</h2>
          <p className="text-sm text-gray-500">Manage vehicles in accident status and repair pipeline.</p>
        </div>
        <button
          onClick={() => setIsReporting(!isReporting)}
          className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
        >
          {isReporting ? "Cancel" : "🚨 Report Accident"}
        </button>
      </div>

      {isReporting && (
        <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm mb-6 flex items-end gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Select Vehicle</label>
            <select
              value={newVehicleId}
              onChange={(e) => setNewVehicleId(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
            >
              <option value="">-- Choose a vehicle --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate_number}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleReportAccident}
            disabled={!newVehicleId}
            className="px-6 py-2 bg-navy text-white rounded font-semibold text-sm hover:bg-navy/90 disabled:opacity-50"
          >
            Create Claim
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading claims...</div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-8 scrollbar-thin">
          
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
              Active Claims ({activeClaims.length})
            </h3>
            {activeClaims.length === 0 ? (
              <div className="text-gray-400 text-sm italic">No active accident claims.</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {activeClaims.map(claim => (
                  <AccidentCard key={claim.id} claim={claim} onUpdate={fetchClaims} />
                ))}
              </div>
            )}
          </div>

          {historyClaims.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
                Restored Vehicles ({historyClaims.length})
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 opacity-70">
                {historyClaims.map(claim => (
                  <AccidentCard key={claim.id} claim={claim} onUpdate={fetchClaims} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
