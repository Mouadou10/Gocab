/**
 * GoCab CRM — Restore All 10 Core Team Members and Role Access
 * Run: npx tsx scripts/restore-all-users-and-access.ts
 */

import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const DEFAULT_TEAM_MEMBERS = [
  {
    email: "mouad.koudia@gocab.io",
    name: "Mouad Koudia",
    fullName: "Mouad Koudia",
    role: "OPS_MANAGER",
    region: "CASABLANCA",
    pass: "Moulana@pc1995",
  },
  {
    email: "kurbankerimov@gocab.io",
    name: "Kurban Kerimov",
    fullName: "Kurban Kerimov",
    role: "OPS_MANAGER",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
  {
    email: "kaoutar.ouardi@gocab.io",
    name: "Kaoutar Ouardi",
    fullName: "Kaoutar Ouardi",
    role: "LEAD_ACQUISITION_JR",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
  {
    email: "nour.abouri@gocab.io",
    name: "Nour Abouri",
    fullName: "Nour Abouri",
    role: "LEAD_ACQUISITION_JR",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
  {
    email: "salma.abouri@gocab.io",
    name: "Salma Abouri",
    fullName: "Salma Abouri",
    role: "LEAD_ACQUISITION_JR",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
  {
    email: "ayoub.gsaib@gocab.io",
    name: "Ayoub Gsaib",
    fullName: "Ayoub Gsaib",
    role: "ONBOARDING_SPECIALIST",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
  {
    email: "mohamed.aziz@gocab.io",
    name: "Mohamed Aziz",
    fullName: "Mohamed Aziz",
    role: "FLEET_PERF_MANAGER",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
  {
    email: "mehdi.elyattouti@gocab.io",
    name: "Mehdi Elyattouti",
    fullName: "Mehdi Elyattouti",
    role: "FLEET_PERF_MANAGER",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
  {
    email: "hamza.rassid@gocab.io",
    name: "Hamza Rassid",
    fullName: "Hamza Rassid",
    role: "FIELD_SUPERVISOR",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
  {
    email: "ayoub.rassid@gocab.io",
    name: "Ayoub Rassid",
    fullName: "Ayoub Rassid",
    role: "FIELD_SUPERVISOR",
    region: "CASABLANCA",
    pass: "GoCab2024!",
  },
];

const COMPREHENSIVE_ROLE_PERMISSIONS = {
  LEAD_ACQUISITION_JR: ["dashboard", "kpi-dashboard", "leads", "training", "drivers", "flagged-drivers", "whatsapp"],
  BRAND_MANAGER: ["dashboard", "kpi-dashboard", "leads", "training", "drivers", "flagged-drivers", "whatsapp"],
  ONBOARDING_SPECIALIST: ["dashboard", "kpi-dashboard", "leads", "training", "drivers", "flagged-drivers", "fleet", "whatsapp"],
  FLEET_PERF_MANAGER: ["dashboard", "kpi-dashboard", "drivers", "flagged-drivers", "fleet", "vehicle-ops", "tickets", "performance", "insurance", "whatsapp"],
  FIELD_SUPERVISOR: ["dashboard", "kpi-dashboard", "drivers", "flagged-drivers", "fleet", "vehicle-ops", "field", "field-missions", "tickets", "whatsapp"],
  FINANCE_OFFICER: ["dashboard", "kpi-dashboard", "drivers", "flagged-drivers", "vehicle-ops", "performance", "insurance", "whatsapp"],
  OPS_MANAGER: ["dashboard", "kpi-dashboard", "leads", "training", "drivers", "flagged-drivers", "fleet", "vehicle-ops", "tickets", "performance", "field", "field-missions", "insurance", "whatsapp", "settings"],
  ADMIN: ["dashboard", "kpi-dashboard", "leads", "training", "drivers", "flagged-drivers", "fleet", "vehicle-ops", "tickets", "performance", "field", "field-missions", "insurance", "whatsapp", "settings"],
};

async function main() {
  console.log("==========================================");
  console.log("Restoring all 10 GoCab Team Members & Access");
  console.log("==========================================\n");

  for (const m of DEFAULT_TEAM_MEMBERS) {
    const existing = await prisma.user.findFirst({
      where: { email: m.email },
    });

    const passwordHash = await bcrypt.hash(m.pass, 12);

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: m.name,
          fullName: m.fullName,
          role: existing.role || m.role,
          region: m.region,
          isActive: true,
          passwordHash,
        },
      });
      console.log(`✅ Verified/Updated: ${m.name.padEnd(18)} (${m.email.padEnd(28)}) → ${existing.role || m.role}`);
    } else {
      await prisma.user.create({
        data: {
          email: m.email,
          name: m.name,
          fullName: m.fullName,
          role: m.role,
          region: m.region,
          passwordHash,
          isActive: true,
          mustChangePassword: false,
        },
      });
      console.log(`✨ Created Account:   ${m.name.padEnd(18)} (${m.email.padEnd(28)}) → ${m.role}`);
    }
  }

  // Update role_tab_permissions in Setting table
  const existingPerms = await prisma.setting.findUnique({
    where: { key: "role_tab_permissions" },
  });

  const permsJson = JSON.stringify(COMPREHENSIVE_ROLE_PERMISSIONS);
  if (existingPerms) {
    await prisma.setting.update({
      where: { key: "role_tab_permissions" },
      data: { value: permsJson },
    });
    console.log("\n✅ Updated role_tab_permissions in Setting table");
  } else {
    await prisma.setting.create({
      data: {
        key: "role_tab_permissions",
        value: permsJson,
      },
    });
    console.log("\n✨ Created role_tab_permissions in Setting table");
  }

  const allUsers = await prisma.user.findMany({
    orderBy: { created_at: "asc" },
  });
  console.log(`\n🎉 Total Team Members in Database: ${allUsers.length}`);
  allUsers.forEach((u, i) => {
    console.log(`   ${i + 1}. ${u.name.padEnd(18)} | ${u.email.padEnd(28)} | ${u.role}`);
  });
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
