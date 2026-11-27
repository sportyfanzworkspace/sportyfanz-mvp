"use client";

import { useState } from "react";

import type {
  ClubProfile,
  ClubStatistic,
} from "./profile-types";

import {
  ProfileEmpty,
  ProfileSection,
} from "./profile-ui";

import {
  columnsForSport,
  groupLabel,
} from "./competition-standings";

export default function ClubStatistics({
  profile,
}: {
  profile: ClubProfile;
}) {
  const [competitionId, setCompetitionId] =
    useState<number | null>(null);

  const [seasonId, setSeasonId] =
    useState<number | null>(null);

  const competitions = profile.competitions.filter(
    item => item.seasons.length > 0
  );

  const competition =
    competitions.find(item => item.id === competitionId) ??
    competitions[0] ??
    null;

  const seasons = competition?.seasons ?? [];

  const season =
    seasons.find(item => item.id === seasonId) ??
    seasons.find(item => item.isCurrent) ??
    seasons[0] ??
    null;

  const rows = (profile.statistics ?? []).filter(
    item => item.seasonId === season?.id
  );

  const columns = columnsForSport(profile.sportSlug);

  function metrics(row: ClubStatistic) {
    const values: {
      label: string;
      value: string | number | null;
    }[] = [
      {
        label: "Ranking",
        value: row.rank,
      },
    ];

    for (const column of columns) {
      switch (column.key) {
        case "played":
        case "won":
        case "drawn":
        case "lost":
        case "scored":
        case "conceded":
        case "difference":
        case "points":
          values.push({
            label: column.description,
            value: row[column.key],
          });
          break;
      }
    }

    return values;
  }

  return (
    <ProfileSection title="Club Statistics">
      {!competition || !season ? (
        <ProfileEmpty>
          No published competition seasons are available yet.
        </ProfileEmpty>
      ) : (
        <>
          <div className="discovery-competition-filter">
            <label htmlFor="club-statistics-competition">
              Competition
            </label>

            <select
              id="club-statistics-competition"
              value={competition.id}
              onChange={event => {
                setCompetitionId(Number(event.target.value));
                setSeasonId(null);
              }}
            >
              {competitions.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="discovery-competition-filter">
            <label htmlFor="club-statistics-season">
              Season
            </label>

            <select
              id="club-statistics-season"
              value={season.id}
              onChange={event =>
                setSeasonId(Number(event.target.value))
              }
            >
              {seasons.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.isCurrent ? " (Current season)" : ""}
                </option>
              ))}
            </select>
          </div>

          {!rows.length ? (
            <ProfileEmpty>
              Statistics are not available for this
              competition season yet.
            </ProfileEmpty>
          ) : (
            rows.map(row => (
              <section
                key={`${row.seasonId}-${row.groupName}`}
                className="discovery-statistics-group"
              >
                <h3>{groupLabel(row.groupName)}</h3>

                <div className="discovery-statistics-grid">
                  {metrics(row).map(metric => (
                    <div
                      key={metric.label}
                      className="discovery-statistics-card"
                    >
                      <strong>
                        {metric.value ?? "—"}
                      </strong>
                      <span>{metric.label}</span>
                    </div>
                  ))}
                </div>

                {row.form && (
                  <p className="discovery-profile-note">
                    Recent form: {row.form}
                  </p>
                )}

                {row.observedAt &&
                  Number.isFinite(Date.parse(row.observedAt)) && (
                  <p className="discovery-profile-note">
                    Provider data observed:{" "}
                    {new Date(row.observedAt).toLocaleDateString(
                      "en-GB",
                      { timeZone: "UTC" }
                    )}
                  </p>
                )}
              </section>
            ))
          )}
        </>
      )}

      <p className="discovery-profile-note">
        Statistics reflect recorded competition standings,
        not the club&apos;s complete historical performance.
        Missing values are shown as a dash.
      </p>
    </ProfileSection>
  );
}
