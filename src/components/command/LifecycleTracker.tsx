import React from 'react';

type LifecycleTrackerProps = {
  vehicles: any[]; // Using any to accommodate the relation fields easily for now
};

export default function LifecycleTracker({ vehicles }: LifecycleTrackerProps) {
  
  const getRiskLevel = (vehicle: any) => {
    if (vehicle.driverProfile?.defaultStage === 'TELEMATIC_BLOCK_EXECUTED') return 'CRITICAL (Blocked)';
    if (vehicle.driverProfile?.currentArrearsMAD > 0) return 'CRITICAL (Arrears)';
    if (vehicle.status === 'GARAGE_ACC') return 'WARNING (Garage)';
    if (vehicle.current_mileage - vehicle.lastVidangeOdoKM > 8000) return 'WARNING (Vidange Due)';
    return 'NOMINAL';
  };

  const getRiskColor = (risk: string) => {
    if (risk.includes('CRITICAL')) return 'text-red-700 bg-red-100';
    if (risk.includes('WARNING')) return 'text-orange-700 bg-orange-100';
    return 'text-green-700 bg-green-100';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-[#2C4E8C]">Module 3: Live Asset Lifecycle Tracker</h2>
        <span className="text-xs bg-gray-100 text-gray-600 py-1 px-2 rounded-full border border-gray-200">
          Live Data Feed
        </span>
      </div>
      
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GPS Sync</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vidange</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vehicles.slice(0, 15).map((vehicle) => {
              const risk = getRiskLevel(vehicle);
              const driverName = vehicle.driverProfile?.fullName || vehicle.assigned_driver_name || 'Unassigned';
              const vidangeTarget = vehicle.lastVidangeOdoKM + 8000;
              
              return (
                <tr key={vehicle.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {vehicle.plate_number}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.hub_city}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {driverName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${vehicle.status === 'ACTIF' ? 'bg-green-100 text-green-800' : 
                        vehicle.status === 'DISPONIBLE' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.isGpsConnected ? 'Connected' : 'Offline'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.current_mileage.toLocaleString()} / {vidangeTarget.toLocaleString()} KM
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskColor(risk)}`}>
                      {risk}
                    </span>
                  </td>
                </tr>
              );
            })}
            
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                  No vehicle assets found in the system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
