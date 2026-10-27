"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";

type FootballMatch = {
  id: number;
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamShortName: string | null;
  awayTeamShortName: string | null;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  competition: string;
  venue: string | null;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  providerStatus?: string;
  elapsed?: number | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoffTimeConfirmed?: boolean;
};

type FootballFeed = {
  liveMatches: FootballMatch[];
  upcomingMatches: FootballMatch[];
  matches: FootballMatch[];
};

function getLagosDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  const date = new Date(
    `${values.year}-${values.month}-${values.day}T12:00:00Z`
  );

  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default function AllMatchesPage() {
  const searchParams = useSearchParams();

const [selectedDate, setSelectedDate] = useState(
  () => searchParams.get("date") || getLagosDate()
 );

const [selectedSportSlug, setSelectedSportSlug] = useState(
  () => searchParams.get("sport") || "football"
 );
  const [matchDay, setMatchDay] = useState<"today" | "tomorrow" | "custom">(
    "today"
  );
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMatches() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/matches/${encodeURIComponent(selectedSportSlug)}?date=${encodeURIComponent(selectedDate)}`,
          { cache: "no-store" }
        );

        const data: FootballFeed = await response.json();

        if (!response.ok || !data) {
          throw new Error("Unable to load matches.");
        }

        if (active) {
          setMatches(data.matches ?? []);
        }
      } catch (err) {
        console.error("Unable to load all matches:", err);

        if (active) {
          setError("Fixtures for this sport are temporarily unavailable. Please try again later.");
          setMatches([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMatches();

    return () => {
      active = false;
    };
  }, [selectedDate, selectedSportSlug]);

  function chooseDay(day: "today" | "tomorrow") {
    setMatchDay(day);
    setSelectedDate(getLagosDate(day === "today" ? 0 : 1));
    setShowDatePicker(false);
  }

  const filterButtonStyle = (active: boolean) => ({
    background: active ? "#16a34a" : "#fff",
    color: active ? "#fff" : "#333",
    border: `1px solid ${active ? "#16a34a" : "#ddd"}`,
    borderRadius: 8,
    padding: "9px 14px",
    cursor: "pointer" as const,
    fontWeight: 600 as const,
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span>MATCH CENTRE</span>
          <h1>
            All {selectedSportSlug.charAt(0).toUpperCase() + selectedSportSlug.slice(1)} Matches
          </h1>
        </div>

        <Link
          href="/app"
          className="secondary-button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </div>

      <section
        className="section-block upcoming-block"
        style={{
          background: "#fff",
          border: "1px solid #e8e8e8",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
          minWidth: 0,
        }}
      >
        <div className="section-title">
          <h2>Fixtures</h2>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            style={filterButtonStyle(matchDay === "today")}
            aria-pressed={matchDay === "today"}
            onClick={() => chooseDay("today")}
          >
            Today
          </button>

          <button
            type="button"
            style={filterButtonStyle(matchDay === "tomorrow")}
            aria-pressed={matchDay === "tomorrow"}
            onClick={() => chooseDay("tomorrow")}
          >
            Tomorrow
          </button>

          <div style={{ position: "relative", marginLeft: "auto" }}>
            <button
              type="button"
              className="secondary-button"
              aria-label="Choose match date"
              title="Choose date"
              aria-expanded={showDatePicker}
              onClick={() => setShowDatePicker((visible) => !visible)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                minWidth: 38,
              }}
             >
             <CalendarDays size={17} />
            </button>

           {showDatePicker && (
          <div
           style={{
             position: "absolute",
             top: "calc(100% + 8px)",
             right: 0,
             zIndex: 10,
             padding: 12,
             background: "#fff",
             border: "1px solid #e5e5e5",
             borderRadius: 10,
             boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
           }}
         >
         <input
           type="date"
           value={selectedDate}
           aria-label="Choose match date"
           onChange={(event) => {
           if (event.target.value) {
            setSelectedDate(event.target.value);
            setMatchDay("custom");
            setShowDatePicker(false);
           }
          }}
         />
        </div>
         )}
        </div>
       </div>
        <div className="upcoming-list">
          {loading ? (
            <p>Loading football fixtures...</p>
          ) : error ? (
            <p>{error}</p>
          ) : matches.length === 0 ? (
            <p>No football fixtures scheduled for this date.</p>
          ) : (
            matches.map((match) => {
              const isLive =
                match.status === "LIVE" || match.status === "HALF_TIME";

              const isFinished =
                match.status === "FINISHED" || match.status === "FT";

              const hasScore =
                match.homeScore !== null && match.awayScore !== null;

              const kickoff = new Date(match.scheduledAt);

              const kickoffTime = kickoff.toLocaleString("en-NG", {
                timeZone: "Africa/Lagos",
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              });

              const displayedKickoff =
                match.kickoffTimeConfirmed === false
                  ? `${kickoff.toLocaleDateString("en-NG", {
                      timeZone: "Africa/Lagos",
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })} · Time TBC`
                  : kickoffTime;

              return (
               <Link
                 href={`/app/matches/${match.fixtureId}?sport=${encodeURIComponent(selectedSportSlug)}`}
                 className="upcoming-card"
                 key={match.id}
                 style={{
                   display: "block",
                   color: "inherit",
                   textDecoration: "none",
                   cursor: "pointer",
                 }}
                 >
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <small
                      style={{
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {match.competition}
                    </small>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "grid", gap: 12 }}>
                        {[
                          {
                            name: match.homeTeam,
                            logo: match.homeTeamLogo,
                          },
                          {
                            name: match.awayTeam,
                            logo: match.awayTeamLogo,
                          },
                        ].map((team, index) => (
                          <div
                            key={`${match.id}-${index}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              minWidth: 0,
                            }}
                          >
                            {team.logo ? (
                              <img
                                src={team.logo}
                                alt=""
                                loading="lazy"
                                style={{
                                  width: 24,
                                  height: 24,
                                  objectFit: "contain",
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div
                                className="team-badge"
                                style={{ flexShrink: 0 }}
                              >
                                {team.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}

                            <strong 
                             style={{ 
                              fontSize: 16,
                              fontWeight: 700,
                              lineHeight: 1.4,
                              overflowWrap: "anywhere",
                              }}
                              >
                              {team.name}
                            </strong>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          justifyItems: "end",
                          gap: 12,
                          fontWeight: 700,
                          fontSize: 18,
                        }}
                      >
                        <span>{hasScore ? match.homeScore : "—"}</span>
                        <span>{hasScore ? match.awayScore : "—"}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <small>
                        {isLive
                          ? `${match.elapsed ?? 0}′ · ${
                              match.status === "HALF_TIME" ? "Half-time" : "LIVE"
                            }`
                          : isFinished
                            ? "Full-time"
                            : displayedKickoff}
                      </small>

                      <small
                        style={{
                          fontWeight: 700,
                          color: isLive ? "#d93025" : "inherit",
                        }}
                      >
                        {isLive
                          ? "LIVE"
                          : isFinished
                            ? "FT"
                            : match.status === "POSTPONED"
                              ? "Postponed"
                              : match.status === "CANCELLED"
                               ? "Cancelled"
                              : "Upcoming"}
                      </small>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
