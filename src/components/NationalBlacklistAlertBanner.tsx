"use client";

import React from "react";
import { ShieldAlert, AlertOctagon, AlertTriangle, FileWarning, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { NationalBlacklistMatchResult } from "@/lib/services/nationalBlacklistMatcher";

interface NationalBlacklistAlertBannerProps {
  match?: NationalBlacklistMatchResult | null;
  className?: string;
  candidateName?: string;
}

/**
 * Prominent warning banner displayed in LeadDrawer, DriverDrawer, VehicleDrawer,
 * and AddLeadModal whenever a candidate or driver matches the National Blacklist.
 */
export default function NationalBlacklistAlertBanner({
  match,
  className = "",
  candidateName,
}: NationalBlacklistAlertBannerProps) {
  if (!match || !match.isBlacklisted || !match.matchedEntry) return null;

  const entry = match.matchedEntry;
  const scorePct = Math.round((match.score || 1) * 100);

  const confidenceBadge =
    match.matchType === "EXACT" ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-950 text-red-200 border border-red-800">
        <CheckCircle2 className="w-3 h-3 text-red-400" />
        Correspondance exacte (100%)
      </span>
    ) : match.matchType === "HIGH" ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-200 border border-rose-800">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        Forte probabilité ({scorePct}%)
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-200 border border-amber-800">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        Similitude phonétique ({scorePct}%)
      </span>
    );

  const isDétournement =
    (entry.reason || "").toUpperCase().includes("DETOURNEM") ||
    (entry.reason || "").toUpperCase().includes("DÉTOURNEM");

  return (
    <div
      className={`rounded-xl border-2 border-red-600 bg-gradient-to-br from-red-900/90 via-red-950 to-neutral-950 text-white p-4 shadow-xl shadow-red-950/40 relative overflow-hidden ${className}`}
    >
      {/* Background Warning Icon Glow */}
      <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
        <ShieldAlert className="w-44 h-44 text-red-400" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-red-600 text-white shadow-md animate-pulse shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black tracking-wide uppercase text-red-100">
                🚨 LISTE NOIRE NATIONALE / RÉGION CASA-SETTAT
              </h4>
              {confidenceBadge}
            </div>
            <p className="text-xs text-red-200/90 font-medium mt-0.5">
              {candidateName ? (
                <>
                  Le candidat <strong className="text-white underline">{candidateName}</strong> est identifié sur le registre des loueurs de véhicules.
                </>
              ) : (
                "Individu répertorié sur le registre officiel des incidents de location."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Information Cards Grid */}
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 relative z-10 text-xs">
        {/* Nom Fiché */}
        <div className="bg-red-950/70 border border-red-800/80 rounded-lg p-2.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-300 flex items-center gap-1">
            <FileWarning className="w-3 h-3 text-red-400" /> Nom Fiché
          </span>
          <span className="font-black text-white text-sm mt-1 truncate" title={entry.fullName}>
            {entry.fullName}
          </span>
        </div>

        {/* Motif d'infraction */}
        <div className="bg-red-950/70 border border-red-800/80 rounded-lg p-2.5 flex flex-col justify-between sm:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> Motif & Infraction Constatée
          </span>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span
              className={`font-black tracking-wide text-xs px-2 py-0.5 rounded ${
                isDétournement
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-red-800/90 text-red-100"
              }`}
            >
              {entry.reason || "Signalé sur liste noire"}
            </span>
            {entry.city && (
              <span className="text-[11px] text-red-200/90 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-red-400" /> {entry.city}
              </span>
            )}
            {entry.date && entry.date !== "Non daté" && (
              <span className="text-[11px] text-red-300/80 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-red-400" /> Réf: {entry.date}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Guardrail Disclaimer */}
      <div className="mt-3 pt-2.5 border-t border-red-800/60 flex items-start gap-2 text-[11px] text-red-200/90 relative z-10">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong>Consigne de sécurité GoCab :</strong> Risque avéré d'impayés, détournement ou falsification de documents. Ne valider aucune remise de clés ni affectation de véhicule sans accord écrit préalable de la Direction des Opérations.
        </span>
      </div>
    </div>
  );
}
