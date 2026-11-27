import { getApiSportsProvider } from "../providers/config";
import { normalizeSeason } from "../imports/normalize";
import type { ImportedStanding } from "./standings-import";

const supportedSports = new Set([
  "basketball",
  "baseball",
  "rugby",
  "volleyball",
]);

function record(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid standings record.");
  }

  return value as Record<string, unknown>;
}

function optionalRecord(
  value: unknown
): Record<string, unknown> {
  return value == null ? {} : record(value);
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
    throw new Error("Invalid standings statistic.");
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

function optionalLabel(
  value: unknown
): string | null {
  if (value == null) return null;

  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 150
  ) {
    throw new Error("Invalid standings group.");
  }

  return value.trim();
}

function provider(sport: string) {
  if (!supportedSports.has(sport)) {
    throw new Error("Unsupported standings sport.");
  }

  const config = getApiSportsProvider(sport);

  if (!config) {
    throw new Error("Standings provider unavailable.");
  }

  return config;
}

export function expandMultisportStandings(
  sport: string,
  values: unknown[],
  expectedLeagueId: number,
  expectedSeason: string
): unknown[] {
  provider(sport);

  integer(expectedLeagueId, 1);

  const season =
    normalizeSeason(expectedSeason).providerSeason;

  const rows: unknown[] = [];

  for (const group of values) {
    if (!Array.isArray(group)) {
      throw new Error("Invalid standings group.");
    }

    for (const value of group) {
      const fields = record(value);
      const league = record(fields.league);

      if (
        league.id !== expectedLeagueId ||
        String(league.season) !== season
      ) {
        throw new Error("Standings context mismatch.");
      }

      rows.push(value);

      if (rows.length > 5000) {
        throw new Error("Standings limit exceeded.");
      }
    }
  }

  return rows;
}

export function normalizeMultisportStanding(
  sport: string,
  value: unknown
): ImportedStanding {
  const config = provider(sport);

  const fields = record(value);
  const team = record(fields.team);
  const league = record(fields.league);

  const games = optionalRecord(fields.games);
  const wins = optionalRecord(games.win);
  const losses = optionalRecord(games.lose);
  const draws = optionalRecord(games.draw);
  const group = optionalRecord(fields.group);

  const scoring = optionalRecord(
    sport === "basketball" || sport === "baseball"
      ? fields.points
      : fields.goals
  );

  const groupName = JSON.stringify([
    optionalLabel(fields.stage),
    optionalLabel(group.name),
  ]);

  if (groupName.length > 150) {
    throw new Error("Standings group too long.");
  }

  const played = optionalInteger(games.played);
  const won = optionalInteger(wins.total);
  const lost = optionalInteger(losses.total);
  const drawn = optionalInteger(draws.total);

  const knownResults = [won, lost, drawn]
    .filter((item): item is number => item !== null)
    .reduce((sum, item) => sum + item, 0);

  if (
    played !== null &&
    knownResults > played
  ) {
    throw new Error("Inconsistent game totals.");
  }

  const scored = optionalInteger(scoring.for);
  const conceded = optionalInteger(scoring.against);

  const rankingPoints =
    sport === "basketball"
      ? group.points
      : sport === "baseball"
        ? null
        : fields.points;

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
    providerLeagueId: integer(league.id, 1),
    providerSeason:
      normalizeSeason(league.season).providerSeason,
    providerTeamId: integer(team.id, 1),
    groupName,
    rank: integer(fields.position, 1),
    played,
    won,
    drawn,
    lost,
    scored,
    conceded,
    difference:
      scored !== null && conceded !== null
        ? scored - conceded
        : null,
    points: optionalInteger(
      rankingPoints,
      -2147483648
    ),
    form: form as string | null,
  };
}
