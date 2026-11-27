"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

import {
  ChevronRight,
  ExternalLink,
  Shield,
  UserRound,
  Trophy,
} from "lucide-react";

import {
  profileHref,
  type ProfileType,
} from "./profile-types";

export function safeHttpsUrl(
  value?: string | null
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function ProfileIcon({
  type,
}: {
  type: ProfileType;
}) {
  if (type === "player") {
    return <UserRound aria-hidden="true" />;
  }

  if (type === "competition") {
    return <Trophy aria-hidden="true" />;
  }

  return <Shield aria-hidden="true" />;
}

export function ProfileImage({
  type,
  url,
  large = false,
}: {
  type: ProfileType;
  url?: string | null;
  large?: boolean;
}) {
  const safeUrl = safeHttpsUrl(url);

  const [failedUrl, setFailedUrl] =
    useState<string | null>(null);

  return (
    <div
      className={[
        "discovery-profile-image",
        `discovery-profile-image-${type}`,
        large ? "discovery-profile-image-large" : "",
      ].filter(Boolean).join(" ")}
    >
      {safeUrl && failedUrl !== safeUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeUrl}
          alt=""
          onError={() => setFailedUrl(safeUrl)}
        />
      ) : (
        <ProfileIcon type={type} />
      )}
    </div>
  );
}

export function ProfileHero({
  type,
  name,
  imageUrl,
  coverUrl,
  subtitle,
  description,
}: {
  type: ProfileType;
  name: string;
  imageUrl?: string | null;
  coverUrl?: string | null;
  subtitle?: string;
  description?: string | null;
}) {
  const cover = safeHttpsUrl(coverUrl);

  const [failedCover, setFailedCover] =
    useState<string | null>(null);

  return (
    <header className="discovery-profile-hero">
      <div className="discovery-profile-cover">
        {cover && failedCover !== cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            onError={() => setFailedCover(cover)}
          />
        )}
      </div>

      <div className="discovery-profile-identity">
        <ProfileImage
          type={type}
          url={imageUrl}
          large
        />

        <div>
          <span className="discovery-profile-eyebrow">
            {type === "club"
              ? "CLUB PROFILE"
              : type === "player"
                ? "PLAYER PROFILE"
                : "COMPETITION PROFILE"}
          </span>

          <h1>{name}</h1>

          {subtitle && <p>{subtitle}</p>}

          {description && (
            <span className="discovery-profile-nickname">
              {description}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

export function ProfileTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <nav
      className="discovery-profile-tabs"
      aria-label="Profile sections"
    >
      {tabs.map(tab => (
        <button
          key={tab}
          type="button"
          aria-pressed={active === tab}
          className={active === tab ? "active" : ""}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}

export function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="white-panel discovery-profile-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ProfileFacts({
  facts,
}: {
  facts: {
    label: string;
    value: string | number | null | undefined;
  }[];
}) {
  const available = facts.filter(
    item =>
      item.value !== null &&
      item.value !== undefined &&
      String(item.value).trim() !== ""
  );

  if (!available.length) {
    return (
      <ProfileEmpty>
        Additional details are not available yet.
      </ProfileEmpty>
    );
  }

  return (
    <dl className="discovery-profile-facts">
      {available.map(item => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileEmpty({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <p className="discovery-profile-empty">
      {children}
    </p>
  );
}

export function ProfileWebsite({
  url,
}: {
  url?: string | null;
}) {
  const safeUrl = safeHttpsUrl(url);

  if (!safeUrl) return null;

  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="discovery-profile-website"
    >
      Official Website
      <ExternalLink size={15} aria-hidden="true" />
    </a>
  );
}

export function ProfileRelatedLink({
  type,
  slug,
  name,
  imageUrl,
  subtitle,
  detail,
}: {
  type: ProfileType;
  slug: string;
  name: string;
  imageUrl?: string | null;
  subtitle?: string;
  detail?: string;
}) {
  return (
    <Link
      href={profileHref(type, slug)}
      className="discovery-profile-related"
    >
      <ProfileImage
        type={type}
        url={imageUrl}
      />

      <div className="discovery-profile-related-text">
        <strong>{name}</strong>

        {subtitle && <span>{subtitle}</span>}

        {detail && <small>{detail}</small>}
      </div>

      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}
