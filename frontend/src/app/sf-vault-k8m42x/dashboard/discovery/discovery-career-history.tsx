"use client";

import { useState } from "react";

type Sport = {
  id: number;
  name: string;
};

type Team = {
  id: number;
  name: string;
  logoUrl: string | null;
};

type Player = {
  id: number;
  name: string;
  sportId: number | null;
  position: string | null;
  jerseyNumber: number | null;
  avatarUrl: string | null;
  isActive: boolean;
};

type Membership = {
  playerId: number;
  teamId: number;
  teamName: string;
  joinedAt: string | null;
  leftAt: string | null;
};

export type CareerRecord = {
  id: number;
  playerId: number;
  teamId: number;
  playerName: string;
  teamName: string;
  joinedAt: string | null;
  leftAt: string | null;
  position: string | null;
  jerseyNumber: number | null;
  transferType: string | null;
  notes: string | null;
  dataSource: "MANUAL" | "PROVIDER";
};

type Props = {
  sports: Sport[];
  teams: Team[];
  players: Player[];
  memberships: Membership[];
  careers: CareerRecord[];
  selectedPlayerId: string;
  onPlayerChange: (id: string) => void;
  disabled?: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Lagos",
      });
}

function sameDate(
  first: string | null,
  second: string | null
) {
  if (first === null || second === null) {
    return first === second;
  }

  const firstDate = Date.parse(first);
  const secondDate = Date.parse(second);

  return (
    Number.isFinite(firstDate) &&
    Number.isFinite(secondDate) &&
    firstDate === secondDate
  );
}

type RecordedPeriod = {
  joinedAt: string | null;
  leftAt: string | null;
};

function invalidPeriod(
  period: RecordedPeriod,
  now: number,
  allowUnknownStart: boolean
) {
  const start = period.joinedAt === null
    ? null
    : Date.parse(period.joinedAt);

  const end = period.leftAt === null
    ? null
    : Date.parse(period.leftAt);

  if (start === null && !allowUnknownStart) return true;

  if (
    start !== null &&
    (!Number.isFinite(start) || start > now)
  ) return true;

  if (
    end !== null &&
    (!Number.isFinite(end) || end > now)
  ) return true;

  return (
    start !== null &&
    end !== null &&
    end < start
  );
}

function periodsOverlap(
  first: RecordedPeriod,
  second: RecordedPeriod
) {
  if (
    first.joinedAt === null ||
    second.joinedAt === null
  ) return false;

  const firstStart = Date.parse(first.joinedAt);
  const secondStart = Date.parse(second.joinedAt);

  const firstEnd = first.leftAt === null
    ? Infinity
    : Date.parse(first.leftAt);

  const secondEnd = second.leftAt === null
    ? Infinity
    : Date.parse(second.leftAt);

  return (
    Math.max(firstStart, secondStart) <
    Math.min(firstEnd, secondEnd)
  );
}

function transferLabel(value: string | null) {
  if (!value) return "Not specified";

  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, character => character.toUpperCase());
}

export default function DiscoveryCareerHistory({
  sports,
  teams,
  players,
  memberships,
  careers,
  selectedPlayerId,
  onPlayerChange,
  disabled = false,
}: Props) {
  const [sportFilter, setSportFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] =
    useState<"ALL" | "OPEN" | "ENDED">("ALL");

  const selectedPlayer = players.find(
    player => String(player.id) === selectedPlayerId
  );

  const filteredPlayers = players.filter(player =>
    (
      sportFilter === "ALL" ||
      String(player.sportId) === sportFilter
    ) &&
    player.name.toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const playerCareers = careers.filter(
    item => String(item.playerId) === selectedPlayerId
  ).sort((a, b) => {
    const first = a.joinedAt
      ? Date.parse(a.joinedAt) : 0;

    const second = b.joinedAt
      ? Date.parse(b.joinedAt) : 0;

    return second - first || b.id - a.id;
  });

  const playerMemberships = memberships.filter(
    item => String(item.playerId) === selectedPlayerId
  );

  const currentMemberships = playerMemberships.filter(
    item => item.leftAt === null
  );

  const openCareers = playerCareers.filter(
    item => item.leftAt === null
  );

  const endedCareers = playerCareers.filter(
    item => item.leftAt !== null
  );

  const unmatchedMemberships = playerMemberships.filter(
    membership => !playerCareers.some(career =>
      career.teamId === membership.teamId &&
      sameDate(career.joinedAt, membership.joinedAt) &&
      sameDate(career.leftAt, membership.leftAt)
    )
  );

  const unmatchedOpenCareers = openCareers.filter(
    career => !currentMemberships.some(membership =>
      membership.teamId === career.teamId &&
      sameDate(membership.joinedAt, career.joinedAt)
    )
  );

  const duplicateOpenCareers = openCareers.filter(
    career => openCareers.filter(
      item => item.teamId === career.teamId
    ).length > 1
  );

  const now = Date.now();

  const invalidMembershipPeriods = playerMemberships.filter(
    item => invalidPeriod(item, now, false)
  );

  const invalidCareerPeriods = playerCareers.filter(
    item => invalidPeriod(item, now, true)
  );

  const incompleteCareerPeriods = playerCareers.filter(
    item => item.joinedAt === null
  );

  const conflictingCareerPeriods = playerCareers.filter(
    career => playerCareers.some(other =>
      career.id !== other.id &&
      career.teamId === other.teamId &&
      !invalidPeriod(career, now, true) &&
      !invalidPeriod(other, now, true) &&
      (
        (
          career.joinedAt !== null &&
          sameDate(career.joinedAt, other.joinedAt) &&
          sameDate(career.leftAt, other.leftAt)
        ) ||
        periodsOverlap(career, other)
      )
    )
  );

  const displayedCareers = playerCareers.filter(item =>
    periodFilter === "ALL" ||
    (periodFilter === "OPEN" && item.leftAt === null) ||
    (periodFilter === "ENDED" && item.leftAt !== null)
  );

  const sportName = sports.find(
    sport => sport.id === selectedPlayer?.sportId
  )?.name ?? "Unassigned sport";

  const hasReviewItems =
    unmatchedMemberships.length > 0 ||
    unmatchedOpenCareers.length > 0 ||
    duplicateOpenCareers.length > 0 ||
    invalidMembershipPeriods.length > 0 ||
    invalidCareerPeriods.length > 0 ||
    incompleteCareerPeriods.length > 0 ||
    conflictingCareerPeriods.length > 0;

  return (
    <section className="player-panel discovery-career-panel">
      <div className="player-panel-heading">
        <div>
          <h2>Player Career History</h2>
          <p>
            Review recorded club spells, transfers and
            membership history across all sports.
          </p>
        </div>

        <span className="discovery-career-readonly">
          Read only
        </span>
      </div>

      <div className="discovery-career-filters">
        <label>
          <span>Sport</span>
          <select
            value={sportFilter}
            disabled={disabled}
            onChange={event => {
              setSportFilter(event.target.value);
              onPlayerChange("");
            }}
          >
            <option value="ALL">All sports</option>
            {sports.map(sport => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Search players</span>
          <input
            value={search}
            disabled={disabled}
            placeholder="Enter player name..."
            onChange={event => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span>Player</span>
          <select
            value={selectedPlayerId}
            disabled={disabled}
            onChange={event =>
              onPlayerChange(event.target.value)
            }
          >
            <option value="">Select a player</option>

            {selectedPlayer &&
              !filteredPlayers.some(
                player => player.id === selectedPlayer.id
              ) && (
                <option value={selectedPlayer.id}>
                  {selectedPlayer.name}
                </option>
              )}

            {filteredPlayers.map(player => (
              <option key={player.id} value={player.id}>
                {player.name}
                {!player.isActive ? " (Inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!selectedPlayer ? (
        <p className="discovery-career-empty">
          Select a player to view their recorded career history.
        </p>
      ) : (
        <>
          <div className="discovery-career-profile">
            {selectedPlayer.avatarUrl ? (
              <img
                src={selectedPlayer.avatarUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="discovery-career-avatar">
                {selectedPlayer.name.charAt(0)}
              </span>
            )}

            <div>
              <h3>{selectedPlayer.name}</h3>
              <p>
                {sportName}
                {selectedPlayer.position
                  ? " · " + selectedPlayer.position
                  : ""}
              </p>
              <small>
                {selectedPlayer.isActive
                  ? "Active profile"
                  : "Inactive profile"}
              </small>
            </div>
          </div>

          <div className="player-stat-grid">
            {[
              ["Career periods", playerCareers.length],
              ["Open career periods", openCareers.length],
              ["Completed periods", endedCareers.length],
              ["Current memberships", currentMemberships.length],
            ].map(([label, value]) => (
              <article className="player-stat-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          {currentMemberships.length > 0 && (
            <div className="discovery-career-memberships">
              <h3>Current club memberships</h3>
              <div>
                {currentMemberships.map(item => (
                  <span key={item.teamId}>
                    {item.teamName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hasReviewItems && (
            <div
              className="discovery-career-warning"
              role="status"
            >
              <strong>Career records require review</strong>

              <p>
                Some membership or career records require
                review because of missing dates, invalid dates,
                conflicting periods or unmatched records.
                No historical information has been
                automatically changed.
              </p>

              {invalidMembershipPeriods.map(item => (
                <p key={"invalid-membership-" + item.teamId}>
                  {item.teamName}: membership contains an
                  invalid or inconsistent date.
                </p>
              ))}

              {invalidCareerPeriods.map(item => (
                <p key={"invalid-career-" + item.id}>
                  {item.teamName}: career record
                  {" #"}{item.id} contains an invalid,
                  future or inconsistent date.
                </p>
              ))}

              {incompleteCareerPeriods.map(item => (
                <p key={"incomplete-career-" + item.id}>
                  {item.teamName}: career record
                  {" #"}{item.id} has no recorded joining date.
                </p>
              ))}

              {conflictingCareerPeriods.map(item => (
                <p key={"conflicting-career-" + item.id}>
                  {item.teamName}: career record
                  {" #"}{item.id} duplicates or overlaps
                  another recorded period at this club.
                </p>
              ))}

              {unmatchedMemberships.map(item => (
                <p key={"membership-" + item.teamId}>
                  {item.teamName}: membership period
                  {" "}{formatDate(item.joinedAt)}
                  {" — "}
                  {item.leftAt
                    ? formatDate(item.leftAt)
                    : "Current"}
                  {" has no exact matching career record."}
                </p>
              ))}

              {unmatchedOpenCareers.map(item => (
                <p key={"career-" + item.id}>
                  {item.teamName}: open career record
                  {" #"}{item.id} has no matching current
                  membership.
                </p>
              ))}

              {duplicateOpenCareers.length > 0 && (
                <p>
                  Multiple open career records exist for
                  the same club.
                </p>
              )}
            </div>
          )}

          <div className="discovery-admin-tabs">
            {([
              ["ALL", "All periods"],
              ["OPEN", "Open periods"],
              ["ENDED", "Completed periods"],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                disabled={disabled}
                aria-pressed={periodFilter === value}
                className={
                  periodFilter === value ? "active" : ""
                }
                onClick={() => setPeriodFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {displayedCareers.length === 0 ? (
            <p className="discovery-career-empty">
              No recorded career periods match this filter.
            </p>
          ) : (
            <ol className="discovery-career-timeline">
              {displayedCareers.map(career => {
                const team = teams.find(
                  item => item.id === career.teamId
                );

                return (
                  <li
                    key={career.id}
                    className={
                      career.leftAt === null ? "open" : ""
                    }
                  >
                    <article className="discovery-career-card">
                      <div className="discovery-career-card-header">
                        <div className="discovery-admin-profile">
                          {team?.logoUrl ? (
                            <img
                              src={team.logoUrl}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="discovery-admin-placeholder">
                              {career.teamName.charAt(0)}
                            </span>
                          )}

                          <div>
                            <h3>{career.teamName}</h3>
                            <p>
                              {formatDate(career.joinedAt)}
                              {" — "}
                              {career.leftAt
                                ? formatDate(career.leftAt)
                                : "Open period"}
                            </p>
                          </div>
                        </div>

                        <span className={
                          "discovery-career-period " +
                          (career.leftAt === null
                            ? "open" : "ended")
                        }>
                          {career.leftAt === null
                            ? "Open" : "Completed"}
                        </span>
                      </div>

                      <dl className="discovery-career-details">
                        <div>
                          <dt>Transfer classification</dt>
                          <dd>
                            {transferLabel(career.transferType)}
                          </dd>
                        </div>

                        <div>
                          <dt>Position</dt>
                          <dd>
                            {career.position || "Not recorded"}
                          </dd>
                        </div>

                        <div>
                          <dt>Jersey number</dt>
                          <dd>
                            {career.jerseyNumber ?? "Not recorded"}
                          </dd>
                        </div>

                        <div>
                          <dt>Data source</dt>
                          <dd>
                            {career.dataSource === "PROVIDER"
                              ? "Provider"
                              : "Manual"}
                          </dd>
                        </div>
                      </dl>

                      {career.notes && (
                        <div className="discovery-career-notes">
                          <strong>Career notes</strong>
                          <p>{career.notes}</p>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          )}

          <p className="discovery-career-disclaimer">
            Dates reflect recorded membership information.
            This timeline may not represent the player's
            complete real-world sporting career.
          </p>
        </>
      )}
    </section>
  );
}
