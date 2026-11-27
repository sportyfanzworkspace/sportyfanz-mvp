import {
  getApiSportsKey,
  getApiSportsProvider,
} from "./config";

export type ProviderErrorCode =
  | "UNSUPPORTED_SPORT"
  | "MISSING_KEY"
  | "INVALID_ENDPOINT"
  | "ACCESS_RESTRICTED"
  | "RATE_LIMIT"
  | "HTTP_ERROR"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE"
  | "TIMEOUT"
  | "NETWORK_ERROR";

export class SportsProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly httpStatus?: number,
    public readonly quota?: ProviderQuota
  ) {
    super(message);
    this.name = "SportsProviderError";
  }
}

export type ProviderQuota = {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  minuteLimit: number | null;
  minuteRemaining: number | null;
  retryAfter: string | null;
};

export type ProviderPagination = {
  current: number;
  total: number;
};

export type ProviderResult<T> = {
  sport: string;
  providerName: string;
  endpoint: string;
  data: T;
  results: number | null;
  pagination: ProviderPagination | null;
  quota: ProviderQuota;
  fetchedAt: string;
};

export type ProviderParameters = Record<
  string,
  string | number | boolean | null | undefined
>;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readQuotaNumber(
  headers: Headers,
  name: string
): number | null {
  const value = headers.get(name);

  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const number = Number(value);

  return Number.isSafeInteger(number)
    ? number
    : null;
}

export function readProviderQuota(
  headers: Headers
): ProviderQuota {
  return {
    dailyLimit: readQuotaNumber(
      headers,
      "x-ratelimit-requests-limit"
    ),
    dailyRemaining: readQuotaNumber(
      headers,
      "x-ratelimit-requests-remaining"
    ),
    minuteLimit: readQuotaNumber(
      headers,
      "x-ratelimit-limit"
    ),
    minuteRemaining: readQuotaNumber(
      headers,
      "x-ratelimit-remaining"
    ),
    retryAfter: headers.get("retry-after"),
  };
}

function readPagination(
  value: unknown
): ProviderPagination | null {
  if (!isRecord(value)) {
    return null;
  }

  const current = value.current;
  const total = value.total;

  if (
    typeof current !== "number" ||
    typeof total !== "number" ||
    !Number.isSafeInteger(current) ||
    !Number.isSafeInteger(total) ||
    current < 1 ||
    total < current
  ) {
    return null;
  }

  return { current, total };
}

function hasProviderErrors(
  errors: unknown
): boolean {
  if (errors === null || errors === undefined) {
    return false;
  }

  if (Array.isArray(errors)) {
    return errors.length > 0;
  }

  if (isRecord(errors)) {
    return Object.keys(errors).length > 0;
  }

  return Boolean(errors);
}

function classifyProviderError(
  errors: unknown
): ProviderErrorCode {
  const keys = isRecord(errors)
    ? Object.keys(errors).join(" ").toLowerCase()
    : "";

  const content = (
    JSON.stringify(errors) ?? ""
  ).toLowerCase();

  if (
    /access|token|subscription|authentication|authorization/.test(keys) ||
    /suspended|invalid api key|unauthorized|forbidden/.test(content)
  ) {
    return "ACCESS_RESTRICTED";
  }

  if (
    /rate|quota|requests|limit/.test(keys) ||
    /rate limit|request limit|quota exceeded|too many requests/.test(content)
  ) {
    return "RATE_LIMIT";
  }

  return "PROVIDER_ERROR";
}

export async function requestSportsProvider<T>(
  sport: string,
  endpoint: string,
  parameters: ProviderParameters = {},
  validateData: (value: unknown) => value is T
): Promise<ProviderResult<T>> {
  const config = getApiSportsProvider(sport);

  if (!config) {
    throw new SportsProviderError(
      "UNSUPPORTED_SPORT",
      "This sport has no configured provider."
    );
  }

  const apiKey = getApiSportsKey();

  if (!apiKey) {
    throw new SportsProviderError(
      "MISSING_KEY",
      "The shared sports API key is not configured."
    );
  }

  if (!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(endpoint)) {
    throw new SportsProviderError(
      "INVALID_ENDPOINT",
      "Invalid sports provider endpoint."
    );
  }

  const url = new URL(
    endpoint,
    config.baseUrl
  );

  if (
    url.protocol !== "https:" ||
    url.origin !== new URL(config.baseUrl).origin
  ) {
    throw new SportsProviderError(
      "INVALID_ENDPOINT",
      "Unapproved sports provider destination."
    );
  }

  for (const [key, value] of Object.entries(parameters)) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (
        error.name === "TimeoutError" ||
        error.name === "AbortError"
      );

    throw new SportsProviderError(
      timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      timedOut
        ? "Sports provider request timed out."
        : "Unable to connect to the sports provider."
    );
  }

  const quota = readProviderQuota(response.headers);

  if (response.status === 429) {
    throw new SportsProviderError(
      "RATE_LIMIT",
      "Sports provider request limit reached.",
      response.status,
      quota
    );
  }

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    throw new SportsProviderError(
      "ACCESS_RESTRICTED",
      "Sports provider access is restricted.",
      response.status,
      quota
    );
  }

  if (!response.ok) {
    throw new SportsProviderError(
      "HTTP_ERROR",
      "Sports provider returned an HTTP error.",
      response.status,
      quota
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new SportsProviderError(
      "INVALID_RESPONSE",
      "Sports provider returned invalid JSON.",
      response.status,
      quota
    );
  }

  if (!isRecord(payload)) {
    throw new SportsProviderError(
      "INVALID_RESPONSE",
      "Invalid sports provider response structure.",
      response.status,
      quota
    );
  }

  if (hasProviderErrors(payload.errors)) {
    throw new SportsProviderError(
      classifyProviderError(payload.errors),
      "Sports provider rejected the request.",
      response.status,
      quota
    );
  }

  if (!validateData(payload.response)) {
    throw new SportsProviderError(
      "INVALID_RESPONSE",
      "Unexpected sports provider data structure.",
      response.status,
      quota
    );
  }

  return {
    sport: config.sportSlug,
    providerName: config.providerName,
    endpoint,
    data: payload.response,
    results:
      typeof payload.results === "number" &&
      Number.isSafeInteger(payload.results) &&
      payload.results >= 0
        ? payload.results
        : null,
    pagination: readPagination(payload.paging),
    quota,
    fetchedAt: new Date().toISOString(),
  };
}
