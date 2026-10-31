
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Target,
  MessageCircle,
  Activity,
  Camera,
  LogOut,
  Crown,
  Star,
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

const AVATARS = [
  "/avatars/fan-1.svg",
  "/avatars/fan-2.svg",
  "/avatars/fan-3.svg",
  "/avatars/fan-4.svg",
  "/avatars/fan-5.svg",
  "/avatars/fan-6.svg",
];

export default function Profile() {
  const router = useRouter();

  const [fan, setFan] = useState<FanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load profile.");
        }

        const data = await response.json();

        if (active && data.user) {
          setFan(data.user);
        }
      } catch (error) {
        console.error("Profile loading error:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  const displayName =
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

  const fanLevel = (fan?.fanLevel || "NEW_FAN")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const previewAvatar =
    selectedAvatar || fan?.avatarUrl || null;

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
  }

  async function handleSaveAvatar() {
    if (
      !selectedAvatar ||
      selectedAvatar === fan?.avatarUrl ||
      savingAvatar
    ) {
      return;
    }

    setSavingAvatar(true);
    setAvatarMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarUrl: selectedAvatar,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save avatar."
        );
      }

      setFan((current) =>
        current
          ? { ...current, avatarUrl: data.avatarUrl }
          : current
      );

      setSelectedAvatar("");

      window.dispatchEvent(
        new Event("sportyfanz:profile-updated")
      );

      setAvatarMessage("Your avatar has been updated.");
    } catch (error) {
      setAvatarMessage(
        error instanceof Error
          ? error.message
          : "Unable to save avatar."
      );
    } finally {
      setSavingAvatar(false);
    }
  }

  if (loading) {
    return (
      <div className="sf-profile-page">
        <div className="sf-profile-loading">
          Loading your fan profile...
        </div>
      </div>
    );
  }

  if (!fan) {
    return (
      <div className="sf-profile-page">
        <div className="sf-profile-empty">
          <h2>Profile unavailable</h2>
          <p>We couldn't load your fan profile.</p>
          <button onClick={() => router.refresh()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sf-profile-page">

      {/* PAGE HEADING */}
      <div className="sf-profile-heading">
        <div>
          <span className="sf-profile-eyebrow">
            YOUR SPORTYFANZ ACCOUNT
          </span>
          <h1>My Profile</h1>
          <p>Your fan identity, points and activity.</p>
        </div>
      </div>

      {/* PROFILE BANNER */}
      <section className="sf-profile-hero">

        <div className="sf-profile-hero-content">

          <div className="sf-profile-main-avatar">
            {previewAvatar ? (
              <img src={previewAvatar} alt="Fan avatar" />
            ) : (
              <span>{initials || "S"}</span>
            )}
          </div>

          <div className="sf-profile-hero-details">

            <span className="sf-profile-member-label">
              <Crown size={14} />
              SPORTYFANZ MEMBER
            </span>

            <h2>{displayName}</h2>

            <p>
              <Star size={15} />
              {fanLevel}
            </p>

            <div className="sf-profile-hero-stats">
              <span>
                <strong>
                  {fan.totalPoints.toLocaleString()}
                </strong>
                Total fan points
              </span>

              <span>
                <strong>
                  {fan.matchesWatched.toLocaleString()}
                </strong>
                Matches watched
              </span>
            </div>

          </div>

          <button
            type="button"
            className="sf-profile-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={16} />
            {loggingOut ? "Logging out..." : "Log out"}
          </button>

        </div>
      </section>

      {/* AVATAR SELECTION */}
      <section className="sf-profile-panel">

        <div className="sf-profile-panel-heading">
          <div className="sf-profile-heading-icon">
            <Camera size={19} />
          </div>

          <div>
            <h2>Choose your avatar</h2>
            <p>Choose a SportyFanz avatar to represent you.</p>
          </div>
        </div>

        <div className="sf-avatar-options">

          {AVATARS.map((avatar) => {
            const isSelected =
              (selectedAvatar || fan.avatarUrl) === avatar;

            return (
              <button
                key={avatar}
                type="button"
                className={`sf-avatar-option ${
                  isSelected ? "selected" : ""
                }`}
                onClick={() => {
                  setSelectedAvatar(avatar);
                  setAvatarMessage("");
                }}
                aria-label={`Select ${avatar.split("/").pop()}`}
                aria-pressed={isSelected}
              >
                <img src={avatar} alt="" />

                {isSelected && (
                  <span className="sf-avatar-check">
                    ✓
                  </span>
                )}
              </button>
            );
          })}

        </div>

        <div className="sf-avatar-save-row">

          <span className="sf-avatar-help">
            {selectedAvatar
              ? "Your new avatar is ready to save."
              : "Your current avatar is selected."}
          </span>

          <button
            type="button"
            className="sf-avatar-save"
            onClick={handleSaveAvatar}
            disabled={
              !selectedAvatar ||
              selectedAvatar === fan.avatarUrl ||
              savingAvatar
            }
          >
            {savingAvatar ? "Saving..." : "Save Avatar"}
          </button>

        </div>

        {avatarMessage && (
          <p className="sf-avatar-message" role="status">
            {avatarMessage}
          </p>
        )}

      </section>

      {/* POINTS SUMMARY */}
      <section className="sf-profile-stats-grid">

        <div className="sf-profile-stat-card">
          <div className="sf-stat-icon gold">
            <Trophy size={21} />
          </div>
          <span>Total Fan Points</span>
          <strong>
            {fan.totalPoints.toLocaleString()}
          </strong>
          <small>Your accumulated fan points</small>
        </div>

        <div className="sf-profile-stat-card">
          <div className="sf-stat-icon green">
            <Star size={21} />
          </div>
          <span>Current Points</span>
          <strong>
            {fan.currentPoints.toLocaleString()}
          </strong>
          <small>Your available points balance</small>
        </div>

        <div className="sf-profile-stat-card">
          <div className="sf-stat-icon blue">
            <Activity size={21} />
          </div>
          <span>Matches Watched</span>
          <strong>
            {fan.matchesWatched.toLocaleString()}
          </strong>
          <small>Your match activity</small>
        </div>

      </section>

      {/* FAN KINGDOM */}
      <section className="sf-profile-panel sf-kingdom-panel">

        <div className="sf-profile-panel-heading">
          <div className="sf-profile-heading-icon kingdom">
            <Crown size={19} />
          </div>

          <div>
            <h2>My Fan Kingdom</h2>
            <p>Your journey as a SportyFanz supporter.</p>
          </div>
        </div>

        <div className="sf-kingdom-level">
          <div>
            <span>YOUR CURRENT RANK</span>
            <h3>{fanLevel}</h3>
          </div>

          <div className="sf-kingdom-badge">
            <Crown size={25} />
          </div>
        </div>

        <div className="sf-kingdom-activity">

          <div className="sf-kingdom-activity-item">
            <Target size={19} />
            <div>
              <strong>
                {fan.challengesCompleted.toLocaleString()}
              </strong>
              <span>Challenges completed</span>
            </div>
          </div>

          <div className="sf-kingdom-activity-item">
            <Activity size={19} />
            <div>
              <strong>
                {fan.matchesWatched.toLocaleString()}
              </strong>
              <span>Matches watched</span>
            </div>
          </div>

          <div className="sf-kingdom-activity-item">
            <MessageCircle size={19} />
            <div>
              <strong>
                {fan.fanRoomsJoined.toLocaleString()}
              </strong>
              <span>Fan Rooms joined</span>
            </div>
          </div>

        </div>

      </section>

    </div>
  );
}
