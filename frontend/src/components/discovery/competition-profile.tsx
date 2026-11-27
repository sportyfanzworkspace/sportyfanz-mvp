"use client";

import { useState } from "react";

import CompetitionStandings from "./competition-standings";

import type {
  CompetitionProfile,
} from "./profile-types";

import {
  ProfileHero,
  ProfileTabs,
  ProfileSection,
  ProfileFacts,
  ProfileEmpty,
  ProfileWebsite,
  ProfileRelatedLink,
} from "./profile-ui";

const TABS = [
  "Overview",
  "Seasons",
  "Clubs",
  "Standings",
] as const;

type CompetitionTab = typeof TABS[number];

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

export default function CompetitionProfileView({
  profile,
}: {
  profile: CompetitionProfile;
}) {
  const [active, setActive] =
    useState<CompetitionTab>("Overview");

  const [selectedSeasonId, setSelectedSeasonId] =
    useState<number | null>(
      profile.seasons.find(
        season => season.isCurrent
      )?.id ??
      profile.seasons[0]?.id ??
      null
    );

  const selectedSeason =
    profile.seasons.find(
      season => season.id === selectedSeasonId
    ) ?? profile.seasons[0] ?? null;

  const currentSeasons = profile.seasons.filter(
    season => season.isCurrent
  );

  const subtitle = [
    profile.sportName,
    profile.country,
  ].filter(Boolean).join(" · ");

  return (
    <>
      <ProfileHero
        type="competition"
        name={profile.name}
        imageUrl={profile.logoUrl}
        coverUrl={profile.coverUrl}
        subtitle={subtitle}
        description={profile.competitionType}
      />

      <ProfileTabs<CompetitionTab>
        tabs={TABS}
        active={active}
        onChange={setActive}
      />

      <div className="discovery-profile-content">

        {active === "Overview" && (
          <>
            <ProfileSection title="About the Competition">
              {profile.description?.trim() ? (
                <p className="discovery-profile-prose">
                  {profile.description}
                </p>
              ) : (
                <ProfileEmpty>
                  Competition information is not
                  available yet.
                </ProfileEmpty>
              )}

              <ProfileWebsite
                url={profile.websiteUrl}
              />
            </ProfileSection>

            <ProfileSection title="Competition Information">
              <ProfileFacts
                facts={[
                  {
                    label: "Full Name",
                    value: profile.name,
                  },
                  {
                    label: "Short Name",
                    value: profile.shortName,
                  },
                  {
                    label: "Sport",
                    value: profile.sportName,
                  },
                  {
                    label: "Country",
                    value: profile.country,
                  },
                  {
                    label: "Competition Type",
                    value: profile.competitionType,
                  },
                  {
                    label: "Founded",
                    value: profile.foundedYear,
                  },
                  {
                    label: "Current Seasons",
                    value:
                      currentSeasons.map(
                        season => season.name
                      ).join(", ") || null,
                  },
                ]}
              />
            </ProfileSection>

            <div className="discovery-profile-summary">
              <button
                type="button"
                onClick={() => setActive("Seasons")}
              >
                <strong>
                  {profile.seasons.length}
                </strong>
                <span>Recorded Seasons</span>
              </button>

              <button
                type="button"
                onClick={() => setActive("Clubs")}
              >
                <strong>
                  {selectedSeason?.clubs.length ?? 0}
                </strong>
                <span>
                  {selectedSeason
                    ? `Listed Clubs · ${selectedSeason.name}`
                    : "Listed Clubs"}
                </span>
              </button>
            </div>
          </>
        )}

        {active === "Seasons" && (
          <ProfileSection title="Competition Seasons">
            {profile.seasons.length === 0 ? (
              <ProfileEmpty>
                No competition seasons have been
                recorded yet.
              </ProfileEmpty>
            ) : (
              <div className="discovery-competition-seasons">
                {profile.seasons.map(season => (
                  <article
                    key={season.id}
                    className="discovery-competition-season"
                  >
                    <div className="discovery-competition-season-header">
                      <h3>{season.name}</h3>

                      {season.isCurrent && (
                        <span className="discovery-competition-current">
                          Current season
                        </span>
                      )}
                    </div>

                    <ProfileFacts
                      facts={[
                        {
                          label: "Start Date",
                          value: formatDate(
                            season.startsAt
                          ),
                        },
                        {
                          label: "End Date",
                          value: formatDate(
                            season.endsAt
                          ),
                        },
                        {
                          label: "Listed Clubs",
                          value: season.clubs.length,
                        },
                      ]}
                    />

                    <button
                      type="button"
                      className="discovery-profile-action"
                      onClick={() => {
                        setSelectedSeasonId(season.id);
                        setActive("Clubs");
                      }}
                    >
                      View Clubs
                    </button>
                  </article>
                ))}
              </div>
            )}

            <p className="discovery-profile-note">
              Seasons reflect records available
              on SportyFanz.
            </p>
          </ProfileSection>
        )}

        {active === "Standings" && (
          <ProfileSection title="Competition Standings">
            <CompetitionStandings
              seasons={profile.seasons}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeasonId}
              sportSlug={profile.sportSlug}
            />
          </ProfileSection>
        )}

        {active === "Clubs" && (
          <ProfileSection title="Participating Clubs">
            {!selectedSeason ? (
              <ProfileEmpty>
                No recorded seasons or participating
                clubs are available yet.
              </ProfileEmpty>
            ) : (
              <>
                <div className="discovery-competition-filter">
                  <label htmlFor="competition-season">
                    Select Season
                  </label>

                  <select
                    id="competition-season"
                    value={selectedSeason.id}
                    onChange={event =>
                      setSelectedSeasonId(
                        Number(event.target.value)
                      )
                    }
                  >
                    {profile.seasons.map(season => (
                      <option
                        key={season.id}
                        value={season.id}
                      >
                        {season.name}
                        {season.isCurrent
                          ? " (Current season)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="discovery-profile-note">
                  {selectedSeason.clubs.length}
                  {" "}published clubs listed for
                  {" "}{selectedSeason.name}.
                </p>

                {selectedSeason.clubs.length === 0 ? (
                  <ProfileEmpty>
                    No published clubs are available
                    for this season yet.
                  </ProfileEmpty>
                ) : (
                  <div className="discovery-profile-related-list">
                    {selectedSeason.clubs.map(club => (
                      <ProfileRelatedLink
                        key={club.id}
                        type="club"
                        slug={club.slug}
                        name={club.name}
                        imageUrl={club.logoUrl}
                        subtitle={
                          club.country ?? undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            <p className="discovery-profile-note">
              Listed clubs reflect published
              competition membership records and
              may not represent the complete list
              of participating clubs.
            </p>
          </ProfileSection>
        )}

      </div>
    </>
  );
}
