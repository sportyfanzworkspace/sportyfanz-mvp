
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { awardProgressionPoints } from "@/lib/progression";

function getLagosDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = getLagosDate();

    const [user, profile, existingAward] = await Promise.all([
      db.orm.public.User.where({ id: userId }).first(),
      db.orm.public.FanProfile.where({ userId }).first(),
      db.orm.public.ProgressionAward
        .where({
          userId,
          taskKey: `DAILY_CHECKIN:${today}`,
        })
        .first(),
    ]);

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Fan profile not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      checkedInToday: Boolean(existingAward),
      progressionPoints: profile.progressionPoints,
      fanLevel: profile.fanLevel,
    });
  } catch (error) {
    console.error("Check-in status failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve check-in status." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.orm.public.User.where({ id: userId }).first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    const today = getLagosDate();

    const result = await awardProgressionPoints({
      userId,
      taskKey: `DAILY_CHECKIN:${today}`,
      points: 5,
      description: `Daily fan check-in: ${today}`,
    });

    if (!result.awarded) {
      const profile = await db.orm.public.FanProfile
        .where({ userId })
        .first();

      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        progressionPoints: profile?.progressionPoints ?? 0,
        fanLevel: profile?.fanLevel ?? "NEW_FAN",
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
