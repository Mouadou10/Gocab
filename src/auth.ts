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
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "gocab-ops-secret-key-2026-mouad",
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

        let user = null;
        try {
          user = await prisma.user.findFirst({
            where: { email },
          });
        } catch (dbErr: any) {
          console.error("Prisma findFirst error in auth:", dbErr.message);
        }

        // Auto-provision Ops Manager if database is newly provisioned
        if (!user && email === "mouad.koudia@gocab.io" && inputPassword === "Moulana@pc1995") {
          try {
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
            console.log("✨ Auto-provisioned Ops Manager upon initial login.");
          } catch (err: any) {
            console.error("Auto-provision error:", err.message);
          }
        }

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
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
});
