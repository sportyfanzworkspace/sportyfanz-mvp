import { randomUUID, createHash } from "node:crypto";

import { getDiscoveryPool } from "./database";

import {
  getApiSportsProvider,
} from "../providers/config";

export const DISCOVERY_JOB_POLICY = {
  leaseSeconds: 120,
  defaultMaxAttempts: 3,
  maximumAttempts: 10,
  maximumParameterBytes: 8192,
  maximumCheckpointBytes: 16384,
  maximumRetrySeconds: 3600,
  recoveryBatchSize: 100,
} as const;

export const DISCOVERY_JOB_TYPES = [
  "COMPETITIONS",
  "CLUBS",
  "SQUADS",
  "PLAYERS",
  "CAREERS",
  "STATISTICS",
  "STANDINGS",
] as const;

export type DiscoveryJobType =
  typeof DISCOVERY_JOB_TYPES[number];

export type DiscoveryJobStatus =
  | "PENDING"
  | "RUNNING"
  | "RETRY"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type JobParameter =
  string | number | boolean | null;

export type JobParameters =
  Record<string, JobParameter>;

export type DiscoverySyncJob = {
  id: number;
  jobKey: string;
  sportSlug: string;
  providerName: string;
  jobType: DiscoveryJobType;
  parameters: string;
  checkpoint: string | null;
  status: DiscoveryJobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsConflicted: number;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  nextRetryAt: Date | null;
  lockToken: string | null;
  lockExpiresAt: Date | null;
  heartbeatAt: Date | null;
  lastErrorCode: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JobProgress = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  conflicted: number;
};

export class DiscoveryJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryJobError";
  }
}

export class DiscoveryJobLeaseError extends Error {
  constructor() {
    super(
      "Synchronization job lease is no longer valid."
    );

    this.name = "DiscoveryJobLeaseError";
  }
}

function integer(
  value: number,
  min: number,
  max: number,
  label: string
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new DiscoveryJobError(
      `Invalid ${label}.`
    );
  }

  return value;
}

function validateOwnership(
  id: number,
  token: string
): void {
  integer(
    id,
    1,
    2147483647,
    "job ID"
  );

  if (
    typeof token !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
  ) {
    throw new DiscoveryJobError(
      "Invalid execution token."
    );
  }
}

function canonicalParameters(
  input: JobParameters
): string {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new DiscoveryJobError(
      "Invalid job parameters."
    );
  }

  const entries = Object.entries(input);

  if (entries.length > 30) {
    throw new DiscoveryJobError(
      "Too many job parameters."
    );
  }

  for (const [key, value] of entries) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(key) ||
      /secret|password|token|credential|api.?key|authorization/i.test(key) ||
      ["constructor", "prototype"].includes(key)
    ) {
      throw new DiscoveryJobError(
        "Invalid or restricted parameter name."
      );
    }

    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new DiscoveryJobError(
        "Invalid parameter value."
      );
    }

    if (
      typeof value === "number" &&
      !Number.isFinite(value)
    ) {
      throw new DiscoveryJobError(
        "Invalid numeric parameter."
      );
    }

    if (
      typeof value === "string" &&
      value.length > 500
    ) {
      throw new DiscoveryJobError(
        "Parameter value is too long."
      );
    }
  }

  entries.sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );

  const serialized = JSON.stringify(
    Object.fromEntries(entries)
  );

  if (
    Buffer.byteLength(serialized, "utf8") >
    DISCOVERY_JOB_POLICY.maximumParameterBytes
  ) {
    throw new DiscoveryJobError(
      "Job parameters exceed storage limit."
    );
  }

  return serialized;
}

function serializeCheckpoint(
  checkpoint: unknown
): string {
  if (
    checkpoint === null ||
    typeof checkpoint !== "object" ||
    Array.isArray(checkpoint)
  ) {
    throw new DiscoveryJobError(
      "Checkpoint must be an object."
    );
  }

  let serialized: string;

  try {
    serialized = JSON.stringify(checkpoint);
  } catch {
    throw new DiscoveryJobError(
      "Checkpoint cannot be serialized."
    );
  }

  if (
    typeof serialized !== "string" ||
    Buffer.byteLength(serialized, "utf8") >
    DISCOVERY_JOB_POLICY.maximumCheckpointBytes
  ) {
    throw new DiscoveryJobError(
      "Checkpoint exceeds storage limit."
    );
  }

  return serialized;
}

function validateProgress(
  progress: JobProgress
): void {
  for (const value of [
    progress.processed,
    progress.created,
    progress.updated,
    progress.skipped,
    progress.conflicted,
  ]) {
    integer(
      value,
      0,
      2147483647,
      "progress counter"
    );
  }

  if (
    progress.processed !==
      progress.created +
      progress.updated +
      progress.skipped +
      progress.conflicted
  ) {
    throw new DiscoveryJobError(
      "Progress counters do not reconcile."
    );
  }
}

function validateErrorCode(
  code: string
): string {
  if (
    typeof code !== "string" ||
    !/^[A-Z][A-Z0-9_]{0,79}$/.test(code)
  ) {
    throw new DiscoveryJobError(
      "Invalid synchronization error code."
    );
  }

  return code;
}

function requireOwnedJob(
  rows: DiscoverySyncJob[]
): DiscoverySyncJob {
  if (rows.length !== 1) {
    throw new DiscoveryJobLeaseError();
  }

  return rows[0];
}

export async function enqueueSyncJob(input: {
  sport: string;
  jobType: DiscoveryJobType;
  parameters: JobParameters;
  scheduleKey: string;
  scheduledAt?: string;
  priority?: number;
  maxAttempts?: number;
}): Promise<{
  job: DiscoverySyncJob;
  created: boolean;
}> {
  const config = getApiSportsProvider(
    input.sport
  );

  if (!config) {
    throw new DiscoveryJobError(
      "Sport has no configured provider."
    );
  }

  if (
    !DISCOVERY_JOB_TYPES.includes(input.jobType)
  ) {
    throw new DiscoveryJobError(
      "Unsupported synchronization job type."
    );
  }

  if (
    typeof input.scheduleKey !== "string" ||
    !/^[a-zA-Z0-9:_-]{1,100}$/.test(
      input.scheduleKey
    )
  ) {
    throw new DiscoveryJobError(
      "Invalid scheduling identity."
    );
  }

  const parameters = canonicalParameters(
    input.parameters
  );

  const priority = integer(
    input.priority ?? 100,
    1,
    1000,
    "job priority"
  );

  const maxAttempts = integer(
    input.maxAttempts ??
      DISCOVERY_JOB_POLICY.defaultMaxAttempts,
    1,
    DISCOVERY_JOB_POLICY.maximumAttempts,
    "maximum attempts"
  );

  let scheduledAt: string | null = null;

  if (input.scheduledAt !== undefined) {
    const date = new Date(input.scheduledAt);

    if (!Number.isFinite(date.getTime())) {
      throw new DiscoveryJobError(
        "Invalid scheduling date."
      );
    }

    scheduledAt = date.toISOString();
  }

  const jobKey = createHash("sha256")
    .update(JSON.stringify([
      config.providerName,
      config.sportSlug,
      input.jobType,
      parameters,
      input.scheduleKey,
    ]))
    .digest("hex");

  const pool = getDiscoveryPool();

  const result = await pool.query<DiscoverySyncJob>(
    `
      INSERT INTO public.discovery_sync_jobs (
        "jobKey",
        "sportSlug",
        "providerName",
        "jobType",
        "parameters",
        "priority",
        "maxAttempts",
        "scheduledAt",
        "updatedAt"
      )
      SELECT
        $1, $2, $3, $4, $5, $6, $7,
        COALESCE($8::timestamptz, NOW()),
        NOW()
      WHERE EXISTS (
        SELECT 1
        FROM public.sports
        WHERE slug = $2
          AND "isActive" = true
      )
      ON CONFLICT ("jobKey") DO NOTHING
      RETURNING *
    `,
    [
      jobKey,
      config.sportSlug,
      config.providerName,
      input.jobType,
      parameters,
      priority,
      maxAttempts,
      scheduledAt,
    ]
  );

  if (result.rows.length === 1) {
    return {
      job: result.rows[0],
      created: true,
    };
  }

  const existing =
    await pool.query<DiscoverySyncJob>(
      `
        SELECT *
        FROM public.discovery_sync_jobs
        WHERE "jobKey" = $1
      `,
      [jobKey]
    );

  if (!existing.rows[0]) {
    throw new DiscoveryJobError(
      "Sport is inactive or job is unavailable."
    );
  }

  return {
    job: existing.rows[0],
    created: false,
  };
}

export async function claimSyncJob():
  Promise<DiscoverySyncJob | null> {
  const token = randomUUID();

  const result =
    await getDiscoveryPool()
      .query<DiscoverySyncJob>(
        `
          WITH candidate AS (
            SELECT j.id
            FROM public.discovery_sync_jobs j
            WHERE j.status IN ('PENDING', 'RETRY')
              AND j."scheduledAt" <= NOW()
              AND (
                j."nextRetryAt" IS NULL
                OR j."nextRetryAt" <= NOW()
              )
              AND j.attempts < j."maxAttempts"
              AND EXISTS (
                SELECT 1
                FROM public.sports s
                WHERE s.slug = j."sportSlug"
                  AND s."isActive" = true
              )
            ORDER BY
              j.priority ASC,
              j."scheduledAt" ASC,
              j.id ASC
            LIMIT 1
            FOR UPDATE OF j SKIP LOCKED
          )
          UPDATE public.discovery_sync_jobs j
          SET
            status = 'RUNNING',
            attempts = j.attempts + 1,
            "lockToken" = $1,
            "lockExpiresAt" =
              NOW() + $2 * INTERVAL '1 second',
            "heartbeatAt" = NOW(),
            "startedAt" =
              COALESCE(j."startedAt", NOW()),
            "nextRetryAt" = NULL,
            "completedAt" = NULL,
            "updatedAt" = NOW()
          FROM candidate
          WHERE j.id = candidate.id
          RETURNING j.*
        `,
        [
          token,
          DISCOVERY_JOB_POLICY.leaseSeconds,
        ]
      );

  return result.rows[0] ?? null;
}

export async function heartbeatSyncJob(
  id: number,
  token: string
): Promise<DiscoverySyncJob> {
  validateOwnership(id, token);

  const result =
    await getDiscoveryPool()
      .query<DiscoverySyncJob>(
        `
          UPDATE public.discovery_sync_jobs
          SET
            "heartbeatAt" = NOW(),
            "lockExpiresAt" =
              NOW() + $3 * INTERVAL '1 second',
            "updatedAt" = NOW()
          WHERE id = $1
            AND "lockToken" = $2
            AND status = 'RUNNING'
            AND "lockExpiresAt" > clock_timestamp()
          RETURNING *
        `,
        [
          id,
          token,
          DISCOVERY_JOB_POLICY.leaseSeconds,
        ]
      );

  return requireOwnedJob(result.rows);
}

export async function checkpointSyncJob(
  id: number,
  token: string,
  checkpoint: unknown,
  progress: JobProgress
): Promise<DiscoverySyncJob> {
  validateOwnership(id, token);
  validateProgress(progress);

  const serialized =
    serializeCheckpoint(checkpoint);

  const result =
    await getDiscoveryPool()
      .query<DiscoverySyncJob>(
        `
          UPDATE public.discovery_sync_jobs
          SET
            checkpoint = $3,
            "recordsProcessed" = $4,
            "recordsCreated" = $5,
            "recordsUpdated" = $6,
            "recordsSkipped" = $7,
            "recordsConflicted" = $8,
            "heartbeatAt" = NOW(),
            "lockExpiresAt" =
              NOW() + $9 * INTERVAL '1 second',
            "updatedAt" = NOW()
          WHERE id = $1
            AND "lockToken" = $2
            AND status = 'RUNNING'
            AND "lockExpiresAt" > clock_timestamp()
            AND "recordsProcessed" <= $4
            AND "recordsCreated" <= $5
            AND "recordsUpdated" <= $6
            AND "recordsSkipped" <= $7
            AND "recordsConflicted" <= $8
          RETURNING *
        `,
        [
          id,
          token,
          serialized,
          progress.processed,
          progress.created,
          progress.updated,
          progress.skipped,
          progress.conflicted,
          DISCOVERY_JOB_POLICY.leaseSeconds,
        ]
      );

  return requireOwnedJob(result.rows);
}

export async function completeSyncJob(
  id: number,
  token: string
): Promise<DiscoverySyncJob> {
  validateOwnership(id, token);

  const result =
    await getDiscoveryPool()
      .query<DiscoverySyncJob>(
        `
          UPDATE public.discovery_sync_jobs
          SET
            status = 'COMPLETED',
            "completedAt" = NOW(),
            "nextRetryAt" = NULL,
            "lockToken" = NULL,
            "lockExpiresAt" = NULL,
            "heartbeatAt" = NULL,
            "lastErrorCode" = NULL,
            "lastError" = NULL,
            "updatedAt" = NOW()
          WHERE id = $1
            AND "lockToken" = $2
            AND status = 'RUNNING'
            AND "lockExpiresAt" > clock_timestamp()
          RETURNING *
        `,
        [id, token]
      );

  return requireOwnedJob(result.rows);
}

async function finishFailedAttempt(
  id: number,
  token: string,
  code: string,
  retryable: boolean,
  minimumRetrySeconds = 60
): Promise<DiscoverySyncJob> {
  validateOwnership(id, token);

  const errorCode = validateErrorCode(code);

  integer(
    minimumRetrySeconds,
    1,
    DISCOVERY_JOB_POLICY.maximumRetrySeconds,
    "retry delay"
  );

  const result =
    await getDiscoveryPool()
      .query<DiscoverySyncJob>(
        `
          UPDATE public.discovery_sync_jobs
          SET
            status = CASE
              WHEN $4::boolean
                AND attempts < "maxAttempts"
              THEN 'RETRY'
              ELSE 'FAILED'
            END,
            "nextRetryAt" = CASE
              WHEN $4::boolean
                AND attempts < "maxAttempts"
              THEN NOW() + LEAST(
                $6::double precision,
                GREATEST(
                  $5::double precision,
                  60 * POWER(
                    2::double precision,
                    GREATEST(attempts - 1, 0)
                  )
                )
              ) * INTERVAL '1 second'
              ELSE NULL
            END,
            "completedAt" = CASE
              WHEN $4::boolean
                AND attempts < "maxAttempts"
              THEN NULL
              ELSE NOW()
            END,
            "lastErrorCode" = $3,
            "lastError" =
              'Synchronization attempt failed.',
            "lockToken" = NULL,
            "lockExpiresAt" = NULL,
            "heartbeatAt" = NULL,
            "updatedAt" = NOW()
          WHERE id = $1
            AND "lockToken" = $2
            AND status = 'RUNNING'
            AND "lockExpiresAt" > clock_timestamp()
          RETURNING *
        `,
        [
          id,
          token,
          errorCode,
          retryable,
          minimumRetrySeconds,
          DISCOVERY_JOB_POLICY.maximumRetrySeconds,
        ]
      );

  return requireOwnedJob(result.rows);
}

export async function retrySyncJob(
  id: number,
  token: string,
  code: string,
  minimumRetrySeconds = 60
): Promise<DiscoverySyncJob> {
  return finishFailedAttempt(
    id,
    token,
    code,
    true,
    minimumRetrySeconds
  );
}

export async function failSyncJob(
  id: number,
  token: string,
  code: string
): Promise<DiscoverySyncJob> {
  return finishFailedAttempt(
    id,
    token,
    code,
    false
  );
}

export async function recoverExpiredJobs():
  Promise<DiscoverySyncJob[]> {
  const result =
    await getDiscoveryPool()
      .query<DiscoverySyncJob>(
        `
          WITH expired AS (
            SELECT id
            FROM public.discovery_sync_jobs
            WHERE status = 'RUNNING'
              AND (
                "lockExpiresAt" IS NULL
                OR "lockExpiresAt" <= NOW()
              )
            ORDER BY id
            LIMIT $1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE public.discovery_sync_jobs j
          SET
            status = CASE
              WHEN j.attempts < j."maxAttempts"
              THEN 'RETRY'
              ELSE 'FAILED'
            END,
            "nextRetryAt" = CASE
              WHEN j.attempts < j."maxAttempts"
              THEN NOW() + LEAST(
                $2::double precision,
                60 * POWER(
                  2::double precision,
                  GREATEST(j.attempts - 1, 0)
                )
              ) * INTERVAL '1 second'
              ELSE NULL
            END,
            "completedAt" = CASE
              WHEN j.attempts >= j."maxAttempts"
              THEN NOW()
              ELSE NULL
            END,
            "lastErrorCode" = 'LEASE_EXPIRED',
            "lastError" =
              'Worker execution lease expired.',
            "lockToken" = NULL,
            "lockExpiresAt" = NULL,
            "heartbeatAt" = NULL,
            "updatedAt" = NOW()
          FROM expired
          WHERE j.id = expired.id
          RETURNING j.*
        `,
        [
          DISCOVERY_JOB_POLICY.recoveryBatchSize,
          DISCOVERY_JOB_POLICY.maximumRetrySeconds,
        ]
      );

  return result.rows;
}

export async function cancelSyncJob(
  id: number
): Promise<DiscoverySyncJob | null> {
  integer(
    id,
    1,
    2147483647,
    "job ID"
  );

  const result =
    await getDiscoveryPool()
      .query<DiscoverySyncJob>(
        `
          UPDATE public.discovery_sync_jobs
          SET
            status = 'CANCELLED',
            "completedAt" = NOW(),
            "nextRetryAt" = NULL,
            "lockToken" = NULL,
            "lockExpiresAt" = NULL,
            "heartbeatAt" = NULL,
            "updatedAt" = NOW()
          WHERE id = $1
            AND status IN ('PENDING', 'RETRY')
          RETURNING *
        `,
        [id]
      );

  return result.rows[0] ?? null;
}
