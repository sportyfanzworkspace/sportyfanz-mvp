"use client";

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

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080d18] px-4 py-10 text-white">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10">
            <LockKeyhole className="h-7 w-7 text-amber-400" />
          </div>

          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
            SportyFanz Staff Security
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Change your password
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Update your staff account password to keep your access secure.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f1726] p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm leading-6 text-slate-300">
              Use at least 12 characters. Keep your new password private and
              do not share it with other staff members.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="currentPassword"
                className="mb-2 block text-sm font-medium text-slate-300"
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
                className="mb-2 block text-sm font-medium text-slate-300"
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
                className="mb-2 block text-sm font-medium text-slate-300"
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
              className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              {showPasswords ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber-400 px-4 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating password..." : "Set new password"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          SportyFanz · The Fan Is King
        </p>
      </section>
    </main>
  );
}
