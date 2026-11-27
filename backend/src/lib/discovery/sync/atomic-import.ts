import { db } from "@/lib/prisma";

import {
  DISCOVERY_JOB_POLICY,
  DiscoveryJobLeaseError,
  type JobProgress,
} from "./jobs";

import type {
  DiscoveryImportTransaction,
} from "../imports/transaction";

import type {
  ImportOutcome,
} from "../imports/persist";

export type AtomicImportCheckpoint = {
  nextPage: number;
  nextRecord: number;
  pageFingerprint: string;
};

function validateCheckpoint(
  checkpoint: AtomicImportCheckpoint
): void {
  if (
    !Number.isSafeInteger(checkpoint.nextPage) ||
    checkpoint.nextPage < 1 ||
    checkpoint.nextPage > 501 ||
    !Number.isSafeInteger(checkpoint.nextRecord) ||
    checkpoint.nextRecord < 0 ||
    checkpoint.nextRecord > 5000 ||
    !/^[a-f0-9]{64}$/.test(
      checkpoint.pageFingerprint
    )
  ) {
    throw new Error("Invalid atomic checkpoint.");
  }
}

function validateProgress(
  progress: JobProgress
): void {
  const values = [
    progress.processed,
    progress.created,
    progress.updated,
    progress.skipped,
    progress.conflicted,
  ];

  if (
    values.some(value =>
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > 2147483647
    ) ||
    progress.processed !==
      progress.created +
      progress.updated +
      progress.skipped +
      progress.conflicted
  ) {
    throw new Error("Invalid import progress.");
  }
}

function countOutcome(
  progress: JobProgress,
  outcome: ImportOutcome
): JobProgress {
  const next = {
    ...progress,
    processed: progress.processed + 1,
  };

  switch (outcome.status) {
    case "CREATED":
      next.created++;
      break;

    case "UPDATED":
      next.updated++;
      break;

    case "CONFLICT":
      next.conflicted++;
      break;

    case "EXISTING":
    case "SKIPPED":
      next.skipped++;
      break;

    default:
      throw new Error("Invalid import outcome.");
  }

  validateProgress(next);

  return next;
}

export async function atomicImportRecord(input: {
  jobId: number;
  token: string;
  sportSlug: string;
  expectedCheckpoint: string | null;
  checkpoint: AtomicImportCheckpoint;
  operation: (
    tx: DiscoveryImportTransaction
  ) => Promise<ImportOutcome>;
}): Promise<{
  outcome: ImportOutcome;
  progress: JobProgress;
  checkpoint: string;
}> {
  validateCheckpoint(input.checkpoint);

  return db.transaction(async tx => {
    // Lock the job row before examining ownership.
    const job =
      await tx.orm.public.DiscoverySyncJob
        .where({ id: input.jobId })
        .update({ id: input.jobId });

    function verifyLease() {
      if (
        !job ||
        job.status !== "RUNNING" ||
        job.lockToken !== input.token ||
        job.sportSlug !== input.sportSlug ||
        !job.lockExpiresAt ||
        !Number.isFinite(
          Date.parse(job.lockExpiresAt)
        ) ||
        Date.parse(job.lockExpiresAt) <= Date.now()
      ) {
        throw new DiscoveryJobLeaseError();
      }
    }

    verifyLease();

    if (
      job.checkpoint !== input.expectedCheckpoint
    ) {
      throw new DiscoveryJobLeaseError();
    }

    // Serialize automated imports for the same sport.
    const sport =
      await tx.orm.public.Sport
        .where({ slug: input.sportSlug })
        .first();

    if (!sport?.isActive) {
      throw new Error("Sport is unavailable.");
    }

    const lockedSport =
      await tx.orm.public.Sport
        .where({ id: sport.id })
        .update({
          id: sport.id,
          updatedAt: sport.updatedAt,
        });

    if (!lockedSport?.isActive) {
      throw new Error("Sport is unavailable.");
    }

    verifyLease();

    const outcome = await input.operation(tx);

    const progress = countOutcome(
      {
        processed: job.recordsProcessed,
        created: job.recordsCreated,
        updated: job.recordsUpdated,
        skipped: job.recordsSkipped,
        conflicted: job.recordsConflicted,
      },
      outcome
    );

    // Roll back the import if its lease expired
    // during execution.
    verifyLease();

    const now = Date.now();

    const checkpoint =
      JSON.stringify(input.checkpoint);

    const updated =
      await tx.orm.public.DiscoverySyncJob
        .where({ id: input.jobId })
        .update({
          checkpoint,
          recordsProcessed: progress.processed,
          recordsCreated: progress.created,
          recordsUpdated: progress.updated,
          recordsSkipped: progress.skipped,
          recordsConflicted: progress.conflicted,
          heartbeatAt: new Date(now).toISOString(),
          lockExpiresAt: new Date(
            now +
            DISCOVERY_JOB_POLICY.leaseSeconds * 1000
          ).toISOString(),
        });

    if (!updated) {
      throw new DiscoveryJobLeaseError();
    }

    return {
      outcome,
      progress,
      checkpoint,
    };
  });
}
