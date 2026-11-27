import {
  API_SPORTS_PROVIDERS,
  getApiSportsProvider,
} from "../providers/config";

export type QuotaScope =
  | "SHARED"
  | "PER_SPORT";

const sharedKey = "API_SPORTS_SHARED";

const allowedKeys = new Set<string>([
  sharedKey,
  ...Object.values(API_SPORTS_PROVIDERS)
    .map(provider => provider.providerName),
]);

export function validateQuotaKey(
  quotaKey: string
): void {
  if (!allowedKeys.has(quotaKey)) {
    throw new Error("Invalid provider quota identity.");
  }
}

export function resolveQuotaKey(
  sport: string,
  scope: string =
    process.env.DISCOVERY_QUOTA_SCOPE ?? "SHARED"
): string {
  const provider = getApiSportsProvider(sport);

  if (!provider) {
    throw new Error("Unsupported quota provider.");
  }

  if (scope === "SHARED") {
    return sharedKey;
  }

  if (scope === "PER_SPORT") {
    return provider.providerName;
  }

  throw new Error("Invalid provider quota scope.");
}
