"use client";

import { useCallback, useEffect, useState } from "react";

type KycStatus = "PENDING" | "APPROVED" | "REJECTED";
type KycSex = "FEMALE" | "MALE";

type KycSubmission = {
  id: number;
  userId: number;
  user: {
    name: string | null;
    username: string | null;
  };
  whatsappNumber: string;
  country: string;
  state: string;
  sex: KycSex;
  dateOfBirth: string;
  status: KycStatus;
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  submissions?: KycSubmission[];
  error?: string;
};

const FILTERS: Array<"ALL" | KycStatus> = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
];

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function KycManagement() {
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [filter, setFilter] = useState<"ALL" | KycStatus>("PENDING");
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingReview, setPendingReview] = useState<{
    submissionId: number;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = filter === "ALL" ? "" : `?status=${filter}`;
      const response = await fetch(`/api/admin/kyc${query}`, {
        cache: "no-store",
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load KYC submissions.");
      }

      setSubmissions(data.submissions ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load KYC submissions."
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function reviewSubmission(
    submissionId: number,
    decision: "APPROVED" | "REJECTED"
  ) {
    setError("");
    setMessage("");

    const rejectionReason = rejectionReasons[submissionId]?.trim() ?? "";

    if (decision === "REJECTED" && !rejectionReason) {
      setError("Enter a rejection reason before rejecting this submission.");
      return;
    }

    setBusyId(submissionId);

    try {
      const response = await fetch("/api/admin/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          decision,
          rejectionReason:
            decision === "REJECTED" ? rejectionReason : undefined,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        progressionPointsAwarded?: number;
      };

      if (!response.ok) {
        throw new Error(data.error || "Unable to review this submission.");
      }

      setPendingReview(null);

      setMessage(
        decision === "APPROVED"
          ? `KYC approved. ${data.progressionPointsAwarded ?? 0} progression points awarded.`
          : "KYC submission rejected."
      );

      await loadSubmissions();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to review this submission."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="kyc-management">
      <div className="kyc-toolbar">
        <div>
          <h2>Submissions</h2>
          <p>Personal KYC details are visible only to authorised reviewers.</p>
        </div>

        <button
          type="button"
          className="kyc-refresh"
          onClick={() => void loadSubmissions()}
          disabled={loading || busyId !== null}
        >
          Refresh
        </button>
      </div>

      <div className="kyc-filters" aria-label="Filter submissions">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
            disabled={loading || busyId !== null}
          >
            {item === "ALL" ? "All" : item}
          </button>
        ))}
      </div>

      {error && <p className="kyc-alert error" role="alert">{error}</p>}
      {message && <p className="kyc-alert success" role="status">{message}</p>}

      {loading ? (
        <p className="kyc-empty">Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <p className="kyc-empty">No submissions found for this filter.</p>
      ) : (
        <div className="kyc-list">
          {submissions.map((submission) => (
            <article className="kyc-card" key={submission.id}>
              <div className="kyc-card-top">
                <div>
                  <p className="kyc-account-name">
                    {submission.user.name ||
                      submission.user.username ||
                      "Name not provided"}
                  </p>
                  <p className="kyc-submission-id">
                    Submission #{submission.id} · Fan #{submission.userId}
                  </p>
                  <span
                    className={`kyc-status ${submission.status.toLowerCase()}`}
                  >
                    {submission.status}
                  </span>
                </div>

                <div className="kyc-submitted">
                  <span>Submitted</span>
                  <strong>{formatDate(submission.createdAt)}</strong>
                </div>
              </div>

              <dl className="kyc-details">
                <div>
                  <dt>WhatsApp number</dt>
                  <dd>{submission.whatsappNumber}</dd>
                </div>
                <div>
                  <dt>Country</dt>
                  <dd>{submission.country}</dd>
                </div>
                <div>
                  <dt>State</dt>
                  <dd>{submission.state}</dd>
                </div>
                <div>
                  <dt>Sex</dt>
                  <dd>{submission.sex}</dd>
                </div>
                <div>
                  <dt>Date of birth</dt>
                  <dd>{submission.dateOfBirth}</dd>
                </div>
              </dl>

              {submission.status === "REJECTED" &&
                submission.rejectionReason && (
                  <p className="kyc-reason">
                    <strong>Rejection reason:</strong>{" "}
                    {submission.rejectionReason}
                  </p>
                )}

              {submission.status !== "PENDING" && (
                <p className="kyc-reviewed">
                  Reviewed {formatDate(submission.reviewedAt)}
                </p>
              )}

              {submission.status === "PENDING" && (
                <div className="kyc-review-actions">
                  <label>
                    Rejection reason
                    <textarea
                      value={rejectionReasons[submission.id] ?? ""}
                      onChange={(event) =>
                        setRejectionReasons((current) => ({
                          ...current,
                          [submission.id]: event.target.value,
                        }))
                      }
                      placeholder="Required only when rejecting"
                      maxLength={1000}
                      rows={2}
                      disabled={busyId === submission.id}
                    />
                  </label>

                  <div className="kyc-buttons">
                    <button
                      type="button"
                      className="kyc-reject"
                      onClick={() => {
                        setError("");
                        setMessage("");
                        if (!(rejectionReasons[submission.id]?.trim())) {
                          setError("Enter a rejection reason before rejecting this submission.");
                          return;
                        }
                        setPendingReview({
                          submissionId: submission.id,
                          decision: "REJECTED",
                        });
                      }}
                      disabled={busyId !== null}
                    >
                      {busyId === submission.id ? "Reviewing…" : "Reject"}
                    </button>

                    <button
                      type="button"
                      className="kyc-approve"
                      onClick={() => {
                        setError("");
                        setMessage("");
                        setPendingReview({
                          submissionId: submission.id,
                          decision: "APPROVED",
                        });
                      }}
                      disabled={busyId !== null}
                    >
                      {busyId === submission.id ? "Reviewing…" : "Approve · +40"}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {pendingReview && (() => {
        const selectedSubmission = submissions.find(
          (item) => item.id === pendingReview.submissionId
        );

        if (!selectedSubmission) return null;

        const approving = pendingReview.decision === "APPROVED";
        const fanName =
          selectedSubmission.user.name ||
          selectedSubmission.user.username ||
          "this fan";

        return (
          <div className="kyc-modal-overlay">
            <section
              className="kyc-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="kyc-confirm-title"
            >
              <div className="kyc-modal-icon">
                {approving ? "✓" : "!"}
              </div>

              <h2 id="kyc-confirm-title">
                {approving ? "Approve KYC submission?" : "Reject KYC submission?"}
              </h2>

              <p className="kyc-modal-fan">{fanName}</p>

              <p className="kyc-modal-description">
                {approving
                  ? "You are about to approve this fan's KYC details. This will award 40 progression points if the KYC reward has not already been issued."
                  : "You are about to reject this fan's KYC submission. The rejection reason you provided will be recorded."}
              </p>

              <div className="kyc-modal-actions">
                <button
                  type="button"
                  className="kyc-modal-cancel"
                  onClick={() => setPendingReview(null)}
                  disabled={busyId !== null}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={approving ? "kyc-modal-confirm" : "kyc-modal-reject"}
                  onClick={() =>
                    void reviewSubmission(
                      pendingReview.submissionId,
                      pendingReview.decision
                    )
                  }
                  disabled={busyId !== null}
                >
                  {busyId === pendingReview.submissionId
                    ? "Processing…"
                    : approving
                      ? "Confirm Approval"
                      : "Confirm Rejection"}
                </button>
              </div>
            </section>
          </div>
        );
      })()}

      <style>{`
        .kyc-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(0, 0, 0, .75);
          backdrop-filter: blur(4px);
        }
        .kyc-confirm-modal {
          width: 100%;
          max-width: 440px;
          box-sizing: border-box;
          padding: 30px;
          border: 1px solid #353b4d;
          border-radius: 18px;
          background: #151925;
          color: #f7f8fc;
          text-align: center;
          box-shadow: 0 24px 80px rgba(0, 0, 0, .45);
        }
        .kyc-modal-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          margin: 0 auto 18px;
          border-radius: 50%;
          background: #3c3219;
          color: #f5b82e;
          font-size: 25px;
          font-weight: 800;
        }
        .kyc-confirm-modal h2 {
          margin: 0 0 12px;
          font-size: 20px;
        }
        .kyc-modal-fan {
          margin: 0 0 10px;
          color: #f5b82e;
          font-size: 16px;
          font-weight: 800;
        }
        .kyc-modal-description {
          margin: 0;
          color: #a3a9bd;
          font-size: 13px;
          line-height: 1.7;
        }
        .kyc-modal-actions {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 26px;
        }
        .kyc-modal-actions button {
          min-height: 42px;
          padding: 10px 16px;
          border: 1px solid #3a3e4e;
          border-radius: 9px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .kyc-modal-cancel {
          background: #191d2a;
          color: #f7f8fc;
        }
        .kyc-modal-confirm {
          border-color: #f5b82e !important;
          background: #f5b82e;
          color: #10121b;
        }
        .kyc-modal-reject {
          border-color: #a44354 !important;
          background: #a44354;
          color: white;
        }
        .kyc-modal-actions button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }
        .kyc-management { color: #f7f8fc; }
        .kyc-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        .kyc-toolbar h2 { margin: 0 0 6px; font-size: 21px; }
        .kyc-toolbar p { margin: 0; color: #a3a9bd; font-size: 13px; }
        .kyc-refresh, .kyc-filters button, .kyc-buttons button {
          border: 1px solid #3a3e4e;
          border-radius: 9px;
          padding: 10px 14px;
          color: #f7f8fc;
          background: #191d2a;
          font: inherit;
          cursor: pointer;
        }
        .kyc-refresh:disabled, .kyc-filters button:disabled,
        .kyc-buttons button:disabled { opacity: .55; cursor: not-allowed; }
        .kyc-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 22px;
        }
        .kyc-filters button.active {
          background: #f5b82e;
          border-color: #f5b82e;
          color: #10121b;
          font-weight: 800;
        }
        .kyc-alert {
          padding: 12px 14px;
          border-radius: 9px;
          line-height: 1.5;
        }
        .kyc-alert.error { background: #3a2027; color: #ffb7c2; }
        .kyc-alert.success { background: #183629; color: #9ce8b9; }
        .kyc-empty {
          padding: 28px;
          border: 1px solid #292d3d;
          border-radius: 12px;
          color: #a3a9bd;
          text-align: center;
        }
        .kyc-list { display: grid; gap: 16px; }
        .kyc-card {
          padding: 22px;
          border: 1px solid #292d3d;
          border-radius: 14px;
          background: #151925;
        }
        .kyc-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }
        .kyc-submission-id {
          margin: 0 0 10px;
          color: #a3a9bd;
          font-size: 12px;
        }
        .kyc-status {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .5px;
        }
        .kyc-status.pending { background: #3c3219; color: #f5d47d; }
        .kyc-status.approved { background: #183629; color: #9ce8b9; }
        .kyc-status.rejected { background: #3a2027; color: #ffb7c2; }
        .kyc-submitted {
          display: grid;
          gap: 5px;
          text-align: right;
          color: #a3a9bd;
          font-size: 12px;
        }
        .kyc-submitted strong { color: #f7f8fc; font-weight: 600; }
        .kyc-details {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin: 0;
        }
        .kyc-details div { min-width: 0; }
        .kyc-details dt {
          margin-bottom: 6px;
          color: #8e95aa;
          font-size: 12px;
        }
        .kyc-details dd {
          margin: 0;
          overflow-wrap: anywhere;
          color: #f7f8fc;
          font-size: 14px;
        }
        .kyc-reason, .kyc-reviewed {
          margin: 18px 0 0;
          color: #a3a9bd;
          font-size: 13px;
          line-height: 1.6;
        }
        .kyc-review-actions {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: end;
          gap: 16px;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #292d3d;
        }
        .kyc-review-actions label {
          display: grid;
          gap: 8px;
          color: #a3a9bd;
          font-size: 12px;
        }
        .kyc-review-actions textarea {
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
          border: 1px solid #3a3e4e;
          border-radius: 8px;
          padding: 10px;
          background: #10121b;
          color: #f7f8fc;
          font: inherit;
        }
        .kyc-buttons { display: flex; gap: 8px; }
        .kyc-buttons .kyc-reject {
          border-color: #7a3845;
          color: #ffb7c2;
        }
        .kyc-buttons .kyc-approve {
          border-color: #f5b82e;
          background: #f5b82e;
          color: #10121b;
          font-weight: 800;
        }
        @media (max-width: 760px) {
          .kyc-details { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .kyc-review-actions { grid-template-columns: 1fr; }
          .kyc-buttons { justify-content: flex-end; }
        }
        @media (max-width: 480px) {
          .kyc-card { padding: 16px; }
          .kyc-card-top { flex-direction: column; }
          .kyc-submitted { text-align: left; }
          .kyc-details { grid-template-columns: 1fr; }
          .kyc-buttons { flex-direction: column-reverse; }
        }
      `}</style>
    </section>
  );
}