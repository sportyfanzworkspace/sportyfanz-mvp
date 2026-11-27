import { NextResponse } from "next/server";
import {
  requirePermission,
  hasPermission,
} from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import {
  DiscoveryValidationError,
  requiredId,
  optionalText,
  optionalInteger,
} from "@/lib/discovery/validation";

import {
  CareerIntegrityError,
  validateCareerPeriod,
  sameCareerDate,
  sameCareerPeriod,
  careerPeriodsOverlap,
} from "@/lib/discovery/career-integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class SquadError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "SquadError";
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function handleError(error: unknown) {
  if (error instanceof SquadError) {
    return fail(error.message, error.status);
  }

  if (error instanceof DiscoveryValidationError) {
    return fail(error.message);
  }

  if (error instanceof CareerIntegrityError) {
    return fail(error.message, 409);
  }

  if (error instanceof SyntaxError) {
    return fail("Invalid JSON request.");
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (
      error.code === "23505" ||
      error.code === "P2002" ||
      error.code === "40001" ||
      error.code === "40P01"
    )
  ) {
    return fail(
      "A conflicting squad update occurred. Refresh and try again.",
      409
    );
  }

  console.error("Discovery squad management failed:", error);

  return fail("Unable to complete squad operation.", 500);
}

const transferTypes = [
  "PERMANENT_TRANSFER",
  "LOAN",
  "LOAN_RETURN",
  "FREE_TRANSFER",
  "ACADEMY_PROMOTION",
  "NATIONAL_TEAM_SELECTION",
  "OTHER",
];

export async function GET(request: Request) {
  try {
    const auth = await requirePermission("discovery:manage");

    if (!auth.authorized) return auth.response;

    const url = new URL(request.url);

    const teamFilter = url.searchParams.get("teamId");
    const playerFilter = url.searchParams.get("playerId");

    const teamId = teamFilter === null
      ? null
      : requiredId(teamFilter, "Club");

    const playerId = playerFilter === null
      ? null
      : requiredId(playerFilter, "Player");

    const [
      teams,
      players,
      sports,
      memberships,
      careers,
    ] = await Promise.all([
      db.orm.public.Team.all(),
      db.orm.public.Player.all(),
      db.orm.public.Sport.all(),
      teamId !== null
        ? db.orm.public.PlayerTeam.where({ teamId }).all()
        : playerId !== null
          ? db.orm.public.PlayerTeam.where({ playerId }).all()
          : db.orm.public.PlayerTeam.all(),
      teamId !== null
        ? db.orm.public.PlayerCareer.where({ teamId }).all()
        : playerId !== null
          ? db.orm.public.PlayerCareer.where({ playerId }).all()
          : db.orm.public.PlayerCareer.all(),
    ]);

    const teamMap = new Map(
      teams.map(team => [team.id, team])
    );

    const playerMap = new Map(
      players.map(player => [player.id, player])
    );

    const activeSports = new Set(
      sports
        .filter(sport => sport.isActive)
        .map(sport => sport.id)
    );

    function playerName(id: number) {
      const player = playerMap.get(id);

      return player
        ? player.displayName ||
          `${player.firstName} ${player.lastName}`
        : "Unknown player";
    }

    const matchesFilter = (item: {
      teamId: number;
      playerId: number;
    }) =>
      (teamId === null || item.teamId === teamId) &&
      (playerId === null || item.playerId === playerId);

    return NextResponse.json(
      {
        success: true,

        sports: sports.map(sport => ({
          id: sport.id,
          name: sport.name,
          isActive: sport.isActive,
        })).sort((a, b) => a.name.localeCompare(b.name)),

        teams: teams.map(team => ({
          id: team.id,
          name: team.name,
          sportId: team.sportId,
          logoUrl: team.logoUrl,
          publicationStatus: team.publicationStatus,
          isActive: team.isActive &&
            activeSports.has(team.sportId),
        })).sort((a, b) => a.name.localeCompare(b.name)),

        players: players.map(player => ({
          id: player.id,
          name: playerName(player.id),
          sportId: player.sportId,
          position: player.position,
          jerseyNumber: player.jerseyNumber,
          avatarUrl: player.avatarUrl,
          publicationStatus: player.publicationStatus,
          isActive: player.isActive,
        })).sort((a, b) => a.name.localeCompare(b.name)),

        memberships: memberships
          .filter(matchesFilter)
          .map(item => ({
            ...item,
            playerName: playerName(item.playerId),
            teamName:
              teamMap.get(item.teamId)?.name ??
              "Unknown club",
            isCurrent: item.leftAt === null,
          })),

        careers: careers
          .filter(matchesFilter)
          .map(item => ({
            ...item,
            playerName: playerName(item.playerId),
            teamName:
              teamMap.get(item.teamId)?.name ??
              "Unknown club",
          }))
          .sort((a, b) =>
            (b.joinedAt ?? "").localeCompare(
              a.joinedAt ?? ""
            )
          ),
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

    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new SquadError("Invalid request body.");
    }

    const action = body.action;

    if (
      action !== "ASSIGN" &&
      action !== "REMOVE" &&
      action !== "TRANSFER"
    ) {
      throw new SquadError("Invalid squad operation.");
    }

    const playerId = requiredId(body.playerId, "Player");
    const teamId = requiredId(body.teamId, "Club");

    const destinationId = action === "TRANSFER"
      ? requiredId(body.destinationTeamId, "Destination club")
      : null;

    if (destinationId === teamId) {
      throw new SquadError(
        "The source and destination clubs must be different."
      );
    }

    const position = optionalText(
      body.position, "Position", 100
    );

    const jerseyNumber = optionalInteger(
      body.jerseyNumber, "Jersey number", 0, 999
    );

    const notes = optionalText(
      body.notes, "Career notes", 2000
    );

    const transferType = optionalText(
      body.transferType, "Transfer type", 80
    );

    if (
      transferType !== null &&
      !transferTypes.includes(transferType)
    ) {
      throw new SquadError("Invalid transfer classification.");
    }

    const canPublish = hasPermission(
      auth.user.staffRole,
      "discovery:publish"
    );

    const result = await db.transaction(async tx => {
      const player = await tx.orm.public.Player
        .where({ id: playerId })
        .update({ id: playerId });

      if (!player) {
        throw new SquadError("Player not found.", 404);
      }

      // Lock affected clubs in a consistent order.
      const affectedIds = [
        ...new Set([
          teamId,
          ...(destinationId === null ? [] : [destinationId]),
        ]),
      ].sort((a, b) => a - b);

      const lockedTeams = [];

      for (const id of affectedIds) {
        const team = await tx.orm.public.Team
          .where({ id })
          .update({ id });

        if (!team) {
          throw new SquadError("Club not found.", 404);
        }

        lockedTeams.push(team);
      }

      const source = lockedTeams.find(
        team => team.id === teamId
      )!;

      const destination = destinationId === null
        ? null
        : lockedTeams.find(
            team => team.id === destinationId
          )!;

      if (
        !canPublish &&
        (
          player.publicationStatus === "PUBLISHED" ||
          lockedTeams.some(
            team => team.publicationStatus === "PUBLISHED"
          )
        )
      ) {
        throw new SquadError(
          "Publication permission is required.",
          403
        );
      }

      const memberships = await tx.orm.public.PlayerTeam
        .where({ playerId })
        .all();

      const now = new Date().toISOString();

      async function closeMembership(clubId: number) {
        const membership = memberships.find(
          item => item.teamId === clubId
        );

        if (!membership || membership.leftAt !== null) {
          throw new SquadError(
            "The player has no active membership in this club.",
            409
          );
        }

        // Provider memberships may have unknown
        // joining dates. Preserve that uncertainty.
        validateCareerPeriod(membership, now, true);

        const closingPeriod = {
          joinedAt: membership.joinedAt,
          leftAt: now,
        };

        validateCareerPeriod(closingPeriod, now, true);

        const careers = await tx.orm.public.PlayerCareer
          .where({ playerId, teamId: clubId })
          .all();

        for (const career of careers) {
          validateCareerPeriod(career, now, true);
        }

        const openCareers = careers.filter(
          item => item.leftAt === null
        );

        if (openCareers.length > 1) {
          throw new SquadError(
            "Conflicting open career records require review.",
            409
          );
        }

        const openCareer = openCareers[0];

        if (
          openCareer &&
          !(
            (
              openCareer.joinedAt === null &&
              membership.joinedAt === null
            ) ||
            (
              openCareer.joinedAt !== null &&
              membership.joinedAt !== null &&
              sameCareerDate(
                openCareer.joinedAt,
                membership.joinedAt
              )
            )
          )
        ) {
          throw new SquadError(
            "The open career record does not match the membership joining date. Historical review is required.",
            409
          );
        }

        const completedCareers = careers.filter(
          item => item.leftAt !== null
        );

        for (const career of completedCareers) {
          if (closingPeriod.joinedAt === null) {
            throw new SquadError(
              "The unknown joining date cannot be reconciled safely with existing historical career periods.",
              409
            );
          }

          if (
            career.joinedAt === null &&
            career.leftAt !== null &&
            Date.parse(career.leftAt) >
              Date.parse(closingPeriod.joinedAt)
          ) {
            throw new SquadError(
              "An incomplete historical career period requires review before this membership can be closed.",
              409
            );
          }

          if (
            sameCareerPeriod(career, closingPeriod) ||
            careerPeriodsOverlap(career, closingPeriod)
          ) {
            throw new SquadError(
              "A conflicting historical career period requires review.",
              409
            );
          }
        }

        if (openCareer) {
          await tx.orm.public.PlayerCareer
            .where({ id: openCareer.id })
            .update({
              leftAt: now,
              dataSource: "MANUAL",
            });
        } else {
          // Preserve the recorded membership period.
          // Unknown historical profile details remain unset.
          await tx.orm.public.PlayerCareer.create({
            playerId,
            teamId: clubId,
            joinedAt: membership.joinedAt,
            leftAt: now,
            dataSource: "MANUAL",
          });
        }

        await tx.orm.public.PlayerTeam
          .where({ playerId, teamId: clubId })
          .update({
            leftAt: now,
            dataSource: "MANUAL",
          });
      }

      async function assignMembership(
        club: typeof source
      ) {
        if (!player.isActive || !club.isActive) {
          throw new SquadError(
            "The player and destination club must be active."
          );
        }

        if (
          player.publicationStatus === "ARCHIVED" ||
          club.publicationStatus === "ARCHIVED"
        ) {
          throw new SquadError(
            "Archived profiles cannot receive new memberships."
          );
        }

        const sport = await tx.orm.public.Sport
          .where({ id: club.sportId })
          .first();

        if (!sport || !sport.isActive) {
          throw new SquadError(
            "The destination sport is unavailable."
          );
        }

        if (
          player.sportId !== null &&
          player.sportId !== club.sportId
        ) {
          throw new SquadError(
            "The player and club belong to different sports."
          );
        }

        for (const relation of memberships) {
          const existingClub = await tx.orm.public.Team
            .where({ id: relation.teamId })
            .first();

          if (
            !existingClub ||
            existingClub.sportId !== club.sportId
          ) {
            throw new SquadError(
              "An existing club relationship conflicts with this sport.",
              409
            );
          }
        }

        const existing = memberships.find(
          item => item.teamId === club.id
        );

        if (existing && existing.leftAt === null) {
          throw new SquadError(
            "The player is already a member of this club.",
            409
          );
        }

        const careers = await tx.orm.public.PlayerCareer
          .where({ playerId, teamId: club.id })
          .all();

        for (const career of careers) {
          validateCareerPeriod(career, now, true);
        }

        if (careers.some(item => item.leftAt === null)) {
          throw new SquadError(
            "An existing open career record requires review.",
            409
          );
        }

        const newPeriod = {
          joinedAt: now,
          leftAt: null,
        };

        validateCareerPeriod(newPeriod, now);

        for (const career of careers) {
          if (
            sameCareerPeriod(career, newPeriod) ||
            careerPeriodsOverlap(career, newPeriod)
          ) {
            throw new SquadError(
              "The new membership conflicts with an existing career period.",
              409
            );
          }
        }

        if (existing) {
          validateCareerPeriod(existing, now, true);

          const matchesPreviousMembership = (
            item: typeof careers[number]
          ) =>
            sameCareerPeriod(item, existing) ||
            (
              item.joinedAt === null &&
              existing.joinedAt === null &&
              item.leftAt !== null &&
              existing.leftAt !== null &&
              sameCareerDate(item.leftAt, existing.leftAt)
            );

          const matchingCareers = careers.filter(
            matchesPreviousMembership
          );

          if (matchingCareers.length > 1) {
            throw new SquadError(
              "Duplicate historical career records require review.",
              409
            );
          }

          for (const career of careers) {
            if (matchesPreviousMembership(career)) {
              continue;
            }

            if (existing.joinedAt === null) {
              throw new SquadError(
                "The previous unknown joining date conflicts with other historical records and requires review.",
                409
              );
            }

            if (
              career.joinedAt === null &&
              career.leftAt !== null &&
              Date.parse(career.leftAt) >
                Date.parse(existing.joinedAt)
            ) {
              throw new SquadError(
                "An incomplete historical career period requires review.",
                409
              );
            }

            if (careerPeriodsOverlap(career, existing)) {
              throw new SquadError(
                "The previous membership conflicts with an existing career period.",
                409
              );
            }
          }

          if (matchingCareers.length === 0) {
            // Preserve the recorded previous membership.
            // Do not invent missing historical profile details.
            await tx.orm.public.PlayerCareer.create({
              playerId,
              teamId: club.id,
              joinedAt: existing.joinedAt,
              leftAt: existing.leftAt,
              dataSource: "MANUAL",
            });
          }

          await tx.orm.public.PlayerTeam
            .where({ playerId, teamId: club.id })
            .update({
              joinedAt: now,
              leftAt: null,
              observedAt: null,
              dataSource: "MANUAL",
            });
        } else {
          await tx.orm.public.PlayerTeam.create({
            playerId,
            teamId: club.id,
            joinedAt: now,
          });
        }

        if (player.sportId === null) {
          await tx.orm.public.Player
            .where({ id: playerId })
            .update({ sportId: club.sportId });
        }

        await tx.orm.public.PlayerCareer.create({
          playerId,
          teamId: club.id,
          joinedAt: now,
          position: position ?? player.position,
          jerseyNumber: jerseyNumber ?? player.jerseyNumber,
          transferType,
          notes,
          dataSource: "MANUAL",
        });
      }

      if (action === "ASSIGN") {
        await assignMembership(source);
      }

      if (action === "REMOVE") {
        await closeMembership(source.id);
      }

      if (action === "TRANSFER") {
        if (
          !destination ||
          source.sportId !== destination.sportId
        ) {
          throw new SquadError(
            "Transfers must be between clubs in the same sport."
          );
        }

        await closeMembership(source.id);
        await assignMembership(destination);
      }

      return {
        action,
        playerId,
        teamId,
        destinationTeamId: destinationId,
        effectiveAt: now,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(error);
  }
}
