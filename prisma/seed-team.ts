/**
 * GoCab CRM — Team Seed Script (Sprint 1)
 * 
 * Uses the app's prisma.ts adapter-based client (required for Prisma v7 with driver adapters).
 * Run: npx tsx prisma/seed-team.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { prisma } = require("../src/lib/prisma");
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "GoCab2024!";

const TEAM_MEMBERS = [
  {
    email: "mouad.koudia@gocab.io",
    name: "Mouad Koudia",
    fullName: "Mouad Koudia",
    role: "OPS_MANAGER",
    region: "CASABLANCA",
    password: process.env.SEED_ADMIN_PASSWORD || "Moulana@pc1995",
  },
  {
    email: "kurbankerimov@gocab.io",
    name: "Kurban Kerimov",
    fullName: "Kurban Kerimov",
    role: "OPS_MANAGER",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
  {
    email: "kaoutar.ouardi@gocab.io",
    name: "Kaoutar Ouardi",
    fullName: "Kaoutar Ouardi",
    role: "LEAD_ACQUISITION_JR",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
  {
    email: "nour.abouri@gocab.io",
    name: "Nour Abouri",
    fullName: "Nour Abouri",
    role: "LEAD_ACQUISITION_JR",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
  {
    email: "salma.abouri@gocab.io",
    name: "Salma Abouri",
    fullName: "Salma Abouri",
    role: "LEAD_ACQUISITION_JR",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
  {
    email: "ayoub.gsaib@gocab.io",
    name: "Ayoub Gsaib",
    fullName: "Ayoub Gsaib",
    role: "ONBOARDING_SPECIALIST",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
  {
    email: "mohamed.aziz@gocab.io",
    name: "Mohamed Aziz",
    fullName: "Mohamed Aziz",
    role: "FLEET_PERF_MANAGER",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
  {
    email: "mehdi.elyattouti@gocab.io",
    name: "Mehdi Elyattouti",
    fullName: "Mehdi Elyattouti",
    role: "FLEET_PERF_MANAGER",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
  {
    email: "hamza.rassid@gocab.io",
    name: "Hamza Rassid",
    fullName: "Hamza Rassid",
    role: "FIELD_SUPERVISOR",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
  {
    email: "ayoub.rassid@gocab.io",
    name: "Ayoub Rassid",
    fullName: "Ayoub Rassid",
    role: "FIELD_SUPERVISOR",
    region: "CASABLANCA",
    password: process.env.SEED_AGENT_PASSWORD || "GoCab2024!",
  },
];

async function main() {
  console.log("🌱 GoCab CRM — Team Seed Script");
  console.log("================================\n");

  for (const member of TEAM_MEMBERS) {
    const rawPass = (member as any).password || DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(rawPass, 12);
    const mustChangePassword = !(member as any).password; // true if using default password
    const { password, ...memberData } = member as any;

    const existing = await prisma.user.findUnique({
      where: { email: member.email },
    });

    if (existing) {
      await prisma.user.update({
        where: { email: member.email },
        data: { ...memberData, role: existing.role || member.role, passwordHash, mustChangePassword, isActive: true },
      });
      console.log(`✅ Updated:  ${member.email} (${existing.role || member.role})`);
    } else {
      await prisma.user.create({
        data: { ...memberData, passwordHash, mustChangePassword, isActive: true },
      });
      console.log(`✨ Created:  ${member.email} (${member.role})`);
    }
  }

  console.log("\n================================");
  console.log(`🔐 Default password: ${DEFAULT_PASSWORD}`);
  console.log("\n📋 Team Accounts:");
  TEAM_MEMBERS.forEach((m) => {
    console.log(`   ${m.email.padEnd(35)} → ${m.role}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
