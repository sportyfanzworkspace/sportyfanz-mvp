"use client";

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
    <main className="flex min-h-screen items-center justify-center bg-[#080d18] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1726] p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
            <LockKeyhole size={28} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
              SportyFanz Staff Security
            </p>
            <h1 className="text-2xl font-bold">
              {completed ? "Password updated" : "Set your password"}
            </h1>
          </div>
        </div>

        {completed ? (
          <div role="status" className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-green-200">
              <ShieldCheck className="shrink-0" size={22} />
              <p>
                Your staff password has been set successfully.
                Sign in using your staff username or work email.
              </p>
            </div>

            <a
              href={LOGIN_URL}
              className="block rounded-xl bg-amber-400 px-4 py-3 text-center font-bold text-[#10121b]"
            >
              Continue to staff login
            </a>
          </div>
        ) : !validToken ? (
          <div className="space-y-5">
            <p role="alert" className="text-sm leading-6 text-red-300">
              This password setup link is missing or invalid.
              Contact your SportyFanz administrator to request a new invitation or reset link.
            </p>

            <a href={LOGIN_URL} className="text-sm text-amber-400 underline">
              Return to staff login
            </a>
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm leading-6 text-slate-400">
              Choose a secure password for your staff account.
              Your invitation or reset link is valid for one hour and can be used only once.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="staff-new-password" className="mb-2 block text-sm font-medium">
                  New password
                </label>
                <div className="flex rounded-xl border border-white/10 bg-[#111827]">
                  <input
                    id="staff-new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="px-4 text-slate-300"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="staff-confirm-password" className="mb-2 block text-sm font-medium">
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
                  className="w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-[#10121b] disabled:opacity-60"
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
        <main className="grid min-h-screen place-items-center bg-[#080d18] text-white">
          Loading password setup...
        </main>
      }
    >
      <PasswordSetupForm />
      </Suspense>
    </>
  );
}
