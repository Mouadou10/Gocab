"use client";

import { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Sun,
  Moon,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Search,
  DollarSign,
  UserCheck,
  UserX,
  Clock,
  Zap,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import RedFlagBadge from "./RedFlagBadge";

interface MatchedDriver {
  driverId: string;
  fullName: string;
  phone: string;
  plateNumber: string;
  morningBalance: number | null;
  eveningBalance: number | null;
  collectedAmount: number;
  expectedMAD?: number;
  status: "PAID" | "PARTIAL" | "UNPAID" | "MORNING_SET";
  isRedFlagged?: boolean;
  redFlagReason?: string | null;
}

interface UnmatchedRow {
  rowNumber: number;
  name: string;
  phone: string;
  balance: number;
}

interface ReconciliationSummary {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  totalCollectedTodayMAD: number;
  totalMorningTargetMAD?: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  vehiclesReassignedCount?: number;
  reassignedVehicles?: {
    plate: string;
    previousDriver: string;
    newDriver: string;
  }[];
}

interface BalanceReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onSuccess: () => void;
  onDateChange?: (newDate: string) => void;
  hasMorningCsv?: boolean;
  morningTargetMAD?: number;
}

type ReconciliationMode = "DUAL" | "MORNING" | "EVENING";

export default function BalanceReconciliationModal({
  isOpen,
  onClose,
  selectedDate,
  onSuccess,
  onDateChange,
  hasMorningCsv = false,
  morningTargetMAD = 0,
}: BalanceReconciliationModalProps) {
  const [mode, setMode] = useState<ReconciliationMode>(() =>
    hasMorningCsv ? "EVENING" : "DUAL"
  );
  const [date, setDate] = useState(selectedDate);
  const [file, setFile] = useState<File | null>(null);
  const [morningFile, setMorningFile] = useState<File | null>(null);
  const [eveningFile, setEveningFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [matchedDrivers, setMatchedDrivers] = useState<MatchedDriver[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedRow[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"matched" | "unmatched">("matched");

  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const morningFileInputRef = useRef<HTMLInputElement>(null);
  const eveningFileInputRef = useRef<HTMLInputElement>(null);

  // Automatically sync date and initial mode when modal opens or selectedDate changes
  useEffect(() => {
    if (isOpen) {
      setDate(selectedDate);
      setMode(hasMorningCsv ? "EVENING" : "DUAL");
      setSummary(null);
      setMatchedDrivers([]);
      setUnmatchedRows([]);
      setFile(null);
      setMorningFile(null);
      setEveningFile(null);
    }
  }, [isOpen, selectedDate, hasMorningCsv]);

  if (!isOpen) return null;

  function isValidSpreadsheet(f: File) {
    const lower = f.name.toLowerCase();
    return (
      lower.endsWith(".csv") ||
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls") ||
      f.type.includes("csv") ||
      f.type.includes("spreadsheet") ||
      f.type.includes("excel")
    );
  }

  function handleSingleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (isValidSpreadsheet(dropped)) {
        setFile(dropped);
      } else {
        toast.error("Veuillez sélectionner un fichier CSV (.csv) ou Excel (.xlsx, .xls).");
      }
    }
  }

  function handleMorningFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (isValidSpreadsheet(dropped)) {
        setMorningFile(dropped);
      } else {
        toast.error("Veuillez sélectionner un fichier CSV (.csv) ou Excel (.xlsx, .xls).");
      }
    }
  }

  function handleEveningFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (isValidSpreadsheet(dropped)) {
        setEveningFile(dropped);
      } else {
        toast.error("Veuillez sélectionner un fichier CSV (.csv) ou Excel (.xlsx, .xls).");
      }
    }
  }

  async function handleProcessCSV() {
    if (mode === "DUAL") {
      if (!morningFile || !eveningFile) {
        toast.error("Veuillez sélectionner à la fois le fichier du Matin et le fichier du Soir.");
        return;
      }
    } else {
      if (!file) {
        toast.error("Veuillez sélectionner un fichier CSV ou Excel (.xlsx).");
        return;
      }
    }

    setIsUploading(true);
    setSummary(null);
    setMatchedDrivers([]);
    setUnmatchedRows([]);

    try {
      const formData = new FormData();
      formData.append("date", date);
      formData.append("mode", mode);

      if (mode === "DUAL") {
        formData.append("morningFile", morningFile!);
        formData.append("eveningFile", eveningFile!);
      } else {
        formData.append("file", file!);
      }

      const res = await fetch("/api/collections/upload-balance", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erreur lors du traitement du fichier");
        return;
      }

      setSummary(data.summary);
      setMatchedDrivers(data.matchedDrivers || []);
      setUnmatchedRows(data.unmatchedRows || []);

      try {
        if (typeof window !== "undefined") {
          const snapshotPayload = {
            date,
            mode,
            timestamp: Date.now(),
            summary: data.summary,
            matchedDrivers: data.matchedDrivers || [],
          };
          localStorage.setItem(`gocab_collections_snapshot_${date}`, JSON.stringify(snapshotPayload));
          if (data.summary?.totalMorningTargetMAD) {
            localStorage.setItem(`gocab_authoritative_morning_target_${date}`, String(data.summary.totalMorningTargetMAD));
          }
          // Remove any stale fullcache so fetchDriverCollections immediately reads the fresh snapshot with collected cash
          localStorage.removeItem(`gocab_collections_fullcache_${date}`);
        }
      } catch (storageErr) {
        console.warn("Could not write collections snapshot to localStorage", storageErr);
      }

      if (mode === "DUAL") {
        toast.success(
          `⚡ Rapprochement Matin + Soir réussi : ${data.summary.totalCollectedTodayMAD.toLocaleString()} MAD encaissés (${data.summary.matchedCount} chauffeurs rapprochés) !`
        );
      } else if (mode === "MORNING") {
        toast.success(
          `☀️ Solde Matin enregistré pour ${data.summary.matchedCount} chauffeurs (Cible : ${(data.summary.totalMorningTargetMAD || 59790).toLocaleString()} MAD) !`
        );
      } else {
        toast.success(
          `🌙 Rapprochement Soir terminé : ${data.summary.totalCollectedTodayMAD.toLocaleString()} MAD encaissés aujourd'hui !`
        );
      }

      if (onDateChange) {
        onDateChange(date);
      }
      onSuccess();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erreur de connexion au serveur.");
    } finally {
      setIsUploading(false);
    }
  }

  const filteredMatched = matchedDrivers.filter(
    (d) =>
      d.fullName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.phone.includes(searchFilter) ||
      d.plateNumber.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-navy via-[#1b3453] to-[#0d1e38] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gold/20 text-gold rounded-2xl border border-gold/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Import & Rapprochement des Soldes (CSV / XLSX)</h2>
              <p className="text-xs text-white/70">
                Calcul automatique des encaissements par rapprochement des soldes du matin et du soir
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Smart Status Guidance Banner */}
          {hasMorningCsv ? (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                <Moon className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-950 text-sm">
                    Solde Matin déjà configuré pour le {date} ({morningTargetMAD ? `${morningTargetMAD.toLocaleString("fr-FR")} MAD de cible` : "Cible active"}).
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                    ✓ Matin Validé
                  </span>
                </div>
                <p className="text-indigo-900 leading-relaxed">
                  Vous pouvez importer le fichier de clôture du soir pour calculer automatiquement les encaissements, ou réimporter les deux fichiers simultanément en mode 2 fichiers.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
              <Sun className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-900 space-y-0.5">
                <p className="font-bold">Date sélectionnée : {date}</p>
                <p className="text-amber-800">
                  Importez le solde matin pour fixer la cible de 59,790 MAD, ou glissez directement les deux fichiers (Matin + Soir) pour un calcul instantané.
                </p>
              </div>
            </div>
          )}

          {/* Mode Selector Tabs (3 Modes) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Mode 1: DUAL (Matin + Soir) */}
            <button
              type="button"
              onClick={() => {
                setMode("DUAL");
                setSummary(null);
              }}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 relative cursor-pointer ${
                mode === "DUAL"
                  ? "border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500/30"
                  : "border-gray-200 bg-gray-50/50 hover:bg-gray-50 text-gray-600"
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  mode === "DUAL" ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`font-bold text-xs ${mode === "DUAL" ? "text-emerald-950" : "text-gray-800"}`}>
                    ⚡ 2 Fichiers (Matin + Soir)
                  </p>
                  <span className="text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">
                    Recommandé
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Glissez les 2 fichiers en même temps pour un calcul instantané.
                </p>
              </div>
            </button>

            {/* Mode 2: MORNING */}
            <button
              type="button"
              onClick={() => {
                setMode("MORNING");
                setSummary(null);
              }}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 relative cursor-pointer ${
                mode === "MORNING"
                  ? "border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500/30"
                  : "border-gray-200 bg-gray-50/50 hover:bg-gray-50 text-gray-600"
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  mode === "MORNING" ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                <Sun className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className={`font-bold text-xs ${mode === "MORNING" ? "text-amber-950" : "text-gray-800"}`}>
                  ☀️ 1. Solde Matin Seul
                </p>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Fixe le solde de départ et la cible de la journée (59,790 MAD).
                </p>
              </div>
            </button>

            {/* Mode 3: EVENING */}
            <button
              type="button"
              onClick={() => {
                setMode("EVENING");
                setSummary(null);
              }}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 relative cursor-pointer ${
                mode === "EVENING"
                  ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-500/30"
                  : "border-gray-200 bg-gray-50/50 hover:bg-gray-50 text-gray-600"
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  mode === "EVENING" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                <Moon className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className={`font-bold text-xs ${mode === "EVENING" ? "text-indigo-950" : "text-gray-800"}`}>
                  🌙 2. Solde Soir Seul
                </p>
                <p className="text-[11px] text-gray-500 leading-tight">
                  Calcule les encaissements par rapport au matin déjà enregistré.
                </p>
              </div>
            </button>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-200">
            <span className="text-xs font-bold text-gray-700">Date d&apos;application :</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
            <span className="text-2xs text-gray-400">
              (Les calculs d&apos;encaissements seront rattachés à cette journée)
            </span>
          </div>

          {/* File Upload Zone(s) */}
          {mode === "DUAL" ? (
            /* DUAL DROPZONES */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Morning Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleMorningFileDrop}
                onClick={() => morningFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  morningFile
                    ? "border-amber-500 bg-amber-50/40"
                    : "border-gray-300 bg-gray-50/50 hover:bg-amber-50/20 hover:border-amber-300"
                }`}
              >
                <input
                  ref={morningFileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => e.target.files?.[0] && setMorningFile(e.target.files[0])}
                  className="hidden"
                />
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    morningFile ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Sun className="w-5 h-5" />
                </div>
                {morningFile ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-amber-950 truncate max-w-[240px]">{morningFile.name}</p>
                    <p className="text-[10px] text-gray-500">
                      ☀️ Fichier Matin · {(morningFile.size / 1024).toFixed(1)} KB (Prêt)
                    </p>
                    <p className="text-[10px] text-blue-600 font-semibold hover:underline">Changer de fichier</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-gray-700">1. Glissez le Fichier Matin</p>
                    <p className="text-[10px] text-gray-400">CSV ou Excel (.xlsx) avec soldes de départ</p>
                  </div>
                )}
              </div>

              {/* Evening Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleEveningFileDrop}
                onClick={() => eveningFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  eveningFile
                    ? "border-indigo-600 bg-indigo-50/40"
                    : "border-gray-300 bg-gray-50/50 hover:bg-indigo-50/20 hover:border-indigo-300"
                }`}
              >
                <input
                  ref={eveningFileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => e.target.files?.[0] && setEveningFile(e.target.files[0])}
                  className="hidden"
                />
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    eveningFile ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  <Moon className="w-5 h-5" />
                </div>
                {eveningFile ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-indigo-950 truncate max-w-[240px]">{eveningFile.name}</p>
                    <p className="text-[10px] text-gray-500">
                      🌙 Fichier Soir · {(eveningFile.size / 1024).toFixed(1)} KB (Prêt)
                    </p>
                    <p className="text-[10px] text-blue-600 font-semibold hover:underline">Changer de fichier</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-gray-700">2. Glissez le Fichier Soir</p>
                    <p className="text-[10px] text-gray-400">CSV ou Excel (.xlsx) avec soldes de fin</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SINGLE DROPZONE (MORNING OR EVENING) */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleSingleFileDrop}
              onClick={() => singleFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                file
                  ? "border-emerald-500 bg-emerald-50/30"
                  : "border-gray-300 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-400"
              }`}
            >
              <input
                ref={singleFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                className="hidden"
              />

              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  file ? "bg-emerald-100 text-emerald-700" : "bg-navy/5 text-navy"
                }`}
              >
                <UploadCloud className="w-6 h-6" />
              </div>

              {file ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-emerald-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB · Prêt pour analyse (Colonnes détectées : Name, Phone, Balance...)
                  </p>
                  <p className="text-2xs text-blue-600 hover:underline mt-1 font-semibold">
                    Cliquer pour choisir un autre fichier
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-700">
                    Glissez-déposez le fichier CSV ou Excel (.xlsx) ou cliquez pour parcourir
                  </p>
                  <p className="text-xs text-gray-400">
                    Prend en charge les fichiers <code>.xlsx</code>, <code>.xls</code> et <code>.csv</code> (colonnes <code>Name</code>, <code>Phone Number</code>, <code>Balance</code>, <code>Vehicles</code>).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              onClick={handleProcessCSV}
              disabled={
                isUploading ||
                (mode === "DUAL" ? !morningFile || !eveningFile : !file)
              }
              className="px-6 py-3 bg-navy hover:bg-navy/90 text-white font-bold text-xs rounded-2xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Traitement et calcul des encaissements en cours…
                </>
              ) : mode === "DUAL" ? (
                <>
                  <Zap className="w-4 h-4 text-emerald-300" />
                  Lancer le Rapprochement Matin + Soir
                </>
              ) : mode === "MORNING" ? (
                <>
                  <Sun className="w-4 h-4 text-gold" />
                  Enregistrer les Soldes du Matin
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 text-emerald-300" />
                  Lancer le Rapprochement du Soir
                </>
              )}
            </button>
          </div>

          {/* Results Summary Section */}
          {summary && (
            <div className="space-y-4 pt-4 border-t border-gray-100 animate-fadeIn">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <span>📊</span> Résumé du Rapprochement
              </h3>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <span className="text-3xs font-bold text-gray-400 uppercase">Chauffeurs Reconnus</span>
                  <p className="text-xl font-extrabold text-navy mt-1">
                    {summary.matchedCount} <span className="text-xs font-normal text-gray-400">/ {summary.totalRows}</span>
                  </p>
                </div>

                {mode === "DUAL" || mode === "EVENING" ? (
                  <>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <span className="text-3xs font-bold text-emerald-700 uppercase">Total Encaissé</span>
                      <p className="text-xl font-extrabold text-emerald-700 mt-1">
                        {summary.totalCollectedTodayMAD.toLocaleString()} <span className="text-xs font-normal">MAD</span>
                      </p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <span className="text-3xs font-bold text-blue-700 uppercase">Chauffeurs Ayant Payé</span>
                      <p className="text-xl font-extrabold text-blue-700 mt-1">
                        {summary.paidCount + summary.partialCount}
                        <span className="text-3xs font-normal text-gray-500 ml-1">
                          ({summary.paidCount} complet, {summary.partialCount} partiel)
                        </span>
                      </p>
                    </div>

                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                      <span className="text-3xs font-bold text-red-700 uppercase">Non Payés</span>
                      <p className="text-xl font-extrabold text-red-700 mt-1">
                        {summary.unpaidCount} <span className="text-xs font-normal">chauffeurs</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="col-span-3 bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Soldes initiaux enregistrés avec succès : {(summary.totalMorningTargetMAD || 59790).toLocaleString()} MAD de cible fixée
                      </p>
                      <p className="text-3xs text-amber-700">
                        À la clôture de journée, importez le fichier du soir pour que le système calcule automatiquement les encaissements réels.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reassigned Vehicles Resume */}
              {summary.reassignedVehicles && summary.reassignedVehicles.length > 0 && (
                <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-900 space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5 text-blue-950">
                    <span>🔄</span> {summary.reassignedVehicles.length} Véhicule(s) synchronisé(s) et réassigné(s) selon le fichier :
                  </p>
                  <div className="flex flex-wrap gap-2 text-2xs">
                    {summary.reassignedVehicles.map((r: any, idx: number) => (
                      <span key={idx} className="bg-white/90 border border-blue-200 px-2.5 py-1 rounded-xl shadow-2xs">
                        <strong className="text-navy font-mono">{r.plate}</strong> : <span className="line-through text-gray-500">{r.previousDriver}</span> ➔ <strong className="text-emerald-700">{r.newDriver}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation Tabs between Matched & Unmatched */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("matched")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      activeTab === "matched"
                        ? "bg-navy text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Chauffeurs Rapprochés ({matchedDrivers.length})
                  </button>
                  {unmatchedRows.length > 0 && (
                    <button
                      onClick={() => setActiveTab("unmatched")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                        activeTab === "unmatched"
                          ? "bg-red-600 text-white"
                          : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                      }`}
                    >
                      Lignes Non Reconnues ({unmatchedRows.length})
                    </button>
                  )}
                </div>

                {activeTab === "matched" && (
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filtrer par nom, tél..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20"
                    />
                  </div>
                )}
              </div>

              {/* Reconciled Drivers Table */}
              {activeTab === "matched" ? (
                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-2xs max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-2xs uppercase text-gray-500 font-bold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-4">Chauffeur</th>
                        <th className="py-2.5 px-3">Véhicule</th>
                        <th className="py-2.5 px-3 text-right">Solde Matin</th>
                        {(mode === "DUAL" || mode === "EVENING") && (
                          <>
                            <th className="py-2.5 px-3 text-right">Solde Soir</th>
                            <th className="py-2.5 px-3 text-right font-bold text-emerald-700">Encaissé</th>
                            <th className="py-2.5 px-4 text-center">Statut</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredMatched.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50/80 ${item.isRedFlagged ? "bg-red-50/30" : ""}`}>
                          <td className="py-2 px-4 font-semibold text-navy">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{item.fullName}</span>
                              {item.isRedFlagged && (
                                <RedFlagBadge reason={item.redFlagReason} />
                              )}
                            </div>
                            <div className="text-3xs text-gray-400 font-mono">{item.phone}</div>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-2xs text-gray-700">
                            {item.plateNumber}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">
                            {item.morningBalance !== null ? `${item.morningBalance} DH` : "-"}
                          </td>
                          {(mode === "DUAL" || mode === "EVENING") && (
                            <>
                              <td className="py-2 px-3 text-right font-mono text-xs text-gray-900 font-bold">
                                {item.eveningBalance !== null ? `${item.eveningBalance} DH` : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-xs text-emerald-600">
                                {item.collectedAmount > 0 ? `+${item.collectedAmount} DH` : "0 DH"}
                              </td>
                              <td className="py-2 px-4 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-3xs font-bold ${
                                    item.status === "PAID"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : item.status === "PARTIAL"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {item.status === "PAID"
                                    ? "✅ Payé"
                                    : item.status === "PARTIAL"
                                    ? "⚠️ Partiel"
                                    : "❌ Non payé"}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-red-100 rounded-2xl overflow-hidden shadow-2xs max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-50 text-2xs uppercase text-red-700 font-bold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-4">Ligne</th>
                        <th className="py-2.5 px-4">Nom dans le fichier</th>
                        <th className="py-2.5 px-4">Téléphone</th>
                        <th className="py-2.5 px-4 text-right">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {unmatchedRows.map((item, idx) => (
                        <tr key={idx} className="hover:bg-red-50/50">
                          <td className="py-2 px-4 text-gray-500 font-mono text-3xs">#{item.rowNumber}</td>
                          <td className="py-2 px-4 font-semibold text-gray-800">{item.name}</td>
                          <td className="py-2 px-4 font-mono text-gray-600">{item.phone}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-red-600">
                            {item.balance} DH
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-3xs text-gray-400">
            GoCab Operations CRM · Rapprochement automatique des soldes chauffeurs
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
