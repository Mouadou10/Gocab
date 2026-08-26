/**
 * Users Management API Route — GET, POST, PATCH /api/users
 * Allows Operations Manager and Admins to manage team members and their roles.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
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

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch users", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

