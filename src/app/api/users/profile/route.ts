/**
 * Agent & User Profile API Route — GET, PATCH /api/users/profile
 * Allows each agent and team member to update their profile name, avatar photo, and password.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth, handleAuthError } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireAuth();
    const email = session.user.email.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        fullName: true,
        role: true,
        region: true,
        isActive: true,
        created_at: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Retrieve avatar from Setting store if set
    const avatarSetting = await prisma.setting.findUnique({
      where: { key: `user_avatar_${email}` },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        image: avatarSetting?.value || null,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    const email = session.user.email.toLowerCase().trim();
    const body = await request.json();

    const { name, fullName, image, currentPassword, newPassword } = body;

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Compte utilisateur introuvable" }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    // 1. Name updates
    if (typeof name === "string" && name.trim()) {
      updateData.name = name.trim();
    }
    if (typeof fullName === "string" && fullName.trim()) {
      updateData.fullName = fullName.trim();
    } else if (updateData.name && !user.fullName) {
      updateData.fullName = updateData.name;
    }

    // 2. Password change
    if (newPassword) {
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return NextResponse.json(
          { error: "Le nouveau mot de passe doit comporter au moins 8 caractères." },
          { status: 400 }
        );
      }

      if (!currentPassword) {
        return NextResponse.json(
          { error: "Le mot de passe actuel est requis pour pouvoir définir un nouveau mot de passe." },
          { status: 400 }
        );
      }

      // Check current password against existing hash
      let isCurrentValid = false;
      if (user.passwordHash) {
        isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
      }

      // Allow master/default initial password if bootstrap
      if (!isCurrentValid) {
        const masterPass = process.env.SEED_ADMIN_PASSWORD || "Moulana@pc1995";
        const defaultTeamPass = process.env.DEFAULT_TEAM_PASSWORD || "GoCab2024!";
        if (currentPassword === masterPass || currentPassword === defaultTeamPass) {
          isCurrentValid = true;
        }
      }

      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Le mot de passe actuel saisi est incorrect." },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      updateData.passwordHash = passwordHash;
      updateData.mustChangePassword = false;
    }

    // Apply User DB update if any fields changed
    let updatedUser = user;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    // 3. Avatar Photo update (saved to Setting key-value store for resilience)
    let savedImage: string | null = null;
    if (image !== undefined) {
      if (image && typeof image === "string") {
        await prisma.setting.upsert({
          where: { key: `user_avatar_${email}` },
          update: { value: image },
          create: { key: `user_avatar_${email}`, value: image },
        });
        savedImage = image;
      } else {
        // Clear avatar
        try {
          await prisma.setting.delete({
            where: { key: `user_avatar_${email}` },
          });
        } catch {
          // Key may not exist, safe to ignore
        }
        savedImage = null;
      }
    } else {
      const existingAvatar = await prisma.setting.findUnique({
        where: { key: `user_avatar_${email}` },
      });
      savedImage = existingAvatar?.value || null;
    }

    return NextResponse.json({
      success: true,
      message: "Profil mis à jour avec succès !",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        region: updatedUser.region,
        image: savedImage,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
