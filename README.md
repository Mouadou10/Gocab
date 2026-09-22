# 🚖 GoCab CRM & Operations Platform

> **Production-grade Operations, Fleet Management, and Driver Acquisition Platform for GoCab Morocco.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.9-2D3748?logo=prisma)](https://www.prisma.io/)
[![Turso](https://img.shields.io/badge/Turso-LibSQL-00FFE0?logo=turso)](https://turso.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

---

## 📖 Complete Technical Documentation

For the full architectural breakdown, data models, API catalog, security specifications, and performance engineering details for the technical team, see:

👉 **[Complete Technical Documentation (`docs/TECHNICAL_DOCUMENTATION.md`)](docs/TECHNICAL_DOCUMENTATION.md)**

---

## ⚡ Key Highlights

* **12 Integrated Functional Modules**:
  1. **Executive Dashboard**: Real-time business KPIs and interactive 3D fleet vehicle visualizer (Three.js / React Three Fiber).
  2. **Power BI KPI Analytics**: Multi-dimensional performance analytics, loss ratio analysis, and collection vs target metrics.
  3. **Lead Acquisition CRM**: Full Kanban workflow with Moroccan phone formatting (`+212`), duplicate checks, activity logs, and automated recalls.
  4. **Training & Onboarding**: Candidate session scheduling, preorder deposit accounting, and **KYC Hard-Lock** verification (CIN, Permis 2+ years, Fiche anthropométrique, Justificatif d'adresse).
  5. **Chauffeurs Directory**: Driver profiles, daily contracts, arrears accounting, and instantaneous 0ms client-side cached tab switching.
  6. **Flotte (Fleet Assets)**: Vehicle asset registry, live status (`Available`, `ACTIF`, `In garage`, `Accident`, etc.), downtime tracking, and regulatory expirations (Insurance, Vignette, Visite technique, Autorisation).
  7. **Support & Maintenance Tickets**: 24-hour SLA countdown, mechanical downtime tracking, and Fleet Performance Payment Waiver Tool.
  8. **Fleet Performance & Collections**: Daily cash collection tracking by agent, period date range filtering, and arrears reconciliation.
  9. **Field Operations**: Field supervisor mobile tasks, vehicle pickup handoffs, and digital vehicle condition reports (VCR).
  10. **Insurance & Accident Claims**: Claims lifecycle tracking, driver fault history, and repair garage dispatching.
  11. **WhatsApp Operations Hub**: Meta WhatsApp Cloud API webhooks, two-way live messaging, automated multi-lingual templates, and WhatsApp Web linking.
  12. **Settings & RBAC**: Role-based tab access matrix, team member provisioning, and password change enforcement.

---

## 🚀 Getting Started

### Prerequisites
* Node.js `>= 20.0.0`
* npm / pnpm / yarn

### Installation & Local Development

```bash
# 1. Clone repository
git clone https://github.com/Mouadou10/Gocab.git
cd Gocab

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Set TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, NEXTAUTH_SECRET

# 4. Generate Prisma Client & Sync DB
npm run build

# 5. Start Development Server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Verification & Scripts

```bash
# Run TypeScript typecheck (0 errors)
npx tsc --noEmit

# Inspect database with Prisma Studio
npx prisma studio

# Seed initial operational accounts
npm run db:seed
```

---

## 🔒 Tech Stack & Architecture

* **Framework:** Next.js 16 (App Router), React 19, TypeScript
* **Database:** Turso Cloud (Distributed LibSQL / SQLite Engine) via `@prisma/adapter-libsql`
* **ORM:** Prisma Client v7
* **Authentication:** NextAuth.js v5 (Auth.js) with JWT session cookies and edge middleware guards
* **Styling:** Tailwind CSS v4
* **Deployment:** Vercel (Edge & Serverless execution)

---

*© 2026 GoCab Morocco. All rights reserved.*
