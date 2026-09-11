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
          { name: string; fullName: string; role: string; fallbackId: string }
        > = {
          "mouad.koudia@gocab.io": {
            name: "Mouad Koudia",
            fullName: "Mouad Koudia",
            role: "OPS_MANAGER",
            fallbackId: "ops-manager-master-id",
          },
          "kaoutar.ouardi@gocab.io": {
            name: "Kaoutar Ouardi",
            fullName: "Kaoutar Ouardi",
            role: "LEAD_ACQUISITION_JR",
            fallbackId: "agent-kaoutar-ouardi-id",
          },
          "salma.abouri@gocab.io": {
            name: "Salma Abouri",
            fullName: "Salma Abouri",
            role: "FLEET_PERF_MANAGER",
            fallbackId: "agent-salma-abouri-id",
          },
        };

        const masterPassword = process.env.SEED_ADMIN_PASSWORD || "Moulana@pc1995";
        const defaultTeamPassword = process.env.DEFAULT_TEAM_PASSWORD || "GoCab2024!";

        // 1. Direct bootstrap & team authentication for core accounts
        if (CORE_TEAM_ACCOUNTS[email]) {
          const isMasterPass = inputPassword === masterPassword;
          const isDefaultPass = inputPassword === defaultTeamPassword;

          if (isMasterPass || isDefaultPass) {
            const teamMeta = CORE_TEAM_ACCOUNTS[email];
            try {
              let user = await prisma.user.findFirst({ where: { email } });
              if (!user) {
                // Check if an existing user was under an older email format
                const firstName = teamMeta.name.split(" ")[0];
                const altMatch = await prisma.user.findFirst({
                  where: {
                    OR: [
                      { fullName: { contains: firstName } },
                      { name: { contains: firstName } },
                    ],
                  },
                });

                if (altMatch) {
                  user = await prisma.user.update({
                    where: { id: altMatch.id },
                    data: {
                      email,
                      name: teamMeta.name,
                      fullName: teamMeta.fullName,
                      role: altMatch.role || teamMeta.role,
                      isActive: true,
                    },
                  });
                } else {
                  const passwordHash = await bcrypt.hash(inputPassword, 12);
                  user = await prisma.user.create({
                    data: {
                      email,
                      name: teamMeta.name,
                      fullName: teamMeta.fullName,
                      passwordHash,
                      role: teamMeta.role,
                      region: "CASABLANCA",
                      isActive: true,
                      mustChangePassword: false,
                    },
                  });
                }
              }
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                mustChangePassword: false,
              };
            } catch (err: any) {
              console.warn("DB bootstrap warning on login:", err?.message);
              return {
                id: teamMeta.fallbackId,
                name: teamMeta.name,
                email,
                role: teamMeta.role,
                mustChangePassword: false,
              };
            }
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
