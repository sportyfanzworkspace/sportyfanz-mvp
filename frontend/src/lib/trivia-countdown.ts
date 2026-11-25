export type TriviaSessionStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "COMPLETED"
  | "EXPIRED"
  | "CLOSED"
  | "UNTIMED";

export type TriviaCountdownSession = {
  id: number;
  questionId: number | null;
  quizId: number | null;
  durationSeconds: number;
  startedAt: string;
  expiresAt: string;
  completedAt: string | null;
  status: TriviaSessionStatus;
};

export type TriviaCountdownFields = {
  durationSeconds: number | null;
  sessionStatus: TriviaSessionStatus | null;
  session: TriviaCountdownSession | null;
  remainingSeconds: number | null;
};

export type TriviaCountdownClock = {
  remainingMilliseconds: number;
  capturedAt: number;
};

export function createTriviaCountdownClock(
  serverNow: string,
  expiresAt: string,
  capturedAt: number,
  publicationEndsAt?: string | null,
  serverRemainingSeconds?: number | null
): TriviaCountdownClock | null {
  const serverTime = Date.parse(serverNow);
  const expiryTime = Date.parse(expiresAt);

  const publicationTime = publicationEndsAt
    ? Date.parse(publicationEndsAt)
    : expiryTime;

  if (
    !Number.isFinite(serverTime) ||
    !Number.isFinite(expiryTime) ||
    !Number.isFinite(publicationTime) ||
    !Number.isFinite(capturedAt) ||
    capturedAt < 0
  ) {
    return null;
  }

  if (
    serverRemainingSeconds != null &&
    (
      !Number.isFinite(serverRemainingSeconds) ||
      serverRemainingSeconds < 0
    )
  ) {
    return null;
  }

  const serverLimit =
    serverRemainingSeconds == null
      ? Number.POSITIVE_INFINITY
      : serverRemainingSeconds * 1000;

  return {
    remainingMilliseconds: Math.max(
      0,
      Math.min(
        expiryTime - serverTime,
        publicationTime - serverTime,
        serverLimit
      )
    ),
    capturedAt,
  };
}

export function getTriviaCountdownMilliseconds(
  clock: TriviaCountdownClock | null,
  monotonicNow: number
): number {
  if (
    !clock ||
    !Number.isFinite(monotonicNow) ||
    monotonicNow < clock.capturedAt
  ) {
    return 0;
  }

  return Math.max(
    0,
    clock.remainingMilliseconds -
      (monotonicNow - clock.capturedAt)
  );
}

export function getTriviaCountdownSeconds(
  clock: TriviaCountdownClock | null,
  monotonicNow: number
): number {
  return Math.ceil(
    getTriviaCountdownMilliseconds(
      clock,
      monotonicNow
    ) / 1000
  );
}

export function formatTriviaCountdown(
  seconds: number
): string {
  const safeSeconds = Number.isFinite(seconds)
    ? Math.max(0, Math.ceil(seconds))
    : 0;

  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainder).padStart(2, "0")
  );
}

export function canSubmitTriviaAnswer(
  status: TriviaSessionStatus | null,
  clock: TriviaCountdownClock | null,
  monotonicNow: number
): boolean {
  if (status === "UNTIMED") return true;

  return (
    status === "ACTIVE" &&
    getTriviaCountdownMilliseconds(
      clock,
      monotonicNow
    ) > 0
  );
}


export function getEffectiveTriviaSessionStatus(
  status: TriviaSessionStatus | null,
  clock: TriviaCountdownClock | null,
  monotonicNow: number
): TriviaSessionStatus | null {
  if (
    status === "ACTIVE" &&
    clock &&
    monotonicNow >= clock.capturedAt &&
    getTriviaCountdownMilliseconds(
      clock,
      monotonicNow
    ) === 0
  ) {
    return "EXPIRED";
  }

  return status;
}
