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

        // Master account direct authentication for Ops Manager
        const masterPassword = process.env.SEED_ADMIN_PASSWORD || "Moulana@pc1995";
        if (email === "mouad.koudia@gocab.io" && inputPassword === masterPassword) {
          try {
            let user = await prisma.user.findFirst({ where: { email } });
            if (!user) {
              const passwordHash = await bcrypt.hash(inputPassword, 12);
              user = await prisma.user.create({
                data: {
                  email: "mouad.koudia@gocab.io",
                  name: "Mouad Koudia",
                  fullName: "Mouad Koudia",
                  passwordHash,
                  role: "OPS_MANAGER",
                  region: "CASABLANCA",
                  isActive: true,
                  mustChangePassword: false,
                },
              });
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
              id: "ops-manager-master-id",
              name: "Mouad Koudia",
              email: "mouad.koudia@gocab.io",
              role: "OPS_MANAGER",
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
