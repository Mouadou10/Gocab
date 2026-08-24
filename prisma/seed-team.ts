/**
 * GoCab CRM — Team Seed Script (Sprint 1)
 * 
 * Uses the app's prisma.ts adapter-based client (required for Prisma v7 with driver adapters).
 * Run: npx tsx prisma/seed-team.ts
 */

import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "GoCab2024!";

const TEAM_MEMBERS = [
  {
    email: "mouad.koudia@gocab.io",
    name: "Mouad Koudia",
    fullName: "Mouad Koudia",
    role: "OPS_MANAGER",
    region: "CASABLANCA",
    password: "Moulana@pc1995",
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
        data: { ...memberData, passwordHash, mustChangePassword, isActive: true },
      });
      console.log(`✅ Updated:  ${member.email} (${member.role})`);
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
