import type {
  ProviderQuota,
  ProviderErrorCode,
} from "./client";

export const DISCOVERY_QUOTA_POLICY = {
  dailyReserveRatio: 0.5,
  minuteReserveRatio: 0.5,
  minimumDailyReserve: 1,
  minimumMinuteReserve: 1,
  observationMaxAgeMs: 60_000,
  defaultCooldownMs: 60_000,
} as const;

export type QuotaBlockReason =
  | "UNKNOWN_QUOTA"
  | "STALE_QUOTA"
  | "DAILY_RESERVE"
  | "MINUTE_RESERVE"
  | "ACCESS_RESTRICTED"
  | "RATE_LIMIT"
  | "REQUEST_IN_PROGRESS";

export type QuotaDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reason: QuotaBlockReason;
      retryAt: number | null;
    };

type QuotaState = {
  quota: ProviderQuota;
  observedAt: number;
};

function validQuotaNumber(
  value: number | null
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function retryAfterMs(
  value: string | null,
  now: number
): number {
  const fallback =
    DISCOVERY_QUOTA_POLICY.defaultCooldownMs;

  if (!value) {
    return fallback;
  }

  if (/^\d+$/.test(value)) {
    const milliseconds = Number(value) * 1000;

    return Number.isSafeInteger(milliseconds)
      ? Math.max(fallback, milliseconds)
      : fallback;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp)
    ? Math.max(fallback, timestamp - now)
    : fallback;
}

export class DiscoveryQuotaGuard {
  private readonly states =
    new Map<string, QuotaState>();

  private accessRestricted = false;

  private cooldownUntil = 0;

  private activeProvider: string | null = null;

  observe(
    providerName: string,
    quota: ProviderQuota,
    now = Date.now()
  ): void {
    this.states.set(providerName, {
      quota: { ...quota },
      observedAt: now,
    });
  }

  check(
    providerName: string,
    now = Date.now()
  ): QuotaDecision {
    if (this.accessRestricted) {
      return {
        allowed: false,
        reason: "ACCESS_RESTRICTED",
        retryAt: null,
      };
    }

    if (now < this.cooldownUntil) {
      return {
        allowed: false,
        reason: "RATE_LIMIT",
        retryAt: this.cooldownUntil,
      };
    }

    if (this.activeProvider !== null) {
      return {
        allowed: false,
        reason: "REQUEST_IN_PROGRESS",
        retryAt: null,
      };
    }

    const state = this.states.get(providerName);

    if (!state) {
      return {
        allowed: false,
        reason: "UNKNOWN_QUOTA",
        retryAt: null,
      };
    }

    if (
      now < state.observedAt ||
      now - state.observedAt >=
        DISCOVERY_QUOTA_POLICY.observationMaxAgeMs
    ) {
      return {
        allowed: false,
        reason: "STALE_QUOTA",
        retryAt: null,
      };
    }

    const {
      dailyLimit,
      dailyRemaining,
      minuteLimit,
      minuteRemaining,
    } = state.quota;

    if (
      !validQuotaNumber(dailyLimit) ||
      !validQuotaNumber(dailyRemaining) ||
      !validQuotaNumber(minuteLimit) ||
      !validQuotaNumber(minuteRemaining) ||
      dailyLimit === 0 ||
      minuteLimit === 0 ||
      dailyRemaining > dailyLimit ||
      minuteRemaining > minuteLimit
    ) {
      return {
        allowed: false,
        reason: "UNKNOWN_QUOTA",
        retryAt: null,
      };
    }

    const dailyReserve = Math.max(
      DISCOVERY_QUOTA_POLICY.minimumDailyReserve,
      Math.ceil(
        dailyLimit *
        DISCOVERY_QUOTA_POLICY.dailyReserveRatio
      )
    );

    const minuteReserve = Math.max(
      DISCOVERY_QUOTA_POLICY.minimumMinuteReserve,
      Math.ceil(
        minuteLimit *
        DISCOVERY_QUOTA_POLICY.minuteReserveRatio
      )
    );

    if (dailyRemaining <= dailyReserve) {
      return {
        allowed: false,
        reason: "DAILY_RESERVE",
        retryAt: null,
      };
    }

    if (minuteRemaining <= minuteReserve) {
      return {
        allowed: false,
        reason: "MINUTE_RESERVE",
        retryAt: null,
      };
    }

    return { allowed: true };
  }

  acquire(
    providerName: string,
    now = Date.now()
  ): QuotaDecision {
    const decision = this.check(providerName, now);

    if (!decision.allowed) {
      return decision;
    }

    this.activeProvider = providerName;

    // Conservatively debit every known quota.
    // The same API key is used across sports.
    for (const state of this.states.values()) {
      if (state.quota.dailyRemaining !== null) {
        state.quota.dailyRemaining = Math.max(
          0,
          state.quota.dailyRemaining - 1
        );
      }

      if (state.quota.minuteRemaining !== null) {
        state.quota.minuteRemaining = Math.max(
          0,
          state.quota.minuteRemaining - 1
        );
      }
    }

    return { allowed: true };
  }

  complete(
    providerName: string,
    quota?: ProviderQuota,
    now = Date.now()
  ): void {
    if (this.activeProvider !== providerName) {
      return;
    }

    if (quota) {
      this.observe(providerName, quota, now);
    } else {
      this.states.delete(providerName);
    }

    this.activeProvider = null;
  }

  fail(
    providerName: string,
    code: ProviderErrorCode,
    quota?: ProviderQuota,
    now = Date.now()
  ): void {
    if (this.activeProvider !== providerName) {
      return;
    }

    if (code === "ACCESS_RESTRICTED") {
      this.accessRestricted = true;
    }

    if (code === "RATE_LIMIT") {
      this.cooldownUntil = Math.max(
        this.cooldownUntil,
        now + retryAfterMs(
          quota?.retryAfter ?? null,
          now
        )
      );
    }

    this.complete(providerName, quota, now);
  }

  resetAfterVerifiedAccess(): void {
    this.accessRestricted = false;
    this.states.clear();

    // Retain any existing rate-limit cooldown.
    // Fresh quota observations are still required.
  }
}

export const discoveryQuotaGuard =
  new DiscoveryQuotaGuard();
