import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

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

export async function GET() {
  try {
    const auth = await getActiveUser();

    if (!auth.userId) {
      return auth.response;
    }

    const userId = auth.userId;

    const [
      allSports,
      allTeams,
      allPlayers,
      playerTeams,
      allMatches,
      sportFollows,
      teamFollows,
      playerFollows,
    ] = await Promise.all([
      db.orm.public.Sport.all(),
      db.orm.public.Team.all(),
      db.orm.public.Player.all(),
      db.orm.public.PlayerTeam.all(),
      db.orm.public.Match.all(),
      db.orm.public.UserSportFollow.all(),
      db.orm.public.UserTeamFollow.all(),
      db.orm.public.UserPlayerFollow.all(),
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
        (team) => team.isActive && activeSports.has(team.sportId)
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
      .filter((player) => player.isActive)
      .map((player) => ({
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        name:
          player.displayName?.trim() ||
          `${player.firstName} ${player.lastName}`.trim(),
        slug: player.slug,
        position: player.position,
        nationality: player.nationality,
        jerseyNumber: player.jerseyNumber,
        avatarUrl: player.avatarUrl,
        teams: teamsByPlayer.get(player.id) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const competitions = [
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

    return NextResponse.json(
      {
        success: true,
        sports,
        teams,
        players,
        competitions,
        followedSportIds: sportFollows
          .filter((item) => item.userId === userId)
          .map((item) => item.sportId),
        followedTeamIds: teamFollows
          .filter((item) => item.userId === userId)
          .map((item) => item.teamId),
        followedPlayerIds: playerFollows
          .filter((item) => item.userId === userId)
          .map((item) => item.playerId),
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

      if (!sport || !sport.isActive) {
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

      if (!team || !team.isActive) {
        return NextResponse.json(
          { error: "This team is not available." },
          { status: 404 }
        );
      }

      const sport = await db.orm.public.Sport
        .where({ id: team.sportId })
        .first();

      if (!sport || !sport.isActive) {
        return NextResponse.json(
          { error: "This team's sport is not available." },
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

      if (!player || !player.isActive) {
        return NextResponse.json(
          { error: "This player is not available." },
          { status: 404 }
        );
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
