import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [allMatches, allTeams, allSports] = await Promise.all([
      db.orm.public.Match.all(),
      db.orm.public.Team.all(),
      db.orm.public.Sport.all(),
    ]);

    const footballSport = allSports.find(
      (sport) => sport.slug === "football" && sport.isActive
    );

    if (!footballSport) {
      return NextResponse.json({
        success: true,
        liveMatches: [],
        upcomingMatches: [],
        message: "Football is not currently available.",
      });
    }

    const activeTeams = new Map(
      allTeams
        .filter(
          (team) =>
            team.sportId === footballSport.id && team.isActive
        )
        .map((team) => [team.id, team])
    );

    const now = Date.now();

    const matches = allMatches
      .filter(
        (match) =>
          match.sportId === footballSport.id &&
          match.matchDataSource === "API_FOOTBALL" &&
          Number.isSafeInteger(match.apiFootballFixtureId) &&
          typeof match.apiFootballFixtureId === "number" &&
          match.apiFootballFixtureId > 0 &&
          match.status !== "CANCELLED" &&
          match.status !== "POSTPONED"
      )
      .map((match) => {
        const homeTeam = activeTeams.get(match.homeTeamId);
        const awayTeam = activeTeams.get(match.awayTeamId);

        return {
          id: match.id,
          fixtureId: match.apiFootballFixtureId,
          homeTeam: homeTeam?.name ?? null,
          awayTeam: awayTeam?.name ?? null,
          homeTeamShortName: homeTeam?.shortName ?? null,
          awayTeamShortName: awayTeam?.shortName ?? null,
          homeTeamLogo: homeTeam?.logoUrl ?? null,
          awayTeamLogo: awayTeam?.logoUrl ?? null,
          competition: match.competition ?? "Football",
          venue: match.venue ?? null,
          scheduledAt: match.scheduledAt,
          startedAt: match.startedAt,
          endedAt: match.endedAt,
          status: match.status,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        };
      })
      .filter(
        (match) => match.homeTeam !== null && match.awayTeam !== null
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() -
          new Date(b.scheduledAt).getTime()
      );

    const liveMatches = matches.filter(
      (match) =>
        match.status === "LIVE" || match.status === "HALF_TIME"
    );

    const upcomingMatches = matches.filter(
      (match) =>
        match.status === "SCHEDULED" &&
        new Date(match.scheduledAt).getTime() >= now
    );

    return NextResponse.json(
      {
        success: true,
        liveMatches,
        upcomingMatches,
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
    console.error("Football match feed failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load football matches.",
      },
      { status: 500 }
    );
  }
}