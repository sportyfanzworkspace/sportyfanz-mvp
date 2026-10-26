"use client"
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Crown,
  Plus,
  Target,
} from "lucide-react";

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
};


type FanSport = {
  id: number;
  name: string;
  slug: string;
};

type SportsResponse = {
  success: boolean;
  sports: FanSport[];
  followedSportIds: number[];
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

export default function HomePage() {

  const [fanName, setFanName] = useState("SportyFanz Fan");
  const [fanInitials, setFanInitials] = useState("S");
  const [fanPoints, setFanPoints] = useState(0);
  const [upcomingMatches, setUpcomingMatches] = useState<FootballMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [matchDay, setMatchDay] = useState<"today" | "tomorrow" | "custom">("today");
  const [fanSports, setFanSports] = useState<FanSport[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsError, setSportsError] = useState("");
  const [selectedDate, setSelectedDate] = useState(getLagosDate);
  const [selectedSportSlug, setSelectedSportSlug] = useState("football");

  
  useEffect(() => {
    let active = true;  

  async function loadFan() {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (!response.ok) return;

      const data = await response.json();
      const user = data.user;

      if (!active || !user) return;

      const name =
        user.name?.trim() ||
        user.username ||
        user.email ||
        "SportyFanz Fan";

      setFanName(name);
      setFanPoints(user.totalPoints ?? 0);
      setFanInitials(
        name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part: string) => part[0])
          .join("")
          .toUpperCase()
      );
    } catch (error) {
      console.error("Unable to load home profile:", error);
    }
  }
  

  loadFan();

  return () => {
    active = false;
  };
 }, []);

 
useEffect(() => {
  let active = true;

  async function loadFanSports() {
    setSportsLoading(true);
    setSportsError("");

    try {
      const response = await fetch("/api/sports", {
        cache: "no-store",
      });

      const data: SportsResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error("Unable to load your selected sports.");
      }

      if (!active) return;

      const selected = data.sports.filter((sport) =>
        data.followedSportIds.includes(sport.id)
      );

      setFanSports(selected);

      setSelectedSportSlug((current) => {
        if (selected.some((sport) => sport.slug === current)) {
          return current;
        }

        return selected[0]?.slug ?? "";
      });
    } catch {
      if (!active) return;

      setSportsError("Unable to load your selected sports.");
      setFanSports([]);
    } finally {
      if (active) setSportsLoading(false);
    }
  }

  loadFanSports();

  return () => {
    active = false;
  };
}, []);

  
useEffect(() => {
  let active = true;

  async function loadMatches() {
    setMatchesLoading(true);
    setMatchesError("");

    try {
      if (!selectedSportSlug) {
        setUpcomingMatches([]);
        return;
      }

      const query = selectedDate
        ? `?date=${encodeURIComponent(selectedDate)}`
        : "";

       const response = await fetch(
        `/api/matches/${encodeURIComponent(selectedSportSlug)}${query}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!active) return;

      if (!response.ok || !data?.success) {
        setMatchesError(
          data?.message ??
            `${selectedSportSlug} fixtures are temporarily unavailable.`
        );
        setUpcomingMatches([]);
        return;
      }

      setUpcomingMatches(data.matches ?? []);

     } catch {
      if (!active) return;

      setMatchesError(
        `Unable to connect to ${selectedSportSlug} fixtures. Please try again later.`
      );
      setUpcomingMatches([]);
    } finally {
      if (active) setMatchesLoading(false);
    }
  }

  loadMatches();

  return () => {
    active = false;
   };
  }, [selectedDate, selectedSportSlug]);


  return (
    <div className="page">

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <span>WELCOME BACK, {fanName.toUpperCase()}</span>

          <h1>Your Fan Kingdom</h1>

          <p>
            Everything happening in your sports world,
            all in one place.
          </p>
        </div>

        <div className="header-actions">
          <button className="secondary-button">
            <CalendarDays size={15} />
            Today
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* HOME GRID */}
      <section className="home-grid">

        {/* HERO */}
        <div
          className="hero-card"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1400&q=85)",
          }}
        >
          <div className="hero-overlay" />

          <div className="hero-content">

            <span className="live-pill">
              <span />
              LIVE NOW
            </span>

            <h1>
              Real Fans.
              <br />
              Real Sports.
              <br />
              <span>Real Rewards.</span>
            </h1>

            <p>
              Watch, participate, connect and earn rewards
              for being the fan you already are.
            </p>

            <Link
              href="/app/live"
              className="primary-button"
            >
              Explore Live Matches
              <ArrowRight size={16} />
            </Link>

          </div>
        </div>

        {/* FAN KINGDOM */}
        <div className="fan-kingdom-card">

          <div className="kingdom-card-header">

            <div className="sf-avatar large">
              {fanInitials}
            </div>

            <div>
              <span>Fan Kingdom</span>
              <strong>{fanName}</strong>
            </div>

            <ChevronDown size={16} />
          </div>

          <div className="kingdom-card-stats">

            <div>
              <span>Fan Score</span>
              <strong>{fanPoints.toLocaleString()}</strong>
            </div>

            <div>
              <span>Sports IQ</span>
              <strong>—</strong>
            </div>

            <div className="add-score">
              <Plus size={17} />
            </div>

          </div>

          <Link
            href="/app/kingdom"
            className="primary-button"
          >
            View My Kingdom
          </Link>

        </div>

        {/* LIVE MATCHES */}
        <div className="section-block live-block">
         <div className="section-title">
          <h2>Live Now</h2>
          <Link href="/app/live">
           View All
           <ChevronRight size={14} />
         </Link>
        </div>

        <p>Live streaming is not available right now.</p>
       </div>

        {/* RIGHT COLUMN */}
        <div className="home-right-column">

          {/* CHALLENGE */}
          <div className="challenge-card">

            <div className="challenge-icon">
              <Target size={21} />
            </div>

            <div>
              <span>Fan Challenge</span>

              <strong>
                Predict the next goal scorer
              </strong>

              <small>
                Win up to +100 pts
              </small>
            </div>

            <Link href="/participate">
              Join
            </Link>

          </div>

          {/* TRENDING ROOMS */}
          <div className="white-panel trending-rooms">

            <div className="panel-title">
              <h3>Trending in Fan Rooms</h3>

              <Link href="/app/fanroom">
                View All
                <ChevronRight size={13} />
              </Link>
            </div>

            {[
              ["Arsenal Fans", "5.2K fans", "🔥"],
              ["Football Fans", "3.8K fans", "⚽"],
              ["Premier League", "2.9K fans", "🏆"],
            ].map((room) => (

              <Link
                href="/app/fanroom"
                className="room-row"
                key={room[0]}
              >
                <div className="room-icon">
                  {room[2]}
                </div>

                <div>
                  <strong>{room[0]}</strong>
                  <span>{room[1]}</span>
                </div>

                <ChevronRight size={15} />
              </Link>

            ))}

          </div>
        </div>

          
        {/* FAN'S SELECTED SPORTS */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e8e8",
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
             Your Sports
          </h2>

         <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>
           Choose a sport to explore its matches.
         </p>

         {sportsLoading ? (
           <p>Loading your sports...</p>
          ) : sportsError ? (
           <p>{sportsError}</p>
          ) : fanSports.length === 0 ? (
           <p>
             You haven't selected any sports yet. Update your sports
             preferences to get started.
           </p>
          ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
        {fanSports.map((sport) => {
        const active = selectedSportSlug === sport.slug;

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
            onClick={() => setSelectedSportSlug(sport.slug)}
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
  
        {/* UPCOMING MATCHES */}
        <div className="section-block upcoming-block"
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
            <h2>
              Upcoming {fanSports.find(
              (sport) => sport.slug === selectedSportSlug
              )?.name ?? "Sports"} Matches
            </h2>

            <Link
              href={`/app/matches?sport=${encodeURIComponent(selectedSportSlug)}&date=${encodeURIComponent(selectedDate)}`}
              className="secondary-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                textDecoration: "none",
              }}
            >
              View All
            <ChevronRight size={14} />
           </Link>
          </div>
            
         <div
           style={{
             display: "flex",
             justifyContent: "space-between",
             alignItems: "center",
             gap: 12,
             flexWrap: "wrap",
             marginBottom: 16,
           }}
          >
         <div style={{ display: "flex", gap: 8 }}>
          <button
          style={{
            background: matchDay === "today" ? "#16a34a" : "#fff",
            color: matchDay === "today" ? "#fff" : "#333",
            borderColor: matchDay === "today" ? "#16a34a" : "#ddd",
           }}
            type="button"
            onClick={() => {
              setMatchDay("today");
              setSelectedDate(getLagosDate());
              setShowDatePicker(false);
            }}
            className="secondary-button"
            aria-pressed={matchDay === "today"}
           >
           Today
          </button>

         <button
         style={{
           background: matchDay === "tomorrow" ? "#16a34a" : "#fff",
           color: matchDay === "tomorrow" ? "#fff" : "#333",
           borderColor: matchDay === "tomorrow" ? "#16a34a" : "#ddd",
          }}
           type="button"          
           onClick={() => {
            setMatchDay("tomorrow");
            setSelectedDate(getLagosDate(1));
            setShowDatePicker(false);
           }}
        className="secondary-button"
        aria-pressed={matchDay === "tomorrow"}
       >
        Tomorrow
       </button>
      </div>

        
<div style={{ position: "relative" }}>
  <button
    type="button"
    onClick={() => setShowDatePicker((visible) => !visible)}
    className="secondary-button"
    aria-label="Choose match date"
    aria-expanded={showDatePicker}
  >
    <CalendarDays size={18} />
  </button>

  {showDatePicker && (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 8px)",
        zIndex: 50,
        padding: 12,
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      }}
    >
      <input
        type="date"
        autoFocus
        value={selectedDate}
        onChange={(event) => {
          if (event.target.value) {
            setSelectedDate(event.target.value);
            setMatchDay("custom"); 
            setShowDatePicker(false);
          }
        }}
        aria-label="Choose match date"
        style={{
          border: "none",
          outline: "none",
          padding: 4,
          background: "transparent",
          color: "#222",
          fontSize: 14,
          }}
         />
        </div>
        )}
       </div>

         </div>
     
          <div className="upcoming-list">
            {matchesLoading ? (
              <p>Loading upcoming matches...</p>
            ) : matchesError ? (
              <p>{matchesError}</p>
            ) : upcomingMatches.length === 0 ? (
              <p>
                {selectedDate
                  ? `No ${selectedSportSlug} fixtures scheduled for this date.`
                  : `No ${selectedSportSlug} fixtures scheduled for today or tomorrow.`}
              </p>
            ) : (
              upcomingMatches.slice(0, 10).map((match) => {
                const isLive =
                  match.status === "LIVE" ||
                  match.status === "HALF_TIME";

                const isFinished =
                  match.status === "FINISHED" ||
                  match.status === "FT";

                const hasScore =
                  match.homeScore !== null &&
                  match.awayScore !== null;

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
               const displayedKickoff = match.kickoffTimeConfirmed === false
                 ? `${kickoff.toLocaleDateString("en-NG", {
                 timeZone: "Africa/Lagos",
                 weekday: "short",
                 month: "short",
                 day: "numeric",
                 })} · Time TBC`
                 : kickoffTime;
                
                return (
                  <div className="upcoming-card" key={match.id}>
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
                                    width: 30,
                                    height: 30,
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
                          <span>
                            {hasScore ? match.homeScore : "—"}
                          </span>
                          <span>
                            {hasScore ? match.awayScore : "—"}
                          </span>
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
                            ? `${match.elapsed ?? 0}′ · ${match.status === "HALF_TIME" ? "Half-time" : "LIVE"}`
                            : isFinished
                              ? "Full-time"
                              : displayedKickoff}
                        </small>
                   
                      <small
                       style={{
                        fontWeight: 700,
                        color: isLive
                        ? "#d93025"
                        : isFinished
                        ? "#188038"
                        : "inherit",
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
                         : match.status === "SCHEDULED"
                         ? "Upcoming"
                         : match.status}
                       </small>

                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* FAN ROOM PROMO */}
        <div className="promo-card">

          <div className="promo-image">
            <span>FAN</span>
          </div>

          <div className="promo-content">

            <span>FAN ROOM</span>

            <h3>
              Join the conversation.
            </h3>

            <p>
              Discuss matches, predictions and rewards
              with fans.
            </p>

            <Link href="/app/fanroom">
              Enter Fan Room
              <ArrowRight size={14} />
            </Link>

          </div>
        </div>

      </section>
    </div>
  );
}