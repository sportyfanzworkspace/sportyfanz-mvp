
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
    };
    venue?: {
      name?: string | null;
    };
  };
  league?: {
    name?: string;
  };
  teams?: {
    home?: {
      name?: string;
    };
    away?: {
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

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("predictions:manage");
    if (auth instanceof Response) return auth;

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

    let body: { fixtureIds?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.fixtureIds) ||
      body.fixtureIds.length < 1 ||
      body.fixtureIds.length > 20
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Select between 1 and 20 fixture IDs per import.",
        },
        { status: 400 }
      );
    }

    const fixtureIds = body.fixtureIds as unknown[];

    if (
      fixtureIds.some(
        (id) =>
          typeof id !== "number" ||
          !Number.isSafeInteger(id) ||
          id <= 0
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Every fixture ID must be a positive integer.",
        },
        { status: 400 }
      );
    }

    const ids = Array.from(new Set(fixtureIds as number[]));

    if (ids.length !== fixtureIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Duplicate fixture IDs were submitted. Remove duplicates and retry.",
        },
        { status: 400 }
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

    // Re-fetch selected fixtures directly from the provider.
    // Never trust client-submitted team names, scores, or kickoff times.
    const providerUrl = new URL(
      "https://v3.football.api-sports.io/fixtures"
    );
    providerUrl.searchParams.set("ids", ids.join("-"));
    providerUrl.searchParams.set("timezone", "Africa/Lagos");

    const response = await fetch(providerUrl.toString(), {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const requestsRemaining = response.headers.get(
      "x-ratelimit-requests-remaining"
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify selected fixtures with API-Football.",
          requestsRemaining,
        },
        { status: 502 }
      );
    }

    const payload = await response.json();

    if (
      (Array.isArray(payload.errors) && payload.errors.length > 0) ||
      !Array.isArray(payload.response)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "API-Football returned an invalid fixture response.",
          requestsRemaining,
        },
        { status: 502 }
      );
    }

    const providerFixtures = payload.response as ApiFixture[];
    const providerById = new Map<number, ApiFixture>();

    for (const fixture of providerFixtures) {
      const id = fixture.fixture?.id;

      if (typeof id === "number" && ids.includes(id)) {
        providerById.set(id, fixture);
      }
    }

    const imported: Array<{
      fixtureId: number;
      matchId: number;
      homeTeam: string;
      awayTeam: string;
    }> = [];

    const skipped: Array<{
      fixtureId: number;
      reason: string;
    }> = [];

    for (const fixtureId of ids) {
      const fixture = providerById.get(fixtureId);

      if (!fixture) {
        skipped.push({
          fixtureId,
          reason: "Fixture was not returned by API-Football.",
        });
        continue;
      }

      const homeName = fixture.teams?.home?.name;
      const awayName = fixture.teams?.away?.name;
      const kickoff = fixture.fixture?.date;
      const status = fixture.fixture?.status?.short?.toUpperCase();

      if (!homeName || !awayName || !kickoff || Number.isNaN(Date.parse(kickoff))) {
        skipped.push({
          fixtureId,
          reason: "Fixture is missing valid team names or kickoff time.",
        });
        continue;
      }

      // This first importer accepts only fixtures not yet started.
      // Completed fixtures need a separate, reviewed historical import flow.
      if (status !== "NS" && status !== "TBD") {
        skipped.push({
          fixtureId,
          reason: `Status ${status ?? "UNKNOWN"} is not eligible for this initial importer. Only NS and TBD fixtures can be imported.`,
        });
        continue;
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

      if (homeCandidates.length !== 1 || awayCandidates.length !== 1) {
        skipped.push({
          fixtureId,
          reason: "One or both teams do not have a unique exact match in SportyFanz. Team review is required.",
        });
        continue;
      }

      const homeTeam = homeCandidates[0];
      const awayTeam = awayCandidates[0];

      if (homeTeam.id === awayTeam.id) {
        skipped.push({
          fixtureId,
          reason: "Home and away teams resolved to the same SportyFanz team.",
        });
        continue;
      }

      const alreadyImported = matches.some(
        (match) => match.apiFootballFixtureId === fixtureId
      );

      if (alreadyImported) {
        skipped.push({
          fixtureId,
          reason: "This API-Football fixture ID already exists in SportyFanz.",
        });
        continue;
      }

      const kickoffTime = Date.parse(kickoff);
      const possibleDuplicate = matches.some((match) => {
        const sameTeams =
          (
            match.homeTeamId === homeTeam.id &&
            match.awayTeamId === awayTeam.id
          ) ||
          (
            match.homeTeamId === awayTeam.id &&
            match.awayTeamId === homeTeam.id
          );

        const existingTime = Date.parse(match.scheduledAt);

        return (
          sameTeams &&
          Number.isFinite(existingTime) &&
          Math.abs(existingTime - kickoffTime) < 6 * 60 * 60 * 1000
        );
      });

      if (possibleDuplicate) {
        skipped.push({
          fixtureId,
          reason: "A possible match with the same teams and a nearby kickoff time already exists. Review it before importing.",
        });
        continue;
      }

      try {
        const created = await db.orm.public.Match.create({
          sportId: footballSport.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          competition: fixture.league?.name ?? null,
          venue: fixture.fixture?.venue?.name ?? null,
          apiFootballFixtureId: fixtureId,
          matchDataSource: "API_FOOTBALL_IMPORT_PENDING",
          status: "SCHEDULED",
          scheduledAt: new Date(kickoff).toISOString(),
          homeScore: 0,
          awayScore: 0,
        });

        imported.push({
          fixtureId,
          matchId: created.id,
          homeTeam: homeName,
          awayTeam: awayName,
        });

        // Include successful creations in subsequent duplicate checks
        // within this same request.
        matches.push(created);
      } catch (error) {
        console.error(`Failed to import fixture ${fixtureId}:`, error);

        skipped.push({
          fixtureId,
          reason: "Database creation failed. Check server logs before retrying.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Fixture import request completed.",
      requested: ids.length,
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped,
      requestsRemaining,
      note: "Imported fixtures are pending review and are not eligible for automatic result syncing.",
    });
  } catch (error) {
    console.error("Fixture import failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to import selected fixtures.",
      },
      { status: 500 }
    );
  }
}
