import {
  validateQuotaKey,
} from "./quota-identity";

import { randomUUID } from "node:crypto";

import { getDiscoveryPool } from "./database";

import {
  DISCOVERY_QUOTA_POLICY,
  type QuotaBlockReason,
} from "../providers/quota";

import type {
  ProviderQuota,
  ProviderErrorCode,
} from "../providers/client";

export const SHARED_QUOTA_KEY =
  "API_SPORTS_SHARED";

const LEASE_SECONDS = 90;

type QuotaRow = {
  quotaKey: string;
  dailyLimit: number | null;
  dailyRemaining: number | null;
  minuteLimit: number | null;
  minuteRemaining: number | null;
  observedAt: Date | null;
  accessRestricted: boolean;
  cooldownUntil: Date | null;
  lockToken: string | null;
  lockExpiresAt: Date | null;
  lastErrorCode: string | null;
  databaseNow: Date;
};

export type PersistentQuotaDecision =
  | {
      allowed: true;
      token: string;
    }
  | {
      allowed: false;
      reason: QuotaBlockReason;
      retryAt: number | null;
    };

function validQuota(
  quota: ProviderQuota
): boolean {
  const values = [
    quota.dailyLimit,
    quota.dailyRemaining,
    quota.minuteLimit,
    quota.minuteRemaining,
  ];

  return (
    values.every(value =>
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 2147483647
    ) &&
    quota.dailyLimit > 0 &&
    quota.minuteLimit > 0 &&
    quota.dailyRemaining <= quota.dailyLimit &&
    quota.minuteRemaining <= quota.minuteLimit
  );
}

function cooldownSeconds(
  retryAfter: string | null
): number {
  if (!retryAfter) return 60;

  const seconds = /^\d+$/.test(retryAfter)
    ? Number(retryAfter)
    : Math.ceil(
        (Date.parse(retryAfter) - Date.now()) / 1000
      );

  if (!Number.isFinite(seconds)) return 60;

  return Math.max(
    60,
    Math.min(seconds, 604800)
  );
}

export async function acquirePersistentQuota(
  quotaKey = SHARED_QUOTA_KEY
): Promise<PersistentQuotaDecision> {
  validateQuotaKey(quotaKey);

  const client =
    await getDiscoveryPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      INSERT INTO public.discovery_provider_quotas (
        "quotaKey",
        "updatedAt"
      )
      VALUES ($1, NOW() - INTERVAL '61 seconds')
      ON CONFLICT ("quotaKey") DO NOTHING
    `, [quotaKey]);

    const result = await client.query<QuotaRow>(`
      SELECT *, clock_timestamp() AS "databaseNow"
      FROM public.discovery_provider_quotas
      WHERE "quotaKey" = $1
      FOR UPDATE
    `, [quotaKey]);

    const row = result.rows[0];
    const now = row.databaseNow.getTime();

    function blocked(
      reason: QuotaBlockReason,
      retryAt: number | null = null
    ): PersistentQuotaDecision {
      return {
        allowed: false,
        reason,
        retryAt,
      };
    }

    let decision: PersistentQuotaDecision;

    if (row.accessRestricted) {
      decision = blocked("ACCESS_RESTRICTED");

    } else if (
      row.cooldownUntil &&
      row.cooldownUntil.getTime() > now
    ) {
      decision = blocked(
        "RATE_LIMIT",
        row.cooldownUntil.getTime()
      );

    } else if (
      row.lockToken &&
      row.lockExpiresAt &&
      row.lockExpiresAt.getTime() > now
    ) {
      decision = blocked(
        "REQUEST_IN_PROGRESS",
        row.lockExpiresAt.getTime()
      );

    } else if (row.lockToken) {
      // A previous request may have reached
      // the provider before its worker stopped.
      // Require a fresh verified observation.
      await client.query(`
        UPDATE public.discovery_provider_quotas
        SET
          "observedAt" = NULL,
          "lockToken" = NULL,
          "lockExpiresAt" = NULL,
          "lastErrorCode" = 'LEASE_EXPIRED',
          "updatedAt" = NOW()
        WHERE "quotaKey" = $1
      `, [quotaKey]);

      decision = blocked("UNKNOWN_QUOTA");

    } else if (
      !row.observedAt ||
      !validQuota({
        dailyLimit: row.dailyLimit,
        dailyRemaining: row.dailyRemaining,
        minuteLimit: row.minuteLimit,
        minuteRemaining: row.minuteRemaining,
        retryAfter: null,
      })
    ) {
      decision = blocked("UNKNOWN_QUOTA");

    } else if (
      now < row.observedAt.getTime() ||
      now - row.observedAt.getTime() >=
        DISCOVERY_QUOTA_POLICY.observationMaxAgeMs
    ) {
      decision = blocked("STALE_QUOTA");

    } else {
      const dailyReserve = Math.max(
        DISCOVERY_QUOTA_POLICY.minimumDailyReserve,
        Math.ceil(
          row.dailyLimit *
          DISCOVERY_QUOTA_POLICY.dailyReserveRatio
        )
      );

      const minuteReserve = Math.max(
        DISCOVERY_QUOTA_POLICY.minimumMinuteReserve,
        Math.ceil(
          row.minuteLimit *
          DISCOVERY_QUOTA_POLICY.minuteReserveRatio
        )
      );

      if (row.dailyRemaining <= dailyReserve) {
        decision = blocked("DAILY_RESERVE");

      } else if (
        row.minuteRemaining <= minuteReserve
      ) {
        decision = blocked("MINUTE_RESERVE");

      } else {
        const token = randomUUID();

        await client.query(`
          UPDATE public.discovery_provider_quotas
          SET
            "dailyRemaining" =
              "dailyRemaining" - 1,
            "minuteRemaining" =
              "minuteRemaining" - 1,
            "lockToken" = $2,
            "lockExpiresAt" =
              clock_timestamp() +
              $3::integer * INTERVAL '1 second',
            "updatedAt" = NOW()
          WHERE "quotaKey" = $1
        `, [
          quotaKey,
          token,
          LEASE_SECONDS,
        ]);

        decision = {
          allowed: true,
          token,
        };
      }
    }

    await client.query("COMMIT");

    return decision;

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}

// Status observations use the same execution lease
// as ordinary provider requests.
export async function acquireQuotaObservation(
  quotaKey = SHARED_QUOTA_KEY
): Promise<string | null> {
  validateQuotaKey(quotaKey);

  const pool = getDiscoveryPool();

  await pool.query(`
    INSERT INTO public.discovery_provider_quotas (
      "quotaKey",
      "updatedAt"
    )
    VALUES ($1, NOW() - INTERVAL '61 seconds')
    ON CONFLICT ("quotaKey") DO NOTHING
  `, [quotaKey]);

  const token = randomUUID();

  const result = await pool.query(`
    UPDATE public.discovery_provider_quotas
    SET
      "lockToken" = $2,
      "lockExpiresAt" =
        clock_timestamp() + INTERVAL '90 seconds',
      "updatedAt" = clock_timestamp()
    WHERE "quotaKey" = $1
      AND "accessRestricted" = false
      AND (
        "cooldownUntil" IS NULL OR
        "cooldownUntil" <= clock_timestamp()
      )
      AND (
        "lockToken" IS NULL OR
        "lockExpiresAt" <= clock_timestamp()
      )
      AND (
        "observedAt" IS NULL OR
        "observedAt" <=
          clock_timestamp() - INTERVAL '60 seconds'
      )
      AND "updatedAt" <=
        clock_timestamp() - INTERVAL '60 seconds'
    RETURNING "quotaKey"
  `, [quotaKey, token]);

  return result.rowCount === 1
    ? token
    : null;
}

export async function finishPersistentQuota(
  token: string,
  quota?: ProviderQuota,
  errorCode?: ProviderErrorCode,
  quotaKey = SHARED_QUOTA_KEY
): Promise<boolean> {
  validateQuotaKey(quotaKey);

  const usable =
    quota !== undefined && validQuota(quota);

  const restricted =
    errorCode === "ACCESS_RESTRICTED";

  const rateLimited =
    errorCode === "RATE_LIMIT";

  const result = await getDiscoveryPool().query(`
    UPDATE public.discovery_provider_quotas
    SET
      "dailyLimit" = $3,
      "dailyRemaining" = $4,
      "minuteLimit" = $5,
      "minuteRemaining" = $6,
      "observedAt" = CASE
        WHEN $7::boolean THEN clock_timestamp()
        ELSE NULL
      END,
      "accessRestricted" =
        "accessRestricted" OR $8::boolean,
      "cooldownUntil" = CASE
        WHEN $9::boolean THEN GREATEST(
          COALESCE("cooldownUntil", NOW()),
          NOW() +
            $10::integer * INTERVAL '1 second'
        )
        ELSE "cooldownUntil"
      END,
      "lastErrorCode" = $11,
      "lockToken" = NULL,
      "lockExpiresAt" = NULL,
      "updatedAt" = NOW()
    WHERE "quotaKey" = $1
      AND "lockToken" = $2
      AND "lockExpiresAt" > clock_timestamp()
  `, [
    quotaKey,
    token,
    usable ? quota.dailyLimit : null,
    usable ? quota.dailyRemaining : null,
    usable ? quota.minuteLimit : null,
    usable ? quota.minuteRemaining : null,
    usable,
    restricted,
    rateLimited,
    cooldownSeconds(quota?.retryAfter ?? null),
    errorCode ?? null,
  ]);

  return result.rowCount === 1;
}
