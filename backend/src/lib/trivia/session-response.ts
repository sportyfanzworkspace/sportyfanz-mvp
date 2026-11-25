import {
  getTriviaSessionStatus,
  getTriviaRemainingSeconds,
  type TriviaActivityTiming,
  type TriviaSessionTiming,
} from "./session-timing";

type PublicSession = TriviaSessionTiming & {
  id: number;
  questionId: number | null;
  quizId: number | null;
};

export function buildTriviaSessionResponse(
  activity: TriviaActivityTiming,
  session: PublicSession | null,
  now: number,
  authenticated: boolean,
  alreadyCompleted = false
) {
  if (!authenticated) {
    return {
      durationSeconds: activity.durationSeconds,
      sessionStatus: null,
      session: null,
      remainingSeconds: null,
    };
  }

  const status = getTriviaSessionStatus(
    activity,
    session,
    now,
    alreadyCompleted
  );

  return {
    durationSeconds: activity.durationSeconds,
    sessionStatus: status,
    session: session
      ? {
          id: session.id,
          questionId: session.questionId,
          quizId: session.quizId,
          durationSeconds: session.durationSeconds,
          startedAt: session.startedAt,
          expiresAt: session.expiresAt,
          completedAt: session.completedAt,
          status,
        }
      : null,
    remainingSeconds: status === "ACTIVE"
      ? getTriviaRemainingSeconds(
          activity,
          session,
          now
        )
      : 0,
  };
}
