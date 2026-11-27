import {
  normalizePlayer,
  type ImportedPlayer,
} from "../imports/player-normalize";

import {
  importPlayer,
  importSquadMembership,
} from "../imports/player-persist";

import type {
  ImportOutcome,
} from "../imports/persist";

import type {
  DiscoveryImportTransaction,
} from "../imports/transaction";

export type ImportedSquadPlayer = {
  player: ImportedPlayer;
  providerTeamId: number;
  observedAt: string;
};

function record(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid squad record.");
  }

  return value as Record<string, unknown>;
}

export function expandFootballSquad(
  values: unknown[],
  expectedTeamId: number,
  observedAt: string
): unknown[] {
  const timestamp = Date.parse(observedAt);

  if (
    !Number.isSafeInteger(expectedTeamId) ||
    expectedTeamId < 1 ||
    !Number.isFinite(timestamp) ||
    timestamp > Date.now()
  ) {
    throw new Error("Invalid squad context.");
  }

  if (values.length === 0) return [];

  if (values.length !== 1) {
    throw new Error("Ambiguous squad response.");
  }

  const root = record(values[0]);
  const team = record(root.team);

  if (team.id !== expectedTeamId) {
    throw new Error("Squad team mismatch.");
  }

  if (
    !Array.isArray(root.players) ||
    root.players.length > 5000
  ) {
    throw new Error("Invalid squad players.");
  }

  return root.players.map(player => ({
    player,
    providerTeamId: expectedTeamId,
    observedAt: new Date(timestamp).toISOString(),
  }));
}

export function normalizeSquadPlayer(
  sport: string,
  value: unknown
): ImportedSquadPlayer {
  const fields = record(value);
  const providerTeamId = fields.providerTeamId;
  const observedAt = fields.observedAt;

  if (
    typeof providerTeamId !== "number" ||
    !Number.isSafeInteger(providerTeamId) ||
    providerTeamId < 1 ||
    typeof observedAt !== "string" ||
    !Number.isFinite(Date.parse(observedAt)) ||
    Date.parse(observedAt) > Date.now()
  ) {
    throw new Error("Invalid squad observation.");
  }

  return {
    player: normalizePlayer(sport, fields.player),
    providerTeamId,
    observedAt,
  };
}

export async function importSquadPlayer(
  input: ImportedSquadPlayer,
  tx: DiscoveryImportTransaction
): Promise<ImportOutcome> {
  const sport = await tx.orm.public.Sport
    .where({ slug: input.player.sportSlug })
    .first();

  const team = await tx.orm.public.Team
    .where({
      providerName: input.player.providerName,
      providerTeamId: String(input.providerTeamId),
    })
    .first();

  if (
    !sport?.isActive ||
    !team ||
    !team.isActive ||
    team.sportId !== sport.id ||
    team.dataSource !== "PROVIDER" ||
    team.publicationStatus === "ARCHIVED"
  ) {
    return {
      status: "CONFLICT",
      id: null,
      reason: "Provider squad club unavailable.",
    };
  }

  const imported = await importPlayer(
    input.player,
    tx
  );

  if (
    imported.status === "CONFLICT" ||
    imported.status === "SKIPPED" ||
    imported.id == null
  ) {
    return imported;
  }

  const membership = await importSquadMembership(
    imported.id,
    team.id,
    input.observedAt,
    null,
    tx
  );

  if (
    membership.status !== "CREATED" &&
    membership.status !== "EXISTING"
  ) {
    if (imported.status === "CREATED") {
      throw new Error(
        "New player squad relationship failed."
      );
    }

    return membership;
  }

  return {
    status:
      imported.status === "CREATED" ||
      membership.status === "CREATED"
        ? "CREATED"
        : "EXISTING",
    id: imported.id,
    reason: "Player squad relationship processed.",
  };
}
