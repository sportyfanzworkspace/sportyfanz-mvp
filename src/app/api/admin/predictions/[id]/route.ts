
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MATCH_STATUSES = [
  "SCHEDULED",
  "LIVE",
  "HALF_TIME",
  "FINISHED",
  "POSTPONED",
  "CANCELLED",
] as const;

type MatchStatus = (typeof MATCH_STATUSES)[number];

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 20
  );
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("predictions:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "Invalid match ID." },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must contain valid JSON." },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const match = await tx.orm.public.Match
        .where({ id })
        .first();

      if (!match) {
        throw new Error("MATCH_NOT_FOUND");
      }

      // A finished match is locked to prevent accidental
      // score changes or a second settlement.
      if (match.status === "FINISHED") {
        throw new Error("MATCH_ALREADY_FINISHED");
      }

      const updates: Record<string, unknown> = {};

      if ("competition" in body) {
        if (
          typeof body.competition !== "string" ||
          body.competition.trim().length > 200
        ) {
          throw new Error("INVALID_COMPETITION");
        }

        updates.competition =
          body.competition.trim() || null;
      }

      if ("venue" in body) {
        if (
          body.venue !== null &&
          (typeof body.venue !== "string" ||
            body.venue.trim().length > 200)
        ) {
          throw new Error("INVALID_VENUE");
        }

        updates.venue =
          typeof body.venue === "string"
            ? body.venue.trim() || null
            : null;
      }

      if ("scheduledAt" in body) {
        if (typeof body.scheduledAt !== "string") {
          throw new Error("INVALID_SCHEDULED_AT");
        }

        const scheduledAt = new Date(body.scheduledAt);

        if (Number.isNaN(scheduledAt.getTime())) {
          throw new Error("INVALID_SCHEDULED_AT");
        }

        updates.scheduledAt = scheduledAt.toISOString();
      }

      let nextStatus: MatchStatus =
        match.status as MatchStatus;

      if ("status" in body) {
        if (
          typeof body.status !== "string" ||
          !MATCH_STATUSES.includes(
            body.status as MatchStatus
          )
        ) {
          throw new Error("INVALID_STATUS");
        }

        nextStatus = body.status as MatchStatus;
        updates.status = nextStatus;
      }

      let homeScore: number | null =
        match.homeScore ?? null;
      let awayScore: number | null =
        match.awayScore ?? null;

      if ("homeScore" in body) {
      if (
        body.homeScore !== null &&
        !isValidScore(body.homeScore)
      ) {
       throw new Error("INVALID_HOME_SCORE");
      }

     const nextHomeScore: number | null =
       body.homeScore === null
       ? null
       : isValidScore(body.homeScore)
         ? body.homeScore
         : null;

      homeScore = nextHomeScore;
      updates.homeScore = nextHomeScore;
    }

      if ("awayScore" in body) {
      if (
        body.awayScore !== null &&
        !isValidScore(body.awayScore)
      ) {
       throw new Error("INVALID_AWAY_SCORE");
      }

     const nextAwayScore: number | null =
      body.awayScore === null
       ? null
       : isValidScore(body.awayScore)
         ? body.awayScore
         : null;

       awayScore = nextAwayScore;
       updates.awayScore = nextAwayScore;
     }
      if (
        (nextStatus === "LIVE" ||
          nextStatus === "HALF_TIME") &&
        match.status !== "LIVE" &&
        match.status !== "HALF_TIME"
      ) {
        updates.startedAt = new Date().toISOString();
      }

      if (nextStatus === "FINISHED") {
        if (
          !isValidScore(homeScore) ||
          !isValidScore(awayScore)
        ) {
          throw new Error("FINAL_SCORE_REQUIRED");
        }

        updates.endedAt = new Date().toISOString();
      }

      if (nextStatus === "CANCELLED") {
        updates.endedAt = new Date().toISOString();
      }

      const updatedMatch = await tx.orm.public.Match
        .where({ id })
        .update(updates);

      let settledCount = 0;
      let cancelledCount = 0;

      // Settle only OPEN predictions. No points are added,
      // removed, or refunded during settlement.
      if (nextStatus === "FINISHED") {
        const openPredictions =
          await tx.orm.public.Prediction
            .where({
              matchId: id,
              status: "OPEN",
            })
            .all();

        for (const prediction of openPredictions) {
          const isExactScore =
            prediction.homeScore === homeScore &&
            prediction.awayScore === awayScore;

          await tx.orm.public.Prediction
            .where({
              id: prediction.id,
              status: "OPEN",
            })
            .update({
              status: isExactScore ? "WON" : "LOST",
              resolvedAt: new Date().toISOString(),
            });

          settledCount += 1;
        }
      }

      // Cancel outstanding predictions if the match itself
      // is cancelled. Do not alter the original submission points.
      if (nextStatus === "CANCELLED") {
        const openPredictions =
          await tx.orm.public.Prediction
            .where({
              matchId: id,
              status: "OPEN",
            })
            .all();

        for (const prediction of openPredictions) {
          await tx.orm.public.Prediction
            .where({
              id: prediction.id,
              status: "OPEN",
            })
            .update({
              status: "CANCELLED",
              resolvedAt: new Date().toISOString(),
            });

          cancelledCount += 1;
        }
      }

      return {
        match: updatedMatch,
        settledCount,
        cancelledCount,
      };
    });

    return NextResponse.json({
      success: true,
      message:
        result.settledCount > 0
          ? `Match updated. ${result.settledCount} predictions settled. No additional points were awarded.`
          : result.cancelledCount > 0
            ? `Match updated. ${result.cancelledCount} open predictions cancelled. No points were refunded.`
            : "Match updated successfully.",
      ...result,
      pointsAwardedAtSettlement: 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    const errors: Record<
      string,
      { status: number; message: string }
    > = {
      MATCH_NOT_FOUND: {
        status: 404,
        message: "Match not found.",
      },
      MATCH_ALREADY_FINISHED: {
        status: 409,
        message:
          "This match is already finished and cannot be edited or settled again.",
      },
      INVALID_COMPETITION: {
        status: 400,
        message: "Competition must be 200 characters or fewer.",
      },
      INVALID_VENUE: {
        status: 400,
        message: "Venue must be 200 characters or fewer.",
      },
      INVALID_SCHEDULED_AT: {
        status: 400,
        message: "Provide a valid scheduled date and time.",
      },
      INVALID_STATUS: {
        status: 400,
        message: "Select a valid match status.",
      },
      INVALID_HOME_SCORE: {
        status: 400,
        message:
          "Home score must be a whole number from 0 to 20, or null.",
      },
      INVALID_AWAY_SCORE: {
        status: 400,
        message:
          "Away score must be a whole number from 0 to 20, or null.",
      },
      FINAL_SCORE_REQUIRED: {
        status: 400,
        message:
          "Enter valid home and away scores before finishing the match.",
      },
    };

    const knownError = errors[message];

    if (knownError) {
      return NextResponse.json(
        { error: knownError.message },
        { status: knownError.status }
      );
    }

    console.error(
      "PATCH /api/admin/predictions/[id] error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to update match." },
      { status: 500 }
    );
  }
}
