/**
 * Advance a reward's timestamp while its inventory row is locked.
 */
export function nextRewardUpdatedAt(previous: string): string {
  const previousTime = new Date(previous).getTime();

  if (!Number.isFinite(previousTime)) {
    throw new Error("INVALID_REWARD_VERSION");
  }

  return new Date(
    Math.max(Date.now(), previousTime + 1)
  ).toISOString();
}
