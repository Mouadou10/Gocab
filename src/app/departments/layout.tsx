"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DEPARTMENTS = [
  { id: "brand-manager", label: "Brand Manager" },
  { id: "lead-acquisition", label: "Lead Acquisition Junior" },
  { id: "driver-support", label: "Driver Support Specialist" },
  { id: "fleet-performance", label: "Fleet Performance Manager" },
  { id: "onboarding-specialist", label: "Onboarding Specialist" },
  { id: "field-supervisor", label: "Field Supervisor" },
  { id: "senior-field-supervisor", label: "Senior Field Supervisor" },
];

export default function DepartmentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex-shrink-0">
        <h2 className="text-xl font-bold text-[#2C4E8C] mb-6">Departments</h2>
        <nav className="space-y-2">
          {DEPARTMENTS.map((dept) => {
            const isActive = pathname === `/departments/${dept.id}`;
            return (
              <Link 
                key={dept.id} 
                href={`/departments/${dept.id}`}
                className={`block px-4 py-2 rounded-md text-sm transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {dept.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
