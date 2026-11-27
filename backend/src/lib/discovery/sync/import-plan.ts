import type {
  DiscoverySyncJob,
  JobParameters,
} from "./jobs";

import {
  hasDiscoveryImplementation,
} from "./capabilities";

export class UnsupportedImportPlanError
  extends Error {
  constructor() {
    super(
      "No verified execution plan for this job."
    );
    this.name = "UnsupportedImportPlanError";
  }
}

export class InvalidImportParametersError
  extends Error {
  constructor() {
    super("Invalid import parameters.");
    this.name = "InvalidImportParametersError";
  }
}

export type ImportPlan = {
  endpoint: string;
  parameters: JobParameters;
  paginated: boolean;
  kind:
    | "COMPETITIONS"
    | "CLUBS"
    | "PLAYERS"
    | "SQUADS"
    | "STATISTICS"
    | "STANDINGS";
};

function positiveInteger(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}

function validSeason(
  value: unknown
): boolean {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return false;
  }

  const season = String(value);

  if (!/^\d{4}(?:-\d{4})?$/.test(season)) {
    return false;
  }

  const years = season.split("-").map(Number);

  return (
    years.every(
      year => year >= 1900 && year <= 2200
    ) &&
    (
      years.length === 1 ||
      years[1] === years[0] + 1
    )
  );
}

function validCountry(
  value: unknown
): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 100 &&
    /^[\p{L}\p{M} .'-]+$/u.test(value)
  );
}

export function buildImportPlan(
  job: DiscoverySyncJob
): ImportPlan {
  let parameters: JobParameters;

  try {
    parameters = JSON.parse(job.parameters);
  } catch {
    throw new InvalidImportParametersError();
  }

  if (
    !parameters ||
    typeof parameters !== "object" ||
    Array.isArray(parameters)
  ) {
    throw new InvalidImportParametersError();
  }

  if (
    !hasDiscoveryImplementation(
      job.sportSlug,
      job.jobType
    )
  ) {
    throw new UnsupportedImportPlanError();
  }

  function allowOnly(keys: string[]) {
    if (
      Object.keys(parameters).some(
        key => !keys.includes(key)
      )
    ) {
      throw new InvalidImportParametersError();
    }
  }

  function validateOptionalSeason() {
    if (
      parameters.season !== undefined &&
      !validSeason(parameters.season)
    ) {
      throw new InvalidImportParametersError();
    }
  }

  if (job.jobType === "COMPETITIONS") {
    allowOnly(["country", "season", "id"]);

    validateOptionalSeason();

    if (
      parameters.country !== undefined &&
      !validCountry(parameters.country)
    ) {
      throw new InvalidImportParametersError();
    }

    if (
      parameters.id !== undefined &&
      !positiveInteger(parameters.id)
    ) {
      throw new InvalidImportParametersError();
    }

    return {
      endpoint: "/leagues",
      parameters,
      paginated: false,
      kind: "COMPETITIONS",
    };
  }

  if (job.jobType === "CLUBS") {
    allowOnly(["league", "season", "id"]);

    validateOptionalSeason();

    if (
      parameters.id !== undefined &&
      !positiveInteger(parameters.id)
    ) {
      throw new InvalidImportParametersError();
    }

    if (
      parameters.league !== undefined &&
      !positiveInteger(parameters.league)
    ) {
      throw new InvalidImportParametersError();
    }

    if (
      parameters.id === undefined &&
      (
        !positiveInteger(parameters.league) ||
        !validSeason(parameters.season)
      )
    ) {
      throw new InvalidImportParametersError();
    }

    return {
      endpoint: "/teams",
      parameters,
      paginated: false,
      kind: "CLUBS",
    };
  }

  if (
    job.jobType === "SQUADS" &&
    job.sportSlug === "football"
  ) {
    allowOnly(["team"]);

    if (!positiveInteger(parameters.team)) {
      throw new InvalidImportParametersError();
    }

    return {
      endpoint: "/players/squads",
      parameters,
      paginated: false,
      kind: "SQUADS",
    };
  }

  if (
    job.jobType === "STANDINGS" &&
    (
      job.sportSlug === "football" ||
      job.sportSlug === "basketball" ||
      job.sportSlug === "baseball" ||
      job.sportSlug === "rugby" ||
      job.sportSlug === "volleyball"
    )
  ) {
    allowOnly(["league", "season"]);

    if (
      !positiveInteger(parameters.league) ||
      !validSeason(parameters.season) ||
      (
        job.sportSlug === "football" &&
        !/^\d{4}$/.test(String(parameters.season))
      )
    ) {
      throw new InvalidImportParametersError();
    }

    return {
      endpoint: "/standings",
      parameters,
      paginated: false,
      kind: "STANDINGS",
    };
  }

  if (
    job.jobType === "STATISTICS" &&
    job.sportSlug === "football"
  ) {
    allowOnly(["league", "season"]);

    if (
      !positiveInteger(parameters.league) ||
      !validSeason(parameters.season) ||
      !/^\d{4}$/.test(String(parameters.season)) ||
      Number(parameters.season) < 1900 ||
      Number(parameters.season) > 2200
    ) {
      throw new InvalidImportParametersError();
    }

    return {
      endpoint: "/players",
      parameters,
      paginated: true,
      kind: "STATISTICS",
    };
  }

  if (
    job.jobType === "PLAYERS" &&
    job.sportSlug === "basketball"
  ) {
    allowOnly(["team", "season"]);

    if (
      !positiveInteger(parameters.team) ||
      !validSeason(parameters.season)
    ) {
      throw new InvalidImportParametersError();
    }

    return {
      endpoint: "/players",
      parameters,
      paginated: false,
      kind: "PLAYERS",
    };
  }

  // Other sports require their own verified
  // player endpoint and parameter mappings.
  if (
    job.jobType === "PLAYERS" &&
    job.sportSlug === "football"
  ) {
    allowOnly(["team", "league", "season", "id"]);

    if (!validSeason(parameters.season)) {
      throw new InvalidImportParametersError();
    }

    for (const key of ["team", "league", "id"]) {
      if (
        parameters[key] !== undefined &&
        !positiveInteger(parameters[key])
      ) {
        throw new InvalidImportParametersError();
      }
    }

    if (
      parameters.team === undefined &&
      parameters.league === undefined &&
      parameters.id === undefined
    ) {
      throw new InvalidImportParametersError();
    }

    return {
      endpoint: "/players",
      parameters,
      paginated: true,
      kind: "PLAYERS",
    };
  }

  throw new UnsupportedImportPlanError();
}
