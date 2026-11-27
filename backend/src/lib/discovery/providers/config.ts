export type ApiSportsProviderConfig = {
  sportSlug: string;
  providerName: string;
  baseUrl: string;
};

export const API_SPORTS_PROVIDERS = {
  football: {
    sportSlug: "football",
    providerName: "API_SPORTS_FOOTBALL",
    baseUrl: "https://v3.football.api-sports.io",
  },
  basketball: {
    sportSlug: "basketball",
    providerName: "API_SPORTS_BASKETBALL",
    baseUrl: "https://v1.basketball.api-sports.io",
  },
  baseball: {
    sportSlug: "baseball",
    providerName: "API_SPORTS_BASEBALL",
    baseUrl: "https://v1.baseball.api-sports.io",
  },
  rugby: {
    sportSlug: "rugby",
    providerName: "API_SPORTS_RUGBY",
    baseUrl: "https://v1.rugby.api-sports.io",
  },
  volleyball: {
    sportSlug: "volleyball",
    providerName: "API_SPORTS_VOLLEYBALL",
    baseUrl: "https://v1.volleyball.api-sports.io",
  },
  hockey: {
    sportSlug: "hockey",
    providerName: "API_SPORTS_HOCKEY",
    baseUrl: "https://v1.hockey.api-sports.io",
  },
  handball: {
    sportSlug: "handball",
    providerName: "API_SPORTS_HANDBALL",
    baseUrl: "https://v1.handball.api-sports.io",
  },
  "american-football": {
    sportSlug: "american-football",
    providerName: "API_SPORTS_AMERICAN_FOOTBALL",
    baseUrl: "https://v1.american-football.api-sports.io",
  },
} as const satisfies Record<string, ApiSportsProviderConfig>;

export type ApiSportsSport =
  keyof typeof API_SPORTS_PROVIDERS;

export function isApiSportsSport(
  value: string
): value is ApiSportsSport {
  return Object.prototype.hasOwnProperty.call(
    API_SPORTS_PROVIDERS,
    value
  );
}

export function getApiSportsProvider(
  sport: string
): ApiSportsProviderConfig | null {
  const normalized = sport.trim().toLowerCase();

  if (!isApiSportsSport(normalized)) {
    return null;
  }

  return API_SPORTS_PROVIDERS[normalized];
}

export function getApiSportsKey(): string | null {
  const key = process.env.API_FOOTBALL_KEY?.trim();

  return key || null;
}
