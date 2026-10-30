import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible NextAuth configuration for middleware.
 * Does NOT import Prisma or native Node modules so it runs cleanly on the Edge.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "81c134e63b7d02ddbdd6f6a3edae9042ace9af18cccada6e294bcc4998318c9f",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { nextUrl } = request;
      const pathname = nextUrl.pathname;
      const isLoginPage = pathname === "/login";
      const isPublic =
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/field-missions") ||
        pathname.startsWith("/confirm-fleet-accident");

      if (isPublic) return true;

      // Ensure we redirect strictly using the host the user actually visited (e.g. gocab-iota.vercel.app)
      // Never use internal or stale Vercel deployment hashes
      const rawHost =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        "gocab-iota.vercel.app";
      const host = rawHost.split(",")[0].trim();
      const proto =
        request.headers.get("x-forwarded-proto") ||
        (host.includes("localhost") ? "http" : "https");
      const currentOrigin = `${proto}://${host}`;

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", currentOrigin));
        }
        return true;
      }

      if (!isLoggedIn) {
        const loginUrl = new URL("/login", currentOrigin);
        loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
        return Response.redirect(loginUrl);
      }

      return true;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.includes("ebvnnjpka") || parsedUrl.hostname.includes("-projects.vercel.app")) {
          return `${baseUrl}/`;
        }
        if (parsedUrl.hostname.includes("vercel.app") || parsedUrl.hostname.includes("gocab")) {
          return url;
        }
      } catch {}
      return baseUrl;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.image = (user as any).image || token.image || null;
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.image !== undefined) token.image = session.image;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).mustChangePassword = token.mustChangePassword as boolean;
        if (token.image) {
          session.user.image = token.image as string;
        }
        if (token.name) {
          session.user.name = token.name as string;
        }
      }
      return session;
    },
  },
  providers: [], // Configured with credentials in auth.ts
};
