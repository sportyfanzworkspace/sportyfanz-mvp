import { NextResponse } from "next/server";
import {
  requirePermission,
  hasPermission,
} from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requirePermission("players:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const [allPlayers, allTeams, allSports, playerTeams] =
      await Promise.all([
        db.orm.public.Player.all(),
        db.orm.public.Team.all(),
        db.orm.public.Sport.all(),
        db.orm.public.PlayerTeam.all(),
      ]);

    const activeSports = new Set(
      allSports.filter((sport) => sport.isActive).map((sport) => sport.id)
    );

    const teams = allTeams
      .filter((team) => activeSports.has(team.sportId))
      .map((team) => {
        const sport = allSports.find(
          (item) => item.id === team.sportId
        );

        return {
          id: team.id,
          name: team.name,
          sportId: team.sportId,
          sportName: sport?.name ?? "Sport",
          isActive: team.isActive,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const players = allPlayers
      .map((player) => ({
        ...player,
        teams: playerTeams
          .filter(
            (relation) =>
              relation.playerId === player.id &&
              relation.leftAt === null
          )
          .map((relation) => {
            const team = teams.find(
              (item) => item.id === relation.teamId
            );

            return team
              ? {
                  id: team.id,
                  name: team.name,
                  sportName: team.sportName,
                }
              : null;
          })
          .filter((team) => team !== null),
      }))
      .sort((a, b) =>
        (a.displayName || `${a.firstName} ${a.lastName}`).localeCompare(
          b.displayName || `${b.firstName} ${b.lastName}`
        )
      );

    return NextResponse.json(
      { success: true, players, teams },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Admin players list failed:", error);

    return NextResponse.json(
      { error: "Unable to load players." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("players:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const body = await request.json();

    const firstName =
      typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName =
      typeof body.lastName === "string" ? body.lastName.trim() : "";
    const displayName =
      typeof body.displayName === "string"
        ? body.displayName.trim()
        : "";
    const position =
      typeof body.position === "string" ? body.position.trim() : "";
    const nationality =
      typeof body.nationality === "string"
        ? body.nationality.trim()
        : "";
    const avatarUrl =
      typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "";
    const jerseyNumber =
      body.jerseyNumber === "" ||
      body.jerseyNumber === null ||
      body.jerseyNumber === undefined
        ? null
        : Number(body.jerseyNumber);
    const teamId =
      body.teamId === "" ||
      body.teamId === null ||
      body.teamId === undefined
        ? null
        : Number(body.teamId);

    if (
      firstName.length < 1 ||
      firstName.length > 80 ||
      lastName.length < 1 ||
      lastName.length > 80
    ) {
      return NextResponse.json(
        { error: "First and last names are required (maximum 80 characters each)." },
        { status: 400 }
      );
    }

    if (displayName.length > 120 || position.length > 80 || nationality.length > 80) {
      return NextResponse.json(
        { error: "Display name, position, or nationality is too long." },
        { status: 400 }
      );
    }

    if (
      jerseyNumber !== null &&
      (!Number.isSafeInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 999)
    ) {
      return NextResponse.json(
        { error: "Jersey number must be a whole number between 0 and 999." },
        { status: 400 }
      );
    }

    if (
      avatarUrl &&
      !/^https?:\/\/\S+$/i.test(avatarUrl)
    ) {
      return NextResponse.json(
        { error: "Avatar URL must begin with http:// or https://." },
        { status: 400 }
      );
    }

    let team = null;

    if (teamId !== null) {
      if (!Number.isSafeInteger(teamId) || teamId < 1) {
        return NextResponse.json(
          { error: "Select a valid team." },
          { status: 400 }
        );
      }

      team = await db.orm.public.Team.where({ id: teamId }).first();

      if (!team || !team.isActive) {
        return NextResponse.json(
          { error: "The selected team is unavailable." },
          { status: 400 }
        );
      }

      const sport = await db.orm.public.Sport
        .where({ id: team.sportId })
        .first();

      if (!sport || !sport.isActive) {
        return NextResponse.json(
          { error: "The selected team's sport is unavailable." },
          { status: 400 }
        );
      }
    }

    const baseSlug = `${firstName}-${lastName}`
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug;
    let suffix = 2;

    while (await db.orm.public.Player.where({ slug }).first()) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const player = await db.transaction(async tx => {
      const selectedTeam = teamId === null
        ? null
        : await tx.orm.public.Team
            .where({ id: teamId })
            .update({ id: teamId });

      if (teamId !== null) {
        if (!selectedTeam || !selectedTeam.isActive) {
          throw new Error("TEAM_UNAVAILABLE");
        }

        if (
          selectedTeam.publicationStatus === "ARCHIVED"
        ) {
          throw new Error("TEAM_UNAVAILABLE");
        }

        if (
          selectedTeam.publicationStatus === "PUBLISHED" &&
          !hasPermission(
            auth.user.staffRole,
            "discovery:publish"
          )
        ) {
          throw new Error("PUBLICATION_PERMISSION_REQUIRED");
        }

        const sport = await tx.orm.public.Sport
          .where({ id: selectedTeam.sportId })
          .first();

        if (!sport || !sport.isActive) {
          throw new Error("SPORT_UNAVAILABLE");
        }
      }

      const created = await tx.orm.public.Player.create({
        firstName,
        lastName,
        displayName: displayName || null,
        slug,
        position: position || null,
        nationality: nationality || null,
        jerseyNumber,
        avatarUrl: avatarUrl || null,
        sportId: selectedTeam?.sportId ?? null,
        publicationStatus: "DRAFT",
        dataSource: "MANUAL",
        isActive: true,
      });

      if (selectedTeam) {
        const joinedAt = new Date().toISOString();

        await tx.orm.public.PlayerTeam.create({
          playerId: created.id,
          teamId: selectedTeam.id,
          joinedAt,
        });

        await tx.orm.public.PlayerCareer.create({
          playerId: created.id,
          teamId: selectedTeam.id,
          joinedAt,
          position: created.position,
          jerseyNumber: created.jerseyNumber,
          dataSource: "MANUAL",
        });
      }

      return created;
    });

    return NextResponse.json(
      { success: true, player },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PUBLICATION_PERMISSION_REQUIRED"
    ) {
      return NextResponse.json(
        { error: "Publication permission is required." },
        { status: 403 }
      );
    }

    if (
      error instanceof Error &&
      (
        error.message === "TEAM_UNAVAILABLE" ||
        error.message === "SPORT_UNAVAILABLE"
      )
    ) {
      return NextResponse.json(
        { error: "The selected team or sport is unavailable." },
        { status: 400 }
      );
    }

    console.error("Admin player creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create this player." },
      { status: 500 }
    );
  }
}