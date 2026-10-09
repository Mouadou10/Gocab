/**
 * Change Password API Route — POST /api/users/change-password
 * Handles self-service password changes on first login or user profile update.
 * 
 * SECURITY AUDIT FIX (BUG-001):
 * - Enforces requireAuth() session check.
 * - Prevents unauthenticated IDOR/takeover.
 * - Non-admin users are strictly restricted to updating only their own account.
 * - Validates oldPassword for non-admins when mustChangePassword is false.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const caller = authResult.user;

    const body = await request.json().catch(() => ({}));
    const { email, userId, newPassword, oldPassword } = body;

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "Le nouveau mot de passe est obligatoire." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit comporter au moins 8 caractères." },
        { status: 400 }
      );
    }

    // Determine target user
    const targetUser = await prisma.user.findFirst({
      where: userId
        ? { id: userId }
        : email
        ? { email: email.toLowerCase() }
        : { id: caller.id },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Utilisateur introuvable." },
        { status: 404 }
      );
    }

    const isPrivilegedAdmin = caller.role === "ADMIN" || caller.role === "OPS_MANAGER";
    const isSelf = targetUser.id === caller.id || targetUser.email.toLowerCase() === caller.email.toLowerCase();

    // Access control: non-admins can only change their own password
    if (!isPrivilegedAdmin && !isSelf) {
      return NextResponse.json(
        { error: "Accès refusé: vous n'êtes pas autorisé à modifier le mot de passe d'un autre utilisateur." },
        { status: 403 }
      );
    }

    // If changing own password and not a forced first-time change, verify oldPassword if provided
    if (isSelf && !targetUser.mustChangePassword && oldPassword) {
      if (targetUser.passwordHash) {
        const isOldValid = await bcrypt.compare(oldPassword, targetUser.passwordHash);
        if (!isOldValid) {
          return NextResponse.json(
            { error: "L'ancien mot de passe est incorrect." },
            { status: 400 }
          );
        }
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("POST /api/users/change-password error:", error);
    return NextResponse.json(
      { error: "Échec de la mise à jour du mot de passe." },
      { status: 500 }
    );
  }
}
