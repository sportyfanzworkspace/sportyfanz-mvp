import {
  validateTriviaDuration,
  type TriviaDurationKind,
} from "./duration-validation";

export type TriviaSessionStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "COMPLETED"
  | "EXPIRED"
  | "CLOSED"
  | "UNTIMED";

export type TriviaSessionTiming = {
  durationSeconds: number;
  startedAt: string;
  expiresAt: string;
  completedAt: string | null;
};

export type TriviaActivityTiming = {
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  durationSeconds: number | null;
};

export function isTriviaActivityAvailable(
  activity: TriviaActivityTiming,
  now: number
): boolean {
  if (
    !Number.isFinite(now) ||
    activity.status !== "ACTIVE"
  ) {
    return false;
  }

  if (activity.startsAt !== null) {
    const startsAt = Date.parse(activity.startsAt);

    if (
      !Number.isFinite(startsAt) ||
      startsAt > now
    ) {
      return false;
    }
  }

  if (activity.endsAt !== null) {
    const endsAt = Date.parse(activity.endsAt);

    if (
      !Number.isFinite(endsAt) ||
      endsAt <= now
    ) {
      return false;
    }
  }

  return true;
}

export function calculateTriviaSessionWindow(
  activity: TriviaActivityTiming,
  kind: TriviaDurationKind,
  now: number
): TriviaSessionTiming {
  if (!isTriviaActivityAvailable(activity, now)) {
    throw new Error("TRIVIA_NOT_AVAILABLE");
  }

  const validation = validateTriviaDuration(
    activity.durationSeconds,
    kind
  );

  if (validation.ok === false) {
    throw new Error("INVALID_TRIVIA_DURATION");
  }

  const durationSeconds =
    validation.durationSeconds;

  const personalDeadline =
    now + durationSeconds * 1000;

  const publicationDeadline =
    activity.endsAt === null
      ? personalDeadline
      : Date.parse(activity.endsAt);

  const expiresAt = Math.min(
    personalDeadline,
    publicationDeadline
  );

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= now
  ) {
    throw new Error("TRIVIA_NOT_AVAILABLE");
  }

  return {
    durationSeconds,
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    completedAt: null,
  };
}

export function getTriviaSessionStatus(
  activity: TriviaActivityTiming,
  session: TriviaSessionTiming | null,
  now: number,
  alreadyCompleted = false
): TriviaSessionStatus {
  if (
    alreadyCompleted ||
    session?.completedAt != null
  ) {
    return "COMPLETED";
  }

  if (!isTriviaActivityAvailable(activity, now)) {
    return "CLOSED";
  }

  if (session) {
    const startedAt = Date.parse(session.startedAt);
    const expiresAt = Date.parse(session.expiresAt);

    if (
      !Number.isFinite(startedAt) ||
      !Number.isFinite(expiresAt) ||
      startedAt > now ||
      expiresAt <= now ||
      expiresAt <= startedAt
    ) {
      return "EXPIRED";
    }

    return "ACTIVE";
  }

  if (activity.durationSeconds === null) {
    return "UNTIMED";
  }

  return "NOT_STARTED";
}

export function getTriviaRemainingSeconds(
  activity: TriviaActivityTiming,
  session: TriviaSessionTiming | null,
  now: number
): number {
  if (
    !session ||
    getTriviaSessionStatus(
      activity,
      session,
      now
    ) !== "ACTIVE"
  ) {
    return 0;
  }

  const personalDeadline =
    Date.parse(session.expiresAt);

  const publicationDeadline =
    activity.endsAt === null
      ? personalDeadline
      : Date.parse(activity.endsAt);

  const effectiveDeadline = Math.min(
    personalDeadline,
    publicationDeadline
  );

  return Math.max(
    0,
    Math.ceil((effectiveDeadline - now) / 1000)
  );
}
