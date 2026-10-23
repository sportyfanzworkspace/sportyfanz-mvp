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
  homeScore: number | null;
  awayScore: number | null;
};

type FootballFeed = {
  liveMatches: FootballMatch[];
  upcomingMatches: FootballMatch[];
};

export default function HomePage() {

  const [fanName, setFanName] = useState("SportyFanz Fan");
  const [fanInitials, setFanInitials] = useState("S");
  const [fanPoints, setFanPoints] = useState(0);
  const [liveMatches, setLiveMatches] = useState<FootballMatch[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<FootballMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

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

  async function loadMatches() {
    try {
      const response = await fetch("/api/matches/football", {
        cache: "no-store",
      });

      const data: FootballFeed = await response.json();

      if (!response.ok) {
        throw new Error("Unable to load football matches.");
      }

      if (!active) return;

      setLiveMatches(data.liveMatches ?? []);
      setUpcomingMatches(data.upcomingMatches ?? []);
    } catch (error) {
      console.error("Unable to load football matches:", error);
    } finally {
      if (active) {
        setMatchesLoading(false);
      }
    }
  }

  loadMatches();

  return () => {
    active = false;
  };
}, []);

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

          <div className="match-card-grid">
            {matchesLoading ? (
              <p>Loading live matches...</p>
            ) : liveMatches.length === 0 ? (
              <p>No live football matches right now.</p>
            ) : (
              liveMatches.map((match) => (
                <div className="match-card" key={match.id}>
                  <div
                    className="match-card-image"
                    style={{
                      backgroundImage: match.homeTeamLogo
                        ? `url(${match.homeTeamLogo})`
                        : "none",
                    }}
                  >
                    <span className="live-pill">
                      <span />
                      {match.status === "HALF_TIME" ? "HALF TIME" : "LIVE"}
                    </span>

                    <span className="match-card-time">
                      {match.status === "HALF_TIME" ? "HT" : "LIVE"}
                    </span>
                  </div>

                  <div className="match-card-body">
                    <div className="match-card-teams">
                      <strong>{match.homeTeam}</strong>

                      <span>
                        {match.homeScore ?? "—"} - {match.awayScore ?? "—"}
                      </span>

                      <strong>{match.awayTeam}</strong>
                    </div>

                    <div className="match-card-footer">
                      <small>{match.competition}</small>

                      <Link href="/app/live">Watch</Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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

        {/* UPCOMING */} 
        <div className="section-block upcoming-block">
          <div className="section-title">
            <h2>Upcoming Matches</h2>

            <button>
              View Calendar
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="upcoming-list">
            {matchesLoading ? (
              <p>Loading upcoming matches...</p>
            ) : upcomingMatches.length === 0 ? (
              <p>No upcoming football matches scheduled.</p>
            ) : (
              upcomingMatches.map((match) => (
                <div className="upcoming-card" key={match.id}>
                  <div className="team-badge">
                    {match.homeTeamShortName ??
                      match.homeTeam.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <strong>
                      {match.homeTeam} <span>vs</span> {match.awayTeam}
                    </strong>

                    <small>
                      {new Date(match.scheduledAt).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </small>

                    <small>{match.competition}</small>
                  </div>

                  <ChevronRight size={16} />
                </div>
              ))
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