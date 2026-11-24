"use client";

import "../password-security.css";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

const LOGIN_URL = "/sf-vault-k8m42x/login/";

function PasswordSetupForm() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("token") ?? "");
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);

  useEffect(() => {
    // Remove the one-time token from the visible URL immediately.
    if (window.location.search) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname
      );
    }
  }, []);

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validToken) {
      setError("This password setup link is invalid.");
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError("Your password must contain 12–128 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch("/api/admin/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Unable to set your password.");
        return;
      }

      setPassword("");
      setConfirmation("");
      setCompleted(true);


    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="sf-password-page">
      <section className="sf-password-shell sf-password-card">
        <div className="sf-password-header">
          <div className="sf-password-icon">
            <LockKeyhole size={28} />
          </div>
          <div>
            <p className="sf-password-eyebrow">
              SportyFanz Staff Security
            </p>
            <h1 className="sf-password-title">
              {completed ? "Password updated" : "Set your password"}
            </h1>
          </div>
        </div>

        {completed ? (
          <div role="status" className="sf-password-form">
            <div className="sf-password-success">
              <ShieldCheck  size={22} />
              <p>
                Your staff password has been set successfully.
                Sign in using your staff username or work email.
              </p>
            </div>

            <a
              href={LOGIN_URL}
              className="sf-password-submit"
            >
              Continue to staff login
            </a>
          </div>
        ) : !validToken ? (
          <div className="sf-password-form">
            <p role="alert" className="sf-password-error">
              This password setup link is missing or invalid.
              Contact your SportyFanz administrator to request a new invitation or reset link.
            </p>

            <a href={LOGIN_URL} className="sf-password-link">
              Return to staff login
            </a>
          </div>
        ) : (
          <>
            <p className="sf-password-description">
              Choose a secure password for your staff account.
              Your invitation or reset link is valid for one hour and can be used only once.
            </p>

            <form onSubmit={handleSubmit} className="sf-password-form">
              <div>
                <label htmlFor="staff-new-password" className="sf-password-label">
                  New password
                </label>
                <div className="sf-password-input-group">
                  <input
                    id="staff-new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="sf-password-input"
 />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="sf-password-eye"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="staff-confirm-password" className="sf-password-label">
                  Confirm password
                </label>
                <input
                  id="staff-confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="sf-password-input"
 />
              </div>

              {error && (
                <p role="alert" className="sf-password-error">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="sf-password-submit"
              >
                {loading ? "Saving password..." : "Set staff password"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

export default function StaffPasswordSetupPage() {
  return (
    <>
      <meta name="referrer" content="no-referrer" />
      <Suspense
      fallback={
        <main className="sf-password-page">
          Loading password setup...
        </main>
      }
    >
      <PasswordSetupForm />
      </Suspense>
    </>
  );
}
