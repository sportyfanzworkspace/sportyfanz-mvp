import {
  renewProviderQuota,
} from "./quota-renewal";

import {
  resolveQuotaKey,
} from "./quota-identity";

import {
  requestSportsProvider,
  SportsProviderError,
  type ProviderParameters,
} from "../providers/client";

import {
  getApiSportsProvider,
} from "../providers/config";

import {
  getDiscoveryCacheTtl,
} from "../providers/cache";

import {
  DiscoveryQuotaError,
  type DiscoveryProviderResult,
} from "../providers/service";

import {
  acquirePersistentQuota,
  finishPersistentQuota,
} from "./quota";

import {
  persistentCacheKey,
  readPersistentCache,
  writePersistentCache,
} from "./cache";

const APPROVED_ENDPOINTS = new Set([
  "/countries",
  "/leagues",
  "/competitions",
  "/teams",
  "/players",
  "/players/profiles",
  "/players/squads",
  "/players/statistics",
  "/squads",
  "/transfers",
  "/standings",
]);

export async function requestPersistentProvider<T>(
  sport: string,
  endpoint: string,
  parameters: ProviderParameters,
  validateData: (value: unknown) => value is T
): Promise<DiscoveryProviderResult<T>> {
  const config = getApiSportsProvider(sport);

  if (!config) {
    throw new SportsProviderError(
      "UNSUPPORTED_SPORT",
      "Sport provider is unavailable."
    );
  }

  if (!APPROVED_ENDPOINTS.has(endpoint)) {
    throw new SportsProviderError(
      "INVALID_ENDPOINT",
      "Endpoint is not approved for Discovery."
    );
  }

  const key = persistentCacheKey(
    config.providerName,
    endpoint,
    parameters
  );

  const cached = await readPersistentCache(
    key,
    config.providerName,
    endpoint,
    validateData
  );

  if (cached) {
    return {
      ...cached,
      quota: null,
      source: "CACHE",
    };
  }

  const quotaKey = resolveQuotaKey(
    config.sportSlug
  );

  let decision =
    await acquirePersistentQuota(quotaKey);

  if (
    decision.allowed === false &&
    [
      "UNKNOWN_QUOTA",
      "STALE_QUOTA",
      "DAILY_RESERVE",
      "MINUTE_RESERVE",
    ].includes(decision.reason)
  ) {
    const renewed =
      await renewProviderQuota(config.sportSlug);

    if (renewed) {
      decision =
        await acquirePersistentQuota(quotaKey);
    }
  }

  if (decision.allowed === false) {
    throw new DiscoveryQuotaError(
      decision.reason,
      decision.retryAt
    );
  }

  let response;

  try {
    response = await requestSportsProvider(
      config.sportSlug,
      endpoint,
      parameters,
      validateData
    );

  } catch (error) {
    if (error instanceof SportsProviderError) {
      await finishPersistentQuota(
        decision.token,
        error.quota,
        error.code,
        quotaKey
      );
    } else {
      await finishPersistentQuota(
        decision.token,
        undefined,
        "NETWORK_ERROR",
        quotaKey
      );
    }

    throw error;
  }

  const finalized = await finishPersistentQuota(
    decision.token,
    response.quota,
    undefined,
    quotaKey
  );

  if (!finalized) {
    throw new Error(
      "Provider execution lease expired."
    );
  }

  // Player responses containing season statistics
  // must use a shorter cache lifetime.
  const ttl =
    endpoint === "/players" &&
    parameters.season != null
      ? 24 * 60 * 60 * 1000
      : getDiscoveryCacheTtl(endpoint);

  await writePersistentCache(
    key,
    response,
    ttl
  );

  return {
    ...response,
    source: "FETCH",
  };
}
