"use client";

/**
 * FleetPerformanceView — Daily Driver Collections, 300/1800 DH Contract Automation & 3rd-Day Red Alert
 *
 * Core GoCab Business Rules:
 * 1. Contract Types:
 *    - WEEKLY: 1,800 MAD every Monday
 *    - DAILY: 300 MAD per day Monday to Saturday (Sunday off)
 * 2. Manager Enters Amount Paid by Driver Each Day:
 *    - Reduces driver's arrears balance.
 * 3. 3rd-Day Non-Payment Red Alert:
 *    - If a driver does not pay for 2 days, on the 3rd day he appears in vibrant RED with critical recovery alert.
 * 4. Automatic Arrears Additions:
 *    - Accumulated unpaid days display as cumulative debt (+300 MAD, +600 MAD...).
 */

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  Phone,
  MessageSquare,
  Car,
  User,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Clock,
  Send,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { useLanguage } from "@/context/LanguageContext";

interface DriverDailyItem {
  id: string;
  fullName: string;
  phoneSanitized: string;
  cinNumber: string;
  contractType: "DAILY" | "WEEKLY";
  vehicle: {
    id: string;
    plate_number: string;
    make_model: string;
    status: string;
  } | null;
  currentArrearsMAD: number;
  consecutiveUnpaidDays: number;
  isCriticalRed: boolean;
  expectedTodayMAD: number;
  clearedTodayMAD: number;
  isPaidToday: boolean;
  paymentNote: string | null;
  paymentLedgerId: string | null;
}

interface DailySummary {
  totalDrivers: number;
  totalExpectedTodayMAD: number;
  totalClearedTodayMAD: number;
  remainingToCollectMAD: number;
  totalArrearsAllMAD: number;
  criticalRedCount: number;
}

export default function FleetPerformanceView() {
  const { t, language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [drivers, setDrivers] = useState<DriverDailyItem[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "RED" | "UNPAID" | "DAILY" | "WEEKLY">("ALL");

  // Local inputs state for editing cleared amounts
  const [paymentInputs, setPaymentInputs] = useState<Record<string, number>>({});
  const [savingDriverId, setSavingDriverId] = useState<string | null>(null);

  const fetchDriverCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/collections/driver-daily?date=${selectedDate}`);
      const data = await res.json();

      if (data.drivers) {
        setDrivers(data.drivers);
        setSummary(data.summary);

        // Pre-populate input values with cleared amounts
        const initialInputs: Record<string, number> = {};
        for (const d of data.drivers) {
          initialInputs[d.id] = d.clearedTodayMAD > 0 ? d.clearedTodayMAD : d.expectedTodayMAD;
        }
        setPaymentInputs(initialInputs);
      }
    } catch (err) {
      console.error("Failed to load driver collections:", err);
      toast.error("Erreur de chargement des encaissements");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDriverCollections();
  }, [fetchDriverCollections]);

  // Handle Recording / Saving a Driver's Payment for the day
  async function handleSavePayment(driver: DriverDailyItem) {
    const amount = paymentInputs[driver.id] !== undefined ? paymentInputs[driver.id] : driver.expectedTodayMAD;
    setSavingDriverId(driver.id);

    try {
      const res = await fetch("/api/collections/driver-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: driver.id,
          date: selectedDate,
          clearedMAD: amount,
          notes: `Encaissé via Fleet Perf (${selectedDate})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Échec de l'enregistrement");
        return;
      }

      toast.success(
        amount >= driver.expectedTodayMAD
          ? `✅ Paiement de ${amount} MAD validé pour ${driver.fullName}`
          : `⚠️ Paiement partiel de ${amount} MAD enregistré pour ${driver.fullName}`
      );

      fetchDriverCollections();
    } catch (err) {
      toast.error("Erreur réseau");
    } finally {
      setSavingDriverId(null);
    }
  }

  // Generate WhatsApp reminder link
  function getWhatsAppReminderURL(driver: DriverDailyItem) {
    const cleanPhone = driver.phoneSanitized.replace(/[^0-9]/g, "");
    const amountDue = driver.currentArrearsMAD > 0 ? driver.currentArrearsMAD : driver.expectedTodayMAD;
    const contractText = driver.contractType === "WEEKLY" ? "hebdomadaire (1,800 MAD/lundi)" : "journalier (300 MAD/jour)";

    const message = encodeURIComponent(
      `Bonjour ${driver.fullName},\n\nNous vous contactons concernant votre versement GoCab (${contractText}).\n` +
      `Votre solde actuel est de : ${amountDue} MAD.\n` +
      `Merci de procéder au règlement pour éviter tout blocage du véhicule (${driver.vehicle?.plate_number || ""}).\n\n` +
      `L'équipe GoCab Operations.`
    );

    return `https://wa.me/${cleanPhone}?text=${message}`;
  }

  // Filtered driver list
  const filteredDrivers = drivers.filter((d) => {
    const matchesSearch =
      d.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phoneSanitized.includes(searchQuery) ||
      (d.vehicle?.plate_number && d.vehicle.plate_number.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === "RED" && !d.isCriticalRed) return false;
    if (filterType === "UNPAID" && d.isPaidToday) return false;
    if (filterType === "DAILY" && d.contractType !== "DAILY") return false;
    if (filterType === "WEEKLY" && d.contractType !== "WEEKLY") return false;

    return true;
  });

  const selectedDateObj = new Date(`${selectedDate}T00:00:00.000Z`);
  const dayName = selectedDateObj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-fadeIn">
      {/* Top Header & Date Bar */}
      <div className="bg-gradient-to-r from-navy via-[#1b3453] to-[#0d1e38] text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-gold/20 text-gold rounded-xl border border-gold/30">
              <DollarSign className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Encaissements Chauffeurs & Suivi Journalier (300 / 1800 MAD)
            </h1>
          </div>
          <p className="text-white/70 text-xs mt-1">
            Saisie quotidienne des versements, automatisation des contrats et alerte rouge au <span className="text-red-300 font-bold">3ème jour sans paiement</span>.
          </p>
        </div>

        {/* Controls: Date & Export */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/20">
            <Calendar className="w-4 h-4 text-gold ml-2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-2"
            />
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
              className="px-2.5 py-1 bg-white text-navy font-bold text-2xs rounded-xl hover:bg-gold transition-colors"
            >
              Aujourd'hui
            </button>
          </div>
          <button
            onClick={() => {
              if (drivers.length === 0) return;
              const headers = "Nom,Telephone,CIN,Vehicule,Jours Sans Paiement,Arrieres (MAD)\n";
              const rows = drivers.map(d => 
                `"${d.fullName}","${d.phoneSanitized}","${d.cinNumber}","${d.vehicle?.plate_number || 'Aucun'}",${d.consecutiveUnpaidDays},${d.currentArrearsMAD}`
              ).join("\n");
              const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `rapport_encaissements_${selectedDate}.csv`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success("Export CSV réussi !");
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl border border-emerald-400 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Expected Today */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
          <span className="text-2xs font-bold text-gray-500 uppercase">Attendu Aujourd'hui ({dayName})</span>
          <p className="text-2xl font-black text-navy mt-1.5">
            {summary?.totalExpectedTodayMAD.toLocaleString()} <span className="text-xs font-normal text-gray-500">MAD</span>
          </p>
          <p className="text-2xs text-gray-400 mt-1">
            300 DH/j (Lun-Sam) + 1,800 DH (Lundi)
          </p>
        </div>

        {/* Collected Today */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
          <span className="text-2xs font-bold text-gray-500 uppercase">Encaissé Aujourd'hui</span>
          <p className="text-2xl font-black text-emerald-600 mt-1.5">
            {summary?.totalClearedTodayMAD.toLocaleString()} <span className="text-xs font-normal text-gray-500">MAD</span>
          </p>
          <div className="w-full h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{
                width: `${
                  summary && summary.totalExpectedTodayMAD > 0
                    ? Math.min(100, Math.round((summary.totalClearedTodayMAD / summary.totalExpectedTodayMAD) * 100))
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Remaining to collect */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
          <span className="text-2xs font-bold text-gray-500 uppercase">Reste à Encaisser</span>
          <p className="text-2xl font-black text-amber-600 mt-1.5">
            {summary?.remainingToCollectMAD.toLocaleString()} <span className="text-xs font-normal text-gray-500">MAD</span>
          </p>
          <p className="text-2xs text-amber-700 mt-1 font-medium">
            Cumul total impayés flotte : {summary?.totalArrearsAllMAD.toLocaleString()} MAD
          </p>
        </div>

        {/* Critical 3rd Day Red Alert Count */}
        <div
          onClick={() => setFilterType(filterType === "RED" ? "ALL" : "RED")}
          className={`p-5 rounded-3xl border shadow-xs cursor-pointer transition-all ${
            summary && summary.criticalRedCount > 0
              ? "bg-red-50 border-red-300 hover:border-red-500 animate-pulse-subtle"
              : "bg-white border-gray-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold text-red-700 uppercase flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              Alerte Rouge (3e Jour)
            </span>
            <span className="text-2xs font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
              {summary?.criticalRedCount || 0}
            </span>
          </div>
          <p className="text-2xl font-black text-red-700 mt-1.5">
            {summary?.criticalRedCount} <span className="text-xs font-medium text-red-600">Chauffeurs</span>
          </p>
          <p className="text-2xs text-red-600 mt-1 font-medium">
            ≥ 2-3 jours sans versement (Risque d'immobilisation)
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Rechercher par chauffeur, téléphone, immatriculation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "ALL" ? "bg-navy text-white shadow-2xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Tous ({drivers.length})
          </button>
          <button
            onClick={() => setFilterType("RED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterType === "RED" ? "bg-red-600 text-white shadow-2xs" : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>🔴 Alerte Rouge ({summary?.criticalRedCount || 0})</span>
          </button>
          <button
            onClick={() => setFilterType("UNPAID")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "UNPAID" ? "bg-amber-600 text-white shadow-2xs" : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            Non Encaissés
          </button>
          <button
            onClick={() => setFilterType("DAILY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "DAILY" ? "bg-blue-600 text-white shadow-2xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Journalier (300 DH)
          </button>
          <button
            onClick={() => setFilterType("WEEKLY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "WEEKLY" ? "bg-purple-600 text-white shadow-2xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Hebdo (1800 DH)
          </button>
          <button
            onClick={fetchDriverCollections}
            className="p-2 text-gray-400 hover:text-navy rounded-xl hover:bg-gray-100 transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Driver Daily Collections Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50/90 uppercase text-2xs tracking-wider text-gray-500 border-b border-gray-100 font-bold">
              <tr>
                <th className="py-4 px-6">Chauffeur & Contact</th>
                <th className="py-4 px-4">Véhicule</th>
                <th className="py-4 px-4">Type Contrat</th>
                <th className="py-4 px-4 text-center">Attendu Aujourd'hui</th>
                <th className="py-4 px-4 text-center">Montant Encaissé (MAD)</th>
                <th className="py-4 px-4 text-center">Jours Sans Versement</th>
                <th className="py-4 px-4 text-right">Total Impayés (Cumul)</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    Aucun chauffeur trouvé pour ces critères.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => {
                  const isRed = driver.isCriticalRed;
                  const isSaving = savingDriverId === driver.id;
                  const currentInputValue = paymentInputs[driver.id] ?? driver.expectedTodayMAD;

                  return (
                    <tr
                      key={driver.id}
                      className={`transition-colors ${
                        isRed
                          ? "bg-red-50/90 hover:bg-red-100/90 border-l-4 border-l-red-600"
                          : driver.isPaidToday
                          ? "bg-emerald-50/30 hover:bg-emerald-50/60"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Driver Info */}
                      <td className="py-4 px-6 font-semibold">
                        <div className="space-y-0.5">
                          <p className={`font-bold text-sm ${isRed ? "text-red-900" : "text-navy"}`}>
                            {driver.fullName}
                          </p>
                          <p className="font-mono text-2xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            {driver.phoneSanitized} · CIN: {driver.cinNumber}
                          </p>
                        </div>
                      </td>

                      {/* Vehicle Immatriculation */}
                      <td className="py-4 px-4">
                        {driver.vehicle ? (
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-xs bg-navy/5 text-navy px-2 py-0.5 rounded-lg border border-navy/10 inline-block">
                              {driver.vehicle.plate_number}
                            </span>
                            <p className="text-2xs text-gray-400 truncate max-w-[120px]">
                              {driver.vehicle.make_model}
                            </p>
                          </div>
                        ) : (
                          <span className="text-2xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                            Non assigné
                          </span>
                        )}
                      </td>

                      {/* Contract Type */}
                      <td className="py-4 px-4">
                        {driver.contractType === "WEEKLY" ? (
                          <span className="text-2xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                            🗓️ Hebdo (1800 DH / Lun)
                          </span>
                        ) : (
                          <span className="text-2xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
                            📅 Journalier (300 DH / j)
                          </span>
                        )}
                      </td>

                      {/* Expected Today */}
                      <td className="py-4 px-4 text-center font-mono font-bold text-gray-700">
                        {driver.expectedTodayMAD > 0 ? (
                          <span>{driver.expectedTodayMAD} MAD</span>
                        ) : (
                          <span className="text-gray-400 text-2xs">0 MAD (Repos)</span>
                        )}
                      </td>

                      {/* Amount Paid Input Field */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="relative w-28">
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={currentInputValue}
                              onChange={(e) =>
                                setPaymentInputs({
                                  ...paymentInputs,
                                  [driver.id]: parseFloat(e.target.value) || 0,
                                })
                              }
                              className={`w-full px-2 py-1.5 text-center font-mono font-bold text-xs rounded-xl border focus:outline-none focus:ring-2 ${
                                driver.isPaidToday
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 focus:ring-emerald-200"
                                  : "border-gray-200 bg-white text-navy focus:ring-navy/20"
                              }`}
                            />
                            <span className="absolute right-2 top-2 text-3xs font-bold text-gray-400">DH</span>
                          </div>

                          {/* Quick autofill expected amount */}
                          {driver.expectedTodayMAD > 0 && currentInputValue !== driver.expectedTodayMAD && (
                            <button
                              type="button"
                              onClick={() =>
                                setPaymentInputs({
                                  ...paymentInputs,
                                  [driver.id]: driver.expectedTodayMAD,
                                })
                              }
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-navy rounded-lg text-2xs font-bold"
                              title="Remplir montant attendu"
                            >
                              <Zap className="w-3 h-3 text-gold" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Consecutive Unpaid Days */}
                      <td className="py-4 px-4 text-center font-bold">
                        {isRed ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-2xs font-extrabold text-white bg-red-600 px-2 py-0.5 rounded-full animate-pulse">
                              🔴 {driver.consecutiveUnpaidDays || 3}e JOUR SANS PAIEMENT
                            </span>
                            <span className="text-3xs text-red-700 font-semibold mt-0.5">
                              Risque Immobilisation
                            </span>
                          </div>
                        ) : driver.consecutiveUnpaidDays === 1 ? (
                          <span className="text-2xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                            ⚠️ 1 jour impayé
                          </span>
                        ) : (
                          <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            ✓ À jour (0 j)
                          </span>
                        )}
                      </td>

                      {/* Total Arrears / Debt Addition */}
                      <td className="py-4 px-4 text-right">
                        <div className="space-y-0.5">
                          <p className={`font-mono font-black text-sm ${driver.currentArrearsMAD > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {driver.currentArrearsMAD.toLocaleString()} MAD
                          </p>
                          {driver.currentArrearsMAD > 0 && (
                            <span className="text-3xs text-red-500 font-semibold block">
                              +{driver.currentArrearsMAD} DH d'arriérés
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions: Save & WhatsApp */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSavePayment(driver)}
                            disabled={isSaving}
                            className="px-3 py-1.5 bg-navy hover:bg-navy/90 text-white rounded-xl font-bold text-2xs shadow-2xs transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            {isSaving ? (
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-gold" />
                            )}
                            <span>Valider</span>
                          </button>

                          <a
                            href={getWhatsAppReminderURL(driver)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-2xs transition-colors"
                            title="Relancer sur WhatsApp avec le solde exact"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
