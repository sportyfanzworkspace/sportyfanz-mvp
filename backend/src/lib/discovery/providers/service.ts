import {
  requestSportsProvider,
  SportsProviderError,
  type ProviderParameters,
  type ProviderResult,
  type ProviderQuota,
} from "./client";

import {
  getApiSportsProvider,
} from "./config";

import {
  DiscoveryQuotaGuard,
  discoveryQuotaGuard,
  type QuotaBlockReason,
} from "./quota";

import {
  DiscoveryProviderCache,
  discoveryProviderCache,
  createProviderCacheKey,
  getDiscoveryCacheTtl,
} from "./cache";

export class DiscoveryQuotaError extends Error {
  constructor(
    public readonly reason: QuotaBlockReason,
    public readonly retryAt: number | null
  ) {
    super(`Discovery request blocked: ${reason}`);
    this.name = "DiscoveryQuotaError";
  }
}

export type DiscoveryProviderResult<T> =
  Omit<ProviderResult<T>, "quota"> & {
    quota: ProviderQuota | null;
    source: "CACHE" | "FETCH" | "SHARED_REQUEST";
  };

const CACHEABLE_ENDPOINTS = new Set([
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

export class DiscoveryProviderService {
  constructor(
    private readonly quotaGuard:
      DiscoveryQuotaGuard = discoveryQuotaGuard,
    private readonly cache:
      DiscoveryProviderCache = discoveryProviderCache
  ) {}

  async request<T>(
    sport: string,
    endpoint: string,
    parameters: ProviderParameters,
    validateData: (value: unknown) => value is T
  ): Promise<DiscoveryProviderResult<T>> {
    const config = getApiSportsProvider(sport);

    if (!config) {
      throw new SportsProviderError(
        "UNSUPPORTED_SPORT",
        "This sport has no configured provider."
      );
    }

    if (!CACHEABLE_ENDPOINTS.has(endpoint)) {
      throw new SportsProviderError(
        "INVALID_ENDPOINT",
        "Endpoint is not approved for Discovery."
      );
    }

    const providerName = config.providerName;

    const cacheKey = createProviderCacheKey(
      providerName,
      endpoint,
      parameters
    );

    const ttl = getDiscoveryCacheTtl(endpoint);

    const result = await this.cache.getOrFetch(
      cacheKey,
      ttl,
      async () => {
        const decision =
          this.quotaGuard.acquire(providerName);

        if (decision.allowed === false) {
          throw new DiscoveryQuotaError(
            decision.reason,
            decision.retryAt
          );
        }

        try {
          const response =
            await requestSportsProvider(
              config.sportSlug,
              endpoint,
              parameters,
              validateData
            );

          this.quotaGuard.complete(
            providerName,
            response.quota
          );

          return response;
        } catch (error) {
          if (error instanceof SportsProviderError) {
            this.quotaGuard.fail(
              providerName,
              error.code,
              error.quota
            );
          } else {
            this.quotaGuard.fail(
              providerName,
              "NETWORK_ERROR"
            );
          }

          throw error;
        }
      }
    );

    // Cached responses must also satisfy the
    // validator supplied by the current caller.
    if (!validateData(result.data.data)) {
      throw new SportsProviderError(
        "INVALID_RESPONSE",
        "Cached provider data failed validation."
      );
    }

    return {
      ...result.data,
      source: result.source,

      // Historical quota headers must never
      // be treated as current API allowances.
      quota:
        result.source === "FETCH"
          ? result.data.quota
          : null,
    };
  }
}

export const discoveryProviderService =
  new DiscoveryProviderService();
