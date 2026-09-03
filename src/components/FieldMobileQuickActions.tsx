"use client";

import React, { useState } from "react";

interface FieldMobileQuickActionsProps {
  onSearchPlate?: (plate: string) => void;
  onStartInspection?: () => void;
  pendingRecoveriesCount?: number;
}

export default function FieldMobileQuickActions({
  onSearchPlate,
  onStartInspection,
  pendingRecoveriesCount = 0,
}: FieldMobileQuickActionsProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchPlate && searchQuery.trim()) {
      onSearchPlate(searchQuery.trim().toUpperCase());
    }
  };

  return (
    <div className="block lg:hidden bg-gradient-to-br from-navy to-slate-900 text-white p-4 rounded-2xl shadow-lg mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Superviseur Terrain (Mobile)</h3>
            <p className="text-[11px] text-slate-300">Contrôle rapide & interventions sur site</p>
          </div>
        </div>
        {pendingRecoveriesCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse shadow">
            🚨 {pendingRecoveriesCount} Récupération{pendingRecoveriesCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Quick Plate Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Entrer matricule (ex: 12345-A-6)"
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-400 font-mono uppercase"
        />
        <button
          type="submit"
          className="bg-amber-500 hover:bg-amber-400 text-navy font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 shadow"
        >
          🔍 Trouver
        </button>
      </form>

      {/* Quick Action Touch Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onStartInspection}
          className="bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-bold p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow border border-emerald-400/30"
        >
          <span>📋</span>
          <span>Checkup Mensuel</span>
        </button>
        <a
          href="tel:+212600000000"
          className="bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-white/10"
        >
          <span>📞</span>
          <span>Support Flotte</span>
        </a>
      </div>
    </div>
  );
}
