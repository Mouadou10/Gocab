"use client";

/**
 * DriverCSVUploader Component
 *
 * File input + modal for bulk uploading existing drivers via CSV.
 * Features drag-and-drop, sample format download, and summary reporting.
 */

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, X, Download } from "lucide-react";
import toast from "react-hot-toast";

interface DriverUploadSummary {
  total_rows: number;
  inserted: number;
  updated: number;
  linked_vehicles: number;
  skipped_invalid: number;
}

interface DriverCSVUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function DriverCSVUploader({
  isOpen,
  onClose,
  onUploadSuccess,
}: DriverCSVUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<DriverUploadSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSummary(null);
    }
  }

  function downloadSampleCSV() {
    const sampleHeaders = "Nom Complet,Telephone,CIN,Age,Anciennete Permis,Type Contrat,Immatriculation,Impayes MAD\n";
    const sampleRow1 = "Karim Benali,0661234567,BE123456,32,5,STANDARD,12345-A-1,0\n";
    const sampleRow2 = "Youssef Idrissi,0678901234,BK987654,29,3,STANDARD,,150\n";
    const blob = new Blob([sampleHeaders + sampleRow1 + sampleRow2], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modele_chauffeurs_gocab.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleUpload() {
    if (!selectedFile) {
      toast.error("Veuillez sélectionner un fichier CSV");
      return;
    }

    setIsUploading(true);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/upload-drivers", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Échec de l'importation");
        return;
      }

      setSummary(data.summary);
      toast.success(`${data.summary.inserted} chauffeurs importés avec succès!`);
      onUploadSuccess();
    } catch (err: any) {
      toast.error("Erreur réseau lors du téléversement");
    } finally {
      setIsUploading(false);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy via-[#1e3a5f] to-[#0f1e35] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Upload className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Importer des Chauffeurs (CSV)</h3>
              <p className="text-xs text-white/70">Importez vos chauffeurs existants et associez les véhicules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Sample Download Bar */}
          <div className="flex items-center justify-between p-3.5 bg-amber-50 rounded-2xl border border-amber-200/60 text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-medium">
              <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Format attendu : Nom, Téléphone, CIN, Permis, Immatriculation...</span>
            </div>
            <button
              onClick={downloadSampleCSV}
              type="button"
              className="flex items-center gap-1 font-semibold text-navy hover:underline bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs whitespace-nowrap"
            >
              <Download className="w-3 h-3" /> Modèle CSV
            </button>
          </div>

          {/* File Picker Zone */}
          {!summary ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                selectedFile
                  ? "border-navy bg-navy/5"
                  : "border-gray-300 hover:border-navy hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center text-navy">
                <Upload className="w-6 h-6" />
              </div>
              {selectedFile ? (
                <div>
                  <p className="font-semibold text-navy text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB — Prêt à importer
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-gray-700 text-sm">
                    Cliquez ou glissez votre fichier CSV ici
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Fichiers .CSV uniquement</p>
                </div>
              )}
            </div>
          ) : (
            /* Summary Report Card */
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Rapport d'importation terminé</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-emerald-100">
                  <p className="text-gray-500">Total lignes traitées</p>
                  <p className="text-base font-bold text-gray-800">{summary.total_rows}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100">
                  <p className="text-gray-500">Nouveaux chauffeurs</p>
                  <p className="text-base font-bold text-emerald-600">+{summary.inserted}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100">
                  <p className="text-gray-500">Chauffeurs mis à jour</p>
                  <p className="text-base font-bold text-blue-600">{summary.updated}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100">
                  <p className="text-gray-500">Véhicules liés</p>
                  <p className="text-base font-bold text-navy">{summary.linked_vehicles}</p>
                </div>
              </div>
              {summary.skipped_invalid > 0 && (
                <p className="text-xs text-amber-700 flex items-center gap-1.5 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {summary.skipped_invalid} lignes ignorées (données manquantes ou numéro invalide)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          {summary ? (
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors shadow-sm"
            >
              Fermer
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-200/50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading || !selectedFile}
                className="px-6 py-2.5 bg-navy hover:bg-navy/90 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Importation...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-gold" />
                    <span>Lancer l'importation</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
