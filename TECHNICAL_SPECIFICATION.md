# GoCab CRM: Full Technical Specification & Workflow Logic

This document details the complete end-to-end architecture, frontend component logic, backend API structures, and automated workflows powering the GoCab CRM.

---

## 1. System Architecture Overview

The system is built on a modern, full-stack JavaScript architecture using:
- **Frontend Framework:** Next.js 14 (App Router)
- **UI Library:** React (Server Components + Client Components)
- **Styling:** Tailwind CSS
- **Backend / API:** Next.js Route Handlers (`src/app/api/...`)
- **Database ORM:** Prisma
- **Database Engine:** SQLite (configured for Sync/Dev environments)

---

## 2. Database Schema (Prisma Logic)

The data layer is highly relational, connecting physical assets (Vehicles) to human resources (Drivers) and operational events (Tickets, Claims, Tasks).

### Core Models:
1. **`Vehicle`**: The central asset. Tracks `status` (Available, Actif, Accident, In garage, etc.), `current_mileage`, and compliance expiries (`insurance_expiry_date`, `vignette_expiry_date`).
2. **`DriverProfile`**: Tracks KYC status, contact info, and is linked 1-to-1 with a `Vehicle` when active (`assignedVehicleId`).
3. **`SupportTicket`**: Tracks maintenance and driver issues. Links to a `Vehicle` and `DriverProfile`.
4. **`AccidentClaim`**: Tracks vehicles involved in accidents. Tracks `severity`, `fault`, and the `timeline_step` (e.g., Car in Garage, Ready for Pickup).
5. **`FieldTask`**: Dispatched jobs for the Field Supervisor. Includes task `type` (e.g., GARAGE_PICKUP, RECOVERY) and `status` (PENDING, IN_PROGRESS, COMPLETED).

---

## 3. Frontend Detail Logic

The user interface is broken down into distinct departmental views, managed largely within the `src/components/` directory.

### A. Leads & Training (KanbanBoard.tsx)
- **State Management:** Uses `@hello-pangea/dnd` for drag-and-drop functionality.
- **Data Fetching:** Polls `/api/leads` and organizes leads into columns based on `status`.
- **Frontend Logic:** 
  - When a card is dragged to a new column, the frontend optimistic UI immediately updates the card's position.
  - A `PATCH /api/leads/[id]` request is fired in the background to persist the new `status`.
  - The Daily Progress scorecard calculates completion by mapping through leads where `status_changed_at` matches the current date.

### B. Fleet Management (FleetView.tsx & VehicleDrawer.tsx)
- **State Management:** Uses standard React state for filtering (by Hub, Status, Search Term).
- **Compliance Logic:** The frontend iterates over vehicle expiry dates (Insurance, Vignette, etc.). If `expiryDate < Date.now()`, it pushes the vehicle to an `expiredItems` array, rendering a red critical alert banner. If the date is within 30 days, it renders a yellow warning banner.
- **Quick Status Edit:** A dropdown inline in the table allows instant `PATCH /api/vehicles/[id]` requests to update operational status.

### C. Insurance Module (InsuranceView.tsx & AccidentCard.tsx)
- **Frontend Logic:** Fetches `AccidentClaim` records and joins them with `Vehicle` data.
- **Timeline Engine:** The `AccidentCard` component renders a visual timeline. Clicking "Next Phase" sends a `PATCH /api/accidents/[id]` request to advance the `timeline_step`.
- **History Calculation:** When a fault is marked as "DRIVER", the frontend queries historical claims to display "Driver Fault: X times" to help insurance agents make rapid decisions.

### D. Field Supervisor (FieldSupervisorView.tsx)
- **Frontend Logic:** Fetches `FieldTask` records. Organizes them by status (Pending vs Completed).
- **Completion Logic:** When a supervisor clicks "Mark Completed", a `PATCH /api/field-tasks/[id]` request is sent, triggering backend automations.

---

## 4. Backend Detail Logic & API Routes

The backend APIs handle data persistence and house the "Automation Engine" that triggers side-effects across departments.

### A. Lead Handoff (`PATCH /api/leads/[id]`)
- **Action:** Updates lead status.
- **Automation:** If the status changes, the backend automatically updates `status_changed_at = now()`. This ensures the scorecard accurately reflects daily work.

### B. Fleet & Accident Auto-Generation (`PATCH /api/vehicles/[id]`)
- **Action:** Updates vehicle metadata or status.
- **Automation:** 
  - If `body.status === "Accident"`, the backend checks if an active `AccidentClaim` already exists for this vehicle.
  - If not, it automatically executes `prisma.accidentClaim.create()`.
  - This guarantees that no vehicle can be marked "Accident" in the Fleet without the Insurance department being notified.

### C. Ticket-to-Accident Handoff (`POST /api/tickets`)
- **Action:** Creates a new support ticket.
- **Automation:** 
  - If the ticket `category === "Accident"`, the API simultaneously executes `prisma.vehicle.update({ status: 'Accident' })`.
  - This cascades into the rule above, spawning the Insurance claim automatically.

### D. Insurance-to-Field Handoff (`PATCH /api/accidents/[id]`)
- **Action:** Advances the repair timeline of an accident claim.
- **Automation:** 
  - If the `timeline_step` is updated to `READY_FOR_PICKUP`, the backend executes `prisma.fieldTask.create()`.
  - The task type is set to `GARAGE_PICKUP`, referencing the vehicle ID, instantly alerting the Field Supervisor.

### E. Field-to-Fleet Restoration (`PATCH /api/field-tasks/[id]`)
- **Action:** Marks a field task as COMPLETED.
- **Automation:** 
  - The backend inspects the task `type`. If it is `GARAGE_PICKUP`:
    1. It finds the active `AccidentClaim` for the vehicle and updates its `timeline_step` to `VEHICLE_BACK`.
    2. It updates the `Vehicle` operational `status` back to `Available`.
  - This closes the loop without human data entry—the moment the supervisor confirms pickup on their tablet, the fleet manager sees the car as Available.

---

## 5. Security & Invariants
- **Referential Integrity:** Enforced by Prisma. A Ticket cannot exist without a valid Vehicle ID.
- **State Protection:** Claims cannot be bypassed. A vehicle in an Accident state cannot be assigned to a driver until the `AccidentClaim` reaches `VEHICLE_BACK`.
