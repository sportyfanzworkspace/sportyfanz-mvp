"use client";

import { apiFetch } from "@/lib/api";
import { getGuestFan } from "@/lib/guest-fan";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, RefreshCw, Send, Users } from "lucide-react";

function getLagosDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

type Fixture = {
  id: number;
  fixtureId?: number;
  leagueId?: number | null;
  leagueLogo?: string | null;
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

type FanSport = {
  id: number;
  name: string;
  slug: string;
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
  userId: number | null;
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
  messages: MatchFanRoomMessage[];
};

type MatchTab =
  | "overview"
  | "stats"
  | "lineups"
  | "players"
  | "table"
  | "fanroom";

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
  const [showAllLive, setShowAllLive] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [selectedSport, setSelectedSport] = useState("football");
  const [fanSports, setFanSports] = useState<FanSport[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsError, setSportsError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSports() {
      try {
        const response = await apiFetch("/api/sports", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error("Unable to load available sports.");
        }

        if (active) {
          setFanSports(
            (data.sports ?? []).filter(
              (sport: FanSport) =>
                !["badminton", "formula-1", "athletics"].includes(
                  sport.slug
                )
            )
          );
        }
      } catch {
        if (active) {
          setSportsError("Unable to load available sports.");
        }
      } finally {
        if (active) setSportsLoading(false);
      }
    }

    loadSports();

    return () => {
      active = false;
    };
  }, []);

  function selectSport(slug: string) {
    if (slug === selectedSport) return;

    const url = new URL(window.location.href);

    url.searchParams.set("sport", slug);
    url.searchParams.delete("fixtureId");

    window.location.assign(url.toString());
  }

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
        const searchParams = new URLSearchParams(window.location.search);

        const requestedSport = (
          searchParams.get("sport") ?? "football"
        ).toLowerCase();

        const requestedDate =
          searchParams.get("date") ?? getLagosDate();

        setSelectedSport(requestedSport);

        const fixturesUrl =
          requestedSport === "football"
            ? searchParams.get("date")
              ? `/api/matches/football?date=${encodeURIComponent(requestedDate)}`
              : "/api/matches/football"
            : `/api/matches/${encodeURIComponent(requestedSport)}?date=${encodeURIComponent(requestedDate)}`;

        const response = await apiFetch(fixturesUrl, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load fixtures.");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message ?? "Unable to load fixtures.");
        }

        if (!cancelled) {
          const live = data.liveMatches ?? [];
          const upcoming = data.upcomingMatches ?? [];

          setFixtures({
            success: true,
            liveMatches: live,
            upcomingMatches: upcoming,
          });

          const allMatches: Fixture[] = Array.isArray(data.matches)
           ? data.matches
           : [...live, ...upcoming];

          const requestedFixtureId = searchParams.get("fixtureId");

          const requestedMatch = requestedFixtureId
            ? allMatches.find(
                (match: Fixture) =>
                  String(match.fixtureId ?? match.id) ===
                  requestedFixtureId
              )
            : null;

          if (requestedFixtureId) {
            if (requestedMatch) {
              setSelectedMatch(requestedMatch);
              setError("");
            } else {
              setSelectedMatch(null);
              setError(
                "The selected match could not be found for this sport and date. Please return to the fixtures list and try again."
              );
            }
          } else {
            setSelectedMatch(allMatches[0] ?? null);
            setError("");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Fixtures are temporarily unavailable."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
        const response = await apiFetch(
          selectedSport === "football"
           ? `/api/matches/football/${selectedMatch!.fixtureId ?? selectedMatch!.id}`
           : `/api/matches/${encodeURIComponent(selectedSport)}/${selectedMatch!.fixtureId ?? selectedMatch!.id}`,
           { cache: "no-store" }
         );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error("Unable to load match details.");
        }

        if (!cancelled) {
           if (selectedSport === "football") {
            setDetails(data);
        } else {
         setDetails({
           success: data.success,
           fixture: data.game ?? {},
           events: [],
            statistics: data.statistics ?? [],
            lineups: [],
            players: [],
            standings: [],
            dataAvailability: {
            events: false,
            statistics:
          data.dataAvailability?.statistics === true &&
          Array.isArray(data.statistics) &&
          data.statistics.length > 0,
            lineups: false,
            players: false,
            standings: false,
        },
        });
       }
      }
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
  }, [selectedMatch, selectedSport]);

  const liveMatches = fixtures?.liveMatches ?? [];
  const upcomingMatches = fixtures?.upcomingMatches ?? [];
  const isLive =
    selectedMatch?.status === "LIVE" ||
    selectedMatch?.status === "HALF_TIME";


  const matchTabs: [MatchTab, string][] =
    selectedSport === "football"
      ? [
          ["overview", "Overview"],
          ["stats", "Stats"],
          ["lineups", "Lineups"],
          ["players", "Player Performance"],
          ["table", "League Table"],
          ["fanroom", "Fan Room"],
        ]
      : selectedSport === "basketball" &&
          details?.dataAvailability?.statistics
        ? [
            ["overview", "Overview"],
            ["stats", "Stats"],
            ["fanroom", "Fan Room"],
          ]
        : [
            ["overview", "Overview"],
            ["fanroom", "Fan Room"],
          ];


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
          <p>
            Follow {selectedSport} fixtures, scores and available match information.
         </p>
        </div>
      </div>

      {loading && (
        <div className="white-panel">
          Loading {selectedSport} fixtures...
        </div>
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
                  {matchTabs.map(([tab, label]) => (
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
                  {activeTab === "fanroom" && (
                  <MatchFanRoom
                    fixtureId={selectedMatch.fixtureId ?? selectedMatch.id}
                     sport={selectedSport}
                  />
                )}

                {activeTab !== "fanroom" && detailsLoading && (
                <div className="match-data-message">
                 <RefreshCw size={17} />
                   Loading match information...
                </div>
                )}

  {activeTab !== "fanroom" && !detailsLoading && detailsError && (
    <div className="match-data-message">{detailsError}</div>
  )}

  {activeTab !== "fanroom" &&
    !detailsLoading &&
    !detailsError &&
    details && (
      <>
        {activeTab === "overview" && (
         selectedSport === "football" ? (
          <OverviewTab
           details={details}
           selectedMatch={selectedMatch}
           />
          ) : (
          <SportOverviewTab
           selectedMatch={selectedMatch}
           sport={selectedSport}
          />
         )
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

            <section className="white-panel fixture-list-panel">
              <div className="panel-title">
                <h3>Live Matches</h3>
                {liveMatches.length > 5 && (
                  <button
                    type="button"
                    className="fixture-list-toggle"
                    onClick={() => setShowAllLive((current) => !current)}
                    aria-expanded={showAllLive}
                  >
                    {showAllLive ? "View Less" : "View All"}
                    <span aria-hidden="true">
                      {showAllLive ? "⌃" : "⌄"}
                    </span>
                  </button>
                )}
              </div>
              {liveMatches.length === 0 ? (
                <p className="fixture-empty">No professional matches are live right now.</p>
              ) : (
                (showAllLive ? liveMatches : liveMatches.slice(0, 5)).map((match) => (
                  <FixtureCard
                    key={match.id}
                    match={match}
                    selected={selectedMatch?.id === match.id}
                    onSelect={() => selectMatch(match)}
                  />
                ))
              )}

            </section>

            {/* ANTICIPATE ADVERTISEMENT */}
            <aside
              className="live-anticipate-ad"
              aria-label="Anticipate advertisement"
            >
              <img
                src="/anticipateCard.jpg"
                alt="Anticipate promotional advertisement"
                loading="lazy"
              />
            </aside>

            <section className="white-panel fixture-list-panel">
              <div className="panel-title">
                <h3>Upcoming Matches</h3>
                {upcomingMatches.length > 5 && (
                  <button
                    type="button"
                    className="fixture-list-toggle"
                    onClick={() => setShowAllUpcoming((current) => !current)}
                    aria-expanded={showAllUpcoming}
                  >
                    {showAllUpcoming ? "View Less" : "View All"}
                    <span aria-hidden="true">
                      {showAllUpcoming ? "⌃" : "⌄"}
                    </span>
                  </button>
                )}
              </div>
              {upcomingMatches.length === 0 ? (
                <p className="fixture-empty">No upcoming professional fixtures are available yet.</p>
              ) : (
                (showAllUpcoming ? upcomingMatches : upcomingMatches.slice(0, 5)).map((match) => (
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
                <a href="/fanroom">Join conversation →</a>
              </div>
            </div>

            <div className="live-your-sports">
              <div className="sf-your-sports-panel">
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
             Your Sports
          </h2>

         <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>
           Choose a sport to explore its matches.
         </p>

         {sportsLoading ? (
           <p>Loading available sports...</p>
          ) : sportsError ? (
           <p>{sportsError}</p>
          ) : fanSports.length === 0 ? (
           <p>
             No sports are available right now. Please check back soon.
           </p>
          ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
        {fanSports
          .filter(
            (sport) =>
              !["badminton", "formula-1", "athletics"].includes(
                sport.slug
              )
          )
          .map((sport) => {
        const active = selectedSport === sport.slug;

        const icons: Record<string, string> = {
          football: "⚽",
          basketball: "🏀",
          tennis: "🎾",
          cricket: "🏏",
          rugby: "🏉",
          volleyball: "🏐",
          baseball: "⚾",
          badminton: "🏸",
          "formula-1": "🏎️",
          athletics: "🏃",
        };

        return (
          <button
            key={sport.id}
            type="button"
            onClick={() => selectSport(sport.slug)}
            aria-pressed={active}
            className="secondary-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: active ? "#16a34a" : "#fff",
              color: active ? "#fff" : "#243447",
              border: `1px solid ${active ? "#16a34a" : "#ddd"}`,
              borderRadius: 10,
              padding: "10px 16px",
            }}
          >
            <span>{icons[sport.slug] ?? "🏆"}</span>
            {sport.name}
          </button>
           );
          })}
         </div>
        )}
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
        <span className="fixture-competition">
          {match.leagueLogo && (
            <img
              src={match.leagueLogo}
              alt=""
              className="fixture-league-logo"
              loading="lazy"
            />
          )}
          <span>{match.competition}</span>
        </span>
        <span className={isLive ? "live-pill" : "match-time"}>
          {statusLabel(match.status)}
        </span>
      </div>
      <div className="fixture-select-teams">
        <div className="fixture-team fixture-team-home">
          {match.homeTeamLogo && (
            <img
              src={match.homeTeamLogo}
              alt=""
              className="fixture-team-logo"
              loading="lazy"
            />
          )}
          <strong>{match.homeTeam}</strong>
        </div>
        <b>
          {isLive || match.status === "FINISHED"
            ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
            : "VS"}
        </b>
        <div className="fixture-team fixture-team-away">
          <strong>{match.awayTeam}</strong>
          {match.awayTeamLogo && (
            <img
              src={match.awayTeamLogo}
              alt=""
              className="fixture-team-logo"
              loading="lazy"
            />
          )}
        </div>
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

function SportOverviewTab({
  selectedMatch,
  sport,
}: {
  selectedMatch: Fixture;
  sport: string;
}) {
  const sportNames: Record<string, string> = {
    basketball: "Basketball",
    baseball: "Baseball",
    rugby: "Rugby",
    volleyball: "Volleyball",
  };

  const sportName = sportNames[sport] ?? "Match";

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
          <h3>{sportName} Match Information</h3>
          <p>Match status and fixture information</p>
        </div>
      </div>

      <div className="match-empty-state">
        Detailed match events and play-by-play information are not
        currently available for this fixture.
      </div>
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

function MatchFanRoom({
  fixtureId,
  sport,
}: {
  fixtureId: number;
  sport: string;
}) {
  const [room, setRoom] = useState<MatchFanRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [unavailableStatus, setUnavailableStatus] = useState("");

  useEffect(() => {
  let cancelled = false;
  let loadingRequest = false;

  async function loadRoom() {
    if (loadingRequest) return;

    loadingRequest = true;

    try {
      const response = await apiFetch(
        `/api/fanrooms/match/${fixtureId}?sport=${encodeURIComponent(sport)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ?? "Unable to load the match Fan Room."
        );
      }

      if (cancelled) return;

      setUnavailableStatus(
        data.unavailable ? data.roomStatus ?? "CLOSED" : ""
      );

      setRoom(data.room ?? null);
      setError("");

    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the match Fan Room."
        );
      }
    } finally {
      loadingRequest = false;

      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  setLoading(true);
  setRoom(null);
  setError("");
  setNotice("");
  setUnavailableStatus("");

  void loadRoom();

  const interval = window.setInterval(() => {
    void loadRoom();
  }, 5000);

  return () => {
    cancelled = true;
    window.clearInterval(interval);
   };
  }, [fixtureId, sport]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!room || !message.trim() || sending) return;

    const text = message.trim();

    setSending(true);
    setError("");
    setNotice("");

    try {
      const response = await apiFetch("/api/fanrooms/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          message: text,
          ...getGuestFan(),
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
    <section id="match-fan-room" className="match-fan-room">
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

      {!loading && !error && !room && (
      <div className="match-fan-room-empty">
       <MessageCircle size={25} />

      {unavailableStatus ? (
       <>
        <strong>
          This Fan Room is {unavailableStatus.toLowerCase()}.
        </strong>
        <p>
          An administrator has made this match discussion room
          unavailable.
        </p>
       </>
       ) : (
        <>
          <strong>Match Fan Room unavailable</strong>
         <p>
           We couldn't find or create a discussion room for this
           fixture. Please try again shortly.
          </p>
         </>
        )}

        <a href="/fanroom">Explore other Fan Rooms →</a>
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
          <a href="/fanroom">Explore other Fan Rooms →</a>
        </div>
      )}

      {!loading && room && (
        <>
          <div className="match-fan-room-details">
            <div>
              <strong>{room.name}</strong>
              {room.description && <p>{room.description}</p>}
            </div>

          </div>

          {notice && (
            <p className="match-fan-room-notice">{notice}</p>
          )}

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
      )}
    </section>
  );
}
