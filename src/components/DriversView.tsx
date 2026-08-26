"use client";

/**
 * DriversView Component — Executive Driver Fleet Management
 *
 * Provides a command center for driver profiles, vehicle allocations,
 * KYC verification status, bulk CSV import, and recovery stages.
 */

import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Car,
  UserCheck,
  UserX,
  Upload,
  UserPlus,
  Search,
  Filter,
  Phone,
  MessageCircle,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  CreditCard,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import DriverCSVUploader from "./DriverCSVUploader";
import AddDriverModal from "./AddDriverModal";
import DriverDrawer from "./DriverDrawer";

interface Vehicle {
  id: string;
  plate_number: string;
  brand: string;
  model: string;
  year: number;
  current_mileage: number;
  status: string;
}

interface DriverProfile {
  id: string;
  cinNumber: string;
  fullName: string;
  phoneSanitized: string;
  age: number;
  licenseSeniority: number;
  isKycVerified: boolean;
  contractType: string;
  monthlyTripCount: number;
  currentArrearsMAD: number;
  defaultStage: string;
  assignedVehicleId: string | null;
  assignedVehicle?: Vehicle | null;
}

export default function DriversView() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignment, setFilterAssignment] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("ALL");
  const [filterStage, setFilterStage] = useState<string>("ALL");

  // Modals & Drawers
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null);

  const fetchDrivers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/drivers");
      const data = await res.json();
      if (data.drivers) {
        setDrivers(data.drivers);
      }
    } catch (err) {
      toast.error("Erreur de chargement des chauffeurs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Filtered drivers list
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      // Search
      const matchSearch =
        d.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.phoneSanitized.includes(searchQuery) ||
        d.cinNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.assignedVehicle && d.assignedVehicle.plate_number.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      // Assignment
      if (filterAssignment === "ASSIGNED" && !d.assignedVehicleId) return false;
      if (filterAssignment === "UNASSIGNED" && d.assignedVehicleId) return false;

      // Stage
      if (filterStage !== "ALL" && d.defaultStage !== filterStage) return false;

      return true;
    });
  }, [drivers, searchQuery, filterAssignment, filterStage]);

  // Statistics
  const totalDrivers = drivers.length;
  const assignedCount = drivers.filter((d) => d.assignedVehicleId).length;
  const unassignedCount = totalDrivers - assignedCount;
  const totalArrearsMAD = drivers.reduce((acc, d) => acc + (d.currentArrearsMAD || 0), 0);
  const kycVerifiedRate = totalDrivers > 0 ? Math.round((drivers.filter((d) => d.isKycVerified).length / totalDrivers) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy via-navy/95 to-[#1a3352] text-white p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gold/20 text-gold rounded-xl border border-gold/30">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gestion de la Flotte Chauffeurs
            </h1>
          </div>
          <p className="text-white/70 text-sm max-w-xl">
            Suivi opérationnel des chauffeurs GoCab, conversion automatique des prospects qualifiés, affectation des véhicules et recouvrement.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold border border-white/20 transition-colors shadow-2xs"
          >
            <Upload className="w-4 h-4 text-gold" />
            <span>Importer CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold/90 text-navy font-bold rounded-xl text-sm transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nouveau Chauffeur</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Total Chauffeurs</span>
            <Users className="w-4 h-4 text-navy" />
          </div>
          <p className="text-2xl font-extrabold text-navy">{totalDrivers}</p>
          <span className="text-2xs text-gray-400 mt-1">Inscrits dans le CRM</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Sur la Route</span>
            <Car className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600">{assignedCount}</p>
          <span className="text-2xs text-emerald-600 font-medium mt-1">Avec véhicule actif</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">En Attente Véhicule</span>
            <UserCheck className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600">{unassignedCount}</p>
          <span className="text-2xs text-amber-600 font-medium mt-1">Prêts à être affectés</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Total Impayés</span>
            <CreditCard className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-extrabold text-red-600">{totalArrearsMAD.toLocaleString()} <span className="text-xs font-normal">MAD</span></p>
          <span className="text-2xs text-gray-400 mt-1">Encours flotte</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold">Dossiers KYC</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-blue-600">{kycVerifiedRate}%</p>
          <span className="text-2xs text-blue-600 font-medium mt-1">Vérifiés conformes</span>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Rechercher nom, téléphone, CIN, immatriculation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-medium text-gray-600">
            <button
              onClick={() => setFilterAssignment("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterAssignment === "ALL" ? "bg-white text-navy font-bold shadow-2xs" : "hover:text-navy"
              }`}
            >
              Tous ({totalDrivers})
            </button>
            <button
              onClick={() => setFilterAssignment("ASSIGNED")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterAssignment === "ASSIGNED" ? "bg-white text-emerald-700 font-bold shadow-2xs" : "hover:text-emerald-700"
              }`}
            >
              Avec Véhicule ({assignedCount})
            </button>
            <button
              onClick={() => setFilterAssignment("UNASSIGNED")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterAssignment === "UNASSIGNED" ? "bg-white text-amber-700 font-bold shadow-2xs" : "hover:text-amber-700"
              }`}
            >
              En Attente ({unassignedCount})
            </button>
          </div>

          <button
            onClick={fetchDrivers}
            className="p-2 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-xl transition-colors"
            title="Rafraîchir la liste"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Drivers Data Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-2xs uppercase tracking-wider text-gray-500 border-b border-gray-100 font-bold">
              <tr>
                <th className="py-4 px-6">Chauffeur</th>
                <th className="py-4 px-4">CIN & Contact</th>
                <th className="py-4 px-4">Véhicule Assigné</th>
                <th className="py-4 px-4">Profil & Exp.</th>
                <th className="py-4 px-4">Recouvrement</th>
                <th className="py-4 px-4">KYC</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-7 h-7 border-3 border-navy/20 border-t-navy rounded-full animate-spin" />
                      <span className="text-xs">Chargement des chauffeurs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-10 h-10 text-gray-300" />
                      <p className="font-semibold text-gray-600">Aucun chauffeur trouvé</p>
                      <p className="text-xs text-gray-400">
                        {searchQuery ? "Essayez un autre terme de recherche" : "Importez un CSV ou ajoutez un chauffeur manuellement."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => {
                  const cleanPhone = driver.phoneSanitized.replace(/\D/g, "");
                  const whatsappUrl = `https://wa.me/${cleanPhone}`;

                  return (
                    <tr
                      key={driver.id}
                      onClick={() => setSelectedDriver(driver)}
                      className="hover:bg-navy/5 cursor-pointer transition-colors"
                    >
                      {/* Driver Name */}
                      <td className="py-4 px-6 font-semibold text-navy">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-navy/10 text-navy font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {driver.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{driver.fullName}</p>
                            <span className="text-2xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md font-medium">
                              {driver.contractType}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CIN & Phone */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <p className="text-xs font-mono font-semibold text-gray-800">{driver.cinNumber}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{driver.phoneSanitized}</span>
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded"
                              title="Contacter sur WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Vehicle */}
                      <td className="py-4 px-4">
                        {driver.assignedVehicle ? (
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                              <Car className="w-4 h-4" />
                            </span>
                            <div>
                              <p className="text-xs font-bold text-gray-900">{driver.assignedVehicle.plate_number}</p>
                              <p className="text-2xs text-gray-500">{driver.assignedVehicle.brand} {driver.assignedVehicle.model}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 inline-flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            Non assigné
                          </span>
                        )}
                      </td>

                      {/* Seniority & Age */}
                      <td className="py-4 px-4">
                        <div className="text-xs">
                          <p className="font-medium text-gray-800">{driver.licenseSeniority} ans permis</p>
                          <p className="text-2xs text-gray-400">{driver.age} ans</p>
                        </div>
                      </td>

                      {/* Arrears / Stage */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <p className={`text-xs font-bold ${driver.currentArrearsMAD > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {driver.currentArrearsMAD.toLocaleString()} MAD
                          </p>
                          <span className={`text-2xs font-semibold px-2 py-0.5 rounded-md ${
                            driver.defaultStage === "NOMINAL"
                              ? "bg-emerald-50 text-emerald-700"
                              : driver.defaultStage === "DAY_3_BLOCK"
                              ? "bg-red-100 text-red-700 font-bold"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {driver.defaultStage === "NOMINAL" ? "En règle" : driver.defaultStage}
                          </span>
                        </div>
                      </td>

                      {/* KYC Status */}
                      <td className="py-4 px-4">
                        {driver.isKycVerified ? (
                          <span className="text-2xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/60 inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Vérifié
                          </span>
                        ) : (
                          <span className="text-2xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/60 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            En attente
                          </span>
                        )}
                      </td>

                      {/* Action Chevron */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDriver(driver);
                          }}
                          className="p-1.5 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Uploader Modal */}
      <DriverCSVUploader
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onUploadSuccess={fetchDrivers}
      />

      {/* Add Driver Modal */}
      <AddDriverModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchDrivers}
      />

      {/* Driver Drawer */}
      <DriverDrawer
        driver={selectedDriver}
        isOpen={Boolean(selectedDriver)}
        onClose={() => setSelectedDriver(null)}
        onUpdate={fetchDrivers}
      />
    </div>
  );
}
