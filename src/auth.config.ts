import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible NextAuth configuration for middleware.
 * Does NOT import Prisma or native Node modules so it runs cleanly on the Edge.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "gocab-ops-secret-key-2026-mouad",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isLoginPage = pathname === "/login";
      const isPublic =
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon");

      if (isPublic) return true;

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.mustChangePassword = (user as any).mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  providers: [], // Configured with credentials in auth.ts
};
