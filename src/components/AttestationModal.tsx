"use client";

import React, { useState } from "react";
import GoCabLogo from "./GoCabLogo";

export interface AttestationData {
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
}

export default function AttestationModal({ data, isOpen, onClose }: AttestationModalProps) {
  // Allow user to fine-tune or fill missing variables before printing
  const [fullName, setFullName] = useState(data.fullName || "");
  const [cin, setCin] = useState(data.cin || "");
  const [brand, setBrand] = useState(data.brand || "");
  const [immat, setImmat] = useState(data.immat || "");
  const [chassisNumber, setChassisNumber] = useState(data.chassisNumber || "");
  const [date, setDate] = useState(data.date || "");
  const [isEditing, setIsEditing] = useState(false);

  // Sync state if props change
  React.useEffect(() => {
    setFullName(data.fullName || "");
    setCin(data.cin || "");
    setBrand(data.brand || "");
    setImmat(data.immat || "");
    setChassisNumber(data.chassisNumber || "");
    setDate(data.date || "");
  }, [data]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Container Dialog */}
      <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none print:bg-white print:rounded-none">
        
        {/* Modal Top Bar (Hidden on Print) */}
        <div className="no-print bg-white dark:bg-slate-800 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl">📄</span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Attestation de Location de Voiture
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Annexe 3 de la Convention — Prête à l&apos;impression A4
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
              className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{isEditing ? "👁️ Rendu" : "✏️ Modifier"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
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
                <div className="flex items-center gap-2">
                  <GoCabLogo className="w-12 h-12" />
                  <span className="font-extrabold text-2xl tracking-wider text-slate-800">
                    GOCAB
                  </span>
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

                <p>Attestons par la présente avoir louer à :</p>
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
                    <span className="font-semibold">{immat || "_________________________"}</span>
                  </li>
                  <li>
                    N° de châssis :{" "}
                    <span className="font-semibold">
                      {chassisNumber || "_________________________"}
                    </span>
                  </li>
                  <li>
                    Durée de location :{" "}
                    <span className="font-bold">
                      1 Mois renouvelable après consentement des deux parties ( la société et le
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
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-end text-[14px] font-bold gap-6">
              <div>
                Fait à Casablanca, le{" "}
                <span className="font-semibold">{date || "_________________________"}</span>
              </div>
              <div className="text-right">
                <div>Signé : HAMZA RASSID (Gérant)</div>
                <div className="mt-8 text-xs text-slate-400 italic">
                  Cachet & Signature
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar (Hidden on Print) */}
        <div className="no-print bg-slate-50 dark:bg-slate-800 px-6 py-3.5 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
          <div>
            Format A4 optimisé pour impression directe ou exportation PDF.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span>🖨️ Imprimer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global CSS for Print Mode */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-attestation,
          #printable-attestation * {
            visibility: visible !important;
          }
          #printable-attestation {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            min-height: 100vh !important;
            margin: 0 !important;
            padding: 15mm 15mm !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: #000 !important;
            box-sizing: border-box !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
