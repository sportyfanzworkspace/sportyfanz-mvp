"use client";

import { useState } from "react";

import type {
  PlayerStatistic,
} from "./profile-types";

import {
  ProfileEmpty,
  ProfileRelatedLink,
} from "./profile-ui";

export default function PlayerStatistics({
  statistics,
}: {
  statistics: PlayerStatistic[];
}) {
  const seasons = [...new Map(
    statistics.map(row => [
      row.seasonId,
      {
        id: row.seasonId,
        name: row.seasonName,
        isCurrent: row.isCurrent,
        competitionName: row.competitionName,
      },
    ] as const)
  ).values()];

  const [selectedId, setSelectedId] =
    useState<number | null>(
      seasons.find(season => season.isCurrent)?.id ??
      seasons[0]?.id ??
      null
    );

  if (!statistics.length) {
    return (
      <ProfileEmpty>
        Player statistics are not available yet.
      </ProfileEmpty>
    );
  }

  const selectedSeason =
    seasons.find(season => season.id === selectedId) ??
    seasons[0];

  const groups = new Map<
    string,
    PlayerStatistic[]
  >();

  for (const row of statistics) {
    if (row.seasonId !== selectedSeason.id) {
      continue;
    }

    const key = [
      row.competitionId,
      row.teamId,
      row.seasonId,
    ].join(":");

    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return (
    <>
      <div className="discovery-competition-filter">
        <label htmlFor="player-statistics-season">
          Select Competition and Season
        </label>

        <select
          id="player-statistics-season"
          value={selectedSeason.id}
          onChange={event =>
            setSelectedId(Number(event.target.value))
          }
        >
          {seasons.map(season => (
            <option key={season.id} value={season.id}>
              {season.competitionName} · {season.name}
              {season.isCurrent ? " (Current)" : ""}
            </option>
          ))}
        </select>
      </div>

      {[...groups.entries()].map(([key, records]) => {
        const first = records[0];

        return (
          <article
            key={key}
            className="discovery-statistics-group"
          >
            <h3>
              {first.competitionName} · {first.seasonName}
            </h3>

            <ProfileRelatedLink
              type="club"
              slug={first.teamSlug}
              name={first.teamName}
              imageUrl={first.teamLogoUrl}
            />

            <div className="discovery-statistics-grid">
              {records.map(row => (
                <div
                  key={row.metricKey}
                  className="discovery-statistics-card"
                >
                  <strong>
                    {new Intl.NumberFormat("en-GB", {
                      maximumFractionDigits: 6,
                    }).format(row.metricValue)}
                  </strong>

                  <span>{row.metricLabel}</span>
                </div>
              ))}
            </div>
          </article>
        );
      })}

      <p className="discovery-profile-note">
        Statistics reflect available recorded metrics.
        Records are separated by club, competition and
        season and are not combined into career totals.
      </p>
    </>
  );
}
