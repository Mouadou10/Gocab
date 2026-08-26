CREATE TABLE "Blacklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sanitized_phone" TEXT NOT NULL,
    "reason" TEXT NOT NULL
);

CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

CREATE TABLE "PaymentCancellation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "driver_name" TEXT NOT NULL,
    "driver_phone" TEXT,
    "plate_number" TEXT,
    "vehicle_id" TEXT,
    "reason" TEXT NOT NULL,
    "linked_ticket_id" TEXT,
    "auto_waiver" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "collection_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "VehicleInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicle_id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "inspector_name" TEXT NOT NULL,
    "inspection_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_mileage" INTEGER NOT NULL DEFAULT 0,
    "brakes_score" INTEGER NOT NULL DEFAULT 0,
    "tires_score" INTEGER NOT NULL DEFAULT 0,
    "engine_score" INTEGER NOT NULL DEFAULT 0,
    "oil_level_score" INTEGER NOT NULL DEFAULT 0,
    "lights_score" INTEGER NOT NULL DEFAULT 0,
    "suspension_score" INTEGER NOT NULL DEFAULT 0,
    "body_condition_score" INTEGER NOT NULL DEFAULT 0,
    "interior_score" INTEGER NOT NULL DEFAULT 0,
    "battery_score" INTEGER NOT NULL DEFAULT 0,
    "exhaust_score" INTEGER NOT NULL DEFAULT 0,
    "health_score" REAL NOT NULL DEFAULT 0.0,
    "previous_health_score" REAL NOT NULL DEFAULT 0.0,
    "notes" TEXT,
    "linked_task_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "DailyCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "collector_name" TEXT NOT NULL,
    "expected_total" REAL NOT NULL,
    "collected_total" REAL NOT NULL DEFAULT 0.0,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "DriverProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cinNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneSanitized" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "licenseSeniority" INTEGER NOT NULL,
    "isKycVerified" BOOLEAN NOT NULL DEFAULT false,
    "contractType" TEXT NOT NULL,
    "monthlyTripCount" INTEGER NOT NULL DEFAULT 0,
    "currentArrearsMAD" REAL NOT NULL DEFAULT 0.00,
    "defaultStage" TEXT NOT NULL DEFAULT 'NOMINAL',
    "assignedVehicleId" TEXT,
    CONSTRAINT "DriverProfile_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "SupportTicket_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "FieldInspectionNew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "vcrData" TEXT NOT NULL,
    "odometerRead" INTEGER NOT NULL,
    "inspectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldInspectionNew_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FieldInspectionNew_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PaymentLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driverId" TEXT NOT NULL,
    "expectedMAD" REAL NOT NULL,
    "clearedMAD" REAL NOT NULL,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentLedger_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "WeeklyObjective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "role" TEXT NOT NULL,
    "region" TEXT,
    "metricKey" TEXT NOT NULL,
    "targetValue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raw_name" TEXT NOT NULL,
    "sanitized_phone" TEXT NOT NULL,
    "campaign_source" TEXT NOT NULL,
    "board_column" TEXT NOT NULL DEFAULT 'NEW_LEADS',
    "brand_status" TEXT,
    "training_status" TEXT,
    "reminder_date" DATETIME,
    "preorder_amount" REAL,
    "city" TEXT,
    "has_cin" BOOLEAN NOT NULL DEFAULT false,
    "has_fiche_anthropometrique" BOOLEAN NOT NULL DEFAULT false,
    "has_confirmation_adresse" BOOLEAN NOT NULL DEFAULT false,
    "has_permis" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
, "status_changed_at" DATETIME, "age" INTEGER, "is_resident" BOOLEAN, "permis_seniority_years" INTEGER);

CREATE TABLE "AccidentClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "severity" TEXT,
    "fault" TEXT,
    "timeline_step" TEXT NOT NULL DEFAULT 'NEW_ACCIDENT',
    "step_updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "AccidentClaim_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccidentClaim_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "DriverProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plate_number" TEXT NOT NULL,
    "make_model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vin" TEXT,
    "current_mileage" INTEGER NOT NULL DEFAULT 0,
    "total_downtime_days" INTEGER NOT NULL DEFAULT 0,
    "hub_city" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "insurance_expiry_date" DATETIME,
    "insurance_policy_number" TEXT,
    "vignette_expiry_date" DATETIME,
    "autorisation_expiry_date" DATETIME,
    "technical_inspection_expiry" DATETIME,
    "assigned_driver_name" TEXT,
    "assigned_driver_phone" TEXT,
    "assigned_supervisor" TEXT,
    "assigned_collector" TEXT,
    "notes" TEXT,
    "isInsuranceActive" BOOLEAN NOT NULL DEFAULT false,
    "lastVidangeOdoKM" INTEGER NOT NULL DEFAULT 0,
    "adBlueLevelPct" INTEGER NOT NULL DEFAULT 100,
    "isGpsConnected" BOOLEAN NOT NULL DEFAULT true,
    "lastGpsPing" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "MaintenanceTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicle_id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "ticket_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "field_status" TEXT,
    "sla_deadline" DATETIME,
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "payment_waived" BOOLEAN NOT NULL DEFAULT false,
    "waived_days" REAL NOT NULL DEFAULT 0.0,
    "waiver_reason" TEXT,
    "repair_cost" REAL,
    "garage_name" TEXT,
    "resolution_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "ChurnEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicle_id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "reason" TEXT,
    "churned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'CASABLANCA',
    "assignedCars" INTEGER NOT NULL DEFAULT 0,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "FieldTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_type" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "plate_number" TEXT,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "failure_reason" TEXT,
    "linked_ticket_id" TEXT,
    "assigned_to" TEXT,
    "due_date" DATETIME,
    "completed_at" DATETIME,
    "has_key" BOOLEAN NOT NULL DEFAULT false,
    "has_carte_grise" BOOLEAN NOT NULL DEFAULT false,
    "has_assurance" BOOLEAN NOT NULL DEFAULT false,
    "recovery_duration_hours" REAL,
    "recovery_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Blacklist_sanitized_phone_key" ON "Blacklist"("sanitized_phone");

CREATE UNIQUE INDEX "DriverProfile_cinNumber_key" ON "DriverProfile"("cinNumber");

CREATE UNIQUE INDEX "DriverProfile_phoneSanitized_key" ON "DriverProfile"("phoneSanitized");

CREATE UNIQUE INDEX "DriverProfile_assignedVehicleId_key" ON "DriverProfile"("assignedVehicleId");

CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

CREATE UNIQUE INDEX "Lead_sanitized_phone_key" ON "Lead"("sanitized_phone");

CREATE UNIQUE INDEX "Vehicle_plate_number_key" ON "Vehicle"("plate_number");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "VehicleExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicle_id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount_mad" REAL NOT NULL DEFAULT 0.0,
    "description" TEXT,
    "invoice_number" TEXT,
    "paid_by" TEXT NOT NULL DEFAULT 'COMPANY',
    "is_rechargeable" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleExpense_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VehicleExpense_vehicle_id_idx" ON "VehicleExpense"("vehicle_id");
CREATE INDEX IF NOT EXISTS "VehicleExpense_plate_number_idx" ON "VehicleExpense"("plate_number");
CREATE INDEX IF NOT EXISTS "VehicleExpense_category_idx" ON "VehicleExpense"("category");