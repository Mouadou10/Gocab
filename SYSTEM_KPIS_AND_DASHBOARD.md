# GoCab Morocco: Team KPIs & Global Command Dashboard Specification

Target Environment: Antigravity IDE / Full-Stack Next.js + Prisma Implementation
Market Scope: Morocco Operations (Casablanca HQ + Regional Hubs: Casa, Marrakech, Tangier, Agadir)

## 1. Role-by-Role Individual KPI Engine
This section codifies the individual performance metrics, mathematical formulas, and system enforcement thresholds for each of the seven core operational roles across Level 1 (HQ) and Level 2 (Regional Hubs).

                                  
                                  │  Director of Operations  │
                                  └────────────┬─────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               ▼                                                               ▼
 ┌───────────────────────────┐                                   ┌───────────────────────────┐
 │   Casablanca National HQ  │                                   │       Regional Hubs       │
 │      (Central Group)      │                                   │  (Casa, Marrak., Tang, Ag) │
 └─────────────┬─────────────┘                                   └─────────────┬─────────────┘
               │                                                               │
 ├── Brand Manager                                               ├── Onboarding Specialist
 ├── Lead Acquisition Junior                                     ├── Field Supervisor (1:150)
 ├── Driver Support (1:150)                                      
 └── Fleet Performance Mgr (1:150)
 └── Senior Field Supervisor

### TIER 1: CASABLANCA NATIONAL HQ (CENTRAL GROUP FUNCTIONS)

#### 1. Brand Manager (Marketing & Traffic Lead)
Primary Objective: Drive national top-of-funnel inbound traffic, generate verified candidate leads, and build brand awareness.
KPI Thresholds:
- Lead-to-Training Target: $\ge 60\%$ of qualified inbound leads converted to booked training attendees.
- Cost Per Qualified Lead (CPQL): System benchmark established per regional campaign.
- Channel Engagement: Total monthly traffic volume and social audience growth.
Mathematical Calculation:
$$\text{Qualified Lead-to-Training Conversion Rate} = \left( \frac{\text{Total Leads Pushed to Scheduled Status}}{\text{Total Qualified Raw Leads Ingested}} \right) \times 100$$
System Enforcement: Automated alert to the Director of Operations if campaign conversion falls below 50% for 7 consecutive days.

#### 2. Lead Acquisition Junior (Outbound & Cold Outreach)
Primary Objective: Cold-call raw campaign leads, filter basic eligibility, book candidates into local integration training, and recycle dormant leads.
KPI Thresholds:
- Outreach Volume: 40 calls/day when available regional vehicle stock $\ge 20$ cars; 20 calls/day when stock $< 10$ cars.
- Booking Efficiency: $\ge 20\%$ conversion from calls to confirmed training appointments.
- Retargeting Conversion: Conversion rate of previously "Not Interested" or "No Show" profiles recycled back into active pipelines.
Mathematical Calculation:
$$\text{Cold Outreach Booking Rate} = \left( \frac{\text{Leads Marked 'Training Fixed'}}{\text{Total Outbound Calls Completed}} \right) \times 100$$

#### 3. Driver Support Specialist (Front-Office Service)
Capacity Ratio: 1 Specialist per 150 Active Vehicles.
Primary Objective: Resolve driver-submitted in-app tickets (vidange, AdBlue, mechanical issues), follow up on vehicle insurance claims, and route garage dispatches.
KPI Thresholds:
- SLA Response Rate: $\ge 95\%$ of tickets acknowledged and resolved/dispatched within 24 business hours.
- Average Fleet Downtime Contribution: Maintain an average fleet repair downtime of $\le 10$ days for in-garage vehicles.
Mathematical Calculation:
$$\text{Ticket SLA Adherence} = \left( \frac{\text{Tickets Resolved within 24 Hours}}{\text{Total Inbound Tickets Filed}} \right) \times 100$$
$$\text{Average Downtime (Days)} = \frac{\sum (\text{Vehicle Status Exit Timestamp} - \text{Vehicle Status Entry Timestamp for 'Garage ACC'})}{\text{Total Garage Incidents Completed}}$$

#### 4. Fleet Performance Manager (Back-Office Financial Control)
Capacity Ratio: 1 Manager per 150 Active Vehicles.
Primary Objective: Supervise driver support, track daily cash collections, audit ride-hailing platform (inDrive) trip quotas, and monitor churn.
KPI Thresholds:
- Daily Cash Collection Match: $\ge 60\%$ daily cash recovery against the active expected balance.
- Active Platform Utilization: $\ge 90\%$ of active drivers completing $\ge 300$ rides/month on the primary partner platform.
- Monthly Churn Boundary: Total contract terminations/resignations kept $\le 5\%$ per month.
Mathematical Calculations:
$$\text{Daily Cash Match Rate} = \left( \frac{\text{Total Cash Cleared \& Verified (MAD)}}{\text{Total Expected Daily Prepayment Ledger Balance (MAD)}} \right) \times 100$$
$$\text{Driver Activity Compliance} = \left( \frac{\text{Drivers Completing } \ge 300 \text{ Rides/Month}}{\text{Total Active Fleet Drivers}} \right) \times 100$$

### TIER 2: REGIONAL HUBS (LOCAL EXECUTION - CASA, MARRAKECH, TANGIER, AGADIR)

#### 5. Onboarding Specialist (Local Hub Conversion & KYC)
Primary Objective: Host in-person training sessions, execute strict physical KYC/compliance checks, sign contracts, and assign vehicles.
Eligibility Constraints Enforced: Minimum age 22+, Category B Driver's License seniority $> 2$ years, verifiable ride-hailing history, and clean criminal record.
KPI Thresholds:
- Training-to-Signature Conversion: High-efficiency conversion of training attendees into active signed contracts.
- KYC Accuracy: $100\%$ compliance (Zero document validation errors, zero unverified CIN/License uploads).
- Dynamic Scaling Target: Weekly conversion goals dynamically adjusted based on regional vehicle inventory.
Mathematical Calculation:
$$\text{Onboarding Conversion Rate} = \left( \frac{\text{Active Contracts Executed}}{\text{Total Training Attendees Logging Attendance}} \right) \times 100$$

#### 6. Field Supervisor (Ground Logistics & Asset Checks)
Capacity Ratio: 1 Supervisor per 150 Active Vehicles.
Primary Objective: Conduct monthly physical vehicle inspections, verify GPS hardware health, supervise partner workshop repairs on-site, and manage local inventory.
KPI Thresholds:
- GPS Connectivity Rate: $100\%$ of active vehicles streaming live GPS telematics with daily midnight odometer dumps.
- Physical Inspection Rate: $\ge 90\%$ of assigned active fleet physically inspected at least once per calendar month.
- Average Field Downtime Target: Maintain an average fleet downtime of $\le 10$ days.
Mathematical Calculation:
$$\text{Monthly Inspection Rate} = \left( \frac{\text{Unique Vehicles with Completed VCR Reports in Month}}{\text{Total Active Assigned Vehicles in Region}} \right) \times 100$$

#### 7. Senior Field Supervisor (Asset Recovery & Legal Representation)
Primary Objective: Manage the Field Supervisor team, execute remote telematics blocks and physical recovery for defaulted assets, and handle municipal administration (police impounds, Service des Mines).
KPI Thresholds:
- Asset Recovery Success Rate: $100\%$ recovery of telematically blocked or critically defaulted assets without physical property loss.
- Impound Turnaround Time: Immediate legal resolution and release of vehicles held in police impounds due to third-party platform checks.
Mathematical Calculation:
$$\text{Asset Recovery Rate} = \left( \frac{\text{Successfully Recovered \& Secured Defaulted Assets}}{\text{Total Telematics Block \& Take-Over Directives Issued}} \right) \times 100$$


## 2. Global Command Dashboard Specifications
The Global Command Dashboard serves as the centralized operational control center. It connects Level 1 HQ strategy directly to Level 2 Hub field actions via live data feeds.

  ┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        GOCAB MOROCCO: GLOBAL COMMAND DASHBOARD                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [EXECUTIVE SUMMARY]   [REGIONAL MATRIX]   [LIFECYCLE TRACKER]   [48H DEFAULT ENGINE]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TOTAL FLEET: 84 | UTILIZATION: 84.2% | ACTIVE DEBT: 250,000 MAD | GPS SYNC: 100%      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ REGIONAL HUBS STATUS:                                                                  │
│  • Casablanca Hub: 35 Active | 3 Garage ACC | 2 Available | Cash Match: 64%             │
│  • Marrakech Hub : 20 Active | 1 Garage ACC | 1 Available | Cash Match: 61%             │
│  • Tangier Hub   : 15 Active | 2 Accidente  | 0 Available | Cash Match: 58%             │
│  • Agadir Hub    : 14 Active | 0 Garage ACC | 1 Available | Cash Match: 62%             │
└────────────────────────────────────────────────────────────────────────────────────────┘

### Module 1: Executive Level 1 Overview (Macro View)
- Active Fleet Size & Utilization Rate: Real-time gauge comparing total owned vehicles against actively assigned assets.
- National Cash Reconciliation Feed: Live ledger comparing total expected daily cash against cleared funds (Target: $\ge 60\%$).
- National Platform Volume Feed: Aggregated inDrive API metrics tracking total completed trips across the national network.
- Global Churn & Downtime Counters: Monthly rolling average of driver contract terminations (Target: $<5\%$) and average vehicle downtime (Target: $\le 10$ days).

### Module 2: Regional Hub Matrix
A tabbed grid interface allowing filtering by Casablanca, Marrakech, Tangier, and Agadir:
- Local Inventory Counts: Real-time breakdown of cars by status (Actif, Disponible, Garage ACC, Accidente, Vol Declare).
- Regional Onboarding Funnel: Conversion rate from local training attendance to physical contract execution.
- Inspection Compliance Gauge: Percentage of regional vehicles inspected within the last 30 days (Target: $\ge 90\%$).

### Module 3: Live Asset Lifecycle Status Tracker
A dynamic data grid displaying all fleet assets alongside their current operational state:
Vehicle ID | Assigned Region | Driver Name | Operational Status | GPS Sync Status | Last Service (Vidange) | Risk Alert Level
--- | --- | --- | --- | --- | --- | ---
GOCAB-CAS-101 | Casablanca | Mohamed A. | ACTIF | Connected (Odo Dumped) | 6,200 / 8,000 KM | NOMINAL
GOCAB-RAK-204 | Marrakech | Youssef K. | GARAGE ACC | Static (Partner Workshop) | 8,010 KM (PENDING) | WARNING
GOCAB-TNG-309 | Tangier | Hamza B. | ACTIF | Connected | 4,100 / 8,000 KM | CRITICAL (Arrears)

### Module 4: The 48-Hour Default & Escalation Pipeline
A dedicated high-priority UI component tracking accounts in default:
- Day 1 Trigger: Automated system warning issued to the Driver App upon 1 unpaid day.
- Day 2 Trigger (Final Demand): System issues a 24-hour Final Demand Notice. Account moves to "Yellow Zone".
- 48-Hour Expiry (Telematic Block): System executes an automated remote engine ignition lock via telematics API. Account moves to "Red Zone".
- Recovery Dispatch: System automatically generates an urgent dispatch ticket for the Senior Field Supervisor containing the exact GPS coordinates for physical vehicle recovery.


## 3. Database Schema (Prisma ORM)
Below is the complete database structure required for Antigravity to build the backend logic, API routes, and dashboard hooks.

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  DIRECTOR_OF_OPS
  BRAND_MANAGER
  LEAD_ACQUISITION_JR
  DRIVER_SUPPORT
  FLEET_PERFORMANCE_MGR
  ONBOARDING_SPECIALIST
  FIELD_SUPERVISOR
  FIELD_SUPERVISOR_SENIOR
}

enum Region {
  CASABLANCA_HQ
  CASABLANCA_HUB
  MARRAKECH_HUB
  TANGIER_HUB
  AGADIR_HUB
}

enum VehicleStatus {
  ACTIF
  DISPONIBLE
  GARAGE_ACC
  ACCIDENTE
  VOL_DECLARE
  BLOCKED_DEFAULT
}

enum TicketStatus {
  OPEN
  DISPATCHED_WORKSHOP
  RESOLVED
  CLOSED
}

enum DefaultStage {
  NOMINAL
  DAY_1_WARNING
  DAY_2_FINAL_DEMAND
  TELEMATIC_BLOCK_EXECUTED
  RECOVERY_COMPLETED
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  fullName      String
  role          Role
  region        Region
  assignedCars  Int      @default(0) // Used to track 1:150 ratio compliance
  created_at    DateTime @default(now())

  tickets       SupportTicket[]
  inspections   FieldInspection[]
}

model DriverProfile {
  id                String        @id @default(uuid())
  cinNumber         String        @unique
  fullName          String
  phoneSanitized    String        @unique // Formatted +212...
  age               Int
  licenseSeniority  Int           // Years held
  isKycVerified     Boolean       @default(false)
  contractType      String        // "RENTAL" or "DRIVE_TO_OWN"
  monthlyTripCount  Int           @default(0) // Synced from inDrive API
  currentArrearsMAD Decimal       @default(0.00)
  defaultStage      DefaultStage  @default(NOMINAL)
  
  assignedVehicleId String?       @unique
  assignedVehicle   VehicleAsset? @relation(fields: [assignedVehicleId], references: [id])
  
  tickets           SupportTicket[]
  payments          PaymentLedger[]
}

model VehicleAsset {
  id                String        @id @default(uuid())
  vin               String        @unique
  registrationPlate String        @unique
  region            Region
  status            VehicleStatus @default(DISPONIBLE)
  
  // Compliance Parameters
  isInsuranceActive Boolean       @default(false)
  insuranceExpiry   DateTime
  vignetteExpiry    DateTime
  autorisationExpiry DateTime     // 30-day auto-renewal cycle
  
  // Telematics & Maintenance
  currentOdometerKM Int           @default(0)
  lastVidangeOdoKM  Int           @default(0) // Vidange due at lastVidangeOdoKM + 8000
  adBlueLevelPct    Int           @default(100)
  isGpsConnected    Boolean       @default(true)
  lastGpsPing       DateTime      @default(now())
  
  driver            DriverProfile?
  inspections       FieldInspection[]
  tickets           SupportTicket[]
}

model SupportTicket {
  id          String       @id @default(uuid())
  ticketNumber String      @unique
  category    String       // "VIDANGE", "ADBLUE", "MECHANICAL", "INSURANCE"
  status      TicketStatus @default(OPEN)
  description String
  
  driverId    String
  driver      DriverProfile @relation(fields: [driverId], references: [id])
  
  vehicleId   String
  vehicle     VehicleAsset  @relation(fields: [vehicleId], references: [id])
  
  assignedToId String?
  assignedTo   User?        @relation(fields: [assignedToId], references: [id])
  
  createdAt   DateTime     @default(now())
  resolvedAt  DateTime?
}

model FieldInspection {
  id            String       @id @default(uuid())
  vehicleId     String
  vehicle       VehicleAsset @relation(fields: [vehicleId], references: [id])
  
  inspectorId   String
  inspector     User         @relation(fields: [inspectorId], references: [id])
  
  vcrData       Json         // Interior/Exterior damage coordinates
  odometerRead  Int
  inspectedAt   DateTime     @default(now())
}

model PaymentLedger {
  id            String        @id @default(uuid())
  driverId      String
  driver        DriverProfile @relation(fields: [driverId], references: [id])
  
  expectedMAD   Decimal
  clearedMAD    Decimal
  loggedAt      DateTime      @default(now())
}
```

## 4. System Invariants & Enforcement Rules
To prevent operational drift, the Antigravity system architecture enforces these immutable rules database-side:
- Uninsured Vehicle Lock: The database blocks assigning any VehicleAsset to a DriverProfile if isInsuranceActive == false or insuranceExpiry < NOW().
- The 100% KYC Hard Gate: A lead cannot transition to Contract Eligible or receive a vehicle assignment unless isKycVerified == true and all three physical documents (CIN, License, Criminal Record) are stored in the database.
- Predictive Maintenance Auto-Trigger: A background cron job runs nightly at 00:00. If currentOdometerKM - lastVidangeOdoKM >= 8000, the system automatically generates an urgent SupportTicket with category "VIDANGE" and updates the vehicle risk level to WARNING.
- The 48-Hour Default Cascade: If a driver's currentArrearsMAD exceeds the threshold for 2 consecutive days, the system changes defaultStage to TELEMATIC_BLOCK_EXECUTED, issues an API call to the telematics provider to block ignition, and generates a recovery task assigned to the Senior Field Supervisor.
- Staffing Ratio Constraint: When adding assets to a region, if the total active vehicles assigned to a user role exceeds 150, the system flags an executive warning to deploy an additional staff member for that role.
