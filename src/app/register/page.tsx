
"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useState, type FormEvent } from "react";
import { Crown, Gift, Trophy, Users } from "lucide-react";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: String(formData.get("name") || "").trim(),
          email: String(formData.get("email") || "").trim().toLowerCase(),
          password: String(formData.get("password") || ""),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            "Unable to create your account. Please try again."
        );
        return;
      }

      // Registration creates the user's session.
      // New users choose their sports before entering the app.
      window.location.href = "/choose-sports";
    } catch {
      setError("We couldn't connect to SportyFanz. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-logo">
          <Logo />
        </div>

        <h1>Your sports world starts here.</h1>

        <p>
          Join a community where fans watch, participate,
          connect and earn rewards for the sports they love.
        </p>

        <div className="auth-benefits">
          <div className="auth-benefit">
            <div className="auth-benefit-icon">
              <Users size={16} />
            </div>
            Connect with real fans
          </div>

          <div className="auth-benefit">
            <div className="auth-benefit-icon">
              <Trophy size={16} />
            </div>
            Participate in sports challenges
          </div>

          <div className="auth-benefit">
            <div className="auth-benefit-icon">
              <Gift size={16} />
            </div>
            Earn fan rewards
          </div>
        </div>
      </section>

      <section className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <span>Join SportyFanz</span>

            <h1>Create your fan profile</h1>

            <p>Join the community and start participating.</p>
          </div>

          <div className="auth-form-fields">
            <div className="auth-field">
              <label htmlFor="name">Full name</label>

              <input
                id="name"
                name="name"
                type="text"
                placeholder="Your name"
                autoComplete="name"
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="email">Email address</label>

              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>

              <input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={loading}
              />
            </div>

            {error && (
              <p role="alert" aria-live="polite" style={{ color: "#d93025" }}>
                {error}
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>

          <div className="auth-form-footer">
            Already have an account?{" "}
            <Link href="/login">Log in</Link>
          </div>
        </form>
      </section>
    </div>
  );
}