import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://v3.football.api-sports.io";

async function fetchFootballData(
  endpoint: string,
  apiKey: string
) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    headers: {
      "x-apisports-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API-Football returned HTTP ${response.status}.`);
  }

  const payload = await response.json();

  if (
    (Array.isArray(payload.errors) && payload.errors.length > 0) ||
    !Array.isArray(payload.response)
  ) {
    throw new Error("Invalid response from API-Football.");
  }

  return payload.response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fixtureId: string }> }
) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "Football data is unavailable." },
        { status: 503 }
      );
    }

    const { fixtureId: rawFixtureId } = await context.params;
    const fixtureId = Number(rawFixtureId);

    if (!Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid fixture ID." },
        { status: 400 }
      );
    }

    const [fixtures, events, statistics, lineups] = await Promise.all([
      fetchFootballData(`fixtures?id=${fixtureId}`, apiKey),
      fetchFootballData(`fixtures/events?fixture=${fixtureId}`, apiKey),
      fetchFootballData(`fixtures/statistics?fixture=${fixtureId}`, apiKey),
      fetchFootballData(`fixtures/lineups?fixture=${fixtureId}`, apiKey),
    ]);

    const fixture = fixtures[0];

    if (!fixture) {
      return NextResponse.json(
        { success: false, message: "Match not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        fixture,
        events,
        statistics,
        lineups,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error) {
    console.error("Match centre API failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load match details right now.",
      },
      { status: 502 }
    );
  }
}
