export type ProfileType =
  | "club"
  | "player"
  | "competition";

export type ProfileIdentity = {
  id: number;
  name: string;
  slug: string;
  sportId: number | null;
  sportName: string | null;
};

export type SeasonSummary = {
  id: number;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  isCurrent: boolean;
};

export type SquadPlayer = {
  id: number;
  name: string;
  slug: string;
  position: string | null;
  jerseyNumber: number | null;
  nationality: string | null;
  avatarUrl: string | null;
};

export type ClubCompetition = {
  id: number;
  name: string;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
  country: string | null;
  competitionType: string | null;
  seasons: SeasonSummary[];
};

export type ClubProfile = ProfileIdentity & {
  shortName: string | null;
  country: string | null;
  city: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  overview: string | null;
  nickname: string | null;
  foundedYear: number | null;
  stadiumName: string | null;
  stadiumCapacity: number | null;
  websiteUrl: string | null;
  squad: SquadPlayer[];
  competitions: ClubCompetition[];
  sportSlug?: string | null;
  statistics?: ClubStatistic[];
};

export type ClubStatistic = Omit<
  CompetitionStanding,
  "teamId" | "teamName" | "teamSlug" | "teamLogoUrl"
> & {
  seasonId: number;
};

export type CurrentClub = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  sportName: string | null;
};

export type CareerRecord = {
  id: number;
  clubId: number;
  clubName: string;
  clubSlug: string;
  clubLogoUrl: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  position: string | null;
  jerseyNumber: number | null;
  transferType: string | null;
};

export type PlayerProfile = ProfileIdentity & {
  firstName: string;
  lastName: string;
  position: string | null;
  nationality: string | null;
  jerseyNumber: number | null;
  avatarUrl: string | null;
  biography: string | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  preferredFoot: string | null;
  achievements: string | null;
  currentClubs: CurrentClub[];
  careerHistory: CareerRecord[];
  sportSlug?: string | null;
  statistics?: PlayerStatistic[];
};

export type CompetitionClub = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  country: string | null;
};

export type CompetitionSeason = SeasonSummary & {
  clubs: CompetitionClub[];
  standings?: CompetitionStanding[];
};

export type CompetitionProfile = ProfileIdentity & {
  shortName: string | null;
  country: string | null;
  description: string | null;
  competitionType: string | null;
  foundedYear: number | null;
  logoUrl: string | null;
  coverUrl: string | null;
  websiteUrl: string | null;
  seasons: CompetitionSeason[];
  sportSlug?: string | null;
};

export type ProfileMap = {
  club: ClubProfile;
  player: PlayerProfile;
  competition: CompetitionProfile;
};

export function profileHref(
  type: ProfileType,
  slug: string
) {
  return `/discover/${type}/?slug=${encodeURIComponent(slug)}`;
}


export type CompetitionStanding = {
  teamId: number;
  teamName: string;
  teamSlug: string;
  teamLogoUrl: string | null;
  groupName: string;
  rank: number;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  scored: number | null;
  conceded: number | null;
  difference: number | null;
  points: number | null;
  form: string | null;
  observedAt: string | null;
};

export type PlayerStatistic = {
  teamId: number;
  teamName: string;
  teamSlug: string;
  teamLogoUrl: string | null;
  competitionId: number;
  competitionName: string;
  competitionSlug: string;
  seasonId: number;
  seasonName: string;
  isCurrent: boolean;
  metricKey: string;
  metricLabel: string;
  metricValue: number;
  observedAt: string | null;
};
