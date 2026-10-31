"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";


import {
  Bell,
  ChevronRight,
  Crown,
  Gift,
  Home,
  MessageCircle,
  Radio,
  Search,
  Target,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

import Sidebar from "./navigation/Sidebar";
import SearchBar from "./topbar/search-bar";
import Notifications from "./topbar/notification";
import UserProfile from "./topbar/userProfile";

type Props = {
  children: ReactNode;
};

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


export default function SportyFanzShell({
  children,
}: Props) {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function verifyFanAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!cancelled && response.status === 401) {
          window.location.replace("/login");
        }
      } catch {
        // Keep the page available if a temporary network error occurs.
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

    const logoutForInactivity = async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
        });
      } finally {
        window.location.replace("/login?reason=timeout");
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
  }, []);
  
  return (
    <main className="sf-app">
      {/* SIDEBAR */}
      <Sidebar />

      {/* MAIN AREA */}
      <section className="sf-main">
        {/* TOP BAR */}
        <header className="sf-topbar">
          <SearchBar />

          <div className="sf-top-actions">
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
        <div className="sf-footer-logo">
          <Crown size={23} strokeWidth={2.4} />
       </div>

       <div>
        <strong>SportyFanz</strong>
        <span>Every Sport. Every Fan. Every Moment.</span>
      </div>
    </div>

    <p className="sf-footer-message">
      Your passion. Your community. Your rewards.
    </p>

    <nav className="sf-footer-links" aria-label="Footer navigation">
      <Link href="/app">Home</Link>
      <Link href="/app/kingdom">My Kingdom</Link>
      <Link href="/app/fanroom">Fan Rooms</Link>
      <Link href="/app/profile">My Profile</Link>
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