
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requirePermission("predictions:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get("id");
    const fixtureId = Number(rawId);

    if (
      !rawId ||
      !/^\d+$/.test(rawId) ||
      !Number.isSafeInteger(fixtureId) ||
      fixtureId < 1
    ) {
      return NextResponse.json(
        { success: false, message: "Provide a valid fixture ID." },
        { status: 400 }
      );
    }

    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "API key is not configured." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
      {
        headers: {
          "x-apisports-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok || (data.errors && Object.keys(data.errors).length)) {
      return NextResponse.json(
        {
          success: false,
          message: "API-Football could not return this fixture.",
          httpStatus: response.status,
        },
        { status: 502 }
      );
    }

    const fixture = data.response?.[0];

    if (!fixture) {
      return NextResponse.json(
        {
          success: false,
          message: "No fixture was found for that ID.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      preview: {
        fixtureId: fixture.fixture?.id,
        date: fixture.fixture?.date,
        status: fixture.fixture?.status?.short,
        statusDescription: fixture.fixture?.status?.long,
        elapsedMinutes: fixture.fixture?.status?.elapsed,
        competition: fixture.league?.name,
        venue: fixture.fixture?.venue?.name,
        homeTeam: fixture.teams?.home?.name,
        awayTeam: fixture.teams?.away?.name,
        homeScore: fixture.goals?.home,
        awayScore: fixture.goals?.away,
        halfTime: fixture.score?.halftime,
        fullTime: fixture.score?.fulltime,
      },
      requestsRemaining:
        response.headers.get("x-ratelimit-requests-remaining"),
    });
  } catch (error) {
    console.error("Fixture preview failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to preview the fixture.",
      },
      { status: 500 }
    );
  }
}
