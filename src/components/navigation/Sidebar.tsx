"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

import {
  Award,
  ChevronRight,
  Crown,
  Gift,
  Home,
  MessageCircle,
  Newspaper,
  Radio,
  Search,
  Settings,
  Target,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

const navItems = [
  {
    label: "Home",
    href: "/app",
    icon: Home,
  },
  {
    label: "Live & Matches",
    href: "/app/live",
    icon: Radio,
  },
  {
    label: "Participate",
    href: "/app/participate",
    icon: Target,
  },
  {
    label: "Discover",
    href: "/app/discover",
    icon: Search,
  },
  {
  label: "News",
  href: "/app/news",
  icon: Newspaper,
  },
  {
    label: "My Kingdom",
    href: "/app/kingdom",
    icon: Crown,
  },
  {
    label: "Fan Rooms",
    href: "/app/fanroom",
    icon: MessageCircle,
  },
  {
    label: "Rewards",
    href: "/app/rewards",
    icon: Gift,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

const [fanName, setFanName] = useState("SportyFanz Fan");
const [fanLevel, setFanLevel] = useState("NEW FAN");
const [fanInitials, setFanInitials] = useState("S");

useEffect(() => {
  let active = true;

  async function loadFan() {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

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
      setFanLevel(
        user.fanLevel?.replace(/_/g, " ") || "NEW FAN"
      );

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
      console.error("Unable to load sidebar profile:", error);
    }
  }

  loadFan();

  return () => {
    active = false;
  };
}, []);

  return (
    <aside className="sf-sidebar">
      {/* LOGO */}
      <div className="sf-logo">
        <Logo small />
      </div>

      <div className="sf-sidebar-divider" />

      {/* MAIN NAVIGATION */}
      <nav className="sf-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          const active =
            item.href === "/app"
            ? pathname === "/app"
            : pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`sf-nav-item ${
                active ? "active" : ""
              }`}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* COMMUNITY */}
      <div className="sf-sidebar-section">
        <div className="sf-sidebar-label">
          COMMUNITY
        </div>

        <Link
          href="/app/participate"
          className="sf-nav-item"
        >
          <Award size={17} />
          <span>Challenges</span>
        </Link>

        <Link
          href="/app/leaderboard"
          className="sf-nav-item"
        >
         <Trophy size={17} />
         <span>Leaderboards</span>
        </Link>
      </div>
    </aside>
  );
}