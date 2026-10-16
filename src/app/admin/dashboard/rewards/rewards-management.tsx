
"use client";

import { useCallback, useEffect, useState } from "react";

type Reward = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  stock: number | null;
  status: string;
  category: string | null;
};


type Redemption = {
  id: number;
  userId: number;
  rewardId: number;
  pointsSpent: number;
  status: string;
  rejectionReason: string | null;
  referenceCode: string;
  fulfilledAt: string | null;
  createdAt: string;
};


type RewardForm = {
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  pointsCost: string;
  stock: string;
  status: string;
};

const emptyForm: RewardForm = {
  name: "",
  description: "",
  imageUrl: "",
  category: "",
  pointsCost: "100",
  stock: "10",
  status: "ACTIVE",
};

const statuses = ["ACTIVE", "INACTIVE", "SOLD_OUT", "ARCHIVED"];

const redemptionStatuses = [
  "PENDING",
  "APPROVED",
  "FULFILLED",
  "CANCELLED",
  "REJECTED",
];

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
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function statusColor(status: string) {
  if (status === "ACTIVE" || status === "FULFILLED") {
    return "#58d6a1";
  }

  if (status === "PENDING" || status === "APPROVED") {
    return "#f5b82e";
  }

  return "#a5acc1";
}

export default function RewardsManagement() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [form, setForm] = useState<RewardForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [rejectionFormId, setRejectionFormId] = useState<number | null>(null);
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/rewards", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load rewards.");
      }

      setRewards(data.rewards ?? []);
      setRedemptions(data.redemptions ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load rewards."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateForm<K extends keyof RewardForm>(
    key: K,
    value: RewardForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing(reward: Reward) {
    setEditingId(reward.id);
    setForm({
      name: reward.name,
      description: reward.description ?? "",
      imageUrl: reward.imageUrl ?? "",
      category: reward.category ?? "",
      pointsCost: String(reward.pointsCost),
      stock: reward.stock === null ? "" : String(reward.stock),
      status: reward.status,
    });
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveReward(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      name: form.name,
      description: form.description,
      imageUrl: form.imageUrl,
      category: form.category,
      pointsCost: Number(form.pointsCost),
      stock: form.stock === "" ? null : Number(form.stock),
      status: form.status,
    };

    try {
      const response = await fetch(
        editingId
          ? `/api/admin/rewards/${editingId}`
          : "/api/admin/rewards",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save reward.");
      }

      setNotice(editingId ? "Reward updated." : "Reward created.");
      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save reward."
      );
    } finally {
      setSaving(false);
    }
  }

  
    async function updateRedemption(
       id: number,
       status: string,
       reason = ""
       ) {
       let rejectionReason = "";

       if (status === "REJECTED") {
          rejectionReason = reason.trim();

       if (!rejectionReason) {
         setError("A rejection reason is required.");
         setNotice("");
         return;
        }

       if (rejectionReason.length > 1000) {
         setError("The rejection reason must be 1000 characters or fewer.");
         setNotice("");
         return;
         }
       } else {
        const confirmed = window.confirm(
        `Change redemption #${id} to ${status.replaceAll("_", " ")}?`
       );

       if (!confirmed) return;
      }

     setError("");
     setNotice("");

  try {
    const response = await fetch(
      `/api/admin/rewards/redemptions/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "REJECTED" ? { rejectionReason } : {}),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to update redemption."
      );
    }

    setRejectionFormId(null);
    setRejectionReasonDraft("");
    setNotice(`Redemption #${id} updated.`);
    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to update redemption."
    );
  }
}

  const visibleRewards =
    filter === "ALL"
      ? rewards
      : rewards.filter((reward) => reward.status === filter);

  const pendingCount = redemptions.filter(
    (item) => item.status === "PENDING"
  ).length;

  const activeCount = rewards.filter(
    (item) => item.status === "ACTIVE"
  ).length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#10121b",
        color: "#f5f6fa",
        padding: "30px",
        fontFamily: "Lato, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 28,
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
            <h1 style={{ fontSize: 30, margin: 0 }}>
              Rewards Management
            </h1>
            <p style={{ color: "#9da4b8", marginTop: 9 }}>
              Manage fan rewards, points costs, inventory and redemptions.
            </p>
          </div>

          <button onClick={() => void loadData()} style={buttonStyle}>
            Refresh data
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: 14,
              borderRadius: 10,
              background: "#3b2028",
              color: "#ffb8c3",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            style={{
              padding: 14,
              borderRadius: 10,
              background: "#17352e",
              color: "#8ee4c0",
              marginBottom: 16,
            }}
          >
            {notice}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          {[
            { label: "Total rewards", value: rewards.length },
            { label: "Active rewards", value: activeCount },
            { label: "Redemption requests", value: redemptions.length },
            { label: "Pending requests", value: pendingCount },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: 20,
                border: "1px solid #282c3d",
                borderRadius: 14,
                background: "#171a26",
              }}
            >
              <p style={{ color: "#9da4b8", margin: 0, fontSize: 13 }}>
                {stat.label}
              </p>
              <strong
                style={{
                  display: "block",
                  fontSize: 28,
                  marginTop: 10,
                }}
              >
                {loading ? "…" : stat.value}
              </strong>
            </div>
          ))}
        </section>

        <section
          style={{
            padding: 24,
            background: "#171a26",
            border: "1px solid #282c3d",
            borderRadius: 16,
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontSize: 20, marginTop: 0 }}>
            {editingId ? "Edit reward" : "Create a reward"}
          </h2>

          <form onSubmit={saveReward}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <label>
                <span style={labelText}>Reward name *</span>
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. Match-day jersey"
                />
              </label>

              <label>
                <span style={labelText}>Category</span>
                <input
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. Merchandise"
                />
              </label>

              <label>
                <span style={labelText}>Points cost *</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={form.pointsCost}
                  onChange={(e) => updateForm("pointsCost", e.target.value)}
                  style={inputStyle}
                />
              </label>

              <label>
                <span style={labelText}>Stock quantity</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(e) => updateForm("stock", e.target.value)}
                  style={inputStyle}
                  placeholder="Leave empty for unlimited"
                />
              </label>

              <label>
                <span style={labelText}>Status</span>
                <select
                  value={form.status}
                  onChange={(e) => updateForm("status", e.target.value)}
                  style={inputStyle}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span style={labelText}>Image URL</span>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => updateForm("imageUrl", e.target.value)}
                  style={inputStyle}
                  placeholder="https://..."
                />
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                <span style={labelText}>Description</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Explain what the fan receives."
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button disabled={saving} type="submit" style={buttonStyle}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Create reward"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    ...buttonStyle,
                    background: "#303447",
                    color: "#fff",
                  }}
                >
                  Cancel editing
                </button>
              )}
            </div>
          </form>
        </section>

        <section
          style={{
            padding: 24,
            background: "#171a26",
            border: "1px solid #282c3d",
            borderRadius: 16,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <h2 style={{ fontSize: 20, margin: 0 }}>Reward catalogue</h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ ...inputStyle, width: "auto", minWidth: 160 }}
            >
              <option value="ALL">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p style={{ color: "#9da4b8" }}>Loading rewards...</p>
          ) : visibleRewards.length === 0 ? (
            <p style={{ color: "#9da4b8" }}>
              No rewards found. Create your first reward above.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {visibleRewards.map((reward) => (
                <article
                  key={reward.id}
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    flexWrap: "wrap",
                    padding: 16,
                    background: "#10121b",
                    border: "1px solid #282c3d",
                    borderRadius: 12,
                  }}
                >
                  {reward.imageUrl ? (
                    <img
                      src={reward.imageUrl}
                      alt={reward.name}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 10,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 10,
                        background: "#282c3d",
                        display: "grid",
                        placeItems: "center",
                        color: "#f5b82e",
                        fontSize: 26,
                      }}
                    >
                      ♛
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 180 }}>
                    <strong>{reward.name}</strong>
                    <p
                      style={{
                        color: "#9da4b8",
                        fontSize: 13,
                        margin: "6px 0",
                      }}
                    >
                      {reward.category || "Uncategorised"} ·{" "}
                      {reward.pointsCost.toLocaleString()} points · Stock:{" "}
                      {reward.stock === null ? "Unlimited" : reward.stock}
                    </p>
                    <span
                      style={{
                        color: statusColor(reward.status),
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {reward.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <button
                    onClick={() => startEditing(reward)}
                    style={{
                      ...buttonStyle,
                      background: "#303447",
                      color: "#fff",
                    }}
                  >
                    Edit reward
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            padding: 24,
            background: "#171a26",
            border: "1px solid #282c3d",
            borderRadius: 16,
          }}
        >
          <h2 style={{ fontSize: 20, marginTop: 0 }}>
            Redemption requests
          </h2>
          <p style={{ color: "#9da4b8", fontSize: 13 }}>
            Review requests and record their progress. User IDs and reference
            codes are shown for identification.
          </p>

          {loading ? (
            <p style={{ color: "#9da4b8" }}>Loading requests...</p>
          ) : redemptions.length === 0 ? (
            <p style={{ color: "#9da4b8" }}>
              No redemption requests yet.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {redemptions
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
                .map((item) => (
                  <article
                    key={item.id}
                    style={{
                      padding: 16,
                      border: "1px solid #303447",
                      borderRadius: 12,
                      background: "#10121b",
                      display: "flex",
                      gap: 16,
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 200, flex: 1 }}>
                      <strong>Request #{item.id}</strong>
                      <p style={mutedText}>
                        Reward ID: {item.rewardId} · Fan ID: {item.userId}
                      </p>
                      <p style={mutedText}>
                        {item.pointsSpent.toLocaleString()} points ·{" "}
                        {formatDate(item.createdAt)}
                      </p>
                      <p style={mutedText}>
                        Ref: {item.referenceCode}
                      </p>
                      <span
                        style={{
                          color: statusColor(item.status),
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                       >
                       {item.status.replaceAll("_", " ")}
                       </span>

                        {item.status === "REJECTED" && item.rejectionReason && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          borderRadius: 10,
                          background: "#3b2028",
                          border: "1px solid #70404b",
                          maxWidth: 550,
                        }}
                      >
                       <strong style={{ color: "#ffb8c3", fontSize: 12 }}>
                        Rejection reason
                       </strong>
                        <p
                          style={{
                           color: "#f5d5da",
                           fontSize: 13,
                           lineHeight: 1.5,
                           margin: "6px 0 0",
                           whiteSpace: "pre-wrap",
                           overflowWrap: "anywhere",
                        }}
                        >
                           {item.rejectionReason}
                        </p>
                       </div>
                     )}

                     {item.fulfilledAt && (
                       <p style={mutedText}>
                          Fulfilled: {formatDate(item.fulfilledAt)}
                       </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <select
                        aria-label={`Status for redemption ${item.id}`}
                        id={`redemption-status-${item.id}`}
                        defaultValue={item.status}
                        style={{
                          ...inputStyle,
                          width: "auto",
                          minWidth: 150,
                        }}
                        disabled={
                          item.status === "FULFILLED" ||
                          item.status === "CANCELLED" ||
                          item.status === "REJECTED"
                        }
                      >
                        {redemptionStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>

                      <button
                        style={buttonStyle}
                        disabled={
                          item.status === "FULFILLED" ||
                          item.status === "CANCELLED" ||
                          item.status === "REJECTED"
                        }
                        onClick={() => {
                           const select = document.getElementById(
                               `redemption-status-${item.id}`
                            ) as HTMLSelectElement | null;

                           if (!select) return;

                           if (select.value === "REJECTED") {
                              setError("");
                              setNotice("");
                              setRejectionFormId(item.id);
                              setRejectionReasonDraft(item.rejectionReason ?? "");
                             return;
                           }

                           void updateRedemption(item.id, select.value);
                           }}
                      >
                        Update
                      </button>
                    </div>
                    {rejectionFormId === item.id && (
                    <div
                      style={{
                         width: "100%",
                         flexBasis: "100%",
                         padding: 16,
                         borderRadius: 12,
                         background: "#171a26",
                         border: "1px solid #70404b",
                         boxSizing: "border-box",
                       }}
                     >
                     <label
                        htmlFor={`rejection-reason-${item.id}`}
                        style={{
                           display: "block",
                           color: "#ffb8c3",
                           fontSize: 14,
                           fontWeight: 700,
                           marginBottom: 8,
                         }}
                      >
                        Rejection reason *
                      </label>

                      <p style={{ ...mutedText, fontSize: 13 }}>
                          Explain why this redemption is being rejected. The fan will be
                          able to see this reason in their reward history.
                      </p>

                     <textarea
                        id={`rejection-reason-${item.id}`}
                        value={rejectionReasonDraft}
                        onChange={(event) =>
                        setRejectionReasonDraft(event.target.value)
                        }
                          maxLength={1000}
                          rows={3}
                          required
                          placeholder="e.g. Reward temporarily unavailable."
                          style={{
                              ...inputStyle,
                              resize: "vertical",
                              marginTop: 8,
                              }}
                           />

                           <p style={{ ...mutedText, textAlign: "right" }}>
                              {rejectionReasonDraft.length}/1000 characters
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
                         onClick={() => {
                          setRejectionFormId(null);
                          setRejectionReasonDraft("");
                        }}
                        style={{
                         ...buttonStyle,
                         background: "#303447",
                         color: "#fff",
                       }}
                     >
                       Cancel
                    </button>

                    <button
                        type="button"
                        disabled={!rejectionReasonDraft.trim()}
                       onClick={() =>
                          void updateRedemption(
                          item.id,
                          "REJECTED",
                          rejectionReasonDraft
                         )
                       }
                     style={{
                       ...buttonStyle,
                       opacity: rejectionReasonDraft.trim() ? 1 : 0.5,
                      }}
                    >
                      Confirm rejection
                   </button>
                  </div>
                  </div>
                     )}
                  </article>
                ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const labelText: React.CSSProperties = {
  display: "block",
  color: "#b8bfd0",
  fontSize: 13,
  marginBottom: 8,
};

const mutedText: React.CSSProperties = {
  color: "#9da4b8",
  fontSize: 12,
  margin: "7px 0",
};
