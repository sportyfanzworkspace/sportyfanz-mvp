"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { apiFetch } from "@/lib/api";
import DiscoveryCareerHistory, {
  type CareerRecord,
} from "./discovery-career-history";

type PublicationStatus =
  "DRAFT" | "PUBLISHED" | "ARCHIVED";

type Sport = {
  id: number;
  name: string;
  isActive: boolean;
};

type Team = {
  id: number;
  name: string;
  sportId: number;
  logoUrl: string | null;
  publicationStatus: PublicationStatus;
  isActive: boolean;
};

type Player = {
  id: number;
  name: string;
  sportId: number | null;
  position: string | null;
  jerseyNumber: number | null;
  avatarUrl: string | null;
  publicationStatus: PublicationStatus;
  isActive: boolean;
};

type Membership = {
  playerId: number;
  teamId: number;
  playerName: string;
  teamName: string;
  joinedAt: string | null;
  leftAt: string | null;
  isCurrent: boolean;
};

type Career = CareerRecord;

type SquadData = {
  sports: Sport[];
  teams: Team[];
  players: Player[];
  memberships: Membership[];
  careers: Career[];
};

type Operation = "ASSIGN" | "REMOVE" | "TRANSFER";

type Props = {
  canPublish: boolean;
  onBusyChange: (busy: boolean) => void;
};

const transferTypes = [
  ["PERMANENT_TRANSFER", "Permanent transfer"],
  ["LOAN", "Loan"],
  ["LOAN_RETURN", "Loan return"],
  ["FREE_TRANSFER", "Free transfer"],
  ["ACADEMY_PROMOTION", "Academy promotion"],
  ["NATIONAL_TEAM_SELECTION", "National team selection"],
  ["OTHER", "Other"],
];

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Lagos",
      });
}

export default function DiscoverySquadManagement({
  canPublish,
  onBusyChange,
}: Props) {
  const [data, setData] = useState<SquadData>({
    sports: [],
    teams: [],
    players: [],
    memberships: [],
    careers: [],
  });

  const [sportId, setSportId] = useState("ALL");
  const [teamId, setTeamId] = useState("");
  const [careerPlayerId, setCareerPlayerId] = useState("");
  const careerSection = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [view, setView] =
    useState<"CURRENT" | "FORMER">("CURRENT");

  const [operation, setOperation] =
    useState<Operation | null>(null);

  const [playerId, setPlayerId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [position, setPosition] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [transferType, setTransferType] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  const submissionLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSquads() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch(
          "/api/admin/discovery/squads",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await response.json();

        if (!response.ok || result.success !== true) {
          throw new Error(
            result.error || "Unable to load squads."
          );
        }

        if (controller.signal.aborted) return;

        setData({
          sports: Array.isArray(result.sports)
            ? result.sports : [],
          teams: Array.isArray(result.teams)
            ? result.teams : [],
          players: Array.isArray(result.players)
            ? result.players : [],
          memberships: Array.isArray(result.memberships)
            ? result.memberships : [],
          careers: Array.isArray(result.careers)
            ? result.careers : [],
        });
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load squads."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSquads();

    return () => controller.abort();
  }, [reload]);

  const selectedTeam = data.teams.find(
    team => String(team.id) === teamId
  );

  const selectedPlayer = data.players.find(
    player => String(player.id) === playerId
  );

  const filteredTeams = data.teams.filter(team =>
    sportId === "ALL" ||
    String(team.sportId) === sportId
  );

  const clubMemberships = data.memberships.filter(
    item => String(item.teamId) === teamId
  );

  const currentMembers = clubMemberships.filter(
    item => item.leftAt === null
  );

  const formerMembers = clubMemberships.filter(
    item => item.leftAt !== null
  );

  const currentPlayerIds = new Set(
    currentMembers.map(item => item.playerId)
  );

  function permitted(
    player?: Player,
    team?: Team
  ) {
    return canPublish || (
      player?.publicationStatus !== "PUBLISHED" &&
      team?.publicationStatus !== "PUBLISHED"
    );
  }

  function compatible(player: Player, team: Team) {
    if (
      player.sportId !== null &&
      player.sportId !== team.sportId
    ) return false;

    return data.memberships
      .filter(item => item.playerId === player.id)
      .every(item =>
        data.teams.find(
          club => club.id === item.teamId
        )?.sportId === team.sportId
      );
  }

  const availablePlayers = selectedTeam
    ? data.players.filter(player =>
        player.isActive &&
        player.publicationStatus !== "ARCHIVED" &&
        compatible(player, selectedTeam) &&
        !currentPlayerIds.has(player.id) &&
        permitted(player, selectedTeam)
      )
    : [];

  const destinations = selectedTeam && selectedPlayer
    ? data.teams.filter(team =>
        team.id !== selectedTeam.id &&
        team.sportId === selectedTeam.sportId &&
        team.isActive &&
        team.publicationStatus !== "ARCHIVED" &&
        permitted(selectedPlayer, team) &&
        compatible(selectedPlayer, team) &&
        !data.memberships.some(item =>
          item.playerId === selectedPlayer.id &&
          item.teamId === team.id &&
          item.leftAt === null
        )
      )
    : [];

  const displayedMembers = (
    view === "CURRENT"
      ? currentMembers
      : formerMembers
  ).filter(item =>
    item.playerName.toLowerCase()
      .includes(search.trim().toLowerCase())
  ).sort((a, b) =>
    a.playerName.localeCompare(b.playerName)
  );

  const careerCount = data.careers.filter(
    item => String(item.teamId) === teamId
  ).length;

  const canAssign = !!selectedTeam &&
    selectedTeam.isActive &&
    selectedTeam.publicationStatus !== "ARCHIVED" &&
    permitted(undefined, selectedTeam);

  function openCareerHistory(id: number) {
    if (operation || saving || loading) return;

    setCareerPlayerId(String(id));

    careerSection.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function resetOperation() {
    setOperation(null);
    setPlayerId("");
    setDestinationId("");
    setPosition("");
    setJerseyNumber("");
    setTransferType("");
    setNotes("");
  }

  function cancelOperation() {
    if (submissionLock.current) return;

    resetOperation();
    setError("");
    onBusyChange(false);
  }

  function openOperation(
    action: Operation,
    player?: Player
  ) {
    if (
      loading ||
      saving ||
      operation ||
      !selectedTeam ||
      !permitted(player, selectedTeam)
    ) return;

    resetOperation();
    setError("");
    setNotice("");
    setOperation(action);
    setPlayerId(player ? String(player.id) : "");
    setPosition(player?.position ?? "");
    setJerseyNumber(
      player?.jerseyNumber == null
        ? ""
        : String(player.jerseyNumber)
    );
    onBusyChange(true);
  }

  async function submitOperation(event: FormEvent) {
    event.preventDefault();

    if (
      submissionLock.current ||
      loading ||
      saving ||
      !operation ||
      !selectedTeam ||
      !selectedPlayer ||
      !permitted(selectedPlayer, selectedTeam)
    ) return;

    const destination = destinations.find(
      team => String(team.id) === destinationId
    );

    if (
      operation === "ASSIGN" &&
      (
        !canAssign ||
        !availablePlayers.some(
          player => player.id === selectedPlayer.id
        )
      )
    ) {
      setError("Select an eligible player.");
      return;
    }

    if (
      operation !== "ASSIGN" &&
      !currentPlayerIds.has(selectedPlayer.id)
    ) {
      setError("This membership is no longer active.");
      return;
    }

    if (
      operation === "TRANSFER" &&
      (
        !destination ||
        !selectedPlayer.isActive ||
        selectedPlayer.publicationStatus === "ARCHIVED"
      )
    ) {
      setError("Select an eligible destination club.");
      return;
    }

    if (operation !== "REMOVE") {
      if (position.trim().length > 100) {
        setError("Position cannot exceed 100 characters.");
        return;
      }

      if (notes.trim().length > 2000) {
        setError("Career notes cannot exceed 2000 characters.");
        return;
      }

      if (
        jerseyNumber !== "" &&
        (
          !/^\d+$/.test(jerseyNumber) ||
          !Number.isInteger(Number(jerseyNumber)) ||
          Number(jerseyNumber) < 0 ||
          Number(jerseyNumber) > 999
        )
      ) {
        setError(
          "Jersey number must be a whole number between 0 and 999."
        );
        return;
      }
    }

    const confirmation = operation === "ASSIGN"
      ? "Assign " + selectedPlayer.name +
        " to " + selectedTeam.name + "?"
      : operation === "REMOVE"
        ? "End " + selectedPlayer.name +
          "'s membership at " + selectedTeam.name + "?"
        : "Transfer " + selectedPlayer.name +
          " from " + selectedTeam.name +
          " to " + destination?.name + "?";

    if (!window.confirm(confirmation)) return;

    submissionLock.current = true;
    let refreshRequired = false;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await apiFetch(
        "/api/admin/discovery/squads",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: operation,
            playerId: selectedPlayer.id,
            teamId: selectedTeam.id,
            ...(operation === "TRANSFER"
              ? { destinationTeamId: destination?.id }
              : {}),
            ...(operation !== "REMOVE"
              ? {
                  position: position.trim() || null,
                  jerseyNumber:
                    jerseyNumber === ""
                      ? null
                      : Number(jerseyNumber),
                  transferType: transferType || null,
                  notes: notes.trim() || null,
                }
              : {}),
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        refreshRequired =
          response.status === 403 ||
          response.status === 404 ||
          response.status === 409 ||
          response.status >= 500 ||
          response.ok;

        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Unable to update squad."
        );
      }

      setNotice(
        operation === "ASSIGN"
          ? "Player assigned successfully."
          : operation === "REMOVE"
            ? "Membership ended. Career history preserved."
            : "Player transferred successfully."
      );

      resetOperation();
      setLoading(true);
      setReload(value => value + 1);
      onBusyChange(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to update squad.";

      if (refreshRequired || err instanceof TypeError) {
        resetOperation();
        setLoading(true);
        setReload(value => value + 1);
        setNotice(
          message +
          " Squad information is being refreshed. " +
          "Review the latest records before trying again."
        );
        onBusyChange(false);
      } else {
        setError(message);
      }
    } finally {
      submissionLock.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="discovery-squad-workspace">
      <section className="player-panel">
        <div className="player-panel-heading">
          <div>
            <h2>Club Squad Management</h2>
            <p>
              Manage club memberships and player transfers
              across all sports.
            </p>
          </div>

          <button
            type="button"
            className="player-primary-button"
            disabled={loading || saving || !!operation}
            onClick={() => {
              setLoading(true);
              setReload(value => value + 1);
            }}
          >
            Refresh
          </button>
        </div>

        <div className="discovery-squad-filters">
          <label>
            <span>Sport</span>
            <select
              value={sportId}
              disabled={loading || !!operation}
              onChange={event => {
                setSportId(event.target.value);
                setTeamId("");
                setSearch("");
                setNotice("");
              }}
            >
              <option value="ALL">All sports</option>
              {data.sports.map(sport => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                  {!sport.isActive ? " (Inactive)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Club / Team</span>
            <select
              value={teamId}
              disabled={loading || !!operation}
              onChange={event => {
                setTeamId(event.target.value);
                setSearch("");
                setNotice("");
                setView("CURRENT");
              }}
            >
              <option value="">Select a club</option>
              {filteredTeams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                  {!team.isActive ? " (Inactive)" : ""}
                  {team.publicationStatus === "ARCHIVED"
                    ? " (Archived)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && (
        <p role="alert" className="player-message player-error">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="player-message player-success">
          {notice}
        </p>
      )}

      {loading ? (
        <p role="status">Loading squads...</p>
      ) : error && !operation ? (
        <section className="player-panel">
          <p>Refresh to retrieve the latest squad records.</p>
        </section>
      ) : !selectedTeam ? (
        <section className="player-panel">
          <p>Select a club to view and manage its squad.</p>
        </section>
      ) : (
        <>
          <section className="player-stat-grid">
            {[
              ["Current squad", currentMembers.length],
              ["Former members", formerMembers.length],
              ["Career records", careerCount],
              ["Available players", availablePlayers.length],
            ].map(([label, value]) => (
              <article
                className="player-stat-card"
                key={label}
              >
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>

          {operation && (
            <section className="player-panel">
              <div className="player-panel-heading">
                <div>
                  <h2>
                    {operation === "ASSIGN"
                      ? "Assign Player"
                      : operation === "REMOVE"
                        ? "Remove Player"
                        : "Transfer Player"}
                  </h2>
                  <p>{selectedTeam.name}</p>
                </div>
              </div>

              <form
                className="discovery-squad-form"
                onSubmit={submitOperation}
              >
                <fieldset disabled={saving}>
                  <div className="discovery-squad-fields">
                    <label>
                      <span>Player</span>
                      <select
                        required
                        value={playerId}
                        disabled={operation !== "ASSIGN"}
                        onChange={event => {
                          const id = event.target.value;
                          const player = data.players.find(
                            item => String(item.id) === id
                          );

                          setPlayerId(id);
                          setPosition(player?.position ?? "");
                          setJerseyNumber(
                            player?.jerseyNumber == null
                              ? ""
                              : String(player.jerseyNumber)
                          );
                        }}
                      >
                        <option value="">Select player</option>
                        {(operation === "ASSIGN"
                          ? availablePlayers
                          : selectedPlayer
                            ? [selectedPlayer]
                            : []
                        ).map(player => (
                          <option
                            key={player.id}
                            value={player.id}
                          >
                            {player.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {operation === "TRANSFER" && (
                      <label>
                        <span>Destination club</span>
                        <select
                          required
                          value={destinationId}
                          onChange={event =>
                            setDestinationId(event.target.value)
                          }
                        >
                          <option value="">
                            Select destination
                          </option>
                          {destinations.map(team => (
                            <option
                              key={team.id}
                              value={team.id}
                            >
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {operation !== "REMOVE" && (
                      <>
                        <label>
                          <span>Position</span>
                          <input
                            maxLength={100}
                            value={position}
                            onChange={event =>
                              setPosition(event.target.value)
                            }
                          />
                        </label>

                        <label>
                          <span>Jersey number</span>
                          <input
                            type="number"
                            min={0}
                            max={999}
                            step={1}
                            value={jerseyNumber}
                            onChange={event =>
                              setJerseyNumber(event.target.value)
                            }
                          />
                        </label>

                        <label>
                          <span>Transfer classification</span>
                          <select
                            value={transferType}
                            onChange={event =>
                              setTransferType(event.target.value)
                            }
                          >
                            <option value="">Not specified</option>
                            {transferTypes.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="discovery-squad-wide">
                          <span>Career notes</span>
                          <textarea
                            rows={4}
                            maxLength={2000}
                            value={notes}
                            onChange={event =>
                              setNotes(event.target.value)
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                </fieldset>

                {operation === "REMOVE" && (
                  <p>
                    This ends the club membership without
                    deleting the player or career history.
                  </p>
                )}

                <div className="discovery-squad-actions">
                  <button
                    type="button"
                    className="discovery-edit-button"
                    disabled={saving}
                    onClick={cancelOperation}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="player-primary-button"
                    disabled={
                      saving ||
                      loading ||
                      !selectedPlayer ||
                      (operation === "TRANSFER" &&
                        !destinationId)
                    }
                  >
                    {saving
                      ? "Saving..."
                      : operation === "ASSIGN"
                        ? "Assign Player"
                        : operation === "REMOVE"
                          ? "Confirm Removal"
                          : "Confirm Transfer"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="player-panel">
            <div className="player-panel-heading">
              <div>
                <h2>{selectedTeam.name}</h2>
                <p>Manage current and former memberships.</p>
              </div>

              <button
                type="button"
                className="player-primary-button"
                disabled={
                  !canAssign ||
                  !!operation ||
                  !!error ||
                  availablePlayers.length === 0
                }
                onClick={() => openOperation("ASSIGN")}
              >
                + Assign Player
              </button>
            </div>

            <div className="discovery-admin-tabs">
              <button
                type="button"
                className={view === "CURRENT" ? "active" : ""}
                aria-pressed={view === "CURRENT"}
                disabled={!!operation}
                onClick={() => setView("CURRENT")}
              >
                Current Squad ({currentMembers.length})
              </button>

              <button
                type="button"
                className={view === "FORMER" ? "active" : ""}
                aria-pressed={view === "FORMER"}
                disabled={!!operation}
                onClick={() => setView("FORMER")}
              >
                Former Members ({formerMembers.length})
              </button>
            </div>

            <div className="discovery-squad-search">
              <input
                aria-label="Search squad members"
                placeholder="Search players..."
                value={search}
                onChange={event =>
                  setSearch(event.target.value)
                }
              />
            </div>

            {displayedMembers.length === 0 ? (
              <p>No matching squad members found.</p>
            ) : (
              <div className="discovery-admin-table-wrap">
                <table className="discovery-admin-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Position</th>
                      <th>Joined</th>
                      <th>Departed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {displayedMembers.map(item => {
                      const player = data.players.find(
                        entry => entry.id === item.playerId
                      );

                      const canModify = !!player &&
                        permitted(player, selectedTeam);

                      return (
                        <tr key={item.playerId}>
                          <td>
                            <div className="discovery-admin-profile">
                              {player?.avatarUrl ? (
                                <img
                                  src={player.avatarUrl}
                                  alt=""
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="discovery-admin-placeholder">
                                  {item.playerName.charAt(0)}
                                </span>
                              )}
                              <strong>{item.playerName}</strong>
                            </div>
                          </td>
                          <td>{player?.position || "—"}</td>
                          <td>{formatDate(item.joinedAt)}</td>
                          <td>
                            {item.leftAt
                              ? formatDate(item.leftAt)
                              : "Current"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="discovery-edit-button discovery-career-link"
                              disabled={
                                !!operation ||
                                loading ||
                                !!error ||
                                !player
                              }
                              onClick={() =>
                                openCareerHistory(item.playerId)
                              }
                            >
                              Career History
                            </button>

                            {item.leftAt === null ? (
                              <div className="discovery-squad-actions">
                                <button
                                  type="button"
                                  className="discovery-edit-button"
                                  disabled={
                                    !!operation ||
                                    !!error ||
                                    !canModify ||
                                    !player?.isActive ||
                                    player.publicationStatus ===
                                      "ARCHIVED"
                                  }
                                  onClick={() =>
                                    openOperation("TRANSFER", player)
                                  }
                                >
                                  Transfer
                                </button>

                                <button
                                  type="button"
                                  className="discovery-publication-button archive"
                                  disabled={
                                    !!operation ||
                                    !!error ||
                                    !canModify
                                  }
                                  onClick={() =>
                                    openOperation("REMOVE", player)
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <span>Former member</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {!loading && !error && (
        <div
          ref={careerSection}
          className="discovery-career-section"
        >
          <DiscoveryCareerHistory
            sports={data.sports}
            teams={data.teams}
            players={data.players}
            memberships={data.memberships}
            careers={data.careers}
            selectedPlayerId={careerPlayerId}
            onPlayerChange={setCareerPlayerId}
            disabled={!!operation || saving}
          />
        </div>
      )}
    </div>
  );
}
