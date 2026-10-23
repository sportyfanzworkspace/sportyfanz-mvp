
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProviderFixture = {
  fixture?: {
    id?: number;
    date?: string;
    timestamp?: number;
    status?: {
      short?: string;
      long?: string;
      elapsed?: number | null;
      extra?: number | null;
    };
    venue?: {
      name?: string | null;
    };
  };
  league?: {
    name?: string;
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    halftime?: {
      home?: number | null;
      away?: number | null;
    };
  };
};

function isScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 20
  );
}

function mapStatus(
  providerStatus: string | undefined
):
  | "SCHEDULED"
  | "LIVE"
  | "HALF_TIME"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | null {
  switch (providerStatus) {
    case "NS":
    case "TBD":
      return "SCHEDULED";

    case "1H":
    case "2H":
    case "ET":
    case "P":
    case "BT":
    case "LIVE":
      return "LIVE";

    case "HT":
      return "HALF_TIME";

    case "FT":
    case "AET":
    case "PEN":
      return "FINISHED";

    case "PST":
    case "POST":
      return "POSTPONED";

    case "CANC":
    case "CANCELL":
      return "CANCELLED";

    default:
      return null;
  }
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    const cronAuthorized =
      Boolean(cronSecret) &&
      authorization === `Bearer ${cronSecret}`;

    if (!cronAuthorized) {
      const auth = await requirePermission("predictions:manage");

      if (!auth.authorized) {
        return auth.response;
      }
    }

    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "API_FOOTBALL_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    // Only matches with an explicit provider fixture ID are eligible.
    const allMatches = await db.orm.public.Match.all();

    const linkedMatches = allMatches.filter(
      (match) =>
        Number.isSafeInteger(match.apiFootballFixtureId) &&
        typeof match.apiFootballFixtureId === "number" &&
        match.apiFootballFixtureId > 0 &&
        match.matchDataSource === "API_FOOTBALL"
    );

    if (linkedMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No API-Football-linked matches need syncing.",
        checked: 0,
        updated: 0,
        settledPredictions: 0,
        cancelledPredictions: 0,
        skipped: 0,
        requestsRemaining: null,
      });
    }

    const matchesByFixtureId = new Map(
      linkedMatches.map((match) => [
        match.apiFootballFixtureId as number,
        match,
      ])
    );

    const fixtureIds = [...matchesByFixtureId.keys()];
    const batches: number[][] = [];

    // API-Football supports multiple fixture IDs per request.
    // Keep batches small and predictable.
    for (let i = 0; i < fixtureIds.length; i += 20) {
      batches.push(fixtureIds.slice(i, i + 20));
    }

    let updated = 0;
    let settledPredictions = 0;
    let cancelledPredictions = 0;
    let skipped = 0;
    let requestsRemaining: string | null = null;

    const failures: Array<{
      fixtureId: number;
      message: string;
    }> = [];

    for (const batch of batches) {
      const url = new URL(
        "https://v3.football.api-sports.io/fixtures"
      );

      url.searchParams.set("ids", batch.join("-"));

      const response = await fetch(url.toString(), {
        headers: {
          "x-apisports-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      requestsRemaining = response.headers.get(
        "x-ratelimit-requests-remaining"
      );

      if (!response.ok) {
        for (const fixtureId of batch) {
          failures.push({
            fixtureId,
            message: `Provider HTTP error ${response.status}.`,
          });
        }

        // Do not process this failed batch.
        continue;
      }

      const data = await response.json();

      if (
        data.errors &&
        Object.keys(data.errors).length > 0
      ) {
        for (const fixtureId of batch) {
          failures.push({
            fixtureId,
            message: "API-Football returned a fixture error.",
          });
        }

        continue;
      }

      if (!Array.isArray(data.response)) {
        for (const fixtureId of batch) {
          failures.push({
            fixtureId,
            message: "Invalid fixture response from provider.",
          });
        }

        continue;
      }

      const providerFixtures =
        data.response as ProviderFixture[];

      const fixturesById = new Map<number, ProviderFixture>();

      for (const fixture of providerFixtures) {
        const fixtureId = fixture.fixture?.id;

        if (
          typeof fixtureId === "number" &&
          batch.includes(fixtureId)
        ) {
          fixturesById.set(fixtureId, fixture);
        }
      }

      for (const fixtureId of batch) {
        const fixture = fixturesById.get(fixtureId);
        const match = matchesByFixtureId.get(fixtureId);

        if (!fixture || !match) {
          skipped += 1;
          continue;
        }

        const providerStatus = fixture.fixture?.status?.short;
        const nextStatus = mapStatus(providerStatus);
        const scheduledAt = validDate(fixture.fixture?.date);

        // Unknown statuses and invalid fixture data are never
        // used to change a match or settle predictions.
        if (!nextStatus || !scheduledAt) {
          skipped += 1;
          continue;
        }

        const goalsHome = fixture.goals?.home;
        const goalsAway = fixture.goals?.away;

        const finalScoreIsValid =
          isScore(goalsHome) && isScore(goalsAway);

        // Never mark a fixture finished without a confirmed score.
        if (nextStatus === "FINISHED" && !finalScoreIsValid) {
          skipped += 1;
          continue;
        }

        try {
          const result = await db.transaction(async (tx) => {
            // Re-read inside the transaction so an already-finished
            // match is not settled a second time.
            const current = await tx.orm.public.Match
              .where({ id: match.id })
              .first();

            if (
              !current ||
              current.apiFootballFixtureId !== fixtureId ||
              current.matchDataSource !== "API_FOOTBALL"
            ) {
              return {
                changed: false,
                settled: 0,
                cancelled: 0,
              };
            }

            // A final match is immutable through this sync route.
            // Corrections should be reviewed separately.
            if (current.status === "FINISHED") {
              return {
                changed: false,
                settled: 0,
                cancelled: 0,
              };
            }

            const updates: Record<string, unknown> = {
              scheduledAt,
              status: nextStatus,
            };

            const venue = fixture.fixture?.venue?.name;
            const competition = fixture.league?.name;

            if (typeof venue === "string" && venue.trim()) {
              updates.venue = venue.trim();
            }

            if (
              typeof competition === "string" &&
              competition.trim()
            ) {
              updates.competition = competition.trim();
            }

            if (finalScoreIsValid) {
              updates.homeScore = goalsHome;
              updates.awayScore = goalsAway;
            }

            const halfTimeHome = fixture.score?.halftime?.home;
            const halfTimeAway = fixture.score?.halftime?.away;

            if (
              isScore(halfTimeHome) &&
              isScore(halfTimeAway)
            ) {
              updates.homeHalfTimeScore = halfTimeHome;
              updates.awayHalfTimeScore = halfTimeAway;
            }

            const timestamp = fixture.fixture?.timestamp;

            if (
              (nextStatus === "LIVE" ||
                nextStatus === "HALF_TIME") &&
              !current.startedAt
            ) {
              updates.startedAt =
                typeof timestamp === "number"
                  ? new Date(timestamp * 1000).toISOString()
                  : new Date().toISOString();
            }

            if (
              nextStatus === "FINISHED" ||
              nextStatus === "CANCELLED"
            ) {
              updates.endedAt = new Date().toISOString();
            }

            await tx.orm.public.Match
              .where({ id: current.id })
              .update(updates);

            let settled = 0;
            let cancelled = 0;

            if (nextStatus === "FINISHED") {
              const openPredictions =
                await tx.orm.public.Prediction
                  .where({
                    matchId: current.id,
                    status: "OPEN",
                  })
                  .all();

              for (const prediction of openPredictions) {
                const exactScore =
                  prediction.homeScore === goalsHome &&
                  prediction.awayScore === goalsAway;

                await tx.orm.public.Prediction
                  .where({
                    id: prediction.id,
                    status: "OPEN",
                  })
                  .update({
                    status: exactScore ? "WON" : "LOST",
                    resolvedAt: new Date().toISOString(),
                  });

                settled += 1;
              }
            }

            if (nextStatus === "CANCELLED") {
              const openPredictions =
                await tx.orm.public.Prediction
                  .where({
                    matchId: current.id,
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

                cancelled += 1;
              }
            }

            return {
              changed: true,
              settled,
              cancelled,
            };
          });

          if (result.changed) updated += 1;
          settledPredictions += result.settled;
          cancelledPredictions += result.cancelled;
        } catch (error) {
          console.error(
            `Fixture sync failed for ${fixtureId}:`,
            error
          );

          failures.push({
            fixtureId,
            message: "Database update failed.",
          });
        }
      }
    }

    return NextResponse.json({
      success: failures.length === 0,
      message:
        failures.length > 0
          ? "Sync completed with some fixture errors."
          : "Fixture sync completed.",
      checked: fixtureIds.length,
      updated,
      settledPredictions,
      cancelledPredictions,
      skipped,
      failures,
      requestsRemaining,
    });
  } catch (error) {
    console.error("API-Football sync failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to sync API-Football fixtures.",
      },
      { status: 500 }
    );
  }
}
