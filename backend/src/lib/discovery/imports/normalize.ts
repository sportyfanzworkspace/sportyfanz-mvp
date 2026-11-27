import {
  getApiSportsProvider,
} from "../providers/config";

import {
  requiredId,
  requiredText,
  optionalText,
  optionalInteger,
  optionalHttpsUrl,
} from "../validation";

export type ImportedSeason = {
  name: string;
  providerSeason: string;
  startsAt: string | null;
  endsAt: string | null;
  isCurrent: boolean;
};

export type ImportedCompetition = {
  sportSlug: string;
  providerName: string;
  providerLeagueId: number;
  name: string;
  country: string | null;
  competitionType: string | null;
  logoUrl: string | null;
  seasons: ImportedSeason[];
};

export type ImportedClub = {
  sportSlug: string;
  providerName: string;
  providerTeamId: number;
  name: string;
  shortName: string | null;
  country: string | null;
  city: string | null;
  foundedYear: number | null;
  logoUrl: string | null;
  stadiumName: string | null;
  stadiumCapacity: number | null;
};

function record(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid provider record.");
  }

  return value as Record<string, unknown>;
}

function optionalRecord(
  value: unknown
): Record<string, unknown> {
  if (value === null || value === undefined) {
    return {};
  }

  return record(value);
}

function safeOptional<T>(
  read: () => T
): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

function text(
  value: unknown,
  maxLength: number
): string | null {
  return safeOptional(() =>
    optionalText(
      value,
      "Provider field",
      maxLength
    )
  );
}

function integer(
  value: unknown,
  min: number,
  max: number
): number | null {
  return safeOptional(() =>
    optionalInteger(
      value,
      "Provider field",
      min,
      max
    )
  );
}

function logo(value: unknown): string | null {
  return safeOptional(() =>
    optionalHttpsUrl(value, "Provider logo")
  );
}

function country(value: unknown): string | null {
  if (typeof value === "string") {
    return text(value, 100);
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return text(record(value).name, 100);
  }

  return null;
}

function date(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const parsed = new Date(
    `${value}T00:00:00.000Z`
  );

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return parsed.toISOString();
}

function provider(sport: string) {
  const config = getApiSportsProvider(sport);

  if (!config) {
    throw new Error(
      "Unsupported Discovery import sport."
    );
  }

  return config;
}

export function normalizeSeason(
  value: unknown
): ImportedSeason {
  const fields =
    typeof value === "object"
      ? record(value)
      : { year: value };

  const raw = fields.year ?? fields.season;

  if (
    typeof raw !== "string" &&
    typeof raw !== "number"
  ) {
    throw new Error("Missing provider season.");
  }

  const season = String(raw).trim();

  if (
    !/^\d{4}(?:-\d{4})?$/.test(season)
  ) {
    throw new Error("Invalid provider season.");
  }

  const years = season.split("-").map(Number);

  if (
    years.some(year => year < 1800 || year > 2200) ||
    (years.length === 2 && years[1] !== years[0] + 1)
  ) {
    throw new Error("Invalid provider season year.");
  }

  const startsAt = date(fields.start);
  const endsAt = date(fields.end);

  if (
    startsAt &&
    endsAt &&
    startsAt > endsAt
  ) {
    throw new Error("Invalid season date range.");
  }

  return {
    name: season,
    providerSeason: season,
    startsAt,
    endsAt,
    isCurrent: fields.current === true,
  };
}

export function normalizeCompetition(
  sport: string,
  value: unknown
): ImportedCompetition {
  const config = provider(sport);
  const root = record(value);

  const fields =
    root.league !== undefined
      ? record(root.league)
      : root;

  const seasons = new Map<string, ImportedSeason>();

  if (Array.isArray(root.seasons)) {
    for (const item of root.seasons) {
      const season = normalizeSeason(item);

      if (seasons.has(season.providerSeason)) {
        throw new Error("Duplicate provider season.");
      }

      seasons.set(season.providerSeason, season);
    }
  }

  if (
    [...seasons.values()].filter(
      season => season.isCurrent
    ).length > 1
  ) {
    throw new Error(
      "Multiple current competition seasons."
    );
  }

  return {
    sportSlug: config.sportSlug,
    providerName: config.providerName,
    providerLeagueId: requiredId(
      fields.id,
      "Provider competition ID"
    ),
    name: requiredText(
      fields.name,
      "Competition name",
      150
    ),
    country: country(
      root.country ?? fields.country
    ),
    competitionType: text(fields.type, 80),
    logoUrl: logo(fields.logo),
    seasons: [...seasons.values()],
  };
}

export function normalizeClub(
  sport: string,
  value: unknown
): ImportedClub {
  const config = provider(sport);
  const root = record(value);

  const fields =
    root.team !== undefined
      ? record(root.team)
      : root;

  const venue = optionalRecord(
    root.venue ?? fields.venue
  );

  return {
    sportSlug: config.sportSlug,
    providerName: config.providerName,
    providerTeamId: requiredId(
      fields.id,
      "Provider team ID"
    ),
    name: requiredText(
      fields.name,
      "Club name",
      150
    ),
    shortName: text(fields.code, 80),
    country: country(
      fields.country ?? root.country
    ),
    city: text(venue.city ?? fields.city, 100),
    foundedYear: integer(
      fields.founded,
      1700,
      new Date().getFullYear()
    ),
    logoUrl: logo(fields.logo),
    stadiumName: text(venue.name, 200),
    stadiumCapacity: integer(
      venue.capacity,
      0,
      1000000
    ),
  };
}

export type NormalizationBatch<T> = {
  records: T[];
  rejected: {
    index: number;
    reason: string;
  }[];
};

export function normalizeBatch<T>(
  values: unknown[],
  normalize: (value: unknown) => T,
  identity: (value: T) => string
): NormalizationBatch<T> {
  const records: T[] = [];
  const rejected: NormalizationBatch<T>["rejected"] = [];

  const candidates = new Map<
    string,
    { value: T; index: number }
  >();

  const conflicts = new Set<string>();

  values.forEach((value, index) => {
    try {
      const normalized = normalize(value);
      const key = identity(normalized);

      if (conflicts.has(key)) {
        throw new Error("Duplicate provider identity.");
      }

      const existing = candidates.get(key);

      if (existing) {
        candidates.delete(key);
        conflicts.add(key);

        rejected.push({
          index: existing.index,
          reason: "Duplicate provider identity.",
        });

        throw new Error("Duplicate provider identity.");
      }

      candidates.set(key, {
        value: normalized,
        index,
      });
    } catch (error) {
      rejected.push({
        index,
        reason:
          error instanceof Error
            ? error.message
            : "Invalid provider record.",
      });
    }
  });

  for (const item of candidates.values()) {
    records.push(item.value);
  }

  return { records, rejected };
}
