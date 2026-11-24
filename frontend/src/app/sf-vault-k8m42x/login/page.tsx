
"use client";

import { apiFetch } from "@/lib/api";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to sign in.");
        return;
      }

      if (data.mustChangePassword) {
        router.replace("/sf-vault-k8m42x/change-password");
      } else {
        router.replace("/sf-vault-k8m42x/dashboard");
      }

      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#10121B",
        color: "#FFFFFF",
        fontFamily: "Lato, Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 36,
          border: "1px solid #303447",
          borderRadius: 20,
          background: "#191C29",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            display: "grid",
            placeItems: "center",
            borderRadius: 14,
            background: "#F5B82E",
            color: "#10121B",
            fontSize: 25,
            fontWeight: 800,
            marginBottom: 24,
          }}
          aria-label="SportyFanz Admin"
        >
          S
        </div>

        <p
          style={{
            color: "#F5B82E",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          SportyFanz Internal
        </p>

        <h1 style={{ fontSize: 30, marginBottom: 10 }}>
          Staff Admin
        </h1>

        <p style={{ color: "#A9AEC1", lineHeight: 1.6 }}>
          Sign in with your authorised staff account to manage
          SportyFanz content and fan experiences.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="admin-identifier"
            style={{ display: "block", margin: "24px 0 8px" }}
          >
            Username or work email
          </label>

          <input
            id="admin-identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Enter your staff username or email"
            style={inputStyle}
          />

          <label
            htmlFor="admin-password"
            style={{ display: "block", margin: "18px 0 8px" }}
          >
            Password
          </label>

          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            style={inputStyle}
          />

          {error && (
            <p
              role="alert"
              style={{
                color: "#FF9B9B",
                fontSize: 14,
                lineHeight: 1.5,
                marginTop: 16,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 24,
              padding: "14px 18px",
              border: 0,
              borderRadius: 10,
              background: loading ? "#B98A22" : "#F5B82E",
              color: "#10121B",
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign in to Admin"}
          </button>
        </form>

        <p
          style={{
            marginTop: 24,
            color: "#858BA0",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          Restricted to authorised SportyFanz staff. Fan accounts
          cannot access this portal.
        </p>
      </section>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  border: "1px solid #3A4055",
  borderRadius: 9,
  background: "#10121B",
  color: "#FFFFFF",
  fontSize: 15,
  outline: "none",
};
