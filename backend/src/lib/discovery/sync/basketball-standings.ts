import {
  expandMultisportStandings,
  normalizeMultisportStanding,
} from "./multisport-standings";

export function expandBasketballStandings(
  values: unknown[],
  expectedLeagueId: number,
  expectedSeason: string
) {
  return expandMultisportStandings(
    "basketball",
    values,
    expectedLeagueId,
    expectedSeason
  );
}

export function normalizeBasketballStanding(
  value: unknown
) {
  return normalizeMultisportStanding(
    "basketball",
    value
  );
}
