"use client";

import { useState } from "react";

import type { ClubProfile } from "./profile-types";
import ClubStatistics from "./club-statistics";

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
  "Squad",
  "Competitions",
  "Statistics",
] as const;

type ClubTab = typeof TABS[number];

export default function ClubProfileView({
  profile,
}: {
  profile: ClubProfile;
}) {
  const [active, setActive] =
    useState<ClubTab>("Overview");

  const subtitle = [
    profile.sportName,
    profile.city,
    profile.country,
  ].filter(Boolean).join(" · ");

  const location = [
    profile.city,
    profile.country,
  ].filter(Boolean).join(", ");

  const overviewFacts = [
    location
      ? `${profile.name} is based in ${location}.`
      : null,
    profile.sportName
      ? `Sport: ${profile.sportName}.`
      : null,
    profile.foundedYear !== null
      ? `Founded in ${profile.foundedYear}.`
      : null,
    profile.stadiumName
      ? `Home venue: ${profile.stadiumName}.`
      : null,
    profile.stadiumCapacity !== null
      ? `Recorded venue capacity: ${
          profile.stadiumCapacity.toLocaleString("en-GB")
        }.`
      : null,
  ].filter(Boolean).join(" ");

  return (
    <>
      <ProfileHero
        type="club"
        name={profile.name}
        imageUrl={profile.logoUrl}
        coverUrl={profile.coverUrl}
        subtitle={subtitle}
        description={profile.nickname}
      />

      <ProfileTabs<ClubTab>
        tabs={TABS}
        active={active}
        onChange={setActive}
      />

      <div className="discovery-profile-content">
        {active === "Overview" && (
          <>
            <ProfileSection title="About the Club">
              {profile.overview?.trim() ? (
                <p className="discovery-profile-prose">
                  {profile.overview}
                </p>
              ) : overviewFacts ? (
                <>
                  <p className="discovery-profile-prose">
                    {overviewFacts}
                  </p>
                  <p className="discovery-profile-note">
                    Summary based on available club information.
                  </p>
                </>
              ) : (
                <ProfileEmpty>
                  Club overview is not available yet.
                </ProfileEmpty>
              )}

              <ProfileWebsite
                url={profile.websiteUrl}
              />
            </ProfileSection>

            <ProfileSection title="Club Information">
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
                    label: "Nickname",
                    value: profile.nickname,
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
                    label: "City",
                    value: profile.city,
                  },
                  {
                    label: "Founded",
                    value: profile.foundedYear,
                  },
                  {
                    label: "Home Stadium",
                    value: profile.stadiumName,
                  },
                  {
                    label: "Stadium Capacity",
                    value:
                      profile.stadiumCapacity !== null
                        ? profile.stadiumCapacity.toLocaleString(
                            "en-GB"
                          )
                        : null,
                  },
                ]}
              />
            </ProfileSection>

            <div className="discovery-profile-summary">
              <button
                type="button"
                onClick={() => setActive("Squad")}
              >
                <strong>{profile.squad.length}</strong>
                <span>Listed Squad Members</span>
              </button>

              <button
                type="button"
                onClick={() => setActive("Competitions")}
              >
                <strong>{profile.competitions.length}</strong>
                <span>Recorded Competitions</span>
              </button>
            </div>
          </>
        )}

        {active === "Squad" && (
          <ProfileSection
            title={`Squad Members (${profile.squad.length})`}
          >
            {profile.squad.length === 0 ? (
              <ProfileEmpty>
                No published squad members are available yet.
              </ProfileEmpty>
            ) : (
              <div className="discovery-profile-related-list">
                {profile.squad.map(player => (
                  <ProfileRelatedLink
                    key={player.id}
                    type="player"
                    slug={player.slug}
                    name={player.name}
                    imageUrl={player.avatarUrl}
                    subtitle={[
                      player.position,
                      player.nationality,
                    ].filter(Boolean).join(" · ")}
                    detail={
                      player.jerseyNumber !== null
                        ? `Jersey #${player.jerseyNumber}`
                        : undefined
                    }
                  />
                ))}
              </div>
            )}

            <p className="discovery-profile-note">
              Squad information reflects published
              records available on SportyFanz.
            </p>
          </ProfileSection>
        )}

        {active === "Statistics" && (
          <ClubStatistics profile={profile} />
        )}

        {active === "Competitions" && (
          <ProfileSection title="Competition Affiliations">
            {profile.competitions.length === 0 ? (
              <ProfileEmpty>
                No published competition affiliations
                are available yet.
              </ProfileEmpty>
            ) : (
              <div className="discovery-profile-affiliations">
                {profile.competitions.map(competition => (
                  <article
                    key={competition.id}
                    className="discovery-profile-affiliation"
                  >
                    <ProfileRelatedLink
                      type="competition"
                      slug={competition.slug}
                      name={competition.name}
                      imageUrl={competition.logoUrl}
                      subtitle={[
                        competition.competitionType,
                        competition.country,
                      ].filter(Boolean).join(" · ")}
                    />

                    <div className="discovery-profile-seasons">
                      {competition.seasons.map(season => (
                        <span
                          key={season.id}
                          className={
                            season.isCurrent
                              ? "current"
                              : ""
                          }
                        >
                          {season.name}
                          {season.isCurrent
                            ? " · Current season"
                            : ""}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p className="discovery-profile-note">
              Affiliations reflect recorded competition
              memberships and may not represent the
              club&apos;s complete competition history.
            </p>
          </ProfileSection>
        )}
      </div>
    </>
  );
}
