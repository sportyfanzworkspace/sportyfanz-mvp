"use client";

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
  position?: string | null;
  nationality?: string | null;
  jerseyNumber?: number | null;
  avatarUrl?: string | null;
  teams: string[];
};

type DiscoverData = {
  sports: Sport[];
  teams: Team[];
  players: Player[];
  competitions: string[];
  followedSportIds: number[];
  followedTeamIds: number[];
  followedPlayerIds: number[];
};

type FollowType = "sport" | "team" | "player";

const EMPTY_DATA: DiscoverData = {
  sports: [],
  teams: [],
  players: [],
  competitions: [],
  followedSportIds: [],
  followedTeamIds: [],
  followedPlayerIds: [],
};

const TABS = ["Sports", "Teams", "Competitions"];

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
  const [active, setActive] = useState("Sports");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<DiscoverData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadDiscover = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/discover", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load Discover.");
      }

      setData({
        sports: result.sports ?? [],
        teams: result.teams ?? [],
        players: result.players ?? [],
        competitions: result.competitions ?? [],
        followedSportIds: result.followedSportIds ?? [],
        followedTeamIds: result.followedTeamIds ?? [],
        followedPlayerIds: result.followedPlayerIds ?? [],
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load Discover."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDiscover();
  }, [loadDiscover]);

  const filteredSports = useMemo(
    () =>
      data.sports.filter((sport) =>
        `${sport.name} ${sport.description ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [data.sports, search]
  );

  const filteredTeams = useMemo(
    () =>
      data.teams.filter((team) =>
        `${team.name} ${team.shortName ?? ""} ${team.sportName} ${team.country ?? ""} ${team.city ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [data.teams, search]
  );

  const filteredPlayers = useMemo(
    () =>
      data.players.filter((player) =>
        `${player.name} ${player.position ?? ""} ${player.nationality ?? ""} ${player.teams.join(" ")}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ),
    [data.players, search]
  );

  const filteredCompetitions = useMemo(
    () =>
      data.competitions.filter((competition) =>
        competition.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [data.competitions, search]
  );

  const follow = async (
    type: FollowType,
    id: number,
    currentlyFollowing: boolean
  ) => {
    const key = `${type}-${id}`;

    if (pending) return;

    setPending(key);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          id,
          action: currentlyFollowing ? "unfollow" : "follow",
        }),
      });

      const result = await response.json();

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

  const interestNames = [
    ...data.sports
      .filter((sport) => followingSport(sport.id))
      .map((sport) => sport.name),
    ...data.teams
      .filter((team) => followingTeam(team.id))
      .map((team) => team.name),
    ...data.players
      .filter((player) => followingPlayer(player.id))
      .map((player) => player.name),
  ];

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
        disabled={pending !== null}
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
            Explore teams, players, competitions and trending communities.
          </p>
        </div>
      </div>

      <div className="discover-search">
        <Search size={20} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search teams, players, events..."
          aria-label="Search sports, teams, players and competitions"
        />
      </div>

      <div className="discover-tabs">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            className={active === tab ? "active" : ""}
            onClick={() => setActive(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="white-panel" style={{ marginBottom: 16 }}>
          <p>{error}</p>
          <button type="button" onClick={() => void loadDiscover()}>
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
          <div>
            <div className="section-heading-row">
              <h2>
                {search.trim()
                  ? "Search Results"
                  : active === "Sports"
                    ? "Trending Sports"
                    : active}
              </h2>
              <span>
                {active === "Sports"
                  ? filteredSports.length
                  : active === "Teams"
                    ? filteredTeams.length
                    : active === "Players"
                      ? filteredPlayers.length
                      : filteredCompetitions.length}{" "}
                found
              </span>
            </div>

            {active === "Sports" && (
              <div className="trending-grid">
                {filteredSports.map((sport) => (
                  <div className="sport-discover-card" key={sport.id}>
                    <div>
                      {sport.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sport.iconUrl}
                          alt=""
                          style={{
                            width: 32,
                            height: 32,
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        getSportEmoji(sport.name)
                      )}
                    </div>
                    <strong>{sport.name}</strong>
                    <span>{sport.description || "Explore"}</span>
                    {renderFollowButton("sport", sport.id, followingSport(sport.id))}
                  </div>
                ))}
              </div>
            )}

            {active === "Teams" && (
              <div className="white-panel discover-list">
                <div className="panel-title">
                  <h3>Teams</h3>
                  <span>{filteredTeams.length}</span>
                </div>

                {filteredTeams.map((team) => (
                  <div className="discover-team" key={team.id}>
                    <div className="team-logo">
                      {team.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={team.logoUrl}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        team.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <strong>{team.name}</strong>
                      <span>
                        {team.sportName}
                        {team.country ? ` · ${team.country}` : ""}
                      </span>
                    </div>
                    {renderFollowButton("team", team.id, followingTeam(team.id))}
                  </div>
                ))}
              </div>
            )}

            {active === "Players" && (
              <div className="white-panel discover-list">
                <div className="panel-title">
                  <h3>Players</h3>
                  <span>{filteredPlayers.length}</span>
                </div>

                {filteredPlayers.map((player) => (
                  <div className="discover-team" key={player.id}>
                    <div className="team-logo">
                      {player.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.avatarUrl}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "50%",
                          }}
                        />
                      ) : (
                        player.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <strong>{player.name}</strong>
                      <span>
                        {[player.position, player.teams.join(", "), player.nationality]
                          .filter(Boolean)
                          .join(" · ") || "Player"}
                      </span>
                    </div>
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
                  <span>{filteredCompetitions.length}</span>
                </div>

                {filteredCompetitions.map((competition) => (
                  <div className="discover-team" key={competition}>
                    <div className="team-logo">🏆</div>
                    <div>
                      <strong>{competition}</strong>
                      <span>Competition</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {((active === "Sports" && filteredSports.length === 0) ||
              (active === "Teams" && filteredTeams.length === 0) ||
              (active === "Players" && filteredPlayers.length === 0) ||
              (active === "Competitions" && filteredCompetitions.length === 0)) && (
              <div className="white-panel" style={{ padding: 24 }}>
                <p>
                  {search.trim()
                    ? "No results match your search."
                    : "No items are available here yet."}
                </p>
              </div>
            )}

            {active === "Sports" && (
              <div className="white-panel discover-list" style={{ marginTop: 24 }}>
                <div className="panel-title">
                  <h3>Popular Teams</h3>
                  <button type="button" onClick={() => setActive("Teams")}>
                    View All
                  </button>
                </div>

                {filteredTeams.slice(0, 4).map((team) => (
                  <div className="discover-team" key={team.id}>
                    <div className="team-logo">
                      {team.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={team.logoUrl}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        team.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <strong>{team.name}</strong>
                      <span>{team.sportName}</span>
                    </div>
                    {renderFollowButton("team", team.id, followingTeam(team.id))}
                  </div>
                ))}

                {filteredTeams.length === 0 && <p>No teams available yet.</p>}
              </div>
            )}
          </div>

          <aside>
            <div className="white-panel">
              <div className="panel-title">
                <h3>Your Interests</h3>
              </div>
              <div className="interest-tags">
                {interestNames.length > 0 ? (
                  interestNames.map((name) => <span key={name}>{name}</span>)
                ) : (
                  <span>Follow sports, teams or players to build your interests.</span>
                )}
              </div>
            </div>

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
