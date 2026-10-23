
"use client";

import { useCallback, useEffect, useState } from "react";

type FanRoom = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: "ACTIVE" | "CLOSED" | "ARCHIVED";
  coverImageUrl: string | null;
  memberCount: number;
  messageCount: number;
  createdAt: string;
};

type Summary = {
  totalRooms: number;
  activeRooms: number;
  closedRooms: number;
  totalMembers: number;
};

const emptyForm = {
  name: "",
  description: "",
  coverImageUrl: "",
  status: "ACTIVE" as "ACTIVE" | "CLOSED",
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

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function statusColor(status: string) {
  if (status === "ACTIVE") return "#64dba0";
  if (status === "CLOSED") return "#f5b82e";
  return "#a5acc1";
}

export default function FanRoomsManagement() {
  const [rooms, setRooms] = useState<FanRoom[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalRooms: 0,
    activeRooms: 0,
    closedRooms: 0,
    totalMembers: 0,
  });

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRoomId, setBusyRoomId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/fanrooms", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load Fan Rooms.");
      }

      setRooms(data.rooms ?? []);
      setSummary(data.summary ?? {
        totalRooms: 0,
        activeRooms: 0,
        closedRooms: 0,
        totalMembers: 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Fan Rooms."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/fanrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create Fan Room.");
      }

      setForm(emptyForm);
      setShowForm(false);
      setNotice(`Fan Room "${data.room.name}" created successfully.`);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create Fan Room."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateRoomStatus(
    room: FanRoom,
    status: FanRoom["status"]
  ) {
    setBusyRoomId(room.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/fanrooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: room.id, status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update room status.");
      }

      setNotice(`"${room.name}" is now ${status.toLowerCase()}.`);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update room status."
      );
    } finally {
      setBusyRoomId(null);
    }
  }

  const filteredRooms = rooms.filter(
    (room) => filter === "ALL" || room.status === filter
  );

  return (
    <main style={{
      minHeight: "100vh",
      background: "#10121b",
      color: "#f7f8fc",
      fontFamily: "Lato, Arial, sans-serif",
      padding: "32px",
      boxSizing: "border-box",
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 28,
      }}>
        <div>
          <p style={{
            color: "#a3a9bd",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.7,
          }}>
            SPORTYFANZ OPERATIONS
          </p>
          <h1 style={{ fontSize: 30, margin: "8px 0" }}>
            Fan Room Management
          </h1>
          <p style={{ color: "#a4abc0", margin: 0 }}>
            Create fan communities and manage their availability.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/admin/dashboard" style={{
            color: "#f5f6fa",
            textDecoration: "none",
            border: "1px solid #303447",
            borderRadius: 9,
            padding: "10px 14px",
          }}>
            ← Dashboard
          </a>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
              setNotice("");
            }}
          >
            {showForm ? "Cancel" : "+ Create Fan Room"}
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" style={{
          background: "#351f27",
          border: "1px solid #85404d",
          color: "#ffb8c2",
          borderRadius: 10,
          padding: 14,
          marginBottom: 18,
        }}>
          {error}
        </div>
      )}

      {notice && (
        <div role="status" style={{
          background: "#173127",
          border: "1px solid #286648",
          color: "#9ce8bb",
          borderRadius: 10,
          padding: 14,
          marginBottom: 18,
        }}>
          {notice}
        </div>
      )}

      {showForm && (
        <form onSubmit={createRoom} style={{
          background: "#171a26",
          border: "1px solid #292d3d",
          borderRadius: 14,
          padding: 24,
          marginBottom: 24,
          display: "grid",
          gap: 16,
          maxWidth: 760,
        }}>
          <h2 style={{ margin: 0 }}>Create a Fan Room</h2>

          <label style={{ display: "grid", gap: 7 }}>
            <span>Room name *</span>
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder="e.g. Arsenal Fans"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            <span>Description</span>
            <textarea
              maxLength={1000}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="What can fans discuss in this room?"
              rows={3}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            <span>Cover image URL (optional)</span>
            <input
              type="url"
              value={form.coverImageUrl}
              onChange={(event) =>
                setForm({ ...form, coverImageUrl: event.target.value })
              }
              placeholder="https://example.com/image.jpg"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            <span>Initial status</span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as "ACTIVE" | "CLOSED",
                })
              }
              style={inputStyle}
            >
              <option value="ACTIVE">Active — visible to fans</option>
              <option value="CLOSED">Closed — hidden from fans</option>
            </select>
          </label>

          <div>
            <button type="submit" disabled={saving} style={{
              ...buttonStyle,
              opacity: saving ? 0.65 : 1,
            }}>
              {saving ? "Creating..." : "Create Fan Room"}
            </button>
          </div>
        </form>
      )}

      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 14,
        marginBottom: 28,
      }}>
        {[
          { label: "Total Rooms", value: summary.totalRooms },
          { label: "Active Rooms", value: summary.activeRooms },
          { label: "Closed Rooms", value: summary.closedRooms },
          { label: "Active Memberships", value: summary.totalMembers },
        ].map((item) => (
          <article key={item.label} style={{
            background: "#171a26",
            border: "1px solid #292d3d",
            borderRadius: 12,
            padding: 20,
          }}>
            <p style={{ color: "#a4abc0", margin: "0 0 10px" }}>
              {item.label}
            </p>
            <strong style={{ fontSize: 28 }}>{item.value}</strong>
          </article>
        ))}
      </section>

      <section style={{
        background: "#171a26",
        border: "1px solid #292d3d",
        borderRadius: 14,
        padding: 22,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
        }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>All Fan Rooms</h2>
            <p style={{ color: "#a4abc0", margin: 0 }}>
              {filteredRooms.length} room{filteredRooms.length === 1 ? "" : "s"}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["ALL", "ACTIVE", "CLOSED", "ARCHIVED"].map((status) => (
              <button
                type="button"
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  ...buttonStyle,
                  background: filter === status ? "#f5b82e" : "#232738",
                  color: filter === status ? "#171717" : "#e7e9f2",
                }}
              >
                {status === "ALL" ? "All" : status}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadData()}
              style={{
                ...buttonStyle,
                background: "#232738",
                color: "#f7f8fc",
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#a4abc0" }}>Loading Fan Rooms...</p>
        ) : filteredRooms.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "42px 16px",
            color: "#a4abc0",
          }}>
            <h3 style={{ color: "#f7f8fc" }}>No Fan Rooms found</h3>
            <p>Create a room to make it available to fans.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredRooms.map((room) => (
              <article key={room.id} style={{
                border: "1px solid #303447",
                borderRadius: 12,
                padding: 18,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 18,
                flexWrap: "wrap",
              }}>
                <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}>
                    <h3 style={{ margin: 0 }}>{room.name}</h3>
                    <span style={{
                      color: statusColor(room.status),
                      fontSize: 11,
                      fontWeight: 800,
                      border: `1px solid ${statusColor(room.status)}`,
                      borderRadius: 20,
                      padding: "4px 8px",
                    }}>
                      {room.status}
                    </span>
                  </div>
                  <p style={{ color: "#a4abc0", margin: "8px 0" }}>
                    {room.description || "No description provided."}
                  </p>
                  <p style={{
                    color: "#a4abc0",
                    fontSize: 12,
                    margin: "6px 0",
                    overflowWrap: "anywhere",
                  }}>
                    Slug: {room.slug} · Created: {formatDate(room.createdAt)}
                  </p>
                  <p style={{ color: "#e2e5ef", fontSize: 13, margin: 0 }}>
                    {room.memberCount} members · {room.messageCount} messages
                  </p>
                </div>

                <div style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}>
                  {room.status !== "ACTIVE" && (
                    <button
                      type="button"
                      disabled={busyRoomId === room.id}
                      onClick={() => void updateRoomStatus(room, "ACTIVE")}
                      style={buttonStyle}
                    >
                      Activate
                    </button>
                  )}
                  {room.status !== "CLOSED" && (
                    <button
                      type="button"
                      disabled={busyRoomId === room.id}
                      onClick={() => void updateRoomStatus(room, "CLOSED")}
                      style={{
                        ...buttonStyle,
                        background: "#303447",
                        color: "#f7f8fc",
                      }}
                    >
                      Close
                    </button>
                  )}
                  {room.status !== "ARCHIVED" && (
                    <button
                      type="button"
                      disabled={busyRoomId === room.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Archive "${room.name}"? It will no longer appear in the active room list.`
                          )
                        ) {
                          void updateRoomStatus(room, "ARCHIVED");
                        }
                      }}
                      style={{
                        ...buttonStyle,
                        background: "#492b33",
                        color: "#ffc2cb",
                      }}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
