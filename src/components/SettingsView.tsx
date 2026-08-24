"use client";

/**
 * SettingsView Component — Operations Manager Configuration Hub
 * 
 * Sections:
 * 1. 🎯 Department Targets: Configure weekly target KPIs across all operational departments.
 * 2. 🛡️ Role & Tab Permissions: Manage role mappings and tab visibility.
 * 3. 👥 Team Member Accounts: Provision new accounts, assign roles, or delete users.
 * 4. 💬 WhatsApp Templates: Customize messaging for candidate training invites.
 */

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

type TabType = "dashboard" | "leads" | "training" | "fleet" | "tickets" | "performance" | "field" | "insurance" | "settings";

const ALL_TABS: { id: TabType; label: string; icon: string; description: string }[] = [
  { id: "dashboard", label: "Home", icon: "📊", description: "KPI overview & command metrics" },
  { id: "leads", label: "Leads", icon: "💼", description: "Lead acquisition Kanban & intake" },
  { id: "training", label: "Training", icon: "🎓", description: "Driver training pipeline & KYC checks" },
  { id: "fleet", label: "Fleet", icon: "🚗", description: "Vehicle fleet inventory & assignments" },
  { id: "tickets", label: "Support", icon: "🔧", description: "Maintenance & 24h SLA tickets" },
  { id: "performance", label: "Perf", icon: "📈", description: "Fleet performance, collections & waivers" },
  { id: "field", label: "Field", icon: "🛡️", description: "Field supervisor inspections & recoveries" },
  { id: "insurance", label: "Insurance", icon: "📝", description: "Accident claims & insurance tracking" },
  { id: "settings", label: "Settings", icon: "⚙️", description: "Role permissions & system settings" },
];

const DEFAULT_ROLE_PERMISSIONS: Record<string, TabType[]> = {
  LEAD_ACQUISITION_JR: ["dashboard", "leads", "training"],
  FLEET_PERF_MANAGER: ["dashboard", "fleet", "tickets", "performance"],
  FIELD_SUPERVISOR: ["dashboard", "fleet", "field", "tickets"],
  FINANCE_OFFICER: ["dashboard", "performance", "insurance"],
  OPS_MANAGER: ["dashboard", "leads", "training", "fleet", "tickets", "performance", "field", "insurance", "settings"],
  ADMIN: ["dashboard", "leads", "training", "fleet", "tickets", "performance", "field", "insurance", "settings"],
};

const DEFAULT_ROLE_LABELS: Record<string, string> = {
  LEAD_ACQUISITION_JR: "Lead Acquisition Jr",
  FLEET_PERF_MANAGER: "Fleet Performance Manager",
  FIELD_SUPERVISOR: "Field Supervisor",
  FINANCE_OFFICER: "Finance Officer",
  OPS_MANAGER: "Operations Manager",
  ADMIN: "Administrator",
};

interface DepartmentTargets {
  target_weekly_leads: number;
  target_training_showup_rate: number;
  target_kyc_completion_rate: number;
  target_lead_conversion_rate: number;
  target_active_fleet_rate: number;
  target_max_downtime_days: number;
  target_weekly_churn_limit: number;
  target_max_waived_days: number;
  target_monthly_inspection_rate: number;
  target_gps_connectivity_rate: number;
  target_asset_recovery_rate: number;
  target_sla_resolution_rate: number;
  target_max_open_tickets: number;
  target_collection_rate: number;
  target_weekly_revenue_mad: number;
}

const DEFAULT_TARGETS: DepartmentTargets = {
  target_weekly_leads: 100,
  target_training_showup_rate: 80,
  target_kyc_completion_rate: 25,
  target_lead_conversion_rate: 20,
  target_active_fleet_rate: 85,
  target_max_downtime_days: 7,
  target_weekly_churn_limit: 2,
  target_max_waived_days: 10,
  target_monthly_inspection_rate: 90,
  target_gps_connectivity_rate: 100,
  target_asset_recovery_rate: 100,
  target_sla_resolution_rate: 95,
  target_max_open_tickets: 5,
  target_collection_rate: 90,
  target_weekly_revenue_mad: 50000,
};

interface UserRecord {
  id: string;
  email: string;
  name: string;
  fullName: string;
  role: string;
  region: string;
  isActive: boolean;
}

export default function SettingsView() {
  const [activeSection, setActiveSection] = useState<"targets" | "roles" | "users" | "whatsapp">("targets");
  const [targets, setTargets] = useState<DepartmentTargets>(DEFAULT_TARGETS);
  const [permissions, setPermissions] = useState<Record<string, TabType[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>(DEFAULT_ROLE_LABELS);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [template, setTemplate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal: Create New Role
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleTabs, setNewRoleTabs] = useState<TabType[]>(["dashboard"]);

  // Modal: Create New User
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("GoCab2024!");
  const [newUserRole, setNewUserRole] = useState("LEAD_ACQUISITION_JR");

  // Load all settings and users on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [settingsRes, usersRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/users"),
        ]);
        const settingsData = await settingsRes.json();
        const usersData = await usersRes.json();

        if (settingsData.settings) {
          if (settingsData.settings.department_weekly_targets) {
            try {
              const parsed = JSON.parse(settingsData.settings.department_weekly_targets);
              setTargets({ ...DEFAULT_TARGETS, ...parsed });
            } catch (e) {}
          }
          if (settingsData.settings.whatsapp_invite_template) {
            setTemplate(settingsData.settings.whatsapp_invite_template);
          }
          if (settingsData.settings.role_tab_permissions) {
            try {
              const parsed = JSON.parse(settingsData.settings.role_tab_permissions);
              setPermissions(parsed);
            } catch (e) {}
          }
          if (settingsData.settings.custom_role_labels) {
            try {
              const parsedLabels = JSON.parse(settingsData.settings.custom_role_labels);
              setRoleLabels((prev) => ({ ...prev, ...parsedLabels }));
            } catch (e) {}
          }
        }

        if (usersData.users) {
          setUsers(usersData.users);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        toast.error("Failed to load settings data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Save Department Targets
  async function handleSaveTargets(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "department_weekly_targets",
          value: JSON.stringify(targets),
        }),
      });

      if (res.ok) {
        toast.success("🎯 Weekly Department Targets saved! KPIs & Alerts updated.");
      } else {
        toast.error("Failed to save targets.");
      }
    } catch (err) {
      toast.error("Network error while saving targets");
    } finally {
      setIsSaving(false);
    }
  }

  // Toggle tab access for a role
  function handleToggleTab(role: string, tab: TabType) {
    setPermissions((prev) => {
      const currentTabs = prev[role] || [];
      const updated = currentTabs.includes(tab)
        ? currentTabs.filter((t) => t !== tab)
        : [...currentTabs, tab];
      return { ...prev, [role]: updated };
    });
  }

  // Save Role Tab Permissions
  async function handleSavePermissions() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "role_tab_permissions",
          value: JSON.stringify(permissions),
        }),
      });

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "custom_role_labels",
          value: JSON.stringify(roleLabels),
        }),
      });

      if (res.ok) {
        toast.success("Role & Tab permissions saved successfully!");
      } else {
        toast.error("Failed to save permissions.");
      }
    } catch (err) {
      toast.error("Network error while saving permissions");
    } finally {
      setIsSaving(false);
    }
  }

  // Create New Role
  function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = newRoleKey.trim().toUpperCase().replace(/\s+/g, "_");
    if (!cleanKey || !newRoleLabel.trim()) {
      toast.error("Please enter a valid role name and label");
      return;
    }

    if (permissions[cleanKey]) {
      toast.error("A role with this key already exists");
      return;
    }

    setPermissions((prev) => ({ ...prev, [cleanKey]: newRoleTabs }));
    setRoleLabels((prev) => ({ ...prev, [cleanKey]: newRoleLabel.trim() }));
    setIsNewRoleModalOpen(false);
    setNewRoleKey("");
    setNewRoleLabel("");
    setNewRoleTabs(["dashboard"]);
    toast.success(`Role "${newRoleLabel}" created! Click "Save All Permissions" to persist.`);
  }

  // Delete a custom role
  function handleDeleteRole(role: string) {
    const isDefault = Object.keys(DEFAULT_ROLE_PERMISSIONS).includes(role);
    if (isDefault) {
      toast.error("Cannot delete a core system role");
      return;
    }
    if (!confirm(`Are you sure you want to delete role "${roleLabels[role] || role}"?`)) return;

    setPermissions((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
    setRoleLabels((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
    toast.success(`Role deleted. Click "Save All Permissions" to apply.`);
  }

  // Delete user account
  async function handleDeleteUser(userId: string, email: string) {
    if (email === "mouad.koudia@gocab.io") {
      toast.error("Cannot delete the primary Operations Manager account");
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete user "${email}"?`)) return;

    try {
      const res = await fetch(`/api/users?id=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`User ${email} deleted.`);
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch (err) {
      toast.error("Network error deleting user");
    }
  }

  // Save WhatsApp template
  async function handleSaveTemplate() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "whatsapp_invite_template",
          value: template,
        }),
      });

      if (res.ok) {
        toast.success("WhatsApp template saved!");
      } else {
        toast.error("Failed to save template.");
      }
    } catch (err) {
      toast.error("Error saving template");
    } finally {
      setIsSaving(false);
    }
  }

  // Change User Role
  async function handleUserRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole }),
      });

      if (res.ok) {
        toast.success("User role updated successfully!");
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      } else {
        toast.error("Failed to update user role");
      }
    } catch (err) {
      toast.error("Network error updating user role");
    }
  }

  // Create New User
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Team member ${data.user.name} created!`);
        setUsers((prev) => [...prev, data.user]);
        setIsNewUserModalOpen(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("GoCab2024!");
      } else {
        toast.error(data.error || "Failed to create user");
      }
    } catch (err) {
      toast.error("Failed to create user account");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-5xl mx-auto mt-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading Operations Hub…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy via-navy/95 to-[#1a3352] text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <h2 className="text-xl font-bold tracking-tight">Operations Manager Control Center</h2>
          </div>
          <p className="text-white/70 text-xs mt-1">
            Set weekly department targets, manage role permissions, control team access, and customize messaging templates.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center bg-white/10 p-1 rounded-2xl backdrop-blur-md border border-white/10 shrink-0 flex-wrap gap-1">
          <button
            onClick={() => setActiveSection("targets")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === "targets"
                ? "bg-[#f5c842] text-navy shadow-sm font-bold"
                : "text-white/80 hover:text-white hover:bg-white/5"
            }`}
          >
            🎯 Weekly Targets
          </button>
          <button
            onClick={() => setActiveSection("roles")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === "roles"
                ? "bg-white text-navy shadow-sm"
                : "text-white/80 hover:text-white hover:bg-white/5"
            }`}
          >
            🛡️ Role Permissions
          </button>
          <button
            onClick={() => setActiveSection("users")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === "users"
                ? "bg-white text-navy shadow-sm"
                : "text-white/80 hover:text-white hover:bg-white/5"
            }`}
          >
            👥 Team ({users.length})
          </button>
          <button
            onClick={() => setActiveSection("whatsapp")}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeSection === "whatsapp"
                ? "bg-white text-navy shadow-sm"
                : "text-white/80 hover:text-white hover:bg-white/5"
            }`}
          >
            💬 WhatsApp
          </button>
        </div>
      </div>

      {/* SECTION 1: WEEKLY DEPARTMENT TARGETS */}
      {activeSection === "targets" && (
        <form onSubmit={handleSaveTargets} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>🎯</span> Weekly Department Goals & Thresholds
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Define the performance benchmarks for each operational pillar. The system calculates live variances and escalations against these targets.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargets(DEFAULT_TARGETS)}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
                >
                  Reset Defaults
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? "Saving…" : "💾 Save Department Targets"}
                </button>
              </div>
            </div>

            {/* Department Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Pillar 1: Lead Acquisition */}
              <div className="border border-blue-100 bg-blue-50/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-blue-900">
                  <span className="text-lg">💼</span>
                  <h4 className="font-bold text-sm">Lead Acquisition (Junior)</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Weekly New Leads Target
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        value={targets.target_weekly_leads}
                        onChange={(e) => setTargets({ ...targets, target_weekly_leads: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">leads/wk</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Training Show-Up Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targets.target_training_showup_rate}
                        onChange={(e) => setTargets({ ...targets, target_training_showup_rate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      KYC Verified (4/4 Docs) Target
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        value={targets.target_kyc_completion_rate}
                        onChange={(e) => setTargets({ ...targets, target_kyc_completion_rate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">candidates</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pillar 2: Fleet Performance */}
              <div className="border border-amber-100 bg-amber-50/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-amber-900">
                  <span className="text-lg">🚗</span>
                  <h4 className="font-bold text-sm">Fleet Performance & Churn</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Active Fleet Utilization Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targets.target_active_fleet_rate}
                        onChange={(e) => setTargets({ ...targets, target_active_fleet_rate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Max Allowed Avg Downtime
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        value={targets.target_max_downtime_days}
                        onChange={(e) => setTargets({ ...targets, target_max_downtime_days: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">days</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Weekly Churn Limit (Max)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        value={targets.target_weekly_churn_limit}
                        onChange={(e) => setTargets({ ...targets, target_weekly_churn_limit: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">contracts/wk</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pillar 3: Field Operations */}
              <div className="border border-green-100 bg-green-50/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-green-900">
                  <span className="text-lg">🛡️</span>
                  <h4 className="font-bold text-sm">Field Operations & Recovery</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Monthly Physical Inspection Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targets.target_monthly_inspection_rate}
                        onChange={(e) => setTargets({ ...targets, target_monthly_inspection_rate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      GPS Telematics Active Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targets.target_gps_connectivity_rate}
                        onChange={(e) => setTargets({ ...targets, target_gps_connectivity_rate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Asset Recovery Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targets.target_asset_recovery_rate}
                        onChange={(e) => setTargets({ ...targets, target_asset_recovery_rate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pillar 4: Safety & Support SLA */}
              <div className="border border-purple-100 bg-purple-50/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-purple-900">
                  <span className="text-lg">🔧</span>
                  <h4 className="font-bold text-sm">Support & 24h SLA</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      24h SLA Resolution Target
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targets.target_sla_resolution_rate}
                        onChange={(e) => setTargets({ ...targets, target_sla_resolution_rate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Max Open Tickets Backlog
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        value={targets.target_max_open_tickets}
                        onChange={(e) => setTargets({ ...targets, target_max_open_tickets: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">tickets</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pillar 5: Finance & Collections */}
              <div className="border border-emerald-100 bg-emerald-50/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-emerald-900">
                  <span className="text-lg">💰</span>
                  <h4 className="font-bold text-sm">Finance & Collections</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Daily Clearing Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targets.target_collection_rate}
                        onChange={(e) => setTargets({ ...targets, target_collection_rate: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Target Weekly Collections
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={targets.target_weekly_revenue_mad}
                        onChange={(e) => setTargets({ ...targets, target_weekly_revenue_mad: Number(e.target.value) })}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">MAD</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* SECTION 2: ROLE & TAB PERMISSIONS */}
      {activeSection === "roles" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>🛡️</span> Role & Tab Access Control
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select which tabs are accessible for each role. Changes apply to all team members assigned to that role.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsNewRoleModalOpen(true)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <span>➕</span> Create New Role
                </button>

                <button
                  onClick={handleSavePermissions}
                  disabled={isSaving}
                  className="px-5 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? "Saving…" : "💾 Save All Permissions"}
                </button>
              </div>
            </div>

            {/* Roles Matrix Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {Object.keys(permissions).map((roleKey) => {
                const assignedTabs = permissions[roleKey] || [];
                const roleLabel = roleLabels[roleKey] || roleKey;
                const isCoreRole = Object.keys(DEFAULT_ROLE_PERMISSIONS).includes(roleKey);

                return (
                  <div
                    key={roleKey}
                    className="border border-gray-200/80 rounded-2xl p-5 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-navy" />
                          <h4 className="font-bold text-sm text-gray-900">{roleLabel}</h4>
                          <span className="text-[10px] font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md">
                            {roleKey}
                          </span>
                        </div>

                        {!isCoreRole && (
                          <button
                            onClick={() => handleDeleteRole(roleKey)}
                            title="Delete custom role"
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-500 mb-4">
                        {assignedTabs.length} of {ALL_TABS.length} tabs enabled
                      </p>

                      {/* Tab Toggles Grid */}
                      <div className="grid grid-cols-3 gap-2">
                        {ALL_TABS.map((tab) => {
                          const isEnabled = assignedTabs.includes(tab.id);
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => handleToggleTab(roleKey, tab.id)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                                isEnabled
                                  ? "bg-navy text-white border-navy shadow-sm"
                                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <span>{tab.icon}</span>
                              <span className="truncate">{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                      <span>{isCoreRole ? "Core System Role" : "Custom User Role"}</span>
                      <span>Click tabs to toggle access</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: TEAM USER MANAGEMENT */}
      {activeSection === "users" && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>👥</span> Team Member Accounts ({users.length})
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage your real team members, change roles, or remove accounts.
              </p>
            </div>

            <button
              onClick={() => setIsNewUserModalOpen(true)}
              className="px-4 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>➕</span> Add Team Member
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Region</th>
                  <th className="py-3 px-4">Current Role & Tab Access</th>
                  <th className="py-3 px-4">Change Role</th>
                  <th className="py-3 px-4 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const isPrimaryManager = u.email === "mouad.koudia@gocab.io";
                  return (
                    <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs ${
                            isPrimaryManager ? "bg-[#f5c842] text-navy ring-2 ring-navy/20" : "bg-navy/10 text-navy"
                          }`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-gray-900">{u.name}</p>
                              {isPrimaryManager && (
                                <span className="px-1.5 py-0.2 bg-[#f5c842]/20 text-navy font-bold text-[9px] rounded">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400">{u.fullName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-600">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-medium text-gray-600">
                          📍 {u.region}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="px-2.5 py-1 bg-navy/10 text-navy rounded-full text-[10px] font-bold">
                            {roleLabels[u.role] || u.role}
                          </span>
                          <p className="text-[10px] text-gray-400">
                            {(permissions[u.role] || []).length} tabs accessible
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={u.role}
                          disabled={isPrimaryManager}
                          onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                          className="border border-gray-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy font-medium text-gray-800 disabled:opacity-50"
                        >
                          {Object.keys(permissions).map((roleKey) => (
                            <option key={roleKey} value={roleKey}>
                              {roleLabels[roleKey] || roleKey}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isPrimaryManager && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: WHATSAPP TEMPLATES */}
      {activeSection === "whatsapp" && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>💬</span> WhatsApp Driver Confirmation Message
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Customize the automatic WhatsApp message sent to driver candidates when their training session is fixed.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-700">
              Message Template Body
            </label>
            <textarea
              rows={6}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full border border-gray-300 rounded-2xl p-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
              placeholder="Type template message..."
            />
            <div className="bg-gray-50 rounded-xl p-3 text-[11px] text-gray-500 space-y-1 border border-gray-100">
              <p className="font-semibold text-gray-700">Available Placeholder Tags:</p>
              <p><code>{"{name}"}</code> — Driver's candidate name</p>
              <p><code>{"{date}"}</code> — Scheduled training date (e.g. 25/08/2026)</p>
              <p><code>{"{time}"}</code> — Scheduled time</p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={handleSaveTemplate}
              disabled={isSaving}
              className="px-5 py-2.5 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save WhatsApp Template"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW ROLE */}
      {isNewRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>➕</span> Create New Custom Role
              </h3>
              <button
                onClick={() => setIsNewRoleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Display Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regional Inspector, Growth Specialist"
                  value={newRoleLabel}
                  onChange={(e) => {
                    setNewRoleLabel(e.target.value);
                    if (!newRoleKey) {
                      setNewRoleKey(e.target.value.toUpperCase().replace(/\s+/g, "_"));
                    }
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Role Key (System Identifier)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. REGIONAL_INSPECTOR"
                  value={newRoleKey}
                  onChange={(e) => setNewRoleKey(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Assign Accessible Tabs
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_TABS.map((tab) => {
                    const isChecked = newRoleTabs.includes(tab.id);
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setNewRoleTabs((prev) =>
                            prev.includes(tab.id)
                              ? prev.filter((t) => t !== tab.id)
                              : [...prev, tab.id]
                          );
                        }}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                          isChecked
                            ? "bg-navy text-white border-navy"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewRoleModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW USER */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>➕</span> Add New Team Member
              </h3>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Yassine Benali"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yassine@gocab.io"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Password</label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-navy/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Assign Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30 font-medium"
                >
                  {Object.keys(permissions).map((roleKey) => (
                    <option key={roleKey} value={roleKey}>
                      {roleLabels[roleKey] || roleKey}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy hover:bg-navy/90 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
