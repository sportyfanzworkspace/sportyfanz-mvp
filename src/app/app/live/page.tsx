"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

type Fixture = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue: string | null;
  scheduledAt: string;
  status: string;
  homeScore: number;
  awayScore: number;
};

type FixturesResponse = {
  success: boolean;
  liveMatches: Fixture[];
  upcomingMatches: Fixture[];
};

function formatKickoff(date: string) {
  return new Date(date).toLocaleString(undefined, {
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
    default:
      return "UPCOMING";
  }
}

export default function MatchesPage() {
  const [fixtures, setFixtures] = useState<FixturesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Football fixtures are temporarily unavailable.");
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

  const liveMatches = fixtures?.liveMatches ?? [];
  const upcomingMatches = fixtures?.upcomingMatches ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span>MATCH CENTRE</span>
          <h1>Live & Matches</h1>
          <p>Follow professional football fixtures and match scores.</p>
        </div>
      </div>

      {loading && (
        <div className="white-panel">
          Loading football fixtures...
        </div>
      )}

      {error && (
        <div className="white-panel">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="match-centre-layout">
          <div>
            <div className="white-panel">
              <div className="panel-title">
                <h3>Live Matches</h3>
              </div>

              {liveMatches.length === 0 ? (
                <p>No professional matches are live right now.</p>
              ) : (
                liveMatches.map((match) => (
                  <FixtureCard key={match.id} match={match} />
                ))
              )}
            </div>

            <div className="white-panel" style={{ marginTop: 20 }}>
              <div className="panel-title">
                <h3>Upcoming Matches</h3>
              </div>

              {upcomingMatches.length === 0 ? (
                <p>No upcoming professional fixtures are available yet.</p>
              ) : (
                upcomingMatches.map((match) => (
                  <FixtureCard key={match.id} match={match} />
                ))
              )}
            </div>

            <div className="join-room-banner">
              <div className="join-room-icon">
                <MessageCircle size={24} />
              </div>

              <div>
                <strong>Join the Fan Room</strong>
                <p>Discuss football and connect with other fans.</p>
              </div>

              <a href="/fan-hub">Join Now</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FixtureCard({ match }: { match: Fixture }) {
  const isLive =
    match.status === "LIVE" || match.status === "HALF_TIME";

  return (
    <div
      style={{
        padding: "18px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="league-name">{match.competition}</span>

        <span className={isLive ? "live-pill" : "match-time"}>
          {statusLabel(match.status)}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 12,
          textAlign: "center",
        }}
      >
        <strong>{match.homeTeam}</strong>

        <strong style={{ fontSize: 22 }}>
          {isLive || match.status === "FINISHED"
            ? `${match.homeScore} - ${match.awayScore}`
            : "VS"}
        </strong>

        <strong>{match.awayTeam}</strong>
      </div>

      <p style={{ textAlign: "center", marginTop: 12 }}>
        {formatKickoff(match.scheduledAt)}
        {match.venue ? ` · ${match.venue}` : ""}
      </p>
    </div>
  );
}