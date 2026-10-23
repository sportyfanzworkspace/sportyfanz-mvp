"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Trophy,
  Target,
  MessageCircle,
  Activity,
} from "lucide-react";

type FanProfile = {
  id: number;
  name: string | null;
  username: string | null;
  email: string;

  fanLevel: string;

  totalPoints: number;
  currentPoints: number;

  matchesWatched: number;
  challengesCompleted: number;
  fanRoomsJoined: number;

  avatarUrl: string | null;
};

type Sport = {
  id: number;
  name: string;
  slug: string;
};

export default function MyKingdomPage() {
  const [fan, setFan] = useState<FanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mySports, setMySports] = useState<Sport[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch(
          "/api/profile",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (active && data.user) {
          setFan(data.user);
        }
      } catch (error) {
        console.error(
          "Unable to load kingdom profile:",
          error
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    async function loadMySports() {
     try {
       const response = await fetch("/api/sports", {
         cache: "no-store",
       });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load your sports.");
      }

      if (!active) return;

       const followedIds: number[] = data.followedSportIds ?? [];

       const followedSports: Sport[] = (data.sports ?? []).filter(
        (sport: Sport) => followedIds.includes(sport.id)
      );

      setMySports(followedSports);
    } catch (error) {
      console.error("Unable to load saved sports:", error);
    } finally {
      if (active) {
       setSportsLoading(false);
     }
    }
  }


    loadProfile();
    loadMySports();

    return () => {
      active = false;
    };
  }, []);

  
  const displayName =
    fan?.name?.trim() ||
    fan?.username ||
    fan?.email?.split("@")[0] ||
    "SportyFanz Fan";

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const fanLevel =
    fan?.fanLevel
      ?.replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      ) || "New Fan";

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <span>YOUR PROFILE</span>

            <h1>My Kingdom</h1>

            <p>
              Loading your fan kingdom...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!fan) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <span>YOUR PROFILE</span>

            <h1>My Kingdom</h1>

            <p>
              We couldn't load your fan profile.
              Please log in again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <span>YOUR PROFILE</span>

          <h1>My Kingdom</h1>

          <p>
            Your fan identity, stats, achievements and
            sports world.
          </p>
        </div>
      </div>

      {/* PROFILE */}
      <div className="kingdom-layout">

        <div className="kingdom-profile">

          <div className="kingdom-cover" />

          <div className="kingdom-profile-body">

            <div className="kingdom-avatar">
              {initials}
            </div>

            <div className="kingdom-name">

              <h2>{displayName}</h2>

              <span>
                <Shield size={14} />
                {fanLevel}
              </span>

            </div>

            <button
              className="outline-button"
              type="button"
            >
              Edit Profile
            </button>

          </div>

          {/* REAL DATABASE STATS */}
          <div className="kingdom-stats">

            <div>
              <span>Fan Score</span>

              <strong>
                {fan.totalPoints.toLocaleString()}
              </strong>
            </div>

            <div>
              <span>Current Points</span>

              <strong>
                {fan.currentPoints.toLocaleString()}
              </strong>
            </div>

            <div>
              <span>Matches Watched</span>

              <strong>
                {fan.matchesWatched}
              </strong>
            </div>

            <div>
              <span>Fan Level</span>

              <strong>
                {fanLevel}
              </strong>
            </div>

          </div>

        </div>

        {/* KINGDOM DETAILS */}
        <div className="kingdom-main-grid">

          {/* MY SPORTS */}
          <div className="white-panel">

            <div className="panel-title">
              <h3>My Sports</h3>
            </div>

           <div className="sports-grid">
               {sportsLoading ? (
            <p>Loading your sports...</p>
          ) : mySports.length > 0 ? (
          mySports.map((sport) => {
         const sportIcons: Record<string, string> = {
          football: "⚽",
          basketball: "🏀",
          tennis: "🎾",
          boxing: "🥊",
          cricket: "🏏",
          rugby: "🏉",
          volleyball: "🏐",
          baseball: "⚾",
          badminton: "🏸",
          "formula-1": "🏎️",
           athletics: "🏃",
         };

        return (
         <div className="my-sport" key={sport.id}>
            <div>{sportIcons[sport.slug] ?? "🏆"}</div>

                <strong>{sport.name}</strong>

                <span>Your selected sport</span>
             </div>
              );
              })
              ) : (
                 <div>
                   <p>You haven't selected any sports yet.</p>
                   <a href="/choose-sports">Choose your sports</a>
                </div>
              )}
            </div>
          </div>

          {/* FAN ACTIVITY */}
          <div className="white-panel">

            <div className="panel-title">
              <h3>My Fan Activity</h3>
            </div>

            <div className="achievement-grid">

              <div className="achievement">
                <div>
                  <Trophy size={22} />
                </div>

                <strong>
                  {fan.totalPoints.toLocaleString()}
                </strong>

                <span>
                  Total Fan Points
                </span>
              </div>

              <div className="achievement">
                <div>
                  <Activity size={22} />
                </div>

                <strong>
                  {fan.matchesWatched}
                </strong>

                <span>
                  Matches Watched
                </span>
              </div>

              <div className="achievement">
                <div>
                  <Target size={22} />
                </div>

                <strong>
                  {fan.challengesCompleted}
                </strong>

                <span>
                  Challenges Completed
                </span>
              </div>

              <div className="achievement">
                <div>
                  <MessageCircle size={22} />
                </div>

                <strong>
                  {fan.fanRoomsJoined}
                </strong>

                <span>
                  Fan Rooms Joined
                </span>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}