import React from 'react';

type DefaultEscalationPipelineProps = {
  vehicles: any[]; // Using any for ease in this context
};

export default function DefaultEscalationPipeline({ vehicles }: DefaultEscalationPipelineProps) {
  
  // Get vehicles that are linked to drivers in default stages
  const defaultedVehicles = vehicles.filter(v => 
    v.driverProfile?.defaultStage && v.driverProfile.defaultStage !== 'NOMINAL'
  );

  const day1Warning = defaultedVehicles.filter(v => v.driverProfile?.defaultStage === 'DAY_1_WARNING');
  const finalDemand = defaultedVehicles.filter(v => v.driverProfile?.defaultStage === 'DAY_2_FINAL_DEMAND');
  const telematicBlock = defaultedVehicles.filter(v => v.driverProfile?.defaultStage === 'TELEMATIC_BLOCK_EXECUTED');
  const recoveryDispatch = defaultedVehicles.filter(v => v.driverProfile?.defaultStage === 'RECOVERY_COMPLETED'); // Actually recovery is pending usually

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      <h2 className="text-xl font-semibold text-[#2C4E8C] mb-4">Module 4: 48-Hour Escalation Pipeline</h2>
      
      <div className="flex-1 flex flex-col space-y-4">
        {/* Day 1: Warning */}
        <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 rounded-r-md">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-yellow-800">Day 1: Warning Triggered</h3>
              <p className="text-xs text-yellow-700 mt-1">App warnings issued for 1 unpaid day</p>
            </div>
            <div className="bg-yellow-200 text-yellow-800 font-bold px-3 py-1 rounded-full">
              {day1Warning.length}
            </div>
          </div>
        </div>

        {/* Day 2: Final Demand */}
        <div className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-md">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-orange-800">Day 2: Final Demand</h3>
              <p className="text-xs text-orange-700 mt-1">24-hour final notice active</p>
            </div>
            <div className="bg-orange-200 text-orange-800 font-bold px-3 py-1 rounded-full">
              {finalDemand.length}
            </div>
          </div>
        </div>

        {/* 48-Hour: Telematic Block */}
        <div className="border-l-4 border-red-600 bg-red-50 p-4 rounded-r-md">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-red-800">48-Hr: Telematic Block</h3>
              <p className="text-xs text-red-700 mt-1">Ignition locked via API</p>
            </div>
            <div className="bg-red-200 text-red-800 font-bold px-3 py-1 rounded-full">
              {telematicBlock.length}
            </div>
          </div>
        </div>

        {/* Recovery Dispatch */}
        <div className="border-l-4 border-gray-800 bg-gray-100 p-4 rounded-r-md">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Recovery Dispatch</h3>
              <p className="text-xs text-gray-600 mt-1">Senior FS deployed to GPS pin</p>
            </div>
            <div className="bg-gray-300 text-gray-800 font-bold px-3 py-1 rounded-full">
              {recoveryDispatch.length}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
