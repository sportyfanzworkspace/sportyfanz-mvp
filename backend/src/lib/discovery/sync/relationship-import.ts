import type {
  DiscoveryImportTransaction,
} from "../imports/transaction";

import type {
  ImportedClub,
} from "../imports/normalize";

import {
  importClub,
  linkClubToSeason,
  type ImportOutcome,
} from "../imports/persist";

import type {
  JobParameters,
} from "./jobs";

export async function importClubWithSeason(
  club: ImportedClub,
  parameters: JobParameters,
  tx: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  const league = parameters.league;
  const season = parameters.season;

  // Standalone club imports do not require
  // a competition relationship.
  if (league == null && season == null) {
    return importClub(club, tx);
  }

  if (league == null) {
    return importClub(club, tx);
  }

  if (
    typeof league !== "number" ||
    !Number.isSafeInteger(league) ||
    league < 1 ||
    season == null
  ) {
    return {
      status: "CONFLICT",
      id: null,
      reason: "Invalid competition relationship.",
    };
  }

  const sport = await tx.orm.public.Sport
    .where({ slug: club.sportSlug })
    .first();

  if (!sport?.isActive) {
    return {
      status: "SKIPPED",
      id: null,
      reason: "Sport unavailable.",
    };
  }

  const competition =
    await tx.orm.public.Competition
      .where({
        providerName: club.providerName,
        providerLeagueId: String(league),
      })
      .first();

  if (
    !competition ||
    !competition.isActive ||
    competition.sportId !== sport.id ||
    competition.dataSource !== "PROVIDER" ||
    competition.publicationStatus === "ARCHIVED"
  ) {
    return {
      status: "CONFLICT",
      id: null,
      reason: "Provider competition unavailable.",
    };
  }

  const seasons =
    await tx.orm.public.CompetitionSeason
      .where({
        competitionId: competition.id,
        providerSeason: String(season),
      })
      .all();

  if (seasons.length !== 1) {
    return {
      status: "CONFLICT",
      id: null,
      reason: "Competition season unavailable or ambiguous.",
    };
  }

  const imported = await importClub(club, tx);

  if (
    imported.status === "CONFLICT" ||
    imported.status === "SKIPPED" ||
    imported.id == null
  ) {
    return imported;
  }

  const linked = await linkClubToSeason(
    imported.id,
    seasons[0].id,
    tx
  );

  if (
    linked.status !== "CREATED" &&
    linked.status !== "EXISTING"
  ) {
    // Abort the shared transaction rather than
    // leave a partially imported relationship.
    throw new Error(
      "Club season relationship could not be persisted."
    );
  }

  if (
    imported.status === "CREATED" ||
    linked.status === "CREATED"
  ) {
    return {
      status: "CREATED",
      id: imported.id,
      reason: "Club or competition relationship created.",
    };
  }

  return {
    status: "EXISTING",
    id: imported.id,
    reason: "Club and competition relationship already exist.",
  };
}
