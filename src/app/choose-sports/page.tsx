"use client";

import { useEffect, useState } from "react";

type Sport = {
  id: number;
  name: string;
  slug: string;
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
        const response = await fetch("/api/sports");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load sports.");
        }

        setSports(data.sports ?? []);
        setSelectedIds(data.followedSportIds ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load sports."
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
      const response = await fetch("/api/sports", {
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

      window.location.href = "/login";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save sports."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main>
        <p>Loading sports...</p>
      </main>
    );
  }

  return (
    <main>
      <section>
        <h1>Choose Your Sports</h1>
        <p>
          Select the sports you love. We'll use your choices
          to personalize your SportyFanz experience.
        </p>

        {error && <p role="alert">{error}</p>}

        {sports.length === 0 ? (
          <p>No sports are currently available.</p>
        ) : (
          <div>
            {sports.map((sport) => {
              const selected = selectedIds.includes(sport.id);

              return (
                <label
                  key={sport.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    marginBottom: "8px",
                    border: selected
                      ? "2px solid #2563eb"
                      : "1px solid #ccc",
                    borderRadius: "10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSport(sport.id)}
                  />

                  <span>{sport.name}</span>
                </label>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={saveSports}
          disabled={saving || sports.length === 0}
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </section>
    </main>
  );
}