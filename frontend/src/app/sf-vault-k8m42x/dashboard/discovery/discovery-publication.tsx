"use client";

export type PublicationStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ARCHIVED";

type Profile = {
  id: number;
  publicationStatus: PublicationStatus;
  isActive: boolean;
  sportId: number | null;
  dataSource?: unknown;
  country?: unknown;
  nationality?: unknown;
  overview?: unknown;
  biography?: unknown;
  description?: unknown;
};

type Directory = "clubs" | "players" | "competitions";

type Props = {
  directory: Directory;
  record: Profile;
  canPublish: boolean;
  disabled?: boolean;
  busy?: boolean;
  onRequest: (status: PublicationStatus) => void;
};

export function publicationIssues(
  directory: Directory,
  record: Profile,
  activeSportIds: number[]
): string[] {
  const issues: string[] = [];

  if (!record.isActive) {
    issues.push("The profile must be active.");
  }

  if (
    record.sportId === null ||
    !activeSportIds.includes(record.sportId)
  ) {
    issues.push("Select an available sport.");
  }

  // Provider-imported profiles still require an
  // active record and an available sport.
  // Missing descriptive fields do not prevent publication.
  if (record.dataSource === "PROVIDER") {
    return issues;
  }

  const country =
    directory === "players"
      ? record.nationality
      : record.country;

  if (
    typeof country !== "string" ||
    !country.trim()
  ) {
    issues.push(
      directory === "players"
        ? "Nationality is required."
        : "Country is required."
    );
  }

  const description =
    directory === "clubs"
      ? record.overview
      : directory === "players"
        ? record.biography
        : record.description;

  if (
    typeof description !== "string" ||
    description.trim().length < 50
  ) {
    issues.push(
      directory === "players"
        ? "Biography must contain at least 50 characters."
        : "Description must contain at least 50 characters."
    );
  }

  return issues;
}

export default function DiscoveryPublication({
  record,
  canPublish,
  disabled = false,
  busy = false,
  onRequest,
}: Props) {
  if (!canPublish) return null;

  const status = record.publicationStatus;

  return (
    <div className="discovery-publication-actions">
      {busy ? (
        <small role="status">Updating...</small>
      ) : (
        <>
          {status === "DRAFT" && (
            <button
              type="button"
              className="discovery-publication-button publish"
              disabled={disabled}
              onClick={() => onRequest("PUBLISHED")}
            >
              Publish
            </button>
          )}

          {status === "PUBLISHED" && (
            <button
              type="button"
              className="discovery-publication-button"
              disabled={disabled}
              onClick={() => onRequest("DRAFT")}
            >
              Unpublish
            </button>
          )}

          {status === "ARCHIVED" && (
            <button
              type="button"
              className="discovery-publication-button"
              disabled={disabled}
              onClick={() => onRequest("DRAFT")}
            >
              Restore to Draft
            </button>
          )}

          {status !== "ARCHIVED" && (
            <button
              type="button"
              className="discovery-publication-button archive"
              disabled={disabled}
              onClick={() => onRequest("ARCHIVED")}
            >
              Archive
            </button>
          )}
        </>
      )}
    </div>
  );
}
