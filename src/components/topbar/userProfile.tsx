
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  UserRound,
  Crown,
  LoaderCircle,
} from "lucide-react";

type Fan = {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  totalPoints?: number;
  currentPoints?: number;
  fanLevel?: string;
  avatarUrl?: string | null;
};

export default function UserProfile() {
  const router = useRouter();
  const [fan, setFan] = useState<Fan | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
  let active = true;

  async function loadProfile() {
    try {
      const response = await fetch("/api/profile", {
        cache: "no-store",
      });

      if (response.status === 401) {
        if (active) router.replace("/login");
        return;
      }

      if (!response.ok) return;

      const data = await response.json();

      if (active && data.user) {
        setFan(data.user);
      }
    } catch (error) {
      console.error("Unable to load fan profile:", error);
    }
  }

  function handleProfileUpdate() {
    void loadProfile();
  }

  void loadProfile();

  window.addEventListener(
    "sportyfanz:profile-updated",
    handleProfileUpdate
  );

  return () => {
    active = false;
    window.removeEventListener(
      "sportyfanz:profile-updated",
      handleProfileUpdate
    );
  };
}, [router]);

  const displayName =
    fan?.username ||
    fan?.email?.split("@")[0] ||
    fan?.name?.trim() ||
    "SportyFanz Fan";

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "S";

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to log out.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
      alert("We couldn't log you out. Please try again.");
    }
  }

  return (
    <div className="sf-profile-menu">
      <button
        type="button"
        className="sf-profile-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <span className="sf-avatar">
         {fan?.avatarUrl ? (
         <img
          src={fan.avatarUrl}
          alt="Fan avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
        />
        ) : (
         initials
        )}
       </span>

        <span className="sf-profile-identity">
          <strong>{displayName}</strong>
          <span>Fan profile</span>
        </span>

        <ChevronDown
          size={16}
          className={open ? "sf-chevron-open" : ""}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="sf-dropdown-backdrop"
            aria-label="Close profile menu"
            onClick={() => setOpen(false)}
          />

          <div className="sf-profile-dropdown">
            <div className="sf-dropdown-heading">
              <span className="sf-avatar">
                {initials}
              </span>

              <div className="sf-dropdown-user">
                <strong>{displayName}</strong>
                <span>{fan?.email || "Your fan account"}</span>
              </div>
            </div>

            <div className="sf-dropdown-points">
              <Crown size={17} />
              <span>Sporty Points</span>
              <strong>
                {(fan?.totalPoints ?? 0).toLocaleString()}
              </strong>
            </div>

            <div className="sf-dropdown-divider" />

            <Link
              href="/app/profile"
              className="sf-dropdown-item"
              onClick={() => setOpen(false)}
            >
              <UserRound size={17} />
              <span>My Profile</span>
            </Link>

            <button
              type="button"
              className="sf-dropdown-item sf-logout-button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <LoaderCircle size={17} />
              ) : (
                <LogOut size={17} />
              )}

              <span>
                {loggingOut ? "Logging out..." : "Log out"}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}