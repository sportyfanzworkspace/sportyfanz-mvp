import Link from "next/link";
import { Icon } from "@/lib/icons";

export function SectionHeader({
  title,
  href = "#"
}: {
  title: string;
  href?: string;
}) {
  return (
    <div className="section-head">

      <h2>
        {title}
      </h2>

      <Link href={href}>
        View all
        <Icon
          name="arrow"
          size={15}
        />
      </Link>

    </div>
  );
}

export function LiveBadge() {
  return (
    <span className="live-badge">
      <i />
      LIVE
    </span>
  );
}

export function MatchRow({
  home,
  away,
  score,
  time,
  league,
  live = true
}: {
  home: string;
  away: string;
  score: string;
  time: string;
  league: string;
  live?: boolean;
}) {
  return (
    <div className="match-row">

      <div className="match-league">
        {league}
      </div>

      <div className="team">
        {home}
      </div>

      <strong>
        {score}
      </strong>

      <div className="team">
        {away}
      </div>

      <span
        className={
          live
            ? "match-time live-time"
            : "match-time"
        }
      >
        {time}
      </span>

      {live && <LiveBadge />}

    </div>
  );
}

export function StatBar({
  label,
  left,
  right,
  leftValue
}: {
  label: string;
  left: string;
  right: string;
  leftValue: number;
}) {
  return (
    <div className="stat">

      <div className="stat-label">

        <span>
          {left}
        </span>

        <b>
          {label}
        </b>

        <span>
          {right}
        </span>

      </div>

      <div className="bar">
        <i
          style={{
            width: `${leftValue}%`
          }}
        />
      </div>

    </div>
  );
}