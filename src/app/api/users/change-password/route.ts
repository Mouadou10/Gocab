/**
 * Change Password API Route — POST /api/users/change-password
 * Handles self-service password changes on first login or user profile update.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId, newPassword } = body;

    if ((!email && !userId) || !newPassword) {
      return NextResponse.json(
        { error: "Email or User ID and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const user = await prisma.user.update({
      where: userId ? { id: userId } : { email: email.toLowerCase() },
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

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("POST /api/users/change-password error:", error);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    );
  }
}
