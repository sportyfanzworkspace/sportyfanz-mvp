"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { profileHref } from "@/components/discovery/profile-types";
import DirectoryImage from "@/components/discovery/directory-image";
import { ChevronRight } from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Plus, Search, Check, LoaderCircle } from "lucide-react";

type Sport = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  iconUrl?: string | null;
};

type Team = {
  id: number;
  name: string;
  shortName?: string | null;
  slug: string;
  sportId: number;
  sportName: string;
  country?: string | null;
  city?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

type Player = {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  slug: string;
  sportId: number | null;
  sportName: string | null;
  position?: string | null;
  nationality?: string | null;
  jerseyNumber?: number | null;
  avatarUrl?: string | null;
  teams: string[];
};

type CompetitionProfile = {
  id: number;
  name: string;
  shortName?: string | null;
  slug: string;
  sportId: number;
  sportName: string;
  country?: string | null;
  competitionType?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

type DirectoryPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

const PAGE_SIZE = 20;

type DiscoverData = {
  sports: Sport[];
  teams: Team[];
  players: Player[];
  competitions: string[];
  competitionProfiles: CompetitionProfile[];
  followedSportIds: number[];
  followedTeamIds: number[];
  followedPlayerIds: number[];
  interestNames: string[];
  interests: {
    type: "sport" | "club" | "player";
    id: number;
    name: string;
    slug: string;
  }[];
  pagination: DirectoryPagination | null;
};

type FollowType = "sport" | "team" | "player";

const EMPTY_DATA: DiscoverData = {
  sports: [],
  teams: [],
  players: [],
  competitions: [],
  competitionProfiles: [],
  followedSportIds: [],
  followedTeamIds: [],
  followedPlayerIds: [],
  interestNames: [],
  interests: [],
  pagination: null,
};

const TABS = [
  "Sports",
  "Clubs",
  "Players",
  "Competitions",
] as const;

type DiscoverTab = typeof TABS[number];

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const SPORT_EMOJIS: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
  boxing: "🥊",
  "formula 1": "🏎️",
  cricket: "🏏",
  rugby: "🏉",
  athletics: "🏃",
  swimming: "🏊",
  golf: "⛳",
  volleyball: "🏐",
  baseball: "⚾",
};

function getSportEmoji(name: string) {
  return SPORT_EMOJIS[name.toLowerCase()] ?? "🏆";
}

export default function DiscoverPage() {
  const [active, setActive] =
    useState<DiscoverTab>("Sports");

  const [selectedSport, setSelectedSport] =
    useState<number | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<DiscoverData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(normalizeName(search));
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const loadDiscover = useCallback(async (
    signal: AbortSignal
  ) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        directory: active.toLowerCase(),
        page: String(page),
        pageSize: String(PAGE_SIZE),
        search: debouncedSearch,
      });

      if (selectedSport !== "ALL") {
        params.set("sportId", String(selectedSport));
      }

      const response = await apiFetch(
        `/api/discover?${params.toString()}`,
        {
          cache: "no-store",
          signal,
        }
      );

      const result = await response.json();

      if (signal.aborted) return;

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load Discover."
        );
      }

      const pagination =
        result.pagination ?? null;

      if (
        pagination &&
        page > Math.max(1, pagination.totalPages)
      ) {
        setPage(Math.max(1, pagination.totalPages));
        return;
      }

      setData({
        sports: result.sports ?? [],
        teams: result.teams ?? [],
        players: result.players ?? [],
        competitions: result.competitions ?? [],
        competitionProfiles:
          result.competitionProfiles ?? [],
        followedSportIds:
          result.followedSportIds ?? [],
        followedTeamIds:
          result.followedTeamIds ?? [],
        followedPlayerIds:
          result.followedPlayerIds ?? [],
        interestNames: result.interestNames ?? [],
        interests: result.interests ?? [],
        pagination,
      });
    } catch (err) {
      if (signal.aborted) return;

      setData(previous => ({
        ...previous,
        teams: [],
        players: [],
        competitions: [],
        competitionProfiles: [],
        pagination: null,
      }));

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Discover."
      );
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [
    active,
    selectedSport,
    debouncedSearch,
    page,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    void loadDiscover(controller.signal);

    return () => controller.abort();
  }, [loadDiscover, reload]);

  function changeTab(tab: DiscoverTab) {
    if (pending || tab === active) return;

    setLoading(true);
    setPage(1);
    setActive(tab);
  }

  function changeSport(value: number | "ALL") {
    if (pending || value === selectedSport) return;

    setLoading(true);
    setPage(1);
    setSelectedSport(value);
  }

  function changePage(next: number) {
    if (
      pending ||
      loading ||
      next < 1 ||
      next > 10000 ||
      next === page
    ) return;

    setLoading(true);
    setPage(next);
  }

  const query = debouncedSearch;

  const filteredSports = useMemo(
    () =>
      data.sports.filter(sport =>
        (selectedSport === "ALL" ||
          sport.id === selectedSport) &&
        normalizeName(
          `${sport.name} ${sport.description ?? ""}`
        ).includes(query)
      ),
    [data.sports, selectedSport, query]
  );

  // Directory records are filtered and paginated
  // by the backend, not by the browser.
  const filteredTeams = data.teams;
  const filteredPlayers = data.players;
  const filteredCompetitionProfiles =
    data.competitionProfiles;

  const filteredLegacyCompetitions =
    data.competitions;

  const competitionCount =
    data.pagination?.total ??
    filteredCompetitionProfiles.length;

  const resultCount =
    active === "Sports"
      ? filteredSports.length
      : data.pagination?.total ?? 0;

  useEffect(() => {
    if (
      !loading &&
      !error &&
      selectedSport !== "ALL" &&
      !data.sports.some(sport => sport.id === selectedSport)
    ) {
      setPage(1);
      setSelectedSport("ALL");
    }
  }, [data.sports, selectedSport, loading, error]);

  const follow = async (
    type: FollowType,
    id: number,
    currentlyFollowing: boolean
  ) => {
    const key = `${type}-${id}`;

    if (
      pending ||
      loading ||
      normalizeName(search) !== debouncedSearch
    ) return;

    setPending(key);
    setNotice("");
    setError("");

    try {
      const response = await apiFetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          id,
          action: currentlyFollowing ? "unfollow" : "follow",
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        setNotice(
          "Sign in or create an account to follow sports, clubs and players."
        );
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || "Unable to update your follow.");
      }

      const field =
        type === "sport"
          ? "followedSportIds"
          : type === "team"
            ? "followedTeamIds"
            : "followedPlayerIds";

      setData((previous) => {
        const ids = previous[field];
        const updatedIds = currentlyFollowing
          ? ids.filter((item) => item !== id)
          : ids.includes(id)
            ? ids
            : [...ids, id];

        return { ...previous, [field]: updatedIds };
      });

      setNotice(
        currentlyFollowing
          ? "Removed from your interests."
          : "Added to your interests."
      );

      setReload(value => value + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update your follow."
      );
    } finally {
      setPending(null);
    }
  };

  const followingSport = (id: number) => data.followedSportIds.includes(id);
  const followingTeam = (id: number) => data.followedTeamIds.includes(id);
  const followingPlayer = (id: number) => data.followedPlayerIds.includes(id);

  const interests = data.interests;

  const selectedSportName =
    selectedSport === "ALL"
      ? null
      : data.sports.find(
          sport => sport.id === selectedSport
        )?.name ?? null;

  function exploreSportInterest(sportId: number) {
    if (pending || loading) return;

    const alreadySelected =
      selectedSport === sportId &&
      active === "Clubs" &&
      page === 1 &&
      !search.trim() &&
      !debouncedSearch;

    if (alreadySelected) return;

    setNotice("");
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
    setSelectedSport(sportId);
    setActive("Clubs");
  }

  const renderFollowButton = (
    type: FollowType,
    id: number,
    isFollowing: boolean
  ) => {
    const key = `${type}-${id}`;
    const isPending = pending === key;

    return (
      <button
        type="button"
        disabled={
          pending !== null ||
          loading ||
          normalizeName(search) !== debouncedSearch
        }
        onClick={() => void follow(type, id, isFollowing)}
        aria-label={`${isFollowing ? "Unfollow" : "Follow"} ${type}`}
      >
        {isPending ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : isFollowing ? (
          <Check size={14} />
        ) : (
          <Plus size={14} />
        )}
        {isPending ? "Saving..." : isFollowing ? "Following" : "Follow"}
      </button>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span>DISCOVER</span>
          <h1>Find Your Sports World</h1>
          <p>
            Explore sports, clubs, players, competitions and trending communities.
          </p>
        </div>
      </div>

      <div className="discover-search">
        <Search size={20} />
        <input
          value={search}
          maxLength={150}
          disabled={pending !== null}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search sports, clubs, players, competitions..."
          aria-label="Search sports, clubs, players and competitions"
        />
      </div>

      <div className="discover-tabs">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            className={active === tab ? "active" : ""}
            aria-pressed={active === tab}
            disabled={pending !== null}
            onClick={() => changeTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="discover-filter-bar">
        <label htmlFor="discover-sport-filter">
          Filter by sport
        </label>

        <select
          id="discover-sport-filter"
          value={selectedSport}
          disabled={loading || pending !== null}
          onChange={event =>
            changeSport(
              event.target.value === "ALL"
                ? "ALL"
                : Number(event.target.value)
            )
          }
        >
          <option value="ALL">All Sports</option>

          {data.sports.map(sport => (
            <option key={sport.id} value={sport.id}>
              {sport.name}
            </option>
          ))}
        </select>

        {(search.trim() || selectedSport !== "ALL") && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setSearch("");
              setDebouncedSearch("");
              setPage(1);
              setSelectedSport("ALL");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="white-panel" style={{ marginBottom: 16 }}>
          <p>{error}</p>
          <button type="button" onClick={() => setReload(value => value + 1)}>
            Try Again
          </button>
        </div>
      )}

      {notice && (
        <p role="status" style={{ marginBottom: 12 }}>
          {notice}
        </p>
      )}

      {loading ? (
        <div className="white-panel" style={{ padding: 32, textAlign: "center" }}>
          <LoaderCircle size={24} className="animate-spin" />
          <p>Loading your sports world...</p>
        </div>
      ) : (
        <div className="discover-layout">
            <div className="white-panel discover-interests-panel">
              <div className="panel-title">
                <h3>Your Interests</h3>
              </div>
              <div className="interest-tags">
                {interests.length > 0 ? (
                  interests.map(interest =>
                    interest.type === "sport" ? (
                      <button
                        type="button"
                        key={`sport-${interest.id}`}
                        className={`discover-interest-chip ${
                          selectedSport === interest.id
                            ? "active"
                            : ""
                        }`}
                        aria-pressed={
                          selectedSport === interest.id
                        }
                        aria-label={`Explore ${interest.name}`}
                        disabled={pending !== null || loading}
                        onClick={() =>
                          exploreSportInterest(interest.id)
                        }
                      >
                        {interest.name}
                        <ChevronRight
                          size={14}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <Link
                        key={`${interest.type}-${interest.id}`}
                        href={profileHref(
                          interest.type,
                          interest.slug
                        )}
                        className="discover-interest-chip"
                        aria-label={`View ${interest.name} profile`}
                      >
                        {interest.name}
                        <ChevronRight
                          size={14}
                          aria-hidden="true"
                        />
                      </Link>
                    )
                  )
                ) : (
                  <span>
                    Follow sports, clubs or players
                    to build your interests.
                  </span>
                )}
              </div>

              {interests.length > 0 && (
                <p className="discover-interest-hint">
                  Select an interest to explore its sports world.
                </p>
              )}
            </div>

          <div>
            <div className="section-heading-row">
              <h2>
                {search.trim()
                  ? "Search Results"
                  : selectedSportName
                    ? `${selectedSportName} ${active}`
                    : active === "Sports"
                      ? "Trending Sports"
                      : active}
              </h2>
              <span>
                {resultCount} found
              </span>
            </div>

            {active === "Sports" && (
              <div className="white-panel discover-list discover-trending-panel">
                <div className="trending-grid">
                  {filteredSports.map((sport) => (
                  <div className="sport-discover-card" key={sport.id}>
                    <div>
                      <DirectoryImage
                        url={sport.iconUrl}
                        fallback={getSportEmoji(sport.name)}
                        size={32}
                      />
                    </div>
                    <strong>{sport.name}</strong>
                    <span>{sport.description || "Explore"}</span>
                    {renderFollowButton("sport", sport.id, followingSport(sport.id))}
                  </div>
                  ))}
                </div>
              </div>
            )}

            {active === "Clubs" && (
              <div className="white-panel discover-list">
                <div className="panel-title">
                  <h3>Clubs</h3>
                  <span>{resultCount}</span>
                </div>

                {filteredTeams.map((team) => (
                  <div className="discover-team" key={team.id}>
                    <Link
                      href={profileHref("club", team.slug)}
                      className="discover-profile-link"
                      aria-label={`View ${team.name} profile`}
                    >
                      <div className="team-logo">
                        <DirectoryImage
                          url={team.logoUrl}
                          fallback={
                            team.name.charAt(0).toUpperCase()
                          }
                        />
                      </div>
                      <div>
                        <strong>{team.name}</strong>
                        <span>
                          {team.sportName}
                          {team.country ? ` · ${team.country}` : ""}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="discover-profile-chevron"
                        aria-hidden="true"
                      />
                    </Link>
                    {renderFollowButton("team", team.id, followingTeam(team.id))}
                  </div>
                ))}
              </div>
            )}

            {active === "Players" && (
              <div className="white-panel discover-list">
                <div className="panel-title">
                  <h3>Players</h3>
                  <span>{resultCount}</span>
                </div>

                {filteredPlayers.map((player) => (
                  <div className="discover-team" key={player.id}>
                    <Link
                      href={profileHref("player", player.slug)}
                      className="discover-profile-link"
                      aria-label={`View ${player.name} profile`}
                    >
                      <div className="team-logo">
                        <DirectoryImage
                          url={player.avatarUrl}
                          fallback={
                            player.name.charAt(0).toUpperCase()
                          }
                          circular
                        />
                      </div>
                      <div>
                        <strong>{player.name}</strong>
                        <span>
                          {[player.sportName, player.position, player.teams.join(", "), player.nationality]
                            .filter(Boolean)
                            .join(" · ") || "Player"}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="discover-profile-chevron"
                        aria-hidden="true"
                      />
                    </Link>
                    {renderFollowButton(
                      "player",
                      player.id,
                      followingPlayer(player.id)
                    )}
                  </div>
                ))}
              </div>
            )}

            {active === "Competitions" && (
              <div className="white-panel discover-list">
                <div className="panel-title">
                  <h3>Competitions</h3>
                  <span>{competitionCount}</span>
                </div>

                {filteredCompetitionProfiles.map(competition => (
                  <div className="discover-team" key={competition.id}>
                    <Link
                      href={profileHref("competition", competition.slug)}
                      className="discover-profile-link"
                      aria-label={`View ${competition.name} profile`}
                    >
                      <div className="team-logo">
                        <DirectoryImage
                          url={competition.logoUrl}
                          fallback="🏆"
                        />
                      </div>

                      <div>
                        <strong>{competition.name}</strong>
                        <span>
                          {[
                            competition.sportName,
                            competition.country,
                            competition.competitionType,
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="discover-profile-chevron"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                ))}

                {filteredLegacyCompetitions.length > 0 && (
                  <div className="discover-legacy-heading">
                    <h4>Other Competitions</h4>
                    <p>
                      Competitions listed in match records.
                      Detailed profiles are not yet available.
                      Up to 100 additional listings are shown
                      on the first page.
                    </p>
                  </div>
                )}

                {filteredLegacyCompetitions.map(name => (
                  <div
                    className="discover-team"
                    key={`legacy-${name}`}
                  >
                    <div className="team-logo">🏆</div>
                    <div>
                      <strong>{name}</strong>
                      <span>Match listing</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!error &&
              resultCount === 0 &&
              filteredLegacyCompetitions.length === 0 && (
              <div className="white-panel" style={{ padding: 24 }}>
                <p>
                  {search.trim() || selectedSport !== "ALL"
                    ? "No results match your search or selected sport."
                    : "No items are available here yet."}
                </p>
              </div>
            )}

            {active !== "Sports" &&
              data.pagination &&
              data.pagination.totalPages > 1 && (
                <nav
                  className="discover-pagination"
                  aria-label="Directory pagination"
                >
                  <button
                    type="button"
                    disabled={
                      !data.pagination.hasPrevious ||
                      loading ||
                      pending !== null ||
                      normalizeName(search) !== debouncedSearch
                    }
                    onClick={() => changePage(page - 1)}
                  >
                    Previous
                  </button>

                  <div aria-live="polite">
                    <strong>
                      Page {data.pagination.page} of{" "}
                      {data.pagination.totalPages}
                    </strong>
                    <small>
                      {(
                        (data.pagination.page - 1) *
                        data.pagination.pageSize + 1
                      ).toLocaleString()}–{Math.min(
                        data.pagination.page *
                          data.pagination.pageSize,
                        data.pagination.total
                      ).toLocaleString()} of{" "}
                      {data.pagination.total.toLocaleString()}
                    </small>
                  </div>

                  <button
                    type="button"
                    disabled={
                      !data.pagination.hasNext ||
                      page >= 10000 ||
                      loading ||
                      pending !== null ||
                      normalizeName(search) !== debouncedSearch
                    }
                    onClick={() => changePage(page + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}

            {active === "Sports" && (
              <div className="white-panel discover-list" style={{ marginTop: 24 }}>
                <div className="panel-title">
                  <h3>Popular Clubs</h3>
                  <button type="button" onClick={() => changeTab("Clubs")}>
                    View All
                  </button>
                </div>

                {filteredTeams.slice(0, 4).map((team) => (
                  <div className="discover-team" key={team.id}>
                    <Link
                      href={profileHref("club", team.slug)}
                      className="discover-profile-link"
                      aria-label={`View ${team.name} profile`}
                    >
                      <div className="team-logo">
                        <DirectoryImage
                          url={team.logoUrl}
                          fallback={
                            team.name.charAt(0).toUpperCase()
                          }
                        />
                      </div>
                      <div>
                        <strong>{team.name}</strong>
                        <span>{team.sportName}</span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="discover-profile-chevron"
                        aria-hidden="true"
                      />
                    </Link>
                    {renderFollowButton("team", team.id, followingTeam(team.id))}
                  </div>
                ))}

                {filteredTeams.length === 0 && <p>No clubs available yet.</p>}
              </div>
            )}
          </div>

          <aside>


            <div className="discover-promo">
              <Crown size={32} />
              <h3>Your Passion.</h3>
              <h3>Your Community.</h3>
              <h3>Your Rewards.</h3>
              <a href="/fan-hub">Explore Fan Rooms</a>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
