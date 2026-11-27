"use client";

import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import DiscoveryImageUpload from "./discovery-image-upload";

export type DiscoveryDirectory =
  | "clubs"
  | "players"
  | "competitions";

type Sport = {
  id: number;
  name: string;
};

type Team = {
  id: number;
  name: string;
  sportId: number;
};

type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "url" | "textarea";
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
};

const seoFields: Field[] = [
  { key: "seoTitle", label: "SEO title", maxLength: 70 },
  {
    key: "seoDescription",
    label: "SEO description",
    type: "textarea",
    maxLength: 180,
  },
];

const foundedYear: Field = {
  key: "foundedYear",
  label: "Founded year",
  type: "number",
  min: 1700,
  max: new Date().getFullYear(),
};

const organisationFields: Field[] = [
  {
    key: "name",
    label: "Name",
    required: true,
    maxLength: 150,
  },
  { key: "shortName", label: "Short name", maxLength: 80 },
  { key: "country", label: "Country", maxLength: 100 },
];

const organisationImages: Field[] = [
  { key: "logoUrl", label: "Logo URL", type: "url" },
  { key: "coverUrl", label: "Cover image URL", type: "url" },
  { key: "websiteUrl", label: "Official website", type: "url" },
];

const fields: Record<DiscoveryDirectory, Field[]> = {
  clubs: [
    ...organisationFields,
    { key: "city", label: "City", maxLength: 100 },
    { key: "nickname", label: "Nickname", maxLength: 150 },
    foundedYear,
    {
      key: "stadiumName",
      label: "Stadium name",
      maxLength: 200,
    },
    {
      key: "stadiumCapacity",
      label: "Stadium capacity",
      type: "number",
      min: 0,
      max: 1000000,
    },
    {
      key: "overview",
      label: "Club overview",
      type: "textarea",
      maxLength: 20000,
    },
    ...organisationImages,
    ...seoFields,
  ],

  players: [
    {
      key: "firstName",
      label: "First name",
      required: true,
      maxLength: 80,
    },
    {
      key: "lastName",
      label: "Last name",
      required: true,
      maxLength: 80,
    },
    {
      key: "displayName",
      label: "Display name",
      maxLength: 120,
    },
    { key: "position", label: "Position", maxLength: 100 },
    {
      key: "nationality",
      label: "Nationality",
      maxLength: 100,
    },
    {
      key: "dateOfBirth",
      label: "Date of birth",
      type: "date",
    },
    {
      key: "heightCm",
      label: "Height (cm)",
      type: "number",
      min: 50,
      max: 300,
    },
    {
      key: "weightKg",
      label: "Weight (kg)",
      type: "number",
      min: 15,
      max: 500,
    },
    {
      key: "jerseyNumber",
      label: "Jersey number",
      type: "number",
      min: 0,
      max: 999,
    },
    {
      key: "preferredFoot",
      label: "Preferred foot",
      maxLength: 30,
    },
    {
      key: "biography",
      label: "Biography",
      type: "textarea",
      maxLength: 20000,
    },
    {
      key: "achievements",
      label: "Achievements",
      type: "textarea",
      maxLength: 10000,
    },
    {
      key: "avatarUrl",
      label: "Player photograph URL",
      type: "url",
    },
    ...seoFields,
  ],

  competitions: [
    ...organisationFields,
    {
      key: "competitionType",
      label: "Competition type",
      maxLength: 80,
    },
    foundedYear,
    {
      key: "description",
      label: "Competition description",
      type: "textarea",
      maxLength: 20000,
    },
    ...organisationImages,
    ...seoFields,
  ],
};

type Props = {
  directory: DiscoveryDirectory;
  sports: Sport[];
  teams: Team[];
  record: Record<string, unknown> | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
};

function initialValues(
  directory: DiscoveryDirectory,
  record: Record<string, unknown> | null
) {
  const values: Record<string, string> = {
    sportId: String(record?.sportId ?? ""),
    teamId: "",
  };

  for (const field of fields[directory]) {
    const value = record?.[field.key];

    values[field.key] =
      value === null || value === undefined
        ? ""
        : field.type === "date"
          ? String(value).slice(0, 10)
          : String(value);
  }

  return values;
}

export default function DiscoveryProfileForm({
  directory,
  sports,
  teams,
  record,
  onCancel,
  onSaved,
}: Props) {
  const [form, setForm] = useState(
    () => initialValues(directory, record)
  );

  const [saving, setSaving] = useState(false);

  const [activeUploads, setActiveUploads] =
    useState<Record<string, boolean>>({});

  const uploading = Object.values(activeUploads).some(Boolean);
  const [error, setError] = useState("");

  const editing = record !== null;

  const sportLocked =
    editing &&
    record.sportId !== null &&
    record.sportId !== undefined;

  const label =
    directory === "clubs"
      ? "Club"
      : directory === "players"
        ? "Player"
        : "Competition";

  const availableTeams = teams.filter(
    team => String(team.sportId) === form.sportId
  );

  function updateField(key: string, value: string) {
    setForm(current => ({
      ...current,
      [key]: value,
      ...(key === "sportId" ? { teamId: "" } : {}),
    }));
  }

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving || uploading) return;

    setSaving(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {};

      const pendingFiles = Array.from(
        event.currentTarget.querySelectorAll<HTMLInputElement>(
          'input[type="file"]'
        )
      ).some(input => (input.files?.length ?? 0) > 0);

      if (pendingFiles) {
        throw new Error(
          "Upload or remove selected images before saving."
        );
      }

      for (const field of fields[directory]) {
        const value = form[field.key].trim();

        if (field.type === "url" && value) {
          const url = new URL(value);

          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password
          ) {
            throw new Error(
              `${field.label} must be a valid HTTPS URL.`
            );
          }
        }

        payload[field.key] = value || null;
      }

      if (!sportLocked && form.sportId) {
        payload.sportId = Number(form.sportId);
      }

      if (!editing && !form.sportId) {
        throw new Error("Select a sport.");
      }

      if (editing) {
        payload.id = record.id;
      }

      if (
        !editing &&
        directory === "players" &&
        form.teamId
      ) {
        payload.teamId = Number(form.teamId);
      }

      const response = await apiFetch(
        `/api/admin/discovery/${directory}`,
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error || "Unable to save profile."
        );
      }

      onSaved(
        editing
          ? `${label} profile updated successfully.`
          : `${label} created successfully as a draft.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="player-panel discovery-profile-panel">
      <div className="player-panel-heading">
        <div>
          <h2>{editing ? `Edit ${label}` : `Add ${label}`}</h2>
          <p>
            {editing
              ? "Update the existing directory profile."
              : "New profiles are saved as drafts."}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="player-message player-error">
          {error}
        </p>
      )}

      <form onSubmit={saveProfile} className="player-form">
        <fieldset disabled={saving}
          className="discovery-profile-fields">

          <label>
            Sport *
            <select
              required={!editing || !sportLocked}
              disabled={sportLocked}
              value={form.sportId}
              onChange={event =>
                updateField("sportId", event.target.value)
              }
            >
              <option value="">Select sport</option>

              {sportLocked && !sports.some(
                sport => String(sport.id) === form.sportId
              ) && (
                <option value={form.sportId}>
                  {String(record?.sportName || "Existing sport")}
                </option>
              )}

              {sports.map(sport => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>

            {sportLocked && (
              <small>
                The sport of an existing profile cannot be changed.
              </small>
            )}
          </label>

          {!editing && directory === "players" && (
            <label>
              Initial club
              <select
                disabled={!form.sportId}
                value={form.teamId}
                onChange={event =>
                  updateField("teamId", event.target.value)
                }
              >
                <option value="">No club assigned</option>

                {availableTeams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {fields[directory].map(field => (
            ["logoUrl", "coverUrl", "avatarUrl"].includes(field.key) ? (
              <DiscoveryImageUpload
                key={field.key}
                category={directory}
                label={
                  field.key === "logoUrl"
                    ? "Logo"
                    : field.key === "coverUrl"
                      ? "Cover image"
                      : "Player photograph"
                }
                value={form[field.key]}
                disabled={saving}
                onChange={value =>
                  updateField(field.key, value)
                }
                onUploadingChange={active =>
                  setActiveUploads(current => ({
                    ...current,
                    [field.key]: active,
                  }))
                }
              />
            ) : (
            <label
              key={field.key}
              className={
                field.type === "textarea"
                  ? "discovery-field-wide"
                  : undefined
              }
            >
              {field.label}{field.required ? " *" : ""}

              {field.type === "textarea" ? (
                <>
                  <textarea
                    rows={5}
                    required={field.required}
                    maxLength={field.maxLength}
                    value={form[field.key]}
                    onChange={event =>
                      updateField(field.key, event.target.value)
                    }
                  />

                  <small>
                    {form[field.key].length} / {field.maxLength}
                  </small>
                </>
              ) : (
                <input
                  type={field.type || "text"}
                  required={field.required}
                  maxLength={field.maxLength}
                  min={field.min}
                  max={
                    field.type === "date"
                      ? new Date().toISOString().slice(0, 10)
                      : field.max
                  }
                  step={field.type === "number" ? 1 : undefined}
                  value={form[field.key]}
                  onChange={event =>
                    updateField(field.key, event.target.value)
                  }
                />
              )}
            </label>
            )
          ))}

          <div className="discovery-field-wide">
            <p>
              Publishing requires an active sport, an active
              profile, and a country or nationality with a
              description or biography of at least 50 characters.
            </p>

            {editing && directory === "players" && (
              <p>
                Club transfers must be handled separately
                through squad management.
              </p>
            )}
          </div>

          <div className="discovery-profile-actions discovery-field-wide">
            <button
              type="submit"
              className="player-primary-button"
              disabled={saving || uploading}
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : "Create draft"}
            </button>

            <button
              type="button"
              className="player-primary-button"
              disabled={saving || uploading}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
