"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Car, User, MapPin, ShieldCheck, Clock, AlertTriangle } from "lucide-react";

interface ClaimSummary {
  id: string;
  plate_number: string;
  make_model: string;
  hub_city: string;
  driver_name: string;
  driver_phone: string | null;
  timeline_step: string;
  created_at: string;
  fleet_manager_name: string;
  fleet_created_on_gocab_fleet: boolean;
  fleet_created_at: string | null;
  fleet_created_by: string | null;
}

function ConfirmFleetAccidentInner({ claimId }: { claimId: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ClaimSummary | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!claimId || !token) {
        setError("Lien de validation incomplet ou invalide.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/accidents/confirm-fleet?id=${encodeURIComponent(claimId)}&t=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data.success) {
          setError(data.error || "Impossible de charger le dossier accident.");
        } else {
          setSummary(data.summary);
        }
      } catch {
        if (active) setError("Erreur réseau. Vérifiez votre connexion internet.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [claimId, token]);

  const handleConfirm = async () => {
    if (!summary || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/accidents/confirm-fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: claimId,
          token,
          confirmedBy: summary.fleet_manager_name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Échec de la validation.");
      } else {
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                fleet_created_on_gocab_fleet: true,
                fleet_created_at: data.meta?.fleet_created_at || new Date().toISOString(),
                fleet_created_by: data.meta?.fleet_created_by || prev.fleet_manager_name,
              }
            : prev
        );
      }
    } catch {
      setError("Erreur réseau lors de la confirmation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-lg">
                🚨
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight">GoCab Fleet Sync</h1>
                <p className="text-xs text-slate-300">Validation création dossier accident</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 border border-white/15">
              CRM ↔ Fleet
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-10 text-center space-y-3">
              <Clock className="w-8 h-8 text-slate-500 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-600">
                Vérification du dossier accident...
              </p>
            </div>
          ) : error && !summary ? (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
              <p className="text-sm font-bold text-red-900">{error}</p>
            </div>
          ) : summary ? (
            <>
              {/* Vehicle Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-lg font-black bg-slate-900 text-white px-3 py-1 rounded-xl tracking-wider">
                    🚗 {summary.plate_number}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-200">
                    Portefeuille : {summary.fleet_manager_name}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs text-slate-700 pt-1">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold">{summary.make_model}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Chauffeur : <strong>{summary.driver_name}</strong>
                      {summary.driver_phone ? ` (${summary.driver_phone})` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Hub : {summary.hub_city}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">
                  {error}
                </div>
              )}

              {summary.fleet_created_on_gocab_fleet ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h2 className="text-base font-black text-emerald-950">
                    Accident créé sur GoCab Fleet !
                  </h2>
                  <p className="text-xs text-emerald-800">
                    Confirmé par{" "}
                    <strong>{summary.fleet_created_by || summary.fleet_manager_name}</strong>
                    {summary.fleet_created_at
                      ? ` le ${new Date(summary.fleet_created_at).toLocaleString("fr-FR")}`
                      : ""}
                    .
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-700 pt-1">
                    Le statut « Créé sur GoCab Fleet » est désormais visible en direct sur le CRM GoCab.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    Après avoir créé ce sinistre sur la plateforme{" "}
                    <strong>GoCab Fleet</strong>, appuyez sur le bouton ci-dessous pour notifier
                    l&apos;équipe Assurance & Support sur le CRM :
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white font-black text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span>
                      {submitting
                        ? "Validation en cours..."
                        : "✅ Confirmer : Créé sur GoCab Fleet"}
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmFleetAccidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">
          Chargement...
        </div>
      }
    >
      <ConfirmFleetAccidentInner claimId={id} />
    </Suspense>
  );
}
