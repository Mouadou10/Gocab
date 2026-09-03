import { prisma } from "@/lib/prisma";
import ExecutiveOverview from "@/components/command/ExecutiveOverview";
import RegionalMatrix from "@/components/command/RegionalMatrix";
import LifecycleTracker from "@/components/command/LifecycleTracker";
import DefaultEscalationPipeline from "@/components/command/DefaultEscalationPipeline";

export const dynamic = "force-dynamic";

export default async function CommandDashboard() {
  let totalVehicles = 0;
  let activeVehicles = 0;
  let vehicles: any[] = [];

  try {
    totalVehicles = await prisma.vehicle.count();
    activeVehicles = await prisma.vehicle.count({
      where: { status: "ACTIF" },
    });
    vehicles = await prisma.vehicle.findMany({
      include: {
        driverProfile: true,
        supportTickets: true,
      },
    });
  } catch (err) {
    console.warn("CommandDashboard database fetch warning:", err);
  }

  const utilizationRate = totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#2C4E8C] tracking-tight">Global Command Dashboard</h1>
        <p className="text-gray-500 mt-2">GoCab Morocco Central Operations Control</p>
      </header>

      <div className="flex flex-col gap-8">
        {/* Module 1: Executive Overview */}
        <section>
          <ExecutiveOverview 
            totalVehicles={totalVehicles}
            activeVehicles={activeVehicles}
            utilizationRate={utilizationRate}
            cashMatch={cashMatch}
            volumeFeed={volumeFeed}
            churnRate={churnRate}
            averageDowntime={averageDowntime}
          />
        </section>

        {/* Module 2: Regional Hub Matrix */}
        <section>
          <RegionalMatrix vehicles={vehicles} />
        </section>

        {/* Module 3 & 4 Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2">
            <LifecycleTracker vehicles={vehicles} />
          </div>
          <div className="xl:col-span-1">
            <DefaultEscalationPipeline vehicles={vehicles} />
          </div>
        </div>
      </div>
    </div>
  );
}
