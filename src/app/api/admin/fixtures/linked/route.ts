
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requirePermission("predictions:manage");

    if (auth instanceof Response) {
      return auth;
    }

    const matches = await db.orm.public.Match.all();

    const linkedMatches = matches.filter(
      (match) =>
        typeof match.apiFootballFixtureId === "number" &&
        Number.isSafeInteger(match.apiFootballFixtureId) &&
        match.apiFootballFixtureId > 0 &&
        match.matchDataSource === "API_FOOTBALL"
    );

    return NextResponse.json({
      success: true,
      totalMatches: matches.length,
      linkedMatches: linkedMatches.length,
      matches: linkedMatches.map((match) => ({
        id: match.id,
        fixtureId: match.apiFootballFixtureId,
        status: match.status,
        scheduledAt: match.scheduledAt,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      })),
    });
  } catch (error) {
    console.error("Linked fixture diagnostic failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to check linked fixtures." },
      { status: 500 }
    );
  }
}
