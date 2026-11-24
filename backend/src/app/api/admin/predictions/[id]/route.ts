
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
      // Lock the match row before checking status or settling
      // predictions. Fan submissions use the same row lock.
      const match = await tx.orm.public.Match
        .where({ id })
        .update({ id });

      if (!match) {
        throw new Error("MATCH_NOT_FOUND");
      }

      // A finished match is locked to prevent accidental
      // score changes or a second settlement.
      if (match.status === "FINISHED") {
        throw new Error("MATCH_ALREADY_FINISHED");
      }

      if (match.status === "CANCELLED") {
        throw new Error("MATCH_ALREADY_CANCELLED");
      }

      // Match details may only be edited while predictions
      // are open. Status and score operations remain separate
      // so administrators can settle completed matches.
      const now = Date.now();
      const deadline = new Date(
        match.predictionClosesAt ?? match.scheduledAt
      ).getTime();

      const predictionsEditable =
        match.status === "SCHEDULED" &&
        match.predictionsClosedAt == null &&
        Number.isFinite(deadline) &&
        deadline > now;

      const changesMatchDetails =
        "competition" in body ||
        "venue" in body ||
        "scheduledAt" in body ||
        "predictionClosesAt" in body;

      if (changesMatchDetails && !predictionsEditable) {
        throw new Error("MATCH_EDIT_LOCKED");
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

      // Validate the effective kickoff and prediction deadline
      // together, including when only one of them changes.
      const effectiveKickoff = new Date(
        (updates.scheduledAt as string | undefined) ??
          match.scheduledAt
      ).getTime();

      let effectiveDeadline = new Date(
        match.predictionClosesAt ?? match.scheduledAt
      ).getTime();

      if ("predictionClosesAt" in body) {
        if (
          typeof body.predictionClosesAt !== "string" ||
          !body.predictionClosesAt.trim()
        ) {
          throw new Error("INVALID_PREDICTION_CLOSES_AT");
        }

        const closingTime = new Date(body.predictionClosesAt);

        if (!Number.isFinite(closingTime.getTime())) {
          throw new Error("INVALID_PREDICTION_CLOSES_AT");
        }

        effectiveDeadline = closingTime.getTime();
        updates.predictionClosesAt = closingTime.toISOString();
      }

      if (
        ("scheduledAt" in body ||
          "predictionClosesAt" in body) &&
        (!Number.isFinite(effectiveKickoff) ||
          !Number.isFinite(effectiveDeadline) ||
          effectiveDeadline <= Date.now())
      ) {
        throw new Error("INVALID_PREDICTION_DEADLINE");
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

        // Never return a match to SCHEDULED after it has
        // entered another status. This prevents accidental
        // reopening of prediction submissions.
        if (
          nextStatus === "SCHEDULED" &&
          match.status !== "SCHEDULED"
        ) {
          throw new Error("MATCH_REOPEN_NOT_ALLOWED");
        }

        updates.status = nextStatus;
      }

      // Prevent a single request from editing match details
      // while transitioning the match out of SCHEDULED.
      // Result recording and settlement remain available
      // through status/score-only requests.
      if (
        changesMatchDetails &&
        nextStatus !== "SCHEDULED"
      ) {
        throw new Error("MATCH_EDIT_STATUS_CONFLICT");
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
      MATCH_ALREADY_CANCELLED: {
        status: 409,
        message:
          "This match has been cancelled and cannot be edited or reopened.",
      },
      MATCH_REOPEN_NOT_ALLOWED: {
        status: 409,
        message:
          "A match that has left Scheduled status cannot be returned to Scheduled.",
      },
      MATCH_EDIT_STATUS_CONFLICT: {
        status: 409,
        message:
          "Match details cannot be edited while changing the match status. Save match details before starting, finishing, postponing, or cancelling the match.",
      },
      MATCH_EDIT_LOCKED: {
        status: 409,
        message:
          "Match details are locked because predictions have closed, expired, or the match is no longer scheduled.",
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
      INVALID_PREDICTION_CLOSES_AT: {
        status: 400,
        message:
          "Provide a valid prediction closing date and time.",
      },
      INVALID_PREDICTION_DEADLINE: {
        status: 400,
        message:
          "Prediction closing time must be in the future and earlier than kickoff.",
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
