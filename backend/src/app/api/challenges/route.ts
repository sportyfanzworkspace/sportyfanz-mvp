import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User.first({
      id: userId,
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const profile = await db.orm.public.FanProfile.first({
      userId,
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Fan profile not found" },
        { status: 404 }
      );
    }

    const challenges = await db.orm.public.Challenge
      .where({ status: "ACTIVE" })
      .all();

    const participations =
      await db.orm.public.ChallengeParticipation
        .where({ userId })
        .all();

    const participationByChallenge = new Map(
      participations.map((item) => [
        item.challengeId,
        item,
      ])
    );

    return NextResponse.json({
      balance: profile.currentPoints,
      totalPoints: profile.totalPoints,
      challenges: challenges.map((challenge) => {
        const participation =
          participationByChallenge.get(challenge.id);

        return {
          id: challenge.id,
          title: challenge.title,
          slug: challenge.slug,
          description: challenge.description,
          type: challenge.type,
          pointsReward: challenge.pointsReward,
          targetValue: challenge.targetValue,
          targetLabel: challenge.targetLabel,
          startsAt: challenge.startsAt,
          endsAt: challenge.endsAt,
          imageUrl: challenge.imageUrl,
          participation: participation
            ? {
                id: participation.id,
                progress: participation.progress,
                target: participation.target,
                status: participation.status,
                completedAt: participation.completedAt,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/challenges error:", error);

    return NextResponse.json(
      { error: "Failed to load challenges" },
      { status: 500 }
    );
  }
}
