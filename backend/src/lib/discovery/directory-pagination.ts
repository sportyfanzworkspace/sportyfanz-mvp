import { getDiscoveryPool } from "./sync/database";

export type DirectoryKind =
  | "clubs"
  | "players"
  | "competitions";

export type DirectoryAudience = "PUBLIC" | "ADMIN";

export class DirectoryQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectoryQueryError";
  }
}

export type DirectoryQuery = {
  directory: DirectoryKind;
  audience: DirectoryAudience;
  search: string;
  sportId: number | null;
  status: string;
  source: string;
  page: number;
  pageSize: number;
};

const tables: Record<DirectoryKind, string> = {
  clubs: "teams",
  players: "players",
  competitions: "competitions",
};

function positiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
  label: string
): number {
  if (value === null) return fallback;

  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new DirectoryQueryError(`Invalid ${label}.`);
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed > maximum
  ) {
    throw new DirectoryQueryError(`Invalid ${label}.`);
  }

  return parsed;
}

export function parseDirectoryQuery(
  params: URLSearchParams,
  directory: DirectoryKind,
  audience: DirectoryAudience
): DirectoryQuery {
  if (!Object.hasOwn(tables, directory)) {
    throw new DirectoryQueryError("Invalid directory.");
  }

  if (audience !== "PUBLIC" && audience !== "ADMIN") {
    throw new DirectoryQueryError("Invalid directory audience.");
  }

  const search = (params.get("search") ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

  if (search.length > 150) {
    throw new DirectoryQueryError("Search is too long.");
  }

  const sport = params.get("sportId");

  const sportId =
    sport === null || sport === "ALL"
      ? null
      : positiveInteger(
          sport,
          1,
          2147483647,
          "sport"
        );

  const status = audience === "ADMIN"
    ? params.get("status") ?? "ALL"
    : "PUBLISHED";

  const source = audience === "ADMIN"
    ? params.get("source") ?? "ALL"
    : "ALL";

  if (
    !["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"]
      .includes(status)
  ) {
    throw new DirectoryQueryError(
      "Invalid publication status."
    );
  }

  if (
    !["ALL", "MANUAL", "PROVIDER", "UNKNOWN"]
      .includes(source)
  ) {
    throw new DirectoryQueryError("Invalid data source.");
  }

  return {
    directory,
    audience,
    search,
    sportId,
    status,
    source,
    page: positiveInteger(
      params.get("page"),
      1,
      10000,
      "page"
    ),
    pageSize: positiveInteger(
      params.get("pageSize"),
      audience === "PUBLIC" ? 20 : 25,
      100,
      "page size"
    ),
  };
}

export function buildDirectoryQuery(
  input: DirectoryQuery
) {
  if (!Object.hasOwn(tables, input.directory)) {
    throw new DirectoryQueryError("Invalid directory.");
  }

  if (
    input.audience !== "PUBLIC" &&
    input.audience !== "ADMIN"
  ) {
    throw new DirectoryQueryError("Invalid audience.");
  }

  if (
    !Number.isSafeInteger(input.page) ||
    input.page < 1 ||
    input.page > 10000 ||
    !Number.isSafeInteger(input.pageSize) ||
    input.pageSize < 1 ||
    input.pageSize > 100
  ) {
    throw new DirectoryQueryError("Invalid pagination.");
  }

  const table = tables[input.directory];
  const isPlayer = input.directory === "players";
  const isPublic = input.audience === "PUBLIC";

  const values: unknown[] = [];
  const conditions: string[] = [];

  function bind(value: unknown) {
    values.push(value);
    return `$${values.length}`;
  }

  const name = isPlayer
    ? `COALESCE(
        NULLIF(BTRIM(r."displayName"), ''),
        CONCAT_WS(' ', r."firstName", r."lastName")
      )`
    : `r."name"`;

  if (isPublic) {
    conditions.push(`r."isActive" = TRUE`);
    conditions.push(
      `r."publicationStatus" = 'PUBLISHED'`
    );

    conditions.push(
      isPlayer
        ? `(r."sportId" IS NULL OR s."isActive" = TRUE)`
        : `s."isActive" = TRUE`
    );
  }

  if (input.sportId !== null) {
    conditions.push(
      `r."sportId" = ${bind(input.sportId)}`
    );
  }

  if (!isPublic && input.status !== "ALL") {
    conditions.push(
      `r."publicationStatus" = ${bind(input.status)}`
    );
  }

  if (!isPublic && input.source !== "ALL") {
    if (input.source === "UNKNOWN") {
      conditions.push(
        `(r."dataSource" IS NULL OR
          r."dataSource" NOT IN ('MANUAL', 'PROVIDER'))`
      );
    } else {
      conditions.push(
        `r."dataSource" = ${bind(input.source)}`
      );
    }
  }

  if (input.search) {
    const searchFields = [
      name,
      `s."name"`,
    ];

    if (isPlayer) {
      searchFields.push(
        `r."firstName"`,
        `r."lastName"`,
        `r."position"`,
        `r."nationality"`
      );
    } else {
      searchFields.push(
        `r."shortName"`,
        `r."country"`
      );

      searchFields.push(
        input.directory === "clubs"
          ? `r."city"`
          : `r."competitionType"`
      );
    }

    if (!isPublic) {
      searchFields.push(
        `r."dataSource"`,
        `r."providerName"`,
        `CASE
          WHEN r."providerName" LIKE 'API_SPORTS_%'
          THEN 'API-Sports'
          ELSE ''
        END`,
        isPlayer
          ? `r."providerPlayerId"`
          : input.directory === "clubs"
            ? `r."providerTeamId"`
            : `r."providerLeagueId"`
      );
    }

    const searchValue = bind(
      input.search.toLowerCase()
    );

    const directMatch = `
      STRPOS(
        LOWER(CONCAT_WS(' ', ${searchFields.join(", ")})),
        ${searchValue}
      ) > 0
    `;

    const membershipMatch = isPlayer
      ? `OR EXISTS (
          SELECT 1
          FROM public.player_teams pt
          JOIN public.teams t
            ON t.id = pt."teamId"
          JOIN public.sports ts
            ON ts.id = t."sportId"
          WHERE pt."playerId" = r.id
            AND pt."leftAt" IS NULL
            ${isPublic ? `
              AND t."isActive" = TRUE
              AND t."publicationStatus" = 'PUBLISHED'
              AND ts."isActive" = TRUE
            ` : ""}
            AND STRPOS(
              LOWER(t."name"),
              ${searchValue}
            ) > 0
        )`
      : "";

    conditions.push(
      `(${directMatch} ${membershipMatch})`
    );
  }

  const from = `
    FROM public.${table} r
    LEFT JOIN public.sports s
      ON s.id = r."sportId"
  `;

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countValues = [...values];

  const limit = bind(input.pageSize);

  const offset = bind(
    (input.page - 1) * input.pageSize
  );

  return {
    countSql: `
      SELECT COUNT(*)::text AS total
      ${from}
      ${where}
    `,
    countValues,
    pageSql: `
      SELECT r.*, s."name" AS "sportName"
      ${from}
      ${where}
      ORDER BY LOWER(${name}), r.id
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    pageValues: values,
  };
}

export async function queryDirectory(
  input: DirectoryQuery
) {
  const query = buildDirectoryQuery(input);
  const pool = getDiscoveryPool();
  const client = await pool.connect();

  try {
    await client.query(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );

    const count = await client.query(
      query.countSql,
      query.countValues
    );

    const total = Number(count.rows[0]?.total ?? 0);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error("Invalid directory count.");
    }

    const result = await client.query(
      query.pageSql,
      query.pageValues
    );

    await client.query("COMMIT");

    return {
      records: result.rows,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
        hasPrevious: input.page > 1,
        hasNext: input.page * input.pageSize < total,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
