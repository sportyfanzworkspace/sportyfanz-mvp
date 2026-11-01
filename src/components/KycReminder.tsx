"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type KycSubmission = {
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
};

type KycResponse = {
  latestSubmission: KycSubmission | null;
  hasApprovedSubmission: boolean;
  hasPendingSubmission: boolean;
  canSubmit: boolean;
};

export default function KycReminder() {
  const [kyc, setKyc] = useState<KycResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDismissed(
      sessionStorage.getItem("sportyfanz-kyc-prompt-dismissed") === "true"
    );

    let cancelled = false;

    async function loadKyc() {
      try {
        const response = await fetch("/api/kyc", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as KycResponse;

        if (!cancelled) {
          setKyc(data);
        }
      } catch {
        // Retry on the next page load if the network is unavailable.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void loadKyc();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !kyc || kyc.hasApprovedSubmission) {
    return null;
  }

  const status = kyc.latestSubmission?.status ?? null;
  const isRejected = status === "REJECTED";
  const isPending = kyc.hasPendingSubmission;

  const dismissPrompt = () => {
    sessionStorage.setItem("sportyfanz-kyc-prompt-dismissed", "true");
    setDismissed(true);
  };

  return (
    <>
      <section className="kyc-reminder">
        <div className="kyc-reminder-copy">
          <strong>
            {isPending
              ? "Your KYC verification is under review"
              : isRejected
                ? "Your KYC verification needs attention"
                : "Complete your fan verification"}
          </strong>

          <p>
            {isPending
              ? "Your details have been submitted. We will update you after review."
              : isRejected
                ? "Your previous submission was not approved. Please review the feedback and resubmit."
                : "Verify your fan account and earn 40 non-redeemable progression points after approval."}
          </p>

          {isRejected && kyc.latestSubmission?.rejectionReason && (
            <p className="kyc-reminder-reason">
              Reason: {kyc.latestSubmission.rejectionReason}
            </p>
          )}
        </div>

        <Link href="/app/kingdom" className="kyc-reminder-link">
          {isPending ? "View status" : isRejected ? "Resubmit KYC" : "Verify account"}
        </Link>
      </section>

      {!dismissed && !isPending && (
        <div className="kyc-prompt-overlay">
          <section
            className="kyc-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-prompt-title"
          >
            <div className="kyc-prompt-icon">✓</div>

            <h2 id="kyc-prompt-title">
              {isRejected
                ? "Complete your verification"
                : "Welcome to SportyFanz!"}
            </h2>

            <p>
              {isRejected
                ? "Your previous KYC submission was not approved. Review the feedback in My Kingdom and submit your details again."
                : "Verify your fan account to earn 40 progression points and advance your fan level. It only takes a few minutes."}
            </p>

            <div className="kyc-prompt-actions">
              <Link
                href="/app/kingdom"
                className="kyc-prompt-primary"
              >
                {isRejected ? "Review and resubmit" : "Verify my account"}
              </Link>

              <button
                type="button"
                className="kyc-prompt-dismiss"
                onClick={dismissPrompt}
              >
                I’ll do this later
              </button>
            </div>

            <small>
              You can continue exploring SportyFanz while verification is pending.
            </small>
          </section>
        </div>
      )}
    </>
  );
}
