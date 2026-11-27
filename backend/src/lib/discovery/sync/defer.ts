import { getDiscoveryPool } from "./database";

import {
  DiscoveryJobLeaseError,
  type DiscoverySyncJob,
} from "./jobs";

import type {
  QuotaBlockReason,
} from "../providers/quota";

const delays: Record<QuotaBlockReason, number> = {
  UNKNOWN_QUOTA: 300,
  STALE_QUOTA: 300,
  DAILY_RESERVE: 3600,
  MINUTE_RESERVE: 60,
  ACCESS_RESTRICTED: 3600,
  RATE_LIMIT: 120,
  REQUEST_IN_PROGRESS: 30,
};

export async function deferSyncJob(
  id: number,
  token: string,
  reason: QuotaBlockReason,
  retryAt: number | null = null
): Promise<DiscoverySyncJob> {
  const delay = delays[reason];

  if (!delay) {
    throw new Error("Invalid postponement reason.");
  }

  const result =
    await getDiscoveryPool().query<DiscoverySyncJob>(
      `
        UPDATE public.discovery_sync_jobs
        SET
          status = 'RETRY',
          attempts = GREATEST(attempts - 1, 0),
          "nextRetryAt" = GREATEST(
            clock_timestamp() +
              $4::integer * INTERVAL '1 second',
            COALESCE(
              $5::timestamptz,
              clock_timestamp()
            )
          ),
          "lastErrorCode" = $3,
          "lastError" =
            'Waiting for provider availability.',
          "lockToken" = NULL,
          "lockExpiresAt" = NULL,
          "heartbeatAt" = NULL,
          "updatedAt" = clock_timestamp()
        WHERE id = $1
          AND "lockToken" = $2
          AND status = 'RUNNING'
          AND "lockExpiresAt" > clock_timestamp()
        RETURNING *
      `,
      [
        id,
        token,
        reason,
        delay,
        retryAt !== null &&
          Number.isFinite(retryAt)
          ? new Date(retryAt).toISOString()
          : null,
      ]
    );

  if (!result.rows[0]) {
    throw new DiscoveryJobLeaseError();
  }

  return result.rows[0];
}
