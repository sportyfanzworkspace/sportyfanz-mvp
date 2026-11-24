

"use client";

import { apiFetch } from "@/lib/api";
import { Logo } from "@/components/Logo";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Trophy,
  LoaderCircle,
} from "lucide-react";

type Sport = {
  id: number;
  name: string;
  slug: string;
};

const sportIcons: Record<string, string> = {
  football: "⚽",
  soccer: "⚽",
  basketball: "🏀",
  cricket: "🏏",
  tennis: "🎾",
  rugby: "🏉",
  boxing: "🥊",
  athletics: "🏃",
  baseball: "⚾",
  volleyball: "🏐",
  golf: "⛳",
  swimming: "🏊",
  hockey: "🏑",
  esports: "🎮",
};

export default function ChooseSportsPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSports() {
      try {
        const response = await apiFetch("/api/sports");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load sports.");
        }

        setSports(data.sports ?? []);
        setSelectedIds(data.followedSportIds ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load sports."
        );
      } finally {
        setLoading(false);
      }
    }

    loadSports();
  }, []);

  function toggleSport(sportId: number) {
    setSelectedIds((current) =>
      current.includes(sportId)
        ? current.filter((id) => id !== sportId)
        : [...current, sportId]
    );
  }

  async function saveSports() {
    if (selectedIds.length === 0) {
      setError("Choose at least one sport to continue.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch("/api/sports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sportIds: selectedIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save sports.");
      }

      window.location.href = "/login?welcome=1";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save sports."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="choose-sports-page">
        <div className="choose-sports-loading">
          <LoaderCircle size={28} className="sports-loader" />
          <p>Loading your sports...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="choose-sports-page">
      <section className="choose-sports-card">
        <div className="choose-sports-brand">
          <Logo />
        </div>

        <div className="choose-sports-heading">
          <span className="choose-sports-eyebrow">
            PERSONALISE YOUR EXPERIENCE
          </span>

          <h1>Choose your sports.</h1>

          <p>
            Every fan has a passion. Select the sports you love and
            we&apos;ll make your SportyFanz experience yours.
          </p>
        </div>

        <div className="choose-sports-selection-info">
          <span>Select all that apply</span>
          <strong>
            {selectedIds.length} selected
          </strong>
        </div>

        {error && (
          <div className="choose-sports-error" role="alert">
            {error}
          </div>
        )}

        {sports.length === 0 ? (
          <div className="choose-sports-empty">
            No sports are currently available.
          </div>
        ) : (
          <div className="choose-sports-grid">
            {sports.map((sport) => {
              const selected = selectedIds.includes(sport.id);
              const icon =
                sportIcons[sport.slug.toLowerCase()] ?? "🏆";

              return (
                <button
                  key={sport.id}
                  type="button"
                  className={`choose-sport-option ${
                    selected ? "selected" : ""
                  }`}
                  onClick={() => toggleSport(sport.id)}
                  aria-pressed={selected}
                >
                  <span className="choose-sport-icon">{icon}</span>

                  <span className="choose-sport-name">
                    {sport.name}
                  </span>

                  <span className="choose-sport-check">
                    {selected && <Check size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="choose-sports-footer">
          <p>
            You can update your favourite sports later.
          </p>

          <button
            type="button"
            className="choose-sports-continue"
            onClick={saveSports}
            disabled={saving || sports.length === 0}
          >
            {saving ? "Saving..." : "Continue"}
            {!saving && <ArrowRight size={17} />}
          </button>
        </div>
      </section>
    </main>
  );
}
