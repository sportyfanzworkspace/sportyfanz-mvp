export type PublicDirectoryRecord = {
  isActive: boolean;
  publicationStatus: string;
  sportId: number | null;
};

/**
 * Public directory visibility is independent of
 * administrative access and existing follow records.
 */
export function isPublicDirectoryRecord(
  record: PublicDirectoryRecord,
  activeSportIds: ReadonlySet<number>,
  allowUnassignedSport = false
): boolean {
  if (
    !record.isActive ||
    record.publicationStatus !== "PUBLISHED"
  ) {
    return false;
  }

  if (record.sportId === null) {
    return allowUnassignedSport;
  }

  return activeSportIds.has(record.sportId);
}

/**
 * Normalize competition names for display comparison.
 * This does not establish provider identity.
 */
export function normalizeCompetitionName(
  value: string
): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
