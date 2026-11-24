"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Gift,
  Package,
  Plus,
  Radio,
  ShoppingBag,
  Target,
  Ticket,
} from "lucide-react";

import Link from "next/link";

import {
  matches,
  fanMessages,
} from "./data/site";


// ======================================================
// PAGE HEADER
// ======================================================

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-header">
      <div>
        <span>{eyebrow}</span>

        <h1>{title}</h1>

        <p>{description}</p>
      </div>

      <div className="header-actions">
        <button
          className="secondary-button"
          type="button"
        >
          <CalendarDays size={15} />

          Today

          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}


// ======================================================
// SECTION TITLE
// ======================================================

export function SectionTitle({
  title,
  action,
  href,
}: {
  title: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>

      {action &&
        (href ? (
          <Link href={href}>
            {action}
            <ChevronRight size={14} />
          </Link>
        ) : (
          <button type="button">
            {action}
            <ChevronRight size={14} />
          </button>
        ))}
    </div>
  );
}


// ======================================================
// PANEL TITLE
// ======================================================

export function PanelTitle({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
  return (
    <div className="panel-title">
      <h3>{title}</h3>

      {action && (
        <button type="button">
          {action}
          <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}


// ======================================================
// FAN KINGDOM CARD
// ======================================================

export function FanKingdomCard() {
  return (
    <div className="fan-kingdom-card">

      <div className="kingdom-card-header">

        <div className="sf-avatar large">
          E
        </div>

        <div>
          <span>Fan Kingdom</span>
          <strong>Esther</strong>
        </div>

        <ChevronDown size={16} />

      </div>

      <div className="kingdom-card-stats">

        <div>
          <span>Fan Score</span>
          <strong>12,840</strong>
        </div>

        <div>
          <span>Sports IQ</span>
          <strong>87</strong>
        </div>

        <div className="add-score">
          <Plus size={17} />
        </div>

      </div>

      <Link
        className="kingdom-card-link"
        href="/kingdom"
      >
        View My Kingdom
      </Link>

    </div>
  );
}


// ======================================================
// MATCH CARD
// ======================================================

export function MatchCard({
  match,
}: {
  match: (typeof matches)[number];
}) {
  return (
    <div className="match-card">

      <div
        className="match-card-image"
        style={{
          backgroundImage: `url("${match.image}")`,
        }}
      >
        <span className="live-pill">
          <span />
          LIVE
        </span>

        <span className="match-card-time">
          {match.time}
        </span>
      </div>

      <div className="match-card-body">

        <div className="match-card-teams">
          <strong>{match.home}</strong>

          <span>{match.score}</span>

          <strong>{match.away}</strong>
        </div>

        <div className="match-card-footer">

          <small>{match.league}</small>

          <Link href="/live">
            Watch
          </Link>

        </div>

      </div>

    </div>
  );
}


// ======================================================
// FAN CHALLENGES
// ======================================================

export function FanChallengesCard() {
  return (
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
  );
}


// ======================================================
// TRENDING ROOMS
// ======================================================

export function TrendingRoomsCard() {
  const rooms = [
    ["Arsenal Fans", "5.2K fans", "🔥"],
    ["Football Fans", "3.8K fans", "⚽"],
    ["Premier League", "2.9K fans", "🏆"],
  ];

  return (
    <div className="white-panel trending-rooms">

      <PanelTitle
        title="Trending in Fan Rooms"
        action="View All"
      />

      {rooms.map(
        ([name, count, icon]) => (
          <Link
            className="room-row"
            href="/fanroom"
            key={name}
          >
            <div className="room-icon">
              {icon}
            </div>

            <div>
              <strong>{name}</strong>
              <span>{count}</span>
            </div>

            <ChevronRight size={15} />
          </Link>
        ),
      )}

    </div>
  );
}


// ======================================================
// TIMELINE ITEM
// ======================================================

export function TimelineItem({
  minute,
  icon,
  title,
  player,
}: {
  minute: string;
  icon: string;
  title: string;
  player: string;
}) {
  return (
    <div className="timeline-item">

      <span className="timeline-minute">
        {minute}
      </span>

      <div className="timeline-icon">
        {icon}
      </div>

      <div>
        <strong>{title}</strong>
        <span>{player}</span>
      </div>

    </div>
  );
}


// ======================================================
// STAT BAR
// ======================================================

export function StatBar({
  label,
  home,
  away,
}: {
  label: string;
  home: string;
  away: string;
}) {
  const homeValue =
    Number.parseInt(
      home.replace("%", ""),
      10,
    ) || 0;

  const awayValue =
    Number.parseInt(
      away.replace("%", ""),
      10,
    ) || 0;

  const total =
    homeValue + awayValue;

  const homeWidth = total
    ? (homeValue / total) * 100
    : 50;

  return (
    <div className="stat-bar">

      <div className="stat-values">

        <strong>{home}</strong>

        <span>{label}</span>

        <strong>{away}</strong>

      </div>

      <div className="stat-track">
        <span
          style={{
            width: `${homeWidth}%`,
          }}
        />
      </div>

    </div>
  );
}


// ======================================================
// FAN MESSAGE
// ======================================================

export function FanMessage({
  message,
}: {
  message: (typeof fanMessages)[number];
}) {
  return (
    <div className="fan-message">

      <div className="sf-avatar small">
        {message.avatar}
      </div>

      <div>

        <div className="fan-message-head">
          <strong>{message.user}</strong>
          <span>{message.time}</span>
        </div>

        <p>{message.text}</p>

      </div>

    </div>
  );
}


// ======================================================
// REWARDS BALANCE
// ======================================================

export function RewardsBalance() {
  return (
    <div className="rewards-balance">

      <div>
        <span>
          AVAILABLE SPORTY POINTS
        </span>

        <strong>
          12,840
        </strong>

        <small>
          +420 this week
        </small>
      </div>

      <div className="balance-icon">
        <CircleDollarSign size={35} />
      </div>

    </div>
  );
}


// ======================================================
// REWARD CARDS
// ======================================================

export function RewardCards() {
  const rewards = [
    {
      icon: Ticket,
      title: "Match Ticket",
      desc: "Arsenal vs Chelsea",
      points: "5,000 pts",
    },

    {
      icon: Package,
      title: "Data Bundle",
      desc: "1GB • MTN",
      points: "2,000 pts",
    },

    {
      icon: ShoppingBag,
      title: "Merchandise",
      desc: "SportyFanz Jersey",
      points: "6,000 pts",
    },

    {
      icon: Gift,
      title: "Food Voucher",
      desc: "Football & Grill",
      points: "3,000 pts",
    },

    {
      icon: Radio,
      title: "Viewing Centre",
      desc: "10% Off",
      points: "1,500 pts",
    },
  ];

  return (
    <div className="reward-grid">

      {rewards.map(
        ({
          icon: Icon,
          title,
          desc,
          points,
        }) => (
          <div
            className="reward-card"
            key={title}
          >

            <div className="reward-image">
              <Icon size={30} />
            </div>

            <div className="reward-info">
              <span>{title}</span>

              <strong>{desc}</strong>

              <small>{points}</small>
            </div>

            <button type="button">
              Redeem
            </button>

          </div>
        ),
      )}

    </div>
  );
}