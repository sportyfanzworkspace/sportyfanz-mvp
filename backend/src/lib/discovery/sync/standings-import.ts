import {
  decideProviderFreshness,
  validateProviderObservation,
} from "./freshness";

import {
  getApiSportsProvider,
} from "../providers/config";

import type {
  DiscoveryImportTransaction,
} from "../imports/transaction";

import type {
  ImportOutcome,
} from "../imports/persist";

export type ImportedStanding = {
  sportSlug: string;
  providerName: string;
  providerLeagueId: number;
  providerSeason: string;
  providerTeamId: number;
  groupName: string;
  rank: number;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  scored: number | null;
  conceded: number | null;
  difference: number | null;
  points: number | null;
  form: string | null;
};

function record(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid standings record.");
  }

  return value as Record<string, unknown>;
}

function integer(
  value: unknown,
  minimum = 0
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > 2147483647
  ) {
    throw new Error("Invalid standings number.");
  }

  return value;
}

function optionalInteger(
  value: unknown,
  minimum = 0
): number | null {
  return value == null
    ? null
    : integer(value, minimum);
}

export function expandFootballStandings(
  values: unknown[],
  expectedLeagueId: number,
  expectedSeason: string
): unknown[] {
  integer(expectedLeagueId, 1);

  if (
    !/^\d{4}$/.test(expectedSeason) ||
    Number(expectedSeason) < 1900 ||
    Number(expectedSeason) > 2200
  ) {
    throw new Error("Invalid standings season.");
  }

  if (values.length === 0) return [];

  if (values.length !== 1) {
    throw new Error("Ambiguous standings response.");
  }

  const root = record(values[0]);
  const league = record(root.league);

  if (
    league.id !== expectedLeagueId ||
    String(league.season) !== expectedSeason
  ) {
    throw new Error("Standings context mismatch.");
  }

  if (!Array.isArray(league.standings)) {
    throw new Error("Missing standings groups.");
  }

  const rows: unknown[] = [];

  for (const group of league.standings) {
    if (!Array.isArray(group)) {
      throw new Error("Invalid standings group.");
    }

    for (const item of group) {
      rows.push({
        standing: item,
        providerLeagueId: expectedLeagueId,
        providerSeason: expectedSeason,
      });

      if (rows.length > 5000) {
        throw new Error("Standings limit exceeded.");
      }
    }
  }

  return rows;
}

export function normalizeFootballStanding(
  value: unknown
): ImportedStanding {
  const config = getApiSportsProvider("football");

  if (!config) {
    throw new Error("Football provider unavailable.");
  }

  const root = record(value);
  const fields = record(root.standing);
  const team = record(fields.team);

  const totals =
    fields.all == null
      ? {}
      : record(fields.all);

  const goals =
    totals.goals == null
      ? {}
      : record(totals.goals);

  const groupName =
    fields.group == null
      ? "Overall"
      : fields.group;

  if (
    typeof groupName !== "string" ||
    !groupName.trim() ||
    groupName.length > 150
  ) {
    throw new Error("Invalid standings group name.");
  }

  const providerSeason = root.providerSeason;

  if (
    typeof providerSeason !== "string" ||
    !/^\d{4}$/.test(providerSeason) ||
    Number(providerSeason) < 1900 ||
    Number(providerSeason) > 2200
  ) {
    throw new Error("Invalid provider season.");
  }

  const form = fields.form ?? null;

  if (
    form !== null &&
    (
      typeof form !== "string" ||
      !/^[WDL]{1,30}$/.test(form)
    )
  ) {
    throw new Error("Invalid standings form.");
  }

  return {
    sportSlug: config.sportSlug,
    providerName: config.providerName,
    providerLeagueId: integer(
      root.providerLeagueId,
      1
    ),
    providerSeason,
    providerTeamId: integer(team.id, 1),
    groupName: groupName.trim(),
    rank: integer(fields.rank, 1),
    played: optionalInteger(totals.played),
    won: optionalInteger(totals.win),
    drawn: optionalInteger(totals.draw),
    lost: optionalInteger(totals.lose),
    scored: optionalInteger(goals.for),
    conceded: optionalInteger(goals.against),
    difference: optionalInteger(
      fields.goalsDiff,
      -2147483648
    ),
    points: optionalInteger(
      fields.points,
      -2147483648
    ),
    form: form as string | null,
  };
}

export async function importStanding(
  input: ImportedStanding,
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

  const config = getApiSportsProvider(
    input.sportSlug
  );

  if (
    !config ||
    config.providerName !== input.providerName
  ) {
    return conflict("Invalid standings provider.");
  }

  const sport = await tx.orm.public.Sport
    .where({ slug: input.sportSlug })
    .first();

  const competition =
    await tx.orm.public.Competition
      .where({
        providerName: input.providerName,
        providerLeagueId: String(
          input.providerLeagueId
        ),
      })
      .first();

  const team = await tx.orm.public.Team
    .where({
      providerName: input.providerName,
      providerTeamId: String(
        input.providerTeamId
      ),
    })
    .first();

  if (
    !sport?.isActive ||
    !competition?.isActive ||
    !team?.isActive ||
    competition.sportId !== sport.id ||
    team.sportId !== sport.id ||
    competition.dataSource !== "PROVIDER" ||
    team.dataSource !== "PROVIDER" ||
    competition.publicationStatus === "ARCHIVED" ||
    team.publicationStatus === "ARCHIVED"
  ) {
    return conflict(
      "Standings dependencies unavailable."
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
      "Standings season unavailable or ambiguous."
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
      "Club is not linked to competition season."
    );
  }

  const previous =
    await tx.orm.public.CompetitionStanding
      .where({
        seasonId,
        teamId: team.id,
        groupName: input.groupName,
      })
      .first();

  const fields = {
    rank: input.rank,
    played: input.played,
    won: input.won,
    drawn: input.drawn,
    lost: input.lost,
    scored: input.scored,
    conceded: input.conceded,
    difference: input.difference,
    points: input.points,
    form: input.form,
  };

  const observation = observedAt === undefined
    ? null
    : validateProviderObservation(observedAt);

  if (previous) {
    const unchanged = Object.entries(fields)
      .every(([key, value]) =>
        previous[key as keyof typeof fields] === value
      );

    // Preserve the legacy create-only import behavior
    // when no verified observation is supplied.
    if (!observation) {
      if (previous.dataSource !== "PROVIDER") {
        return conflict(
          "Manual standings record preserved."
        );
      }

      return unchanged
        ? {
            status: "EXISTING",
            id: previous.id,
            reason: "Standings record unchanged.",
          }
        : conflict(
            "Verified snapshot observation required."
          );
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
      return {
        status: "EXISTING",
        id: previous.id,
        reason: decision,
      };
    }

    if (
      decision !== "UPDATE" &&
      decision !== "ADVANCE_OBSERVATION"
    ) {
      return conflict(decision);
    }

    const updated =
      await tx.orm.public.CompetitionStanding
        .where({
          id: previous.id,
          dataSource: "PROVIDER",
          providerObservedAt: previous.providerObservedAt,
          updatedAt: previous.updatedAt,
        })
        .update({
          ...(decision === "UPDATE" ? fields : {}),
          providerObservedAt: observation,
        });

    if (!updated) {
      throw new Error(
        "Concurrent standings modification detected."
      );
    }

    return {
      status: "UPDATED",
      id: previous.id,
      reason: decision,
    };
  }

  const created =
    await tx.orm.public.CompetitionStanding.create({
      seasonId,
      teamId: team.id,
      groupName: input.groupName,
      ...fields,
      dataSource: "PROVIDER",
      providerObservedAt: observation,
    });

  return {
    status: "CREATED",
    id: created.id,
    reason: "Standings record imported.",
  };
}
