import {
  getApiSportsProvider,
} from "../providers/config";

import {
  importPlayerStatistics,
} from "../imports/player-persist";

import type {
  ProviderPlayerStatistics,
} from "./player-data-adapter";

import type {
  DiscoveryImportTransaction,
} from "../imports/transaction";

import type {
  ImportOutcome,
} from "../imports/persist";

export async function importStatistics(
  sportSlug: string,
  input: ProviderPlayerStatistics,
  tx: DiscoveryImportTransaction,
  observedAt?: string
): Promise<ImportOutcome> {
  const conflict = (
    reason: string
  ): ImportOutcome => ({
    status: "CONFLICT",
    id: null,
    reason,
  });

  const config = getApiSportsProvider(sportSlug);

  if (!config) {
    return conflict("Statistics provider unavailable.");
  }

  const sport = await tx.orm.public.Sport
    .where({ slug: sportSlug })
    .first();

  const player = await tx.orm.public.Player
    .where({
      providerName: config.providerName,
      providerPlayerId: String(
        input.providerPlayerId
      ),
    })
    .first();

  const team = await tx.orm.public.Team
    .where({
      providerName: config.providerName,
      providerTeamId: String(
        input.providerTeamId
      ),
    })
    .first();

  const competition =
    await tx.orm.public.Competition
      .where({
        providerName: config.providerName,
        providerLeagueId: String(
          input.providerLeagueId
        ),
      })
      .first();

  if (
    !sport?.isActive ||
    !player?.isActive ||
    !team?.isActive ||
    !competition?.isActive ||
    player.sportId !== sport.id ||
    team.sportId !== sport.id ||
    competition.sportId !== sport.id ||
    player.dataSource !== "PROVIDER" ||
    team.dataSource !== "PROVIDER" ||
    competition.dataSource !== "PROVIDER" ||
    player.publicationStatus === "ARCHIVED" ||
    team.publicationStatus === "ARCHIVED" ||
    competition.publicationStatus === "ARCHIVED"
  ) {
    return conflict(
      "Statistics dependencies unavailable."
    );
  }

  const seasons =
    await tx.orm.public.CompetitionSeason
      .where({
        competitionId: competition.id,
        providerSeason: input.providerSeason,
      })
      .all();

  if (seasons.length !== 1) {
    return conflict(
      "Statistics season unavailable or ambiguous."
    );
  }

  const seasonId = seasons[0].id;

  const membership =
    await tx.orm.public.CompetitionTeam
      .where({
        seasonId,
        teamId: team.id,
      })
      .first();

  if (!membership) {
    return conflict(
      "Statistics club is not linked to season."
    );
  }

  if (input.metrics.length === 0) {
    return {
      status: "SKIPPED",
      id: player.id,
      reason: "No verified statistics available.",
    };
  }

  const summary = await importPlayerStatistics(
    player.id,
    team.id,
    seasonId,
    input.metrics,
    tx,
    observedAt
  );

  if (summary.conflicts > 0) {
    return {
      status: "CONFLICT",
      id: player.id,
      reason: "Existing statistics conflicts preserved.",
    };
  }

  return {
    status: summary.updated > 0
      ? "UPDATED"
      : summary.created > 0
        ? "CREATED"
        : "EXISTING",
    id: player.id,
    reason: "Player statistics processed.",
  };
}
