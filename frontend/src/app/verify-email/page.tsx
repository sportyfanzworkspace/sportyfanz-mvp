"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { apiFetch } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(
    searchParams.get("email") || ""
  );
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    searchParams.get("delivery") === "failed"
      ? "Please Resend verification code below."
      : ""
  );

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to verify your email.");
        return;
      }

      window.location.href = "/login?verified=1";
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resending) return;

    setResending(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        "/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to resend code.");
        return;
      }

      setMessage(
        data.message || "If eligible, a new code has been sent."
      );
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-logo">
          <Logo />
        </div>

        <h1>One more step to your Fan Kingdom.</h1>

        <p>
          Verify your email address to activate your SportyFanz
          account and unlock your fan experience.
        </p>

        <div className="auth-benefits">
          <div className="auth-benefit">
            <div className="auth-benefit-icon">
              <ShieldCheck size={16} />
            </div>
            Secure your fan account
          </div>

          <div className="auth-benefit">
            <div className="auth-benefit-icon">
              <MailCheck size={16} />
            </div>
            Earn 40 progression points after verification
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <form className="auth-form" onSubmit={handleVerify}>
          <div className="auth-form-header">
            <span>EMAIL VERIFICATION</span>

            <h1>Verify your email</h1>

            <p>
              Enter the six-digit code sent to your email.
              The code expires after 10 minutes.
            </p>
          </div>

          <div className="auth-form-fields">
            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                disabled={loading || resending}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="code">Verification code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6-digit code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p role="alert" style={{ color: "#d93025" }}>
                {error}
              </p>
            )}

            {message && (
              <p role="status" style={{ color: "#137333" }}>
                {message}
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending || !email.trim()}
              style={{
                background: "transparent",
                border: "none",
                cursor: resending ? "wait" : "pointer",
                padding: "12px",
                fontWeight: 700,
              }}
            >
              {resending ? "Sending..." : "Resend verification code"}
            </button>
          </div>

          <div className="auth-form-footer">
            Already verified? <Link href="/login">Log in</Link>
          </div>
        </form>
      </section>
    </div>
  );
}


export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="auth-page">Loading verification...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
