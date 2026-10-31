
"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useState, type FormEvent } from "react";
import {
  AtSign,
  Crown,
  Eye,
  EyeOff,
  LockKeyhole,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: String(formData.get("email") || "").trim().toLowerCase(),
          password: String(formData.get("password") || ""),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || "Unable to log in. Please check your details.");
        return;
      }

      window.location.href = "/app";
    } catch {
      setError("We couldn't connect to SportyFanz. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authContainer">
        {/* BRAND PANEL */}
        <section className="brandPanel">
          <div className="brandContent">
            <div className="logo">
              <Logo />
            </div>

            <h2 className="brandTitle">
              Welcome back,
              <br />
              <span>Champion Fan.</span>
            </h2>

            <p className="brandDescription">
              Your matches, fan rooms, predictions, rewards
              and Fan Kingdom are waiting for you.
            </p>
          </div>

          <div className="brandFeatures">
            <div className="brandFeature">
              <div className="featureIcon">
                <Trophy size={16} />
              </div>
              <span>Keep up with every match and moment</span>
            </div>

            <div className="brandFeature">
              <div className="featureIcon">
                <Users size={16} />
              </div>
              <span>Stay connected with your fan community</span>
            </div>

            <div className="brandFeature">
              <div className="featureIcon">
                <Sparkles size={16} />
              </div>
              <span>Continue earning Sporty Points</span>
            </div>
          </div>
        </section>

        {/* FORM PANEL */}
        <section className="formPanel">
          <div className="formWrapper">
            <div className="formHeader">
              <span className="formEyebrow">WELCOME BACK</span>

              <h1 className="formTitle">Log in to SportyFanz</h1>

              <p className="formSubtitle">
                Enter your details to continue to your Fan Kingdom.
              </p>
            </div>

            <form className="form" onSubmit={handleSubmit}>
              {/* EMAIL */}
              <div className="fieldGroup">
                <label htmlFor="email" className="label">
                  Email address
                </label>

                <div className="inputWrapper">
                  <AtSign size={17} className="inputIcon" />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div className="fieldGroup">
                <label htmlFor="password" className="label">
                  Password
                </label>

                <div className="inputWrapper">
                  <LockKeyhole size={17} className="inputIcon" />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="input passwordInput"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="passwordButton"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </div>

              <div className="formOptions">
                <label className="checkboxLabel">
                  <input type="checkbox" name="rememberMe" className="checkbox" />
                  Remember me
                </label>

                <Link href="/forgot-password" className="link">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <p role="alert" aria-live="polite" style={{ color: "#d93025" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="submitButton"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>

            <div className="divider">
              <span>New to SportyFanz?</span>
            </div>

            <div className="formFooter">
              Don&apos;t have an account?{" "}
              <Link href="/register">Create one</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}