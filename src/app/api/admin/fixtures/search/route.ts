
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiFixture = {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
      long?: string;
    };
    venue?: {
      name?: string | null;
    };
  };
  league?: {
    id?: number;
    name?: string;
    season?: number;
  };
  teams?: {
    home?: {
      id?: number;
      name?: string;
    };
    away?: {
      id?: number;
      name?: string;
    };
  };
};

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getDateValue(value: string | null, fallback: number) {
  if (value === null) return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) return null;

  return parsed;
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission("predictions:manage");

    if (auth instanceof Response) return auth;

    const url = new URL(request.url);

    const date = url.searchParams.get("date");
    const requestedStatus = url.searchParams
      .get("status")
      ?.trim()
      .toUpperCase();

    const competitionFilter = url.searchParams
      .get("competition")
      ?.trim()
      .toLowerCase();

    const page = getDateValue(url.searchParams.get("page"), 1);
    const limit = getDateValue(url.searchParams.get("limit"), 50);

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          message: "Provide a date in YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The supplied date is invalid.",
        },
        { status: 400 }
      );
    }

    if (
      page === null ||
      page < 1 ||
      limit === null ||
      limit < 1 ||
      limit > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Page must be at least 1 and limit must be between 1 and 100.",
        },
        { status: 400 }
      );
    }

    const allowedStatuses = new Set([
      "TBD",
      "NS",
      "1H",
      "HT",
      "2H",
      "ET",
      "BT",
      "P",
      "SUSP",
      "INT",
      "FT",
      "AET",
      "PEN",
      "PST",
      "CANC",
      "ABD",
      "AWD",
      "WO",
      "LIVE",
    ]);

    if (requestedStatus && !allowedStatuses.has(requestedStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "The supplied fixture status is not supported.",
          allowedStatuses: Array.from(allowedStatuses),
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "API_FOOTBALL_KEY is not configured.",
        },
        { status: 503 }
      );
    }

    const [teams, matches, sports] = await Promise.all([
      db.orm.public.Team.all(),
      db.orm.public.Match.all(),
      db.orm.public.Sport.all(),
    ]);

    const footballSport = sports.find(
      (sport) => sport.slug === "football" && sport.isActive
    );

    if (!footballSport) {
      return NextResponse.json(
        {
          success: false,
          message: "An active Football sport record was not found.",
        },
        { status: 409 }
      );
    }

    // One API-Football request per search, regardless of the page selected.
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(
        date
      )}&timezone=Africa%2FLagos`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const requestsRemaining = response.headers.get(
      "x-ratelimit-requests-remaining"
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "API-Football fixture search failed.",
          requestsRemaining,
        },
        { status: 502 }
      );
    }

    const payload = await response.json();

    if (
      Array.isArray(payload.errors) &&
      payload.errors.length > 0
    ) {
      console.error("API-Football search errors:", payload.errors);

      return NextResponse.json(
        {
          success: false,
          message: "API-Football returned an error.",
          requestsRemaining,
        },
        { status: 502 }
      );
    }

    if (!Array.isArray(payload.response)) {
      return NextResponse.json(
        {
          success: false,
          message: "API-Football returned an unexpected response.",
          requestsRemaining,
        },
        { status: 502 }
      );
    }

    const providerFixtures = payload.response as ApiFixture[];

    // Build counts from the provider response so the admin can see
    // the status distribution without receiving every fixture.
    const statusCounts: Record<string, number> = {};
    const competitionCounts: Record<string, number> = {};

    for (const fixture of providerFixtures) {
      const status = fixture.fixture?.status?.short ?? "UNKNOWN";
      const competition =
        fixture.league?.name ?? "Unknown competition";

      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
      competitionCounts[competition] =
        (competitionCounts[competition] ?? 0) + 1;
    }

    const filteredFixtures = providerFixtures.filter((fixture) => {
      const status = (
        fixture.fixture?.status?.short ?? "UNKNOWN"
      ).toUpperCase();

      const competition =
        fixture.league?.name ?? "Unknown competition";

      if (requestedStatus && status !== requestedStatus) {
        return false;
      }

      if (
        competitionFilter &&
        !competition.toLowerCase().includes(competitionFilter)
      ) {
        return false;
      }

      return true;
    });

    const totalFiltered = filteredFixtures.length;
    const totalPages = Math.ceil(totalFiltered / limit);
    const startIndex = (page - 1) * limit;

    // Only return the requested page to keep responses manageable.
    const pageFixtures = filteredFixtures.slice(
      startIndex,
      startIndex + limit
    );

    const results = pageFixtures.flatMap((fixture) => {
      const providerId = fixture.fixture?.id;
      const homeName = fixture.teams?.home?.name;
      const awayName = fixture.teams?.away?.name;
      const kickoff = fixture.fixture?.date;

      if (
        !Number.isSafeInteger(providerId) ||
        !homeName ||
        !awayName ||
        !kickoff ||
        Number.isNaN(Date.parse(kickoff))
      ) {
        return [];
      }

      const homeKey = normalizeName(homeName);
      const awayKey = normalizeName(awayName);

      const homeCandidates = teams.filter(
        (team) =>
          team.sportId === footballSport.id &&
          team.isActive &&
          (
            normalizeName(team.name) === homeKey ||
            (team.shortName && normalizeName(team.shortName) === homeKey)
          )
      );

      const awayCandidates = teams.filter(
        (team) =>
          team.sportId === footballSport.id &&
          team.isActive &&
          (
            normalizeName(team.name) === awayKey ||
            (team.shortName && normalizeName(team.shortName) === awayKey)
          )
      );

      // Never guess when a team name has no unique exact match.
      const homeTeam =
        homeCandidates.length === 1 ? homeCandidates[0] : null;

      const awayTeam =
        awayCandidates.length === 1 ? awayCandidates[0] : null;

      const existingProviderMatch = matches.find(
        (match) => match.apiFootballFixtureId === providerId
      );

      const kickoffTime = Date.parse(kickoff);
      const sixHoursMs = 6 * 60 * 60 * 1000;

      // This is only a warning, not proof that two matches are identical.
      // Check both home/away orders for possible existing records.
      const possibleExistingMatch = matches.some((match) => {
        const sameTeams =
          homeTeam !== null &&
          awayTeam !== null &&
          (
            (
              match.homeTeamId === homeTeam.id &&
              match.awayTeamId === awayTeam.id
            ) ||
            (
              match.homeTeamId === awayTeam.id &&
              match.awayTeamId === homeTeam.id
            )
          );

        const sameApproximateTime =
          Math.abs(
            Date.parse(match.scheduledAt) - kickoffTime
          ) < sixHoursMs;

        return sameTeams && sameApproximateTime;
      });

      return [
        {
          fixtureId: providerId,
          date: kickoff,
          status: fixture.fixture?.status?.short ?? "UNKNOWN",
          statusDescription:
            fixture.fixture?.status?.long ?? null,
          competition:
            fixture.league?.name ?? "Unknown competition",
          competitionId: fixture.league?.id ?? null,
          season: fixture.league?.season ?? null,
          venue: fixture.fixture?.venue?.name ?? null,
          homeTeam: homeName,
          awayTeam: awayName,
          homeTeamId: homeTeam?.id ?? null,
          awayTeamId: awayTeam?.id ?? null,
          teamsMatched: Boolean(homeTeam && awayTeam),
          teamReviewRequired: !homeTeam || !awayTeam,
          duplicateByFixtureId: Boolean(existingProviderMatch),
          possibleExistingMatch,
          importEligible:
            Boolean(homeTeam && awayTeam) &&
            !existingProviderMatch &&
            !possibleExistingMatch,
        },
      ];
    });

    return NextResponse.json({
      success: true,
      date,
      filters: {
        status: requestedStatus ?? null,
        competition: competitionFilter || null,
      },
      pagination: {
        page,
        limit,
        totalFiltered,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      totalFixturesFromProvider: providerFixtures.length,
      returnedFixtures: results.length,
      statusCounts,
      competitions: Object.entries(competitionCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      fixtures: results,
      requestsRemaining,
    });
  } catch (error) {
    console.error("Fixture search failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to search fixtures.",
      },
      { status: 500 }
    );
  }
}
