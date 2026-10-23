"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";

type PollOption = {
  id: number;
  label: string;
  votes: number;
  percentage: number;
};

type Poll = {
  id: number;
  question: string;
  description: string | null;
  status: string;
  scheduleStatus: string;
  pointsReward: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  totalVotes: number;
  options: PollOption[];
};

type PollForm = {
  question: string;
  description: string;
  options: string[];
  pointsReward: string;
  status: "DRAFT" | "ACTIVE";
  startsAt: string;
  endsAt: string;
};

const emptyForm: PollForm = {
  question: "",
  description: "",
  options: ["", "", "", ""],
  pointsReward: "10",
  status: "DRAFT",
  startsAt: "",
  endsAt: "",
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
  if (!value) return "Not scheduled";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function statusColor(status: string) {
  if (status === "ACTIVE") return "#64dba0";
  if (status === "SCHEDULED") return "#f5b82e";
  if (status === "CLOSED") return "#a5acc1";
  return "#91a8ff";
}

export default function PollsManagement() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [form, setForm] = useState<PollForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyPollId, setBusyPollId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [confirmPoll, setConfirmPoll] = useState<Poll | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/polls", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load polls.");
      }

      setPolls(data.polls ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load polls."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  function exportPollsToExcel() {
  if (filteredPolls.length === 0) {
    setNotice("There are no polls to export.");
    return;
  }

  const pollRows = filteredPolls.map((poll) => ({
    "Poll ID": poll.id,
    Question: poll.question,
    Description: poll.description ?? "",
    Status: poll.status,
    "Schedule Status": poll.scheduleStatus,
    "Points Reward": poll.pointsReward,
    "Start Date": poll.startsAt ?? "",
    Deadline: poll.endsAt ?? "",
    "Created At": poll.createdAt,
    "Total Votes": poll.totalVotes,
    "Number of Options": poll.options.length,
  }));

  const optionRows = filteredPolls.flatMap((poll) =>
    poll.options.map((option, index) => ({
      "Poll ID": poll.id,
      Question: poll.question,
      "Option Label": String.fromCharCode(65 + index),
      "Option Text": option.label,
      Votes: option.votes,
      "Vote Percentage": option.percentage,
    }))
  );

  const workbook = XLSX.utils.book_new();

  const pollsSheet = XLSX.utils.json_to_sheet(pollRows);
  const optionsSheet = XLSX.utils.json_to_sheet(optionRows);

  XLSX.utils.book_append_sheet(workbook, pollsSheet, "Polls");
  XLSX.utils.book_append_sheet(workbook, optionsSheet, "Poll Options");

  XLSX.writeFile(
    workbook,
    `SportyFanz_Polls_${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  setNotice("Polls exported to Excel successfully.");
  setError("");
 }

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateForm<K extends keyof PollForm>(
    key: K,
    value: PollForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateOption(index: number, value: string) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? value : option
      ),
    }));
  }

  function addOption() {
    if (form.options.length >= 10) return;

    updateForm("options", [...form.options, ""]);
  }

  function removeOption(index: number) {
    if (form.options.length <= 2) return;

    updateForm(
      "options",
      form.options.filter((_, optionIndex) => optionIndex !== index)
    );
  }

  async function createPoll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          options: form.options.map((option) => option.trim()),
          pointsReward: Number(form.pointsReward),
          startsAt: form.startsAt
            ? new Date(form.startsAt).toISOString()
            : null,
          endsAt: form.endsAt
            ? new Date(form.endsAt).toISOString()
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create the poll.");
      }

      setNotice("Poll created successfully.");
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create the poll."
      );
    } finally {
      setSaving(false);
    }
  }

  
function changeStatus(poll: Poll) {
  setError("");
  setNotice("");
  setConfirmPoll(poll);
}

async function confirmStatusChange() {
  if (!confirmPoll) return;

  const poll = confirmPoll;
  const nextStatus = poll.status === "DRAFT" ? "ACTIVE" : "CLOSED";

  setBusyPollId(poll.id);
  setError("");
  setNotice("");
  setConfirmPoll(null);

  try {
    const response = await fetch(`/api/admin/polls/${poll.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to update the poll.");
    }

    setNotice(data.message || "Poll status updated.");
    await loadData();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Unable to update the poll."
    );
  } finally {
    setBusyPollId(null);
  }
}


  const filteredPolls = polls.filter((poll) => {
    if (filter === "ALL") return true;
    return poll.scheduleStatus === filter;
  });

  const activeCount = polls.filter(
    (poll) => poll.status === "ACTIVE"
  ).length;

  const draftCount = polls.filter(
    (poll) => poll.status === "DRAFT"
  ).length;

  const totalVotes = polls.reduce(
    (total, poll) => total + poll.totalVotes,
    0
  );

  const panelStyle: React.CSSProperties = {
    background: "#141722",
    border: "1px solid #303447",
    borderRadius: 14,
    padding: 20,
    minWidth: 0,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0d14",
        color: "#f5f6fa",
        padding: 28,
        fontFamily: "Lato, Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <p style={{ color: "#f5b82e", fontSize: 12, fontWeight: 800 }}>
            SPORTYFANZ ADMIN
          </p>
          <h1 style={{ fontSize: 28, margin: "6px 0" }}>
            Polls Management
          </h1>
          <p style={{ color: "#a5acc1", margin: 0 }}>
            Create polls, manage publication, and monitor fan participation.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void loadData()}
            style={{
              ...buttonStyle,
              background: "#222637",
              color: "#f5f6fa",
              border: "1px solid #303447",
            }}
          >
            Refresh
          </button>

          <button
            type="button"
            style={buttonStyle}
            onClick={() => {
              setShowForm((current) => !current);
              setError("");
              setNotice("");
            }}
          >
            {showForm ? "Cancel" : "+ Create Poll"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total Polls", value: polls.length },
          { label: "Active Polls", value: activeCount },
          { label: "Draft Polls", value: draftCount },
          { label: "Total Votes", value: totalVotes },
        ].map((item) => (
          <section key={item.label} style={panelStyle}>
            <p style={{ color: "#a5acc1", margin: 0, fontSize: 13 }}>
              {item.label}
            </p>
            <strong style={{ display: "block", fontSize: 28, marginTop: 10 }}>
              {item.value}
            </strong>
          </section>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          style={{
            background: "#351c23",
            border: "1px solid #75313d",
            padding: 12,
            borderRadius: 9,
            color: "#ffb7c0",
          }}
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          style={{
            background: "#183126",
            border: "1px solid #286b4c",
            padding: 12,
            borderRadius: 9,
            color: "#a7f0ca",
          }}
        >
          {notice}
        </p>
      )}

      {showForm && (
        <section style={{ ...panelStyle, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Create a poll</h2>
          <p style={{ color: "#a5acc1", fontSize: 13 }}>
            Add a question and at least two options. You can save it as a draft
            or activate it immediately.
          </p>

          <form onSubmit={createPoll}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
              }}
            >
              <label style={{ display: "block" }}>
                <span style={{ display: "block", marginBottom: 8 }}>
                  Poll question *
                </span>
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  value={form.question}
                  onChange={(event) =>
                    updateForm("question", event.target.value)
                  }
                  placeholder="What do you think about..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </label>

              <label style={{ display: "block" }}>
                <span style={{ display: "block", marginBottom: 8 }}>
                  Description (optional)
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  placeholder="Add context for fans..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </label>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3>Answer options *</h3>

              {form.options.map((option, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ color: "#a5acc1", minWidth: 24 }}>
                    {String.fromCharCode(65 + index)}.
                  </span>

                  <input
                    required
                    maxLength={200}
                    value={option}
                    onChange={(event) =>
                      updateOption(index, event.target.value)
                    }
                    placeholder={`Option ${index + 1}`}
                    style={inputStyle}
                  />

                  {form.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      style={{
                        ...buttonStyle,
                        background: "#352029",
                        color: "#ffb7c0",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              {form.options.length < 10 && (
                <button
                  type="button"
                  onClick={addOption}
                  style={{
                    ...buttonStyle,
                    background: "#222637",
                    color: "#f5f6fa",
                    border: "1px solid #303447",
                    marginTop: 4,
                  }}
                >
                  + Add option
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 16,
                marginTop: 22,
              }}
            >
              <label>
                <span style={{ display: "block", marginBottom: 8 }}>
                  Points reward per vote
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  value={form.pointsReward}
                  onChange={(event) =>
                    updateForm("pointsReward", event.target.value)
                  }
                  style={inputStyle}
                />
              </label>

              <label>
                <span style={{ display: "block", marginBottom: 8 }}>
                  Start date and time
                </span>
                <input
                    type="datetime-local"
                    required
                    value={form.startsAt}
                    onChange={(event) =>
                      updateForm("startsAt", event.target.value)
                    }
                    onClick={(event) => {
                    const input = event.currentTarget;
                      if ("showPicker" in HTMLInputElement.prototype) {
                        input.showPicker();
                     }
                    }}
                    style={inputStyle}
                  />
              </label>

              <label>
                <span style={{ display: "block", marginBottom: 8 }}>
                  Deadline
                </span>
                <input
                  type="datetime-local"
                  required
                  value={form.endsAt}
                  onChange={(event) =>
                    updateForm("endsAt", event.target.value)
                  }
                 onClick={(event) => {
                 const input = event.currentTarget;
                   if ("showPicker" in HTMLInputElement.prototype) {
                    input.showPicker();
                  }
                  }}
                  style={inputStyle}
                />
              </label>

              <label>
                <span style={{ display: "block", marginBottom: 8 }}>
                  Initial status
                </span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm(
                      "status",
                      event.target.value as "DRAFT" | "ACTIVE"
                    )
                  }
                  style={inputStyle}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...buttonStyle,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Creating..." : "Create Poll"}
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  ...buttonStyle,
                  background: "#222637",
                  color: "#f5f6fa",
                  border: "1px solid #303447",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section style={panelStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>All polls</h2>
            <p style={{ color: "#a5acc1", fontSize: 13 }}>
              Review options and vote totals for every poll.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
           <button
             type="button"
             onClick={exportPollsToExcel}
             style={{
               ...buttonStyle,
               background: "#222637",
               color: "#f5f6fa",
               border: "1px solid #303447",
             }}
          >
           Export to Excel
         </button>

          <select
            aria-label="Filter polls by status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            style={{ ...inputStyle, width: "auto", minWidth: 160 }}
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
         </div>
        </div>

        {loading ? (
          <p style={{ color: "#a5acc1" }}>Loading polls...</p>
        ) : filteredPolls.length === 0 ? (
          <p style={{ color: "#a5acc1" }}>
            No polls found for this filter.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {filteredPolls.map((poll) => (
              <article
                key={poll.id}
                style={{
                  border: "1px solid #303447",
                  borderRadius: 12,
                  padding: 18,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                    <h3 style={{ margin: "0 0 8px", overflowWrap: "anywhere" }}>
                      {poll.question}
                    </h3>

                    {poll.description && (
                      <p style={{ color: "#a5acc1", margin: "0 0 10px" }}>
                        {poll.description}
                      </p>
                    )}

                    <p style={{ color: "#a5acc1", fontSize: 12 }}>
                      Created: {formatDate(poll.createdAt)}
                    </p>
                  </div>

                  <span
                    style={{
                      color: statusColor(poll.scheduleStatus),
                      border: `1px solid ${statusColor(poll.scheduleStatus)}`,
                      borderRadius: 20,
                      padding: "5px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {poll.scheduleStatus}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 18,
                    flexWrap: "wrap",
                    color: "#a5acc1",
                    fontSize: 13,
                    margin: "12px 0 18px",
                  }}
                >
                  <span>Votes: <strong style={{ color: "#f5f6fa" }}>{poll.totalVotes}</strong></span>
                  <span>Reward: <strong style={{ color: "#f5b82e" }}>{poll.pointsReward} points</strong></span>
                  <span>Starts: {formatDate(poll.startsAt)}</span>
                  <span>Ends: {formatDate(poll.endsAt)}</span>
                </div>

                <h4 style={{ margin: "0 0 12px" }}>Option results</h4>

                <div style={{ display: "grid", gap: 12 }}>
                  {poll.options.map((option, index) => (
                    <div key={option.id}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          fontSize: 13,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ overflowWrap: "anywhere" }}>
                          {String.fromCharCode(65 + index)}. {option.label}
                        </span>
                        <strong style={{ whiteSpace: "nowrap" }}>
                          {option.votes} ({option.percentage}%)
                        </strong>
                      </div>

                      <div
                        style={{
                          height: 7,
                          background: "#262a39",
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${option.percentage}%`,
                            background: "#f5b82e",
                            borderRadius: 10,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {poll.status !== "CLOSED" && (
                  <div style={{ marginTop: 18 }}>
                    <button
                      type="button"
                      disabled={busyPollId === poll.id}
                      onClick={() => void changeStatus(poll)}
                      style={{
                        ...buttonStyle,
                        background:
                          poll.status === "DRAFT" ? "#f5b82e" : "#352029",
                        color:
                          poll.status === "DRAFT" ? "#171717" : "#ffb7c0",
                        opacity: busyPollId === poll.id ? 0.6 : 1,
                      }}
                    >
                      {busyPollId === poll.id
                        ? "Updating..."
                        : poll.status === "DRAFT"
                          ? "Activate poll"
                          : "Close poll"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
       
      {confirmPoll && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmPoll(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="poll-confirm-title"
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#141722",
              border: "1px solid #303447",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
              color: "#f5f6fa",
              fontFamily: "Lato, Arial, sans-serif",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#302817",
                color: "#f5b82e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                marginBottom: 16,
              }}
            >
              !
            </div>

            <h2
              id="poll-confirm-title"
              style={{ margin: "0 0 10px", fontSize: 21 }}
            >
              {confirmPoll.status === "DRAFT"
                ? "Activate this poll?"
                : "Close this poll?"}
            </h2>

            <p style={{ color: "#a5acc1", lineHeight: 1.6, margin: "0 0 12px" }}>
              {confirmPoll.status === "DRAFT"
                ? "Fans will be able to see this poll according to its schedule."
                : "Fans will no longer be able to vote in this poll."}
            </p>

            <div
              style={{
                background: "#10121b",
                border: "1px solid #303447",
                borderRadius: 10,
                padding: 12,
                marginBottom: 22,
                overflowWrap: "anywhere",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "#f5f6fa" }}>
                {confirmPoll.question}
              </p>
            </div>

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
                onClick={() => setConfirmPoll(null)}
                style={{
                  ...buttonStyle,
                  background: "#222637",
                  color: "#f5f6fa",
                  border: "1px solid #303447",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={busyPollId === confirmPoll.id}
                onClick={() => void confirmStatusChange()}
                style={{
                  ...buttonStyle,
                  background:
                    confirmPoll.status === "DRAFT" ? "#f5b82e" : "#a83c4d",
                  color:
                    confirmPoll.status === "DRAFT" ? "#171717" : "#ffffff",
                  opacity: busyPollId === confirmPoll.id ? 0.6 : 1,
                }}
              >
                {confirmPoll.status === "DRAFT"
                  ? "Activate Poll"
                  : "Close Poll"}
              </button>
            </div>
          </section>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <a
          href="/admin/dashboard"
          style={{ color: "#f5b82e", textDecoration: "none" }}
        >
          ← Back to Admin Dashboard
        </a>
      </div>
    </main>
  );
}