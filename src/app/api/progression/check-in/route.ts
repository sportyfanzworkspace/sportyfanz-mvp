import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { awardProgressionPoints } from "@/lib/progression";

export async function POST() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User
      .where({ id: userId })
      .first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    // Use UTC consistently so a user cannot claim twice
    // by changing their device timezone.
    const today = new Date().toISOString().slice(0, 10);

    const result = await awardProgressionPoints({
      userId,
      taskKey: `DAILY_CHECKIN:${today}`,
      points: 5,
      description: `Daily fan check-in: ${today}`,
    });

    if (!result.awarded) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        message: "You have already checked in today.",
      });
    }

    return NextResponse.json({
      success: true,
      alreadyCheckedIn: false,
      message: "Daily check-in successful. You earned 5 progression points!",
      pointsAwarded: result.pointsAwarded,
      progressionPoints: result.progressionPoints,
      fanLevel: result.fanLevel,
      levelChanged: result.levelChanged,
    });
  } catch (error) {
    console.error("Daily check-in failed:", error);

    return NextResponse.json(
      { error: "Unable to complete your daily check-in." },
      { status: 500 }
    );
  }
}