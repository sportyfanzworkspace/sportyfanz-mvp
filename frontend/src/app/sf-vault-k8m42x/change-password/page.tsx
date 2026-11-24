"use client";

import "../password-security.css";

import { apiFetch } from "@/lib/api";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

export default function AdminChangePasswordPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword.length < 12) {
      setError("Your new password must be at least 12 characters long.");
      return;
    }

    if (newPassword.length > 128) {
      setError("Your new password cannot exceed 128 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Your new passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Choose a password different from your current password.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to change your password.");
        return;
      }

      router.replace("/sf-vault-k8m42x/login");
      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "sf-password-input";

  return (
    <main className="sf-password-page">
      <section className="sf-password-shell">
        <div className="sf-password-header">
          <div className="sf-password-icon">
            <LockKeyhole size={28} />
          </div>

          <p className="sf-password-eyebrow">
            SportyFanz Staff Security
          </p>

          <h1 className="sf-password-title">
            Change your password
          </h1>

          <p className="sf-password-description">
            Update your staff account password to keep your access secure.
          </p>
        </div>

        <div className="sf-password-card">
          <div className="sf-password-notice">
            <ShieldCheck />
            <p >
              Use at least 12 characters. Keep your new password private and
              do not share it with other staff members.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="sf-password-form">
            <div>
              <label
                htmlFor="currentPassword"
                className="sf-password-label"
              >
                Current password
              </label>
              <input
                id="currentPassword"
                type={showPasswords ? "text" : "password"}
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter your current password"
                className={inputClass}
 />
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="sf-password-label"
              >
                New password
              </label>
              <input
                id="newPassword"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Create a secure password"
                className={inputClass}
 />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="sf-password-label"
              >
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Enter your new password again"
                className={inputClass}
 />
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords((value) => !value)}
              className="sf-password-toggle"
            >
              {showPasswords ? (
                <EyeOff />
              ) : (
                <Eye />
              )}
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>

            {error && (
              <div
                role="alert"
                className="sf-password-error"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="sf-password-submit"
            >
              {loading ? "Updating password..." : "Set new password"}
            </button>
          </form>
        </div>

        <p className="sf-password-footer">
          SportyFanz · The Fan Is King
        </p>
      </section>
    </main>
  );
}
