"use client";

/**
 * WeeklyReportModal Component — Executive KPI Briefing & Report Generator
 * 
 * Generates an executive briefing covering all 3 pillars, highlights KPI variances,
 * and allows 1-click formatted copy for the leadership WhatsApp group.
 */

import React, { useState } from "react";
import toast from "react-hot-toast";

interface WeeklyReportData {
  reportDate: string;
  summary: any;
  pillar1: any;
  pillar2: any;
  pillar3: any;
  targets: any;
  alerts: any[];
}

interface WeeklyReportModalProps {
  report: WeeklyReportData;
  onClose: () => void;
}

export default function WeeklyReportModal({ report, onClose }: WeeklyReportModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "pillar1" | "pillar2" | "pillar3" | "alerts">("overview");

  const formattedDate = new Date(report.reportDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // Generate WhatsApp-formatted briefing
  function generateWhatsAppSummary() {
    const s = report.summary;
    const criticalAlerts = report.alerts.filter((a: any) => a.severity === "CRITICAL").length;
    
    return `🚕 *GOCAB OPERATIONS — WEEKLY KPI DIGEST*
📅 *Week of ${formattedDate}*
📍 *Hub: Casablanca*

━━━━━━━━━━━━━━━━━━━━
*📊 EXECUTIVE OVERVIEW*
• Active Fleet Rate: *${s.activeFleetRate}%* (${s.activeVehicles}/${s.totalFleet} cars)
• 24h SLA Compliance: *${s.slaResolutionRate}%* (Target: 95%)
• Monthly Inspection Rate: *${s.inspectionRate}%* (Target: 90%)
• GPS Connected: *${s.gpsConnectivityRate}%* (Target: 100%)
• Active Alerts: *${report.alerts.length}* (${criticalAlerts} Critical)

━━━━━━━━━━━━━━━━━━━━
*1️⃣ PILLAR 1: LEAD ACQUISITION & ONBOARDING*
• New Leads (Last 7d): *${report.pillar1.newLeadsThisWeek}*
• Total Leads in Pipeline: *${report.pillar1.totalLeads}*
• KYC Verified Candidates: *${report.pillar1.kycCompletedLeads}*
• Vehicles Assigned: *${report.pillar1.assignedVehicles}* (Conversion: ${report.pillar1.leadConversionRate}%)

━━━━━━━━━━━━━━━━━━━━
*2️⃣ PILLAR 2: DRIVER ENGAGEMENT & FLEET PERF*
• Active Fleet: *${report.pillar2.activeVehicles}* / ${report.pillar2.totalFleet} vehicles
• Total Downtime Days: *${report.pillar2.totalDowntimeDays}* (Avg ${report.pillar2.avgDowntimePerVehicle}d/car)
• Payment Waivers: *${report.pillar2.waivedTicketsCount}* (${report.pillar2.totalWaivedDays} days waived)
• Churn (Terminated Contracts): *${report.pillar2.recentChurnCount}* this week

━━━━━━━━━━━━━━━━━━━━
*3️⃣ PILLAR 3: SAFETY, FLEET & COMPLIANCE*
• 24h Ticket SLA Resolution: *${report.pillar3.slaResolutionRate}%*
• Open Support Tickets: *${report.pillar3.openTickets}* (${report.pillar3.slaBreachedTickets} breached)
• Physical Inspections Completed: *${report.pillar3.inspectedVehiclesCount}* / ${s.totalFleet}
• GPS Connected Vehicles: *${report.pillar3.gpsConnectedCount}* / ${s.totalFleet}
• Active Accident Claims: *${report.pillar3.openAccidentClaims}*
• Asset Recovery Rate: *${report.pillar3.recoveryRate}%*

━━━━━━━━━━━━━━━━━━━━
${report.alerts.length > 0 ? `*🚨 TOP ACTIONABLE ALERTS:*\n` + report.alerts.slice(0, 3).map((a: any) => `• ${a.severity === "CRITICAL" ? "🔴" : "🟡"} *${a.metric}*: ${a.message}`).join("\n") : `✅ *All operational metrics are within target bounds!*`}

_Generated via GoCab Operations Platform_`;
  }

  function handleCopyWhatsApp() {
    const text = generateWhatsAppSummary();
    navigator.clipboard.writeText(text);
    toast.success("Executive Digest copied to clipboard! Ready to paste into WhatsApp.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy via-navy/95 to-[#1a3352] text-white p-6 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl">
              📊
            </div>
            <div>
              <h2 className="text-lg font-bold">Weekly Executive Operations Report</h2>
              <p className="text-xs text-white/70">Week of {formattedDate} · Casablanca Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className="px-3.5 py-2 bg-[#f5c842] hover:bg-[#f5c842]/90 text-navy font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>💬</span> Copy WhatsApp Digest
            </button>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-lg p-1.5 rounded-lg hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Sub-header */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "overview" ? "bg-navy text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            📋 Overview
          </button>
          <button
            onClick={() => setActiveTab("pillar1")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "pillar1" ? "bg-navy text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            1️⃣ Lead Acquisition
          </button>
          <button
            onClick={() => setActiveTab("pillar2")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "pillar2" ? "bg-navy text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            2️⃣ Driver & Fleet Perf
          </button>
          <button
            onClick={() => setActiveTab("pillar3")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "pillar3" ? "bg-navy text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            3️⃣ Safety & Compliance
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === "alerts"
                ? "bg-red-600 text-white shadow-sm"
                : "text-red-600 hover:bg-red-50"
            }`}
          >
            <span>🚨 Alerts</span>
            <span className="px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full text-[10px]">
              {report.alerts.length}
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Top 4 KPI metric cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <p className="text-[11px] font-semibold text-blue-700">Active Fleet Utilization</p>
                  <p className="text-2xl font-black text-blue-950 mt-1">{report.summary.activeFleetRate}%</p>
                  <p className="text-[10px] text-blue-600 mt-1">{report.summary.activeVehicles} of {report.summary.totalFleet} cars actif</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <p className="text-[11px] font-semibold text-emerald-700">24h SLA Compliance</p>
                  <p className="text-2xl font-black text-emerald-950 mt-1">{report.summary.slaResolutionRate}%</p>
                  <p className="text-[10px] text-emerald-600 mt-1">Target: 95% resolution</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                  <p className="text-[11px] font-semibold text-purple-700">Monthly Physical Inspections</p>
                  <p className="text-2xl font-black text-purple-950 mt-1">{report.summary.inspectionRate}%</p>
                  <p className="text-[10px] text-purple-600 mt-1">Target: 90% fleet checkup</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[11px] font-semibold text-amber-700">GPS Telematics</p>
                  <p className="text-2xl font-black text-amber-950 mt-1">{report.summary.gpsConnectivityRate}%</p>
                  <p className="text-[10px] text-amber-600 mt-1">Target: 100% connected</p>
                </div>
              </div>

              {/* Alert Summary Box */}
              {report.alerts.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚨</span>
                    <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider">
                      {report.alerts.length} Escalation Alerts Requiring Action
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {report.alerts.map((a: any) => (
                      <div key={a.id} className="bg-white border border-red-200 rounded-xl p-3 text-xs flex items-start gap-2">
                        <span className="mt-0.5">{a.severity === "CRITICAL" ? "🔴" : "🟡"}</span>
                        <div>
                          <p className="font-bold text-red-900">{a.metric} — {a.actual}{a.unit} (Target: {a.target}{a.unit})</p>
                          <p className="text-gray-600 text-[11px] mt-0.5">{a.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <h3 className="text-xs font-bold text-green-900">All Operations On Track</h3>
                    <p className="text-xs text-green-700 mt-0.5">All 3 operational pillars are performing within target thresholds.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PILLAR 1 TAB */}
          {activeTab === "pillar1" && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-gray-900">Pillar 1: Lead Acquisition & KYC Verification</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">New Leads (Last 7d)</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.pillar1.newLeadsThisWeek}</p>
                </div>
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">Full KYC Verified (4/4)</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.pillar1.kycCompletedLeads}</p>
                </div>
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">Vehicles Assigned</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.pillar1.assignedVehicles}</p>
                </div>
              </div>
            </div>
          )}

          {/* PILLAR 2 TAB */}
          {activeTab === "pillar2" && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-gray-900">Pillar 2: Driver Engagement & Fleet Performance</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">Total Fleet Downtime</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.pillar2.totalDowntimeDays} <span className="text-xs font-normal">days</span></p>
                  <p className="text-[10px] text-gray-400">Avg {report.pillar2.avgDowntimePerVehicle}d per vehicle</p>
                </div>
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">Payment Waivers</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.pillar2.waivedTicketsCount} <span className="text-xs font-normal">tickets</span></p>
                  <p className="text-[10px] text-gray-400">{report.pillar2.totalWaivedDays} total days waived</p>
                </div>
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">Terminated Contracts (Churn)</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{report.pillar2.recentChurnCount}</p>
                  <p className="text-[10px] text-gray-400">Unlinked this week</p>
                </div>
              </div>
            </div>
          )}

          {/* PILLAR 3 TAB */}
          {activeTab === "pillar3" && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-gray-900">Pillar 3: Safety, Fleet & Compliance</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">Support Tickets</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.pillar3.resolvedTickets} / {report.pillar3.totalTickets}</p>
                  <p className="text-[10px] text-gray-400">{report.pillar3.openTickets} open ({report.pillar3.slaBreachedTickets} breached)</p>
                </div>
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">Inspections Completed</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{report.pillar3.inspectedVehiclesCount}</p>
                  <p className="text-[10px] text-gray-400">{report.pillar3.inspectionRate}% completion</p>
                </div>
                <div className="bg-gray-50 border rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-semibold">Open Accident Claims</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{report.pillar3.openAccidentClaims}</p>
                  <p className="text-[10px] text-gray-400">In garage / insurance</p>
                </div>
              </div>
            </div>
          )}

          {/* ALERTS TAB */}
          {activeTab === "alerts" && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-gray-900">Target vs Actual Operational Variances</h3>
              {report.alerts.length === 0 ? (
                <p className="text-xs text-green-700 bg-green-50 p-4 rounded-2xl border border-green-200">
                  ✅ No active alerts. All operations meet performance targets.
                </p>
              ) : (
                <div className="space-y-3">
                  {report.alerts.map((a: any) => (
                    <div key={a.id} className="border border-gray-200 rounded-2xl p-4 space-y-2 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{a.severity === "CRITICAL" ? "🔴" : "🟡"}</span>
                          <h4 className="font-bold text-xs text-gray-900">{a.metric}</h4>
                          <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                            {a.pillar}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-red-600">
                          {a.variance}{a.unit} variance
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{a.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-gray-400">
            GoCab Operations Report Engine · Confidential
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-xl"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
