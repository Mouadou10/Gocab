"use client";

/**
 * FleetView Component — Cars & Fleet Data Entry & Compliance Management
 * 
 * Features:
 * 1. Automatic Expiration Reminder Banners (Insurance 🛡️, Vignette 🏷️, Autorisation 📄, Visite Tech 🔧).
 * 2. Search & Filter Bar (Plate, Model, Hub, Status).
 * 3. Corporate Table / Grid displaying vehicle compliance health pills.
 * 4. Data Entry & Edit integration via VehicleDrawer.
 */

import { useState, useEffect, useCallback } from "react";
import VehicleDrawer, { Vehicle } from "./VehicleDrawer";
import TicketDrawer from "./TicketDrawer";
import VehicleCSVUploader from "./VehicleCSVUploader";
import AddExpenseModal from "./AddExpenseModal";
import VehicleExpensesDrawer from "./VehicleExpensesDrawer";

const HUB_CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Tangier",
  "Agadir",
] as const;

const VEHICLE_STATUSES = [
  "Available",
  "Actif",
  "Accident",
  "impounded by police",
] as const;

export default function FleetView() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHub, setSelectedHub] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Expense states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isExpenseDrawerOpen, setIsExpenseDrawerOpen] = useState(false);
  const [expenseVehicle, setExpenseVehicle] = useState<Vehicle | null>(null);
  const [expenseCategory, setExpenseCategory] = useState<string>("REPAIR");

  // Ticket Drawer state
  const [ticketVehicle, setTicketVehicle] = useState<Vehicle | null>(null);
  const [isTicketDrawerOpen, setIsTicketDrawerOpen] = useState(false);

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedHub) params.set("hub", selectedHub);
      if (selectedStatus) params.set("status", selectedStatus);

      const res = await fetch(`/api/vehicles?${params.toString()}`);
      const data = await res.json();
      setVehicles(data.vehicles || []);
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedHub, selectedStatus]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  async function handleDelete(id: string, plate: string) {
    if (!confirm(`Are you sure you want to delete vehicle ${plate}? This will also remove its linked tickets, inspections, and accident claims.`)) return;
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchVehicles();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete vehicle. Please try again.");
      }
    } catch (err) {
      console.error("Failed to delete vehicle:", err);
      alert("Network error — could not delete vehicle.");
    }
  }

  async function handleQuickStatusChange(vehicleId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchVehicles();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  // Calculate Expiration Alerts
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiredItems: { vehicle: Vehicle; type: string; date: string }[] = [];

  vehicles.forEach((v) => {
    const checks = [
      { name: "Insurance 🛡️", dateStr: v.insurance_expiry_date },
      { name: "Vignette Tax 🏷️", dateStr: v.vignette_expiry_date },
      { name: "Autorisation 📄", dateStr: v.autorisation_expiry_date },
      { name: "Visite Technique 🔧", dateStr: v.technical_inspection_expiry },
    ];

    checks.forEach((chk) => {
      if (chk.dateStr) {
        try {
          const d = new Date(chk.dateStr);
          if (!isNaN(d.getTime()) && d < now) {
            expiredItems.push({
              vehicle: v,
              type: chk.name,
              date: d.toLocaleDateString(),
            });
          }
        } catch {}
      }
    });
  });

  /** Returns compliance status pill for a document date. */
  function getComplianceBadge(dateStr: string | null, label: string) {
    if (!dateStr) {
      return (
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md font-mono">
          {label}: Unset
        </span>
      );
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        return (
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md font-mono">
            {label}: Non défini
          </span>
        );
      }
      if (d < now) {
        return (
          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border border-red-200">
            🚨 {label} EXPIRED ({d.toLocaleDateString()})
          </span>
        );
      }
      if (d <= threeDaysFromNow) {
        const days = Math.max(0, Math.ceil((d.getTime() - now.getTime()) / (1000 * 3600 * 24)));
        return (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border border-amber-200">
            ⚠️ {label} due in {days}d ({d.toLocaleDateString()})
          </span>
        );
      }
      return (
        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border border-emerald-200">
          ✓ {label}: {d.toLocaleDateString()}
        </span>
      );
    } catch {
      return (
        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md font-mono">
          {label}: Non défini
        </span>
      );
    }
  }

  /** Gets styling for the 6 vehicle operational statuses */
  function getStatusStyle(status: string) {
    switch (status) {
      case "Available":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Actif":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "In garage":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "In service":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Accident":
        return "bg-red-100 text-red-800 border-red-200";
      case "impounded by police":
        return "bg-slate-900 text-white border-slate-900";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto w-full">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🚗</span> Cars & Fleet Management
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Register vehicles, update status, track mileage, and automate compliance reminders
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsExpenseDrawerOpen(true)}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 shadow-2xs transition-all flex items-center justify-center gap-1.5"
          >
            <span>💸</span> Frais & Dépenses
          </button>

          <button
            onClick={() => {
              setExpenseVehicle(null);
              setExpenseCategory("REPAIR");
              setIsExpenseModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-200 shadow-2xs transition-all flex items-center justify-center gap-1.5"
          >
            <span>➕</span> Ajouter Frais
          </button>

          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="px-3.5 py-2.5 bg-white hover:bg-gray-50 text-navy font-bold text-xs rounded-xl border border-gray-200 shadow-2xs transition-all flex items-center justify-center gap-1.5"
          >
            <span>📥</span> Importer CSV
          </button>

          <button
            onClick={() => {
              setEditingVehicle(null);
              setIsDrawerOpen(true);
            }}
            className="px-4 py-2.5 bg-navy hover:bg-navy/95 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <span>➕</span> Nouveau Véhicule
          </button>
        </div>
      </div>

      {/* Regulatory Expiration Alert Banner (Critical Red Only) */}
      {expiredItems.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-900 shadow-sm animate-pulse-subtle">
          <div className="flex items-center gap-2 font-bold text-sm mb-1.5 text-red-700">
            <span>🚨</span> CRITICAL COMPLIANCE ALERT: {expiredItems.length} Expired Regulatory Documents
          </div>
          <div className="flex flex-wrap gap-2">
            {expiredItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-white/80 border border-red-200 px-3 py-1 rounded-xl text-xs flex items-center gap-2 font-mono shadow-xs"
              >
                <span className="font-bold text-gray-900">{item.vehicle.plate_number}</span>
                <span className="text-red-600 font-semibold">{item.type}</span>
                <span className="text-gray-500">Expired: {item.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search by plate number, make/model, or VIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Hub Filter */}
          <select
            value={selectedHub}
            onChange={(e) => setSelectedHub(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none bg-white text-gray-700 font-medium"
          >
            <option value="">All Regional Hubs</option>
            {HUB_CITIES.map((h) => (
              <option key={h} value={h}>
                📍 {h}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-navy/30 focus:outline-none bg-white text-gray-700 font-medium"
          >
            <option value="">All Statuses</option>
            {VEHICLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fleet Vehicles Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
            Loading fleet data…
          </div>
        ) : vehicles.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-xs space-y-2">
            <p className="text-xl">🚗</p>
            <p className="font-semibold text-gray-700">No vehicles registered yet.</p>
            <p className="text-gray-400">Click "Register New Vehicle" above to add your first asset.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Plate Number</th>
                  <th className="py-3.5 px-4">Make & Model</th>
                  <th className="py-3.5 px-4">Hub City</th>
                  <th className="py-3.5 px-4">Operational Status</th>
                  <th className="py-3.5 px-4">Mileage</th>
                  <th className="py-3.5 px-4">Regulatory Compliance Health</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Plate */}
                    <td className="py-4 px-4 font-mono font-bold text-navy">
                      <div className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 inline-block">
                        {v.plate_number}
                      </div>
                    </td>

                    {/* Make & Model */}
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      <div>{v.make_model}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        Year: {v.year} {v.vin ? `· VIN: ${v.vin}` : ""}
                      </div>
                    </td>

                    {/* Hub */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        📍 {v.hub_city}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <select
                        value={v.status}
                        onChange={(e) => handleQuickStatusChange(v.id, e.target.value)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border focus:outline-none cursor-pointer ${getStatusStyle(
                          v.status
                        )}`}
                      >
                        {!VEHICLE_STATUSES.includes(v.status as any) && (
                          <option value={v.status} className="bg-white text-gray-900 font-normal">
                            {v.status}
                          </option>
                        )}
                        {VEHICLE_STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-white text-gray-900 font-normal">
                            {s}
                          </option>
                        ))}
                      </select>

                      {v.assigned_driver_name && (
                        <div className="text-[10px] text-gray-500 mt-1">
                          👤 {v.assigned_driver_name}
                        </div>
                      )}
                    </td>

                    {/* Mileage */}
                    <td className="py-4 px-4 font-mono text-gray-600">
                      {v.current_mileage.toLocaleString()} KM
                    </td>

                    {/* Compliance Health */}
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {getComplianceBadge(v.insurance_expiry_date, "Insurance")}
                        {getComplianceBadge(v.vignette_expiry_date, "Vignette")}
                        {getComplianceBadge(v.autorisation_expiry_date, "Autorisation")}
                        {getComplianceBadge(v.technical_inspection_expiry, "Visite Tech")}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setExpenseVehicle(v);
                            setExpenseCategory(v.status === "impounded by police" ? "POLICE" : "REPAIR");
                            setIsExpenseModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-200 rounded-lg text-xs transition-colors font-semibold"
                          title="Enregistrer un frais de réparation, fourrière ou entretien pour ce véhicule"
                        >
                          💸 Frais
                        </button>

                        <button
                          onClick={() => {
                            setTicketVehicle(v);
                            setIsTicketDrawerOpen(true);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-navy hover:text-white text-navy border border-blue-200 rounded-lg text-xs transition-colors font-semibold"
                        >
                          Log Ticket 🔧
                        </button>

                        <button
                          onClick={() => {
                            setEditingVehicle(v);
                            setIsDrawerOpen(true);
                          }}
                          className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs transition-colors font-medium"
                        >
                          Edit
                        </button>
                        
                        <button
                          onClick={() => handleDelete(v.id, v.plate_number)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-xs transition-colors font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-in Vehicle Drawer */}
      {isDrawerOpen && (
        <VehicleDrawer
          vehicle={editingVehicle}
          onClose={() => {
            setIsDrawerOpen(false);
            setEditingVehicle(null);
          }}
          onSaveSuccess={fetchVehicles}
        />
      )}

      {/* Slide-in Ticket Drawer */}
      {isTicketDrawerOpen && (
        <TicketDrawer
          vehicle={ticketVehicle}
          onClose={() => {
            setIsTicketDrawerOpen(false);
            setTicketVehicle(null);
          }}
          onSaveSuccess={fetchVehicles}
        />
      )}

      {/* Vehicle CSV Uploader Modal */}
      <VehicleCSVUploader
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onUploadSuccess={fetchVehicles}
      />

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setExpenseVehicle(null);
        }}
        onSuccess={fetchVehicles}
        initialVehicle={expenseVehicle}
        initialCategory={expenseCategory}
      />

      {/* Vehicle Expenses Drawer */}
      <VehicleExpensesDrawer
        isOpen={isExpenseDrawerOpen}
        onClose={() => setIsExpenseDrawerOpen(false)}
        onOpenAddModal={(v, cat) => {
          setExpenseVehicle(v || null);
          setExpenseCategory(cat || "REPAIR");
          setIsExpenseModalOpen(true);
        }}
      />
    </div>
  );
}

