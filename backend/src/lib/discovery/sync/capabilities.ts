import {
  getApiSportsProvider,
} from "../providers/config";

export const DISCOVERY_CAPABILITIES = [
  "COMPETITIONS",
  "CLUBS",
  "PLAYERS",
  "SQUADS",
  "CAREERS",
  "STATISTICS",
  "STANDINGS",
] as const;

export type DiscoveryCapability =
  typeof DISCOVERY_CAPABILITIES[number];

export type CapabilityStatus =
  | "IMPLEMENTED"
  | "ADAPTER_REQUIRED"
  | "PROVIDER_REQUIRED";

const footballCapabilities =
  new Set<DiscoveryCapability>([
    "COMPETITIONS",
    "CLUBS",
    "PLAYERS",
    "SQUADS",
    "STATISTICS",
    "STANDINGS",
  ]);

const directorySports = new Set([
  "basketball",
  "baseball",
  "rugby",
  "volleyball",
]);

export function getDiscoveryCapability(
  sport: string,
  capability: DiscoveryCapability
): CapabilityStatus {
  const config = getApiSportsProvider(sport);

  if (!config) {
    return "PROVIDER_REQUIRED";
  }

  if (config.sportSlug === "football") {
    return footballCapabilities.has(capability)
      ? "IMPLEMENTED"
      : "ADAPTER_REQUIRED";
  }

  if (
    config.sportSlug === "basketball" &&
    capability === "PLAYERS"
  ) {
    return "IMPLEMENTED";
  }

  if (
    ["basketball", "baseball", "rugby", "volleyball"]
      .includes(config.sportSlug) &&
    capability === "STANDINGS"
  ) {
    return "IMPLEMENTED";
  }

  if (
    directorySports.has(config.sportSlug) &&
    (
      capability === "COMPETITIONS" ||
      capability === "CLUBS"
    )
  ) {
    return "IMPLEMENTED";
  }

  return "ADAPTER_REQUIRED";
}

export function getDiscoveryCapabilities(
  sport: string
): Record<DiscoveryCapability, CapabilityStatus> {
  return Object.fromEntries(
    DISCOVERY_CAPABILITIES.map(capability => [
      capability,
      getDiscoveryCapability(sport, capability),
    ])
  ) as Record<
    DiscoveryCapability,
    CapabilityStatus
  >;
}

export function hasDiscoveryImplementation(
  sport: string,
  capability: string
): boolean {
  if (
    !DISCOVERY_CAPABILITIES.includes(
      capability as DiscoveryCapability
    )
  ) {
    return false;
  }

  return getDiscoveryCapability(
    sport,
    capability as DiscoveryCapability
  ) === "IMPLEMENTED";
}
