"use client";

import { Flag } from "lucide-react";

interface RedFlagBadgeProps {
  reason?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
  showText?: boolean;
  pulsing?: boolean;
}

/**
 * Universal RedFlagBadge
 * Signals clearly anywhere in GoCab CRM that a driver has an active Red Flag.
 */
export default function RedFlagBadge({
  reason,
  size = "xs",
  className = "",
  showText = true,
  pulsing = true,
}: RedFlagBadgeProps) {
  const sizeClasses =
    size === "xs"
      ? "text-[9px] px-1.5 py-0.5 gap-1 font-black"
      : size === "sm"
      ? "text-[10px] px-2 py-0.5 gap-1 font-black"
      : "text-xs px-2.5 py-1 gap-1.5 font-black";

  const iconSize =
    size === "xs" ? "w-2.5 h-2.5" : size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  const tooltipText = reason
    ? `🚩 CHAUFFEUR RED FLAG : ${reason}`
    : "🚩 CHAUFFEUR RED FLAG (Signalé pour arriérés ou risque)";

  return (
    <span
      className={`inline-flex items-center uppercase tracking-wider rounded-md bg-red-600 text-white shadow-2xs border border-red-700 select-none shrink-0 transition-transform hover:scale-105 cursor-help ${
        pulsing ? "animate-pulse" : ""
      } ${sizeClasses} ${className}`}
      title={tooltipText}
    >
      <Flag className={`${iconSize} fill-white text-white shrink-0`} />
      {showText && <span className="tracking-wide">RED FLAG</span>}
    </span>
  );
}
