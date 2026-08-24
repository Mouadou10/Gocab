import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Next.js Edge Middleware using edge-safe NextAuth config.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
