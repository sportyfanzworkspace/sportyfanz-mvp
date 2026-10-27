
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://v3.football.api-sports.io";

async function fetchFootballData(
  endpoint: string,
  apiKey: string
): Promise<{ data: unknown[]; available: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    const payload = await response.json();

    const errors =
      payload && typeof payload === "object" && "errors" in payload
        ? (payload as { errors?: unknown }).errors
        : undefined;

    const results =
      payload && typeof payload === "object" && "results" in payload
        ? (payload as { results?: unknown }).results
        : undefined;

    const data =
      payload && typeof payload === "object" && "response" in payload
        ? (payload as { response?: unknown }).response
        : undefined;

    console.info("[Football provider diagnostic]", {
      endpoint,
      httpStatus: response.status,
      errors,
      results,
      responseCount: Array.isArray(data) ? data.length : null,
    });

    if (!response.ok || !Array.isArray(data) ||
        (Array.isArray(errors) && errors.length > 0) ||
        (errors && !Array.isArray(errors) &&
          typeof errors === "object" &&
          Object.keys(errors as object).length > 0)) {
      return { data: [], available: false };
    }

    return { data, available: true };
  } catch (error) {
    console.error("[Football provider request failed]", endpoint, error);
    return { data: [], available: false };
  }
}

export async function GET(
  _request: Request,
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

    const fixtureResult = await fetchFootballData(
      `fixtures?id=${fixtureId}`,
      apiKey
    );

    const fixture = fixtureResult.data[0];

    if (!fixtureResult.available) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to retrieve this fixture from the football provider.",
        },
        { status: 502 }
      );
    }

    if (!fixture) {
      return NextResponse.json(
        { success: false, message: "Match not found." },
        { status: 404 }
      );
    }

    const [eventsResult, statisticsResult, lineupsResult] =
      await Promise.all([
        fetchFootballData(
          `fixtures/events?fixture=${fixtureId}`,
          apiKey
        ),
        fetchFootballData(
          `fixtures/statistics?fixture=${fixtureId}`,
          apiKey
        ),
        fetchFootballData(
          `fixtures/lineups?fixture=${fixtureId}`,
          apiKey
        ),
      ]);

    return NextResponse.json(
      {
        success: true,
        fixture,
        events: eventsResult.data,
        statistics: statisticsResult.data,
        lineups: lineupsResult.data,
        dataAvailability: {
          events: eventsResult.available,
          statistics: statisticsResult.available,
          lineups: lineupsResult.available,
        },
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
