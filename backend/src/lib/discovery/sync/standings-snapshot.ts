import {
  importStanding,
  type ImportedStanding,
} from "./standings-import";

import {
  validateProviderObservation,
} from "./freshness";

import type {
  ImportOutcome,
} from "../imports/persist";

import type {
  DiscoveryImportTransaction,
} from "../imports/transaction";

export function validateStandingsSnapshot(
  rows: ImportedStanding[]
): void {
  if (!Array.isArray(rows) || rows.length > 5000) {
    throw new Error("Invalid standings snapshot.");
  }

  if (rows.length === 0) return;

  const first = rows[0];
  const identities = new Set<string>();

  for (const row of rows) {
    if (
      row.sportSlug !== first.sportSlug ||
      row.providerName !== first.providerName ||
      row.providerLeagueId !== first.providerLeagueId ||
      row.providerSeason !== first.providerSeason
    ) {
      throw new Error(
        "Mixed standings snapshot context."
      );
    }

    const identity = JSON.stringify([
      row.providerTeamId,
      row.groupName,
    ]);

    if (identities.has(identity)) {
      throw new Error(
        "Duplicate standings snapshot record."
      );
    }

    identities.add(identity);
  }
}

export async function importStandingsSnapshot(
  rows: ImportedStanding[],
  observedAt: string,
  tx: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  const observation =
    validateProviderObservation(observedAt);

  validateStandingsSnapshot(rows);

  if (rows.length === 0) {
    return {
      status: "SKIPPED",
      id: null,
      reason: "Empty standings snapshot preserved.",
    };
  }

  const first = rows[0];

  const competition =
    await tx.orm.public.Competition
      .where({
        providerName: first.providerName,
        providerLeagueId: String(
          first.providerLeagueId
        ),
      })
      .first();

  if (!competition) {
    return {
      status: "CONFLICT",
      id: null,
      reason: "Standings competition unavailable.",
    };
  }

  const seasons =
    await tx.orm.public.CompetitionSeason
      .where({
        competitionId: competition.id,
        providerSeason: first.providerSeason,
      })
      .all();

  if (seasons.length !== 1) {
    return {
      status: "CONFLICT",
      id: null,
      reason: "Standings season unavailable.",
    };
  }

  const seasonId = seasons[0].id;

  const memberships =
    await tx.orm.public.CompetitionTeam
      .where({ seasonId })
      .all();

  const incoming = new Set<string>();
  const incomingTeams = new Set<number>();

  for (const row of rows) {
    const team =
      await tx.orm.public.Team
        .where({
          providerName: row.providerName,
          providerTeamId: String(
            row.providerTeamId
          ),
        })
        .first();

    if (
      !team ||
      !memberships.some(
        item => item.teamId === team.id
      )
    ) {
      return {
        status: "CONFLICT",
        id: null,
        reason: "Snapshot club dependency missing.",
      };
    }

    incomingTeams.add(team.id);

    incoming.add(JSON.stringify([
      team.id,
      row.groupName,
    ]));
  }

  const existing =
    await tx.orm.public.CompetitionStanding
      .where({ seasonId })
      .all();

  // Reject snapshots missing previously imported
  // provider standings.
  for (const row of existing) {
    if (
      row.dataSource === "PROVIDER" &&
      !incoming.has(JSON.stringify([
        row.teamId,
        row.groupName,
      ]))
    ) {
      return {
        status: "CONFLICT",
        id: null,
        reason: "Incomplete standings snapshot.",
      };
    }
  }

  // Conservatively require coverage of all linked
  // provider-managed, active competition clubs.
  for (const membership of memberships) {
    const team =
      await tx.orm.public.Team
        .where({ id: membership.teamId })
        .first();

    if (
      team?.isActive &&
      team.dataSource === "PROVIDER" &&
      team.providerName === first.providerName &&
      team.publicationStatus !== "ARCHIVED" &&
      !incomingTeams.has(team.id)
    ) {
      return {
        status: "CONFLICT",
        id: null,
        reason: "Snapshot club coverage incomplete.",
      };
    }
  }

  // Reject mixed-freshness snapshots before writing.
  const incomingTime = Date.parse(observation);

  for (const row of existing) {
    if (row.dataSource !== "PROVIDER") continue;

    const previousTime = row.providerObservedAt
      ? Date.parse(row.providerObservedAt)
      : NaN;

    if (!Number.isFinite(previousTime)) {
      return {
        status: "CONFLICT",
        id: null,
        reason: "Legacy standings require reconciliation.",
      };
    }

    if (previousTime > incomingTime) {
      return {
        status: "SKIPPED",
        id: null,
        reason: "Older standings snapshot preserved.",
      };
    }
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const outcome = await importStanding(
      row,
      tx,
      observation
    );

    if (outcome.status === "CONFLICT") {
      // Throw rather than return: the enclosing
      // atomic transaction must roll back all writes.
      throw new Error(
        "Standings snapshot conflict: " +
        outcome.reason
      );
    }

    if (outcome.status === "CREATED") created++;
    if (outcome.status === "UPDATED") updated++;
  }

  return {
    status: updated > 0
      ? "UPDATED"
      : created > 0
        ? "CREATED"
        : "EXISTING",
    id: competition.id,
    reason: "Standings snapshot processed.",
  };
}
