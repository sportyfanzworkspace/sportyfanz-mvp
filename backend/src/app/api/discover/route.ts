import {
  loadPublicDirectory,
} from "@/lib/discovery/public-directory";

import {
  DirectoryQueryError,
} from "@/lib/discovery/directory-pagination";

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";
import {
  isPublicDirectoryRecord,
  normalizeCompetitionName,
} from "@/lib/discovery/public-visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FollowType = "sport" | "team" | "player";
type FollowAction = "follow" | "unfollow";

async function getActiveUser() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      ),
    };
  }

  const user = await db.orm.public.User
    .where({ id: userId })
    .first();

  if (!user || user.status !== "ACTIVE") {
    return {
      userId: null,
      response: NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      ),
    };
  }

  return { userId, response: null };
}

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();

    const params = new URL(request.url).searchParams;

    if (params.has("directory")) {
      try {
        const result = await loadPublicDirectory(
          params,
          userId
        );

        return NextResponse.json(result, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        });
      } catch (error) {
        if (error instanceof DirectoryQueryError) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }

        throw error;
      }
    }

    const [
      allSports,
      allTeams,
      allPlayers,
      allCompetitions,
      playerTeams,
      allMatches,
      sportFollows,
      teamFollows,
      playerFollows,
    ] = await Promise.all([
      db.orm.public.Sport.all(),
      db.orm.public.Team.all(),
      db.orm.public.Player.all(),
      db.orm.public.Competition.all(),
      db.orm.public.PlayerTeam.all(),
      db.orm.public.Match.all(),
      userId
        ? db.orm.public.UserSportFollow
            .where({ userId })
            .all()
        : Promise.resolve([]),
      userId
        ? db.orm.public.UserTeamFollow
            .where({ userId })
            .all()
        : Promise.resolve([]),
      userId
        ? db.orm.public.UserPlayerFollow
            .where({ userId })
            .all()
        : Promise.resolve([]),
    ]);

    const sports = allSports
      .filter((sport) => sport.isActive)
      .map((sport) => ({
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
        description: sport.description,
        iconUrl: sport.iconUrl,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const activeSports = new Set(sports.map((sport) => sport.id));

    const teams = allTeams
      .filter(
        (team) =>
          isPublicDirectoryRecord(team, activeSports)
      )
      .map((team) => {
        const sport = sports.find(
          (item) => item.id === team.sportId
        );

        return {
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          slug: team.slug,
          sportId: team.sportId,
          sportName: sport?.name ?? "Sport",
          country: team.country,
          city: team.city,
          logoUrl: team.logoUrl,
          coverUrl: team.coverUrl,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const activeTeamIds = new Set(teams.map((team) => team.id));

    const teamsByPlayer = new Map<number, string[]>();

    for (const relation of playerTeams) {
      if (
        relation.leftAt === null &&
        activeTeamIds.has(relation.teamId)
      ) {
        const team = teams.find(
          (item) => item.id === relation.teamId
        );

        if (team) {
          const existing = teamsByPlayer.get(relation.playerId) ?? [];
          existing.push(team.name);
          teamsByPlayer.set(relation.playerId, existing);
        }
      }
    }

    const players = allPlayers
      .filter((player) =>
        isPublicDirectoryRecord(
          player,
          activeSports,
          true
        )
      )
      .map((player) => ({
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        name:
          player.displayName?.trim() ||
          `${player.firstName} ${player.lastName}`.trim(),
        slug: player.slug,
        sportId: player.sportId,
        sportName:
          sports.find(
            sport => sport.id === player.sportId
          )?.name ?? null,
        position: player.position,
        nationality: player.nationality,
        jerseyNumber: player.jerseyNumber,
        avatarUrl: player.avatarUrl,
        teams: teamsByPlayer.get(player.id) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const competitionProfiles = allCompetitions
      .filter(competition =>
        isPublicDirectoryRecord(
          competition,
          activeSports
        )
      )
      .map(competition => ({
        id: competition.id,
        name: competition.name,
        shortName: competition.shortName,
        slug: competition.slug,
        sportId: competition.sportId,
        sportName:
          sports.find(
            sport => sport.id === competition.sportId
          )?.name ?? "Sport",
        country: competition.country,
        competitionType: competition.competitionType,
        logoUrl: competition.logoUrl,
        coverUrl: competition.coverUrl,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const legacyCompetitions = [
      ...new Set(
        allMatches
          .filter(
            (match) =>
              match.competition &&
              match.competition.trim().length > 0 &&
              match.status !== "CANCELLED"
          )
          .map((match) => match.competition!.trim())
      ),
    ].sort((a, b) => a.localeCompare(b));

    const competitionNames = new Map<string, string>();

    for (const name of legacyCompetitions) {
      const key = normalizeCompetitionName(name);

      if (key && !competitionNames.has(key)) {
        competitionNames.set(key, name);
      }
    }

    for (const competition of competitionProfiles) {
      const key = normalizeCompetitionName(
        competition.name
      );

      if (key) {
        competitionNames.set(key, competition.name);
      }
    }

    const competitions = [...competitionNames.values()]
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json(
      {
        success: true,
        sports,
        teams,
        players,
        competitions,
        competitionProfiles,
        followedSportIds: userId
          ? sportFollows
              .filter((item) => item.userId === userId)
              .map((item) => item.sportId)
          : [],
        followedTeamIds: userId
          ? teamFollows
              .filter((item) => item.userId === userId)
              .map((item) => item.teamId)
          : [],
        followedPlayerIds: userId
          ? playerFollows
              .filter((item) => item.userId === userId)
              .map((item) => item.playerId)
          : [],
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("GET /api/discover error:", error);

    return NextResponse.json(
      { error: "Unable to load Discover data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getActiveUser();

    if (!auth.userId) {
      return auth.response;
    }

    const userId = auth.userId;
    const body = await request.json().catch(() => null);

    const type = body?.type as FollowType;
    const action = body?.action as FollowAction;
    const id = Number(body?.id);

    if (
      !["sport", "team", "player"].includes(type) ||
      !["follow", "unfollow"].includes(action) ||
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "A valid type, positive id, and follow/unfollow action are required.",
        },
        { status: 400 }
      );
    }

    if (type === "sport") {
      const sport = await db.orm.public.Sport
        .where({ id })
        .first();

      if (
        !sport ||
        (action === "follow" && !sport.isActive)
      ) {
        return NextResponse.json(
          { error: "This sport is not available." },
          { status: 404 }
        );
      }

      const existing = await db.orm.public.UserSportFollow
        .where({ userId, sportId: id })
        .first();

      if (action === "follow" && !existing) {
        await db.orm.public.UserSportFollow.create({
          userId,
          sportId: id,
        });
      } else if (action === "unfollow" && existing) {
        await db.orm.public.UserSportFollow
          .where({ userId, sportId: id })
          .delete();
      }
    }

    if (type === "team") {
      const team = await db.orm.public.Team
        .where({ id })
        .first();

      if (!team) {
        return NextResponse.json(
          { error: "This team is not available." },
          { status: 404 }
        );
      }

      const sport = await db.orm.public.Sport
        .where({ id: team.sportId })
        .first();

      const activeSportIds = new Set<number>();

      if (sport?.isActive) {
        activeSportIds.add(sport.id);
      }

      if (
        action === "follow" &&
        !isPublicDirectoryRecord(
          team,
          activeSportIds
        )
      ) {
        return NextResponse.json(
          { error: "This team is not available." },
          { status: 404 }
        );
      }

      const existing = await db.orm.public.UserTeamFollow
        .where({ userId, teamId: id })
        .first();

      if (action === "follow" && !existing) {
        await db.orm.public.UserTeamFollow.create({
          userId,
          teamId: id,
        });
      } else if (action === "unfollow" && existing) {
        await db.orm.public.UserTeamFollow
          .where({ userId, teamId: id })
          .delete();
      }
    }

    if (type === "player") {
      const player = await db.orm.public.Player
        .where({ id })
        .first();

      if (!player) {
        return NextResponse.json(
          { error: "This player is not available." },
          { status: 404 }
        );
      }

      if (action === "follow") {
        const activeSportIds = new Set<number>();

        if (player.sportId !== null) {
          const sport = await db.orm.public.Sport
            .where({ id: player.sportId })
            .first();

          if (sport?.isActive) {
            activeSportIds.add(sport.id);
          }
        }

        if (
          !isPublicDirectoryRecord(
            player,
            activeSportIds,
            true
          )
        ) {
          return NextResponse.json(
            { error: "This player is not available." },
            { status: 404 }
          );
        }
      }

      const existing = await db.orm.public.UserPlayerFollow
        .where({ userId, playerId: id })
        .first();

      if (action === "follow" && !existing) {
        await db.orm.public.UserPlayerFollow.create({
          userId,
          playerId: id,
        });
      } else if (action === "unfollow" && existing) {
        await db.orm.public.UserPlayerFollow
          .where({ userId, playerId: id })
          .delete();
      }
    }

    return NextResponse.json({
      success: true,
      type,
      id,
      action,
      isFollowing: action === "follow",
    });
  } catch (error) {
    console.error("POST /api/discover error:", error);

    return NextResponse.json(
      { error: "Unable to update your follow list." },
      { status: 500 }
    );
  }
}
