# 🚀 GoCab CRM — Complete Claude Code Master Build Specification

> **How to use this file:**
> Provide this entire document as the prompt/instruction file to **Claude Code** (or place it in the root as `CLAUDE.md`) to build, reproduce, or extend the exact **GoCab Operations & Fleet CRM** from scratch.

---

## 📌 1. Project Overview & Technology Stack

**GoCab CRM** is an end-to-end Operations, Fleet Management, KYC Onboarding, and Financial Recovery CRM engineered specifically for Moroccan taxi/ride-hailing fleet operations (e.g. Casablanca, Rabat, Marrakech).

### Core Stack:
- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Language**: TypeScript (Strict Mode)
- **Styling**: TailwindCSS, Tailwind Typography, Lucide React icons, Glassmorphism accents
- **Database & ORM**: Prisma ORM with `@prisma/adapter-libsql` and `@libsql/client` (dual support for local SQLite `dev.db` and Turso Cloud `libsql://`)
- **Authentication**: NextAuth.js (Credentials Provider with bcrypt password hashing and mandatory first-login password update)
- **Charts & Data Viz**: Recharts (ResponsiveContainer, PieChart, BarChart, Tooltips)
- **Drag & Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **CSV Processing**: PapaParse
- **Notifications**: `react-hot-toast`
- **Internationalization**: Custom `LanguageContext` supporting 🇫🇷 Français (default), 🇬🇧 English, and 🇲🇦 العربية (with auto RTL direction switch).

---

## 🏢 2. Operational Roles & Permissions

The CRM enforces strict role-based view controls:
1. **`OPS_MANAGER` / `ADMIN`**: Complete access to all tabs, executive dashboards, settings, user management, and department target configurations.
2. **`FLEET_PERF_MANAGER`**: Focus on **Encaissements & Perf**, **Drivers**, **Fleet**, and **Finance Reports**.
3. **`FIELD_SUPERVISOR`**: Focus on **Field Tasks**, **Vehicle Recovery**, **Inspections (VCR)**, and **Fleet Telematics**.
4. **`SUPPORT_SPECIALIST`**: Focus on **Support & Garage Tickets**, **24h SLA Tracking**, and **Maintenance Costs**.
5. **`LEAD_ACQUISITION_JR`**: Focus on **Leads Kanban**, **Training Pipeline**, **Driver KYC Validation**, and **Vehicle Assignment**.
6. **`FINANCE_OFFICER`**: Focus on **Daily Clearing**, **Driver Arrears Recouvrement**, and **Fleet Financials**.

---

## 💰 3. Core GoCab Business & Financial Rules

### 1. Inactivity Opportunity Loss (`250 MAD / jour`)
- For every day a vehicle stays inactive (in status `Available`, `In garage`, `impounded by police`, or `Accident`), GoCab loses **250 MAD / day** in unrealized revenue.
- The dashboard auto-calculates:
  $$\text{Perte d'Opportunité} = \text{Jours d'arrêt} \times 250 \text{ MAD}$$
  $$\text{Burn Rate Journalier} = \text{Nombre de véhicules inactifs} \times 250 \text{ MAD/jour}$$
  $$\text{Coût Total Véhicule} = \text{Perte d'Opportunité} + \text{Dépenses Directes (Garage/Police)}$$

### 2. Driver Contract & Billing Automation
- **`DAILY` (Journalier)**:
  - Billed **300 MAD per day** from **Monday to Saturday** (Sunday is off/rest day, 6 days = 1,800 MAD/wk).
- **`WEEKLY` (Hebdomadaire)**:
  - Billed **1,800 MAD once per week every Monday**.

### 3. 3rd-Day Non-Payment Critical Red Alert
- If a driver fails to pay for **2 consecutive days**, on the **3rd day without payment** (`consecutiveUnpaidDays >= 2` or accumulated arrears $\ge 600\text{ MAD}$):
  - The driver's row in Fleet Performance and Dashboard turns **Vibrant RED** with a flashing alert badge: `🔴 NON-PAIEMENT CRITIQUE (3e jour) - Risque d'Immobilisation`.
  - Unpaid charges pile up as cumulative debt (e.g. `+300 MAD`, `+600 MAD`, `+1,800 MAD`).
  - Pre-formatted 1-click **WhatsApp reminder button** generates direct text with vehicle plate and exact debt balance.

### 4. Vehicle Expenses & Garage Costs
- Dropdown fee categories (DD List): `REPAIR`, `POLICE` (Fourrière), `MAINTENANCE` (Vidange/Filtres), `ACCIDENT`, `TOWING`, `PARKING`, `TIRES`, `ADMINISTRATIVE`, `OTHER`.
- Supports **`0 MAD`** amounts (warranties, free release from police).
- Option to **"Recharger au compte chauffeur"** (adds amount to `DriverProfile.currentArrearsMAD`).
- Direct recovery workflow: When logging a fee for a car in repair or impounded, optionally update vehicle status back to `Available` or `Actif`.

### 5. Moroccan Phone & Plate Matching
- Phones auto-sanitized to `+212XXXXXXXXX`.
- Smart multi-pattern vehicle matcher handles standard Moroccan plates (`26607-Y-6` $\leftrightarrow$ `26607Y6` $\leftrightarrow$ `26607 Y 6`) and temporary WW plates (`WW964990` $\leftrightarrow$ `964990-WW`).

---

## 🗄️ 4. Complete Database Schema (Prisma)

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id                 String               @id @default(uuid())
  email              String               @unique
  name               String
  fullName           String
  role               String
  region             String               @default("CASABLANCA")
  assignedCars       Int                  @default(0)
  passwordHash       String?
  mustChangePassword Boolean              @default(false)
  isActive           Boolean              @default(true)
  created_at         DateTime             @default(now())
  inspections        FieldInspectionNew[]
  supportTickets     SupportTicket[]
}

model Lead {
  id                          String    @id @default(uuid())
  raw_name                    String
  sanitized_phone             String    @unique
  city                        String
  experience_years            Int       @default(0)
  vtc_experience              String?
  has_permis                  Boolean   @default(false)
  has_cin                     Boolean   @default(false)
  has_carte_vtc               Boolean   @default(false)
  has_fiche_anthropometrique  Boolean   @default(false)
  has_confirmation_adresse    Boolean   @default(false)
  deposit_status              String    @default("PENDING")
  training_attendance_status  String    @default("PENDING")
  lead_score                  Int       @default(0)
  board_column                String    @default("NEW_LEADS")
  brand_status                String?
  training_status             String?
  created_at                  DateTime  @default(now())
  updated_at                  DateTime  @updatedAt
}

model Vehicle {
  id                          String               @id @default(uuid())
  plate_number                String               @unique
  make_model                  String
  year                        Int
  vin                         String?
  current_mileage             Int                  @default(0)
  hub_city                    String               @default("Casablanca")
  status                      String               @default("Available")
  insurance_expiry_date       DateTime?
  insurance_policy_number     String?
  vignette_expiry_date        DateTime?
  autorisation_expiry_date    DateTime?
  technical_inspection_expiry DateTime?
  assigned_driver_name        String?
  assigned_driver_phone       String?
  assigned_supervisor         String?
  total_downtime_days         Int                  @default(0)
  notes                       String?
  isInsuranceActive           Boolean              @default(false)
  lastVidangeOdoKM            Int                  @default(0)
  adBlueLevelPct              Int                  @default(100)
  isGpsConnected              Boolean              @default(true)
  lastGpsPing                 DateTime             @default(now())
  created_at                  DateTime             @default(now())
  updated_at                  DateTime             @updatedAt
  driverProfile               DriverProfile?
  inspections                 FieldInspectionNew[]
  supportTickets              SupportTicket[]
  expenses                    VehicleExpense[]
  accidentClaims              AccidentClaim[]
}

model DriverProfile {
  id                    String          @id @default(uuid())
  cinNumber             String          @unique
  fullName              String
  phoneSanitized        String          @unique
  age                   Int?            @default(28)
  licenseSeniority      Int?            @default(3)
  isKycVerified         Boolean         @default(false)
  contractType          String          @default("DAILY") // "DAILY" (300 MAD/j) or "WEEKLY" (1800 MAD/Lundi)
  monthlyTripCount      Int             @default(0)
  currentArrearsMAD     Float           @default(0.00)
  defaultStage          String          @default("NOMINAL")
  consecutiveUnpaidDays Int             @default(0)
  lastPaymentDate       DateTime?
  lastDailyChargeDate   DateTime?
  assignedVehicleId     String?         @unique
  assignedVehicle       Vehicle?        @relation(fields: [assignedVehicleId], references: [id])
  tickets               SupportTicket[]
  payments              PaymentLedger[]
  accidentClaims        AccidentClaim[]
}

model VehicleExpense {
  id              String   @id @default(uuid())
  vehicle_id      String
  vehicle         Vehicle  @relation(fields: [vehicle_id], references: [id], onDelete: Cascade)
  plate_number    String
  category        String   // REPAIR, POLICE, MAINTENANCE, ACCIDENT, TOWING, PARKING, TIRES, ADMINISTRATIVE, OTHER
  amount_mad      Float    @default(0.0)
  description     String?
  invoice_number  String?
  paid_by         String   @default("COMPANY") // COMPANY, DRIVER, INSURANCE
  is_rechargeable Boolean  @default(false)
  paid_at         DateTime @default(now())
  recorded_by     String?
  status          String   @default("PAID")
  created_at      DateTime @default(now())
  updated_at      DateTime @default(now()) @updatedAt

  @@index([vehicle_id])
  @@index([plate_number])
  @@index([category])
}

model PaymentLedger {
  id          String        @id @default(uuid())
  driverId    String
  driver      DriverProfile @relation(fields: [driverId], references: [id], onDelete: Cascade)
  paymentDate DateTime      @default(now())
  expectedMAD Float         @default(0.0)
  clearedMAD  Float         @default(0.0)
  arrearsMAD  Float         @default(0.0)
  notes       String?
  loggedAt    DateTime      @default(now())
}

model DailyCollection {
  id              String   @id @default(uuid())
  date            DateTime
  collector_name  String
  expected_total  Float
  collected_total Float    @default(0.0)
  notes           String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}

model SupportTicket {
  id           String        @id @default(uuid())
  ticketNumber String        @unique
  category     String
  status       String        @default("OPEN")
  description  String
  driverId     String
  driver       DriverProfile @relation(fields: [driverId], references: [id])
  vehicleId    String
  vehicle      Vehicle       @relation(fields: [vehicleId], references: [id])
  assignedToId String?
  assignedTo   User?         @relation(fields: [assignedToId], references: [id])
  createdAt    DateTime      @default(now())
  resolvedAt   DateTime?
}

model FieldTask {
  id                      String    @id @default(uuid())
  task_type               String
  vehicle_id              String?
  plate_number            String?
  driver_name             String?
  driver_phone            String?
  description             String
  status                  String    @default("PENDING")
  priority                String    @default("Normal")
  failure_reason          String?
  linked_ticket_id        String?
  assigned_to             String?
  due_date                DateTime?
  completed_at            DateTime?
  has_key                 Boolean   @default(false)
  has_carte_grise         Boolean   @default(false)
  has_assurance           Boolean   @default(false)
  recovery_duration_hours Float?
  recovery_notes          String?
  created_at              DateTime  @default(now())
  updated_at              DateTime  @updatedAt
}

model FieldInspectionNew {
  id           String   @id @default(uuid())
  vehicleId    String
  vehicle      Vehicle  @relation(fields: [vehicleId], references: [id])
  inspectorId  String
  inspector    User     @relation(fields: [inspectorId], references: [id])
  vcrData      String
  odometerRead Int
  inspectedAt  DateTime @default(now())
}

model AccidentClaim {
  id           String         @id @default(uuid())
  vehicle_id   String
  vehicle      Vehicle        @relation(fields: [vehicle_id], references: [id])
  driver_id    String?
  driver       DriverProfile? @relation(fields: [driver_id], references: [id])
  driver_name  String?
  driver_phone String?
  severity     String?
  description  String
  created_at   DateTime       @default(now())
}

model Setting {
  key   String @id
  value String
}

model Blacklist {
  id              String @id @default(uuid())
  sanitized_phone String @unique
  reason          String
}
```

---

## 🛠️ 5. Database Connection & Sync Script

Create `src/lib/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function makePrismaClient() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const libsql = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Create `prisma/sync-db.ts` to automatically apply DDL statements and migrate SQLite/Turso tables:
```ts
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function syncSchema() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log("⚡ GoCab CRM — Connecting to DB:", url.startsWith("libsql://") ? "Turso Cloud" : "Local SQLite");

  const client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });

  const schemaPath = path.join(process.cwd(), "prisma", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const rawSql = fs.readFileSync(schemaPath, "utf-8");
    const statements = rawSql.split(";\n").map((s) => s.trim()).filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err: any) {
        if (!err.message.includes("already exists")) {
          console.warn("Schema execute warning:", err.message);
        }
      }
    }

    const migrations = [
      "ALTER TABLE DriverProfile ADD COLUMN consecutiveUnpaidDays INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE DriverProfile ADD COLUMN lastPaymentDate DATETIME",
      "ALTER TABLE DriverProfile ADD COLUMN lastDailyChargeDate DATETIME",
      "ALTER TABLE PaymentLedger ADD COLUMN paymentDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE PaymentLedger ADD COLUMN arrearsMAD REAL NOT NULL DEFAULT 0.0",
      "ALTER TABLE PaymentLedger ADD COLUMN notes TEXT",
    ];

    for (const migration of migrations) {
      try {
        await client.execute(migration);
      } catch (err) {}
    }

    console.log(`✅ Schema synced (${statements.length} DDL statements verified).`);
  }

  // Seed Default Ops Manager
  const email = "mouad.koudia@gocab.io";
  const passwordHash = await bcrypt.hash("Moulana@pc1995", 12);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
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
        },
      });
      console.log(`✨ Ops Manager created: ${email}`);
    }
  } catch (err: any) {
    console.error("Seed error:", err.message);
  }

  await prisma.$disconnect();
}

syncSchema().catch(console.error);
```

---

## 📡 6. Essential API Endpoints Checklist

Implement the following Next.js API route handlers in `src/app/api/`:

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/auth/[...nextauth]` | POST, GET | NextAuth session management and password check |
| `/api/reports/financial` | GET | Computes 250 DH/day opportunity loss, per-car breakdown, and agent targets |
| `/api/collections/driver-daily` | GET, POST | Driver daily clearing (300 DH Daily / 1800 DH Weekly), 3rd-day red alert |
| `/api/expenses` | GET, POST | Vehicle repairs, police impound, maintenance expense ledger (0 MAD support) |
| `/api/expenses/[id]` | GET, PATCH, DELETE | Update or delete individual vehicle expenses |
| `/api/upload-drivers` | POST | CSV parser: `Nom Complet`, `Telephone`, `CIN`, `Type Contrat`, `Immatriculation`, `Impayes MAD` |
| `/api/upload-vehicles` | POST | Vehicle CSV parser with auto driver matching & VIN detection |
| `/api/leads` & `/api/leads/[id]` | GET, POST, PATCH | Kanban leads pipeline & KYC checklist validation |
| `/api/drivers` & `/api/drivers/[id]` | GET, POST, PATCH, DELETE | Driver profiles & vehicle assignments |
| `/api/vehicles` & `/api/vehicles/[id]` | GET, POST, PATCH, DELETE | Fleet inventory & compliance inspection dates |

---

## 💻 7. UI Components Checklist

Ensure the following React components exist in `src/components/`:

1. **`KanbanBoard.tsx`**: Main application shell with navigation tabs, language switcher, user badge, and Dnd-kit Kanban boards for Leads & Training.
2. **`DashboardView.tsx`**: Executive Financial Command Center with:
   - 250 DH/day Inactivity Opportunity Loss Calculator
   - Critical Red Drivers Alert Card (3rd day unpaid)
   - Per-Vehicle Financial Breakdown Table with CSV Export
   - Department KPI Target & Variance Matrices
3. **`FleetPerformanceView.tsx`**: Driver Daily Payment Clearing Ledger:
   - Date picker with "Aujourd'hui" toggle
   - Expected today calculation (300 MAD Daily / 1800 MAD Weekly on Mondays)
   - Real-time payment entry and arrears recalculation
   - Flashing 🔴 **3rd-day red alert** with 1-click WhatsApp reminder generator
4. **`FleetView.tsx`**: Full car inventory table with compliance badges (Insurance, Vignette, Visite Tech), **`💸 Frais & Dépenses`** drawer, and CSV upload.
5. **`DriversView.tsx`**: Drivers list with contract pills, arrears tracking, and vehicle status.
6. **`DriverDrawer.tsx`**: Slide-over profile editor with **`Type de Paiement (DAILY vs WEEKLY)`** toggle and vehicle re-assignment.
7. **`AddExpenseModal.tsx`**: Modal for logging repair, police, or maintenance costs (allows 0 MAD and vehicle status recovery).
8. **`VehicleExpensesDrawer.tsx`**: Complete fleet financial ledger with category filters and total MAD spent.
9. **`DriverCSVUploader.tsx`** & **`VehicleCSVUploader.tsx`**: Drag & drop CSV uploaders with template downloads.

---

## 🌐 8. Multilingual Architecture (`LanguageContext.tsx`)

In `src/context/LanguageContext.tsx`, provide full dictionary entries for English, French, and Arabic. When switching to Arabic (`ar`), automatically apply `dir="rtl"` to `document.documentElement`.

---

## 🚀 9. Step-by-Step Instructions for Claude Code

When starting from an empty folder, execute the following steps in sequence:

```bash
# 1. Initialize Next.js project
npx create-next-app@latest gocab-crm --typescript --tailwind --eslint --app --src-dir

# 2. Install dependencies
npm install @prisma/client @prisma/adapter-libsql @libsql/client next-auth bcryptjs lucide-react recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities papaparse react-hot-toast clsx tailwind-merge
npm install -D prisma tsx @types/bcryptjs @types/papaparse

# 3. Generate Prisma client & sync schema
npx prisma generate
npx tsx prisma/sync-db.ts

# 4. Run development server
npm run dev -- -p 3001
```

---

*This specification is maintained and verified for GoCab Operations.*
