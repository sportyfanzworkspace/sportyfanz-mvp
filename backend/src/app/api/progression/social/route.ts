import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { awardProgressionPoints } from "@/lib/progression";
import { SOCIAL_TASKS } from "@/lib/social-tasks";

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    const [user, profile] = await Promise.all([
      db.orm.public.User.where({ id: userId }).first(),
      db.orm.public.FanProfile.where({ userId }).first(),
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

    const tasks = await Promise.all(
      SOCIAL_TASKS.map(async (task) => {
        const award = await db.orm.public.ProgressionAward
          .where({
            userId,
            taskKey: task.taskKey,
          })
          .first();

        return {
          ...task,
          completed: Boolean(award),
        };
      })
    );

    return NextResponse.json({
      success: true,
      tasks,
      progressionPoints: profile.progressionPoints,
      fanLevel: profile.fanLevel,
    });
  } catch (error) {
    console.error("Social task status error:", error);

    return NextResponse.json(
      { error: "Unable to load social tasks." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User.where({ id: userId }).first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const task = SOCIAL_TASKS.find(
      (item) => item.id === body.taskId
    );

    if (!task) {
      return NextResponse.json(
        { error: "Invalid social task." },
        { status: 400 }
      );
    }

    try {
      const result = await awardProgressionPoints({
        userId,
        taskKey: task.taskKey,
        points: task.points,
        description: task.description,
      });

      if (!result.awarded) {
        const profile = await db.orm.public.FanProfile
          .where({ userId })
          .first();

        return NextResponse.json({
          success: true,
          alreadyCompleted: true,
          pointsAwarded: 0,
          progressionPoints: profile?.progressionPoints ?? 0,
          fanLevel: profile?.fanLevel ?? "NEW_FAN",
          message: "You have already completed this task.",
        });
      }

      return NextResponse.json({
        success: true,
        alreadyCompleted: false,
        pointsAwarded: result.pointsAwarded,
        progressionPoints: result.progressionPoints,
        fanLevel: result.fanLevel,
        levelChanged: result.levelChanged,
        message: `You earned ${result.pointsAwarded} progression points!`,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const [award, profile] = await Promise.all([
        db.orm.public.ProgressionAward
          .where({
            userId,
            taskKey: task.taskKey,
          })
          .first(),
        db.orm.public.FanProfile.where({ userId }).first(),
      ]);

      if (!award) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        pointsAwarded: 0,
        progressionPoints: profile?.progressionPoints ?? 0,
        fanLevel: profile?.fanLevel ?? "NEW_FAN",
        message: "You have already completed this task.",
      });
    }
  } catch (error) {
    console.error("Social task claim error:", error);

    return NextResponse.json(
      { error: "Unable to claim this social task." },
      { status: 500 }
    );
  }
}
