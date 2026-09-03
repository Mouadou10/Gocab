# GoCab Operations CRM — PostgreSQL Migration & Model Consolidation Guide

This technical guide details the migration pathway from SQLite (`dev.db`) to a managed PostgreSQL instance (e.g., Supabase, Neon, AWS RDS) and outlines the consolidation of legacy operational models.

---

## 1. Why Migrate to PostgreSQL?

1. **High Concurrency & Row-Level Locking**:
   - SQLite locks the entire database file on write operations.
   - When multiple Lead Acquisition agents, Fleet Performance collectors, and Field Supervisors make simultaneous mutations (dragging leads, uploading payment CSVs, logging vehicle inspections), SQLite can throw `database is locked` or timeout errors.
   - PostgreSQL provides fine-grained row-level locking (`SELECT ... FOR UPDATE`), transaction isolation levels, and non-blocking reads (`MVCC`).

2. **Serverless Connection Pooling**:
   - Vercel or containerized serverless runtimes create multiple transient Node.js processes.
   - PostgreSQL combined with **Prisma Accelerate** or **Supabase / PgBouncer** connection pooling avoids database connection exhaustion.

3. **Complex Analytical & Aggregation Queries**:
   - Native support for advanced date math, percentiles, sliding time windows, and JSON querying (`JSONB`).

---

## 2. Model Consolidation Plan

Currently, the schema contains overlapping legacy and command dashboard models:

| Legacy Model | Target Unified Model | Action Required |
| :--- | :--- | :--- |
| `MaintenanceTicket` | `SupportTicket` | Consolidate maintenance tickets into `SupportTicket` with foreign key relations to `DriverProfile` and `Vehicle`. |
| `VehicleInspection` | `FieldInspectionNew` | Unify checklist attributes into scored checkpoints and store detailed checklist metrics. |
| Loose Driver fields on `Vehicle` (`assigned_driver_name`, `assigned_driver_phone`) | `DriverProfile` relation (`assignedVehicleId`) | Deprecate denormalized string columns in favor of strict foreign key `assignedVehicleId` referencing `DriverProfile.id`. |

---

## 3. Step-by-Step PostgreSQL Migration Procedure

### Step 1: Provision Managed PostgreSQL
Create a database on Supabase, Neon, or Railway and obtain the connection strings:
```env
DATABASE_URL="postgres://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

### Step 2: Update `prisma/schema.prisma`
Change datasource provider:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Step 3: Run Database Migration
```bash
npx prisma migrate dev --name init_postgresql
```

### Step 4: Export & Import Existing SQLite Data
Export existing SQLite tables to JSON or CSV and seed them into PostgreSQL using Prisma client scripts:
```bash
npx tsx scripts/export-sqlite-to-pg.ts
```
