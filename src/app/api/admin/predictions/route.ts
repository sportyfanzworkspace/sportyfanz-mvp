
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await requirePermission("predictions:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const [matches, predictions, allSports, allTeams] =
      await Promise.all([
        db.orm.public.Match.all(),
        db.orm.public.Prediction.all(),
        db.orm.public.Sport.all(),
        db.orm.public.Team.all(),
      ]);

    // Return active sports and teams for the Create Match dropdowns.
    const sports = allSports
      .filter((sport) => sport.isActive)
      .map((sport) => ({
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
      }));

    const teams = allTeams
      .filter((team) => team.isActive)
      .map((team) => ({
        id: team.id,
        name: team.name,
        sportId: team.sportId,
        isActive: team.isActive,
      }));

    // Enrich matches with their sport, teams and prediction counts.
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        const [sport, homeTeam, awayTeam] = await Promise.all([
          db.orm.public.Sport
            .where({ id: match.sportId })
            .first(),

          db.orm.public.Team
            .where({ id: match.homeTeamId })
            .first(),

          db.orm.public.Team
            .where({ id: match.awayTeamId })
            .first(),
        ]);

        const matchPredictions = predictions.filter(
          (prediction) => prediction.matchId === match.id
        );

        return {
          id: match.id,
          sportId: match.sportId,
          competition: match.competition,
          venue: match.venue,
          status: match.status,
          scheduledAt: match.scheduledAt,
          startedAt: match.startedAt,
          endedAt: match.endedAt,
          homeScore: match.homeScore,
          awayScore: match.awayScore,

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

          predictionCount: matchPredictions.length,

          openPredictions: matchPredictions.filter(
            (prediction) => prediction.status === "OPEN"
          ).length,

          resolvedPredictions: matchPredictions.filter(
            (prediction) =>
              prediction.status === "WON" ||
              prediction.status === "LOST"
          ).length,
        };
      })
    );

    enrichedMatches.sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() -
        new Date(a.scheduledAt).getTime()
    );

    // Enrich predictions with fan and match details.
    const enrichedPredictions = await Promise.all(
      predictions.map(async (prediction) => {
        const [user, match] = await Promise.all([
          db.orm.public.User
            .where({ id: prediction.userId })
            .first(),

          db.orm.public.Match
            .where({ id: prediction.matchId })
            .first(),
        ]);

        const [homeTeam, awayTeam] = match
          ? await Promise.all([
              db.orm.public.Team
                .where({ id: match.homeTeamId })
                .first(),

              db.orm.public.Team
                .where({ id: match.awayTeamId })
                .first(),
            ])
          : [null, null];

        return {
          id: prediction.id,
          userId: prediction.userId,
          matchId: prediction.matchId,
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
          pointsAwarded: prediction.pointsAwarded,
          status: prediction.status,
          createdAt: prediction.createdAt,
          resolvedAt: prediction.resolvedAt,

          fan: user
            ? {
                id: user.id,
                name:
                  user.name ??
                  user.username ??
                  `Fan #${user.id}`,
              }
            : {
                id: prediction.userId,
                name: `Fan #${prediction.userId}`,
              },

          match: match
            ? {
                id: match.id,
                competition: match.competition,
                status: match.status,
                scheduledAt: match.scheduledAt,
                homeScore: match.homeScore,
                awayScore: match.awayScore,
                homeTeam: homeTeam?.name ?? "Home team",
                awayTeam: awayTeam?.name ?? "Away team",
              }
            : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      matches: enrichedMatches,
      predictions: enrichedPredictions,

      // Required by the Create Match dropdowns.
      sports,
      teams,

      summary: {
        totalMatches: matches.length,
        totalPredictions: predictions.length,

        openPredictions: predictions.filter(
          (prediction) => prediction.status === "OPEN"
        ).length,

        wonPredictions: predictions.filter(
          (prediction) => prediction.status === "WON"
        ).length,

        lostPredictions: predictions.filter(
          (prediction) => prediction.status === "LOST"
        ).length,
      },
    });
  } catch (error) {
    console.error("Admin predictions list failed:", error);

    return NextResponse.json(
      { error: "Unable to load predictions management data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("predictions:manage");

    if (!auth.authorized) {
      return auth.response;
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

    const sportId = Number(body.sportId);
    const homeTeamId = Number(body.homeTeamId);
    const awayTeamId = Number(body.awayTeamId);

    if (
      !Number.isSafeInteger(sportId) ||
      sportId < 1 ||
      !Number.isSafeInteger(homeTeamId) ||
      homeTeamId < 1 ||
      !Number.isSafeInteger(awayTeamId) ||
      awayTeamId < 1
    ) {
      return NextResponse.json(
        {
          error: "Select a valid sport, home team and away team.",
        },
        { status: 400 }
      );
    }

    if (homeTeamId === awayTeamId) {
      return NextResponse.json(
        {
          error: "The home and away teams must be different.",
        },
        { status: 400 }
      );
    }

    const competition =
      typeof body.competition === "string"
        ? body.competition.trim()
        : "";

    if (!competition || competition.length > 200) {
      return NextResponse.json(
        {
          error:
            "Enter a local league, academy competition or community tournament name (maximum 200 characters).",
        },
        { status: 400 }
      );
    }

    if (typeof body.scheduledAt !== "string") {
      return NextResponse.json(
        { error: "Enter a valid kickoff date and time." },
        { status: 400 }
      );
    }

    const kickoff = new Date(body.scheduledAt);

    if (
      Number.isNaN(kickoff.getTime()) ||
      kickoff.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error: "The kickoff must be a valid future date and time.",
        },
        { status: 400 }
      );
    }

    const [sport, homeTeam, awayTeam, matches] =
      await Promise.all([
        db.orm.public.Sport
          .where({ id: sportId })
          .first(),

        db.orm.public.Team
          .where({ id: homeTeamId })
          .first(),

        db.orm.public.Team
          .where({ id: awayTeamId })
          .first(),

        db.orm.public.Match.all(),
      ]);

    if (!sport || !sport.isActive) {
      return NextResponse.json(
        { error: "The selected sport is unavailable." },
        { status: 400 }
      );
    }

    if (
      !homeTeam ||
      !homeTeam.isActive ||
      !awayTeam ||
      !awayTeam.isActive ||
      homeTeam.sportId !== sportId ||
      awayTeam.sportId !== sportId
    ) {
      return NextResponse.json(
        {
          error:
            "Choose two active teams belonging to the selected sport.",
        },
        { status: 400 }
      );
    }

    // Prevent likely duplicate fixtures involving the same teams
    // within six hours of the proposed kickoff.
    const duplicate = matches.some((match) => {
      const sameTeams =
        (match.homeTeamId === homeTeamId &&
          match.awayTeamId === awayTeamId) ||
        (match.homeTeamId === awayTeamId &&
          match.awayTeamId === homeTeamId);

      const existingKickoff = Date.parse(match.scheduledAt);

      return (
        sameTeams &&
        Number.isFinite(existingKickoff) &&
        Math.abs(existingKickoff - kickoff.getTime()) <
          6 * 60 * 60 * 1000
      );
    });

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "A fixture with these teams and a similar kickoff time already exists. Review the existing fixture before creating another.",
        },
        { status: 409 }
      );
    }

    // Create a local/community fixture for the prediction workflow.
    // No venue is required for this form.
    const created = await db.orm.public.Match.create({
      sportId,
      homeTeamId,
      awayTeamId,
      competition,
      venue: null,
      matchDataSource: "MANUAL",
      status: "SCHEDULED",
      scheduledAt: kickoff.toISOString(),
      homeScore: 0,
      awayScore: 0,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Community fixture created successfully.",
        matchId: created.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Manual match creation failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to create the match. Check the server logs.",
      },
      { status: 500 }
    );
  }
}
