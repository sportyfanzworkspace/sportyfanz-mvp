
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPORT_HOSTS: Record<string, string> = {
  basketball: "https://v1.basketball.api-sports.io",
  baseball: "https://v1.baseball.api-sports.io",
  rugby: "https://v1.rugby.api-sports.io",
  volleyball: "https://v1.volleyball.api-sports.io",
};

type ProviderPayload = {
  errors?: unknown;
  response?: unknown[];
};

function hasProviderErrors(errors: unknown): boolean {
  if (Array.isArray(errors)) return errors.length > 0;
  if (errors && typeof errors === "object") {
    return Object.keys(errors).length > 0;
  }
  return false;
}

async function providerGet(
  baseUrl: string,
  path: string,
  apiKey: string
): Promise<ProviderPayload> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "x-apisports-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Sports provider returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as ProviderPayload;

  if (hasProviderErrors(payload.errors) || !Array.isArray(payload.response)) {
    throw new Error("Invalid response from sports provider.");
  }

  return payload;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ sport: string; fixtureId: string }>;
  }
) {
  try {
    const { sport: rawSport, fixtureId: rawFixtureId } =
      await context.params;

    const sport = rawSport.toLowerCase();
    const baseUrl = SPORT_HOSTS[sport];
    const fixtureId = Number(rawFixtureId);
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!baseUrl) {
      return NextResponse.json(
        { success: false, message: "Sport not supported." },
        { status: 404 }
      );
    }

    if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid fixture ID." },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "Sports data is unavailable." },
        { status: 503 }
      );
    }

    const gamePayload = await providerGet(
      baseUrl,
      `/games?id=${encodeURIComponent(String(fixtureId))}`,
      apiKey
    );

    const game = gamePayload.response?.find(
      (item) =>
        item &&
        typeof item === "object" &&
        "id" in item &&
        item.id === fixtureId
    );

    if (!game) {
      return NextResponse.json(
        { success: false, message: "Match not found." },
        { status: 404 }
      );
    }

    let statistics: Array<{
      team?: { name?: string };
      statistics?: Array<{
        type?: string;
        value?: string | number | null;
      }>;
    }> = [];

    let statisticsAvailable = sport !== "basketball";

    if (sport === "basketball") {
      try {
        const statsPayload = await providerGet(
          baseUrl,
          `/games/statistics/teams?id=${encodeURIComponent(
            String(fixtureId)
          )}`,
          apiKey
        );

        statistics = (statsPayload.response ?? []).flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];

          const item = entry as {
            team?: { name?: string };
            statistics?: Array<{
              type?: string;
              value?: string | number | null;
            }>;
          };

          return [{
            team: { name: item.team?.name ?? "Team" },
            statistics: Array.isArray(item.statistics)
              ? item.statistics
              : [],
          }];
        });

        statisticsAvailable = true;
      } catch (error) {
        console.error("Basketball statistics unavailable:", error);
        statisticsAvailable = false;
      }
    }

    return NextResponse.json(
      {
        success: true,
        sport,
        game,
        statistics,
        dataAvailability: {
          statistics: statisticsAvailable,
        },
        playByPlay: [],
        setScores: [],
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Sport match details failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load match details right now.",
      },
      { status: 502 }
    );
  }
}
