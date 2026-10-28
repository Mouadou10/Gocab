/**
 * Users Management API Route — GET, POST, PATCH /api/users
 * Allows Operations Manager and Admins to manage team members and their roles.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authResult = await requireAuth(["ADMIN", "OPS_MANAGER"]);
  if ("error" in authResult) return authResult.error;

  try {
    // Ensure all 10 core GoCab team member accounts exist with gocab.io emails
    const defaultTeamMembers = [
      {
        email: "mouad.koudia@gocab.io",
        name: "Mouad Koudia",
        fullName: "Mouad Koudia",
        role: "OPS_MANAGER",
        region: "CASABLANCA",
      },
      {
        email: "kurbankerimov@gocab.io",
        name: "Kurban Kerimov",
        fullName: "Kurban Kerimov",
        role: "OPS_MANAGER",
        region: "CASABLANCA",
      },
      {
        email: "kaoutar.ouardi@gocab.io",
        name: "Kaoutar Ouardi",
        fullName: "Kaoutar Ouardi",
        role: "LEAD_ACQUISITION_JR",
        region: "CASABLANCA",
      },
      {
        email: "nour.abouri@gocab.io",
        name: "Nour Abouri",
        fullName: "Nour Abouri",
        role: "LEAD_ACQUISITION_JR",
        region: "CASABLANCA",
      },
      {
        email: "salma.abouri@gocab.io",
        name: "Salma Abouri",
        fullName: "Salma Abouri",
        role: "LEAD_ACQUISITION_JR",
        region: "CASABLANCA",
      },
      {
        email: "ayoub.gsaib@gocab.io",
        name: "Ayoub Gsaib",
        fullName: "Ayoub Gsaib",
        role: "ONBOARDING_SPECIALIST",
        region: "CASABLANCA",
      },
      {
        email: "mohamed.aziz@gocab.io",
        name: "Mohamed Aziz",
        fullName: "Mohamed Aziz",
        role: "FLEET_PERF_MANAGER",
        region: "CASABLANCA",
      },
      {
        email: "mehdi.elyattouti@gocab.io",
        name: "Mehdi Elyattouti",
        fullName: "Mehdi Elyattouti",
        role: "FLEET_PERF_MANAGER",
        region: "CASABLANCA",
      },
      {
        email: "hamza.rassid@gocab.io",
        name: "Hamza Rassid",
        fullName: "Hamza Rassid",
        role: "FIELD_SUPERVISOR",
        region: "CASABLANCA",
      },
      {
        email: "ayoub.rassid@gocab.io",
        name: "Ayoub Rassid",
        fullName: "Ayoub Rassid",
        role: "FIELD_SUPERVISOR",
        region: "CASABLANCA",
      },
    ];

    for (const member of defaultTeamMembers) {
      const existing = await prisma.user.findFirst({
        where: { email: member.email },
      });

      if (existing) {
        // Ensure active and names are retained
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name || member.name,
            fullName: existing.fullName || member.fullName,
            isActive: true,
          },
        });
      } else {
        const rawPass = member.email === "mouad.koudia@gocab.io" ? "Moulana@pc1995" : "GoCab2024!";
        const passwordHash = await bcrypt.hash(rawPass, 12);
        await prisma.user.create({
          data: {
            email: member.email,
            name: member.name,
            fullName: member.fullName,
            role: member.role,
            region: member.region || "CASABLANCA",
            passwordHash,
            isActive: true,
            mustChangePassword: false,
          },
        });
      }
    }

    const users = await prisma.user.findMany({
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
      orderBy: { created_at: "asc" },
    });

    const defaultAvatars: Record<string, string> = {
      "mouad.koudia@gocab.io": "👑",
      "kurbankerimov@gocab.io": "💼",
      "kaoutar.ouardi@gocab.io": "🎯",
      "nour.abouri@gocab.io": "✨",
      "salma.abouri@gocab.io": "💫",
      "ayoub.gsaib@gocab.io": "🎓",
      "mohamed.aziz@gocab.io": "🚗",
      "mehdi.elyattouti@gocab.io": "🚙",
      "hamza.rassid@gocab.io": "🛡️",
      "ayoub.rassid@gocab.io": "🔍",
    };

    const avatarSettings = await prisma.setting.findMany({
      where: { key: { startsWith: "user_avatar_" } },
    });
    const avatarMap = new Map<string, string>();
    for (const s of avatarSettings) {
      const emailKey = s.key.replace("user_avatar_", "");
      avatarMap.set(emailKey, s.value);
    }

    const usersWithAvatars = users.map((u) => ({
      ...u,
      image: avatarMap.get(u.email.toLowerCase()) || defaultAvatars[u.email.toLowerCase()] || null,
    }));

    return NextResponse.json({ users: usersWithAvatars });
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch users", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN", "OPS_MANAGER"]);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const { email, name, fullName, role, password, region } = body;

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: "Email, name, and role are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: `An account with email ${email} already exists.` },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password || "GoCab2024!", 12);

    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        fullName: (fullName || name).trim(),
        role: role.trim(),
        region: region || "CASABLANCA",
        passwordHash,
        isActive: true,
      },
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

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/users error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create user", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN", "OPS_MANAGER"]);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const { id, role, name, fullName, region, isActive, password } = body;

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role.trim();
    if (name !== undefined) updateData.name = name.trim();
    if (fullName !== undefined) updateData.fullName = fullName.trim();
    if (region !== undefined) updateData.region = region.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (password && password.trim().length > 0) {
      updateData.passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ user });
  } catch (error) {
    console.error("PATCH /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(["ADMIN", "OPS_MANAGER"]);
  if ("error" in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Safety: Protect Mouad's primary account
    const user = await prisma.user.findUnique({ where: { id } });
    if (user && user.email === "mouad.koudia@gocab.io") {
      return NextResponse.json(
        { error: "Cannot delete the primary Operations Manager account" },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}

