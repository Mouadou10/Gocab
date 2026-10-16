import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { invalidateDriverCache } from "@/lib/driverCache";
import { touchSyncState } from "@/lib/sync";

export const dynamic = "force-dynamic";

/**
 * GET /api/drivers/[id]/comments
 * Fetches all comments for a specific driver, ordered by creation date descending.
 * Optionally filters or highlights comments for a specific date (?date=YYYY-MM-DD).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    const comments = await prisma.driverComment.findMany({
      where: { driverId: id },
      orderBy: { createdAt: "desc" },
    });

    const formattedComments = comments.map((c) => ({
      ...c,
      commentDate: c.commentDate || c.createdAt.toISOString().split("T")[0],
    }));

    const dateComments = dateParam
      ? formattedComments.filter((c) => c.commentDate === dateParam)
      : [];

    return NextResponse.json({
      comments: formattedComments,
      dateComments,
      totalCount: formattedComments.length,
    });
  } catch (error: any) {
    console.error("GET /api/drivers/[id]/comments error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drivers/[id]/comments
 * Adds a team comment to a driver record associated with a specific date.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { content, authorName, authorRole, commentDate, date } = body;

    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { id },
    });

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    const userObj = "user" in authResult ? (authResult as any).user : null;
    const effectiveAuthorName =
      authorName ||
      userObj?.fullName ||
      userObj?.name ||
      userObj?.email ||
      "Agent";
    const effectiveAuthorRole =
      authorRole ||
      userObj?.role ||
      "FLEET_MANAGER";

    const targetDate = String(commentDate || date || new Date().toISOString().split("T")[0]).trim();

    const newComment = await prisma.driverComment.create({
      data: {
        driverId: id,
        authorName: effectiveAuthorName,
        authorRole: effectiveAuthorRole,
        content: String(content).trim(),
        commentDate: targetDate,
      },
    });

    invalidateDriverCache();
    await touchSyncState("collections").catch(() => {});

    return NextResponse.json({
      success: true,
      comment: {
        ...newComment,
        commentDate: targetDate,
      },
    });
  } catch (error: any) {
    console.error("POST /api/drivers/[id]/comments error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to add comment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/drivers/[id]/comments?commentId=...
 * Deletes a specific comment from a driver.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return authResult.error;
    }
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId parameter" }, { status: 400 });
    }

    await prisma.driverComment.delete({
      where: { id: commentId },
    });

    invalidateDriverCache();

    return NextResponse.json({ success: true, message: "Comment deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/drivers/[id]/comments error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete comment" },
      { status: 500 }
    );
  }
}
