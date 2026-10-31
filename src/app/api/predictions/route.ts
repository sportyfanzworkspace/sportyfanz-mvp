import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getFanLevel } from "@/lib/progression";

const PREDICTION_POINTS = 50;

export async function GET() {
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
        { error: "User account is not active" },
        { status: 403 }
      );
    }

    const profile = await db.orm.public.FanProfile
      .where({ userId })
      .first();

    if (!profile) {
      return NextResponse.json(
        { error: "Fan profile not found" },
        { status: 404 }
      );
    }

    const matches = await db.orm.public.Match
      .where({ status: "SCHEDULED" })
      .all();

    const predictions = await db.orm.public.Prediction
      .where({ userId })
      .all();

    const predictionMap = new Map(
      predictions.map((prediction) => [
        prediction.matchId,
        prediction,
      ])
    );

    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        const sport = await db.orm.public.Sport
          .where({ id: match.sportId })
          .first();

        const homeTeam = await db.orm.public.Team
          .where({ id: match.homeTeamId })
          .first();

        const awayTeam = await db.orm.public.Team
          .where({ id: match.awayTeamId })
          .first();

        const prediction = predictionMap.get(match.id);

        return {
          id: match.id,
          competition: match.competition,
          venue: match.venue,
          scheduledAt: match.scheduledAt,
          status: match.status,

          sport: sport
            ? {
                id: sport.id,
                name: sport.name,
              }
            : null,

          homeTeam: homeTeam
            ? {
                id: homeTeam.id,
                name: homeTeam.name,
                shortName: homeTeam.shortName,
                logoUrl: homeTeam.logoUrl,
              }
            : null,

          awayTeam: awayTeam
            ? {
                id: awayTeam.id,
                name: awayTeam.name,
                shortName: awayTeam.shortName,
                logoUrl: awayTeam.logoUrl,
              }
            : null,

          prediction: prediction
            ? {
                id: prediction.id,
                homeScore: prediction.homeScore,
                awayScore: prediction.awayScore,
                pointsAwarded: prediction.pointsAwarded,
                status: prediction.status,
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      balance: profile.currentPoints,
      totalPoints: profile.totalPoints,
      matches: enrichedMatches,
    });
  } catch (error) {
    console.error("GET /api/predictions error:", error);

    return NextResponse.json(
      { error: "Failed to load predictions" },
      { status: 500 }
    );
  }
}


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
    const matchId = Number(body.matchId);
    const homeScore = Number(body.homeScore);
    const awayScore = Number(body.awayScore);

    if (
      !Number.isInteger(matchId) ||
      matchId <= 0 ||
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore)
    ) {
      return NextResponse.json(
        { error: "Invalid prediction data" },
        { status: 400 }
      );
    }

    if (
      homeScore < 0 ||
      awayScore < 0 ||
      homeScore > 20 ||
      awayScore > 20
    ) {
      return NextResponse.json(
        { error: "Scores must be between 0 and 20" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User
        .where({ id: userId })
        .first();

      if (!user || user.status !== "ACTIVE") {
        throw new Error("USER_NOT_ACTIVE");
      }

      const profile = await tx.orm.public.FanProfile
        .where({ userId })
        .first();

      if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      const match = await tx.orm.public.Match
        .where({ id: matchId })
        .first();

      if (!match) {
        throw new Error("MATCH_NOT_FOUND");
      }

      if (
        match.status !== "SCHEDULED" ||
        new Date(match.scheduledAt).getTime() <= Date.now()
      ) {
        throw new Error("MATCH_NOT_AVAILABLE");
      }

      const existingPrediction =
        await tx.orm.public.Prediction
          .where({ userId, matchId })
          .first();

      if (existingPrediction) {
        return {
          alreadySubmitted: true,
          prediction: existingPrediction,
          predictionPoints: 0,
          challengeBonus: 0,
          balance: profile.currentPoints,
          totalPoints: profile.totalPoints,
          challengesCompletedNow: 0,
        };
      }

      const now = new Date().toISOString();

      const prediction =
        await tx.orm.public.Prediction.create({
          userId,
          matchId,
          homeScore,
          awayScore,
          pointsAwarded: PREDICTION_POINTS,
          status: "OPEN",
          createdAt: now,
        });

        await tx.orm.public.PointTransaction.create({
        userId,
        type: "PREDICTION",
        points: PREDICTION_POINTS,
        description: `Prediction submitted: ${homeScore} - ${awayScore}`,
        referenceId: String(prediction.id),
        referenceType: "PREDICTION",
        balanceAfter:
          profile.currentPoints + PREDICTION_POINTS,
        createdAt: now,
      });

      let challengeBonus = 0;
      let challengesCompletedNow = 0;
      let progressionBonus = 0;
      let nextProgressionBalance = profile.progressionPoints;
      let nextChallengeBalance =
        profile.currentPoints + PREDICTION_POINTS;
      let nextChallengeTotal =
        profile.totalPoints + PREDICTION_POINTS;

      /*
       * Advance only challenges specifically eligible
       * for a submitted prediction.
       */
      const eligibleSlugs = [
         "predict-the-match",
      ];

      for (const slug of eligibleSlugs) {
        const challenge = await tx.orm.public.Challenge
          .where({ slug, status: "ACTIVE" })
          .first();

        if (!challenge) continue;

        /*
         * Require the fan to have joined the challenge.
         * Do not silently enrol them from an activity.
         */
        const participation =
          await tx.orm.public.ChallengeParticipation
            .where({
              challengeId: challenge.id,
              userId,
            })
            .first();

        if (
          !participation ||
          participation.status === "COMPLETED"
        ) {
          continue;
        }

        const target =
          participation.target ??
          challenge.targetValue ??
          1;

        const progress = Math.min(
          participation.progress + 1,
          target
        );

        const completed = progress >= target;

        await tx.orm.public.ChallengeParticipation
          .where({ id: participation.id })
          .update({
            progress,
            status: completed ? "COMPLETED" : "ACTIVE",
            completedAt: completed ? now : null,
            updatedAt: now,
          });

        if (completed) {
          challengeBonus += challenge.pointsReward;
          challengesCompletedNow += 1;

          const progressionTaskKey =
            `CHALLENGE_COMPLETED:${participation.id}`;

          const existingProgressionAward =
            await tx.orm.public.ProgressionAward
              .where({
                userId,
                taskKey: progressionTaskKey,
              })
              .first();

          if (!existingProgressionAward) {
            await tx.orm.public.ProgressionAward.create({
              userId,
              taskKey: progressionTaskKey,
              points: 5,
              description: `Progression reward: completed ${challenge.title}`,
              createdAt: now,
            });

            progressionBonus += 5;
            nextProgressionBalance += 5;
          }

          nextChallengeBalance += challenge.pointsReward;
          nextChallengeTotal += challenge.pointsReward;

          await tx.orm.public.PointTransaction.create({
            userId,
            type: "CHALLENGE",
            points: challenge.pointsReward,
            description: `Completed challenge: ${challenge.title}`,
            referenceId: String(participation.id),
            referenceType: "CHALLENGE_PARTICIPATION",
            balanceAfter: nextChallengeBalance,
            createdAt: now,
          });
        }
      }

      /*
       * Update the fan profile once with the complete balance.
       */
      await tx.orm.public.FanProfile
        .where({ userId })
        .update({
          currentPoints: nextChallengeBalance,
          totalPoints: nextChallengeTotal,
          challengesCompleted:
            profile.challengesCompleted + challengesCompletedNow,
          progressionPoints: nextProgressionBalance,
          fanLevel: getFanLevel(nextProgressionBalance),
          updatedAt: now,
        });

      /*
       * Challenge transactions were created above. Their ledger
       * balanceAfter values must follow the prediction reward,
       * so update them in the next revision if your ledger UI
       * requires strict chronological balance ordering.
       */

      return {
        alreadySubmitted: false,
        prediction,
        predictionPoints: PREDICTION_POINTS,
        challengeBonus,
        balance: nextChallengeBalance,
        totalPoints: nextChallengeTotal,
        challengesCompletedNow,
        progressionBonus,
        progressionPoints: nextProgressionBalance,
        fanLevel: getFanLevel(nextProgressionBalance),
      };
    });

    if (result.alreadySubmitted) {
      return NextResponse.json(
        {
          success: false,
          alreadySubmitted: true,
          message: "You have already predicted this match.",
          prediction: result.prediction,
          predictionPoints: 0,
          challengeBonus: 0,
          balance: result.balance,
          totalPoints: result.totalPoints,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Prediction submitted successfully.",
      prediction: result.prediction,
      predictionPoints: result.predictionPoints,
      challengeBonus: result.challengeBonus,
      totalEarned:
        result.predictionPoints + result.challengeBonus,
      balance: result.balance,
      totalPoints: result.totalPoints,
      challengesCompletedNow: result.challengesCompletedNow,
      progressionBonus: result.progressionBonus,
      progressionPoints: result.progressionPoints,
      fanLevel: result.fanLevel,
    });
  } catch (error) {
    console.error("POST /api/predictions error:", error);

    if (error instanceof Error) {
      const errors: Record<
        string,
        { message: string; status: number }
      > = {
        USER_NOT_ACTIVE: {
          message: "User account is not active",
          status: 403,
        },
        PROFILE_NOT_FOUND: {
          message: "Fan profile not found",
          status: 404,
        },
        MATCH_NOT_FOUND: {
          message: "Match not found",
          status: 404,
        },
        MATCH_NOT_AVAILABLE: {
          message:
            "Predictions are only available before a scheduled match starts.",
          status: 400,
        },
      };

      const known = errors[error.message];

      if (known) {
        return NextResponse.json(
          { error: known.message },
          { status: known.status }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to submit prediction" },
      { status: 500 }
    );
  }
}