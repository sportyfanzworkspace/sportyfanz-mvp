
"use client";

import { useCallback, useEffect, useState } from "react";

type TopFan = {
  id: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  totalPoints: number;
  fanLevel: string;
  rank: number;
};

export default function LeaderboardPage() {
  const [fans, setFans] = useState<TopFan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatPoints = (points: number) =>
    new Intl.NumberFormat("en-US").format(points);

  const loadTopFans = useCallback(async () => {
    try {
      setError("");

      const response = await fetch("/api/fanrooms/top-fans", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load leaderboard.");
      }

      setFans(data.fans ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load leaderboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTopFans();
  }, [loadTopFans]);

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-heading">
        <span>SPORTYFANZ COMMUNITY</span>
        <h1>Top Fans</h1>
        <p>
          Celebrating the fans leading the SportyFanz community.
        </p>
      </div>

      <div className="white-panel top-fans-panel leaderboard-main-panel">
        <div className="panel-title">
          <h3>Leaderboard</h3>
          <span>Top 5 Fans</span>
        </div>

        {loading ? (
          <p className="top-fans-message">
            Loading Top Fans...
          </p>
        ) : error ? (
          <div className="top-fans-message">
            <p>{error}</p>
            <button type="button" onClick={() => void loadTopFans()}>
              Try again
            </button>
          </div>
        ) : fans.length === 0 ? (
          <p className="top-fans-message">
            No fan rankings available yet.
          </p>
        ) : (
          <div className="top-fans-list">
            {fans.map((fan) => (
              <div className="top-fan-row" key={fan.id}>
                {fan.avatarUrl ? (
                  <img
                    className="top-fan-avatar"
                    src={fan.avatarUrl}
                    alt=""
                  />
                ) : (
                  <div className="top-fan-avatar top-fan-avatar-fallback">
                    {fan.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="top-fan-details">
                  <strong>{fan.name}</strong>
                  <span>
                    {fan.fanLevel.replace(/_/g, " ")}
                  </span>
                </div>

                <strong className="top-fan-points">
                  {formatPoints(fan.totalPoints)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
