import { createHash } from "node:crypto";

import { getDiscoveryPool } from "./database";

import {
  createProviderCacheKey,
} from "../providers/cache";

import type {
  ProviderParameters,
  ProviderResult,
} from "../providers/client";

export const PERSISTENT_CACHE_POLICY = {
  maxEntries: 1000,
  maxEntryBytes: 2 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  maxTtlMs: 30 * 24 * 60 * 60 * 1000,
} as const;

export function persistentCacheKey(
  providerName: string,
  endpoint: string,
  parameters: ProviderParameters
): string {
  return createHash("sha256")
    .update(
      createProviderCacheKey(
        providerName,
        endpoint,
        parameters
      )
    )
    .digest("hex");
}

export async function readPersistentCache<T>(
  key: string,
  providerName: string,
  endpoint: string,
  validateData: (value: unknown) => value is T
): Promise<ProviderResult<T> | null> {
  const result =
    await getDiscoveryPool().query<{
      payload: string;
    }>(`
      SELECT payload
      FROM public.discovery_provider_cache
      WHERE "cacheKey" = $1
        AND "providerName" = $2
        AND endpoint = $3
        AND "expiresAt" > clock_timestamp()
        AND "payloadBytes" <= $4
    `, [
      key,
      providerName,
      endpoint,
      PERSISTENT_CACHE_POLICY.maxEntryBytes,
    ]);

  if (!result.rows[0]) return null;

  try {
    const value = JSON.parse(
      result.rows[0].payload
    );

    if (
      !value ||
      value.providerName !== providerName ||
      value.endpoint !== endpoint ||
      typeof value.fetchedAt !== "string" ||
      !Number.isFinite(Date.parse(value.fetchedAt)) ||
      !validateData(value.data)
    ) {
      return null;
    }

    return value as ProviderResult<T>;

  } catch {
    return null;
  }
}

export async function writePersistentCache<T>(
  key: string,
  response: ProviderResult<T>,
  ttlMs: number
): Promise<boolean> {
  if (
    !Number.isSafeInteger(ttlMs) ||
    ttlMs <= 0 ||
    ttlMs > PERSISTENT_CACHE_POLICY.maxTtlMs
  ) {
    return false;
  }

  let payload: string;

  try {
    payload = JSON.stringify({
      ...response,

      // Never persist usable historical quota
      // information inside cached responses.
      quota: {
        dailyLimit: null,
        dailyRemaining: null,
        minuteLimit: null,
        minuteRemaining: null,
        retryAfter: null,
      },
    });
  } catch {
    return false;
  }

  const bytes = Buffer.byteLength(
    payload,
    "utf8"
  );

  if (
    bytes >
      PERSISTENT_CACHE_POLICY.maxEntryBytes
  ) {
    return false;
  }

  const client =
    await getDiscoveryPool().connect();

  try {
    await client.query("BEGIN");

    // Serialize cache writers across instances.
    await client.query(`
      SELECT pg_advisory_xact_lock(
        74924, 9001
      )
    `);

    await client.query(`
      DELETE FROM public.discovery_provider_cache
      WHERE "expiresAt" <= clock_timestamp()
    `);

    const stored = await client.query(`
      INSERT INTO public.discovery_provider_cache (
        "cacheKey",
        "providerName",
        endpoint,
        payload,
        "payloadBytes",
        "fetchedAt",
        "expiresAt",
        "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6::timestamptz,
        $6::timestamptz +
          $7::bigint * INTERVAL '1 millisecond',
        NOW()
      )
      ON CONFLICT ("cacheKey") DO UPDATE
      SET
        payload = EXCLUDED.payload,
        "payloadBytes" = EXCLUDED."payloadBytes",
        "fetchedAt" = EXCLUDED."fetchedAt",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = NOW()
      WHERE
        discovery_provider_cache."fetchedAt"
          <= EXCLUDED."fetchedAt"
        AND discovery_provider_cache."providerName"
          = EXCLUDED."providerName"
        AND discovery_provider_cache.endpoint
          = EXCLUDED.endpoint
    `, [
      key,
      response.providerName,
      response.endpoint,
      payload,
      bytes,
      response.fetchedAt,
      ttlMs,
    ]);

    // Keep the newest entries within both limits.
    await client.query(`
      WITH ranked AS (
        SELECT
          "cacheKey",
          ROW_NUMBER() OVER (
            ORDER BY "fetchedAt" DESC, "cacheKey"
          ) AS position,
          SUM("payloadBytes") OVER (
            ORDER BY "fetchedAt" DESC, "cacheKey"
            ROWS UNBOUNDED PRECEDING
          ) AS cumulative_bytes
        FROM public.discovery_provider_cache
      )
      DELETE FROM public.discovery_provider_cache c
      USING ranked r
      WHERE c."cacheKey" = r."cacheKey"
        AND (
          r.position > $1
          OR r.cumulative_bytes > $2
        )
    `, [
      PERSISTENT_CACHE_POLICY.maxEntries,
      PERSISTENT_CACHE_POLICY.maxTotalBytes,
    ]);

    await client.query("COMMIT");

    return stored.rowCount === 1;

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}

export async function prunePersistentCache():
  Promise<number> {
  const result =
    await getDiscoveryPool().query(`
      DELETE FROM public.discovery_provider_cache
      WHERE "expiresAt" <= clock_timestamp()
    `);

  return result.rowCount ?? 0;
}
