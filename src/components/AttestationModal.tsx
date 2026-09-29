"use client";

import React, { useState, useMemo } from "react";
import { printAttestation } from "@/lib/attestationPrint";
import { GOCAB_OFFICIAL_LOGO_BASE64 } from "@/lib/gocabOfficialLogo";
import { calculateOneMonthPeriod } from "@/lib/attestationDate";
import toast from "react-hot-toast";

export interface AttestationData {
  vehicleId?: string;
  fullName: string;
  cin: string;
  brand: string;
  immat: string;
  chassisNumber: string;
  date: string;
  inspectionId?: string;
}

interface AttestationModalProps {
  data: AttestationData;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: (info: any) => void;
}

export default function AttestationModal({ data, isOpen, onClose, onSaveSuccess }: AttestationModalProps) {
  // Allow user to fine-tune or fill missing variables before printing
  const [fullName, setFullName] = useState(data.fullName || "");
  const [cin, setCin] = useState(data.cin || "");
  const [brand, setBrand] = useState(data.brand || "");
  const [immat, setImmat] = useState(data.immat || "");
  const [chassisNumber, setChassisNumber] = useState(data.chassisNumber || "");
  const [date, setDate] = useState(data.date || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  // Sync state if props change
  React.useEffect(() => {
    setFullName(data.fullName || "");
    setCin(data.cin || "");
    setBrand(data.brand || "");
    setImmat(data.immat || "");
    setChassisNumber(data.chassisNumber || "");
    setDate(data.date || "");
    setHasSaved(false);
  }, [data]);

  // Live 1-month period calculation based on attestation date as Day 1
  const periodInfo = useMemo(() => {
    try {
      return calculateOneMonthPeriod(date);
    } catch {
      return null;
    }
  }, [date]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/attestations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: data.vehicleId,
          immat,
          fullName,
          cin,
          brand,
          chassisNumber,
          date,
          inspectionId: data.inspectionId,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        setHasSaved(true);
        toast.success(
          `Attestation enregistrée ! Période de 1 mois active jusqu'au ${result.formattedExpiryDate}. Alerte programmée pour la fin de mois.`,
          { duration: 5500 }
        );
        onSaveSuccess?.(result);
      } else {
        toast.error(result.error || "Erreur lors de l'enregistrement");
      }
    } catch (err: any) {
      console.error("Save attestation error:", err);
      toast.error("Erreur de connexion lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    printAttestation({
      fullName,
      cin,
      brand,
      immat,
      chassisNumber,
      date,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Container Dialog */}
      <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none print:bg-white print:rounded-none">
        
        {/* Modal Top Bar (Hidden on Print) */}
        <div className="no-print bg-white dark:bg-slate-800 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl">📄</span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Attestation de Location de Voiture</span>
                  {periodInfo && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        periodInfo.isExpired
                          ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700"
                          : periodInfo.isEndingSoon
                          ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 animate-pulse"
                          : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                      }`}
                    >
                      {periodInfo.isExpired
                        ? `🚨 Expiré (${Math.abs(periodInfo.daysLeft)}j)`
                        : periodInfo.isEndingSoon
                        ? `⚠️ Échéance (${periodInfo.daysLeft}j)`
                        : `✓ 1 Mois (${periodInfo.daysLeft}j restants)`}
                    </span>
                  )}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Annexe 3 de la Convention — Durée 1 Mois renouvelable
                </p>
              </div>
            </div>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{isEditing ? "👁️ Rendu" : "✏️ Modifier"}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-bold rounded-lg shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                hasSaved
                  ? "bg-blue-700 hover:bg-blue-600 text-white"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
              title="Enregistrer la date comme premier jour de la période de 1 mois et calculer l'échéance"
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : hasSaved ? (
                <>
                  <span>✓</span>
                  <span>Enregistré</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Enregistrer (1 Mois)</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🖨️ Imprimer</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:inline-flex p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Edit Fields Drawer (Optional pre-print adjustments) */}
        {isEditing && (
          <div className="no-print bg-amber-50 dark:bg-amber-950/40 p-4 border-b border-amber-200 dark:border-amber-800/60 text-xs">
            <div className="font-bold text-amber-900 dark:text-amber-200 mb-2">
              Modifier les informations avant impression :
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Nom du Chauffeur :</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ex: Mohamed Alami"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">CIN :</label>
                <input
                  type="text"
                  value={cin}
                  onChange={(e) => setCin(e.target.value)}
                  placeholder="ex: BE123456"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Marque Véhicule :</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="ex: Dacia Logan"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Immatriculation :</label>
                <input
                  type="text"
                  value={immat}
                  onChange={(e) => setImmat(e.target.value)}
                  placeholder="ex: 12345-A-6"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">N° de châssis (VIN) :</label>
                <input
                  type="text"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value)}
                  placeholder="ex: VF14SD..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Date d&apos;émission :</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="ex: 15 septembre 2026"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* 1-Month Period & Next Ending Month Warning Banner (Non-printable) */}
        {periodInfo && (
          <div className="no-print mx-4 sm:mx-6 mt-4 p-3.5 sm:p-4 rounded-xl border transition-all duration-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-2xl sm:text-3xl shrink-0">
                {periodInfo.isExpired ? "🚨" : periodInfo.isEndingSoon ? "⚠️" : "🗓️"}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Période Contractuelle de 1 Mois
                  </h3>
                  {periodInfo.isExpired ? (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-600 text-white animate-pulse">
                      Expirée ({Math.abs(periodInfo.daysLeft)}j de dépassement)
                    </span>
                  ) : periodInfo.isEndingSoon ? (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-amber-500 text-white animate-pulse">
                      Alerte Fin de Mois ({periodInfo.daysLeft} jour{periodInfo.daysLeft > 1 ? "s" : ""} restant{periodInfo.daysLeft > 1 ? "s" : ""})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-600 text-white">
                      Conforme ({periodInfo.daysLeft} jours restants)
                    </span>
                  )}
                  {hasSaved && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                      ✓ Période Enregistrée
                    </span>
                  )}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    <strong>Jour 1 (Début) :</strong> {periodInfo.formattedStartDate}
                  </span>
                  <span>→</span>
                  <span>
                    <strong>Échéance (Fin du mois) :</strong> {periodInfo.formattedExpiryDate}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  L&apos;enregistrement prend cette date comme premier jour, fixe l&apos;échéance à +1 mois et active les alertes de fin de mois.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg shadow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  hasSaved
                    ? "bg-blue-700 text-white hover:bg-blue-600"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : hasSaved ? (
                  <>
                    <span>✓</span>
                    <span>Période Enregistrée</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Enregistrer (1 Mois)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Document Body (Printable Sheet) */}
        <div className="overflow-y-auto p-4 sm:p-8 flex justify-center print:p-0 print:overflow-visible">
          <div
            id="printable-attestation"
            className="w-full max-w-[210mm] min-h-[280mm] bg-white text-slate-900 p-8 sm:p-12 shadow-md print:shadow-none print:p-8 flex flex-col justify-between"
            style={{
              fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
              color: "#0f172a",
              lineHeight: 1.6,
            }}
          >
            <div>
              {/* Header Logo */}
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={GOCAB_OFFICIAL_LOGO_BASE64}
                    alt="GoCab Logo"
                    className="h-12 w-auto object-contain"
                  />
                </div>
                <div className="mt-2 text-[13px] text-slate-700 italic font-serif">
                  Annexe 3 de la CONVENTION DE PARTENARIAT
                </div>
              </div>

              {/* Title */}
              <div className="text-center my-8">
                <h1 className="text-lg sm:text-xl font-bold uppercase underline tracking-wide decoration-1 underline-offset-4">
                  ATTESTATION DE LOCATION DE VOITURE
                </h1>
              </div>

              {/* Legal Header */}
              <div className="text-justify text-[13.5px] leading-relaxed mb-6 space-y-4">
                <p>
                  Nous soussignés, <strong>GOCAB RENT</strong> (GOCAB®), SARL au capital de 500.000
                  DH dont le siège est à Casablanca,{" "}
                  <strong>
                    84 RUE IBNOU MOUNIR N38 CENTRE ANDALUCIA- Casablanca
                  </strong>
                  , légalement représentée par :
                </p>

                <p className="font-bold text-[14px]">Mr Hamza RASSID (Gérant)</p>

                <p>Attestons par la présente avoir loué à :</p>
              </div>

              {/* Driver Details */}
              <div className="text-[14px] font-bold space-y-1 mb-6 ml-2">
                <div>Nom : {fullName || "_________________________"}</div>
                <div>CIN : {cin || "_________________________"}</div>
              </div>

              {/* Vehicle & Contract Specifications */}
              <div className="mb-8 ml-4">
                <ul className="list-disc space-y-3 text-[14px] font-bold">
                  <li>
                    Marque véhicule :{" "}
                    <span className="font-semibold">{brand || "_________________________"}</span>
                  </li>
                  <li>
                    Immatriculation :{" "}
                    <span className="font-semibold font-mono text-navy">{immat || "_________________________"}</span>
                  </li>
                  <li>
                    N° de châssis :{" "}
                    <span className="font-semibold font-mono">
                      {chassisNumber || "_________________________"}
                    </span>
                  </li>
                  <li>
                    Durée de location :{" "}
                    <span className="font-bold">
                      1 Mois renouvelable après consentement des deux parties (la société et le
                      partenaire)
                    </span>
                  </li>
                </ul>
              </div>

              {/* Procuration / Legal Clauses */}
              <div className="text-justify text-[13.5px] leading-relaxed space-y-4 mb-10">
                <p>
                  Donnons à l&apos;utilisateur de ce véhicule, porteur de la présente,{" "}
                  <strong>procuration spéciale</strong> pour nous représenter auprès des autorités
                  locales afin de retirer ce véhicule de la fourrière municipale.
                </p>
                <p>
                  En foi de quoi, la présente attestation est délivrée à l&apos;intéressé pour servir
                  et valoir ce que de droit.
                </p>
              </div>
            </div>

            {/* Signature & Date Block */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-end text-[14px] font-bold gap-6 min-h-[90px]">
              <div>
                Fait à Casablanca, le{" "}
                <span className="font-semibold">{date || "_________________________"}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div>Signé : HAMZA RASSID (Gérant)</div>
                <div className="text-xs text-slate-400 italic">Signature & Cachet</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar (Hidden on Print) */}
        <div className="no-print bg-slate-50 dark:bg-slate-800 px-6 py-3.5 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>ℹ️</span>
            <span>
              La date d&apos;attestation sert de <strong>Jour 1</strong> pour le calcul du mois. L&apos;avertissement d&apos;échéance est automatiquement synchronisé.
            </span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 font-bold rounded-lg shadow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                hasSaved
                  ? "bg-blue-700 hover:bg-blue-600 text-white"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : hasSaved ? (
                <>
                  <span>✓</span>
                  <span>Période Enregistrée</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Enregistrer (1 Mois)</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🖨️ Imprimer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
