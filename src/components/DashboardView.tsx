"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { LayoutDashboard, Users, Car, Wrench, ShieldAlert } from "lucide-react";
import OpsTargetAlertsBanner from "./OpsTargetAlertsBanner";

export default function DashboardView() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch leads to calculate conversion
        const leadsRes = await fetch("/api/leads");
        const leadsData = await leadsRes.json();
        const leads = leadsData.leads || [];
        const totalLeads = leads.length;
        const assignedLeads = leads.filter((l: any) => l.board_column === "VEHICLE_ASSIGNMENT").length;
        const conversionRate = totalLeads ? Math.round((assignedLeads / totalLeads) * 100) : 0;

        // Fetch vehicles
        const vehiclesRes = await fetch("/api/vehicles");
        const vehiclesData = await vehiclesRes.json();
        const vehicles = vehiclesData.vehicles || [];
        const totalVehicles = vehicles.length;
        const activeVehicles = vehicles.filter((v: any) => v.status === "Actif" || v.status === "Available").length;
        const utilizationRate = totalVehicles ? Math.round((activeVehicles / totalVehicles) * 100) : 0;
        const totalDowntime = vehicles.reduce((sum: number, v: any) => sum + (v.total_downtime_days || 0), 0);

        // Fetch tasks
        const tasksRes = await fetch("/api/field-tasks");
        const tasksData = await tasksRes.json();
        const tasks = tasksData.tasks || [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t: any) => t.status === "COMPLETED").length;
        const taskCompletionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Compile data for charts
        const fleetStatusData = [
          { name: "Available", value: vehicles.filter((v: any) => v.status === "Available").length },
          { name: "Actif", value: vehicles.filter((v: any) => v.status === "Actif").length },
          { name: "In Repair", value: vehicles.filter((v: any) => v.status === "In garage" || v.status === "In service").length },
          { name: "Accident/Impounded", value: vehicles.filter((v: any) => v.status === "Accident" || v.status === "impounded by police").length },
        ];

        const pipelineData = [
          { name: "New", count: leads.filter((l: any) => l.board_column === "NEW_LEADS").length },
          { name: "Pre-Filter", count: leads.filter((l: any) => l.board_column === "BRAND_PRE_FILTER").length },
          { name: "Training", count: leads.filter((l: any) => l.board_column === "TRAINING_PIPELINE").length },
          { name: "Assigned", count: assignedLeads },
        ];

        setStats({
          totalLeads,
          conversionRate,
          utilizationRate,
          totalDowntime,
          taskCompletionRate,
          fleetStatusData,
          pipelineData,
        });
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center animate-fade-in">
        <div className="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-[1400px] mx-auto w-full pb-10">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100">
            <LayoutDashboard className="w-6 h-6 text-navy" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Executive Dashboard</h2>
            <p className="text-sm text-gray-500 font-medium">Overview of GoCab operational performance across 3 pillars</p>
          </div>
        </div>
      </div>

      {/* Automated Target vs Actual Alerts & Weekly Report Strip */}
      <OpsTargetAlertsBanner />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/60 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Lead Conversion</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-gray-900">{stats?.conversionRate}%</h3>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
              </div>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 relative z-10 font-medium">{stats?.totalLeads} total leads imported</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/60 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fleet Utilization</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-gray-900">{stats?.utilizationRate}%</h3>
              </div>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Car className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 relative z-10 font-medium">Vehicles on the road</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/60 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Downtime</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-gray-900">{stats?.totalDowntime} <span className="text-lg text-gray-400 font-medium">Days</span></h3>
              </div>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 relative z-10 font-medium">Cumulative lost operational days</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/60 hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-50 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Field Task Completion</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-gray-900">{stats?.taskCompletionRate}%</h3>
              </div>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 relative z-10 font-medium">Tasks resolved on time</p>
        </div>

      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
        
        {/* Chart 1 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/60">
          <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Pipeline Progression
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.pipelineData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="#2C4E8C" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100/60 flex flex-col">
          <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Fleet Status Distribution
          </h3>
          <div className="flex-1 min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.fleetStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {stats?.fleetStatusData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Custom Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {stats?.fleetStatusData.map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs font-medium text-gray-600">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
