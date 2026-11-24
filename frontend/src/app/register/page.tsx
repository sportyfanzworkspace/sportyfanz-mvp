
"use client";

import { apiFetch } from "@/lib/api";

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

    if (formData.get("acceptedPolicies") !== "on") {
      setError("You must agree to the Terms of Use before registering.");
      setLoading(false);
      return;
    }

    if (
      String(formData.get("password") || "") !==
      String(formData.get("confirmPassword") || "")
    ) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: String(formData.get("firstName") || "").trim(),
          lastName: String(formData.get("lastName") || "").trim(),
          username: String(formData.get("username") || "").trim().toLowerCase(),
          email: String(formData.get("email") || "").trim().toLowerCase(),
          password: String(formData.get("password") || ""),
          whatsappNumber: (() => {
            const number = String(formData.get("whatsappNumber") || "")
              .replace(/[^0-9]/g, "")
              .replace(/^0+/, "");

            const code = String(formData.get("whatsappCountryCode") || "+234");

            return number ? `${code}${number}` : "";
          })(),
          country: String(formData.get("country") || "").trim(),
          dateOfBirth: String(formData.get("dateOfBirth") || ""),
          acceptedPolicies: formData.get("acceptedPolicies") === "on",
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

      // Registration requires email verification before login.
      const registeredEmail =
        typeof data.email === "string"
          ? data.email
          : String(formData.get("email") || "").trim().toLowerCase();

      const emailDeliveryFailed =
        data.verificationEmailSent === false;

      const verificationUrl =
        `/verify-email?email=${encodeURIComponent(registeredEmail)}` +
        (emailDeliveryFailed ? "&delivery=failed" : "");

      window.location.href = verificationUrl;
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
              <label htmlFor="firstName">First Name</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="Enter your first name"
                autoComplete="given-name"
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="lastName">Last Name</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Enter your last name"
                autoComplete="family-name"
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
  <label htmlFor="username">Username</label>

  <input
    id="username"
    name="username"
    type="text"
    placeholder="Choose your fan username"
    autoComplete="username"
    minLength={3}
    maxLength={20}
    pattern="[A-Za-z0-9_]+"
    title="Use 3–20 letters, numbers or underscores."
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

            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="whatsappNumber">
                WhatsApp number (optional)
              </label>

              <div className="auth-whatsapp-row">
                <select
                  name="whatsappCountryCode"
                  aria-label="WhatsApp country code"
                  defaultValue="+234"
                  disabled={loading}
                >
                  <option value="+234">🇳🇬 +234</option>
                  <option value="+233">🇬🇭 +233</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+1">🇺🇸 / 🇨🇦 +1</option>
                  <option value="+27">🇿🇦 +27</option>
                  <option value="+254">🇰🇪 +254</option>
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+971">🇦🇪 +971</option>
                </select>

                <input
                  id="whatsappNumber"
                  name="whatsappNumber"
                  type="tel"
                  inputMode="tel"
                  placeholder="8012345678"
                  autoComplete="tel-national"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="country">Country</label>
              <input
                id="country"
                name="country"
                type="text"
                autoComplete="country-name"
                required
                disabled={loading}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="dateOfBirth">Date of birth</label>
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                max={(() => {
                  const today = new Date();
                  const cutoff = new Date(
                    today.getFullYear() - 13,
                    today.getMonth(),
                    today.getDate()
                  );
                  return [
                    cutoff.getFullYear(),
                    String(cutoff.getMonth() + 1).padStart(2, "0"),
                    String(cutoff.getDate()).padStart(2, "0"),
                  ].join("-");
                })()}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-policy-agreement">
              <input
                id="acceptedPolicies"
                name="acceptedPolicies"
                type="checkbox"
                required
                disabled={loading}
              />
              <label htmlFor="acceptedPolicies">
                I have read and agree to the{" "}
                <Link href="/privacy/#policy-1" target="_blank">
                  SportyFanz Terms of Use
                </Link>{" "}
                and acknowledge the{" "}
                <Link href="/privacy/#policy-2" target="_blank">
                  Privacy Policy
                </Link>.
              </label>
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