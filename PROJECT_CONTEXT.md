# GoCab Morocco: Project & Business Context
**Document Purpose:** To provide architectural and operational context for autonomous AI development (Antigravity).

## 1. Business Overview
GoCab is a B2B asset fleet operator based in Morocco, not a consumer-facing ride-hailing app. 
* **The Model:** We provide physical vehicles to drivers under two contract types: **Rental** (open-ended) and **Drive-to-Own** (52-month amortization track).
* **The Operation:** Drivers use our fleet to complete trips on third-party platforms (primarily inDrive). 
* **Operational KPI:** Drivers are mandated to complete a minimum of 300 rides per month and maintain strict daily or weekly prepayment financial discipline.
* **Core Philosophy:** All operational decisions and system triggers are based on strict data constraints and automated logic, eliminating manual intervention and human error.

## 2. Organizational Structure
The system supports a two-tier operational hierarchy scaling dynamically on a **1-to-150 vehicle ratio**. The software must accommodate role-based access control (RBAC) across these departments:

### Tier 1: Casablanca National HQ (Digital & Central)
* **Brand Manager:** Top-of-funnel marketing and lead generation.
* **Lead Acquisition Junior:** Mid-funnel cold-calling and training scheduling.
* **Driver Support Team:** In-app ticket resolution (maintenance, insurance).
* **Fleet Performance Manager:** Financial reconciliation, API ride-tracking, and escalation authorization.

### Tier 2: Regional Hubs (Physical Execution in Casa, Marrakech, Tangier, Agadir)
* **Onboarding Specialist:** Physical KYC verification and contract execution.
* **Field Supervisor:** Asset tracking, Vehicle Condition Reports (VCR), and garage maintenance oversight.
* **Field Supervisor Senior:** Physical recovery of telematically blocked vehicles and legal representation.

## 3. Technology Stack
* **Frontend:** Next.js (App Router), React, Tailwind CSS.
* **UI/UX Elements:** Drag-and-drop Kanban boards (e.g., dnd-kit), interactive Modals.
* **Backend:** Next.js API Routes (Node.js environment).
* **Database:** PostgreSQL / SQLite.
* **ORM:** Prisma.
* **Brand Palette:** Navy Blue (`#2C4E8C`) for primary elements/headers, Olive Green (`#5B6C28`) for success states and active contracts.

---

## 4. Active Project: Module 1 - Growth & KYC CRM
**Current Status:** In Development.
**Description:** A full-stack Kanban-style CRM to process raw driver leads into legally verified, contract-eligible profiles.

### Core Features & Logic Flows:
1. **CSV Ingestion & Sanitization:**
   - Ingests raw CSV data (`Date Received`, `Lead Name`, `Phone Number`).
   - Runs a regex formatting script to strip spaces/dashes and prepend the Moroccan `+212` country code.
   - Executes a deduplication check against the `Lead` database and a security check against the `Blacklist` database.
2. **The Kanban Board UI:**
   - Columns: `New Leads` ➔ `Brand Pre-Filter` ➔ `Training Pipeline` ➔ `Vehicle Assignment`.
3. **Automated WhatsApp Routing:**
   - When a lead is scheduled for training, the system evaluates the selected calendar date.
   - **Rule:** Mon-Thu selections generate a WhatsApp API link for a 3:00 PM session. Friday selections generate an 11:00 AM session.
4. **The KYC Hard-Lock:**
   - To move a lead to `Vehicle Assignment`, the Onboarding Specialist must upload three mandatory documents (CIN, Driving License, Criminal Record) and check a boolean `KYC_Verified` flag.

---

## 5. Future Roadmap (Upcoming Antigravity Projects)

### Module 2: Fleet Assignment & Field Compliance
* **Objective:** Pair eligible drivers with available vehicles.
* **Constraints:** Hard-stop logic preventing vehicle assignment if the database registers the car's insurance or *Autorisation de Circulation* as expired. 
* **Feature:** Digital Vehicle Condition Report (VCR) capture for handover baselines.

### Module 3: In-Life Operations & Driver Support Ticket System
* **Status:** Implemented & Live.
* **Objective:** Manage active fleet maintenance, driver calls/WhatsApp support requests, vehicle statuses, downtime tracking, and rental payment waivers.
* **Vehicle Operational Statuses:** `Available`, `Actif`, `In garage`, `In service`, `Accident`, `impounded by police`.
* **Support Ticket Types:** `Vidange` (Oil change), `AdBleu` (AdBlue refill), `Repair` (Mechanical repair), `Accident` (Accident / Insurance).
* **Live Downtime Counter:** Real-time calculation of elapsed days/hours/minutes per ticket to quantify vehicle downtime.
* **Fleet Performance Payment Waiver Tool:** Allows managers to evaluate total downtime and record a **Payment Day Cancellation / Waiver** (`waived_days`, `waiver_reason`) directly on the ticket.
* **Auto Status Restoration:** Resolving a maintenance ticket automatically restores the vehicle operational status back to `Actif` (or `Available`).

### Module 4: The Financial Escalation Engine
* **Objective:** Automate debt recovery without manual agent intervention.
* **Feature 1:** 48-Hour Default Aging. If a driver misses a payment, the system auto-fires a 24-hour Final Demand Notice.
* **Feature 2:** Telematics Block. Upon grace period expiry, the system securely authorizes the Senior Field Supervisor to remotely disable the vehicle ignition via API.
* **Feature 3:** The "3-Strike" Loop Bypass. Repeat offenders automatically skip warning phases and route directly to vehicle recovery.
