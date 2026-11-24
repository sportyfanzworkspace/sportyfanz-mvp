"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Clock3,
  CheckCircle2,
  XCircle,
  LoaderCircle,
} from "lucide-react";

type KycStatus = "PENDING" | "APPROVED" | "REJECTED";
type KycSex = "FEMALE" | "MALE";

type KycSubmission = {
  id: number;
  whatsappNumber: string;
  country: string;
  state: string;
  sex: KycSex;
  dateOfBirth: string;
  status: KycStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const statusDetails: Record<
  KycStatus,
  { label: string; description: string }
> = {
  PENDING: {
    label: "Under Review",
    description: "Your details have been submitted and are awaiting admin review.",
  },
  APPROVED: {
    label: "Verified",
    description: "Your KYC verification has been approved. Your 40 progression points are awarded.",
  },
  REJECTED: {
    label: "Not Approved",
    description: "Your previous submission was not approved. Review the reason below and submit again.",
  },
};

export default function KycVerification() {
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [canSubmit, setCanSubmit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [sex, setSex] = useState<KycSex | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const loadKyc = useCallback(async () => {
    try {
      const response = await fetch("/api/kyc", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load KYC information.");
      }

      setSubmissions(
        Array.isArray(data.submissions) ? data.submissions : []
      );
      setCanSubmit(data.canSubmit === true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load KYC information."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKyc();
  }, [loadKyc]);

  const latestSubmission = submissions[0] ?? null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whatsappNumber,
          country,
          state,
          sex,
          dateOfBirth,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit your KYC details.");
      }

      setMessage("Your KYC details have been submitted successfully.");
      setWhatsappNumber("");
      setCountry("");
      setState("");
      setSex("");
      setDateOfBirth("");

      await loadKyc();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to submit your KYC details."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="white-panel kyc-panel">
      <div className="panel-title kyc-panel-heading">
        <div>
          <span className="kyc-eyebrow">ACCOUNT VERIFICATION</span>
          <h3>KYC Verification</h3>
          <p>
            Verify your fan account and earn 40 non-redeemable progression
            points after approval.
          </p>
        </div>

        <div className="kyc-heading-icon">
          <ShieldCheck size={25} />
        </div>
      </div>

      {loading ? (
        <div className="kyc-loading">
          <LoaderCircle size={18} className="kyc-spinner" />
          Loading your verification details...
        </div>
      ) : (
        <>
          {latestSubmission && (
            <div className={`kyc-status-card kyc-status-${latestSubmission.status.toLowerCase()}`}>
              <div className="kyc-status-icon">
                {latestSubmission.status === "APPROVED" ? (
                  <CheckCircle2 size={21} />
                ) : latestSubmission.status === "REJECTED" ? (
                  <XCircle size={21} />
                ) : (
                  <Clock3 size={21} />
                )}
              </div>

              <div className="kyc-status-copy">
                <strong>{statusDetails[latestSubmission.status].label}</strong>
                <p>{statusDetails[latestSubmission.status].description}</p>
                <span>
                  Submitted{" "}
                  {new Date(latestSubmission.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {latestSubmission?.status === "REJECTED" &&
            latestSubmission.rejectionReason && (
              <div className="kyc-rejection-reason">
                <strong>Admin feedback</strong>
                <p>{latestSubmission.rejectionReason}</p>
              </div>
            )}

          {canSubmit ? (
            <form className="kyc-form" onSubmit={handleSubmit}>
              <div className="kyc-form-intro">
                <strong>
                  {latestSubmission?.status === "REJECTED"
                    ? "Resubmit your details"
                    : "Complete your verification"}
                </strong>
                <span>
                  Please provide accurate information. All fields are required.
                </span>
              </div>

              <div className="kyc-form-grid">
                <label className="kyc-field">
                  <span>WhatsApp Number</span>
                  <input
                    type="tel"
                    value={whatsappNumber}
                    onChange={(event) => setWhatsappNumber(event.target.value)}
                    placeholder="+234 800 000 0000"
                    autoComplete="tel"
                    required
                  />
                </label>

                <label className="kyc-field">
                  <span>Country</span>
                  <input
                    type="text"
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    placeholder="Enter your country"
                    autoComplete="country-name"
                    required
                  />
                </label>

                <label className="kyc-field">
                  <span>State</span>
                  <input
                    type="text"
                    value={state}
                    onChange={(event) => setState(event.target.value)}
                    placeholder="Enter your state"
                    autoComplete="address-level1"
                    required
                  />
                </label>

                <label className="kyc-field">
                  <span>Sex</span>
                  <select
                    value={sex}
                    onChange={(event) => setSex(event.target.value as KycSex | "")}
                    required
                  >
                    <option value="">Select sex</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                  </select>
                </label>

                <label className="kyc-field kyc-field-full">
                  <span>Date of Birth</span>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
              </div>

              <div className="kyc-privacy-note">
                Your information is private and accessible only to you and
                authorised SportyFanz verification staff. We do not require
                identity documents or a KYC photograph.
              </div>

              {error && <p className="kyc-feedback kyc-error">{error}</p>}
              {message && <p className="kyc-feedback kyc-success">{message}</p>}

              <button
                type="submit"
                className="kyc-submit-button"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit for Verification"}
              </button>
            </form>
          ) : (
            !latestSubmission && (
              <div className="kyc-empty-state">
                <p>Your account has not been submitted for verification yet.</p>
              </div>
            )
          )}

          {submissions.length > 1 && (
            <div className="kyc-history">
              <strong>Previous submissions</strong>
              {submissions.slice(1).map((submission) => (
                <div className="kyc-history-row" key={submission.id}>
                  <span>
                    {new Date(submission.createdAt).toLocaleDateString()}
                  </span>
                  <span className={`kyc-history-status kyc-history-${submission.status.toLowerCase()}`}>
                    {submission.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && !canSubmit && (
            <p className="kyc-feedback kyc-error">{error}</p>
          )}
        </>
      )}
    </section>
  );
}