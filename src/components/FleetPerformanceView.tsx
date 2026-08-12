"use client";

/**
 * FleetPerformanceView — Daily Cash Collection & Payment Management
 *
 * Features:
 * 1. Morning Setup: Enter daily expected collection total per collector.
 * 2. End of Day: Record total collected.
 * 3. Manual Payment Cancellation: Cancel individual driver's payment for the day.
 * 4. Auto-Waiver Queue: Vidange/AdBleu tickets >5h flagged for one-click approval.
 * 5. Date navigation to review past days.
 */

import { useState, useEffect, useCallback } from "react";

interface DailyCollection {
  id: string;
  date: string;
  collector_name: string;
  expected_total: number;
  collected_total: number;
  notes: string | null;
  created_at: string;
}

interface PaymentCancellation {
  id: string;
  date: string;
  driver_name: string;
  driver_phone: string | null;
  plate_number: string | null;
  vehicle_id: string | null;
  reason: string;
  linked_ticket_id: string | null;
  auto_waiver: boolean;
  approved: boolean;
  collection_id: string | null;
  created_at: string;
}

interface AutoWaiverTicket {
  id: string;
  plate_number: string;
  driver_name: string | null;
  driver_phone: string | null;
  ticket_type: string;
  description: string;
  vehicle_id: string;
  created_at: string;
  downtime_hours: number;
}

export default function FleetPerformanceView() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });

  // Collection state
  const [collections, setCollections] = useState<DailyCollection[]>([]);
  const [cancellations, setCancellations] = useState<PaymentCancellation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Auto-waiver tickets
  const [waiverTickets, setWaiverTickets] = useState<AutoWaiverTicket[]>([]);

  // Add collection form
  const [showAddForm, setShowAddForm] = useState(false);
  const [formCollector, setFormCollector] = useState("");
  const [formExpected, setFormExpected] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Update collected modal
  const [editCollection, setEditCollection] = useState<DailyCollection | null>(null);
  const [editCollected, setEditCollected] = useState("");

  // Cancel payment modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelDriver, setCancelDriver] = useState("");
  const [cancelPhone, setCancelPhone] = useState("");
  const [cancelPlate, setCancelPlate] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // Live timer for auto-waiver detection
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTimestamp(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch collections & cancellations for selected date
      const colRes = await fetch(`/api/collections?date=${selectedDate}`);
      const colData = await colRes.json();
      setCollections(colData.collections || []);
      setCancellations(colData.cancellations || []);

      // Fetch open Vidange/AdBleu tickets to check for >5h auto-waiver eligibility
      const tickRes = await fetch(`/api/tickets?status=OPEN`);
      const tickData = await tickRes.json();
      const tickets = tickData.tickets || [];

      const now = Date.now();
      const eligible: AutoWaiverTicket[] = tickets
        .filter((t: any) =>
          (t.ticket_type === "Vidange" || t.ticket_type === "AdBleu") &&
          (t.status === "OPEN" || t.status === "IN_PROGRESS")
        )
        .map((t: any) => {
          const elapsed = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
          return { ...t, downtime_hours: Math.round(elapsed * 10) / 10 };
        })
        .filter((t: AutoWaiverTicket) => t.downtime_hours >= 5);

      setWaiverTickets(eligible);
    } catch (err) {
      console.error("Failed to fetch performance data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, nowTimestamp]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Add daily collection
  const handleAddCollection = async () => {
    if (!formCollector || !formExpected) return;
    try {
      await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          collector_name: formCollector,
          expected_total: Number(formExpected),
          notes: formNotes || null,
        }),
      });
      setShowAddForm(false);
      setFormCollector("");
      setFormExpected("");
      setFormNotes("");
      fetchData();
    } catch (err) {
      console.error("Failed to add collection:", err);
    }
  };

  // Update collected total
  const handleUpdateCollected = async () => {
    if (!editCollection) return;
    try {
      await fetch(`/api/collections/${editCollection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collected_total: Number(editCollected) }),
      });
      setEditCollection(null);
      setEditCollected("");
      fetchData();
    } catch (err) {
      console.error("Failed to update collected:", err);
    }
  };

  // Cancel driver payment
  const handleCancelPayment = async () => {
    if (!cancelDriver || !cancelReason) return;
    try {
      await fetch("/api/cancellations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          driver_name: cancelDriver,
          driver_phone: cancelPhone || null,
          plate_number: cancelPlate || null,
          reason: cancelReason,
          collection_id: collections[0]?.id || null,
        }),
      });
      setShowCancelModal(false);
      setCancelDriver("");
      setCancelPhone("");
      setCancelPlate("");
      setCancelReason("");
      fetchData();
    } catch (err) {
      console.error("Failed to cancel payment:", err);
    }
  };

  // Approve auto-waiver
  const handleApproveWaiver = async (ticket: AutoWaiverTicket) => {
    try {
      // Create a cancellation record
      await fetch("/api/cancellations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          driver_name: ticket.driver_name || "Unknown Driver",
          driver_phone: ticket.driver_phone || null,
          plate_number: ticket.plate_number,
          vehicle_id: ticket.vehicle_id,
          reason: `Auto: ${ticket.ticket_type} >5h downtime (${ticket.downtime_hours}h)`,
          linked_ticket_id: ticket.id,
          auto_waiver: true,
          collection_id: collections[0]?.id || null,
        }),
      });

      // Also mark the ticket as payment waived
      await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_waived: true,
          waived_days: 1,
          waiver_reason: `Auto-waiver: ${ticket.ticket_type} downtime ${ticket.downtime_hours}h`,
        }),
      });

      fetchData();
    } catch (err) {
      console.error("Failed to approve waiver:", err);
    }
  };

  // Delete collection
  const handleDeleteCollection = async (id: string) => {
    try {
      await fetch(`/api/collections/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Failed to delete collection:", err);
    }
  };

  // Totals
  const totalExpected = collections.reduce((s, c) => s + c.expected_total, 0);
  const totalCollected = collections.reduce((s, c) => s + c.collected_total, 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  const totalCancellations = cancellations.filter((c) => c.approved).length;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a2e" }}>
            📊 Fleet Performance — Daily Collections
          </h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Track daily cash collection targets, record actual receipts, and manage payment cancellations.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
          />
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: "8px 16px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14,
            }}
          >
            + Morning Target
          </button>
          <button
            onClick={() => setShowCancelModal(true)}
            style={{
              padding: "8px 16px", background: "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14,
            }}
          >
            ✕ Cancel Payment
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)", padding: 18, borderRadius: 12, border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Expected Today</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1e40af", marginTop: 4 }}>{totalExpected.toLocaleString()} MAD</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", padding: 18, borderRadius: 12, border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Collected</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#15803d", marginTop: 4 }}>{totalCollected.toLocaleString()} MAD</div>
        </div>
        <div style={{ background: collectionRate >= 90 ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : collectionRate >= 50 ? "linear-gradient(135deg, #fffbeb, #fef3c7)" : "linear-gradient(135deg, #fef2f2, #fecaca)", padding: 18, borderRadius: 12, border: `1px solid ${collectionRate >= 90 ? "#bbf7d0" : collectionRate >= 50 ? "#fde68a" : "#fca5a5"}` }}>
          <div style={{ fontSize: 12, color: collectionRate >= 90 ? "#16a34a" : collectionRate >= 50 ? "#d97706" : "#dc2626", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Collection Rate</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: collectionRate >= 90 ? "#15803d" : collectionRate >= 50 ? "#b45309" : "#b91c1c", marginTop: 4 }}>{collectionRate}%</div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #fef2f2, #fecaca)", padding: 18, borderRadius: 12, border: "1px solid #fca5a5" }}>
          <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Cancelled Payments</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>{totalCancellations}</div>
        </div>
      </div>

      {/* Auto-Waiver Queue */}
      {waiverTickets.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "2px solid #f59e0b",
          borderRadius: 12, padding: 18, marginBottom: 24,
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#92400e" }}>
            ⚠️ Auto-Waiver Queue — Vidange/AdBleu Tickets &gt; 5 Hours
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {waiverTickets.map((t) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #fde68a",
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{t.plate_number}</span>
                  <span style={{ margin: "0 8px", color: "#6b7280" }}>•</span>
                  <span style={{ color: "#6b7280" }}>{t.driver_name || "Unknown Driver"}</span>
                  <span style={{ margin: "0 8px", color: "#6b7280" }}>•</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                    background: t.ticket_type === "Vidange" ? "#dbeafe" : "#e0e7ff",
                    color: t.ticket_type === "Vidange" ? "#2563eb" : "#4f46e5",
                  }}>{t.ticket_type}</span>
                  <span style={{ margin: "0 8px", color: "#6b7280" }}>•</span>
                  <span style={{ fontWeight: 700, color: "#dc2626" }}>⏱ {t.downtime_hours}h downtime</span>
                </div>
                <button
                  onClick={() => handleApproveWaiver(t)}
                  style={{
                    padding: "6px 14px", background: "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13,
                  }}
                >
                  ✅ Approve Auto-Waiver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collections Table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>📋 Daily Collection Entries</h3>
        </div>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading...</div>
        ) : collections.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
            No collection entries for this date. Click <strong>+ Morning Target</strong> to add one.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Collector</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Expected (MAD)</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Collected (MAD)</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Rate</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Notes</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => {
                const rate = c.expected_total > 0 ? Math.round((c.collected_total / c.expected_total) * 100) : 0;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: "#1a1a2e" }}>{c.collector_name}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: "#2563eb" }}>{c.expected_total.toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 600, color: c.collected_total > 0 ? "#16a34a" : "#9ca3af" }}>{c.collected_total.toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span style={{
                        padding: "2px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                        background: rate >= 90 ? "#dcfce7" : rate >= 50 ? "#fef3c7" : "#fecaca",
                        color: rate >= 90 ? "#15803d" : rate >= 50 ? "#b45309" : "#b91c1c",
                      }}>{rate}%</span>
                    </td>
                    <td style={{ padding: "12px 14px", color: "#6b7280", fontSize: 13 }}>{c.notes || "—"}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <button
                        onClick={() => { setEditCollection(c); setEditCollected(String(c.collected_total)); }}
                        style={{ padding: "4px 10px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, marginRight: 6 }}
                      >
                        💰 Update Collected
                      </button>
                      <button
                        onClick={() => handleDeleteCollection(c.id)}
                        style={{ padding: "4px 10px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Cancellations Table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", background: "#fef2f2" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#991b1b" }}>🚫 Payment Cancellations — {selectedDate}</h3>
        </div>
        {cancellations.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>No payment cancellations for this date.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Driver</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Phone</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Vehicle</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Reason</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Type</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cancellations.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#1a1a2e" }}>{c.driver_name}</td>
                  <td style={{ padding: "12px 14px", color: "#6b7280", fontSize: 13 }}>{c.driver_phone || "—"}</td>
                  <td style={{ padding: "12px 14px", color: "#6b7280", fontSize: 13 }}>{c.plate_number || "—"}</td>
                  <td style={{ padding: "12px 14px", color: "#374151", fontSize: 13 }}>{c.reason}</td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: c.auto_waiver ? "#fef3c7" : "#e0e7ff",
                      color: c.auto_waiver ? "#92400e" : "#4338ca",
                    }}>{c.auto_waiver ? "⚡ Auto-Waiver" : "✋ Manual"}</span>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: c.approved ? "#dcfce7" : "#fef3c7",
                      color: c.approved ? "#15803d" : "#92400e",
                    }}>{c.approved ? "✅ Approved" : "⏳ Pending"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* === MODALS === */}

      {/* Add Morning Target Modal */}
      {showAddForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>🌅 Morning Collection Target</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Collector Name *</label>
                <input value={formCollector} onChange={(e) => setFormCollector(e.target.value)} placeholder="Fleet Performance Agent name"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Expected Total (MAD) *</label>
                <input type="number" value={formExpected} onChange={(e) => setFormExpected(e.target.value)} placeholder="e.g. 12500"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Notes (optional)</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Any notes for today..."
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddForm(false)} style={{ padding: "8px 18px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAddCollection} style={{ padding: "8px 18px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Save Target</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Collected Modal */}
      {editCollection && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 380, maxWidth: "90vw", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>💰 Update Collected Amount</h3>
            <p style={{ margin: "0 0 14px", color: "#6b7280", fontSize: 14 }}>
              Collector: <strong>{editCollection.collector_name}</strong><br />
              Expected: <strong>{editCollection.expected_total.toLocaleString()} MAD</strong>
            </p>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Total Collected (MAD)</label>
              <input type="number" value={editCollected} onChange={(e) => setEditCollected(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => { setEditCollection(null); setEditCollected(""); }} style={{ padding: "8px 18px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleUpdateCollected} style={{ padding: "8px 18px", background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Payment Modal */}
      {showCancelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 700, color: "#dc2626" }}>🚫 Cancel Driver Payment</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Driver Name *</label>
                <input value={cancelDriver} onChange={(e) => setCancelDriver(e.target.value)} placeholder="Driver full name"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Phone</label>
                <input value={cancelPhone} onChange={(e) => setCancelPhone(e.target.value)} placeholder="+212..."
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Vehicle Plate</label>
                <input value={cancelPlate} onChange={(e) => setCancelPlate(e.target.value)} placeholder="e.g. 12345-A-6"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 4 }}>Reason *</label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="Reason for cancelling today's payment..."
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCancelModal(false)} style={{ padding: "8px 18px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Close</button>
              <button onClick={handleCancelPayment} style={{ padding: "8px 18px", background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>Cancel Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
