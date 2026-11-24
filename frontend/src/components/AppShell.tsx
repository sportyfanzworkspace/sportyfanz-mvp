"use client";

import { apiFetch } from "@/lib/api";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";


import {
  Bell,
  ChevronRight,
  Crown,
  Gift,
  Home,
  MessageCircle,
  Menu,
  Radio,
  Search,
  Target,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

import Sidebar from "./navigation/Sidebar";
import { Logo } from "./Logo";
import SearchBar from "./topbar/search-bar";
import Notifications from "./topbar/notification";
import ThemeToggle from "./topbar/theme-toggle";
import UserProfile from "./topbar/userProfile";


type Props = {
  children: ReactNode;
};

const navItems = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Live & Matches",
    href: "/live",
    icon: Radio,
  },
  {
    label: "Participate",
    href: "/participate",
    icon: Target,
  },
  {
    label: "Discover",
    href: "/discover",
    icon: Search,
  },
  {
    label: "My Kingdom",
    href: "/kingdom",
    icon: Crown,
  },
  {
    label: "Fan Rooms",
    href: "/fanroom",
    icon: MessageCircle,
  },
  {
    label: "Rewards",
    href: "/rewards",
    icon: Gift,
  },
];

export default function SportyFanzShell({
  children,
}: Props) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function verifyFanAccount() {
    try {
      const response = await apiFetch("/api/auth/me", {
        cache: "no-store",
      });

      if (cancelled) return;

      setIsAuthenticated(response.ok);
    } catch {
      if (!cancelled) {
        setIsAuthenticated(false);
      }
    }
  }

  void verifyFanAccount();

  return () => {
    cancelled = true;
  };
 }, [pathname]);

    useEffect(() => {
    const INACTIVITY_LIMIT = 10 * 60 * 1000;
    let timeout: ReturnType<typeof setTimeout>;

    if (!isAuthenticated) return;

    const logoutForInactivity = async () => {
      try {
        await apiFetch("/api/auth/logout", {
          method: "POST",
        });
      } finally {
        window.location.replace("/?reason=timeout");
      }
    };

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(
        () => void logoutForInactivity(),
        INACTIVITY_LIMIT
      );
    };

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ] as const;

    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer, {
        passive: true,
      });
    });

    resetTimer();

    return () => {
      clearTimeout(timeout);

      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated]);

  return (
    <main className="sf-app">
      {/* MOBILE SIDEBAR BACKDROP */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="sf-mobile-sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* MAIN AREA */}
      <section className="sf-main">
        {/* TOP BAR */}
        <header className="sf-topbar">
          <button
            type="button"
            className="sf-mobile-menu-toggle"
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={23} />
          </button>

          <Link href="/" className="sf-mobile-brand" aria-label="SportyFanz home">
            <Logo small />
          </Link>

          <SearchBar />

          <div className="sf-top-actions">
            <ThemeToggle />
            <Notifications />
            <UserProfile />
          </div>
        </header>

        {/* PAGE CONTENT — RENDERED ONCE */}


        <div className="sf-content">
          {children}
        </div>

         {/* FOOTER */}


      <footer className="sf-site-footer">
        <div className="sf-footer-top">
         <div className="sf-footer-brand">
      <Logo small />
      <span>Every Sport. Every Fan. Every Moment.</span>
    </div>

    <div className="sf-footer-social">
      <strong>FOLLOW SPORTYFANZ</strong>
      <a href="https://web.facebook.com/sportyfanz1/" target="_blank" rel="noopener noreferrer">Facebook</a>
      <a href="https://x.com/sportyfanz1" target="_blank" rel="noopener noreferrer">X</a>
      <a href="https://www.instagram.com/sportyfanz_official/" target="_blank" rel="noopener noreferrer">Instagram</a>
      <a href="https://www.tiktok.com/@sportyfanz" target="_blank" rel="noopener noreferrer">TikTok</a>
      <a href="https://www.youtube.com/@sportyfanz" target="_blank" rel="noopener noreferrer">YouTube</a>
    </div>

    <p className="sf-footer-message">
      Your passion. Your community. Your rewards.
    </p>

    <nav className="sf-footer-links" aria-label="Footer navigation">
      <Link href="/">Home</Link>
      <Link href="/about">About Us</Link>
      <Link href="/privacy">Privacy Policy</Link>
      <Link href="/kingdom">My Kingdom</Link>
      <Link href="/fanroom">Fan Rooms</Link>
      <Link href="/profile">My Profile</Link>
    </nav>
  </div>

  <div className="sf-footer-bottom">
    <span>© 2026 SportyFanz. The fan is king.</span>
    <span className="sf-footer-tagline">
      Built for the love of sport.
      <span className="sf-footer-dot" />
    </span>
  </div>
</footer>
      </section>
    </main>
  );
}
