"use client";

import Link from "next/link";

import {
  profileHref,
  type CompetitionSeason,
  type CompetitionStanding,
} from "./profile-types";

import {
  ProfileEmpty,
  ProfileImage,
} from "./profile-ui";

type StandingColumn = {
  key: keyof CompetitionStanding;
  label: string;
  description: string;
};

export function groupLabel(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);

    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      parsed.every(item => typeof item === "string")
    ) {
      return [...new Set(
        parsed.filter(Boolean)
      )].join(" · ") || "Overall";
    }
  } catch {
    // Ordinary group names are valid.
  }

  return value || "Overall";
}

export function columnsForSport(
  sport: string | null | undefined
): StandingColumn[] {
  const scoringUnit =
    sport === "baseball" ? "Runs" :
    sport === "volleyball" ? "Sets" :
    sport === "basketball" ||
    sport === "rugby" ? "Points" :
    sport === "football" ? "Goals" :
    "Score";

  return [
    {
      key: "played",
      label: "P",
      description: "Played",
    },
    {
      key: "won",
      label: "W",
      description: "Won",
    },
    {
      key: "drawn",
      label: "D",
      description: "Drawn",
    },
    {
      key: "lost",
      label: "L",
      description: "Lost",
    },
    {
      key: "scored",
      label: scoringUnit === "Goals" ? "GF" : "For",
      description: `${scoringUnit} for`,
    },
    {
      key: "conceded",
      label: scoringUnit === "Goals" ? "GA" : "Against",
      description: `${scoringUnit} against`,
    },
    {
      key: "difference",
      label: scoringUnit === "Goals" ? "GD" : "Diff",
      description: `${scoringUnit} difference`,
    },
    {
      key: "points",
      label: "Pts",
      description: "Ranking points",
    },
    {
      key: "form",
      label: "Form",
      description: "Recorded recent form",
    },
  ];
}

export default function CompetitionStandings({
  seasons,
  selectedSeason,
  onSeasonChange,
  sportSlug,
}: {
  seasons: CompetitionSeason[];
  selectedSeason: CompetitionSeason | null;
  onSeasonChange: (id: number) => void;
  sportSlug?: string | null;
}) {
  if (!selectedSeason) {
    return (
      <ProfileEmpty>
        No competition seasons are available yet.
      </ProfileEmpty>
    );
  }

  const rows = selectedSeason.standings ?? [];

  const groups = new Map<
    string,
    CompetitionStanding[]
  >();

  for (const row of rows) {
    const key = row.groupName || "Overall";
    const group = groups.get(key) ?? [];

    group.push(row);
    groups.set(key, group);
  }

  const columns = columnsForSport(sportSlug);

  return (
    <>
      <div className="discovery-competition-filter">
        <label htmlFor="standings-season">
          Select Season
        </label>

        <select
          id="standings-season"
          value={selectedSeason.id}
          onChange={event =>
            onSeasonChange(Number(event.target.value))
          }
        >
          {seasons.map(season => (
            <option key={season.id} value={season.id}>
              {season.name}
              {season.isCurrent ? " (Current season)" : ""}
            </option>
          ))}
        </select>
      </div>

      {!rows.length ? (
        <ProfileEmpty>
          Standings are not available for this season yet.
        </ProfileEmpty>
      ) : (
        [...groups.entries()].map(([group, records]) => {
          const visibleColumns = columns.filter(
            column => records.some(
              row => row[column.key] != null
            )
          );

          const sorted = [...records].sort(
            (a, b) => a.rank - b.rank
          );

          return (
            <section
              key={group}
              className="discovery-standing-group"
            >
              <h3>{groupLabel(group)}</h3>

              <div
                className="discovery-standings-scroll"
                tabIndex={0}
                role="region"
                aria-label={`${groupLabel(group)} standings`}
              >
                <table className="discovery-standings-table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Club</th>

                      {visibleColumns.map(column => (
                        <th
                          key={column.key}
                          scope="col"
                          title={column.description}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {sorted.map(row => (
                      <tr key={row.teamId}>
                        <td>{row.rank}</td>

                        <td>
                          <Link
                            href={profileHref(
                              "club",
                              row.teamSlug
                            )}
                            className="discovery-standing-club"
                          >
                            <ProfileImage
                              type="club"
                              url={row.teamLogoUrl}
                            />
                            <span>{row.teamName}</span>
                          </Link>
                        </td>

                        {visibleColumns.map(column => (
                          <td key={column.key}>
                            {row[column.key] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <p className="discovery-profile-note">
        Standings reflect available published records.
        Missing values are shown as a dash.
        Rankings may not represent the complete competition.
      </p>
    </>
  );
}
