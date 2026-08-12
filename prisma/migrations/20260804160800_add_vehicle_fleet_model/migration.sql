-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plate_number" TEXT NOT NULL,
    "make_model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vin" TEXT,
    "current_mileage" INTEGER NOT NULL DEFAULT 0,
    "hub_city" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "insurance_expiry_date" DATETIME,
    "insurance_policy_number" TEXT,
    "vignette_expiry_date" DATETIME,
    "autorisation_expiry_date" DATETIME,
    "technical_inspection_expiry" DATETIME,
    "assigned_driver_name" TEXT,
    "assigned_driver_phone" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_number_key" ON "Vehicle"("plate_number");
