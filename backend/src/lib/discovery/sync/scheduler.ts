import {
  getDiscoveryPool,
} from "./database";

import {
  enqueueSyncJob,
  type DiscoveryJobType,
  type JobParameters,
} from "./jobs";

import {
  hasDiscoveryImplementation,
} from "./capabilities";

import {
  getApiSportsProvider,
} from "../providers/config";

const MAX_NEW_JOBS = 20;
const MAX_PENDING_JOBS = 100;

type SeasonTarget = {
  sportSlug: string;
  league: string;
  season: string;
  seasonId: number;
};

type ClubTarget = SeasonTarget & {
  team: string;
};

function providerId(
  value: string
): number | null {
  if (!/^\\d+$/.test(value)) return null;

  const id = Number(value);

  return Number.isSafeInteger(id) &&
    id > 0 &&
    id <= 2147483647
      ? id
      : null;
}

function validSeason(value: string): boolean {
  if (!/^\\d{4}(?:-\\d{4})?$/.test(value)) {
    return false;
  }

  const years = value.split("-").map(Number);

  return years.every(
    year => year >= 1900 && year <= 2200
  ) && (
    years.length === 1 ||
    years[1] === years[0] + 1
  );
}

export async function scheduleDiscoveryJobs() {
  if (
    process.env.DISCOVERY_WORKER_ENABLED !== "true"
  ) {
    return { enabled: false, created: 0 };
  }

  const pool = getDiscoveryPool();

  const queue = await pool.query<{ count: number }>(`
    SELECT count(*)::integer AS count
    FROM public.discovery_sync_jobs
    WHERE status IN ('PENDING', 'RUNNING', 'RETRY')
  `);

  const capacity = Math.min(
    MAX_NEW_JOBS,
    Math.max(
      0,
      MAX_PENDING_JOBS - queue.rows[0].count
    )
  );

  let created = 0;

  const now = new Date();
  const daily = now.toISOString().slice(0, 10);

  const weekly = String(
    Math.floor(
      now.getTime() / (7 * 86400000)
    )
  );

  async function schedule(
    sport: string,
    jobType: DiscoveryJobType,
    parameters: JobParameters,
    interval: "DAILY" | "WEEKLY",
    priority: number
  ) {
    if (created >= capacity) return;

    const provider = getApiSportsProvider(sport);

    if (
      !provider ||
      !hasDiscoveryImplementation(sport, jobType)
    ) {
      return;
    }

    const existing = await pool.query(`
      SELECT 1
      FROM public.discovery_sync_jobs
      WHERE "sportSlug" = $1
        AND "jobType" = $2
        AND parameters::jsonb = $3::jsonb
        AND status IN (
          'PENDING', 'RUNNING', 'RETRY'
        )
      LIMIT 1
    `, [
      sport,
      jobType,
      JSON.stringify(parameters),
    ]);

    if (existing.rowCount) return;

    const result = await enqueueSyncJob({
      sport,
      jobType,
      parameters,
      scheduleKey:
        interval === "DAILY"
          ? `AUTO-D-${daily}`
          : `AUTO-W-${weekly}`,
      priority,
    });

    if (result.created) created++;
  }

  async function prerequisiteCompleted(
    sport: string,
    jobType: DiscoveryJobType,
    parameters: JobParameters
  ): Promise<boolean> {
    const result = await pool.query<{
      completed: boolean;
      unfinished: boolean;
    }>(`
      SELECT
        COALESCE(
          bool_or(status = 'COMPLETED'),
          false
        ) AS completed,
        COALESCE(
          bool_or(status IN (
            'PENDING', 'RUNNING', 'RETRY'
          )),
          false
        ) AS unfinished
      FROM public.discovery_sync_jobs
      WHERE "sportSlug" = $1
        AND "jobType" = $2
        AND parameters::jsonb = $3::jsonb
    `, [
      sport,
      jobType,
      JSON.stringify(parameters),
    ]);

    return (
      result.rows[0].completed &&
      !result.rows[0].unfinished
    );
  }

  const sports = await pool.query<{
    slug: string;
  }>(`
    SELECT slug
    FROM public.sports
    WHERE "isActive" = true
    ORDER BY slug
  `);

  for (const sport of sports.rows) {
    await schedule(
      sport.slug,
      "COMPETITIONS",
      {},
      "WEEKLY",
      10
    );
  }

  const seasons = await pool.query<SeasonTarget>(`
    SELECT
      s.slug AS "sportSlug",
      c."providerLeagueId" AS league,
      cs."providerSeason" AS season,
      cs.id AS "seasonId"
    FROM public.competition_seasons cs
    JOIN public.competitions c
      ON c.id = cs."competitionId"
    JOIN public.sports s
      ON s.id = c."sportId"
    WHERE s."isActive" = true
      AND c."isActive" = true
      AND c."dataSource" = 'PROVIDER'
      AND c."publicationStatus" <> 'ARCHIVED'
      AND cs."isCurrent" = true
      AND c."providerLeagueId" IS NOT NULL
      AND cs."providerSeason" IS NOT NULL
    ORDER BY cs.id
  `);

  const rotation = Math.floor(
    now.getTime() / 60000
  );

  function rotate<T>(items: T[]): T[] {
    if (!items.length) return items;

    const offset = rotation % items.length;

    return [
      ...items.slice(offset),
      ...items.slice(0, offset),
    ];
  }

  for (const target of rotate(seasons.rows)) {
    if (created >= capacity) break;

    const league = providerId(target.league);

    if (!league || !validSeason(target.season)) {
      continue;
    }

    const parameters = {
      league,
      season: target.season,
    };

    await schedule(
      target.sportSlug,
      "CLUBS",
      parameters,
      "WEEKLY",
      20
    );

    if (
      !await prerequisiteCompleted(
        target.sportSlug,
        "CLUBS",
        parameters
      )
    ) {
      continue;
    }

    const membership = await pool.query(`
      SELECT 1
      FROM public.competition_teams
      WHERE "seasonId" = $1
      LIMIT 1
    `, [target.seasonId]);

    if (!membership.rowCount) continue;

    await schedule(
      target.sportSlug,
      "STANDINGS",
      parameters,
      "DAILY",
      40
    );

    if (target.sportSlug === "football") {
      await schedule(
        target.sportSlug,
        "PLAYERS",
        parameters,
        "WEEKLY",
        30
      );

      const players = await pool.query(`
        SELECT 1
        FROM public.players p
        JOIN public.sports s
          ON s.id = p."sportId"
        WHERE s.slug = $1
          AND p."dataSource" = 'PROVIDER'
          AND p."isActive" = true
        LIMIT 1
      `, [target.sportSlug]);

      if (
        players.rowCount &&
        await prerequisiteCompleted(
          target.sportSlug,
          "PLAYERS",
          parameters
        )
      ) {
        await schedule(
          target.sportSlug,
          "STATISTICS",
          parameters,
          "DAILY",
          50
        );
      }
    }
  }

  if (created < capacity) {
    const clubs = await pool.query<ClubTarget>(`
      SELECT DISTINCT
        s.slug AS "sportSlug",
        c."providerLeagueId" AS league,
        cs."providerSeason" AS season,
        cs.id AS "seasonId",
        t."providerTeamId" AS team
      FROM public.competition_teams ct
      JOIN public.teams t
        ON t.id = ct."teamId"
      JOIN public.competition_seasons cs
        ON cs.id = ct."seasonId"
      JOIN public.competitions c
        ON c.id = cs."competitionId"
      JOIN public.sports s
        ON s.id = c."sportId"
      WHERE s."isActive" = true
        AND c."isActive" = true
        AND t."isActive" = true
        AND t."dataSource" = 'PROVIDER'
        AND c."dataSource" = 'PROVIDER'
        AND t."publicationStatus" <> 'ARCHIVED'
        AND c."publicationStatus" <> 'ARCHIVED'
        AND t."sportId" = s.id
        AND t."providerName" = c."providerName"
        AND cs."isCurrent" = true
        AND t."providerTeamId" IS NOT NULL
        AND cs."providerSeason" IS NOT NULL
        AND s.slug IN ('football', 'basketball')
      ORDER BY "seasonId", team
    `);

    for (const target of rotate(clubs.rows)) {
      if (created >= capacity) break;

      const team = providerId(target.team);

      const league = providerId(target.league);

      if (
        !team ||
        !league ||
        !validSeason(target.season)
      ) {
        continue;
      }

      if (
        !await prerequisiteCompleted(
          target.sportSlug,
          "CLUBS",
          {
            league,
            season: target.season,
          }
        )
      ) {
        continue;
      }

      if (target.sportSlug === "football") {
        await schedule(
          target.sportSlug,
          "SQUADS",
          { team },
          "WEEKLY",
          30
        );
      }

      if (target.sportSlug === "basketball") {
        await schedule(
          target.sportSlug,
          "PLAYERS",
          {
            team,
            season: target.season,
          },
          "WEEKLY",
          30
        );
      }
    }
  }

  return {
    enabled: true,
    created,
  };
}
