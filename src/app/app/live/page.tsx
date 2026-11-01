"use client";

import { useEffect, useState } from "react";
import { MessageCircle, RefreshCw, Send, Users } from "lucide-react";

type Fixture = {
  id: number;
  fixtureId?: number;
  leagueId?: number | null;
  season?: number | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  competition: string;
  country?: string | null;
  venue: string | null;
  scheduledAt: string;
  status: string;
  elapsed?: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

type FixturesResponse = {
  success: boolean;
  liveMatches: Fixture[];
  upcomingMatches: Fixture[];
};

type MatchRecord = Record<string, any>;

type MatchDetails = {
  success: boolean;
  fixture: MatchRecord;
  events: MatchRecord[];
  statistics: MatchRecord[];
  lineups: MatchRecord[];
  players: MatchRecord[];
  standings: MatchRecord[];
  dataAvailability: {
    events: boolean;
    statistics: boolean;
    lineups: boolean;
    players: boolean;
    standings: boolean;
  };
};


type MatchFanRoomMessage = {
  id: number;
  message: string;
  createdAt: string;
  userId: number;
  username: string;
  avatarUrl: string | null;
  isEdited: boolean;
};

type MatchFanRoomData = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  memberCount: number;
  isJoined: boolean;
  messages: MatchFanRoomMessage[];
};

type MatchTab = "overview" | "stats" | "lineups" | "players" | "table";

function formatKickoff(date: string) {
  return new Date(date).toLocaleString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "LIVE":
      return "LIVE";
    case "HALF_TIME":
      return "HALF TIME";
    case "FINISHED":
      return "FULL TIME";
    case "POSTPONED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "UPCOMING";
  }
}

function formatStat(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function getStandings(details: MatchDetails | null): MatchRecord[] {
  const response = details?.standings?.[0];
  const league = response?.league;
  const groups = league?.standings;

  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group: unknown) =>
    Array.isArray(group) ? group : []
  );
}

function getPlayerTeams(details: MatchDetails | null): MatchRecord[] {
  return details?.players ?? [];
}

function getPlayerStats(player: MatchRecord): MatchRecord {
  return player?.statistics?.[0] ?? {};
}

function getPlayerName(player: MatchRecord): string {
  return player?.player?.name ?? "Unknown player";
}

export default function MatchesPage() {
  const [fixtures, setFixtures] = useState<FixturesResponse | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Fixture | null>(null);
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [activeTab, setActiveTab] = useState<MatchTab>("overview");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadFixtures() {
      try {
        const response = await fetch("/api/matches/football", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load football fixtures.");
        }

        const data: FixturesResponse = await response.json();

        if (!cancelled) {
          setFixtures(data);
          const allMatches = [
            ...(data.liveMatches ?? []),
            ...(data.upcomingMatches ?? []),
          ];

          setSelectedMatch((current) => {
            if (current && allMatches.some((match) => match.id === current.id)) {
              return allMatches.find((match) => match.id === current.id) ?? current;
            }
            return allMatches[0] ?? null;
          });
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Football fixtures are temporarily unavailable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFixtures();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedMatch) {
      setDetails(null);
      return;
    }

    let cancelled = false;

    async function loadMatchDetails() {
      setDetailsLoading(true);
      setDetailsError("");
      setDetails(null);

      try {
        const response = await fetch(
          `/api/matches/football/${selectedMatch!.fixtureId ?? selectedMatch!.id}`,
          { cache: "no-store" }
        );

        const data: MatchDetails = await response.json();

        if (!response.ok || !data.success) {
          throw new Error("Unable to load match details.");
        }

        if (!cancelled) setDetails(data);
      } catch {
        if (!cancelled) {
          setDetailsError("Match details are temporarily unavailable.");
        }
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    }

    loadMatchDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedMatch]);

  const liveMatches = fixtures?.liveMatches ?? [];
  const upcomingMatches = fixtures?.upcomingMatches ?? [];
  const isLive =
    selectedMatch?.status === "LIVE" ||
    selectedMatch?.status === "HALF_TIME";

  function selectMatch(match: Fixture) {
    setSelectedMatch(match);
    setActiveTab("overview");
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span>MATCH CENTRE</span>
          <h1>Live & Matches</h1>
          <p>Follow fixtures, match events, statistics and player performances.</p>
        </div>
      </div>

      {loading && (
        <div className="white-panel">Loading football fixtures...</div>
      )}

      {error && (
        <div className="white-panel">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="match-centre-layout">
          <main className="match-centre-main">
            {selectedMatch ? (
              <section className="match-detail-panel">
                <div className="match-detail-heading">
                  <div>
                    <span className="match-detail-kicker">
                      {selectedMatch.competition}
                      {selectedMatch.country ? ` · ${selectedMatch.country}` : ""}
                    </span>
                    <h2>Match Centre</h2>
                  </div>
                  <span className={isLive ? "live-pill" : "match-time"}>
                    {isLive && selectedMatch.elapsed != null
                      ? `${selectedMatch.elapsed}' · LIVE`
                      : statusLabel(selectedMatch.status)}
                  </span>
                </div>

                <div className="match-scoreboard">
                  <div className="match-score-team">
                    {selectedMatch.homeTeamLogo ? (
                      <img src={selectedMatch.homeTeamLogo} alt="" />
                    ) : (
                      <span className="match-team-placeholder">
                        {selectedMatch.homeTeam.slice(0, 1)}
                      </span>
                    )}
                    <strong>{selectedMatch.homeTeam}</strong>
                    <small>HOME</small>
                  </div>

                  <div className="match-score-centre">
                    <strong>
                      {selectedMatch.status === "SCHEDULED"
                        ? "VS"
                        : `${selectedMatch.homeScore ?? 0} - ${selectedMatch.awayScore ?? 0}`}
                    </strong>
                    <span>{formatKickoff(selectedMatch.scheduledAt)}</span>
                    {selectedMatch.venue && <small>{selectedMatch.venue}</small>}
                  </div>

                  <div className="match-score-team">
                    {selectedMatch.awayTeamLogo ? (
                      <img src={selectedMatch.awayTeamLogo} alt="" />
                    ) : (
                      <span className="match-team-placeholder">
                        {selectedMatch.awayTeam.slice(0, 1)}
                      </span>
                    )}
                    <strong>{selectedMatch.awayTeam}</strong>
                    <small>AWAY</small>
                  </div>
                </div>

                <div className="match-tabs" role="tablist" aria-label="Match information">
                  {([
                    ["overview", "Overview"],
                    ["stats", "Stats"],
                    ["lineups", "Lineups"],
                    ["players", "Player Performance"],
                    ["table", "League Table"],
                  ] as [MatchTab, string][]).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={activeTab === tab ? "active" : ""}
                      onClick={() => setActiveTab(tab)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="match-tab-content">
                  {detailsLoading && (
                    <div className="match-data-message">
                      <RefreshCw size={17} />
                      Loading match information...
                    </div>
                  )}

                  {!detailsLoading && detailsError && (
                    <div className="match-data-message">{detailsError}</div>
                  )}

                  {!detailsLoading && !detailsError && details && (
                    <>
                      {activeTab === "overview" && (
                        <OverviewTab
                          details={details}
                          selectedMatch={selectedMatch}
                        />
                      )}
                      {activeTab === "stats" && (
                        <StatsTab details={details} />
                      )}
                      {activeTab === "lineups" && (
                        <LineupsTab details={details} />
                      )}
                      {activeTab === "players" && (
                        <PlayersTab details={details} />
                      )}
                      {activeTab === "table" && (
                        <TableTab
                          details={details}
                          selectedMatch={selectedMatch}
                        />
                      )}
                    </>
                  )}
                </div>
              </section>
            ) : (
              <div className="white-panel">
                <h3>No fixtures available</h3>
                <p>There are no live or upcoming professional fixtures to display.</p>
              </div>
            )}

            {selectedMatch && (
              <MatchFanRoom
                fixtureId={selectedMatch.fixtureId ?? selectedMatch.id}
              />
            )}

            <section className="white-panel fixture-list-panel">
              <div className="panel-title">
                <h3>Live Matches</h3>
                <span>{liveMatches.length} matches</span>
              </div>
              {liveMatches.length === 0 ? (
                <p className="fixture-empty">No professional matches are live right now.</p>
              ) : (
                liveMatches.map((match) => (
                  <FixtureCard
                    key={match.id}
                    match={match}
                    selected={selectedMatch?.id === match.id}
                    onSelect={() => selectMatch(match)}
                  />
                ))
              )}
            </section>

            <section className="white-panel fixture-list-panel">
              <div className="panel-title">
                <h3>Upcoming Matches</h3>
                <span>{upcomingMatches.length} matches</span>
              </div>
              {upcomingMatches.length === 0 ? (
                <p className="fixture-empty">No upcoming professional fixtures are available yet.</p>
              ) : (
                upcomingMatches.map((match) => (
                  <FixtureCard
                    key={match.id}
                    match={match}
                    selected={selectedMatch?.id === match.id}
                    onSelect={() => selectMatch(match)}
                  />
                ))
              )}
            </section>
          </main>

          <aside className="live-side">
            <div className="join-room-banner">
              <div className="join-room-icon">
                <MessageCircle size={21} />
              </div>
              <div>
                <strong>Join the Fan Room</strong>
                <p>Discuss football with other fans.</p>
                <a href="/app/fanroom">Join conversation →</a>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function FixtureCard({
  match,
  selected,
  onSelect,
}: {
  match: Fixture;
  selected: boolean;
  onSelect: () => void;
}) {
  const isLive =
    match.status === "LIVE" || match.status === "HALF_TIME";

  return (
    <button
      type="button"
      className={`fixture-select-card${selected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <div className="fixture-select-top">
        <span>{match.competition}</span>
        <span className={isLive ? "live-pill" : "match-time"}>
          {statusLabel(match.status)}
        </span>
      </div>
      <div className="fixture-select-teams">
        <strong>{match.homeTeam}</strong>
        <b>
          {isLive || match.status === "FINISHED"
            ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
            : "VS"}
        </b>
        <strong>{match.awayTeam}</strong>
      </div>
      <small>
        {formatKickoff(match.scheduledAt)}
        {match.venue ? ` · ${match.venue}` : ""}
      </small>
      <span className="fixture-view-link">View match details →</span>
    </button>
  );
}

function OverviewTab({
  details,
  selectedMatch,
}: {
  details: MatchDetails;
  selectedMatch: Fixture;
}) {
  const events = [...(details.events ?? [])].sort((a, b) => {
    const aTime = Number(a.time?.elapsed ?? 0);
    const bTime = Number(b.time?.elapsed ?? 0);
    return aTime - bTime;
  });

  return (
    <div className="match-overview-content">
      <div className="match-overview-summary">
        <div>
          <span>COMPETITION</span>
          <strong>{selectedMatch.competition}</strong>
        </div>
        <div>
          <span>VENUE</span>
          <strong>{selectedMatch.venue ?? "Not provided"}</strong>
        </div>
        <div>
          <span>DATE & TIME</span>
          <strong>{formatKickoff(selectedMatch.scheduledAt)}</strong>
        </div>
      </div>

      <div className="match-section-heading">
        <div>
          <h3>Match Events</h3>
          <p>Goals, cards, substitutions and key moments</p>
        </div>
        <span>{events.length} events</span>
      </div>

      {!details.dataAvailability?.events || events.length === 0 ? (
        <div className="match-empty-state">
          Match events will appear here when they are available from the provider.
        </div>
      ) : (
        <div className="match-event-timeline">
          {events.map((event, index) => {
            const homeEvent =
              event.team?.id === selectedMatch.homeTeamId ||
              event.team?.name === selectedMatch.homeTeam;

            return (
              <div
                className={`match-event-row ${homeEvent ? "home-event" : "away-event"}`}
                key={`${event.time?.elapsed ?? 0}-${event.type ?? "event"}-${index}`}
              >
                <span className="match-event-time">
                  {event.time?.elapsed ?? "—"}
                  {event.time?.extra ? `+${event.time.extra}` : "'"}
                </span>
                <span className="match-event-marker">
                  {event.type === "Goal"
                    ? "⚽"
                    : event.type === "Card"
                      ? "🟨"
                      : event.type === "subst"
                        ? "↔"
                        : "•"}
                </span>
                <div className="match-event-description">
                  <strong>{event.player?.name ?? event.type ?? "Match event"}</strong>
                  <span>
                    {event.detail ?? event.comments ?? ""}
                    {event.assist?.name ? ` · Assist: ${event.assist.name}` : ""}
                  </span>
                  <small>{event.team?.name ?? ""}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatsTab({ details }: { details: MatchDetails }) {
  const teams = details.statistics ?? [];

  if (!details.dataAvailability?.statistics || teams.length === 0) {
    return (
      <div className="match-empty-state">
        Match statistics are not available for this fixture yet.
      </div>
    );
  }

  const home = teams[0];
  const away = teams[1];
  const homeStats: MatchRecord[] = home?.statistics ?? [];
  const awayStats: MatchRecord[] = away?.statistics ?? [];

  const stats = homeStats.map((item) => {
    const awayItem = awayStats.find((candidate) => candidate.type === item.type);
    return {
      label: String(item.type ?? "Statistic"),
      home: item.value,
      away: awayItem?.value,
    };
  });

  return (
    <div className="match-stats-content">
      <div className="match-stats-team-head">
        <strong>{home?.team?.name ?? "Home"}</strong>
        <span>Match Statistics</span>
        <strong>{away?.team?.name ?? "Away"}</strong>
      </div>

      {stats.map((stat) => (
        <div className="match-stat-row" key={stat.label}>
          <div className="match-stat-values">
            <strong>{formatStat(stat.home)}</strong>
            <span>{stat.label}</span>
            <strong>{formatStat(stat.away)}</strong>
          </div>
          <div className="match-stat-bars">
            <span
              className="home-stat-bar"
              style={{
                width: `${stat.home == null ? 0 : Math.min(Number.parseFloat(String(stat.home)) || 0, 100)}%`,
              }}
            />
            <span
              className="away-stat-bar"
              style={{
                width: `${stat.away == null ? 0 : Math.min(Number.parseFloat(String(stat.away)) || 0, 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LineupsTab({ details }: { details: MatchDetails }) {
  const lineups = details.lineups ?? [];

  if (!details.dataAvailability?.lineups || lineups.length === 0) {
    return (
      <div className="match-empty-state">
        Confirmed team lineups are not available yet. They usually appear closer to kick-off.
      </div>
    );
  }

  return (
    <div className="match-lineups-grid">
      {lineups.map((team, index) => (
        <div className="match-lineup-team" key={team.team?.id ?? index}>
          <div className="match-lineup-heading">
            {team.team?.logo && <img src={team.team.logo} alt="" />}
            <div>
              <strong>{team.team?.name ?? "Team"}</strong>
              <span>{team.formation ?? "Formation not provided"}</span>
            </div>
          </div>

          <h4>Starting XI</h4>
          {(team.startXI ?? []).map((entry: MatchRecord, playerIndex: number) => (
            <div className="match-lineup-player" key={entry.player?.id ?? playerIndex}>
              <b>{entry.player?.number ?? "—"}</b>
              <span>{entry.player?.name ?? "Player"}</span>
              <small>{entry.player?.pos ?? ""}</small>
            </div>
          ))}

          <h4>Substitutes</h4>
          {(team.substitutes ?? []).map((entry: MatchRecord, playerIndex: number) => (
            <div className="match-lineup-player substitute" key={entry.player?.id ?? playerIndex}>
              <b>{entry.player?.number ?? "—"}</b>
              <span>{entry.player?.name ?? "Player"}</span>
              <small>{entry.player?.pos ?? ""}</small>
            </div>
          ))}

          {team.coach?.name && (
            <p className="match-lineup-coach">Coach: {team.coach.name}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function PlayersTab({ details }: { details: MatchDetails }) {
  const teams = getPlayerTeams(details);

  if (!details.dataAvailability?.players || teams.length === 0) {
    return (
      <div className="match-empty-state">
        Player performance data is not available for this fixture yet.
      </div>
    );
  }

  return (
    <div className="match-player-performance">
      {teams.map((team, teamIndex) => (
        <section className="match-player-team" key={team.team?.id ?? teamIndex}>
          <div className="match-player-team-heading">
            {team.team?.logo && <img src={team.team.logo} alt="" />}
            <h3>{team.team?.name ?? "Team"}</h3>
          </div>

          <div className="match-player-table-wrap">
            <table className="match-player-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Rating</th>
                  <th>Min</th>
                  <th>Goals</th>
                  <th>Assists</th>
                  <th>Shots</th>
                  <th>Passes</th>
                  <th>Tackles</th>
                </tr>
              </thead>
              <tbody>
                {(team.players ?? []).map((player: MatchRecord, playerIndex: number) => {
                  const stats = getPlayerStats(player);
                  return (
                    <tr key={player.player?.id ?? playerIndex}>
                      <td>
                        <div className="match-player-name">
                          {player.player?.photo && (
                            <img src={player.player.photo} alt="" />
                          )}
                          <span>{getPlayerName(player)}</span>
                        </div>
                      </td>
                      <td>
                        <b className="player-rating">
                          {stats.games?.rating
                            ? Number(stats.games.rating).toFixed(1)
                            : "—"}
                        </b>
                      </td>
                      <td>{formatStat(stats.games?.minutes)}</td>
                      <td>{formatStat(stats.goals?.total)}</td>
                      <td>{formatStat(stats.goals?.assists)}</td>
                      <td>{formatStat(stats.shots?.total)}</td>
                      <td>{formatStat(stats.passes?.total)}</td>
                      <td>{formatStat(stats.tackles?.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function TableTab({
  details,
  selectedMatch,
}: {
  details: MatchDetails;
  selectedMatch: Fixture;
}) {
  const standings = getStandings(details);
  const league = details.standings?.[0]?.league;

  if (!details.dataAvailability?.standings || standings.length === 0) {
    return (
      <div className="match-empty-state">
        League standings are not available for this competition yet.
      </div>
    );
  }

  const isHomeTeam = (team: MatchRecord) =>
    (selectedMatch.homeTeamId != null &&
      team.team?.id === selectedMatch.homeTeamId) ||
    team.team?.name?.toLowerCase() === selectedMatch.homeTeam.toLowerCase();

  const isAwayTeam = (team: MatchRecord) =>
    (selectedMatch.awayTeamId != null &&
      team.team?.id === selectedMatch.awayTeamId) ||
    team.team?.name?.toLowerCase() === selectedMatch.awayTeam.toLowerCase();

  return (
    <section className="league-table-section">
      <div className="league-table-heading">
        <div>
          <h3>{league?.name ?? selectedMatch.competition} Standings</h3>
          <p>
            {[league?.country ?? selectedMatch.country, league?.season]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>

        <div className="league-table-legend">
          <span><i className="league-home-key" /> Home team</span>
          <span><i className="league-away-key" /> Away team</span>
        </div>
      </div>

      <div className="league-table-wrap">
        <table className="league-standings-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Club</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GD</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry: MatchRecord, index: number) => {
              const home = isHomeTeam(entry);
              const away = isAwayTeam(entry);

              return (
                <tr
                  key={entry.team?.id ?? index}
                  className={
                    home
                      ? "league-row-home"
                      : away
                        ? "league-row-away"
                        : ""
                  }
                >
                  <td>{formatStat(entry.rank)}</td>
                  <td>
                    <div className="league-table-club">
                      {entry.team?.logo && (
                        <img src={entry.team.logo} alt="" />
                      )}
                      <span>{entry.team?.name ?? "Team"}</span>
                      {home && <small className="league-team-tag">HOME</small>}
                      {away && <small className="league-team-tag">AWAY</small>}
                    </div>
                  </td>
                  <td>{formatStat(entry.all?.played)}</td>
                  <td>{formatStat(entry.all?.win)}</td>
                  <td>{formatStat(entry.all?.draw)}</td>
                  <td>{formatStat(entry.all?.lose)}</td>
                  <td>{formatStat(entry.goalsDiff)}</td>
                  <td><strong>{formatStat(entry.points)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MatchFanRoom({ fixtureId }: { fixtureId: number }) {
  const [room, setRoom] = useState<MatchFanRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      try {
        const response = await fetch(
          `/api/fanrooms/match/${fixtureId}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ?? "Unable to load the match Fan Room."
          );
        }

        if (!cancelled) {
          setRoom(data.room ?? null);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the match Fan Room."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    setRoom(null);
    setError("");
    setNotice("");

    void loadRoom();

    const interval = window.setInterval(() => {
      void loadRoom();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fixtureId]);

  async function toggleMembership() {
    if (!room || membershipBusy) return;

    const action = room.isJoined ? "leave" : "join";

    setMembershipBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/fanrooms/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Unable to update membership.");
      }

      setRoom((current) =>
        current
          ? {
              ...current,
              isJoined: data.isJoined,
              memberCount: Math.max(
                0,
                current.memberCount + (data.isJoined ? 1 : -1)
              ),
              messages: data.isJoined ? current.messages : [],
            }
          : current
      );

      setNotice(data.message ?? "");

      if (data.isJoined) {
        const refreshResponse = await fetch(
          `/api/fanrooms/match/${fixtureId}`,
          { cache: "no-store" }
        );

        const refreshData = await refreshResponse.json();

        if (refreshResponse.ok && refreshData.success) {
          setRoom(refreshData.room ?? null);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update membership."
      );
    } finally {
      setMembershipBusy(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!room || !room.isJoined || !message.trim() || sending) return;

    const text = message.trim();

    setSending(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/fanrooms/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          message: text,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Unable to send your message.");
      }

      setRoom((current) =>
        current
          ? {
              ...current,
              messages: [...current.messages, data.message].slice(-50),
            }
          : current
      );

      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send your message."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="match-fan-room">
      <div className="match-fan-room-heading">
        <div>
          <span className="match-fan-room-kicker">
            <MessageCircle size={15} />
            LIVE MATCH DISCUSSION
          </span>
          <h3>Match Fan Room</h3>
          <p>Share your thoughts and discuss the action with fellow fans.</p>
        </div>
        {room && (
          <div className="match-fan-room-member-count">
            <Users size={17} />
            <span>{room.memberCount} fans</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="match-fan-room-state">
          <RefreshCw size={17} />
          Loading match Fan Room...
        </div>
      )}

      {!loading && error && (
        <div className="match-fan-room-error">
          {error}
        </div>
      )}

      {!loading && !error && !room && (
        <div className="match-fan-room-empty">
          <MessageCircle size={25} />
          <strong>No Fan Room linked to this match yet</strong>
          <p>
            A match-specific Fan Room will appear here when an admin
            links one to this fixture.
          </p>
          <a href="/app/fanroom">Explore other Fan Rooms →</a>
        </div>
      )}

      {!loading && room && (
        <>
          <div className="match-fan-room-details">
            <div>
              <strong>{room.name}</strong>
              {room.description && <p>{room.description}</p>}
            </div>

            <button
              type="button"
              className={
                room.isJoined
                  ? "match-fan-room-leave"
                  : "match-fan-room-join"
              }
              onClick={toggleMembership}
              disabled={membershipBusy}
            >
              {membershipBusy
                ? "Please wait..."
                : room.isJoined
                  ? "Leave Room"
                  : "Join Fan Room"}
            </button>
          </div>

          {notice && (
            <p className="match-fan-room-notice">{notice}</p>
          )}

          {room.isJoined ? (
            <>
              <div className="match-fan-room-messages" aria-live="polite">
                {room.messages.length === 0 ? (
                  <div className="match-fan-room-no-messages">
                    <MessageCircle size={22} />
                    <strong>Start the conversation</strong>
                    <span>Be the first to share your match thoughts.</span>
                  </div>
                ) : (
                  room.messages.map((item) => (
                    <article
                      key={item.id}
                      className="match-fan-room-message"
                    >
                      {item.avatarUrl ? (
                        <img
                          src={item.avatarUrl}
                          alt=""
                          className="match-fan-room-avatar"
                        />
                      ) : (
                        <span className="match-fan-room-avatar-placeholder">
                          {item.username.slice(0, 1).toUpperCase()}
                        </span>
                      )}

                      <div className="match-fan-room-message-content">
                        <div className="match-fan-room-message-meta">
                          <strong>{item.username}</strong>
                          <time dateTime={item.createdAt}>
                            {new Date(item.createdAt).toLocaleTimeString(
                              "en-NG",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </time>
                          {item.isEdited && <small>Edited</small>}
                        </div>
                        <p>{item.message}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <form
                className="match-fan-room-composer"
                onSubmit={sendMessage}
              >
                <input
                  type="text"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Share your thoughts about the match..."
                  maxLength={1000}
                  aria-label="Your match discussion message"
                />
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  aria-label="Send message"
                >
                  <Send size={17} />
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
            </>
          ) : (
            <div className="match-fan-room-join-prompt">
              <MessageCircle size={22} />
              <p>
                Join this Fan Room to read messages and take part in
                the match discussion.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}