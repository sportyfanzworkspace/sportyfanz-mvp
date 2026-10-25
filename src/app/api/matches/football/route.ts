
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiFixture = {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
      long?: string;
      elapsed?: number | null;
    };
    venue?: {
      name?: string | null;
    };
  };
  league?: {
    name?: string;
    country?: string;
  };
  teams?: {
    home?: {
      id?: number;
      name?: string;
      logo?: string | null;
    };
    away?: {
      id?: number;
      name?: string;
      logo?: string | null;
    };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
};

function lagosDateString(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isValidDateString(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function mapFixture(fixture: ApiFixture) {
  const id = fixture.fixture?.id;
  const scheduledAt = fixture.fixture?.date;
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;

  if (
    typeof id !== "number" ||
    !scheduledAt ||
    Number.isNaN(Date.parse(scheduledAt)) ||
    !home?.name ||
    !away?.name
  ) {
    return null;
  }

  const providerStatus =
    fixture.fixture?.status?.short?.toUpperCase() ?? "NS";

    const originalDate = new Date(scheduledAt);

  const isMidnightKickoff =
  originalDate.getHours() === 0 &&
  originalDate.getMinutes() === 0; 

    if ([1493760, 1493762, 1493765, 1494050].includes(id)) {
  console.log("FIXTURE TIME CHECK", {
    id,
    originalDate: fixture.fixture?.date,
    statusShort: fixture.fixture?.status?.short,
    statusLong: fixture.fixture?.status?.long,
    timezone: "Africa/Lagos",
  });
}

  let status:
    | "SCHEDULED"
    | "LIVE"
    | "HALF_TIME"
    | "FINISHED"
    | "POSTPONED"
    | "CANCELLED" = "SCHEDULED";

  if (
    ["1H", "2H", "ET", "P", "BT", "LIVE"].includes(providerStatus)
  ) {
    status = "LIVE";
  } else if (providerStatus === "HT") {
    status = "HALF_TIME";
  } else if (["FT", "AET", "PEN"].includes(providerStatus)) {
    status = "FINISHED";
  } else if (["PST", "POST"].includes(providerStatus)) {
    status = "POSTPONED";
  } else if (["CANC", "CANCELL"].includes(providerStatus)) {
    status = "CANCELLED";
  }

  return {
    id,
    fixtureId: id,
    homeTeam: home.name,
    awayTeam: away.name,
    homeTeamShortName: home.name,
    awayTeamShortName: away.name,
    homeTeamLogo: home.logo ?? null,
    awayTeamLogo: away.logo ?? null,
    competition: fixture.league?.name ?? "Football",
    country: fixture.league?.country ?? null,
    venue: fixture.fixture?.venue?.name ?? null,
    scheduledAt: new Date(scheduledAt).toISOString(),
    status,
    providerStatus,
    elapsed: fixture.fixture?.status?.elapsed ?? null,
    homeScore: fixture.goals?.home ?? null,
    awayScore: fixture.goals?.away ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Football fixtures are temporarily unavailable.",
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedDate = searchParams.get("date");
    const hasSelectedDate = isValidDateString(requestedDate);

    if (requestedDate && !hasSelectedDate) {
      return NextResponse.json(
        {
          success: false,
          message: "The selected date is invalid. Use YYYY-MM-DD.",
        },
        { status: 400 }
      );
    }

    const today = lagosDateString(new Date());
    const startDate = hasSelectedDate ? requestedDate : today;
    const dates = hasSelectedDate
      ? [startDate]
      : [startDate, addDays(startDate, 1)];

    const results = await Promise.all(
      dates.map(async (date) => {
        const providerUrl = new URL(
          "https://v3.football.api-sports.io/fixtures"
        );

        providerUrl.searchParams.set("date", date);
        providerUrl.searchParams.set("timezone", "Africa/Lagos");

        const response = await fetch(providerUrl.toString(), {
          headers: {
            "x-apisports-key": apiKey,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `API-Football returned HTTP ${response.status}.`
          );
        }

        const payload = await response.json();

        if (
          (Array.isArray(payload.errors) &&
            payload.errors.length > 0) ||
          !Array.isArray(payload.response)
        ) {
          console.error(
            "API-Football fixture feed error:",
            payload.errors
          );

          throw new Error("Invalid response from API-Football.");
        }

        return payload.response as ApiFixture[];
      })
    );

     const leaguePriority = [
  "premier league",
  "nigeria premier football league",
  "npfl",
  "laliga",
  "la liga",
  "bundesliga",
  "uefa champions league",
  "champions league",
  "ligue 1",
  "serie a",
];

function getLeaguePriority(competition: string) {
  const name = competition.toLowerCase();

  const index = leaguePriority.findIndex((league) =>
    name.includes(league)
  );

  return index === -1 ? leaguePriority.length : index;
}

const fixtures = results
  .flat()
  .map(mapFixture)
  .filter((fixture) => fixture !== null)
  .sort((a, b) => {
    const priorityDifference =
      getLeaguePriority(a.competition) -
      getLeaguePriority(b.competition);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (
      new Date(a.scheduledAt).getTime() -
      new Date(b.scheduledAt).getTime()
    );
  });

    const liveMatches = fixtures.filter(
      (fixture) =>
        fixture.status === "LIVE" ||
        fixture.status === "HALF_TIME"
    );

    const upcomingMatches = fixtures.filter(
      (fixture) => fixture.status === "SCHEDULED"
    );

    return NextResponse.json(
      {
        success: true,
        liveMatches,
        upcomingMatches,
        selectedDate: hasSelectedDate ? startDate : null,
        dateRange: {
          from: startDate,
          to: dates[dates.length - 1],
          timeZone: "Africa/Lagos",
        },
        counts: {
          live: liveMatches.length,
          upcoming: upcomingMatches.length,
        },
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Football fixture feed failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Football fixtures are temporarily unavailable.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
