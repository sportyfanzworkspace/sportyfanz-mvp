import {
  importStandingsSnapshot,
} from "./standings-snapshot";

import { createHash } from "node:crypto";

import {
  atomicImportRecord,
} from "./atomic-import";

import type {
  DiscoveryImportTransaction,
} from "../imports/transaction";

import {
  claimSyncJob,
  heartbeatSyncJob,
  checkpointSyncJob,
  completeSyncJob,
  retrySyncJob,
  failSyncJob,
  DiscoveryJobLeaseError,
  type DiscoverySyncJob,
} from "./jobs";

import {
  deferSyncJob,
} from "./defer";

import {
  buildImportPlan,
  UnsupportedImportPlanError,
  InvalidImportParametersError,
} from "./import-plan";

import {
  requestPersistentProvider,
} from "./provider-service";

import {
  DiscoveryQuotaError,
} from "../providers/service";

import {
  SportsProviderError,
} from "../providers/client";

import {
  normalizeCompetition,
  normalizeClub,
  normalizeBatch,
} from "../imports/normalize";

import {
  normalizePlayer,
} from "../imports/player-normalize";

import {
  importCompetition,
  type ImportOutcome,
} from "../imports/persist";

import {
  importPlayer,
} from "../imports/player-persist";

import {
  importClubWithSeason,
} from "./relationship-import";

import {
  expandFootballSquad,
  normalizeSquadPlayer,
  importSquadPlayer,
} from "./squad-import";

import {
  expandFootballStatistics,
  type ProviderPlayerStatistics,
} from "./player-data-adapter";

import {
  importStatistics,
} from "./statistics-import";

import {
  expandFootballStandings,
  normalizeFootballStanding,
} from "./standings-import";

import {
  expandMultisportStandings,
  normalizeMultisportStanding,
} from "./multisport-standings";

const MAX_PAGES = 500;
const MAX_PAGE_RECORDS = 5000;

type WorkerResult = {
  jobId: number;
  status: string;
  processed: number;
};

function summarize(
  job: DiscoverySyncJob
): WorkerResult {
  return {
    jobId: job.id,
    status: job.status,
    processed: job.recordsProcessed,
  };
}

type WorkerCursor = {
  nextPage: number;
  nextRecord: number;
  pageFingerprint: string | null;
};

function readCursor(
  checkpoint: string | null
): WorkerCursor {
  if (!checkpoint) {
    return {
      nextPage: 1,
      nextRecord: 0,
      pageFingerprint: null,
    };
  }

  let value;

  try {
    value = JSON.parse(checkpoint);
  } catch {
    throw new InvalidImportParametersError();
  }

  if (
    !value ||
    !Number.isSafeInteger(value.nextPage) ||
    value.nextPage < 1 ||
    value.nextPage > MAX_PAGES + 1 ||
    !Number.isSafeInteger(value.nextRecord ?? 0) ||
    (value.nextRecord ?? 0) < 0 ||
    (value.nextRecord ?? 0) > MAX_PAGE_RECORDS ||
    (
      value.pageFingerprint != null &&
      !/^[a-f0-9]{64}$/.test(value.pageFingerprint)
    )
  ) {
    throw new InvalidImportParametersError();
  }

  return {
    nextPage: value.nextPage,
    nextRecord: value.nextRecord ?? 0,
    pageFingerprint: value.pageFingerprint ?? null,
  };
}

async function importBatch<T>(
  job: DiscoverySyncJob,
  token: string,
  values: unknown[],
  normalize: (value: unknown) => T,
  identity: (value: T) => string,
  persist: (
    value: T,
    tx: DiscoveryImportTransaction
  ) => Promise<ImportOutcome>,
  page: number,
  initialCheckpoint: string | null
): Promise<string | null> {
  const batch = normalizeBatch(
    values,
    normalize,
    identity
  );

  const operations: (
    (tx: DiscoveryImportTransaction) =>
      Promise<ImportOutcome>
  )[] = [];

  for (const rejected of batch.rejected) {
    operations.push(async () => ({
      status: "CONFLICT",
      id: null,
      reason: "Provider record rejected.",
    }));
  }

  for (const record of batch.records) {
    operations.push(tx => persist(record, tx));
  }

  const fingerprint = createHash("sha256")
    .update(JSON.stringify(values))
    .digest("hex");

  const cursor = readCursor(initialCheckpoint);

  if (
    cursor.nextPage !== page ||
    cursor.nextRecord > operations.length ||
    (
      cursor.nextRecord > 0 &&
      cursor.pageFingerprint !== fingerprint
    )
  ) {
    throw new InvalidImportParametersError();
  }

  let checkpoint = initialCheckpoint;

  for (
    let index = cursor.nextRecord;
    index < operations.length;
    index++
  ) {
    const result = await atomicImportRecord({
      jobId: job.id,
      token,
      sportSlug: job.sportSlug,
      expectedCheckpoint: checkpoint,
      checkpoint: {
        nextPage: page,
        nextRecord: index + 1,
        pageFingerprint: fingerprint,
      },
      operation: operations[index],
    });

    checkpoint = result.checkpoint;
  }

  return checkpoint;
}

export async function executeNextDiscoveryJob():
  Promise<WorkerResult | null> {
  // Deliberately disabled until transaction-level
  // fencing and provider mappings are verified.
  if (
    process.env.DISCOVERY_WORKER_ENABLED !== "true"
  ) {
    return null;
  }

  const job = await claimSyncJob();

  if (!job) return null;

  const token = job.lockToken;

  if (!token) {
    throw new DiscoveryJobLeaseError();
  }

  try {
    const plan = buildImportPlan(job);

    let currentCheckpoint = job.checkpoint;
    let page = readCursor(currentCheckpoint).nextPage;

    if (page === MAX_PAGES + 1) {
      return summarize(
        await completeSyncJob(job.id, token)
      );
    }

    while (page <= MAX_PAGES) {
      await heartbeatSyncJob(job.id, token);

      const response =
        await requestPersistentProvider(
          job.sportSlug,
          plan.endpoint,
          {
            ...plan.parameters,
            ...(plan.paginated ? { page } : {}),
          },
          Array.isArray
        );

      if (
        response.data.length > MAX_PAGE_RECORDS
      ) {
        return summarize(
          await failSyncJob(
            job.id,
            token,
            "PAGE_LIMIT_EXCEEDED"
          )
        );
      }

      const paging = response.pagination;

      if (
        paging &&
        (
          paging.current !== page ||
          paging.total < page ||
          paging.total > MAX_PAGES ||
          (!plan.paginated && paging.total > 1)
        )
      ) {
        return summarize(
          await failSyncJob(
            job.id,
            token,
            "INVALID_PAGINATION"
          )
        );
      }

      if (plan.paginated && !paging) {
        return summarize(
          await failSyncJob(
            job.id,
            token,
            "MISSING_PAGINATION"
          )
        );
      }

      await heartbeatSyncJob(job.id, token);

      if (plan.kind === "COMPETITIONS") {
        currentCheckpoint = await importBatch(
          job,
          token,
          response.data,
          value => normalizeCompetition(
            job.sportSlug,
            value
          ),
          value => String(value.providerLeagueId),
          importCompetition,
          page,
          currentCheckpoint
        );
      }

      if (plan.kind === "CLUBS") {
        currentCheckpoint = await importBatch(
          job,
          token,
          response.data,
          value => normalizeClub(
            job.sportSlug,
            value
          ),
          value => String(value.providerTeamId),
          (club, tx) => importClubWithSeason(
            club,
            plan.parameters,
            tx
          ),
          page,
          currentCheckpoint
        );
      }

      if (plan.kind === "PLAYERS") {
        currentCheckpoint = await importBatch(
          job,
          token,
          response.data,
          value => normalizePlayer(
            job.sportSlug,
            value
          ),
          value => String(value.providerPlayerId),
          importPlayer,
          page,
          currentCheckpoint
        );
      }

      if (plan.kind === "SQUADS") {
        const squad = expandFootballSquad(
          response.data,
          Number(plan.parameters.team),
          response.fetchedAt
        );

        currentCheckpoint = await importBatch(
          job,
          token,
          squad,
          value => normalizeSquadPlayer(
            job.sportSlug,
            value
          ),
          value => String(
            value.player.providerPlayerId
          ),
          importSquadPlayer,
          page,
          currentCheckpoint
        );
      }

      if (plan.kind === "STANDINGS") {
        const football =
          job.sportSlug === "football";

        const leagueId =
          Number(plan.parameters.league);

        const season =
          String(plan.parameters.season);

        const rows = football
          ? expandFootballStandings(
              response.data,
              leagueId,
              season
            )
          : expandMultisportStandings(
              job.sportSlug,
              response.data,
              leagueId,
              season
            );

        const normalize = football
          ? normalizeFootballStanding
          : (value: unknown) =>
              normalizeMultisportStanding(
                job.sportSlug,
                value
              );

        // Normalize the entire snapshot before
        // allowing any database changes.
        const standings = rows.map(normalize);

        currentCheckpoint = await importBatch(
          job,
          token,
          [{
            standings,
            observedAt: response.fetchedAt,
          }],
          value => value as {
            standings: typeof standings;
            observedAt: string;
          },
          () => JSON.stringify([leagueId, season]),
          (value, tx) => importStandingsSnapshot(
            value.standings,
            value.observedAt,
            tx
          ),
          page,
          currentCheckpoint
        );
      }

      if (plan.kind === "STATISTICS") {
        const rows: unknown[] = [];

        for (const value of response.data) {
          try {
            const expanded =
              expandFootballStatistics(value);

            for (const row of expanded) {
              if (
                row.providerLeagueId !==
                  Number(plan.parameters.league) ||
                row.providerSeason !==
                  String(plan.parameters.season)
              ) {
                continue;
              }

              rows.push(row);
            }
          } catch {
            rows.push(null);
          }

          if (rows.length > MAX_PAGE_RECORDS) {
            throw new InvalidImportParametersError();
          }
        }

        currentCheckpoint = await importBatch(
          job,
          token,
          rows.map(value => ({
            value,
            observedAt: response.fetchedAt,
          })),
          entry => {
            if (
              !entry ||
              typeof entry !== "object" ||
              !("value" in entry) ||
              !("observedAt" in entry) ||
              !entry.value ||
              typeof entry.value !== "object" ||
              typeof entry.observedAt !== "string"
            ) {
              throw new Error(
                "Invalid statistics record."
              );
            }

            return {
              statistics:
                entry.value as ProviderPlayerStatistics,
              observedAt: entry.observedAt,
            };
          },
          value => JSON.stringify([
            value.statistics.providerPlayerId,
            value.statistics.providerTeamId,
            value.statistics.providerLeagueId,
            value.statistics.providerSeason,
          ]),
          (value, tx) => importStatistics(
            job.sportSlug,
            value.statistics,
            tx,
            value.observedAt
          ),
          page,
          currentCheckpoint
        );
      }

      const finished =
        !paging || paging.current >= paging.total;

      const latest = await heartbeatSyncJob(
        job.id,
        token
      );

      if (latest.checkpoint !== currentCheckpoint) {
        throw new DiscoveryJobLeaseError();
      }

      const next = await checkpointSyncJob(
        job.id,
        token,
        {
          nextPage: finished
            ? MAX_PAGES + 1
            : page + 1,
          nextRecord: 0,
          pageFingerprint: null,
        },
        {
          processed: latest.recordsProcessed,
          created: latest.recordsCreated,
          updated: latest.recordsUpdated,
          skipped: latest.recordsSkipped,
          conflicted: latest.recordsConflicted,
        }
      );

      currentCheckpoint = next.checkpoint;

      if (finished) {
        return summarize(
          await completeSyncJob(job.id, token)
        );
      }

      page++;
    }

    return summarize(
      await failSyncJob(
        job.id,
        token,
        "PAGINATION_LIMIT_EXCEEDED"
      )
    );

  } catch (error) {
    if (error instanceof DiscoveryJobLeaseError) {
      throw error;
    }

    if (error instanceof DiscoveryQuotaError) {
      return summarize(
        await deferSyncJob(
          job.id,
          token,
          error.reason,
          error.retryAt
        )
      );
    }

    if (
      error instanceof UnsupportedImportPlanError ||
      error instanceof InvalidImportParametersError
    ) {
      return summarize(
        await failSyncJob(
          job.id,
          token,
          error instanceof UnsupportedImportPlanError
            ? "UNSUPPORTED_IMPORT_PLAN"
            : "INVALID_IMPORT_PARAMETERS"
        )
      );
    }

    if (error instanceof SportsProviderError) {
      if (
        error.code === "ACCESS_RESTRICTED" ||
        error.code === "RATE_LIMIT"
      ) {
        return summarize(
          await deferSyncJob(
            job.id,
            token,
            error.code
          )
        );
      }

      if (
        [
          "UNSUPPORTED_SPORT",
          "INVALID_ENDPOINT",
          "INVALID_RESPONSE",
          "MISSING_KEY",
          "PROVIDER_ERROR",
        ].includes(error.code)
      ) {
        return summarize(
          await failSyncJob(
            job.id,
            token,
            error.code
          )
        );
      }

      return summarize(
        await retrySyncJob(
          job.id,
          token,
          error.code
        )
      );
    }

    return summarize(
      await retrySyncJob(
        job.id,
        token,
        "IMPORT_EXECUTION_ERROR"
      )
    );
  }
}
