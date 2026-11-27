"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import DiscoveryProfileForm from "./discovery-profile-form";
import DiscoverySquadManagement from "./discovery-squad-management";
import DiscoveryPublication, {
  publicationIssues,
} from "./discovery-publication";

type Directory = "clubs" | "players" | "competitions";

type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type Sport = {
  id: number;
  name: string;
  isActive: boolean;
};

type Team = {
  id: number;
  name: string;
  sportId: number;
};

type DirectoryPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

type DirectorySummary = {
  total: number;
  DRAFT: number;
  PUBLISHED: number;
  ARCHIVED: number;
};

const DIRECTORY_PAGE_SIZE = 25;

const EMPTY_SUMMARY: DirectorySummary = {
  total: 0,
  DRAFT: 0,
  PUBLISHED: 0,
  ARCHIVED: 0,
};

type DirectoryRecord = Record<string, unknown> & {
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  sportId: number | null;
  sportName?: string | null;
  country?: string | null;
  nationality?: string | null;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  dataSource?: string | null;
  providerName?: string | null;
  providerTeamId?: string | null;
  providerPlayerId?: string | null;
  providerLeagueId?: string | null;
  lastSyncedAt?: string | null;
  publicationStatus: PublicationStatus;
  isActive: boolean;
  teams?: { id: number; name: string }[];
};

const directories: { key: Directory; label: string }[] = [
  { key: "clubs", label: "Clubs" },
  { key: "players", label: "Players" },
  { key: "competitions", label: "Competitions" },
];

function recordName(record: DirectoryRecord) {
  return (
    record.displayName ||
    record.name ||
    [record.firstName, record.lastName].filter(Boolean).join(" ") ||
    "Unnamed profile"
  );
}

function recordSourceLabel(record: DirectoryRecord) {
  if (record.dataSource === "MANUAL") {
    return "Manual";
  }

  if (record.dataSource === "PROVIDER") {
    return record.providerName?.startsWith("API_SPORTS_")
      ? "API-Sports"
      : record.providerName || "Provider";
  }

  return "Unknown";
}

function recordProviderReference(record: DirectoryRecord) {
  if (record.dataSource !== "PROVIDER") {
    return null;
  }

  return (
    record.providerTeamId ??
    record.providerPlayerId ??
    record.providerLeagueId ??
    null
  );
}

export default function DiscoveryManagement() {
  const [directory, setDirectory] = useState<Directory>("clubs");
  const [showSquads, setShowSquads] = useState(false);
  const [squadBusy, setSquadBusy] = useState(false);
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<DirectoryRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [canPublish, setCanPublish] = useState(false);
  const [publicationError, setPublicationError] = useState("");
  const [updatingId, setUpdatingId] =
    useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] =
    useState<DirectoryPagination | null>(null);
  const [summary, setSummary] =
    useState<DirectorySummary>(EMPTY_SUMMARY);

  const searchPending =
    search.trim() !== debouncedSearch;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const label =
    directories.find(item => item.key === directory)?.label ?? "";

  const singularLabel =
    directory === "clubs"
      ? "Club"
      : directory === "players"
        ? "Player"
        : "Competition";

  useEffect(() => {
    let active = true;

    async function loadPublicationPermission() {
      try {
        const response = await apiFetch("/api/admin/me", {
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (!active) return;

        setCanPublish(
          response.ok &&
          data.admin?.staffRole === "SUPER_ADMIN"
        );
      } catch {
        if (active) setCanPublish(false);
      }
    }

    void loadPublicationPermission();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (showSquads) return;

    const controller = new AbortController();

    async function loadDirectory() {
      setLoading(true);
      setError("");
      setRecords([]);
      setSports([]);
      setTeams([]);

      try {
        const params = new URLSearchParams({
          paginated: "1",
          page: String(page),
          pageSize: String(DIRECTORY_PAGE_SIZE),
          search: debouncedSearch,
          sportId: sportFilter,
          status: statusFilter,
          source: sourceFilter,
        });

        const response = await apiFetch(
          `/api/admin/discovery/${directory}?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load directory.");
        }

        if (controller.signal.aborted) return;

        if (controller.signal.aborted) return;

        if (!data.pagination || !data.summary) {
          throw new Error(
            "Invalid paginated directory response."
          );
        }

        const lastPage = Math.max(
          1,
          data.pagination.totalPages
        );

        if (page > lastPage) {
          setPage(lastPage);
          return;
        }

        setPagination(data.pagination);
        setSummary(data.summary);

        setRecords(
          Array.isArray(data[directory])
            ? data[directory]
            : []
        );
        setSports(Array.isArray(data.sports) ? data.sports : []);
        setTeams(Array.isArray(data.teams) ? data.teams : []);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error ? err.message : "Unable to load directory."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDirectory();

    return () => controller.abort();
  }, [
    directory,
    reload,
    showSquads,
    debouncedSearch,
    sportFilter,
    statusFilter,
    sourceFilter,
    page,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // The database now applies all directory filters.
  const filteredRecords = records;

  function changePage(next: number) {
    if (
      loading ||
      searchPending ||
      showForm ||
      updatingId !== null ||
      next < 1 ||
      next > 10000 ||
      next === page
    ) return;

    setLoading(true);
    setPage(next);
  }

  function changeDirectory(next: Directory) {
    if (
      (next === directory && !showSquads) ||
      showForm ||
      squadBusy ||
      updatingId !== null
    ) return;

    setShowSquads(false);
    setPublicationError("");

    setNotice("");
    setEditingRecord(null);
    setTeams([]);
    setRecords([]);
    setSports([]);
    setLoading(true);
    setSearch("");
    setSportFilter("ALL");
    setStatusFilter("ALL");
    setSourceFilter("ALL");
    setDebouncedSearch("");
    setPage(1);
    setPagination(null);
    setSummary(EMPTY_SUMMARY);
    setError("");
    setDirectory(next);
  }

  function openSquads() {
    if (
      showForm ||
      squadBusy ||
      updatingId !== null
    ) return;

    setShowSquads(true);
    setNotice("");
    setError("");
    setPublicationError("");
  }

  function openCreateForm() {
    if (updatingId !== null) return;

    setPublicationError("");
    setEditingRecord(null);
    setNotice("");
    setShowForm(true);
  }

  function openEditForm(record: DirectoryRecord) {
    if (
      updatingId !== null ||
      (
        record.publicationStatus === "PUBLISHED" &&
        !canPublish
      )
    ) return;

    setPublicationError("");
    setEditingRecord(record);
    setNotice("");
    setShowForm(true);
  }

  function closeProfileForm() {
    setShowForm(false);
    setEditingRecord(null);
  }

  function handleProfileSaved(message: string) {
    closeProfileForm();
    setNotice(message);
    setReload(value => value + 1);
  }

  async function changePublication(
    record: DirectoryRecord,
    nextStatus: PublicationStatus
  ) {
    if (
      !canPublish ||
      showForm ||
      loading ||
      updatingId !== null ||
      record.publicationStatus === nextStatus
    ) return;

    setPublicationError("");
    setNotice("");

    if (nextStatus === "PUBLISHED") {
      const issues = publicationIssues(
        directory,
        record,
        sports.map(sport => sport.id)
      );

      if (issues.length > 0) {
        setPublicationError(
          `Cannot publish ${recordName(record)}: ${issues.join(" ")}`
        );
        return;
      }
    }

    const action =
      nextStatus === "PUBLISHED"
        ? "Publish"
        : nextStatus === "ARCHIVED"
          ? "Archive"
          : record.publicationStatus === "ARCHIVED"
            ? "Restore to draft"
            : "Unpublish";

    if (!window.confirm(
      `${action} ${recordName(record)}?`
    )) return;

    setUpdatingId(record.id);

    try {
      const response = await apiFetch(
        `/api/admin/discovery/${directory}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: record.id,
            publicationStatus: nextStatus,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error || "Unable to update publication status."
        );
      }

      setRecords(current => current.map(item =>
        item.id === record.id
          ? { ...item, publicationStatus: nextStatus }
          : item
      ));

      setNotice(
        `${recordName(record)} is now ${nextStatus.toLowerCase()}.`
      );

      setReload(value => value + 1);
    } catch (err) {
      setPublicationError(
        err instanceof Error
          ? err.message
          : "Unable to update publication status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="admin-shell players-admin discovery-admin">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/sf-vault-k8m42x/dashboard">
          <span className="admin-brand-mark">S</span>
          <span>
            <strong>SportyFanz</strong>
            <small>STAFF ADMIN</small>
          </span>
        </a>

        <p className="admin-nav-label">WORKSPACE</p>

        <nav className="admin-nav">
          <a className="admin-nav-link"
            href="/sf-vault-k8m42x/dashboard">
            Overview
          </a>

          <a className="admin-nav-link active"
            href="/sf-vault-k8m42x/dashboard/discovery"
            aria-current="page">
            Discovery Management
          </a>

          <a className="admin-nav-link"
            href="/sf-vault-k8m42x/dashboard/players">
            Players Management
          </a>
        </nav>

        <div className="admin-sidebar-bottom">
          <a className="admin-nav-link"
            href="/sf-vault-k8m42x/dashboard">
            Back to dashboard
          </a>

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
            <h1>Discovery Management</h1>
          </div>

          {!showSquads && (
          <div className="discovery-header-actions">
            <button
              type="button"
              className="player-primary-button"
              disabled={loading || showForm || updatingId !== null}
              onClick={() => setReload(value => value + 1)}
            >
              Refresh
            </button>

            <button
              type="button"
              className="player-primary-button"
              disabled={loading || !!error || showForm || updatingId !== null}
              onClick={openCreateForm}
            >
              + Add {singularLabel}
            </button>
          </div>
          )}
        </header>

        <div className="admin-content">
          <section className="players-intro">
            <div>
              <p className="admin-eyebrow">DISCOVER DIRECTORY</p>
              <h2>Manage the world of sports</h2>
              <p>
                Manage club, player and competition profiles
                across the SportyFanz sports directory.
              </p>
            </div>
            <div className="players-intro-mark">◎</div>
          </section>

          <nav className="discovery-admin-tabs"
            aria-label="Discovery directories">
            {directories.map(item => (
              <button
                type="button"
                key={item.key}
                disabled={
                  showForm ||
                  squadBusy ||
                  updatingId !== null
                }
                aria-pressed={!showSquads && directory === item.key}
                className={
                  !showSquads && directory === item.key
                    ? "active"
                    : ""
                }
                onClick={() => changeDirectory(item.key)}
              >
                {item.label}
              </button>
            ))}

            <button
              type="button"
              disabled={
                showForm ||
                squadBusy ||
                updatingId !== null
              }
              aria-pressed={showSquads}
              className={showSquads ? "active" : ""}
              onClick={openSquads}
            >
              Squads
            </button>
          </nav>

          {showSquads ? (
            <DiscoverySquadManagement
              canPublish={canPublish}
              onBusyChange={setSquadBusy}
            />
          ) : (
          <>
          <section className="player-stat-grid">
            <article className="player-stat-card">
              <span>Total {label.toLowerCase()}</span>
              <strong>
                {loading || error
                  ? "—"
                  : summary.total.toLocaleString()}
              </strong>
            </article>

            {(["DRAFT", "PUBLISHED", "ARCHIVED"] as const).map(status => (
              <article className="player-stat-card" key={status}>
                <span>{status.charAt(0) + status.slice(1).toLowerCase()}</span>
                <strong>
                  {loading || error
                    ? "—"
                    : summary[status].toLocaleString()}
                </strong>
              </article>
            ))}
          </section>

          {error && (
            <p role="alert" className="player-message player-error">
              {error}
            </p>
          )}

          {publicationError && (
            <p role="alert"
              className="player-message player-error">
              {publicationError}
            </p>
          )}

          {notice && (
            <p role="status"
              className="player-message player-success">
              {notice}
            </p>
          )}

          {showForm && (
            <DiscoveryProfileForm
              key={`${directory}-${editingRecord?.id ?? "new"}`}
              directory={directory}
              sports={sports}
              teams={teams}
              record={editingRecord}
              onCancel={closeProfileForm}
              onSaved={handleProfileSaved}
            />
          )}

          <section className="player-panel">
            <div className="player-panel-heading">
              <div>
                <h2>{label} directory</h2>
                <p>Browse and filter existing directory profiles.</p>

                {!loading && !error && pagination && (
                  <small className="discovery-admin-result-count">
                    {pagination.total.toLocaleString()} matching profiles
                  </small>
                )}
              </div>
            </div>

            <div className="discovery-admin-filters">
              <input
                aria-label="Search profiles"
                placeholder={`Search ${label.toLowerCase()}...`}
                value={search}
                maxLength={150}
                disabled={showForm || updatingId !== null}
                onChange={event => setSearch(event.target.value)}
              />

              <select
                aria-label="Filter by sport"
                value={sportFilter}
                disabled={showForm || updatingId !== null}
                onChange={event => {
                  setPage(1);
                  setSportFilter(event.target.value);
                }}
              >
                <option value="ALL">All sports</option>
                {sports.map(sport => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by publication status"
                value={statusFilter}
                disabled={showForm || updatingId !== null}
                onChange={event => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>

              <select
                aria-label="Filter by data source"
                value={sourceFilter}
                disabled={showForm || updatingId !== null}
                onChange={event => {
                  setPage(1);
                  setSourceFilter(event.target.value);
                }}
              >
                <option value="ALL">All sources</option>
                <option value="PROVIDER">Provider imported</option>
                <option value="MANUAL">Manually created</option>
                <option value="UNKNOWN">Unknown source</option>
              </select>
            </div>

            {loading || searchPending ? (
              <p role="status">Loading {label.toLowerCase()}...</p>
            ) : error ? (
              <p>Refresh to try again.</p>
            ) : filteredRecords.length === 0 ? (
              <p>No matching profiles found.</p>
            ) : (
              <div className="discovery-admin-table-wrap">
                <table className="discovery-admin-table">
                  <thead>
                    <tr>
                      <th>Profile</th>
                      <th>Sport</th>
                      <th>Country / Nationality</th>
                      {directory === "players" && <th>Current clubs</th>}
                      <th>Source</th>
                      <th>Publication</th>
                      <th>Availability</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(record => (
                      <tr key={record.id}>
                        <td>
                          <div className="discovery-admin-profile">
                            {(record.logoUrl || record.avatarUrl) ? (
                              <img
                                src={record.logoUrl || record.avatarUrl || ""}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="discovery-admin-placeholder">
                                {recordName(record).charAt(0)}
                              </span>
                            )}
                            <strong>{recordName(record)}</strong>
                          </div>
                        </td>
                        <td>{record.sportName || "Unassigned"}</td>
                        <td>{record.country || record.nationality || "—"}</td>
                        {directory === "players" && (
                          <td>
                            {(record.teams ?? []).map(team => team.name)
                              .join(", ") || "Unassigned"}
                          </td>
                        )}
                        <td>
                          <div className="discovery-record-source">
                            <span className={
                              "discovery-source-label " +
                              (
                                record.dataSource === "PROVIDER"
                                  ? "provider"
                                  : record.dataSource === "MANUAL"
                                    ? "manual"
                                    : "unknown"
                              )
                            }>
                              {recordSourceLabel(record)}
                            </span>

                            {record.dataSource === "PROVIDER" &&
                              record.providerName && (
                                <small>
                                  {record.providerName}
                                </small>
                              )}

                            {recordProviderReference(record) !== null && (
                              <small>
                                ID: {recordProviderReference(record)}
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={
                            `discovery-status ${record.publicationStatus.toLowerCase()}`
                          }>
                            {record.publicationStatus}
                          </span>
                        </td>
                        <td>{record.isActive ? "Active" : "Inactive"}</td>
                        <td>
                          <button
                            type="button"
                            className="discovery-edit-button"
                            disabled={
                              showForm ||
                              updatingId !== null ||
                              (
                                record.publicationStatus === "PUBLISHED" &&
                                !canPublish
                              )
                            }
                            aria-label={`Edit ${recordName(record)}`}
                            onClick={() => openEditForm(record)}
                          >
                            Edit
                          </button>

                          <DiscoveryPublication
                            directory={directory}
                            record={record}
                            canPublish={canPublish}
                            disabled={
                              showForm ||
                              loading ||
                              updatingId !== null
                            }
                            busy={updatingId === record.id}
                            onRequest={status =>
                              void changePublication(record, status)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading &&
              !searchPending &&
              !error &&
              pagination &&
              pagination.totalPages > 1 && (
                <nav
                  className="discovery-admin-pagination"
                  aria-label="Admin directory pagination"
                >
                  <button
                    type="button"
                    disabled={
                      !pagination.hasPrevious ||
                      showForm ||
                      updatingId !== null
                    }
                    onClick={() => changePage(page - 1)}
                  >
                    Previous
                  </button>

                  <div aria-live="polite">
                    <strong>
                      Page {pagination.page} of{" "}
                      {pagination.totalPages}
                    </strong>
                    <small>
                      {(
                        (pagination.page - 1) *
                        pagination.pageSize + 1
                      ).toLocaleString()}–{Math.min(
                        pagination.page * pagination.pageSize,
                        pagination.total
                      ).toLocaleString()} of{" "}
                      {pagination.total.toLocaleString()}
                    </small>
                  </div>

                  <button
                    type="button"
                    disabled={
                      !pagination.hasNext ||
                      page >= 10000 ||
                      showForm ||
                      updatingId !== null
                    }
                    onClick={() => changePage(page + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
          </section>
          </>
          )}
        </div>
      </section>
    </main>
  );
}
