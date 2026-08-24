"use client";

/**
 * OpsTargetAlertsBanner Component
 * 
 * Displays real-time automated KPI variance alerts for the Operations Manager & Admin.
 * Highlights SLA breaches, GPS telematics disconnects, inspection delays, and fleet downtime.
 * Provides instant access to generate the full Executive Weekly Report.
 */

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import WeeklyReportModal from "./WeeklyReportModal";

export default function OpsTargetAlertsBanner() {
  const { t } = useLanguage();
  const [reportData, setReportData] = useState<any | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch("/api/reports/weekly");
        const data = await res.json();
        setReportData(data);
      } catch (err) {
        console.error("Failed to fetch weekly alerts:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchReport();
  }, []);

  if (isLoading || !reportData) return null;

  const alerts = reportData.alerts || [];
  const criticalCount = alerts.filter((a: any) => a.severity === "CRITICAL").length;

  return (
    <>
      <div className="bg-gradient-to-r from-[#1e3a5f] to-navy text-white rounded-2xl p-4 shadow-sm border border-navy/20 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0 mt-0.5">
            {alerts.length > 0 ? "🚨" : "📊"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {t.opsPerformanceKpiHealth}
              </h3>
              {alerts.length > 0 ? (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  criticalCount > 0 ? "bg-red-500 text-white" : "bg-amber-400 text-navy"
                }`}>
                  {alerts.length} {t.alertsActive}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400 text-navy">
                  ✓ {t.targetAchieved}
                </span>
              )}
            </div>

            {/* Sub-text preview of top alert */}
            <p className="text-xs text-white/70 mt-1 max-w-2xl leading-relaxed">
              {alerts.length > 0
                ? `${alerts[0].metric}: ${alerts[0].actual}${alerts[0].unit} vs ${alerts[0].target}${alerts[0].unit} (${alerts[0].variance}${alerts[0].unit}). ${alerts.length > 1 ? `+${alerts.length - 1}...` : ""}`
                : t.targetAchieved}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2 bg-[#f5c842] hover:bg-[#f5c842]/90 active:scale-95 text-navy font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>📑</span> {t.weeklyExecutiveReport}
          </button>
        </div>
      </div>

      {/* Weekly Report Modal */}
      {isReportModalOpen && (
        <WeeklyReportModal
          report={reportData}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
    </>
  );
}
