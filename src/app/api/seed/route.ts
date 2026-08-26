import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'CASABLANCA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,

  `CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raw_name" TEXT NOT NULL,
    "sanitized_phone" TEXT NOT NULL,
    "campaign_source" TEXT NOT NULL,
    "board_column" TEXT NOT NULL DEFAULT 'NEW_LEADS',
    "brand_status" TEXT,
    "training_status" TEXT,
    "training_slot_date" DATETIME,
    "training_slot_time" TEXT,
    "deposit_status" TEXT,
    "assigned_vehicle_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "city" TEXT NOT NULL DEFAULT 'Casablanca',
    "national_id" TEXT,
    "license_number" TEXT,
    "has_driver_license" BOOLEAN NOT NULL DEFAULT false,
    "has_national_card" BOOLEAN NOT NULL DEFAULT false,
    "has_fiche_anthropometrique" BOOLEAN NOT NULL DEFAULT false,
    "has_medical_certificate" BOOLEAN NOT NULL DEFAULT false,
    "is_eligible" BOOLEAN,
    "ineligibility_reason" TEXT,
    "status_history" TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Lead_sanitized_phone_key" ON "Lead"("sanitized_phone")`,

  `CREATE TABLE IF NOT EXISTS "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plate_number" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "current_mileage" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "current_driver_name" TEXT,
    "current_driver_phone" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_plate_number_key" ON "Vehicle"("plate_number")`,

  `CREATE TABLE IF NOT EXISTS "MaintenanceTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicle_id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "ticket_type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reported_issue" TEXT NOT NULL,
    "diagnosis" TEXT,
    "resolution_notes" TEXT,
    "estimated_cost" REAL,
    "actual_cost" REAL,
    "garage_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME
  )`,

  `CREATE TABLE IF NOT EXISTS "FieldTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "vehicle_id" TEXT,
    "plate_number" TEXT,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "assigned_to" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "has_key" BOOLEAN DEFAULT false,
    "has_carte_grise" BOOLEAN DEFAULT false,
    "has_assurance" BOOLEAN DEFAULT false,
    "recovery_duration_hours" REAL,
    "recovery_notes" TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS "WeeklyObjective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week_number" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "target_leads" INTEGER NOT NULL DEFAULT 0,
    "target_acquisitions" INTEGER NOT NULL DEFAULT 0,
    "target_training_rate" REAL NOT NULL DEFAULT 0.0,
    "target_deposit_rate" REAL NOT NULL DEFAULT 0.0,
    "target_collection_rate" REAL NOT NULL DEFAULT 0.0,
    "target_inspection_rate" REAL NOT NULL DEFAULT 0.0,
    "target_churn_rate" REAL NOT NULL DEFAULT 0.0,
    "target_vehicle_availability_rate" REAL NOT NULL DEFAULT 0.0,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Blacklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sanitized_phone" TEXT NOT NULL,
    "reason" TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
  )`
];

export async function GET() {
  try {
    const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;

    const client = createClient({
      url,
      ...(authToken ? { authToken } : {}),
    });

    for (const ddl of DDL_STATEMENTS) {
      try {
        await client.execute(ddl);
      } catch (err: any) {
        // Table or index already exists is normal
      }
    }

    const email = "mouad.koudia@gocab.io";
    const passwordHash = await bcrypt.hash("Moulana@pc1995", 12);

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email } },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          name: "Mouad Koudia",
          fullName: "Mouad Koudia",
          passwordHash,
          role: "OPS_MANAGER",
          region: "CASABLANCA",
          isActive: true,
          mustChangePassword: false,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, role: "OPS_MANAGER", isActive: true },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Database schema synced and Ops Manager account verified.",
      user: email,
      databaseUrl: url.startsWith("libsql://") ? "Turso Cloud" : "Local SQLite",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
