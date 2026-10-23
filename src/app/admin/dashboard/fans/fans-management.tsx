
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Fan = {
  id: number;
  name: string | null;
  displayName: string | null;
  username: string | null;
  email: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED" | string;
  createdAt: string;
  lastLoginAt: string | null;
  fanLevel: string;
  totalPoints: number;
  currentPoints: number;
  country: string | null;
  city: string | null;
};

type FanSummary = {
  total: number;
  active: number;
  suspended: number;
  deleted: number;
};

const panelStyle: React.CSSProperties = {
  background: "#171a27",
  border: "1px solid #292d40",
  borderRadius: 14,
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #303447",
  background: "#10121b",
  color: "#f5f6fa",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 9,
  padding: "10px 14px",
  background: "#f5b82e",
  color: "#171717",
  fontWeight: 700,
  cursor: "pointer",
};

function formatDate(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function statusColor(status: string) {
  if (status === "ACTIVE") return "#64dba0";
  if (status === "SUSPENDED") return "#ff9a76";
  if (status === "DELETED") return "#a5acc1";
  return "#f5b82e";
}

function levelLabel(level: string) {
  return level
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export default function FansManagement() {
  const [fans, setFans] = useState<Fan[]>([]);
  const [summary, setSummary] = useState<FanSummary>({
    total: 0,
    active: 0,
    suspended: 0,
    deleted: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedFan, setSelectedFan] = useState<Fan | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<
    "ACTIVE" | "SUSPENDED" | null
  >(null);

  const loadFans = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/fans", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load fan accounts.");
      }

      setFans(data.fans ?? []);
      setSummary(
        data.summary ?? {
          total: 0,
          active: 0,
          suspended: 0,
          deleted: 0,
        }
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load fan accounts."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFans();
  }, [loadFans]);

  const updateFanStatus = async (nextStatus: "ACTIVE" | "SUSPENDED") => {
    if (!selectedFan || updatingStatus) return;

    setUpdatingStatus(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/fans/${selectedFan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update fan status.");
      }

      setSelectedFan((current) =>
        current && current.id === selectedFan.id
          ? { ...current, status: data.fan.status }
          : current
      );

      setPendingStatus(null);
      await loadFans();
      setNotice(data.message || "Fan account status updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update fan status."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredFans = useMemo(() => {
    const term = search.trim().toLowerCase();

    return fans.filter((fan) => {
      const matchesStatus =
        statusFilter === "ALL" || fan.status === statusFilter;

      const matchesLevel =
        levelFilter === "ALL" || fan.fanLevel === levelFilter;

      const searchableText = [
        fan.name,
        fan.displayName,
        fan.username,
        fan.email,
        fan.country,
        fan.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesLevel &&
        (!term || searchableText.includes(term))
      );
    });
  }, [fans, search, statusFilter, levelFilter]);

  const exportFansToExcel = () => {
    if (filteredFans.length === 0) {
      setNotice("No fan accounts match the current filters.");
      return;
    }

    setError("");
    setNotice("");

    try {
      const rows = filteredFans.map((fan) => ({
        "Fan ID": fan.id,
        "Full Name": fan.name || "",
        "Display Name": fan.displayName || "",
        Username: fan.username || "",
        Email: fan.email,
        "Account Status": fan.status,
        "Fan Level": levelLabel(fan.fanLevel),
        "Current Points": fan.currentPoints,
        "Lifetime Points": fan.totalPoints,
        City: fan.city || "",
        Country: fan.country || "",
        Registered: formatDate(fan.createdAt),
        "Last Login": formatDate(fan.lastLoginAt),
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 10 },
        { wch: 24 },
        { wch: 24 },
        { wch: 20 },
        { wch: 32 },
        { wch: 16 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 24 },
        { wch: 24 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Fans");

    
      XLSX.writeFile(workbook, `FAN ACCOUNT DETAILS.xlsx`);

      setNotice(
        `Exported ${filteredFans.length} fan account(s) to Excel.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to export fan accounts."
      );
    }
  };

  const levels = useMemo(
    () => [...new Set(fans.map((fan) => fan.fanLevel))].sort(),
    [fans]
  );

  const stats = [
    { label: "Total Fans", value: summary.total, color: "#f5f6fa" },
    { label: "Active", value: summary.active, color: "#64dba0" },
    { label: "Suspended", value: summary.suspended, color: "#ff9a76" },
    { label: "Deleted", value: summary.deleted, color: "#a5acc1" },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px",
        background: "#10121b",
        color: "#f5f6fa",
        fontFamily: "Lato, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 26,
          }}
        >
          <div>
            <p
              style={{
                color: "#f5b82e",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
                margin: "0 0 8px",
              }}
            >
              SPORTYFANZ ADMIN
            </p>

            <h1 style={{ fontSize: 30, margin: "0 0 8px" }}>
              Fan Management
            </h1>

            <p style={{ color: "#a5acc1", margin: 0, fontSize: 14 }}>
              View fan accounts, account status, fan levels and points.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadFans()}
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              ...panelStyle,
              borderColor: "#8d4545",
              color: "#ff9a9a",
              marginBottom: 20,
            }}
          >
            <strong>Unable to load fans</strong>
            <p style={{ marginBottom: 0 }}>{error}</p>
            <p style={{ fontSize: 13, marginBottom: 0 }}>
              Check that the admin fans API is available and your staff
              account has the fans:support permission.
            </p>
          </div>
        )}

        {notice && (
          <p role="status" style={{ color: "#64dba0" }}>
            {notice}
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {stats.map((stat) => (
            <section key={stat.label} style={panelStyle}>
              <p
                style={{
                  color: "#a5acc1",
                  fontSize: 13,
                  margin: "0 0 12px",
                }}
              >
                {stat.label}
              </p>
              <strong
                style={{
                  display: "block",
                  fontSize: 30,
                  color: stat.color,
                }}
              >
                {loading ? "—" : stat.value.toLocaleString()}
              </strong>
            </section>
          ))}
        </div>

        <section style={panelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>
                Fan Directory
              </h2>
              <p style={{ margin: 0, color: "#a5acc1", fontSize: 13 }}>
                {filteredFans.length} of {fans.length} fan accounts
              </p>
            </div>

            <button
              type="button"
              onClick={exportFansToExcel}
              disabled={loading || filteredFans.length === 0}
              style={{
                ...buttonStyle,
                opacity:
                  loading || filteredFans.length === 0 ? 0.6 : 1,
                cursor:
                  loading || filteredFans.length === 0
                    ? "not-allowed"
                    : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ↓ Export to Excel
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <input
              aria-label="Search fans"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, username or email..."
              style={inputStyle}
            />

            <select
              aria-label="Filter by account status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="ALL">All account statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DELETED">Deleted</option>
            </select>

            <select
              aria-label="Filter by fan level"
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="ALL">All fan levels</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {levelLabel(level)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setLevelFilter("ALL");
                setSelectedFan(null);
              }}
              style={{
                ...buttonStyle,
                background: "#292d40",
                color: "#f5f6fa",
              }}
            >
              Clear filters
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#a5acc1", padding: "24px 0" }}>
              Loading fan accounts...
            </p>
          ) : filteredFans.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "44px 20px",
                color: "#a5acc1",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>♙</div>
              <strong style={{ color: "#f5f6fa" }}>
                No fan accounts found
              </strong>
              <p style={{ fontSize: 14 }}>
                Try another search or clear your filters.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 950,
                  borderCollapse: "collapse",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr style={{ background: "#10121b", color: "#a5acc1" }}>
                    {[
                      "Fan",
                      "Account Status",
                      "Fan Level",
                      "Points",
                      "Location",
                      "Joined",
                      "Last Login",
                      "Details",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: "14px 12px",
                          borderBottom: "1px solid #303447",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredFans.map((fan) => {
                    const displayName =
                      fan.displayName || fan.name || fan.username || "Unnamed fan";

                    return (
                      <tr key={fan.id}>
                        <td
                          style={{
                            padding: "15px 12px",
                            borderBottom: "1px solid #292d40",
                          }}
                        >
                          <strong style={{ display: "block" }}>
                            {displayName}
                          </strong>
                          <span
                            style={{
                              display: "block",
                              color: "#a5acc1",
                              marginTop: 5,
                            }}
                          >
                            {fan.email}
                          </span>
                          {fan.username && (
                            <span
                              style={{
                                display: "block",
                                color: "#7e879f",
                                marginTop: 3,
                              }}
                            >
                              @{fan.username}
                            </span>
                          )}
                        </td>

                        <td
                          style={{
                            padding: "15px 12px",
                            borderBottom: "1px solid #292d40",
                          }}
                        >
                          <span
                            style={{
                              color: statusColor(fan.status),
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {fan.status}
                          </span>
                        </td>

                        <td
                          style={{
                            padding: "15px 12px",
                            borderBottom: "1px solid #292d40",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {levelLabel(fan.fanLevel)}
                        </td>

                        <td
                          style={{
                            padding: "15px 12px",
                            borderBottom: "1px solid #292d40",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <strong>{fan.currentPoints.toLocaleString()}</strong>
                          <span
                            style={{
                              display: "block",
                              color: "#a5acc1",
                              marginTop: 4,
                            }}
                          >
                            {fan.totalPoints.toLocaleString()} lifetime
                          </span>
                        </td>

                        <td
                          style={{
                            padding: "15px 12px",
                            borderBottom: "1px solid #292d40",
                          }}
                        >
                          {[fan.city, fan.country].filter(Boolean).join(", ") ||
                            "—"}
                        </td>

                        <td
                          style={{
                            padding: "15px 12px",
                            borderBottom: "1px solid #292d40",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDate(fan.createdAt)}
                        </td>

                        <td
                          style={{
                            padding: "15px 12px",
                            borderBottom: "1px solid #292d40",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDate(fan.lastLoginAt)}
                        </td>

                        <td
                          style={{
                            padding: "15px 12px",
                            borderBottom: "1px solid #292d40",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedFan(fan)}
                            style={{
                              ...buttonStyle,
                              padding: "8px 11px",
                              fontSize: 12,
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedFan && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fan-details-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0, 0, 0, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setSelectedFan(null)}
          >
            <section
              style={{
                ...panelStyle,
                width: "100%",
                maxWidth: 560,
                maxHeight: "85vh",
                overflowY: "auto",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <p
                    style={{
                      color: "#f5b82e",
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: 1,
                    }}
                  >
                    FAN ACCOUNT DETAILS
                  </p>
                  <h2 id="fan-details-title" style={{ marginTop: 0 }}>
                    {selectedFan.displayName ||
                      selectedFan.name ||
                      selectedFan.username ||
                      "Unnamed fan"}
                  </h2>
                </div>

                <button
                  type="button"
                  aria-label="Close fan details"
                  onClick={() => setSelectedFan(null)}
                  style={{
                    ...buttonStyle,
                    background: "#292d40",
                    color: "#f5f6fa",
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                {[
                  ["Fan ID", String(selectedFan.id)],
                  ["Email", selectedFan.email],
                  ["Username", selectedFan.username || "—"],
                  ["Account Status", selectedFan.status],
                  ["Fan Level", levelLabel(selectedFan.fanLevel)],
                  ["Current Points", selectedFan.currentPoints.toLocaleString()],
                  ["Lifetime Points", selectedFan.totalPoints.toLocaleString()],
                  [
                    "Location",
                    [selectedFan.city, selectedFan.country]
                      .filter(Boolean)
                      .join(", ") || "—",
                  ],
                  ["Registered", formatDate(selectedFan.createdAt)],
                  ["Last Login", formatDate(selectedFan.lastLoginAt)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      background: "#10121b",
                      borderRadius: 10,
                      padding: 14,
                      overflowWrap: "anywhere",
                    }}
                  >
                    <p
                      style={{
                        color: "#a5acc1",
                        fontSize: 12,
                        margin: "0 0 8px",
                      }}
                    >
                      {label}
                    </p>
                    <strong style={{ fontSize: 14 }}>{value}</strong>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 20,
                  flexWrap: "wrap",
                }}
              >
                {selectedFan.status === "ACTIVE" && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => setPendingStatus("SUSPENDED")}
                    style={{
                      ...buttonStyle,
                      background: updatingStatus ? "#55596a" : "#8f3038",
                      color: "#ffffff",
                      opacity: updatingStatus ? 0.7 : 1,
                      cursor: updatingStatus ? "not-allowed" : "pointer",
                    }}
                  >
                    {updatingStatus ? "Updating..." : "Suspend Fan"}
                  </button>
                )}
                {selectedFan.status === "SUSPENDED" && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => setPendingStatus("ACTIVE")}
                    style={{
                      ...buttonStyle,
                      background: updatingStatus ? "#55596a" : "#f5b82e",
                      color: "#171717",
                      opacity: updatingStatus ? 0.7 : 1,
                      cursor: updatingStatus ? "not-allowed" : "pointer",
                    }}
                  >
                    {updatingStatus ? "Updating..." : "Reactivate Fan"}
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {selectedFan && pendingStatus && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fan-status-confirm-title"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0, 0, 0, 0.78)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => {
              if (!updatingStatus) setPendingStatus(null);
            }}
          >
            <section
              style={{
                ...panelStyle,
                width: "100%",
                maxWidth: 420,
                padding: 24,
                border: "1px solid #34384b",
                borderRadius: 16,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 12,
                  background:
                    pendingStatus === "SUSPENDED"
                      ? "rgba(220, 70, 80, 0.14)"
                      : "rgba(245, 184, 46, 0.14)",
                  color:
                    pendingStatus === "SUSPENDED" ? "#f06b75" : "#f5b82e",
                  fontSize: 24,
                  fontWeight: 800,
                  marginBottom: 16,
                }}
              >
                {pendingStatus === "SUSPENDED" ? "!" : "✓"}
              </div>

              <h2 id="fan-status-confirm-title" style={{ margin: "0 0 10px" }}>
                {pendingStatus === "SUSPENDED"
                  ? "Suspend this fan?"
                  : "Reactivate this fan?"}
              </h2>

              <p style={{ color: "#a5acc1", lineHeight: 1.6, margin: "0 0 24px" }}>
                {pendingStatus === "SUSPENDED"
                  ? "This fan will lose access to the SportyFanz fan app until their account is reactivated."
                  : "This fan will regain access to the SportyFanz fan app."}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() => setPendingStatus(null)}
                  style={{
                    ...buttonStyle,
                    background: "#292d40",
                    color: "#f5f6fa",
                    opacity: updatingStatus ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() => void updateFanStatus(pendingStatus)}
                  style={{
                    ...buttonStyle,
                    background:
                      pendingStatus === "SUSPENDED" ? "#8f3038" : "#f5b82e",
                    color:
                      pendingStatus === "SUSPENDED" ? "#ffffff" : "#171717",
                    opacity: updatingStatus ? 0.7 : 1,
                    cursor: updatingStatus ? "not-allowed" : "pointer",
                  }}
                >
                  {updatingStatus
                    ? "Updating..."
                    : pendingStatus === "SUSPENDED"
                      ? "Confirm Suspend"
                      : "Confirm Reactivation"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
