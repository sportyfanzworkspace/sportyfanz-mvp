export type ProviderFreshnessDecision =
  | "CREATE"
  | "UPDATE"
  | "ADVANCE_OBSERVATION"
  | "UNCHANGED"
  | "STALE"
  | "MANUAL_PROTECTED"
  | "OBSERVATION_UNKNOWN"
  | "CONFLICT";

export type ProviderFreshnessRecord = {
  dataSource: string;
  providerObservedAt: string | null;
};

export function validateProviderObservation(
  value: unknown,
  now = Date.now()
): string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(now) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    throw new Error(
      "Invalid provider observation timestamp."
    );
  }

  const timestamp = Date.parse(value);

  if (
    !Number.isFinite(timestamp) ||
    timestamp > now
  ) {
    throw new Error(
      "Invalid provider observation timestamp."
    );
  }

  const canonical = new Date(timestamp).toISOString();

  const normalized = value.includes(".")
    ? value.replace(
        /\.(\d{1,3})Z$/,
        (_, fraction: string) =>
          `.${fraction.padEnd(3, "0")}Z`
      )
    : value.replace(/Z$/, ".000Z");

  if (canonical !== normalized) {
    throw new Error(
      "Invalid provider observation date."
    );
  }

  return canonical;
}

export function decideProviderFreshness(
  existing: ProviderFreshnessRecord | null,
  incomingObservedAt: string,
  identicalData: boolean,
  now = Date.now()
): ProviderFreshnessDecision {
  const incoming = Date.parse(
    validateProviderObservation(
      incomingObservedAt,
      now
    )
  );

  if (!existing) {
    return "CREATE";
  }

  if (existing.dataSource !== "PROVIDER") {
    return "MANUAL_PROTECTED";
  }

  if (!existing.providerObservedAt) {
    return "OBSERVATION_UNKNOWN";
  }

  const previous = Date.parse(
    existing.providerObservedAt
  );

  if (
    !Number.isFinite(previous) ||
    previous > now
  ) {
    return "OBSERVATION_UNKNOWN";
  }

  if (incoming < previous) {
    return "STALE";
  }

  if (incoming === previous) {
    return identicalData
      ? "UNCHANGED"
      : "CONFLICT";
  }

  return identicalData
    ? "ADVANCE_OBSERVATION"
    : "UPDATE";
}
