
"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

type MatchCentreData = {
  success: boolean;
  fixture?: {
    fixture?: {
      id?: number;
      date?: string;
      status?: {
        short?: string;
        long?: string;
        elapsed?: number | null;
      };
      venue?: {
        name?: string | null;
      };
    };
    league?: {
      name?: string;
      country?: string;
      logo?: string | null;
    };
    teams?: {
      home?: {
        name?: string;
        logo?: string | null;
      };
      away?: {
        name?: string;
        logo?: string | null;
      };
    };
    goals?: {
      home?: number | null;
      away?: number | null;
    };
  };
  events?: Array<{
    time?: { elapsed?: number | null; extra?: number | null };
    team?: { name?: string };
    player?: { name?: string | null };
    assist?: { name?: string | null };
    type?: string;
    detail?: string;
  }>;
  statistics?: Array<{
    team?: { name?: string };
    statistics?: Array<{ type?: string; value?: string | number | null }>;
  }>;
  lineups?: Array<{
    team?: { name?: string; logo?: string | null };
    formation?: string | null;
    startXI?: Array<{ player?: { name?: string; number?: number; pos?: string } }>;
    substitutes?: Array<{ player?: { name?: string; number?: number; pos?: string } }>;
  }>;
    dataAvailability?: {
    events: boolean;
    statistics: boolean;
    lineups: boolean;
  };
  sport?: string;
  game?: Record<string, unknown>;
  playByPlay?: Array<Record<string, unknown>>;
  setScores?: Array<Record<string, unknown>>;
  message?: string;
};

type Tab =
  | "Overview"
  | "Play-by-play"
  | "Events"
  | "Set scores"
  | "Stats"
  | "Lineups";

export default function MatchCentrePage() {
  const params = useParams<{ fixtureId: string }>();
  const searchParams = useSearchParams();
  const sport = (searchParams.get("sport") || "football")
  .trim()
  .toLowerCase();

  const isFootball = sport === "football";
  const fixtureId = params.fixtureId;

  const [data, setData] = useState<MatchCentreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("Overview");

  
  useEffect(() => {
    let active = true;

    async function loadMatch() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const endpoint =
          sport.toLowerCase() === "football"
            ? `/api/matches/football/${encodeURIComponent(fixtureId)}`
            : `/api/matches/${encodeURIComponent(
                sport.toLowerCase()
              )}/${encodeURIComponent(fixtureId)}`;

        const response = await fetch(endpoint, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to load this match."
          );
        }

        let normalized: MatchCentreData;

        if (sport.toLowerCase() === "football") {
          if (!result.fixture) {
            throw new Error("Football match details were not found.");
          }

          normalized = result as MatchCentreData;
        } else {
          const game = result.game;

          if (!game) {
            throw new Error("Match details were not found.");
          }

          const homeScore =
            typeof game.scores?.home === "number"
              ? game.scores.home
              : game.scores?.home?.total ?? null;

          const awayScore =
            typeof game.scores?.away === "number"
              ? game.scores.away
              : game.scores?.away?.total ?? null;

          const gameDate = game.date
            ? new Date(game.date).toISOString()
            : undefined;

          const venue =
            typeof game.venue === "string"
              ? game.venue
              : game.venue?.name ?? null;

          normalized = {
            success: true,
            sport,
            game,
            playByPlay: Array.isArray(result.playByPlay)
            ? result.playByPlay
            : [],
            setScores: Array.isArray(result.setScores)
            ? result.setScores
            : [],
            fixture: {
              fixture: {
                id: game.id,
                date: gameDate,
                status: {
                  short: game.status?.short ?? "NS",
                  long: game.status?.long ?? "Status unavailable",
                  elapsed: game.status?.elapsed ?? null,
                },
                venue: { name: venue },
              },
              league: {
                name: game.league?.name ?? `${sport} match`,
                country:
                  typeof game.country === "string"
                    ? game.country
                    : game.country?.name ?? "",
              },
              teams: {
                home: {
                  name: game.teams?.home?.name ?? "Home",
                  logo: game.teams?.home?.logo ?? null,
                },
                away: {
                  name: game.teams?.away?.name ?? "Away",
                  logo: game.teams?.away?.logo ?? null,
                },
              },
              goals: {
                home: homeScore,
                away: awayScore,
              },
            },
            events: [],
            statistics: [],
            lineups: [],
          };
        }

        if (active) {
          setData(normalized);
          setTab("Overview");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this match."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (fixtureId && sport) {
      loadMatch();
    }

    return () => {
      active = false;
    };
  }, [fixtureId, sport]);


  if (loading) {
    return <div className="page"><p>Loading match centre...</p></div>;
  }

  if (error || !data?.fixture) {
    return (
      <div className="page">
        <Link href="/app/matches" className="secondary-button">
          <ArrowLeft size={16} /> Back to Matches
        </Link>
        <p>{error || "Match details are unavailable."}</p>
      </div>
    );
  }

  const fixture = data.fixture;
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  const status = fixture.fixture?.status?.short ?? "NS";
  const live = [
     "1H", "2H", "HT", "ET", "P", "BT", "LIVE",
     "Q1", "Q2", "Q3", "Q4", "IN",
   ].includes(status);

const finished = [
  "FT", "AET", "PEN", "AOT", "AP",
].includes(status);
  const hasScore =
    fixture.goals?.home != null && fixture.goals?.away != null;

  const kickoff = fixture.fixture?.date
    ? new Date(fixture.fixture.date).toLocaleString("en-NG", {
        timeZone: "Africa/Lagos",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Kickoff time unavailable";

  const tabs: Tab[] = isFootball
  ? ["Overview", "Events", "Stats", "Lineups"]
  : sport === "basketball" || sport === "baseball"
    ? ["Overview", "Play-by-play", "Stats"]
    : sport === "rugby"
      ? ["Overview", "Events", "Stats"]
      : sport === "volleyball"
        ? ["Overview", "Set scores", "Stats"]
        : ["Overview"];

  const panelStyle = {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  } as const;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span>MATCH CENTRE</span>
          <h3>{fixture.league?.name ?? `${sport} Match`}</h3>
          <p>{fixture.league?.country ?? ""}</p>
        </div>
        <Link
          href="/app/matches"
          className="secondary-button"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
        >
          <ArrowLeft size={16} /> All Matches
        </Link>
      </div>

      <section style={{ ...panelStyle, marginBottom: 18 }}>
        <div style={{ textAlign: "center", color: live ? "#dc2626" : "#666", fontWeight: 700, marginBottom: 22 }}>
          {live
            ? `${status === "HT" ? "HALF-TIME" : "LIVE"}${fixture.fixture?.status?.elapsed != null && status !== "HT" ? ` · ${fixture.fixture.status.elapsed}′` : ""}`
            : finished
              ? "FULL-TIME"
              : status === "PST" || status === "POST"
                ? "POSTPONED"
                : kickoff}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "center", minWidth: 0 }}>
            {home?.logo && <img src={home.logo} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />}
            <h2 style={{ fontSize: 16, overflowWrap: "anywhere" }}>{home?.name ?? "Home"}</h2>
          </div>

          <div style={{ textAlign: "center", fontSize: 30, fontWeight: 800, whiteSpace: "nowrap" }}>
            {hasScore ? `${fixture.goals?.home} - ${fixture.goals?.away}` : "VS"}
          </div>

          <div style={{ textAlign: "center", minWidth: 0 }}>
            {away?.logo && <img src={away.logo} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />}
            <h2 style={{ fontSize: 16, overflowWrap: "anywhere" }}>{away?.name ?? "Away"}</h2>
          </div>
        </div>

        {fixture.fixture?.venue?.name && (
          <p style={{ textAlign: "center", color: "#666", marginTop: 16 }}>
            {fixture.fixture.venue.name}
          </p>
        )}
      </section>

      <nav style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 18 }}>
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            aria-pressed={tab === item}
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderRadius: 8,
              border: `1px solid ${tab === item ? "#16a34a" : "#ddd"}`,
              background: tab === item ? "#16a34a" : "#fff",
              color: tab === item ? "#fff" : "#333",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <section style={panelStyle}>
          <h4>Match Overview</h4>
          <p style={{fontSize: 14}}><strong>Competition:</strong> {fixture.league?.name ?? "—"}</p>
          <p style={{fontSize: 14}}><strong>Country:</strong> {fixture.league?.country ?? "—"}</p>
          <p style={{fontSize: 14}}><strong>Venue:</strong> {fixture.fixture?.venue?.name ?? "Not available"}</p>
          <p style={{fontSize: 14}}><strong>Status:</strong> {fixture.fixture?.status?.long ?? status}</p>
          <p style={{fontSize: 14}}><strong>Kickoff:</strong> {kickoff}</p>
        </section>
       )}

      {tab === "Events" && (
        <section style={panelStyle}>
          <h4>Match Events</h4>
          {!data.events?.length ? (
            <p style={{fontSize: 14}}>Match events not available at the moment.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {data.events.map((event, index) => (
                <div key={`${event.time?.elapsed}-${event.type}-${index}`} style={{ paddingBottom: 10, borderBottom: "1px solid #eee" }}>
                  <strong>{event.time?.elapsed ?? "—"}′{event.time?.extra ? `+${event.time.extra}` : ""}</strong>
                  {" · "}{event.type ?? "Event"}: {event.detail ?? "—"}
                  <div>{event.player?.name ?? ""}{event.assist?.name ? ` (Assist: ${event.assist.name})` : ""}</div>
                  <small style={{ color: "#666" }}>{event.team?.name ?? ""}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "Stats" && (
        <section style={panelStyle}>
          <h4>Statistics</h4>
          {!data.statistics?.length ? (
            <p>
              {data.dataAvailability?.statistics === false
                ? "We couldn't retrieve statistics from the provider. Please try again later."
                : "Statistics not published for this match yet."}
            </p>
           ) : (
            <div style={{ display: "grid", gap: 20 }}>
              {data.statistics.map((team, index) => (
                <div key={`${team.team?.name}-${index}`}>
                  <h3>{team.team?.name ?? `Team ${index + 1}`}</h3>
                  {team.statistics?.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {team.statistics.map((stat, statIndex) => (
                        <div key={`${stat.type}-${statIndex}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #eee", paddingBottom: 6 }}>
                          <span>{stat.type ?? "Statistic"}</span>
                          <strong>{stat.value == null ? "—" : String(stat.value)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : <p>No statistics available.</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "Lineups" && (
        <section style={panelStyle}>
          <h4>Team Lineups</h4>
          {!data.lineups?.length ? (
            <p>
              {data.dataAvailability?.lineups === false
              ? "We couldn't retrieve lineups from the provider. Please try again later."
              : "Team lineups not published for this match yet."}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
              {data.lineups.map((lineup, index) => (
                <div key={`${lineup.team?.name}-${index}`}>
                  <h3>{lineup.team?.name ?? `Team ${index + 1}`}</h3>
                  <p>Formation: {lineup.formation ?? "—"}</p>
                  <h4>Starting XI</h4>
                  {lineup.startXI?.length ? lineup.startXI.map((item, playerIndex) => (
                    <p key={`start-${playerIndex}`}>
                      {item.player?.number ?? ""} {item.player?.name ?? "Player"}
                    </p>
                  )) : <p>Not available</p>}
                  <h4>Substitutes</h4>
                  {lineup.substitutes?.length ? lineup.substitutes.map((item, playerIndex) => (
                    <p key={`sub-${playerIndex}`}>
                      {item.player?.number ?? ""} {item.player?.name ?? "Player"}
                    </p>
                  )) : <p>Not available</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
