import {
  normalizeCareer,
  normalizeMetrics,
  type ImportedCareer,
  type ImportedMetric,
} from "../imports/player-normalize";

export type ProviderPlayerStatistics = {
  providerPlayerId: number;
  providerTeamId: number;
  providerLeagueId: number;
  providerSeason: string;
  metrics: ImportedMetric[];
};

export type ProviderCareerEvent = {
  providerPlayerId: number;
  fromTeamId: number | null;
  toTeamId: number | null;
  date: string;
  transferType: string | null;
};

function record(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid provider data.");
  }

  return value as Record<string, unknown>;
}

function providerId(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2147483647
  ) {
    throw new Error("Invalid provider identifier.");
  }

  return value;
}

function optionalRecord(
  value: unknown
): Record<string, unknown> {
  return value == null ? {} : record(value);
}

function seasonValue(value: unknown): string {
  const season = String(value);

  if (!/^\d{4}$/.test(season)) {
    throw new Error("Invalid football season.");
  }

  const year = Number(season);

  if (year < 1900 || year > 2200) {
    throw new Error("Invalid football season.");
  }

  return season;
}

export function expandFootballStatistics(
  value: unknown
): ProviderPlayerStatistics[] {
  const root = record(value);
  const player = record(root.player);

  const providerPlayerId = providerId(player.id);

  if (
    !Array.isArray(root.statistics) ||
    root.statistics.length > 100
  ) {
    throw new Error("Invalid player statistics.");
  }

  return root.statistics.map(value => {
    const fields = record(value);
    const team = record(fields.team);
    const league = record(fields.league);

    const games = optionalRecord(fields.games);
    const goals = optionalRecord(fields.goals);
    const shots = optionalRecord(fields.shots);
    const passes = optionalRecord(fields.passes);
    const tackles = optionalRecord(fields.tackles);
    const cards = optionalRecord(fields.cards);
    const saves = goals.saves;

    const metrics: ImportedMetric[] = [];

    function add(
      metricKey: string,
      metricLabel: string,
      metricValue: unknown
    ) {
      if (metricValue == null) return;

      if (
        typeof metricValue !== "number" ||
        !Number.isSafeInteger(metricValue) ||
        metricValue < 0
      ) {
        throw new Error("Invalid football metric.");
      }

      metrics.push({
        metricKey,
        metricLabel,
        metricValue,
      });
    }

    add("appearances", "Appearances", games.appearences);
    add("lineups", "Starting appearances", games.lineups);
    add("minutes", "Minutes played", games.minutes);
    add("goals", "Goals", goals.total);
    add("assists", "Assists", goals.assists);
    add("goals_conceded", "Goals conceded", goals.conceded);
    add("saves", "Saves", saves);
    add("shots", "Total shots", shots.total);
    add("shots_on_target", "Shots on target", shots.on);
    add("passes", "Total passes", passes.total);
    add("key_passes", "Key passes", passes.key);
    add("tackles", "Tackles", tackles.total);
    add("interceptions", "Interceptions", tackles.interceptions);
    add("yellow_cards", "Yellow cards", cards.yellow);
    add("red_cards", "Red cards", cards.red);

    return {
      providerPlayerId,
      providerTeamId: providerId(team.id),
      providerLeagueId: providerId(league.id),
      providerSeason: seasonValue(league.season),
      metrics: normalizeMetrics(metrics),
    };
  });
}

export function expandFootballTransfers(
  value: unknown
): ProviderCareerEvent[] {
  const root = record(value);
  const player = record(root.player);

  const providerPlayerId = providerId(player.id);

  if (
    !Array.isArray(root.transfers) ||
    root.transfers.length > 500
  ) {
    throw new Error("Invalid transfer history.");
  }

  return root.transfers.map(value => {
    const fields = record(value);
    const teams = record(fields.teams);

    const incoming = optionalRecord(teams.in);
    const outgoing = optionalRecord(teams.out);

    if (
      typeof fields.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fields.date)
    ) {
      throw new Error("Invalid transfer date.");
    }

    const date = normalizeCareer({
      joinedAt: fields.date,
    }).joinedAt;

    if (!date) {
      throw new Error("Missing transfer date.");
    }

    const fromTeamId =
      outgoing.id == null
        ? null
        : providerId(outgoing.id);

    const toTeamId =
      incoming.id == null
        ? null
        : providerId(incoming.id);

    if (
      (fromTeamId == null && toTeamId == null) ||
      (fromTeamId != null && fromTeamId === toTeamId)
    ) {
      throw new Error("Invalid transfer relationship.");
    }

    const transferType =
      typeof fields.type === "string" &&
      fields.type.trim().length > 0
        ? fields.type.trim().slice(0, 100)
        : null;

    return {
      providerPlayerId,
      fromTeamId,
      toTeamId,
      date,
      transferType,
    };
  });
}

// A transfer establishes an observed event.
// It does not establish an entire career period.
export function careerFromArrival(
  event: ProviderCareerEvent
): ImportedCareer {
  if (event.toTeamId == null) {
    throw new Error("Arrival club unavailable.");
  }

  return normalizeCareer({
    joinedAt: event.date.slice(0, 10),
    leftAt: null,
    transferType: event.transferType,
  });
}
