"use client";

import React from "react";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { NationalBlacklistMatchResult } from "@/lib/services/nationalBlacklistMatcher";

interface NationalBlacklistBadgeProps {
  match?: NationalBlacklistMatchResult | null;
  size?: "xs" | "sm" | "md";
  className?: string;
  showDetails?: boolean;
}

/**
 * High-visibility badge indicating that a person is flagged on the
 * National / Regional Car Rental Blacklist (Liste Noire Région Casa-Settat).
 */
export default function NationalBlacklistBadge({
  match,
  size = "xs",
  className = "",
  showDetails = false,
}: NationalBlacklistBadgeProps) {
  if (!match || !match.isBlacklisted) return null;

  const scorePct = Math.round((match.score || 1) * 100);
  const sizeClasses =
    size === "xs"
      ? "text-[9px] px-1.5 py-0.5 gap-1 font-black"
      : size === "sm"
      ? "text-[10px] px-2 py-0.5 gap-1.5 font-black"
      : "text-xs px-2.5 py-1 gap-1.5 font-black";

  const iconSize =
    size === "xs" ? "w-2.5 h-2.5" : size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  const tooltipText = match.warningDetailText ||
    `🚨 LISTE NOIRE NATIONALE : ${match.matchedEntry?.fullName} · ${match.matchedEntry?.reason || "Signalé"} (${scorePct}%)`;

  return (
    <span
      className={`inline-flex items-center uppercase tracking-wider rounded-md bg-gradient-to-r from-red-700 via-rose-700 to-red-800 text-white shadow-xs border border-red-900 select-none shrink-0 transition-transform hover:scale-105 cursor-help animate-pulse ${sizeClasses} ${className}`}
      title={tooltipText}
    >
      <ShieldAlert className={`${iconSize} fill-white text-red-700 shrink-0`} />
      <span className="tracking-wide">LISTE NOIRE</span>
      {scorePct < 100 && <span className="opacity-80 text-[8px]">({scorePct}%)</span>}
      {showDetails && match.matchedEntry?.reason && (
        <span className="hidden sm:inline normal-case font-medium opacity-90 truncate max-w-[140px]">
          · {match.matchedEntry.reason}
        </span>
      )}
    </span>
  );
}
