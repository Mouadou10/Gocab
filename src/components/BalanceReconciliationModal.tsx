"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";

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
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
}

interface BalanceReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onSuccess: () => void;
}

export default function BalanceReconciliationModal({
  isOpen,
  onClose,
  selectedDate,
  onSuccess,
}: BalanceReconciliationModalProps) {
  const [mode, setMode] = useState<"MORNING" | "EVENING">("MORNING");
  const [date, setDate] = useState(selectedDate);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [matchedDrivers, setMatchedDrivers] = useState<MatchedDriver[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedRow[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"matched" | "unmatched">("matched");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".csv") || droppedFile.type.includes("csv")) {
        setFile(droppedFile);
      } else {
        toast.error("Veuillez sélectionner un fichier CSV (.csv).");
      }
    }
  }

  async function handleProcessCSV() {
    if (!file) {
      toast.error("Veuillez sélectionner un fichier CSV.");
      return;
    }

    setIsUploading(true);
    setSummary(null);
    setMatchedDrivers([]);
    setUnmatchedRows([]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      formData.append("date", date);

      const res = await fetch("/api/collections/upload-balance", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erreur lors du traitement du CSV");
        return;
      }

      setSummary(data.summary);
      setMatchedDrivers(data.matchedDrivers || []);
      setUnmatchedRows(data.unmatchedRows || []);

      if (mode === "MORNING") {
        toast.success(`☀️ Solde Matin enregistré pour ${data.summary.matchedCount} chauffeurs !`);
      } else {
        toast.success(
          `🌙 Rapprochement Soir terminé : ${data.summary.totalCollectedTodayMAD.toLocaleString()} MAD encaissés aujourd'hui !`
        );
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
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-navy via-[#1b3453] to-[#0d1e38] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gold/20 text-gold rounded-2xl border border-gold/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Import & Rapprochement des Soldes CSV</h2>
              <p className="text-xs text-white/70">
                Mise à jour des soldes de départ et calcul automatique des encaissements de la journée
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Mode Selector (Matin vs Soir) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setMode("MORNING");
                setSummary(null);
              }}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                mode === "MORNING"
                  ? "border-amber-500 bg-amber-50/60 shadow-sm"
                  : "border-gray-200 bg-gray-50/50 hover:bg-gray-50 text-gray-600"
              }`}
            >
              <div
                className={`p-2.5 rounded-xl ${
                  mode === "MORNING" ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                <Sun className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className={`font-bold text-sm ${mode === "MORNING" ? "text-amber-950" : "text-gray-800"}`}>
                  1. Solde Matin (Début de journée)
                </p>
                <p className="text-xs text-gray-500">
                  Enregistre le solde initial de chaque chauffeur pour la journée sélectionnée.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("EVENING");
                setSummary(null);
              }}
              className={`p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                mode === "EVENING"
                  ? "border-indigo-600 bg-indigo-50/60 shadow-sm"
                  : "border-gray-200 bg-gray-50/50 hover:bg-gray-50 text-gray-600"
              }`}
            >
              <div
                className={`p-2.5 rounded-xl ${
                  mode === "EVENING" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                <Moon className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className={`font-bold text-sm ${mode === "EVENING" ? "text-indigo-950" : "text-gray-800"}`}>
                  2. Solde Soir & Rapprochement Automatique
                </p>
                <p className="text-xs text-gray-500">
                  Compare le solde du soir à celui du matin, calcule les montants versés et met à jour le CRM.
                </p>
              </div>
            </button>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
            <span className="text-xs font-bold text-gray-700">Date d&apos;application :</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
            <span className="text-2xs text-gray-400">
              (Les calculs de journée seront appliqués à cette date)
            </span>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              file
                ? "border-emerald-500 bg-emerald-50/30"
                : "border-gray-300 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-400"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
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
                  Glissez-déposez le fichier CSV ou cliquez pour parcourir
                </p>
                <p className="text-xs text-gray-400">
                  Prend en charge les exports Yassir / GoCab contenant les colonnes <code>Name</code>, <code>Phone Number</code> et <code>Balance</code>.
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <button
              onClick={handleProcessCSV}
              disabled={!file || isUploading}
              className="px-6 py-3 bg-navy hover:bg-navy/90 text-white font-bold text-xs rounded-2xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Traitement et calcul en cours…
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

                {mode === "EVENING" ? (
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
                      <p className="text-xs font-bold text-amber-900">Soldes initiaux enregistrés avec succès</p>
                      <p className="text-3xs text-amber-700">
                        À la fin de la journée, importez le fichier du soir pour que le système calcule automatiquement les encaissements.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Tabs between Matched & Unmatched */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("matched")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
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
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
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
                        {mode === "EVENING" && (
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
                        <tr key={idx} className="hover:bg-gray-50/80">
                          <td className="py-2 px-4 font-semibold text-navy">
                            <div>{item.fullName}</div>
                            <div className="text-3xs text-gray-400 font-mono">{item.phone}</div>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-2xs text-gray-700">
                            {item.plateNumber}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">
                            {item.morningBalance !== null ? `${item.morningBalance} DH` : "-"}
                          </td>
                          {mode === "EVENING" && (
                            <>
                              <td className="py-2 px-3 text-right font-mono text-xs text-gray-900 font-bold">
                                {item.eveningBalance !== null ? `${item.eveningBalance} DH` : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-xs text-emerald-600">
                                +{item.collectedAmount} DH
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
                        <th className="py-2.5 px-4">Nom dans le CSV</th>
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
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
