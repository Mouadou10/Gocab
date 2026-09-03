import { NextResponse } from "next/server";
import { auth } from "@/auth";

export type AllowedRole =
  | "ADMIN"
  | "OPS_MANAGER"
  | "LEAD_ACQUISITION_JR"
  | "FLEET_PERF_MANAGER"
  | "FIELD_SUPERVISOR"
  | "FINANCE_OFFICER";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Validates that the current request has an active authenticated session.
 * Optionally verifies if the user's role is in the list of allowed roles.
 */
export async function requireAuth(
  allowedRoles?: AllowedRole[]
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return {
        error: NextResponse.json(
          { error: "Non autorisé: Veuillez vous connecter pour continuer." },
          { status: 401 }
        ),
      };
    }

    const user: AuthenticatedUser = {
      id: session.user.id,
      name: session.user.name || "Agent",
      email: session.user.email || "",
      role: session.user.role || "LEAD_ACQUISITION_JR",
    };

    if (allowedRoles && allowedRoles.length > 0) {
      // ADMIN and OPS_MANAGER inherently have superuser access to all operational routes
      const hasPermission =
        user.role === "ADMIN" ||
        user.role === "OPS_MANAGER" ||
        allowedRoles.includes(user.role as AllowedRole);

      if (!hasPermission) {
        return {
          error: NextResponse.json(
            {
              error: `Accès refusé: Votre rôle (${user.role}) n'a pas les permissions requises.`,
            },
            { status: 403 }
          ),
        };
      }
    }

    return { user };
  } catch (err: any) {
    console.error("Auth verification error:", err?.message);
    return {
      error: NextResponse.json(
        { error: "Erreur interne lors de la vérification des permissions." },
        { status: 500 }
      ),
    };
  }
}
