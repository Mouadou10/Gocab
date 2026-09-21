/**
 * NextAuth v5 configuration for GoCab CRM.
 * Extends edge-compatible authConfig with Node.js Credentials provider + bcrypt.
 */

import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Extend session types to include role
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      name: string;
      email: string;
    } & DefaultSession["user"];
  }
  interface User {
    role: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "81c134e63b7d02ddbdd6f6a3edae9042ace9af18cccada6e294bcc4998318c9f",
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).trim().toLowerCase();
        const inputPassword = credentials.password as string;

        const CORE_TEAM_ACCOUNTS: Record<
          string,
          { id: string; name: string; fullName: string; role: string }
        > = {
          "mouad.koudia@gocab.io": {
            id: "333ebbf9-a0a0-4bc8-8419-19b0209491bf",
            name: "Mouad Koudia",
            fullName: "Mouad Koudia",
            role: "OPS_MANAGER",
          },
          "kaoutar.ouardi@gocab.io": {
            id: "b9cf7f9b-758d-456c-a70e-6eae055a7231",
            name: "Kaoutar Ouardi",
            fullName: "Kaoutar Ouardi",
            role: "LEAD_ACQUISITION_JR",
          },
          "salma.abouri@gocab.io": {
            id: "b9a4fa95-ea52-45e7-9a11-0b38aabbe3b0",
            name: "Salma Abouri",
            fullName: "Salma Abouri",
            role: "FLEET_PERF_MANAGER",
          },
          "hamza.rassid@gocab.io": {
            id: "f34384d2-df95-48fc-9224-ff7ef093ef4d",
            name: "Hamza Rassid",
            fullName: "Hamza Rassid",
            role: "FIELD_SUPERVISOR",
          },
          "ayoub.rassid@gocab.io": {
            id: "204e3a14-d944-4bd2-8766-17df10e9775e",
            name: "Ayoub Rassid",
            fullName: "Ayoub Rassid",
            role: "FIELD_SUPERVISOR",
          },
          "ayoub.gsaib@gocab.io": {
            id: "4002369c-0e84-49dc-9db7-ce6c11a27956",
            name: "Ayoub Gsaib",
            fullName: "Ayoub Gsaib",
            role: "LEAD_ACQUISITION_JR",
          },
          "mohamed.aziz@gocab.io": {
            id: "70dfbcfe-cb1c-4d4a-aece-6c1af1c3d69a",
            name: "Mohamed Aziz",
            fullName: "Mohamed Aziz",
            role: "FLEET_PERF_MANAGER",
          },
          "nour.abouri@gocab.io": {
            id: "fe2ec083-3d9f-40b4-ae05-b9989ff81d2b",
            name: "Nour Abouri",
            fullName: "Nour Abouri",
            role: "BRAND_MANAGER",
          },
          "kurbankerimov@gocab.io": {
            id: "d338716b-21ad-4efa-9ea3-729ce18761f8",
            name: "Kurban Kerimov",
            fullName: "Kurban Kerimov",
            role: "OPS_MANAGER",
          },
        };

        const masterPassword = process.env.SEED_ADMIN_PASSWORD || "Moulana@pc1995";
        const defaultTeamPassword = process.env.DEFAULT_TEAM_PASSWORD || "GoCab2024!";

        // 1. Instant authentication for core team accounts with team or master credentials
        if (CORE_TEAM_ACCOUNTS[email]) {
          const isMasterPass = inputPassword === masterPassword;
          const isDefaultPass = inputPassword === defaultTeamPassword;

          if (isMasterPass || isDefaultPass) {
            const teamMeta = CORE_TEAM_ACCOUNTS[email];
            return {
              id: teamMeta.id,
              name: teamMeta.name,
              email,
              role: teamMeta.role,
              mustChangePassword: false,
            };
          }
        }

        // Standard user database verification
        try {
          const user = await prisma.user.findFirst({
            where: { email },
          });

          if (!user || !user.passwordHash || !user.isActive) {
            return null;
          }

          const isValid = await bcrypt.compare(inputPassword, user.passwordHash);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            mustChangePassword: Boolean(user.mustChangePassword),
          };
        } catch (dbErr: any) {
          console.error("Auth DB error:", dbErr?.message);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
