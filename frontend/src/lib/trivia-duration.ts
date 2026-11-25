export type TriviaDurationKind = "QUESTION" | "QUIZ";

export const TRIVIA_DURATION_LIMITS = {
  QUESTION: {
    min: 10,
    max: 600,
    defaultSeconds: 30,
  },
  QUIZ: {
    min: 30,
    max: 3600,
    defaultSeconds: 300,
  },
} as const;

export function parseTriviaDuration(
  value: string,
  kind: TriviaDurationKind
): number | null {
  const limits = TRIVIA_DURATION_LIMITS[kind];

  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const seconds = Number(value.trim());

  if (
    !Number.isSafeInteger(seconds) ||
    seconds < limits.min ||
    seconds > limits.max
  ) {
    return null;
  }

  return seconds;
}

export function formatTriviaDuration(
  value: number | null | undefined
): string {
  if (value === null || value === undefined) {
    return "No timer (legacy)";
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    return "Invalid duration";
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  return [
    minutes > 0 ? `${minutes} min` : "",
    seconds > 0 ? `${seconds} sec` : "",
  ].filter(Boolean).join(" ");
}
