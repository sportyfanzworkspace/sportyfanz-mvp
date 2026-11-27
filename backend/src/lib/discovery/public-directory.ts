import {
  parseDirectoryQuery,
  queryDirectory,
  DirectoryQueryError,
  type DirectoryKind,
} from "./directory-pagination";

import { getDiscoveryPool } from "./sync/database";
import { db } from "@/lib/prisma";
import { normalizeCompetitionName } from "./public-visibility";

function publicTeam(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    slug: row.slug,
    sportId: row.sportId,
    sportName: row.sportName ?? "Sport",
    country: row.country,
    city: row.city,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
  };
}

function publicCompetition(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    slug: row.slug,
    sportId: row.sportId,
    sportName: row.sportName ?? "Sport",
    country: row.country,
    competitionType: row.competitionType,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
  };
}

function playerName(row: Record<string, any>) {
  return row.displayName?.trim() ||
    `${row.firstName} ${row.lastName}`.trim();
}

async function publicPlayers(
  rows: Record<string, any>[]
) {
  if (!rows.length) return [];

  const pool = getDiscoveryPool();

  const memberships = await pool.query(
    `SELECT pt."playerId", t.name
     FROM public.player_teams pt
     JOIN public.teams t
       ON t.id = pt."teamId"
     JOIN public.sports s
       ON s.id = t."sportId"
     WHERE pt."playerId" = ANY($1::int[])
       AND pt."leftAt" IS NULL
       AND t."isActive" = TRUE
       AND t."publicationStatus" = 'PUBLISHED'
       AND s."isActive" = TRUE
     ORDER BY t.name, t.id`,
    [rows.map(row => row.id)]
  );

  const clubs = new Map<number, string[]>();

  for (const item of memberships.rows) {
    const names = clubs.get(item.playerId) ?? [];
    names.push(item.name);
    clubs.set(item.playerId, names);
  }

  return rows.map(row => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    name: playerName(row),
    slug: row.slug,
    sportId: row.sportId,
    sportName: row.sportName ?? null,
    position: row.position,
    nationality: row.nationality,
    jerseyNumber: row.jerseyNumber,
    avatarUrl: row.avatarUrl,
    teams: clubs.get(row.id) ?? [],
  }));
}

export async function loadPublicDirectory(
  params: URLSearchParams,
  userId: Awaited<
    ReturnType<typeof import("@/lib/auth").getCurrentUserId>
  >
) {
  const requested = params.get("directory");

  if (
    requested !== "sports" &&
    requested !== "clubs" &&
    requested !== "players" &&
    requested !== "competitions"
  ) {
    throw new DirectoryQueryError("Invalid directory.");
  }

  const directory = requested;

  const query = parseDirectoryQuery(
    params,
    directory === "sports" ? "clubs" : directory,
    "PUBLIC"
  );

  const pool = getDiscoveryPool();

  const [
    allSports,
    sportFollows,
    teamFollows,
    playerFollows,
  ] = await Promise.all([
    db.orm.public.Sport.where({ isActive: true }).all(),

    userId
      ? db.orm.public.UserSportFollow
          .where({ userId }).all()
      : Promise.resolve([]),

    userId
      ? db.orm.public.UserTeamFollow
          .where({ userId }).all()
      : Promise.resolve([]),

    userId
      ? db.orm.public.UserPlayerFollow
          .where({ userId }).all()
      : Promise.resolve([]),
  ]);

  const sports = allSports.map(sport => ({
    id: sport.id,
    name: sport.name,
    slug: sport.slug,
    description: sport.description,
    iconUrl: sport.iconUrl,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const followedSportIds = sportFollows.map(
    item => item.sportId
  );

  const followedTeamIds = teamFollows.map(
    item => item.teamId
  );

  const followedPlayerIds = playerFollows.map(
    item => item.playerId
  );

  const interestNames: string[] = sports
    .filter(sport => followedSportIds.includes(sport.id))
    .map(sport => sport.name);

  const [
    followedTeams,
    followedPlayers,
  ] = await Promise.all([
    followedTeamIds.length
      ? pool.query(
          `SELECT t.id, t.name, t.slug
           FROM public.teams t
           JOIN public.sports s
             ON s.id = t."sportId"
           WHERE t.id = ANY($1::int[])
             AND t."isActive" = TRUE
             AND t."publicationStatus" = 'PUBLISHED'
             AND s."isActive" = TRUE
           ORDER BY t.name, t.id`,
          [followedTeamIds]
        )
      : Promise.resolve({ rows: [] }),

    followedPlayerIds.length
      ? pool.query(
          `SELECT p.id,
             p.slug,
             p."displayName",
             p."firstName",
             p."lastName"
           FROM public.players p
           LEFT JOIN public.sports s
             ON s.id = p."sportId"
           WHERE p.id = ANY($1::int[])
             AND p."isActive" = TRUE
             AND p."publicationStatus" = 'PUBLISHED'
             AND (
               p."sportId" IS NULL OR
               s."isActive" = TRUE
             )
           ORDER BY p.id`,
          [followedPlayerIds]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  interestNames.push(
    ...followedTeams.rows.map(row => row.name),
    ...followedPlayers.rows.map(playerName)
  );

  const interests = [
    ...sports
      .filter(sport =>
        followedSportIds.includes(sport.id)
      )
      .map(sport => ({
        type: "sport" as const,
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
      })),

    ...followedTeams.rows.map(row => ({
      type: "club" as const,
      id: row.id,
      name: row.name,
      slug: row.slug,
    })),

    ...followedPlayers.rows.map(row => ({
      type: "player" as const,
      id: row.id,
      name: playerName(row),
      slug: row.slug,
    })),
  ];

  const result = await queryDirectory({
    ...query,
    directory: (
      directory === "sports" ? "clubs" : directory
    ) as DirectoryKind,
    page: directory === "sports" ? 1 : query.page,
    pageSize: directory === "sports" ? 4 : query.pageSize,
  });

  const teams =
    directory === "sports" || directory === "clubs"
      ? result.records.map(publicTeam)
      : [];

  const players = directory === "players"
    ? await publicPlayers(result.records)
    : [];

  const competitionProfiles =
    directory === "competitions"
      ? result.records.map(publicCompetition)
      : [];

  // Legacy match competition names are separate
  // from paginated competition profiles.
  const legacyCompetitions: string[] = [];

  if (
    directory === "competitions" &&
    query.sportId === null &&
    query.page === 1
  ) {
    const [legacy, published] = await Promise.all([
      pool.query(
        `SELECT DISTINCT
           BTRIM(m.competition) AS name
         FROM public.matches m
         WHERE m.competition IS NOT NULL
           AND BTRIM(m.competition) <> ''
           AND m.status <> 'CANCELLED'
           AND STRPOS(
             LOWER(BTRIM(m.competition)), $1
           ) > 0
         ORDER BY name
         LIMIT 101`,
        [query.search.toLowerCase()]
      ),

      pool.query(
        `SELECT c.name
         FROM public.competitions c
         JOIN public.sports s
           ON s.id = c."sportId"
         WHERE c."isActive" = TRUE
           AND c."publicationStatus" = 'PUBLISHED'
           AND s."isActive" = TRUE`
      ),
    ]);

    const known = new Set(
      published.rows.map(row =>
        normalizeCompetitionName(row.name)
      )
    );

    for (const row of legacy.rows) {
      const key = normalizeCompetitionName(row.name);

      if (!key || known.has(key)) continue;

      known.add(key);
      legacyCompetitions.push(row.name);

      if (legacyCompetitions.length >= 100) break;
    }
  }

  return {
    success: true,
    directory,
    sports,
    teams,
    players,
    competitions: legacyCompetitions,
    competitionProfiles,
    followedSportIds,
    followedTeamIds,
    followedPlayerIds,
    interestNames: [...new Set(interestNames)],
    interests,
    pagination: directory === "sports"
      ? null
      : result.pagination,
  };
}
