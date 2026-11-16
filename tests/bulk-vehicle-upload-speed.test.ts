import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { reconcileDriverVehicleAssignments } from "../src/lib/services/driverVehicleReconciliation";

describe("Bulk Vehicle Operations Performance", () => {
  it("should execute driver-vehicle reconciliation in under 3000ms", async () => {
    const t0 = Date.now();
    const result = await reconcileDriverVehicleAssignments();
    const duration = Date.now() - t0;
    console.log(`Reconciled count: ${result.reconciledCount} in ${duration}ms`);
    assert.ok(duration < 3000, `Reconciliation took ${duration}ms (must be < 3000ms)`);
  });

  it("should batch insert and update 30 vehicles in under 1500ms without 504 timeouts", async () => {
    const testPlates = Array.from({ length: 30 }, (_, i) => `TEST-PERF-${1000 + i}`);

    try {
      // 1. Batch CreateMany
      const t0 = Date.now();
      const newVehicles = testPlates.map((plate) => ({
        id: crypto.randomUUID(),
        plate_number: plate,
        make_model: "DACIA SANDERO",
        year: 2024,
        hub_city: "Casablanca",
        status: "Available",
      }));

      await prisma.vehicle.createMany({
        data: newVehicles,
      });
      const insertDuration = Date.now() - t0;
      console.log(`Batch insert 30 vehicles took ${insertDuration}ms`);
      assert.ok(insertDuration < 1000, `Batch insert took ${insertDuration}ms (expected < 1000ms)`);

      // 2. Batch Update via chunked $transaction
      const t1 = Date.now();
      const inserted = await prisma.vehicle.findMany({
        where: { plate_number: { in: testPlates } },
      });

      const updateOps = inserted.map((v) =>
        prisma.vehicle.update({
          where: { id: v.id },
          data: { status: "Actif", notes: "Batch updated perf test" },
        })
      );

      await prisma.$transaction(updateOps);
      const updateDuration = Date.now() - t1;
      console.log(`Batch update 30 vehicles in $transaction took ${updateDuration}ms`);
      assert.ok(updateDuration < 1000, `Batch update took ${updateDuration}ms (expected < 1000ms)`);

    } finally {
      // Cleanup
      await prisma.vehicle.deleteMany({
        where: { plate_number: { in: testPlates } },
      });
    }
  });
});
