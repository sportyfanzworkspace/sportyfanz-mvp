"use client";

import { useState } from "react";

import PlayerStatistics from "./player-statistics";

import type { PlayerProfile } from "./profile-types";

import {
  ProfileHero,
  ProfileTabs,
  ProfileSection,
  ProfileFacts,
  ProfileEmpty,
  ProfileRelatedLink,
} from "./profile-ui";

const TABS = [
  "Overview",
  "Career",
  "Statistics",
  "Achievements",
] as const;

type PlayerTab = typeof TABS[number];

function formatDate(
  value: string | null
): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTransferType(
  value: string | null
): string | null {
  if (!value?.trim()) return null;

  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export default function PlayerProfileView({
  profile,
}: {
  profile: PlayerProfile;
}) {
  const [active, setActive] =
    useState<PlayerTab>("Overview");

  const subtitle = [
    profile.sportName,
    profile.nationality,
  ].filter(Boolean).join(" · ");

  const fullName = [
    profile.firstName,
    profile.lastName,
  ].filter(Boolean).join(" ");

  return (
    <>
      <ProfileHero
        type="player"
        name={profile.name}
        imageUrl={profile.avatarUrl}
        subtitle={subtitle}
        description={profile.position}
      />

      <ProfileTabs<PlayerTab>
        tabs={TABS}
        active={active}
        onChange={setActive}
      />

      <div className="discovery-profile-content">

        {active === "Overview" && (
          <>
            <ProfileSection title="About the Player">
              {profile.biography?.trim() ? (
                <p className="discovery-profile-prose">
                  {profile.biography}
                </p>
              ) : (
                <ProfileEmpty>
                  Player biography is not available yet.
                </ProfileEmpty>
              )}
            </ProfileSection>

            <ProfileSection title="Player Information">
              <ProfileFacts
                facts={[
                  {
                    label: "Full Name",
                    value: fullName,
                  },
                  {
                    label: "Sport",
                    value: profile.sportName,
                  },
                  {
                    label: "Nationality",
                    value: profile.nationality,
                  },
                  {
                    label: "Position",
                    value: profile.position,
                  },
                  {
                    label: "Jersey Number",
                    value: profile.jerseyNumber,
                  },
                  {
                    label: "Date of Birth",
                    value: formatDate(profile.dateOfBirth),
                  },
                  {
                    label: "Height",
                    value:
                      profile.heightCm !== null
                        ? `${profile.heightCm} cm`
                        : null,
                  },
                  {
                    label: "Weight",
                    value:
                      profile.weightKg !== null
                        ? `${profile.weightKg} kg`
                        : null,
                  },
                  {
                    label: "Preferred Foot",
                    value: profile.preferredFoot,
                  },
                ]}
              />
            </ProfileSection>

            <ProfileSection title="Current Clubs">
              {profile.currentClubs.length === 0 ? (
                <ProfileEmpty>
                  No published current club memberships
                  are available yet.
                </ProfileEmpty>
              ) : (
                <div className="discovery-profile-related-list">
                  {profile.currentClubs.map(club => (
                    <ProfileRelatedLink
                      key={club.id}
                      type="club"
                      slug={club.slug}
                      name={club.name}
                      imageUrl={club.logoUrl}
                      subtitle={club.sportName ?? undefined}
                    />
                  ))}
                </div>
              )}

              <p className="discovery-profile-note">
                Current clubs reflect published
                membership records on SportyFanz.
              </p>
            </ProfileSection>

            <div className="discovery-profile-summary">
              <button
                type="button"
                onClick={() => setActive("Career")}
              >
                <strong>
                  {profile.careerHistory.length}
                </strong>
                <span>Recorded Career Periods</span>
              </button>

              <button
                type="button"
                onClick={() => setActive("Achievements")}
              >
                <strong>
                  {profile.achievements?.trim()
                    ? "View"
                    : "—"}
                </strong>
                <span>Achievements</span>
              </button>
            </div>
          </>
        )}

        {active === "Career" && (
          <ProfileSection title="Career History">
            {profile.careerHistory.length === 0 ? (
              <ProfileEmpty>
                No published career history is
                available yet.
              </ProfileEmpty>
            ) : (
              <div className="discovery-public-career-timeline">
                {profile.careerHistory.map(record => {
                  const joined = formatDate(
                    record.joinedAt
                  );

                  const left = formatDate(
                    record.leftAt
                  );

                  const transfer = formatTransferType(
                    record.transferType
                  );

                  const openPeriod =
                    record.leftAt === null;

                  return (
                    <article
                      key={record.id}
                      className="discovery-public-career-period"
                    >
                      <ProfileRelatedLink
                        type="club"
                        slug={record.clubSlug}
                        name={record.clubName}
                        imageUrl={record.clubLogoUrl}
                        subtitle={[
                          record.position,
                          record.jerseyNumber !== null
                            ? `Jersey #${record.jerseyNumber}`
                            : null,
                        ].filter(Boolean).join(" · ")}
                      />

                      <div className="discovery-public-career-period-details">
                        <span
                          className={
                            openPeriod
                              ? "discovery-public-career-status current"
                              : "discovery-public-career-status"
                          }
                        >
                          {openPeriod
                            ? "Open career period"
                            : "Completed period"}
                        </span>

                        <ProfileFacts
                          facts={[
                            {
                              label: "Joined",
                              value:
                                joined ?? "Not recorded",
                            },
                            {
                              label: "Left",
                              value:
                                openPeriod
                                  ? "Not recorded"
                                  : left ?? "Date unavailable",
                            },
                            {
                              label: "Transfer Type",
                              value: transfer,
                            },
                          ]}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <p className="discovery-profile-note">
              Career history reflects published records
              available on SportyFanz and may not
              represent the player&apos;s complete career.
              An open career period does not independently
              confirm a current club membership.
            </p>
          </ProfileSection>
        )}

        {active === "Statistics" && (
          <ProfileSection title="Player Statistics">
            <PlayerStatistics
              statistics={profile.statistics ?? []}
            />
          </ProfileSection>
        )}

        {active === "Achievements" && (
          <ProfileSection title="Achievements and Honours">
            {profile.achievements?.trim() ? (
              <p className="discovery-profile-prose">
                {profile.achievements}
              </p>
            ) : (
              <ProfileEmpty>
                Player achievements have not been
                recorded yet.
              </ProfileEmpty>
            )}
          </ProfileSection>
        )}

      </div>
    </>
  );
}
