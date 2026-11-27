import {
  decideProviderFreshness,
  validateProviderObservation,
} from "../sync/freshness";

import {
  withImportTransaction,
  type DiscoveryImportTransaction,
} from "./transaction";

import {
  createDiscoverySlug,
  normalizeSearch,
  requiredId,
} from "../validation";

import {
  getApiSportsProvider,
} from "../providers/config";

import type {
  ImportOutcome,
} from "./persist";

import {
  normalizeCareer,
  normalizeMetrics,
  type ImportedPlayer,
  type ImportedCareer,
  type ImportedMetric,
} from "./player-normalize";

function result(
  status: ImportOutcome["status"],
  id: number | null,
  reason: string
): ImportOutcome {
  return { status, id, reason };
}

function validId(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}

export async function importPlayer(
  input: ImportedPlayer,
  transaction?: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  const config = getApiSportsProvider(
    input.sportSlug
  );

  if (
    !config ||
    config.sportSlug !== input.sportSlug ||
    config.providerName !== input.providerName ||
    !validId(input.providerPlayerId) ||
    !input.displayName.trim()
  ) {
    return result(
      "SKIPPED",
      null,
      "Invalid player provider identity."
    );
  }

  return withImportTransaction(transaction, async tx => {
    const sport = await tx.orm.public.Sport
      .where({ slug: input.sportSlug })
      .first();

    if (!sport || !sport.isActive) {
      return result(
        "SKIPPED",
        null,
        "Sport unavailable."
      );
    }

    const existing = await tx.orm.public.Player
      .where({
        providerName: input.providerName,
        providerPlayerId: String(
          input.providerPlayerId
        ),
      })
      .first();

    if (existing) {
      if (existing.sportId !== sport.id) {
        return result(
          "CONFLICT",
          existing.id,
          "Player provider sport mismatch."
        );
      }

      return result(
        "EXISTING",
        existing.id,
        "Existing player preserved."
      );
    }

    // Check manual profiles, including legacy
    // profiles without an assigned sport.
    const manualPlayers =
      await tx.orm.public.Player
        .where({ dataSource: "MANUAL" })
        .all();

    const incomingName = normalizeSearch(
      input.displayName
    );

    const possibleMatch = manualPlayers.some(
      player => {
        if (
          player.sportId !== null &&
          player.sportId !== sport.id
        ) {
          return false;
        }

        const names = [
          player.displayName ?? "",
          `${player.firstName} ${player.lastName}`,
        ];

        return names.some(
          name =>
            normalizeSearch(name) === incomingName
        );
      }
    );

    if (possibleMatch) {
      return result(
        "CONFLICT",
        null,
        "Potential manual player requires identity verification."
      );
    }

    const slug = createDiscoverySlug(
      `${input.sportSlug}-${input.displayName}-${input.providerPlayerId}`
    );

    const slugConflict =
      await tx.orm.public.Player
        .where({ slug })
        .first();

    if (slugConflict) {
      return result(
        "CONFLICT",
        slugConflict.id,
        "Player slug already exists."
      );
    }

    const player =
      await tx.orm.public.Player.create({
        sportId: sport.id,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.displayName,
        slug,
        nationality: input.nationality,
        position: input.position,
        jerseyNumber: input.jerseyNumber,
        avatarUrl: input.avatarUrl,
        dateOfBirth: input.dateOfBirth,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        providerName: input.providerName,
        providerPlayerId: String(
          input.providerPlayerId
        ),
        dataSource: "PROVIDER",
        publicationStatus: "PUBLISHED",
        publishedAt: new Date().toISOString(),
        isActive: true,
        lastSyncedAt: new Date().toISOString(),
      });

    return result(
      "CREATED",
      player.id,
      "Player profile imported."
    );
  });
}

type DirectoryIdentity = {
  sportId: number | null;
  providerName: string | null;
  dataSource: "MANUAL" | "PROVIDER";
  isActive: boolean;
  publicationStatus: string;
};

function compatible(
  player: DirectoryIdentity,
  team: DirectoryIdentity
): boolean {
  return (
    player.isActive &&
    team.isActive &&
    player.publicationStatus !== "ARCHIVED" &&
    team.publicationStatus !== "ARCHIVED" &&
    player.sportId !== null &&
    player.sportId === team.sportId &&
    player.dataSource === "PROVIDER" &&
    team.dataSource === "PROVIDER" &&
    !!player.providerName &&
    player.providerName === team.providerName
  );
}

export async function importSquadMembership(
  playerId: number,
  teamId: number,
  observedAt: string,
  joinedAt: string | null = null,
  transaction?: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  if (
    !validId(playerId) ||
    !validId(teamId)
  ) {
    return result(
      "SKIPPED",
      null,
      "Invalid squad identity."
    );
  }

  const observed = new Date(observedAt);

  if (
    !Number.isFinite(observed.getTime()) ||
    observed.getTime() > Date.now()
  ) {
    return result(
      "SKIPPED",
      null,
      "Invalid squad observation date."
    );
  }

  let verifiedJoiningDate: string | null = null;

  if (joinedAt !== null) {
    try {
      verifiedJoiningDate = normalizeCareer({
        joinedAt,
      }).joinedAt;

      if (
        verifiedJoiningDate === null ||
        Date.parse(verifiedJoiningDate) >
          observed.getTime()
      ) {
        throw new Error("Invalid joining date.");
      }
    } catch {
      return result(
        "SKIPPED",
        null,
        "Invalid verified joining date."
      );
    }
  }

  return withImportTransaction(transaction, async tx => {
    const player = await tx.orm.public.Player
      .where({ id: playerId })
      .first();

    const team = await tx.orm.public.Team
      .where({ id: teamId })
      .first();

    if (
      !player ||
      !team ||
      !compatible(player, team)
    ) {
      return result(
        "CONFLICT",
        null,
        "Unverified squad relationship."
      );
    }

    const sport = await tx.orm.public.Sport
      .where({ id: team.sportId })
      .first();

    if (!sport?.isActive) {
      return result(
        "SKIPPED",
        null,
        "Sport inactive."
      );
    }

    const existing =
      await tx.orm.public.PlayerTeam
        .where({ playerId, teamId })
        .first();

    if (existing) {
      return result(
        existing.leftAt
          ? "CONFLICT"
          : "EXISTING",
        playerId,
        existing.leftAt
          ? "Historical membership requires reconciliation."
          : "Squad membership already exists."
      );
    }

    // A current squad observation is not proof
    // of the player's actual signing date.
    await tx.orm.public.PlayerTeam.create({
      playerId,
      teamId,
      joinedAt: verifiedJoiningDate,
      observedAt: observed.toISOString(),
      leftAt: null,
      dataSource: "PROVIDER",
    });

    return result(
      "CREATED",
      playerId,
      "Verified squad observation imported."
    );
  });
}

export async function importCareer(
  playerId: number,
  teamId: number,
  input: ImportedCareer,
  transaction?: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  requiredId(playerId, "Player ID");
  requiredId(teamId, "Team ID");

  const career = normalizeCareer({
    ...input,
    joinedAt: input.joinedAt?.slice(0, 10),
    leftAt: input.leftAt?.slice(0, 10),
  });

  if (!career.joinedAt && !career.leftAt) {
    return result(
      "SKIPPED",
      null,
      "No verified career dates available."
    );
  }

  return withImportTransaction(transaction, async tx => {
    // Serialize career imports for this player.
    const player = await tx.orm.public.Player
      .where({ id: playerId })
      .update({ id: playerId });

    const team = await tx.orm.public.Team
      .where({ id: teamId })
      .first();

    if (
      !player ||
      !team ||
      !compatible(player, team)
    ) {
      return result(
        "CONFLICT",
        null,
        "Unverified career relationship."
      );
    }

    const sport = await tx.orm.public.Sport
      .where({ id: team.sportId })
      .first();

    if (!sport?.isActive) {
      return result(
        "SKIPPED",
        null,
        "Sport inactive."
      );
    }

    const existing =
      await tx.orm.public.PlayerCareer
        .where({ playerId, teamId })
        .all();

    if (
      existing.some(
        item => item.dataSource === "MANUAL"
      )
    ) {
      return result(
        "CONFLICT",
        null,
        "Manual career history preserved."
      );
    }

    function sameDate(
      a: string | null,
      b: string | null
    ): boolean {
      if (a === null || b === null) {
        return a === b;
      }

      return Date.parse(a) === Date.parse(b);
    }

    const duplicate = existing.find(
      item =>
        sameDate(
          item.joinedAt,
          career.joinedAt
        ) &&
        sameDate(
          item.leftAt,
          career.leftAt
        )
    );

    if (duplicate) {
      return result(
        "EXISTING",
        duplicate.id,
        "Career period already exists."
      );
    }

    const overlaps = existing.some(item => {
      const start = item.joinedAt
        ? Date.parse(item.joinedAt)
        : -Infinity;

      const end = item.leftAt
        ? Date.parse(item.leftAt)
        : Infinity;

      const incomingStart = career.joinedAt
        ? Date.parse(career.joinedAt)
        : -Infinity;

      const incomingEnd = career.leftAt
        ? Date.parse(career.leftAt)
        : Infinity;

      return (
        incomingStart <= end &&
        start <= incomingEnd
      );
    });

    if (overlaps) {
      return result(
        "CONFLICT",
        null,
        "Overlapping career period."
      );
    }

    const stored =
      await tx.orm.public.PlayerCareer.create({
        playerId,
        teamId,
        ...career,
        dataSource: "PROVIDER",
      });

    return result(
      "CREATED",
      stored.id,
      "Verified career period imported."
    );
  });
}

export async function importPlayerStatistics(
  playerId: number,
  teamId: number,
  seasonId: number,
  input: ImportedMetric[],
  transaction?: DiscoveryImportTransaction,
  observedAt?: string
): Promise<{
  created: number;
  updated: number;
  existing: number;
  conflicts: number;
}> {
  requiredId(playerId, "Player ID");
  requiredId(teamId, "Team ID");
  requiredId(seasonId, "Season ID");

  const observation = observedAt === undefined
    ? null
    : validateProviderObservation(observedAt);

  const metrics = normalizeMetrics(input);

  if (metrics.length > 200) {
    throw new Error("Too many player metrics.");
  }

  return withImportTransaction(transaction, async tx => {
    const player = await tx.orm.public.Player
      .where({ id: playerId })
      .first();

    const team = await tx.orm.public.Team
      .where({ id: teamId })
      .first();

    const season =
      await tx.orm.public.CompetitionSeason
        .where({ id: seasonId })
        .first();

    if (
      !player ||
      !team ||
      !season ||
      !compatible(player, team)
    ) {
      throw new Error(
        "Invalid statistics relationship."
      );
    }

    const competition =
      await tx.orm.public.Competition
        .where({ id: season.competitionId })
        .first();

    if (
      !competition ||
      !compatible(player, competition)
    ) {
      throw new Error(
        "Statistics competition mismatch."
      );
    }

    const sport = await tx.orm.public.Sport
      .where({ id: team.sportId })
      .first();

    if (!sport?.isActive) {
      throw new Error("Sport inactive.");
    }

    const membership =
      await tx.orm.public.CompetitionTeam
        .where({ seasonId, teamId })
        .first();

    if (!membership) {
      throw new Error(
        "Club is not linked to this season."
      );
    }

    const existing =
      await tx.orm.public.PlayerStatistics
        .where({
          playerId,
          teamId,
          seasonId,
        })
        .all();

    const summary = {
      created: 0,
      updated: 0,
      existing: 0,
      conflicts: 0,
    };

    for (const metric of metrics) {
      const previous = existing.find(
        item =>
          item.metricKey === metric.metricKey
      );

      if (previous) {
        const unchanged =
          previous.metricValue === metric.metricValue &&
          previous.metricLabel === metric.metricLabel;

        if (!observation) {
          if (
            previous.dataSource !== "PROVIDER" ||
            !unchanged
          ) {
            summary.conflicts++;
          } else {
            summary.existing++;
          }

          continue;
        }

        const decision = decideProviderFreshness(
          previous,
          observation,
          unchanged
        );

        if (
          decision === "UNCHANGED" ||
          decision === "STALE"
        ) {
          summary.existing++;
          continue;
        }

        if (
          decision !== "UPDATE" &&
          decision !== "ADVANCE_OBSERVATION"
        ) {
          summary.conflicts++;
          continue;
        }

        const updated =
          await tx.orm.public.PlayerStatistics
            .where({
              id: previous.id,
              dataSource: "PROVIDER",
              providerObservedAt: previous.providerObservedAt,
              updatedAt: previous.updatedAt,
            })
            .update({
              ...(decision === "UPDATE" ? metric : {}),
              providerObservedAt: observation,
            });

        if (!updated) {
          throw new Error(
            "Concurrent statistics modification detected."
          );
        }

        summary.updated++;
        continue;
      }

      await tx.orm.public.PlayerStatistics.create({
        playerId,
        teamId,
        seasonId,
        ...metric,
        dataSource: "PROVIDER",
        providerObservedAt: observation,
      });

      summary.created++;
    }

    return summary;
  });
}
