/**
 * API Authentication Helper — requireAuth()
 *
 * Validates the NextAuth session on API routes and optionally
 * enforces role-based access control.
 *
 * Usage:
 *   const session = await requireAuth();                    // any authenticated user
 *   const session = await requireAuth("OPS_MANAGER");       // specific role
 *   const session = await requireAuth(["OPS_MANAGER", "ADMIN"]); // any of these roles
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export interface AuthSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export class AuthError extends Error {
  public status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Validates the current session and optionally checks role authorization.
 *
 * @param requiredRole - Single role string or array of allowed roles. If omitted, any authenticated user is accepted.
 * @returns The validated session
 * @throws AuthError if not authenticated or not authorized
 */
export async function requireAuth(
  requiredRole?: string | string[]
): Promise<AuthSession> {
  const session = await auth();

  if (!session?.user) {
    throw new AuthError("Authentication required", 401);
  }

  const userRole = (session.user as any).role as string;

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    // OPS_MANAGER and ADMIN always have access
    const fullAccessRoles = ["OPS_MANAGER", "ADMIN"];
    const hasAccess =
      fullAccessRoles.includes(userRole) || allowedRoles.includes(userRole);

    if (!hasAccess) {
      throw new AuthError(
        `Forbidden: role '${userRole}' does not have access. Required: ${allowedRoles.join(", ")}`,
        403
      );
    }
  }

  return {
    user: {
      id: session.user.id as string,
      name: session.user.name || "",
      email: session.user.email || "",
      role: userRole,
    },
  };
}

/**
 * Helper to return a JSON error response for AuthError exceptions.
 * Use in catch blocks of API route handlers.
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }
  throw error; // Re-throw non-auth errors
}
