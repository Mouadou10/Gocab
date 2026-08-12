import React from "react";

const ArrowRight = () => (
  <div className="flex items-center justify-center text-gray-400 mx-4 animate-pulse">
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  </div>
);

const ArrowDown = () => (
  <div className="flex items-center justify-center text-gray-400 my-4 animate-pulse">
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  </div>
);

export default function SystemWorkflowPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-10 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-black text-[#2C4E8C] tracking-tight mb-4">GoCab CRM: System Architecture & Workflow</h1>
          <p className="text-lg text-gray-500 max-w-3xl mx-auto">
            A complete map of how data, drivers, and vehicles move through our operational engine. 
            This diagram shows the automated handoffs between departments.
          </p>
        </header>

        {/* Phase 1: Onboarding Pipeline */}
        <div className="mb-16">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-200 pb-2">Phase 1: Acquisition & Onboarding</h2>
          <div className="flex flex-col md:flex-row items-center justify-center">
            
            {/* Leads Card */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 w-80 relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
              <div className="text-4xl mb-4">📢</div>
              <h3 className="text-xl font-bold text-navy mb-2">1. Leads & Acquisition</h3>
              <p className="text-sm text-gray-600 mb-4">Capture driver leads from Meta and TikTok Ads. Track daily calling performance.</p>
              <div className="bg-blue-50 rounded-lg p-3 text-xs font-semibold text-blue-800">
                Data Handoff: Moves to Training when lead reaches "Accept Offer".
              </div>
            </div>

            <ArrowRight />

            {/* Training Card */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-purple-100 w-80 relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
              <div className="text-4xl mb-4">🎓</div>
              <h3 className="text-xl font-bold text-navy mb-2">2. Training & KYC</h3>
              <p className="text-sm text-gray-600 mb-4">Verify driver documents, conduct in-person training, and sign legal contracts.</p>
              <div className="bg-purple-50 rounded-lg p-3 text-xs font-semibold text-purple-800">
                Data Handoff: Driver profile is created and linked to a vehicle.
              </div>
            </div>

            <ArrowRight />

            {/* Fleet Card */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-emerald-100 w-80 relative overflow-hidden group hover:shadow-xl transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
              <div className="text-4xl mb-4">🚗</div>
              <h3 className="text-xl font-bold text-navy mb-2">3. Fleet & Asset Mgmt</h3>
              <p className="text-sm text-gray-600 mb-4">Centralized asset tracking. Monitors insurance, vignette, and technical inspection expiries.</p>
              <div className="bg-emerald-50 rounded-lg p-3 text-xs font-semibold text-emerald-800">
                Automations: Generates 30-day compliance alerts.
              </div>
            </div>
          </div>
        </div>

        {/* Arrow linking Phase 1 to Phase 2 */}
        <div className="flex justify-center -mt-8 mb-4">
          <ArrowDown />
        </div>

        {/* Phase 2: Operations & Recovery Pipeline */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-200 pb-2">Phase 2: Operations, Maintenance & Recovery</h2>
          
          <div className="flex flex-col md:flex-row items-start justify-center gap-8">
            
            {/* Tickets Card */}
            <div className="flex flex-col items-center">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-orange-100 w-80 relative overflow-hidden group hover:shadow-xl transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                <div className="text-4xl mb-4">🔧</div>
                <h3 className="text-xl font-bold text-navy mb-2">4. Support & Tickets</h3>
                <p className="text-sm text-gray-600 mb-4">Log mechanical issues, driver complaints, or accidents directly linked to the vehicle.</p>
                <div className="bg-orange-50 rounded-lg p-3 text-xs font-semibold text-orange-800">
                  Automation: Accident tickets instantly spawn Insurance Claims.
                </div>
              </div>
              <ArrowDown />
            </div>

            {/* Insurance Card */}
            <div className="flex flex-col items-center mt-12 md:mt-24">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-red-100 w-80 relative overflow-hidden group hover:shadow-xl transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-navy mb-2">5. Insurance & Accidents</h3>
                <p className="text-sm text-gray-600 mb-4">Manage accident pipelines. Track days spent in garage, severity, and driver fault history.</p>
                <div className="bg-red-50 rounded-lg p-3 text-xs font-semibold text-red-800">
                  Automation: Triggers Field Task when car is "Ready for Pickup".
                </div>
              </div>
              <ArrowDown />
            </div>

            {/* Field Supervisor Card */}
            <div className="flex flex-col items-center mt-24 md:mt-48">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 w-80 relative overflow-hidden group hover:shadow-xl transition-all bg-gradient-to-br from-white to-blue-50">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-900"></div>
                <div className="text-4xl mb-4">🛡️</div>
                <h3 className="text-xl font-bold text-navy mb-2">6. Field Supervisor</h3>
                <p className="text-sm text-gray-600 mb-4">Physical on-ground task management for picking up vehicles from garages or recovering from drivers.</p>
                <div className="bg-blue-100/50 border border-blue-200 rounded-lg p-3 text-xs font-semibold text-blue-900">
                  Closing the Loop: Completing a task automatically marks the Vehicle as "Available" in the Fleet again.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Database & Architecture Note */}
        <div className="mt-24 bg-navy text-white rounded-3xl p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>
          
          <h2 className="text-2xl font-bold mb-4 relative z-10">Technical Architecture Highlights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            <div>
              <h4 className="font-bold text-blue-300 mb-2">Frontend Tech</h4>
              <p className="text-sm text-white/80">Next.js 14 App Router, React Server Components, Tailwind CSS, and drag-and-drop Kanban interfaces.</p>
            </div>
            <div>
              <h4 className="font-bold text-blue-300 mb-2">Backend Tech</h4>
              <p className="text-sm text-white/80">Prisma ORM over SQLite (Sync architecture). Automated API endpoints handle all cross-department data handoffs securely.</p>
            </div>
            <div>
              <h4 className="font-bold text-blue-300 mb-2">Automation Engine</h4>
              <p className="text-sm text-white/80">Cron jobs and API webhooks ensure status syncs. E.g., when a field task is completed, the vehicle state instantly updates across all dashboards.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
