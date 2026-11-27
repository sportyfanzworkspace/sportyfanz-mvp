import {
  loadAdminDirectory,
} from "@/lib/discovery/admin-directory";

import {
  DirectoryQueryError,
} from "@/lib/discovery/directory-pagination";

import { NextResponse } from "next/server";
import {
  requirePermission,
  hasPermission,
} from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import {
  DiscoveryValidationError,
  requiredText,
  optionalText,
  optionalInteger,
  optionalHttpsUrl,
  optionalDateOfBirth,
  requiredId,
  createDiscoverySlug,
  publicationStatus,
} from "@/lib/discovery/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

class PlayerProfileUpdateError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "PlayerProfileUpdateError";
  }
}

function handleError(error: unknown) {
  if (error instanceof PlayerProfileUpdateError) {
    return fail(error.message, error.status);
  }

  if (
    error instanceof Error &&
    error.message === "PUBLICATION_PERMISSION_REQUIRED"
  ) {
    return fail("Publication permission is required.", 403);
  }

  if (error instanceof DiscoveryValidationError) {
    return fail(error.message);
  }

  if (error instanceof SyntaxError) {
    return fail("Invalid JSON request.");
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "23505" || error.code === "P2002")
  ) {
    return fail("A conflicting player record already exists.", 409);
  }

  console.error("Discovery player management failed:", error);

  return fail("Unable to complete this operation.", 500);
}

async function readBody(request: Request) {
  const body = await request.json();

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DiscoveryValidationError("Invalid request body.");
  }

  return body as Record<string, unknown>;
}

async function validateSport(value: unknown) {
  const sportId = requiredId(value, "Sport");

  const sport = await db.orm.public.Sport
    .where({ id: sportId })
    .first();

  if (!sport || !sport.isActive) {
    throw new DiscoveryValidationError(
      "Select an available sport."
    );
  }

  return sportId;
}

function profileFields(body: Record<string, unknown>) {
  return {
    firstName: requiredText(body.firstName, "First name", 80),
    lastName: requiredText(body.lastName, "Last name", 80),
    displayName: optionalText(body.displayName, "Display name", 120),
    position: optionalText(body.position, "Position", 100),
    nationality: optionalText(body.nationality, "Nationality", 100),
    biography: optionalText(body.biography, "Biography", 20000),
    achievements: optionalText(body.achievements, "Achievements", 10000),
    dateOfBirth: optionalDateOfBirth(body.dateOfBirth),
    heightCm: optionalInteger(body.heightCm, "Height", 50, 300),
    weightKg: optionalInteger(body.weightKg, "Weight", 15, 500),
    jerseyNumber: optionalInteger(body.jerseyNumber, "Jersey number", 0, 999),
    preferredFoot: optionalText(body.preferredFoot, "Preferred foot", 30),
    avatarUrl: optionalHttpsUrl(body.avatarUrl, "Player photograph"),
    seoTitle: optionalText(body.seoTitle, "SEO title", 70),
    seoDescription: optionalText(body.seoDescription, "SEO description", 180),
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission("discovery:manage");

    if (!auth.authorized) return auth.response;

    const params = new URL(request.url).searchParams;

    if (params.get("paginated") === "1") {
      try {
        const result = await loadAdminDirectory(
          params,
          "players"
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


    const [players, teams, sports, memberships] =
      await Promise.all([
        db.orm.public.Player.all(),
        db.orm.public.Team.all(),
        db.orm.public.Sport.all(),
        db.orm.public.PlayerTeam.all(),
      ]);

    const teamMap = new Map(
      teams.map(team => [team.id, team])
    );

    const sportMap = new Map(
      sports.map(sport => [sport.id, sport.name])
    );

    const membershipMap = new Map<number, typeof memberships>();

    for (const membership of memberships) {
      if (membership.leftAt !== null) continue;

      const entries =
        membershipMap.get(membership.playerId) ?? [];

      entries.push(membership);

      membershipMap.set(membership.playerId, entries);
    }

    return NextResponse.json(
      {
        success: true,
        players: players.map(player => ({
          ...player,
          sportName:
            player.sportId === null
              ? null
              : sportMap.get(player.sportId) ?? null,
          teams: (membershipMap.get(player.id) ?? [])
            .map(membership => teamMap.get(membership.teamId))
            .filter(team => team !== undefined)
            .map(team => ({
              id: team.id,
              name: team.name,
              sportId: team.sportId,
              logoUrl: team.logoUrl,
            })),
        })).sort((a, b) =>
          (a.displayName || `${a.firstName} ${a.lastName}`)
            .localeCompare(
              b.displayName || `${b.firstName} ${b.lastName}`
            )
        ),
        teams: teams.filter(team => team.isActive),
        sports: sports.filter(sport => sport.isActive),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("discovery:manage");

    if (!auth.authorized) return auth.response;

    const body = await readBody(request);
    const fields = profileFields(body);
    const sportId = await validateSport(body.sportId);

    const teamId = optionalInteger(
      body.teamId,
      "Current club",
      1,
      2147483647
    );

    const baseSlug = createDiscoverySlug(
      fields.displayName ||
      `${fields.firstName} ${fields.lastName}`
    );

    let slug = baseSlug;
    let suffix = 2;

    while (
      await db.orm.public.Player.where({ slug }).first()
    ) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const player = await db.transaction(async tx => {
      if (teamId !== null) {
        const team = await tx.orm.public.Team
          .where({ id: teamId })
          .update({ id: teamId });

        if (
          !team ||
          !team.isActive ||
          team.publicationStatus === "ARCHIVED" ||
          team.sportId !== sportId
        ) {
          throw new DiscoveryValidationError(
            "Select an available club belonging to the player's sport."
          );
        }

        if (
          team.publicationStatus === "PUBLISHED" &&
          !hasPermission(
            auth.user.staffRole,
            "discovery:publish"
          )
        ) {
          throw new Error("PUBLICATION_PERMISSION_REQUIRED");
        }
      }

      const created = await tx.orm.public.Player.create({
        ...fields,
        sportId,
        slug,
        publicationStatus: "DRAFT",
        dataSource: "MANUAL",
        isActive: true,
      });

      if (teamId !== null) {
        const joinedAt = new Date().toISOString();

        await tx.orm.public.PlayerTeam.create({
          playerId: created.id,
          teamId,
          joinedAt,
        });

        await tx.orm.public.PlayerCareer.create({
          playerId: created.id,
          teamId,
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
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requirePermission("discovery:manage");

    if (!auth.authorized) return auth.response;

    const body = await readBody(request);
    const id = requiredId(body.id, "Player ID");

    const player = await db.transaction(async tx => {
      async function validateLockedSport(value: unknown) {
        const sportId = requiredId(value, "Sport");

        const sport = await tx.orm.public.Sport
          .where({ id: sportId })
          .first();

        if (!sport || !sport.isActive) {
          throw new DiscoveryValidationError(
            "Select an available sport."
          );
        }

        return sportId;
      }

      const existing = await tx.orm.public.Player
        .where({ id })
        .update({ id });

      if (!existing) {
        throw new PlayerProfileUpdateError("Player not found.", 404);
      }

      if ("teamId" in body) {
        throw new PlayerProfileUpdateError(
          "Club transfers must be handled through squad management."
        );
      }

      if (
        (
          "publicationStatus" in body ||
          existing.publicationStatus === "PUBLISHED"
        ) &&
        !hasPermission(
          auth.user.staffRole,
          "discovery:publish"
        )
      ) {
        throw new PlayerProfileUpdateError("Publication permission is required.", 403);
      }

      const nextStatus =
        "publicationStatus" in body
          ? publicationStatus(body.publicationStatus)
          : existing.publicationStatus;

      const merged = { ...existing };

      for (const key of [
        "firstName",
        "lastName",
        "displayName",
        "position",
        "nationality",
        "biography",
        "achievements",
        "dateOfBirth",
        "heightCm",
        "weightKg",
        "jerseyNumber",
        "preferredFoot",
        "avatarUrl",
        "seoTitle",
        "seoDescription",
      ]) {
        if (key in body) {
          Object.assign(merged, { [key]: body[key] });
        }
      }

      const fields = profileFields(merged);

      let sportId = existing.sportId;

      if ("sportId" in body) {
        const requestedSportId =
          await validateLockedSport(body.sportId);

        if (
          existing.sportId !== null &&
          requestedSportId !== existing.sportId
        ) {
          throw new PlayerProfileUpdateError(
            "The sport of an existing player cannot be changed."
          );
        }

        sportId = requestedSportId;
      }

      if (sportId !== null) {
        const memberships = await tx.orm.public.PlayerTeam
          .where({ playerId: id })
          .all();

        for (const membership of memberships) {
          const team = await tx.orm.public.Team
            .where({ id: membership.teamId })
            .first();

          if (!team || team.sportId !== sportId) {
            throw new PlayerProfileUpdateError(
              "The player's sport conflicts with an existing club relationship."
            );
          }
        }
      }

      if (nextStatus === "PUBLISHED") {
        if (sportId === null) {
          throw new PlayerProfileUpdateError("Select a sport before publishing.");
        }

        await validateLockedSport(sportId);

        if (!existing.isActive) {
          throw new PlayerProfileUpdateError("An inactive player cannot be published.");
        }

        // Player identity and other supplied fields
        // have already been validated by profileFields.
        // Provider profiles do not require fabricated
        // nationality or biographical information.
        if (
          existing.dataSource !== "PROVIDER" &&
          (
            !fields.nationality?.trim() ||
            !fields.biography ||
            fields.biography.trim().length < 50
          )
        ) {
          throw new PlayerProfileUpdateError(
            "Publishing requires a nationality and a biography of at least 50 characters."
          );
        }
      }

      await tx.orm.public.Player
        .where({ id })
        .update({
          ...fields,
          sportId,
          publicationStatus: nextStatus,
          publishedAt:
            nextStatus === "PUBLISHED"
              ? existing.publishedAt ?? new Date().toISOString()
              : null,
        });

      return await tx.orm.public.Player
        .where({ id })
        .first();
    });

    return NextResponse.json({
      success: true,
      player,
    });
  } catch (error) {
    return handleError(error);
  }
}
