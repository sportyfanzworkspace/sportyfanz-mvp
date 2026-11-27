import {
  requestSportsProvider,
  SportsProviderError,
} from "../providers/client";

import {
  acquireQuotaObservation,
  finishPersistentQuota,
} from "./quota";

import {
  resolveQuotaKey,
} from "./quota-identity";

type SubscriptionStatus = {
  subscription: {
    active: boolean;
  };
};

function validStatus(
  value: unknown
): value is SubscriptionStatus {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const status =
    value as Partial<SubscriptionStatus>;

  return (
    typeof status.subscription?.active ===
      "boolean"
  );
}

export async function renewProviderQuota(
  sport: string
): Promise<boolean> {
  const quotaKey = resolveQuotaKey(sport);

  const token =
    await acquireQuotaObservation(quotaKey);

  if (!token) return false;

  try {
    const response = await requestSportsProvider(
      sport,
      "/status",
      {},
      validStatus
    );

    if (!response.data.subscription.active) {
      await finishPersistentQuota(
        token,
        response.quota,
        "ACCESS_RESTRICTED",
        quotaKey
      );

      return false;
    }

    return await finishPersistentQuota(
      token,
      response.quota,
      undefined,
      quotaKey
    );

  } catch (error) {
    await finishPersistentQuota(
      token,
      error instanceof SportsProviderError &&
          error.quota
          ? {
              dailyLimit: null,
              dailyRemaining: null,
              minuteLimit: null,
              minuteRemaining: null,
              retryAfter: error.quota.retryAfter,
            }
          : undefined,
      error instanceof SportsProviderError
        ? error.code
        : "NETWORK_ERROR",
      quotaKey
    );

    return false;
  }
}
