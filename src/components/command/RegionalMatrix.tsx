"use client";

import React, { useState } from 'react';
import { Vehicle } from '@prisma/client';

type RegionalMatrixProps = {
  vehicles: Vehicle[];
};

const REGIONS = [
  { id: "CASABLANCA_HQ", label: "Casablanca HQ" },
  { id: "CASABLANCA_HUB", label: "Casablanca Hub" },
  { id: "MARRAKECH_HUB", label: "Marrakech Hub" },
  { id: "TANGIER_HUB", label: "Tangier Hub" },
  { id: "AGADIR_HUB", label: "Agadir Hub" }
];

export default function RegionalMatrix({ vehicles }: RegionalMatrixProps) {
  const [activeRegion, setActiveRegion] = useState("CASABLANCA_HUB");

  // Filter vehicles for the active region
  const regionVehicles = vehicles.filter(v => v.hub_city === activeRegion);

  const statusCounts = {
    ACTIF: regionVehicles.filter(v => v.status === "ACTIF").length,
    DISPONIBLE: regionVehicles.filter(v => v.status === "DISPONIBLE").length,
    GARAGE_ACC: regionVehicles.filter(v => v.status === "GARAGE_ACC").length,
    ACCIDENTE: regionVehicles.filter(v => v.status === "ACCIDENTE").length,
    VOL_DECLARE: regionVehicles.filter(v => v.status === "VOL_DECLARE").length,
  };

  // Mock data for Funnel and Inspection since we need historical lead/inspection data
  const onboardingConversion = 78; // Target: High efficiency
  const inspectionCompliance = 92; // Target: >= 90%

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-[#2C4E8C] mb-4">Module 2: Regional Hub Matrix</h2>
      
      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {REGIONS.map((region) => (
          <button
            key={region.id}
            onClick={() => setActiveRegion(region.id)}
            className={`py-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeRegion === region.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {region.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Local Inventory Counts */}
        <div className="col-span-1 md:col-span-1 border border-gray-100 rounded-md p-4 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Local Inventory Counts</h3>
          <ul className="space-y-3">
            <li className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Actif</span>
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">{statusCounts.ACTIF}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Disponible</span>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">{statusCounts.DISPONIBLE}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Garage ACC</span>
              <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2.5 py-0.5 rounded">{statusCounts.GARAGE_ACC}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Accidenté</span>
              <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded">{statusCounts.ACCIDENTE}</span>
            </li>
            <li className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Vol Déclaré</span>
              <span className="bg-gray-200 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded">{statusCounts.VOL_DECLARE}</span>
            </li>
          </ul>
        </div>

        {/* Regional Onboarding Funnel */}
        <div className="col-span-1 md:col-span-1 border border-gray-100 rounded-md p-4 bg-gray-50 flex flex-col justify-center items-center text-center">
          <h3 className="text-sm font-medium text-gray-500 mb-2 w-full text-left">Onboarding Conversion</h3>
          <div className="flex-1 flex flex-col justify-center">
            <span className="text-4xl font-bold text-gray-900">{onboardingConversion}%</span>
            <span className="text-xs text-gray-500 mt-2">Training ➔ Contract Execution</span>
          </div>
        </div>

        {/* Inspection Compliance Gauge */}
        <div className="col-span-1 md:col-span-1 border border-gray-100 rounded-md p-4 bg-gray-50 flex flex-col justify-center items-center text-center">
          <h3 className="text-sm font-medium text-gray-500 mb-2 w-full text-left">Inspection Compliance</h3>
          <div className="flex-1 flex flex-col justify-center">
            <span className={`text-4xl font-bold ${inspectionCompliance >= 90 ? 'text-[#5B6C28]' : 'text-red-600'}`}>
              {inspectionCompliance}%
            </span>
            <span className="text-xs text-gray-500 mt-2">Target: ≥ 90% (Last 30 Days)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
