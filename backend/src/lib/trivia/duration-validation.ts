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

type DurationValidationResult =
  | {
      ok: true;
      durationSeconds: number;
    }
  | {
      ok: false;
      error: string;
    };

export function validateTriviaDuration(
  value: unknown,
  kind: TriviaDurationKind
): DurationValidationResult {
  const limits = TRIVIA_DURATION_LIMITS[kind];

  const label =
    kind === "QUESTION"
      ? "Question time limit"
      : "Total quiz time";

  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" &&
      value.trim() === "")
  ) {
    return {
      ok: false,
      error: `${label} is required.`,
    };
  }

  const durationSeconds =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;

  if (
    !Number.isSafeInteger(durationSeconds) ||
    durationSeconds < limits.min ||
    durationSeconds > limits.max
  ) {
    return {
      ok: false,
      error:
        `${label} must be a whole number between ` +
        `${limits.min} and ${limits.max} seconds.`,
    };
  }

  return {
    ok: true,
    durationSeconds,
  };
}
