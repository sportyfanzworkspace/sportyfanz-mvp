
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SportConfig = {
  baseUrl: string;
  endpoint: string;
  dateParameter: string;
  seasonParameter?: string;
  season?: string;
  dateTimezone?: boolean;
};

const SPORTS: Record<string, SportConfig> = {
  basketball: {
    baseUrl: "https://v1.basketball.api-sports.io",
    endpoint: "/games",
    dateParameter: "date",
    dateTimezone: true,
  },
  baseball: {
    baseUrl: "https://v1.baseball.api-sports.io",
    endpoint: "/games",
    dateParameter: "date",
  },
  rugby: {
    baseUrl: "https://v1.rugby.api-sports.io",
    endpoint: "/games",
    dateParameter: "date",
  },
  volleyball: {
    baseUrl: "https://v1.volleyball.api-sports.io",
    endpoint: "/games",
    dateParameter: "date",
  },
};

type ProviderFixture = {
  id?: number;
  date?: string;
  timezone?: string;
  time?: string;
  status?: {
    short?: string;
    long?: string;
  };
  league?: {
    name?: string;
    season?: string | number;
  };
  country?: {
    name?: string;
  };
  venue?: string | { name?: string } | null;
  teams?: {
    home?: { name?: string; logo?: string | null };
    away?: { name?: string; logo?: string | null };
  };
  scores?: {
    home?: number | { total?: number | null } | null;
    away?: number | { total?: number | null } | null;
  };
};

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function scoreValue(
  value: number | { total?: number | null } | null | undefined
): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value.total === "number") return value.total;
  return null;
}

function mapFixture(fixture: ProviderFixture) {
  if (
    typeof fixture.id !== "number" ||
    !fixture.date ||
    !Number.isFinite(Date.parse(fixture.date)) ||
    !fixture.teams?.home?.name ||
    !fixture.teams?.away?.name
  ) {
    return null;
  }

  const providerStatus = (fixture.status?.short ?? "").toUpperCase();

  let status = "SCHEDULED";

  if (["LIVE", "1H", "2H", "Q1", "Q2", "Q3", "Q4", "IN", "P"].includes(providerStatus)) {
    status = "LIVE";
  } else if (["HT", "BT"].includes(providerStatus)) {
    status = "HALF_TIME";
  } else if (["FT", "AOT", "AP", "AET", "PEN"].includes(providerStatus)) {
    status = "FINISHED";
  } else if (["PST", "POSTP", "SUSP"].includes(providerStatus)) {
    status = "POSTPONED";
  } else if (["CANC", "ABD", "AWD", "WO"].includes(providerStatus)) {
    status = "CANCELLED";
  }

  const venue =
    typeof fixture.venue === "string"
      ? fixture.venue
      : fixture.venue?.name ?? null;

  return {
    id: fixture.id,
    fixtureId: fixture.id,
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    homeTeamShortName: fixture.teams.home.name,
    awayTeamShortName: fixture.teams.away.name,
    homeTeamLogo: fixture.teams.home.logo ?? null,
    awayTeamLogo: fixture.teams.away.logo ?? null,
    competition: fixture.league?.name ?? "Sport",
    country: fixture.country?.name ?? null,
    venue,
    scheduledAt: new Date(fixture.date).toISOString(),
    status,
    providerStatus,
    homeScore: scoreValue(fixture.scores?.home),
    awayScore: scoreValue(fixture.scores?.away),
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ sport: string }> }
) {
  try {
    const { sport: rawSport } = await context.params;
    const sport = rawSport.toLowerCase();
    const config = SPORTS[sport];

    if (!config) {
      return NextResponse.json(
        { success: false, message: "This sport's fixture feed is not configured yet." },
        { status: 404 }
      );
    }

    const key = process.env.API_FOOTBALL_KEY;

    if (!key) {
      return NextResponse.json(
        { success: false, message: "The API-Sports key is not configured." },
        { status: 503 }
      );
    }

    const params = new URL(request.url).searchParams;
    const date = params.get("date");

    if (!validDate(date)) {
      return NextResponse.json(
        { success: false, message: "A valid date in YYYY-MM-DD format is required." },
        { status: 400 }
      );
    }

    const url = new URL(`${config.baseUrl}${config.endpoint}`);
    url.searchParams.set(config.dateParameter, date);

    if (config.dateTimezone) {
      url.searchParams.set("timezone", "Africa/Lagos");
    }

    const response = await fetch(url, {
      headers: {
        "x-apisports-key": key,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}.`);
    }

    const payload = await response.json();
    const errors = payload.errors;

    if (
      (Array.isArray(errors) && errors.length > 0) ||
      (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) ||
      !Array.isArray(payload.response)
    ) {
      console.error(`API-Sports ${sport} error:`, errors);

      return NextResponse.json(
        {
          success: false,
          message: `${sport} fixtures are temporarily unavailable from the provider.`,
        },
        { status: 502 }
      );
    }

    const fixtures = (payload.response as ProviderFixture[])
      .map(mapFixture)
      .filter((fixture) => fixture !== null)
      .filter((fixture) => {
        const localDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Lagos",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(fixture.scheduledAt));

        return localDate === date;
      })
      .sort(
        (a, b) =>
          Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
      );

    return NextResponse.json(
      {
        success: true,
        sport,
        selectedDate: date,
        matches: fixtures,
        liveMatches: fixtures.filter(
          (match) => match.status === "LIVE" || match.status === "HALF_TIME"
        ),
        upcomingMatches: fixtures.filter(
          (match) => match.status === "SCHEDULED"
        ),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Sport fixture feed failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load fixtures for this sport." },
      { status: 502 }
    );
  }
}
