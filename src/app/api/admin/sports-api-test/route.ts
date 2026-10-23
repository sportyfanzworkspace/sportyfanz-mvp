import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "API key is not configured." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/status",
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok || data.errors?.token) {
      return NextResponse.json(
        {
          success: false,
          message: "API-Football authentication failed.",
          httpStatus: response.status,
        },
        { status: 502 }
      );
    }

    if (data.errors && Object.keys(data.errors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "API-Football returned an API error.",
          httpStatus: response.status,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "API-Football connection successful.",
      accountStatusAvailable: Boolean(data.response?.account),
      requestsRemaining:
        response.headers.get("x-ratelimit-requests-remaining"),
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Could not connect to API-Football.",
      },
      { status: 502 }
    );
  }
}