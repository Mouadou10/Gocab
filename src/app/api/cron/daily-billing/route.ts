import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Daily Billing & Arrears Automated Cron Engine
 * 
 * Runs every morning (Mon-Sat).
 * 1. Evaluates active drivers on DAILY contract (300 MAD/day).
 * 2. Compares daily cleared payments vs expected charges.
 * 3. Updates driver arrears, increments consecutive unpaid days.
 * 4. Automates default escalation (NOMINAL -> DAY_1 -> DAY_2 -> TELEMATIC_BLOCK).
 * 5. Automatically creates VEHICLE_RECOVERY FieldTask on Day 3 default.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    // Optional secret check if configured in production
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Sunday is off for daily contracts per operations spec
    if (dayOfWeek === 0) {
      return NextResponse.json({
        success: true,
        message: "Dimanche: Jour de repos contractuel (aucun prélèvement journalier appliqué).",
        processed: 0,
      });
    }

    const todayStr = today.toISOString().split("T")[0];

    // 1. Fetch all active drivers with assigned vehicles
    const activeDrivers = await prisma.driverProfile.findMany({
      where: {
        is_archived: false,
        assignedVehicleId: { not: null },
      },
      include: {
        assignedVehicle: true,
        payments: {
          where: {
            paymentDate: {
              gte: new Date(`${todayStr}T00:00:00.000Z`),
              lte: new Date(`${todayStr}T23:59:59.999Z`),
            },
          },
        },
      },
    });

    let billedCount = 0;
    let escalatedCount = 0;
    let recoveryTasksCreated = 0;

    for (const driver of activeDrivers) {
      // Check if driver already received daily charge today
      if (driver.lastDailyChargeDate) {
        const lastChargeStr = new Date(driver.lastDailyChargeDate).toISOString().split("T")[0];
        if (lastChargeStr === todayStr) {
          continue; // Already processed today
        }
      }

      const dailyRateMAD = driver.contractType === "WEEKLY" ? 300.0 : 300.0; // 300 MAD/day Mon-Sat
      
      // Calculate any payments cleared today
      const todayCleared = driver.payments.reduce((sum, p) => sum + (p.clearedMAD || 0), 0);
      const isDayFullyPaid = todayCleared >= dailyRateMAD;

      let newConsecutiveUnpaid = driver.consecutiveUnpaidDays;
      let newArrears = driver.currentArrearsMAD;

      if (isDayFullyPaid) {
        // Paid! Reset consecutive unpaid counter
        newConsecutiveUnpaid = 0;
        newArrears = Math.max(0, newArrears + (dailyRateMAD - todayCleared));
      } else {
        // Unpaid or partial payment
        newConsecutiveUnpaid += 1;
        newArrears += (dailyRateMAD - todayCleared);
      }

      // Determine default stage escalation
      let nextStage = "NOMINAL";
      if (newConsecutiveUnpaid === 1) {
        nextStage = "DAY_1_WARNING";
      } else if (newConsecutiveUnpaid === 2) {
        nextStage = "DAY_2_ACTION";
      } else if (newConsecutiveUnpaid >= 3) {
        nextStage = "DAY_3_BLOCK";
      }

      // Note: Vehicle recovery tasks are no longer created automatically.
      // They are manually triggered by the Fleet Performance Manager via the Call/Recovery action.

      if (nextStage !== driver.defaultStage) {
        escalatedCount++;
      }

      // Update Driver Profile
      await prisma.driverProfile.update({
        where: { id: driver.id },
        data: {
          currentArrearsMAD: newArrears,
          consecutiveUnpaidDays: newConsecutiveUnpaid,
          defaultStage: nextStage,
          lastDailyChargeDate: today,
        },
      });

      billedCount++;
    }

    return NextResponse.json({
      success: true,
      today: todayStr,
      billedDrivers: billedCount,
      escalatedStages: escalatedCount,
      recoveryTasksCreated,
      message: `Facturation journalière exécutée avec succès pour ${billedCount} chauffeurs.`,
    });
  } catch (error: any) {
    console.error("Daily Billing Cron Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne du cron de facturation" },
      { status: 500 }
    );
  }
}

// Support GET trigger for simple manual health check or test invoke
export async function GET(request: Request) {
  return POST(request);
}
