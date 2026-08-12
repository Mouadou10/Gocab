import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const region = searchParams.get('region');
    const metricKey = searchParams.get('metricKey');

    const where: any = {};
    if (role) where.role = role;
    if (region) where.region = region;
    if (metricKey) where.metricKey = metricKey;

    const objectives = await prisma.weeklyObjective.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, objectives });
  } catch (error) {
    console.error("Fetch objectives error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.role || !data.metricKey || data.targetValue === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday

    // Check if an objective already exists for this week/role/metric
    const existing = await prisma.weeklyObjective.findFirst({
      where: {
        weekStart: startOfWeek,
        role: data.role,
        region: data.region || null,
        metricKey: data.metricKey
      }
    });

    if (existing) {
      // Update existing
      const updated = await prisma.weeklyObjective.update({
        where: { id: existing.id },
        data: { targetValue: Number(data.targetValue) }
      });
      return NextResponse.json({ success: true, objective: updated });
    }

    // Create new
    const objective = await prisma.weeklyObjective.create({
      data: {
        weekStart: startOfWeek,
        role: data.role,
        region: data.region || null,
        metricKey: data.metricKey,
        targetValue: Number(data.targetValue)
      }
    });

    return NextResponse.json({ success: true, objective });
  } catch (error) {
    console.error("Create objective error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
