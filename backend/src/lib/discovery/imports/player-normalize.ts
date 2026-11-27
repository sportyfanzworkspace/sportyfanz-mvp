import {
  getApiSportsProvider,
} from "../providers/config";

import {
  requiredId,
  requiredText,
  optionalText,
  optionalInteger,
  optionalHttpsUrl,
  optionalDateOfBirth,
} from "../validation";

export type ImportedPlayer = {
  sportSlug: string;
  providerName: string;
  providerPlayerId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  nationality: string | null;
  position: string | null;
  jerseyNumber: number | null;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
};

export type ImportedCareer = {
  joinedAt: string | null;
  leftAt: string | null;
  position: string | null;
  jerseyNumber: number | null;
  transferType: string | null;
};

export type ImportedMetric = {
  metricKey: string;
  metricLabel: string;
  metricValue: number;
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

function safe<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

function text(
  value: unknown,
  max = 150
): string | null {
  return safe(() =>
    optionalText(value, "Provider field", max)
  );
}

function integer(
  value: unknown,
  min: number,
  max: number
): number | null {
  return safe(() =>
    optionalInteger(
      value,
      "Provider field",
      min,
      max
    )
  );
}

function measurement(
  value: unknown,
  unit: "cm" | "kg",
  min: number,
  max: number
): number | null {
  if (typeof value === "string") {
    const pattern = new RegExp(
      `^(\\d+)\\s*${unit}$`,
      "i"
    );

    const match = value.trim().match(pattern);

    if (!match) return null;

    value = match[1];
  }

  return integer(value, min, max);
}

export function normalizePlayer(
  sport: string,
  value: unknown
): ImportedPlayer {
  const config = getApiSportsProvider(sport);

  if (!config) {
    throw new Error("Unsupported player provider.");
  }

  const root = record(value);

  const fields =
    root.player !== undefined
      ? record(root.player)
      : root;

  const birth =
    fields.birth &&
    typeof fields.birth === "object" &&
    !Array.isArray(fields.birth)
      ? record(fields.birth)
      : {};

  const firstName = text(
    fields.firstname ?? fields.firstName,
    150
  );

  const lastName = text(
    fields.lastname ?? fields.lastName,
    150
  );

  const displayName = requiredText(
    text(fields.name ?? fields.displayName, 150) ??
      [firstName, lastName]
        .filter(Boolean)
        .join(" "),
    "Player name",
    150
  );

  // Preserve known names without guessing
  // how a full name should be divided.
  return {
    sportSlug: config.sportSlug,
    providerName: config.providerName,
    providerPlayerId: requiredId(
      fields.id,
      "Provider player ID"
    ),
    firstName:
      firstName ??
      (lastName ? "" : displayName),
    lastName: lastName ?? "",
    displayName,
    nationality: text(
      fields.nationality,
      100
    ),
    position: text(fields.position, 100),
    jerseyNumber: integer(
      fields.number ?? fields.jerseyNumber,
      0,
      999
    ),
    avatarUrl: safe(() =>
      optionalHttpsUrl(
        fields.photo ?? fields.image,
        "Player photo"
      )
    ),
    dateOfBirth: safe(() =>
      optionalDateOfBirth(
        birth.date ??
        fields.dateOfBirth ??
        fields.birthdate
      )
    ),
    heightCm: measurement(
      fields.height,
      "cm",
      50,
      300
    ),
    weightKg: measurement(
      fields.weight,
      "kg",
      15,
      500
    ),
  };
}

function careerDate(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new Error("Invalid career date.");
  }

  const parsed = new Date(
    `${value}T00:00:00.000Z`
  );

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    value > new Date().toISOString().slice(0, 10)
  ) {
    throw new Error("Invalid career date.");
  }

  return parsed.toISOString();
}

export function normalizeCareer(
  value: unknown
): ImportedCareer {
  const fields = record(value);

  const joinedAt = careerDate(fields.joinedAt);
  const leftAt = careerDate(fields.leftAt);

  if (
    joinedAt &&
    leftAt &&
    joinedAt > leftAt
  ) {
    throw new Error("Reversed career dates.");
  }

  return {
    joinedAt,
    leftAt,
    position: text(fields.position, 100),
    jerseyNumber: integer(
      fields.jerseyNumber,
      0,
      999
    ),
    transferType: text(
      fields.transferType,
      100
    ),
  };
}

// Canonical metric format.
// Provider-specific adapters must map their
// documented statistics into this format.
export function normalizeMetric(
  value: unknown
): ImportedMetric {
  const fields = record(value);

  const metricKey = requiredText(
    fields.metricKey,
    "Metric key",
    100
  );

  if (
    !/^[a-z][a-z0-9_]*$/.test(metricKey)
  ) {
    throw new Error("Invalid metric key.");
  }

  const metricLabel = requiredText(
    fields.metricLabel,
    "Metric label",
    150
  );

  const raw = fields.metricValue;

  if (
    typeof raw !== "number" &&
    (
      typeof raw !== "string" ||
      !/^-?\d+(?:\.\d+)?$/.test(raw.trim())
    )
  ) {
    throw new Error("Invalid metric value.");
  }

  const metricValue = Number(raw);

  if (
    !Number.isFinite(metricValue) ||
    Math.abs(metricValue) > 1e12
  ) {
    throw new Error("Invalid metric value.");
  }

  return {
    metricKey,
    metricLabel,
    metricValue,
  };
}

export function normalizeMetrics(
  values: unknown[]
): ImportedMetric[] {
  const result = values.map(normalizeMetric);

  if (
    new Set(
      result.map(item => item.metricKey)
    ).size !== result.length
  ) {
    throw new Error("Duplicate metric keys.");
  }

  return result;
}
