import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const challengeId = Number(body?.challengeId);

    if (!Number.isInteger(challengeId) || challengeId <= 0) {
      return NextResponse.json(
        { error: "Invalid challenge" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User.first({
        id: userId,
      });

      if (!user || user.status !== "ACTIVE") {
        throw new Error("UNAUTHORIZED");
      }

      const challenge = await tx.orm.public.Challenge.first({
        id: challengeId,
      });

      if (!challenge || challenge.status !== "ACTIVE") {
        throw new Error("CHALLENGE_UNAVAILABLE");
      }

      const now = Date.now();

      if (
        challenge.startsAt &&
        new Date(challenge.startsAt).getTime() > now
      ) {
        throw new Error("CHALLENGE_NOT_STARTED");
      }

      if (
        challenge.endsAt &&
        new Date(challenge.endsAt).getTime() < now
      ) {
        throw new Error("CHALLENGE_EXPIRED");
      }

      const existing =
        await tx.orm.public.ChallengeParticipation.first({
          challengeId,
          userId,
        });

      if (existing) {
        return {
          alreadyJoined: true,
          participation: existing,
        };
      }

      const participation =
        await tx.orm.public.ChallengeParticipation.create({
          challengeId,
          userId,
          progress: 0,
          target: challenge.targetValue,
          status: "ACTIVE",
        });

      return {
        alreadyJoined: false,
        participation,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.alreadyJoined
        ? "You have already joined this challenge"
        : "You joined the challenge successfully",
      alreadyJoined: result.alreadyJoined,
      participation: {
        id: result.participation.id,
        challengeId: result.participation.challengeId,
        progress: result.participation.progress,
        target: result.participation.target,
        status: result.participation.status,
        completedAt: result.participation.completedAt,
      },
    });
  } catch (error) {
    console.error(
      "POST /api/challenges/participate error:",
      error
    );

    const message =
      error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (message === "CHALLENGE_UNAVAILABLE") {
      return NextResponse.json(
        { error: "This challenge is not available" },
        { status: 404 }
      );
    }

    if (message === "CHALLENGE_NOT_STARTED") {
      return NextResponse.json(
        { error: "This challenge has not started yet" },
        { status: 409 }
      );
    }

    if (message === "CHALLENGE_EXPIRED") {
      return NextResponse.json(
        { error: "This challenge has ended" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to join challenge" },
      { status: 500 }
    );
  }
}
