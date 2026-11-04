import { prisma } from "../src/lib/prisma";
import { createClient } from "@libsql/client";

const TARGET_PLATES = ["26608-Y-6", "39449-Y-6", "26673-Y-6"];

export async function updateAvailableVehicles() {
  console.log("==================================================");
  console.log("🚗 GoCab CRM — Update Available Vehicles (Parc)");
  console.log("Target Plates:", TARGET_PLATES);
  console.log("==================================================");

  // 1. Fetch current vehicle records
  const vehicles = await prisma.vehicle.findMany({
    where: {
      plate_number: { in: TARGET_PLATES },
    },
    include: {
      driverProfile: true,
    },
  });

  console.log(`Found ${vehicles.length} matching target vehicles in database.`);

  for (const v of vehicles) {
    console.log(`\nUpdating ${v.plate_number}:`);
    console.log(`  Current Status: ${v.status}`);
    console.log(`  Current Driver: ${v.assigned_driver_name || "None"}`);

    // Unlink driver profile if attached
    if (v.driverProfile) {
      await prisma.driverProfile.update({
        where: { id: v.driverProfile.id },
        data: { assignedVehicleId: null },
      });
      console.log(`  Unlinked DriverProfile: ${v.driverProfile.fullName}`);
    }

    // Also check if any driverProfile still references this vehicle ID
    await prisma.driverProfile.updateMany({
      where: { assignedVehicleId: v.id },
      data: { assignedVehicleId: null },
    });

    // Update vehicle to Available
    await prisma.vehicle.update({
      where: { id: v.id },
      data: {
        status: "Available",
        assigned_driver_name: null,
        assigned_driver_phone: null,
        historical_driver_name: v.assigned_driver_name || v.historical_driver_name,
        historical_driver_phone: v.assigned_driver_phone || v.historical_driver_phone,
        updated_at: new Date(),
      },
    });
    console.log(`  ✅ Set status to 'Available', archived driver to historical_driver_name.`);
  }

  // 2. Remove or archive the mock TEST-AZIZ-3010 vehicle so it doesn't inflate available count
  const testCar = await prisma.vehicle.findUnique({
    where: { plate_number: "TEST-AZIZ-3010" },
  });
  if (testCar) {
    await prisma.vehicle.delete({
      where: { id: testCar.id },
    }).catch(async () => {
      await prisma.vehicle.update({
        where: { id: testCar.id },
        data: { is_archived: true },
      });
    });
    console.log("\n✅ Cleaned up temporary test mock vehicle TEST-AZIZ-3010.");
  }

  // 3. Verify total available vehicles in local DB
  const availableVehicles = await prisma.vehicle.findMany({
    where: {
      status: { in: ["Available", "disponible", "DISPONIBLE"] },
      is_archived: false,
    },
    select: {
      id: true,
      plate_number: true,
      make_model: true,
      hub_city: true,
      status: true,
      historical_driver_name: true,
    },
  });

  console.log(`\n==================================================`);
  console.log(`📊 Local Database Verification:`);
  console.log(`Total Available Vehicles: ${availableVehicles.length}`);
  console.table(availableVehicles);
  console.log(`==================================================`);

  // 4. Update Remote Turso Scaler Database
  const tursoUrl = process.env.TURSO_DATABASE_URL || "https://gocab-crm-gocab-crm.aws-ap-south-1.turso.io";
  const tursoToken = process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM3NDY2NTUsImlkIjoiMDFhMDNlMDAtMzcwMS03Y2FhLTkxYmMtOGUzYTNlMjc1YjZhIiwia2lkIjoic0NXSXczME1uSk1Pd0MyYjY0VzB3V0Zuek0tQWUxYm1PcU4tWmdaWUpiNCIsInJpZCI6IjdlMDc3NjY5LTJmMDYtNDRjMy1hNTM5LTJiODM4OWMxN2ViZCJ9.ogUW1p4VQevvjHu2lhpNwtQE4EqelyYSt3tFanuC5tpFdUJEc-m_4YyRb97SzKhVQ6VwkpVj7x2Or61eJig7BQ";

  if (tursoUrl && tursoToken) {
    console.log("\n📡 Syncing changes to Remote Turso Scaler Database...");
    const client = createClient({ url: tursoUrl, authToken: tursoToken });

    for (const plate of TARGET_PLATES) {
      // Find driver info on remote to keep in historical
      const remoteV = await client.execute({
        sql: "SELECT id, assigned_driver_name, assigned_driver_phone, historical_driver_name, historical_driver_phone FROM Vehicle WHERE plate_number = ?",
        args: [plate],
      });

      if (remoteV.rows.length > 0) {
        const row = remoteV.rows[0];
        const histName = (row.assigned_driver_name as string) || (row.historical_driver_name as string) || null;
        const histPhone = (row.assigned_driver_phone as string) || (row.historical_driver_phone as string) || null;
        const vId = row.id as string;

        // Unlink driver in DriverProfile on remote
        await client.execute({
          sql: "UPDATE DriverProfile SET assignedVehicleId = NULL WHERE assignedVehicleId = ?",
          args: [vId],
        });

        // Set Vehicle to Available
        await client.execute({
          sql: `UPDATE Vehicle SET 
                status = 'Available', 
                assigned_driver_name = NULL, 
                assigned_driver_phone = NULL, 
                historical_driver_name = ?, 
                historical_driver_phone = ?,
                updated_at = ?
                WHERE plate_number = ?`,
          args: [histName, histPhone, new Date().toISOString(), plate],
        });
        console.log(`  ✅ Remote Turso: Updated ${plate} to Available.`);
      }
    }

    // Clean up TEST-AZIZ-3010 on remote
    await client.execute({
      sql: "DELETE FROM Vehicle WHERE plate_number = 'TEST-AZIZ-3010'",
      args: [],
    }).catch(async () => {
      await client.execute({
        sql: "UPDATE Vehicle SET is_archived = 1 WHERE plate_number = 'TEST-AZIZ-3010'",
        args: [],
      });
    });
    console.log("  ✅ Remote Turso: Cleaned up TEST-AZIZ-3010.");

    // Remote count verification
    const remoteAvail = await client.execute({
      sql: "SELECT plate_number, make_model, hub_city, status, historical_driver_name FROM Vehicle WHERE status IN ('Available', 'disponible', 'DISPONIBLE') AND is_archived = 0",
      args: [],
    });
    console.log(`\n📊 Remote Turso Verification:`);
    console.log(`Total Available Vehicles: ${remoteAvail.rows.length}`);
    console.table(remoteAvail.rows);
  }
}

updateAvailableVehicles().catch(console.error);
