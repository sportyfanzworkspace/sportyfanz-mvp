import {
  parseDirectoryQuery,
  queryDirectory,
  type DirectoryKind,
} from "./directory-pagination";

import { getDiscoveryPool } from "./sync/database";
import { db } from "@/lib/prisma";

const tables: Record<DirectoryKind, string> = {
  clubs: "teams",
  players: "players",
  competitions: "competitions",
};

export async function loadAdminDirectory(
  params: URLSearchParams,
  directory: DirectoryKind
) {
  const query = parseDirectoryQuery(
    params,
    directory,
    "ADMIN"
  );

  const pool = getDiscoveryPool();

  const table = tables[directory];

  const [
    result,
    sports,
    statistics,
  ] = await Promise.all([
    queryDirectory(query),

    db.orm.public.Sport
      .where({ isActive: true })
      .all(),

    pool.query(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (
           WHERE "publicationStatus" = 'DRAFT'
         )::text AS draft,
         COUNT(*) FILTER (
           WHERE "publicationStatus" = 'PUBLISHED'
         )::text AS published,
         COUNT(*) FILTER (
           WHERE "publicationStatus" = 'ARCHIVED'
         )::text AS archived
       FROM public.${table}`
    ),
  ]);

  const records = result.records;

  const summary = {
    total: Number(statistics.rows[0]?.total ?? 0),
    DRAFT: Number(statistics.rows[0]?.draft ?? 0),
    PUBLISHED: Number(
      statistics.rows[0]?.published ?? 0
    ),
    ARCHIVED: Number(
      statistics.rows[0]?.archived ?? 0
    ),
  };

  for (const count of Object.values(summary)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("Invalid directory statistics.");
    }
  }

  if (directory === "players") {
    const playerIds = records.map(record => record.id);

    const memberships = playerIds.length
      ? await pool.query(
          `SELECT
             pt."playerId",
             t.id,
             t.name,
             t."sportId",
             t."logoUrl"
           FROM public.player_teams pt
           JOIN public.teams t
             ON t.id = pt."teamId"
           WHERE pt."playerId" = ANY($1::int[])
             AND pt."leftAt" IS NULL
           ORDER BY t.name, t.id`,
          [playerIds]
        )
      : { rows: [] };

    const clubs = new Map<
      number,
      {
        id: number;
        name: string;
        sportId: number;
        logoUrl: string | null;
      }[]
    >();

    for (const membership of memberships.rows) {
      const entries =
        clubs.get(membership.playerId) ?? [];

      entries.push({
        id: membership.id,
        name: membership.name,
        sportId: membership.sportId,
        logoUrl: membership.logoUrl,
      });

      clubs.set(membership.playerId, entries);
    }

    // Retain existing player form club options.
    // These options are independent of directory pagination.
    const teams = await db.orm.public.Team
      .where({ isActive: true })
      .all();

    return {
      success: true,
      players: records.map(record => ({
        ...record,
        teams: clubs.get(record.id) ?? [],
      })),
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        sportId: team.sportId,
      })),
      sports,
      summary,
      pagination: result.pagination,
    };
  }

  return {
    success: true,
    [directory]: records.map(record => ({
      ...record,
      sportName: record.sportName ?? "Sport",
    })),
    sports,
    summary,
    pagination: result.pagination,
  };
}
