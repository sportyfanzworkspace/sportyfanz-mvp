"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Team = {
  id: number;
  name: string;
  sportId: number;
  sportName: string;
  isActive: boolean;
};

type Player = {
  id: number;
  firstName: string;
  lastName: string;
  displayName: string | null;
  slug: string;
  position: string | null;
  nationality: string | null;
  jerseyNumber: number | null;
  avatarUrl: string | null;
  isActive: boolean;
  teams: { id: number; name: string; sportName: string }[];
};

type PlayerForm = {
  firstName: string;
  lastName: string;
  displayName: string;
  position: string;
  nationality: string;
  jerseyNumber: string;
  avatarUrl: string;
  teamId: string;
};

const emptyForm: PlayerForm = {
  firstName: "",
  lastName: "",
  displayName: "",
  position: "",
  nationality: "",
  jerseyNumber: "",
  avatarUrl: "",
  teamId: "",
};

export default function PlayersManagement() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState<PlayerForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/players", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load players.");
      }

      setPlayers(data.players ?? []);
      setTeams(data.teams ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load players."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return players;

    return players.filter((player) => {
      const searchable = [
        player.firstName,
        player.lastName,
        player.displayName ?? "",
        player.position ?? "",
        player.nationality ?? "",
        player.teams.map((team) => team.name).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [players, search]);

  const activeCount = players.filter((player) => player.isActive).length;
  const inactiveCount = players.length - activeCount;

  function updateField<K extends keyof PlayerForm>(
    key: K,
    value: PlayerForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create player.");
      }

      setForm(emptyForm);
      setShowForm(false);
      setNotice("Player created successfully.");
      await loadPlayers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create player."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-shell players-admin">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin/dashboard">
          <span className="admin-brand-mark">S</span>
          <span>
            <strong>SportyFanz</strong>
            <small>STAFF ADMIN</small>
          </span>
        </a>

        <p className="admin-nav-label">WORKSPACE</p>

        <nav className="admin-nav">
          <a className="admin-nav-link" href="/admin/dashboard">⌂ Overview</a>
          <a className="admin-nav-link" href="/admin/dashboard/predictions">↗ Predictions</a>
          <a className="admin-nav-link" href="/admin/dashboard/trivia">? Trivia</a>
          <a className="admin-nav-link" href="/admin/dashboard/polls">◉ Polls</a>
          <a className="admin-nav-link active" href="/admin/dashboard/players">♙ Players</a>
          <a className="admin-nav-link" href="/admin/dashboard/fans">♙ Fan Management</a>
        </nav>

        <div className="admin-sidebar-bottom">
          <a className="admin-nav-link" href="/admin/dashboard">Back to dashboard</a>
          <div className="admin-sidebar-footer">
            <span className="admin-status-dot" />
            Internal staff portal
          </div>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">SPORTYFANZ OPERATIONS</p>
            <h1>Players Management</h1>
          </div>
          <button
            className="player-primary-button"
            onClick={() => {
              setShowForm((value) => !value);
              setError("");
              setNotice("");
            }}
          >
            {showForm ? "Cancel" : "+ Add Player"}
          </button>
        </header>

        <div className="admin-content">
          <section className="players-intro">
            <div>
              <p className="admin-eyebrow">DISCOVER DIRECTORY</p>
              <h2>Manage the players fans discover</h2>
              <p>
                Add player profiles and associate them with teams so fans can
                discover and follow their favourite players.
              </p>
            </div>
            <div className="players-intro-mark">♙</div>
          </section>

          <section className="player-stat-grid">
            <article className="player-stat-card">
              <span>Total players</span>
              <strong>{players.length}</strong>
            </article>
            <article className="player-stat-card">
              <span>Active players</span>
              <strong>{activeCount}</strong>
            </article>
            <article className="player-stat-card">
              <span>Inactive players</span>
              <strong>{inactiveCount}</strong>
            </article>
            <article className="player-stat-card">
              <span>Available teams</span>
              <strong>{teams.filter((team) => team.isActive).length}</strong>
            </article>
          </section>

          {error && <p className="player-message player-error">{error}</p>}
          {notice && <p className="player-message player-success">{notice}</p>}

          {showForm && (
            <section className="player-panel">
              <div className="player-panel-heading">
                <div>
                  <h2>Add a player</h2>
                  <p>Fields marked with * are required.</p>
                </div>
              </div>

              <form onSubmit={createPlayer} className="player-form">
                <label>
                  First name *
                  <input
                    required
                    maxLength={80}
                    value={form.firstName}
                    onChange={(event) => updateField("firstName", event.target.value)}
                    placeholder="e.g. Alex"
                  />
                </label>

                <label>
                  Last name *
                  <input
                    required
                    maxLength={80}
                    value={form.lastName}
                    onChange={(event) => updateField("lastName", event.target.value)}
                    placeholder="e.g. Morgan"
                  />
                </label>

                <label>
                  Display name
                  <input
                    maxLength={120}
                    value={form.displayName}
                    onChange={(event) => updateField("displayName", event.target.value)}
                    placeholder="Optional public name"
                  />
                </label>

                <label>
                  Position
                  <input
                    maxLength={80}
                    value={form.position}
                    onChange={(event) => updateField("position", event.target.value)}
                    placeholder="e.g. Forward"
                  />
                </label>

                <label>
                  Nationality
                  <input
                    maxLength={80}
                    value={form.nationality}
                    onChange={(event) => updateField("nationality", event.target.value)}
                    placeholder="e.g. Nigerian"
                  />
                </label>

                <label>
                  Jersey number
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    value={form.jerseyNumber}
                    onChange={(event) => updateField("jerseyNumber", event.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <label className="player-form-wide">
                  Avatar image URL
                  <input
                    type="url"
                    value={form.avatarUrl}
                    onChange={(event) => updateField("avatarUrl", event.target.value)}
                    placeholder="https://..."
                  />
                </label>

                <label className="player-form-wide">
                  Team
                  <select
                    value={form.teamId}
                    onChange={(event) => updateField("teamId", event.target.value)}
                  >
                    <option value="">No team assigned</option>
                    {teams
                      .filter((team) => team.isActive)
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} · {team.sportName}
                        </option>
                      ))}
                  </select>
                </label>

                <div className="player-form-actions player-form-wide">
                  <button
                    type="button"
                    className="player-secondary-button"
                    onClick={() => {
                      setShowForm(false);
                      setForm(emptyForm);
                      setError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="player-primary-button"
                    disabled={saving}
                  >
                    {saving ? "Creating..." : "Create Player"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="player-panel">
            <div className="player-list-heading">
              <div>
                <h2>Player directory</h2>
                <p>Search profiles and review their current team assignments.</p>
              </div>
              <input
                className="player-search"
                type="search"
                placeholder="Search players, teams, positions..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {loading ? (
              <p className="player-empty">Loading players...</p>
            ) : filteredPlayers.length === 0 ? (
              <div className="player-empty">
                <span>♙</span>
                <h3>{search ? "No matching players" : "No players yet"}</h3>
                <p>
                  {search
                    ? "Try another search term."
                    : "Add a player to start building the Discover directory."}
                </p>
              </div>
            ) : (
              <div className="player-table-wrap">
                <table className="player-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Position</th>
                      <th>Team</th>
                      <th>Nationality</th>
                      <th>Jersey</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player) => (
                      <tr key={player.id}>
                        <td>
                          <div className="player-identity">
                            {player.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={player.avatarUrl} alt="" />
                            ) : (
                              <span className="player-avatar">
                                {player.firstName.charAt(0)}
                                {player.lastName.charAt(0)}
                              </span>
                            )}
                            <span>
                              <strong>
                                {player.displayName ||
                                  `${player.firstName} ${player.lastName}`}
                              </strong>
                              <small>/{player.slug}</small>
                            </span>
                          </div>
                        </td>
                        <td>{player.position || "—"}</td>
                        <td>
                          {player.teams.length
                            ? player.teams.map((team) => team.name).join(", ")
                            : "Unassigned"}
                        </td>
                        <td>{player.nationality || "—"}</td>
                        <td>
                          {player.jerseyNumber === null
                            ? "—"
                            : `#${player.jerseyNumber}`}
                        </td>
                        <td>
                          <span
                            className={
                              player.isActive
                                ? "player-status active"
                                : "player-status inactive"
                            }
                          >
                            {player.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="player-list-footer">
              Showing {filteredPlayers.length} of {players.length} players
            </footer>
          </section>
        </div>
      </section>

      <style jsx>{`
        .players-admin {
          min-height: 100vh;
          display: flex;
          background: #f5f7fb;
          color: #172033;
          font-family: Lato, Arial, sans-serif;
        }
        .admin-sidebar {
          width: 245px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 26px 16px;
          box-sizing: border-box;
          background: #171a26;
          color: #f7f8fc;
        }
        .admin-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 8px 32px;
          color: inherit;
          text-decoration: none;
        }
        .admin-brand-mark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #f5b82e;
          color: #10121b;
          font-size: 23px;
          font-weight: 900;
        }
        .admin-brand strong, .admin-brand small,
        .admin-account strong, .admin-account small {
          display: block;
        }
        .admin-brand strong { font-size: 16px; }
        .admin-brand small {
          margin-top: 5px;
          color: #a4abc0;
          font-size: 10px;
          letter-spacing: 1.5px;
        }
        .admin-nav-label, .admin-eyebrow {
          color: #818ba1;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }
        .admin-nav-label { padding: 0 10px; }
        .admin-nav {
          display: grid;
          gap: 5px;
          margin-top: 8px;
        }
        .admin-nav-link {
          padding: 12px 11px;
          border-radius: 9px;
          color: #c1c8d8;
          text-decoration: none;
          font-size: 13px;
        }
        .admin-nav-link:hover, .admin-nav-link.active {
          background: #292d3d;
          color: #fff;
        }
        .admin-nav-link.active { box-shadow: inset 3px 0 #f5b82e; }
        .admin-sidebar-bottom { margin-top: auto; padding-top: 28px; }
        .admin-sidebar-footer {
          padding: 18px 8px 0;
          color: #8e97ad;
          font-size: 11px;
        }
        .admin-status-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          margin-right: 7px;
          border-radius: 50%;
          background: #48c78e;
        }
        .admin-main { min-width: 0; flex: 1; }
        .admin-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 25px 34px;
          background: #fff;
          border-bottom: 1px solid #e6eaf1;
        }
        .admin-topbar h1 {
          margin: 5px 0 0;
          font-size: 25px;
        }
        .admin-eyebrow { margin: 0; }
        .admin-content { padding: 28px 34px 40px; }
        .players-intro {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 26px;
          border-radius: 15px;
          background: #171a26;
          color: white;
        }
        .players-intro h2 {
          margin: 9px 0;
          font-size: 24px;
        }
        .players-intro p:last-child {
          max-width: 650px;
          margin-bottom: 0;
          color: #c1c8d8;
          font-size: 13px;
          line-height: 1.7;
        }
        .players-intro-mark {
          width: 70px;
          height: 70px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 18px;
          background: #f5b82e;
          color: #171a26;
          font-size: 35px;
        }
        .player-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin: 20px 0;
        }
        .player-stat-card, .player-panel {
          border: 1px solid #e6eaf1;
          border-radius: 13px;
          background: #fff;
        }
        .player-stat-card { padding: 18px; }
        .player-stat-card span {
          display: block;
          color: #727d92;
          font-size: 12px;
        }
        .player-stat-card strong {
          display: block;
          margin-top: 9px;
          font-size: 27px;
        }
        .player-panel { margin-top: 18px; padding: 22px; }
        .player-panel-heading, .player-list-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-bottom: 20px;
        }
        .player-panel h2, .player-list-heading h2 {
          margin: 0;
          font-size: 17px;
        }
        .player-panel-heading p, .player-list-heading p {
          margin: 6px 0 0;
          color: #788297;
          font-size: 12px;
        }
        .player-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }
        .player-form label {
          display: grid;
          gap: 7px;
          color: #465168;
          font-size: 12px;
          font-weight: 700;
        }
        .player-form input, .player-form select, .player-search {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 11px 12px;
          border: 1px solid #dce2ec;
          border-radius: 8px;
          background: white;
          color: #172033;
          font: inherit;
          font-size: 13px;
        }
        .player-form input:focus, .player-form select:focus, .player-search:focus {
          outline: 2px solid #f5b82e;
          outline-offset: 1px;
        }
        .player-form-wide { grid-column: 1 / -1; }
        .player-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .player-primary-button, .player-secondary-button {
          padding: 11px 16px;
          border: 1px solid transparent;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .player-primary-button {
          background: #f5b82e;
          color: #171a26;
        }
        .player-primary-button:hover { background: #e8a90d; }
        .player-primary-button:disabled { opacity: 0.6; cursor: wait; }
        .player-secondary-button {
          border-color: #dce2ec;
          background: white;
          color: #344057;
        }
        .player-search { max-width: 310px; }
        .player-table-wrap { overflow-x: auto; }
        .player-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 12px;
        }
        .player-table th {
          padding: 13px 12px;
          background: #f7f8fb;
          color: #7a8498;
          font-size: 10px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .player-table td {
          padding: 14px 12px;
          border-bottom: 1px solid #edf0f5;
          white-space: nowrap;
        }
        .player-identity {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .player-identity img, .player-avatar {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 11px;
          object-fit: cover;
        }
        .player-avatar {
          display: grid;
          place-items: center;
          background: #fff3cf;
          color: #6b4b00;
          font-size: 11px;
          font-weight: 800;
        }
        .player-identity strong, .player-identity small { display: block; }
        .player-identity small {
          margin-top: 4px;
          color: #8b94a7;
          font-size: 10px;
        }
        .player-status {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 800;
        }
        .player-status.active { background: #e4f8ed; color: #147b48; }
        .player-status.inactive { background: #eef0f5; color: #697386; }
        .player-empty {
          padding: 38px 10px;
          text-align: center;
          color: #788297;
          font-size: 13px;
        }
        .player-empty > span { font-size: 30px; }
        .player-empty h3 { color: #273249; }
        .player-list-footer {
          padding-top: 15px;
          color: #7d879a;
          font-size: 11px;
        }
        .player-message {
          margin: 14px 0;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 13px;
        }
        .player-error { background: #fff0f0; color: #a52b2b; }
        .player-success { background: #e8f9ef; color: #176d41; }
        @media (max-width: 1050px) {
          .player-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .admin-sidebar { width: 210px; }
          .admin-content, .admin-topbar { padding-left: 22px; padding-right: 22px; }
        }
        @media (max-width: 700px) {
          .admin-sidebar { width: 70px; padding: 18px 8px; }
          .admin-brand { padding: 0 0 24px; }
          .admin-brand > span:last-child, .admin-nav-label,
          .admin-nav-link:not(.active), .admin-sidebar-footer { display: none; }
          .admin-nav-link { font-size: 0; text-align: center; }
          .admin-nav-link.active { font-size: 11px; }
          .admin-content { padding: 16px; }
          .admin-topbar { padding: 18px 16px; }
          .players-intro { padding: 20px; }
          .players-intro h2 { font-size: 19px; }
          .players-intro-mark { width: 48px; height: 48px; font-size: 24px; }
          .player-form { grid-template-columns: 1fr; }
          .player-form-wide { grid-column: auto; }
          .player-list-heading { align-items: stretch; flex-direction: column; }
          .player-search { max-width: none; }
        }
      `}</style>
    </main>
  );
}