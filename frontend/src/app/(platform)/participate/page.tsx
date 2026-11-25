"use client";

import { apiFetch } from "@/lib/api";
import TriviaCountdown from "@/components/trivia/TriviaCountdown";
import { formatTriviaDuration } from "@/lib/trivia-duration";
import {
  createTriviaCountdownClock,
  getEffectiveTriviaSessionStatus,
  canSubmitTriviaAnswer,
  type TriviaCountdownFields,
  type TriviaCountdownClock,
  type TriviaSessionStatus,
  type TriviaCountdownSession,
} from "@/lib/trivia-countdown";
import Link from "next/link";

import {
  CheckCircle2,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Prediction = {
  id: number;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  status: string;
};

type PredictionMatch = {
  id: number;
  competition: string | null;
  venue: string | null;
  imageUrl: string | null;
  scheduledAt: string;
  status: string;
  sport: {
    id: number;
    name: string;
  } | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  };
  prediction: Prediction | null;
};

type PredictionsResponse = {
  balance: number | null;
  matches: PredictionMatch[];
};


type PollOption = {
  id: number;
  label: string;
  votes: number;
  percentage: number;
};

type FanPoll = {
  id: number;
  question: string;
  description: string | null;
  imageUrl: string | null;
  pointsReward: number;
  startsAt: string | null;
  endsAt: string | null;
  isOpen: boolean;
  totalVotes: number;
  myVote: {
    optionId: number;
  } | null;
  options: PollOption[];
};

type PollsResponse = {
  balance: number | null;
  totalPoints: number | null;
  polls: FanPoll[];
};

type TriviaOption = {
  value: "A" | "B" | "C" | "D";
  label: string;
};

type TriviaQuestion = Partial<TriviaCountdownFields> & {
  id: number;
  question: string;
  imageUrl: string | null;
  options: TriviaOption[];
  pointsReward: number;
  attempted: boolean;
};

type TriviaResponse = {
  viewerUserId: number | null;
  success: boolean;
  serverNow: string;
  balance: number | null;
  totalPoints: number | null;
  roundSize: number;
  questions: TriviaQuestion[];
  attemptedCount: number;
};

type TriviaAnswerResponse = {
  viewerUserId: number | null;
  success: boolean;
  message: string;
  isCorrect: boolean;
  selectedOption: string;
  correctOption: string;
  correctAnswer: string;
  explanation: string | null;
  pointsAwarded: number;
  balance: number;
  totalPoints: number;
  questionId: number;
  attemptId: number;
  sessionCompleted?: boolean;
  sessionStatus?: TriviaSessionStatus;
  sessionExpiresAt?: string | null;
  serverNow?: string;
};

type TriviaSessionResponse = {
  viewerUserId: number | null;
  status: TriviaSessionStatus;
  durationSeconds: number | null;
  session: TriviaCountdownSession | null;
  remainingSeconds: number;
  serverNow: string;
};

type LocalTriviaSession = TriviaCountdownFields & {
  clock: TriviaCountdownClock | null;
  serverTimestamp?: number;
};

type TriviaQuizSummary = TriviaCountdownFields & {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  questionCount: number;
  maxPoints: number;
  completedCount: number | null;
  earnedPoints: number | null;
  isCompleted: boolean | null;
};

type TriviaQuizzesResponse = {
  viewerUserId: number | null;
  success: boolean;
  serverNow: string;
  quizzes: TriviaQuizSummary[];
};

type TriviaQuizQuestion = TriviaQuestion & {
  questionOrder: number;
  imageUrl: string | null;
  earnedPoints: number | null;
};

type TriviaQuizDetailsResponse = {
  viewerUserId: number | null;
  success: boolean;
  serverNow: string;
  quiz: TriviaCountdownFields & Pick<
    TriviaQuizSummary,
    | "id"
    | "title"
    | "description"
    | "coverImageUrl"
    | "startsAt"
    | "endsAt"
    | "questionCount"
    | "maxPoints"
  >;
  progress: {
    completedCount: number;
    earnedPoints: number;
    isCompleted: boolean;
  } | null;
  questions: TriviaQuizQuestion[];
};

type ParticipateTab =
  | "predictions"
  | "polls"
  | "trivia";

function formatPoints(points: number) {
  return new Intl.NumberFormat("en-US").format(points);
}

function formatDate(date: string | null) {
  if (!date) return null;

  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMatchDate(date: string) {
  const value = new Date(date);

  return value.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMatchTime(date: string) {
  const value = new Date(date);

  return value.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ParticipatePage() {
  const [activeTab, setActiveTab] =
    useState<ParticipateTab>("predictions");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");

    if (
      requestedTab === "predictions" ||
      requestedTab === "polls" ||
      requestedTab === "trivia"
    ) {
      setActiveTab(requestedTab);
    }
  }, []);

  /*
   * ============================================================
   * PARTICIPATION AUTHENTICATION
   * ============================================================
   */

  type ParticipationAuthStatus =
    "checking" | "authenticated" | "guest" | "error";

  const [participationAuth, setParticipationAuthState] =
    useState<ParticipationAuthStatus>("checking");

  const participationAuthRef =
    useRef<ParticipationAuthStatus>("checking");

  const participationUserIdRef =
    useRef<number | null>(null);

  const participationAuthEpoch = useRef(0);

  const [participationIdentityVersion,
    setParticipationIdentityVersion] = useState(0);

  function setParticipationAuth(
    status: ParticipationAuthStatus,
    userId: number | null = null
  ) {
    const nextUserId =
      status === "authenticated" ? userId : null;

    const changed =
      participationAuthRef.current !== status ||
      participationUserIdRef.current !== nextUserId;

    if (!changed) return;

    participationAuthRef.current = status;
    participationUserIdRef.current = nextUserId;
    participationAuthEpoch.current += 1;

    triviaStartLock.current = false;
    triviaSubmitLock.current = false;

    setStartingTriviaKey(null);
    setTriviaSubmittingId(null);
    setSelectedTriviaQuizLoading(false);
    setTriviaLoading(false);
    setTriviaQuizzesLoading(false);

    localTriviaSessionsRef.current = {};
    triviaResultsRef.current = {};

    setLocalTriviaSessions({});
    setTriviaResults({});
    setTriviaAnswers({});
    setTriviaData(null);
    setTriviaQuizzes([]);
    setSelectedTriviaQuiz(null);
    setQuizQuestionIndex(0);

    setError("");
    setMessage("");

    setParticipationAuthState(status);

    setParticipationIdentityVersion(
      participationAuthEpoch.current
    );
  }

  useEffect(() => {
    let cancelled = false;
    let requestInProgress = false;

    async function checkParticipationAuth() {
      if (cancelled || requestInProgress) return;

      requestInProgress = true;

      const epoch = participationAuthEpoch.current;

      try {
        const response = await apiFetch("/api/auth/me", {
          cache: "no-store",
        });

        const data = await response.json();

        if (
          cancelled ||
          epoch !== participationAuthEpoch.current
        ) {
          return;
        }

        if (
          response.ok &&
          Number.isSafeInteger(data.user?.id) &&
          data.user.id > 0
        ) {
          setParticipationAuth(
            "authenticated",
            data.user.id
          );
        } else {
          setParticipationAuth(
            response.status === 401
              ? "guest"
              : "error"
          );
        }
      } catch {
        if (
          !cancelled &&
          epoch === participationAuthEpoch.current
        ) {
          setParticipationAuth("error");
        }
      } finally {
        requestInProgress = false;
      }
    }

    function revalidate() {
      if (document.visibilityState === "visible") {
        void checkParticipationAuth();
      }
    }

    void checkParticipationAuth();

    window.addEventListener("focus", revalidate);

    document.addEventListener(
      "visibilitychange",
      revalidate
    );

    const interval = window.setInterval(
      revalidate,
      15000
    );

    return () => {
      cancelled = true;

      window.clearInterval(interval);

      window.removeEventListener(
        "focus",
        revalidate
      );

      document.removeEventListener(
        "visibilitychange",
        revalidate
      );
    };
  }, []);

  /*
   * ============================================================
   * PREDICTIONS STATE
   * ============================================================
   */

  const [predictionsData, setPredictionsData] =
    useState<PredictionsResponse | null>(null);

  const [predictionsLoading, setPredictionsLoading] =
    useState(false);

  const [
    predictionSubmittingId,
    setPredictionSubmittingId,
  ] = useState<number | null>(null);

  const [predictionScores, setPredictionScores] =
    useState<
      Record<
        number,
        {
          homeScore: string;
          awayScore: string;
        }
      >
    >({});


/*
 * ============================================================
 * POLLS STATE
 * ============================================================
 */

    const [pollsData, setPollsData] =
       useState<PollsResponse | null>(null);

    const [pollsLoading, setPollsLoading] =
       useState(false);

    const [votingPollId, setVotingPollId] =
      useState<number | null>(null);

      /*
 * ============================================================
 * TRIVIA STATE
 * ============================================================
 */

const [triviaData, setTriviaData] =
  useState<TriviaResponse | null>(null);

const [triviaLoading, setTriviaLoading] =
  useState(false);

const [triviaSubmittingId, setTriviaSubmittingId] =
  useState<number | null>(null);

const [triviaAnswers, setTriviaAnswers] =
  useState<Record<number, TriviaOption["value"]>>({});

const [triviaResults, setTriviaResults] =
  useState<Record<number, TriviaAnswerResponse>>({});

const triviaResultsRef =
  useRef<Record<number, TriviaAnswerResponse>>({});

/*
 * ============================================================
 * CONTINUOUS TRIVIA QUIZ STATE
 * ============================================================
 */

const [triviaQuizzes, setTriviaQuizzes] =
  useState<TriviaQuizSummary[]>([]);

const [triviaQuizzesLoading, setTriviaQuizzesLoading] =
  useState(false);

const [selectedTriviaQuiz, setSelectedTriviaQuiz] =
  useState<TriviaQuizDetailsResponse | null>(null);

const [selectedTriviaQuizLoading, setSelectedTriviaQuizLoading] =
  useState(false);

const [quizQuestionIndex, setQuizQuestionIndex] =
  useState(0);

const [localTriviaSessions, setLocalTriviaSessions] =
  useState<Record<string, LocalTriviaSession>>({});

const localTriviaSessionsRef =
  useRef<Record<string, LocalTriviaSession>>({});

const triviaStartLock = useRef(false);
const triviaSubmitLock = useRef(false);

const [startingTriviaKey, setStartingTriviaKey] =
  useState<string | null>(null);

const [triviaClockNow, setTriviaClockNow] =
  useState(0);

useEffect(() => {
  if (activeTab !== "trivia") return;

  function tick() {
    setTriviaClockNow(performance.now());
  }

  tick();

  const interval = window.setInterval(tick, 250);

  window.addEventListener("focus", tick);
  document.addEventListener("visibilitychange", tick);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("focus", tick);
    document.removeEventListener("visibilitychange", tick);
  };
}, [activeTab]);

useEffect(() => {
  if (participationAuth !== "authenticated") {
    localTriviaSessionsRef.current = {};
    setLocalTriviaSessions({});
  }
}, [participationAuth]);

function validateTriviaResponseIdentity(
  result: unknown,
  requestEpoch: number
): boolean {
  if (
    requestEpoch !== participationAuthEpoch.current
  ) {
    return false;
  }

  if (
    !result ||
    typeof result !== "object"
  ) {
    return false;
  }

  const data = result as Record<string, unknown>;

  if (data.code === "TRIVIA_IDENTITY_CHANGED") {
    setParticipationAuth("checking");
    window.dispatchEvent(new Event("focus"));
    return false;
  }

  // Error responses are handled by the request handlers.
  if (data.success !== true) {
    return true;
  }

  const status = participationAuthRef.current;

  if (
    status !== "authenticated" &&
    status !== "guest"
  ) {
    return false;
  }

  const expectedViewer =
    status === "authenticated"
      ? participationUserIdRef.current
      : null;

  if (data.viewerUserId !== expectedViewer) {
    setParticipationAuth("checking");
    window.dispatchEvent(new Event("focus"));
    return false;
  }

  return true;
}

function saveTriviaSession(
  key: string,
  fields: Partial<TriviaCountdownFields>,
  serverNow: string,
  capturedAt: number,
  publicationEndsAt?: string | null
) {
  const previous = localTriviaSessionsRef.current[key];

  const serverTimestamp = Date.parse(serverNow);

  if (!Number.isFinite(serverTimestamp)) {
    return;
  }

  if (
    previous?.serverTimestamp !== undefined &&
    serverTimestamp < previous.serverTimestamp
  ) {
    return;
  }

  let clock = fields.session
    ? createTriviaCountdownClock(
        serverNow,
        fields.session.expiresAt,
        capturedAt,
        publicationEndsAt,
        fields.remainingSeconds
      )
    : null;

  // Never allow a stale response to restart or extend
  // an existing countdown.
  if (previous?.session) {
    if (!fields.session) return;

    if (previous.session.id !== fields.session.id) {
      return;
    }

    if (
      previous.sessionStatus === "COMPLETED" ||
      previous.sessionStatus === "EXPIRED" ||
      previous.sessionStatus === "CLOSED"
    ) {
      return;
    }

    if (previous.clock && clock) {
      const previousDeadline =
        previous.clock.capturedAt +
        previous.clock.remainingMilliseconds;

      const incomingDeadline =
        clock.capturedAt +
        clock.remainingMilliseconds;

      if (incomingDeadline > previousDeadline) {
        clock = previous.clock;
      }
    }
  }

  const next: LocalTriviaSession = {
    durationSeconds: fields.durationSeconds ?? null,
    sessionStatus: fields.sessionStatus ?? null,
    session: fields.session ?? null,
    remainingSeconds: fields.remainingSeconds ?? null,
    clock,
    serverTimestamp,
  };

  const updated = {
    ...localTriviaSessionsRef.current,
    [key]: next,
  };

  localTriviaSessionsRef.current = updated;
  setLocalTriviaSessions(updated);
}

function recoverSingleSessions(data: TriviaResponse) {
  const capturedAt = performance.now();

  for (const question of data.questions) {
    saveTriviaSession(
      `QUESTION:${question.id}`,
      question,
      data.serverNow,
      capturedAt
    );
  }
}

function recoverQuizSessions(data: TriviaQuizzesResponse) {
  const capturedAt = performance.now();

  for (const quiz of data.quizzes) {
    saveTriviaSession(
      `QUIZ:${quiz.id}`,
      quiz,
      data.serverNow,
      capturedAt,
      quiz.endsAt
    );
  }
}

function getTriviaActivityKey(questionId: number) {
  if (
    selectedTriviaQuiz?.questions.some(
      (question) => question.id === questionId
    )
  ) {
    return `QUIZ:${selectedTriviaQuiz.quiz.id}`;
  }

  return `QUESTION:${questionId}`;
}

function getTriviaActivity(
  key: string,
  fallback?: Partial<TriviaCountdownFields>
): LocalTriviaSession {
  const activity = localTriviaSessions[key] ?? {
    durationSeconds: fallback?.durationSeconds ?? null,
    sessionStatus: fallback?.sessionStatus ?? null,
    session: fallback?.session ?? null,
    remainingSeconds: fallback?.remainingSeconds ?? null,
    clock: null,
  };

  if (participationAuth !== "authenticated") {
    return {
      durationSeconds: activity.durationSeconds,
      sessionStatus: null,
      session: null,
      remainingSeconds: null,
      clock: null,
    };
  }

  return {
    ...activity,
    sessionStatus: getEffectiveTriviaSessionStatus(
      activity.sessionStatus,
      activity.clock,
      triviaClockNow
    ),
  };
}

function isTriviaSubmissionBlocked(key: string) {
  if (participationAuth === "guest") {
    return false;
  }

  if (participationAuth !== "authenticated") {
    return true;
  }

  const activity = localTriviaSessions[key];

  return !canSubmitTriviaAnswer(
    activity?.sessionStatus ?? null,
    activity?.clock ?? null,
    triviaClockNow
  );
}

async function startTriviaActivity(
  kind: "QUESTION" | "QUIZ",
  id: number
) {
  if (participationAuth === "guest") {
    setParticipationPrompt("trivia");
    return;
  }

  if (participationAuth !== "authenticated") {
    setError("Unable to verify your sign-in status.");
    return;
  }

  if (triviaStartLock.current) return;

  triviaStartLock.current = true;

  const key = `${kind}:${id}`;

  setStartingTriviaKey(key);
  setError("");

  const requestEpoch =
    participationAuthEpoch.current;

  try {
    const response = await apiFetch(
      "/api/trivia/session",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        "X-Trivia-Viewer": String(participationUserIdRef.current),
        },
        body: JSON.stringify(
          kind === "QUESTION"
            ? { questionId: id }
            : { quizId: id }
        ),
      }
    );

    const result = await response.json();

    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    if (
      !validateTriviaResponseIdentity(
        result,
        requestEpoch
      )
    ) {
      return;
    }

    if (response.status === 401) {
      setParticipationAuth("guest");
      setParticipationPrompt("trivia");
      return;
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to start Trivia."
      );
    }

    const data = result as TriviaSessionResponse;

    saveTriviaSession(
      key,
      {
        durationSeconds: data.durationSeconds,
        sessionStatus: data.status,
        session: data.session,
        remainingSeconds: data.remainingSeconds,
      },
      data.serverNow,
      performance.now()
    );

    if (
      data.status === "EXPIRED" ||
      data.status === "CLOSED"
    ) {
      setError(
        data.status === "EXPIRED"
          ? "Time is up! This countdown has expired."
          : "This Trivia activity is closed."
      );
    }
  } catch (err) {
    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Unable to start Trivia."
    );
  } finally {
    if (
      requestEpoch === participationAuthEpoch.current
    ) {
      triviaStartLock.current = false;
      setStartingTriviaKey(null);
    }
  }
}

function renderTriviaCountdown(
  kind: "QUESTION" | "QUIZ",
  id: number,
  fallback: Partial<TriviaCountdownFields>,
  completed = false
) {
  const key = `${kind}:${id}`;
  const activity = getTriviaActivity(key, fallback);

  const status = completed
    ? "COMPLETED"
    : participationAuth === "guest"
      ? null
      : activity.sessionStatus;

  const canStart =
    !completed &&
    activity.durationSeconds !== null &&
    (
      status === "NOT_STARTED" ||
      participationAuth === "guest"
    );

  return (
    <>
      <TriviaCountdown
        status={status}
        durationSeconds={activity.durationSeconds}
        clock={activity.clock}
      />

      {canStart && (
        <button
          type="button"
          className="sf-trivia-quiz-button"
          disabled={
            startingTriviaKey !== null ||
            participationAuth === "checking" ||
            participationAuth === "error"
          }
          onClick={() =>
            void startTriviaActivity(kind, id)
          }
        >
          {startingTriviaKey === key
            ? "Starting..."
            : participationAuth === "guest"
              ? "Sign in to Start"
              : kind === "QUESTION"
                ? "Start Trivia"
                : "Start Quiz"}
        </button>
      )}
    </>
  );
}

  /*
   * ============================================================
   * GLOBAL UI STATE
   * ============================================================
   */

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [participationPrompt, setParticipationPrompt] =
    useState<"prediction" | "trivia" | null>(null);

  const participationDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!participationPrompt) return;

    const previouslyFocused = document.activeElement;

    const dialog = participationDialogRef.current;
    const controls = dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])'
    );

    controls?.[0]?.focus();

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setParticipationPrompt(null);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        participationDialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        ) ?? []
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);

    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [participationPrompt]);


  /*
   * ============================================================
   * LOAD PREDICTIONS
   * ============================================================
   */

  async function loadPredictions() {
    try {
      setPredictionsLoading(true);
      setError("");

      const response = await apiFetch("/api/predictions", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load predictions"
        );
      }

      setPredictionsData(result);

      const initialScores: Record<
        number,
        {
          homeScore: string;
          awayScore: string;
        }
      > = {};

      for (const match of result.matches ?? []) {
        if (match.prediction) {
          initialScores[match.id] = {
            homeScore: String(
              match.prediction.homeScore
            ),
            awayScore: String(
              match.prediction.awayScore
            ),
          };
        } else {
          initialScores[match.id] = {
            homeScore: "",
            awayScore: "",
          };
        }
      }

      setPredictionScores(initialScores);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load predictions"
      );
    } finally {
      setPredictionsLoading(false);
    }
  }


/*
 * ============================================================
 * LOAD POLLS
 * ============================================================
 */

async function loadPolls() {
  try {
    setPollsLoading(true);
    setError("");

    const response = await apiFetch("/api/polls", {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Failed to load polls."
      );
    }

    setPollsData(result);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to load polls."
    );
  } finally {
    setPollsLoading(false);
  }
}

/*
 * ============================================================
 * LOAD CONTINUOUS TRIVIA QUIZZES
 * ============================================================
 */

async function loadTriviaQuizzes() {
  const requestEpoch =
    participationAuthEpoch.current;

  try {
    setTriviaQuizzesLoading(true);
    setError("");

    const response = await apiFetch("/api/trivia/quizzes", {
      cache: "no-store",
    });

    const result = await response.json();

    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    if (
      !validateTriviaResponseIdentity(
        result,
        requestEpoch
      )
    ) {
      return;
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to load Trivia quizzes."
      );
    }

    const data = result as TriviaQuizzesResponse;
    recoverQuizSessions(data);
    setTriviaQuizzes(data.quizzes);
  } catch (err) {
    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Unable to load Trivia quizzes."
    );
  } finally {
    if (
      requestEpoch === participationAuthEpoch.current
    ) {
      setTriviaQuizzesLoading(false);
    }
  }
}

/*
 * ============================================================
 * OPEN A CONTINUOUS TRIVIA QUIZ
 * ============================================================
 */

async function openTriviaQuiz(quizId: number) {
  const requestEpoch =
    participationAuthEpoch.current;

  try {
    setSelectedTriviaQuizLoading(true);
    setError("");
    setMessage("");

    const response = await apiFetch(
      `/api/trivia/quizzes/${quizId}`,
      { cache: "no-store" }
    );

    const result = await response.json();

    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    if (
      !validateTriviaResponseIdentity(
        result,
        requestEpoch
      )
    ) {
      return;
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to open this Trivia quiz."
      );
    }

    const data = result as TriviaQuizDetailsResponse;

    saveTriviaSession(
      `QUIZ:${data.quiz.id}`,
      data.quiz,
      data.serverNow,
      performance.now(),
      data.quiz.endsAt
    );

    setSelectedTriviaQuiz(data);

    const firstUnansweredIndex =
      data.questions.findIndex(
        (question) => !question.attempted
      );

    setQuizQuestionIndex(
      firstUnansweredIndex >= 0
        ? firstUnansweredIndex
        : data.questions.length
    );

  } catch (err) {
    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Unable to open this Trivia quiz."
    );
  } finally {
    if (
      requestEpoch === participationAuthEpoch.current
    ) {
      setSelectedTriviaQuizLoading(false);
    }
  }
}

/*
 * ============================================================
 * LOAD TRIVIA
 * ============================================================
 */

async function loadTrivia() {
  const requestEpoch =
    participationAuthEpoch.current;

  try {
    setTriviaLoading(true);
    setError("");

    const response = await apiFetch("/api/trivia", {
      cache: "no-store",
    });

    const result = await response.json();

    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    if (
      !validateTriviaResponseIdentity(
        result,
        requestEpoch
      )
    ) {
      return;
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Failed to load Trivia."
      );
    }

    recoverSingleSessions(result as TriviaResponse);
    setTriviaData(result);
    setTriviaAnswers({});
  } catch (err) {
    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Failed to load Trivia."
    );
  } finally {
    if (
      requestEpoch === participationAuthEpoch.current
    ) {
      setTriviaLoading(false);
    }
  }
}

/*
 * ============================================================
 * LOAD POLLS WHEN TAB OPENS
 * ============================================================
 */

useEffect(() => {
  if (activeTab !== "polls") return;

  let cancelled = false;

  async function fetchPolls() {
    try {
      const responsePromise = apiFetch("/api/polls", {
        cache: "no-store",
      });

      await Promise.resolve();

      if (cancelled) return;

      setPollsLoading(true);
      setError("");

      const response = await responsePromise;
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load polls."
        );
      }

      if (!cancelled) {
        setPollsData(result);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load polls."
        );
      }
    } finally {
      if (!cancelled) {
        setPollsLoading(false);
      }
    }
  }

  void fetchPolls();

  return () => {
    cancelled = true;
  };
}, [activeTab]);


/*
 * ============================================================
 * LOAD CONTINUOUS QUIZZES WHEN TRIVIA TAB OPENS
 * ============================================================
 */

useEffect(() => {
  if (activeTab !== "trivia") return;

  let cancelled = false;

  async function fetchQuizzes() {
    if (
      participationAuthRef.current !== "authenticated" &&
      participationAuthRef.current !== "guest"
    ) {
      return;
    }

    const requestEpoch =
      participationAuthEpoch.current;

    setTriviaQuizzesLoading(true);

    try {
      const response = await apiFetch("/api/trivia/quizzes", {
        cache: "no-store",
      });

      const result = await response.json();

      if (
        cancelled ||
        requestEpoch !== participationAuthEpoch.current
      ) {
        return;
      }

      if (
        !validateTriviaResponseIdentity(
          result,
          requestEpoch
        )
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load Trivia quizzes."
        );
      }

      if (
        !cancelled &&
        requestEpoch === participationAuthEpoch.current
      ) {
        const data = result as TriviaQuizzesResponse;
        recoverQuizSessions(data);
        setTriviaQuizzes(data.quizzes);
      }
    } catch (err) {
      if (
        !cancelled &&
        requestEpoch === participationAuthEpoch.current
      ) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load Trivia quizzes."
        );
      }
    } finally {
      if (
        !cancelled &&
        requestEpoch === participationAuthEpoch.current
      ) {
        setTriviaQuizzesLoading(false);
      }
    }
  }

  void fetchQuizzes();

  return () => {
    cancelled = true;
  };
}, [
  activeTab,
  participationAuth,
  participationIdentityVersion
]);

/*
 * ============================================================
 * LOAD AND REFRESH TRIVIA WHILE TAB IS OPEN
 * ============================================================
 */

useEffect(() => {
  if (activeTab !== "trivia") return;

  let cancelled = false;
  let isFirstLoad = true;
  let requestInProgress = false;

  async function fetchTrivia() {
    if (
      participationAuthRef.current !== "authenticated" &&
      participationAuthRef.current !== "guest"
    ) {
      return;
    }

    const requestEpoch =
      participationAuthEpoch.current;

    if (requestInProgress || cancelled) return;

    requestInProgress = true;

    if (isFirstLoad) {
      setTriviaLoading(true);
      isFirstLoad = false;
    }

    try {
      const response = await apiFetch("/api/trivia", {
        cache: "no-store",
      });

      const result = await response.json();

      if (
        cancelled ||
        requestEpoch !== participationAuthEpoch.current
      ) {
        return;
      }

      if (
        !validateTriviaResponseIdentity(
          result,
          requestEpoch
        )
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load Trivia."
        );
      }

      if (
        !cancelled &&
        requestEpoch === participationAuthEpoch.current
      ) {
        const incoming = result as TriviaResponse;

        recoverSingleSessions(incoming);

        setTriviaData((current) => {

          if (!current) return incoming;

          const incomingIds = new Set(
            incoming.questions.map((question) => question.id)
          );

          const preservedQuestions = current.questions.filter(
            (question) =>
              triviaResultsRef.current[question.id] &&
              !incomingIds.has(question.id)
          );

          return {
            ...incoming,
            questions: [
              ...preservedQuestions,
              ...incoming.questions,
            ],
          };
        });

        setError("");
      }
    } catch (err) {
      if (
        !cancelled &&
        requestEpoch === participationAuthEpoch.current
      ) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load Trivia."
        );
      }
    } finally {
      requestInProgress = false;

      if (
        !cancelled &&
        !isFirstLoad &&
        requestEpoch === participationAuthEpoch.current
      ) {
        setTriviaLoading(false);
      }
    }
  }

  void fetchTrivia();

  const refreshInterval = window.setInterval(() => {
    void fetchTrivia();
  }, 15_000);

  return () => {
    cancelled = true;
    window.clearInterval(refreshInterval);
  };
}, [
  activeTab,
  participationAuth,
  participationIdentityVersion
]);

/*
 * ============================================================
 * SUBMIT POLL VOTE
 * ============================================================
 */

   async function handleVote(
     pollId: number,
     optionId: number
   ) {
   try {
    setVotingPollId(pollId);
    setError("");
    setMessage("");

    const response = await apiFetch("/api/polls/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pollId,
        optionId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to submit your vote."
      );
    }

    setMessage(
      result.isGuestVote
        ? "Your vote has been recorded successfully!"
        : `${result.message} You earned ${formatPoints(
            result.pointsEarned
          )} Fan Points.`
    );

    await loadPolls();
   } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to submit your vote."
    );
   } finally {
    setVotingPollId(null);
   }
  }

  /*
 * ============================================================
 * SUBMIT TRIVIA ANSWER
 * ============================================================
 */

async function handleTriviaAnswer(questionId: number) {
  if (participationAuth === "checking") {
    setError("Checking your sign-in status. Please try again.");
    return;
  }

  if (participationAuth === "guest") {
    setParticipationPrompt("trivia");
    return;
  }

  if (participationAuth === "error") {
    setError(
      "Unable to verify your sign-in status. Please try again."
    );
    return;
  }

  if (triviaSubmitLock.current) return;

  const activityKey = getTriviaActivityKey(questionId);

  const activity =
    localTriviaSessionsRef.current[activityKey];

  if (
    !canSubmitTriviaAnswer(
      activity?.sessionStatus ?? null,
      activity?.clock ?? null,
      performance.now()
    )
  ) {
    setError(
      activity?.sessionStatus === "NOT_STARTED"
        ? "Start this Trivia activity first."
        : "This Trivia activity is not accepting answers. Check your countdown."
    );
    return;
  }

  const selectedOption = triviaAnswers[questionId];

  if (!selectedOption) {
    setError("Please select an answer first.");
    return;
  }

  triviaSubmitLock.current = true;

  const requestEpoch =
    participationAuthEpoch.current;

  try {
    setTriviaSubmittingId(questionId);
    setError("");
    setMessage("");

    const response = await apiFetch("/api/trivia/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trivia-Viewer": String(participationUserIdRef.current),
      },
      body: JSON.stringify({
        questionId,
        selectedOption,
      }),
    });

    const result = await response.json();

    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    if (
      !validateTriviaResponseIdentity(
        result,
        requestEpoch
      )
    ) {
      return;
    }

    if (!response.ok) {
      if (response.status === 401) {
        setParticipationAuth("guest");
        setParticipationPrompt("trivia");
        return;
      }

      const terminalStatuses: Record<string, TriviaSessionStatus> = {
        TRIVIA_SESSION_EXPIRED: "EXPIRED",
        TRIVIA_SESSION_COMPLETED: "COMPLETED",
        TRIVIA_ACTIVITY_CLOSED: "CLOSED",
        QUESTION_DEADLINE_PASSED: "CLOSED",
        QUIZ_DEADLINE_PASSED: "CLOSED",
      };

      const terminalStatus =
        terminalStatuses[result.code];

      const current =
        localTriviaSessionsRef.current[activityKey];

      if (terminalStatus && current) {
        const updated = {
          ...localTriviaSessionsRef.current,
          [activityKey]: {
            ...current,
            sessionStatus: terminalStatus,
          },
        };

        localTriviaSessionsRef.current = updated;
        setLocalTriviaSessions(updated);
      }

      throw new Error(
        result.error || "Unable to submit your answer."
      );
    }

    const answerResult =
      result as TriviaAnswerResponse;

    const currentActivity =
      localTriviaSessionsRef.current[activityKey];

    if (
      currentActivity &&
      answerResult.sessionCompleted
    ) {
      const updated: Record<string, LocalTriviaSession> = {
        ...localTriviaSessionsRef.current,
        [activityKey]: {
          ...currentActivity,
          sessionStatus: "COMPLETED",
        },
      };

      localTriviaSessionsRef.current = updated;
      setLocalTriviaSessions(updated);
    }

    setMessage(
      answerResult.isCorrect
        ? `Correct! You earned ${formatPoints(
            answerResult.pointsAwarded
          )} Fan Points.`
        : "Not quite! No points were awarded."
    );

    setTriviaData((current) =>
      current
        ? {
            ...current,
            balance: answerResult.balance,
            totalPoints: answerResult.totalPoints,
          }
        : current
    );

    const updatedResults = {
      ...triviaResultsRef.current,
      [questionId]: answerResult,
    };

    triviaResultsRef.current = updatedResults;
    setTriviaResults(updatedResults);

    // Update continuous quiz progress only after a successful
    // backend submission. Independent Trivia is unaffected.
    setSelectedTriviaQuiz((current) => {
      if (!current) return current;

      const question = current.questions.find(
        (item) => item.id === questionId
      );

      if (!question || question.attempted) {
        return current;
      }

      const questions = current.questions.map((item) =>
        item.id === questionId
          ? {
              ...item,
              attempted: true,
              earnedPoints: answerResult.pointsAwarded,
            }
          : item
      );

      const completedCount = questions.filter(
        (item) => item.attempted
      ).length;

      const earnedPoints = questions.reduce(
        (total, item) => total + (item.earnedPoints ?? 0),
        0
      );

      return {
        ...current,
        questions,
        progress: {
          completedCount,
          earnedPoints,
          isCompleted:
            completedCount === questions.length &&
            questions.length > 0,
        },
      };
    });
  } catch (err) {
    if (
      requestEpoch !== participationAuthEpoch.current
    ) {
      return;
    }

    setError(
      err instanceof Error
        ? err.message
        : "Unable to submit your answer."
    );
  } finally {
    if (
      requestEpoch === participationAuthEpoch.current
    ) {
      triviaSubmitLock.current = false;
      setTriviaSubmittingId(null);
    }
  }
}

  /*
   * ============================================================
   * LOAD PREDICTIONS WHEN TAB OPENS
   * ============================================================
   */

  useEffect(() => {
  if (activeTab !== "predictions") return;

  let cancelled = false;

  async function fetchPredictions() {
    try {
      const responsePromise = apiFetch("/api/predictions", {
        cache: "no-store",
      });

      await Promise.resolve();

      if (cancelled) return;

      setPredictionsLoading(true);
      setError("");

      const response = await responsePromise;
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load predictions"
        );
      }

      if (cancelled) return;

      setPredictionsData(result);

      const initialScores: Record<
        number,
        {
          homeScore: string;
          awayScore: string;
        }
      > = {};

      for (const match of result.matches ?? []) {
        initialScores[match.id] = match.prediction
          ? {
              homeScore: String(match.prediction.homeScore),
              awayScore: String(match.prediction.awayScore),
            }
          : {
              homeScore: "",
              awayScore: "",
            };
      }

      setPredictionScores(initialScores);
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load predictions"
        );
      }
    } finally {
      if (!cancelled) {
        setPredictionsLoading(false);
      }
    }
  }

  void fetchPredictions();

  return () => {
    cancelled = true;
  };
  }, [activeTab]);

  /*
   * ============================================================
   * SUBMIT PREDICTION
   * ============================================================
   */

  async function handleSubmitPrediction(
    matchId: number
  ) {
    if (participationAuth === "checking") {
      setError(
        "Checking your sign-in status. Please try again."
      );
      return;
    }

    if (participationAuth === "guest") {
      setParticipationPrompt("prediction");
      return;
    }

    if (participationAuth !== "authenticated") {
      setError(
        "Unable to verify your account. Please try again."
      );
      return;
    }

    const scores = predictionScores[matchId];

    if (!scores) {
      setError("Please enter your prediction.");
      return;
    }

    const homeScore = Number(scores.homeScore);
    const awayScore = Number(scores.awayScore);

    if (
      scores.homeScore === "" ||
      scores.awayScore === "" ||
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0 ||
      homeScore > 20 ||
      awayScore > 20
    ) {
      setError(
        "Please enter valid scores between 0 and 20."
      );
      return;
    }

    try {
      setPredictionSubmittingId(matchId);
      setError("");
      setMessage("");

      const response = await apiFetch(
        "/api/predictions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            matchId,
            homeScore,
            awayScore,
          }),
        }
      );

      const responseText = await response.text();

      let result: {
        error?: string;
        message?: string;
        success?: boolean;
      };

     try {
       result = responseText
       ? JSON.parse(responseText)
        : {};
     } catch {
       throw new Error(
       `The prediction API returned an invalid response (HTTP ${response.status}). Please check the server logs.`
     );
    }

    if (!responseText) {
       throw new Error(
       `The prediction API returned an empty response (HTTP ${response.status}). Please check the server logs.`
     );
    }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to submit prediction"
        );
      }

      setMessage(
        result.message ||
          "Prediction submitted successfully."
      );

      // Refresh predictions after a successful submission.
      await loadPredictions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit prediction"
      );
    } finally {
      setPredictionSubmittingId(null);
    }
  }

  /*
   * ============================================================
   * PARTICIPATE FAN POINTS BALANCE
   * ============================================================
   */

  const participateFanPoints =
    participationAuth === "authenticated"
      ? triviaData?.balance ??
        pollsData?.balance ??
        predictionsData?.balance ??
        null
      : null;

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <div className="page">
      <section className="sf-arena-hero" aria-label="SportyFanz Arena">
        <div className="sf-arena-brand">
          <span>
            <span className="sf-arena-trophy">🏆</span>
            SPORTYFANZ ARENA
          </span>
          <span className="sf-arena-sparkle">✧</span>
        </div>

        <h1>Your Game. Your Glory.</h1>

        <p>
          Predict matches, vote on the biggest debates and prove your
          sports knowledge. Every correct play brings you closer to rewards.
        </p>

        <div className="sf-arena-actions" role="group" aria-label="Participation activities">
          {([
            ["predictions", "◎", "Predict"],
            ["polls", "☑", "Vote"],
            ["trivia", "♧", "Trivia"],
          ] as const).map(([tab, symbol, label]) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "sf-arena-action active" : "sf-arena-action"}
              aria-pressed={activeTab === tab}
              onClick={() => {
                setActiveTab(tab);
                setMessage("");
                setError("");
              }}
            >
              <span className={`sf-arena-action-icon sf-arena-icon-${tab}`}>
                {symbol}
              </span>
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </section>

      <div className="participate-grid">
        <div className="white-panel prediction-card">
          {/* =====================================================
              TABS
          ====================================================== */}

          {/* =====================================================
              SUCCESS MESSAGE
          ====================================================== */}

          {message && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                marginBottom: "20px",
                borderRadius: "10px",
              }}
            >
              <CheckCircle2 size={18} />

              <span>{message}</span>
            </div>
          )}

          {/* =====================================================
              ERROR MESSAGE
          ====================================================== */}

          {error && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: "20px",
                borderRadius: "10px",
              }}
            >
              {error}
            </div>
          )}

          {/* =====================================================
              PREDICTIONS
          ====================================================== */}

          {activeTab === "predictions" && (
            <>
              <div className="question-block">
                <span className="question-label">
                  MATCH PREDICTIONS
                </span>

                <h2>
                  Predict the final score.
                </h2>

                <p>
                  Put your football knowledge to work.
                  Submit your score prediction before
                  the prediction closing deadline and earn
                  Fan Points.
                </p>
              </div>

              {predictionsLoading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "50px",
                    gap: "10px",
                  }}
                >
                  <Loader2
                    size={24}
                    className="animate-spin"
                  />

                  <span>
                    Loading upcoming matches...
                  </span>
                </div>
              ) : !predictionsData ||
                predictionsData.matches.length ===
                  0 ? (
                <div className="question-block">
                  <Target size={28} />

                  <h2>
                    No upcoming matches
                  </h2>

                  <p>
                    There are no matches available
                    for predictions right now.
                    Check back soon.
                  </p>
                </div>
              ) : (
                predictionsData.matches.map(
                  (match) => {
                    const prediction =
                      match.prediction;

                    const scores =
                      predictionScores[
                        match.id
                      ] ?? {
                        homeScore: "",
                        awayScore: "",
                      };

                    const submitting =
                      predictionSubmittingId ===
                      match.id;

                    const submitted =
                      prediction !== null;

                    return (
                      <div
                        className="question-block"
                        key={match.id}
                      >
                        <span className="question-label">
                          {match.competition ||
                            match.sport?.name ||
                            "MATCH"}
                        </span>

                        <h2>
                          {match.homeTeam.name}{" "}
                          vs{" "}
                          {match.awayTeam.name}
                        </h2>

                        {match.imageUrl && (
                          <img
                            src={match.imageUrl}
                            alt={`Image for ${match.homeTeam.name} vs ${match.awayTeam.name}`}
                            loading="lazy"
                            style={{
                              display: "block",
                              width: "100%",
                              maxHeight: 320,
                              objectFit: "contain",
                              borderRadius: 12,
                              marginTop: 14,
                              marginBottom: 16,
                            }}
                          />
                        )}

                        <p>
                          {match.venue
                            ? `${match.venue} • `
                            : ""}
                          {formatMatchDate(
                            match.scheduledAt
                          )}{" "}
                          •{" "}
                          {formatMatchTime(
                            match.scheduledAt
                          )}
                        </p>

                        {/* ===============================
                            SCORE INPUTS
                        ================================ */}

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "1fr auto 1fr",
                            alignItems: "center",
                            gap: "16px",
                            marginTop: "24px",
                          }}
                        >
                          <div
                            style={{
                              textAlign: "center",
                            }}
                          >
                            <strong
                              style={{
                                display: "block",
                                marginBottom: "10px",
                              }}
                            >
                              {match.homeTeam.name}
                            </strong>

                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={
                                scores.homeScore
                              }
                              disabled={submitted}
                              onChange={(event) => {
                                setPredictionScores(
                                  (current) => ({
                                    ...current,
                                    [match.id]: {
                                      ...(
                                        current[
                                          match.id
                                        ] ?? {
                                          homeScore:
                                            "",
                                          awayScore:
                                            "",
                                        }
                                      ),
                                      homeScore:
                                        event.target
                                          .value,
                                    },
                                  })
                                );
                              }}
                              aria-label={`${match.homeTeam.name} predicted score`}
                              style={{
                                width: "72px",
                                height: "56px",
                                textAlign: "center",
                                fontSize: "24px",
                                fontWeight: 700,
                                borderRadius: "10px",
                                border:
                                  "1px solid rgba(0,0,0,0.12)",
                              }}
                            />
                          </div>

                          <strong
                            style={{
                              fontSize: "20px",
                            }}
                          >
                            —
                          </strong>

                          <div
                            style={{
                              textAlign: "center",
                            }}
                          >
                            <strong
                              style={{
                                display: "block",
                                marginBottom: "10px",
                              }}
                            >
                              {match.awayTeam.name}
                            </strong>

                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={
                                scores.awayScore
                              }
                              disabled={submitted}
                              onChange={(event) => {
                                setPredictionScores(
                                  (current) => ({
                                    ...current,
                                    [match.id]: {
                                      ...(
                                        current[
                                          match.id
                                        ] ?? {
                                          homeScore:
                                            "",
                                          awayScore:
                                            "",
                                        }
                                      ),
                                      awayScore:
                                        event.target
                                          .value,
                                    },
                                  })
                                );
                              }}
                              aria-label={`${match.awayTeam.name} predicted score`}
                              style={{
                                width: "72px",
                                height: "56px",
                                textAlign: "center",
                                fontSize: "24px",
                                fontWeight: 700,
                                borderRadius: "10px",
                                border:
                                  "1px solid rgba(0,0,0,0.12)",
                              }}
                            />
                          </div>
                        </div>

                        {/* ===============================
                            SUBMITTED PREDICTION
                        ================================ */}

                        {submitted && (
                          <div
                            style={{
                              marginTop: "18px",
                              display: "flex",
                              alignItems:
                                "center",
                              gap: "8px",
                            }}
                          >
                            <CheckCircle2
                              size={18}
                            />

                            <span>
                              Prediction submitted:{" "}
                              <strong>
                                {
                                  prediction.homeScore
                                }{" "}
                                -{" "}
                                {
                                  prediction.awayScore
                                }
                              </strong>
                            </span>
                          </div>
                        )}

                        {/* ===============================
                            SUBMIT BUTTON
                        ================================ */}

                        <button
                          type="button"
                          className="green-button"
                          disabled={
                            submitting ||
                            submitted
                          }
                          onClick={() => {
                            void handleSubmitPrediction(match.id);
                          }}
                          style={{
                            marginTop: "22px",
                          }}
                        >
                          {submitting ? (
                            <>
                              <Loader2
                                size={15}
                                className="animate-spin"
                              />

                              Submitting...
                            </>
                          ) : submitted ? (
                            <>
                              <CheckCircle2
                                size={15}
                              />

                              Prediction Submitted
                            </>
                          ) : (
                            <>
                              Submit Prediction

                              {participationAuth === "authenticated" && (
                                <span>
                                  +50 Fan Points
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      </div>
                    );
                  }
                )
              )}
            </>
          )}

          {/* =====================================================
              POLLS
          ====================================================== */}


            {activeTab === "polls" && (
              <>
             <div className="question-block">
               <span className="question-label">
                 FAN POLLS
               </span>

               <h2>Make your voice count.</h2>

              <p>
                Share your opinion on the biggest moments in
                sports. Everyone can vote, and registered fans
                earn Fan Points for participating.
              </p>
            </div>

            {pollsLoading ? (
           <div
             style={{
             display: "flex",
             justifyContent: "center",
             alignItems: "center",
             gap: "10px",
             padding: "50px",
            }}
           >
          <Loader2
            size={24}
            className="animate-spin"
          />
           <span>Loading fan polls...</span>
          </div>
          ) : !pollsData ||
           pollsData.polls.length === 0 ? (
          <div className="question-block">
            <Target size={28} />

           <h2>No active polls yet</h2>

          <p>
            New fan polls will appear here when they
            are published. Check back soon.
          </p>
        </div>
        ) : (
           pollsData.polls.map((poll) => {
           const hasVoted = poll.myVote !== null;
           const isVoting = votingPollId === poll.id;

          return (
            <div
              className="question-block"
              key={poll.id}
            >
            <span className="question-label">
              FAN POLL
            </span>

            <h2>{poll.question}</h2>

            {poll.description && (
              <p>{poll.description}</p>
            )}

            {poll.imageUrl && (
              <img
                src={poll.imageUrl}
                alt={`Image for poll: ${poll.question}`}
                loading="lazy"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "contain",
                  borderRadius: 12,
                  marginTop: 14,
                  marginBottom: 16,
                }}
              />
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "14px",
                marginBottom: "18px",
              }}
            >
              {participationAuth === "authenticated" && (
                <strong>
                  +{formatPoints(poll.pointsReward)} pts
                </strong>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              {poll.options.map((option) => {
                const selected =
                  poll.myVote?.optionId === option.id;

                return (
                  <div key={option.id}>
                    <button
                      type="button"
                      disabled={
                        hasVoted ||
                        !poll.isOpen ||
                        isVoting
                      }
                      onClick={() =>
                        handleVote(poll.id, option.id)
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: "10px",
                        border: selected
                          ? "2px solid #16a34a"
                          : "1px solid rgba(0,0,0,0.12)",
                        background: selected
                          ? "rgba(22,163,74,0.08)"
                          : "transparent",
                        color: "inherit",
                        textAlign: "left",
                        cursor:
                          hasVoted || !poll.isOpen
                            ? "default"
                            : "pointer",
                        font: "inherit",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {selected && (
                          <CheckCircle2 size={17} />
                        )}
                        {option.label}
                      </span>

                      {hasVoted && (
                        <strong>
                          {formatPoints(option.votes)}{" "}
                          {option.votes === 1 ? "vote" : "votes"}
                        </strong>
                      )}
                    </button>

                    {hasVoted && (
                      <div
                        className="progress-track"
                        style={{ marginTop: "6px" }}
                      >
                        <span
                          style={{
                            width: `${option.percentage}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasVoted ? (
              <p style={{ marginTop: "16px" }}>
                <CheckCircle2
                  size={16}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "6px",
                  }}
                />
                Your vote has been recorded.
              </p>
            ) : !poll.isOpen ? (
              <p style={{ marginTop: "16px" }}>
                This poll is not currently open for voting.
              </p>
            ) : (
              <p style={{ marginTop: "16px" }}>
                Select an option above to cast your vote.
              </p>
            )}

            {isVoting && (
              <p style={{ marginTop: "12px" }}>
                <Loader2
                  size={16}
                  className="animate-spin"
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: "6px",
                  }}
                />
                Submitting your vote...
              </p>
            )}

            {poll.endsAt && (
              <small
                style={{
                  display: "block",
                  marginTop: "12px",
                }}
              >
                Ends {formatDate(poll.endsAt)}
              </small>
            )}
           </div>
           );
          })
         )}
        </>
       )}

          {/* =====================================================
              TRIVIA
          ====================================================== */}

          {activeTab === "trivia" && (
  <>
    <section className="question-block">
      <span className="question-label">
        TRIVIA ARENA
      </span>

      <h2>Trivia Arena</h2>

      <p>
        Choose a quiz, test your sports knowledge and
        earn Fan Points.
      </p>

      {triviaQuizzesLoading ? (
        <p>Loading available quizzes...</p>
      ) : triviaQuizzes.length > 0 ? (
        <div className="sf-trivia-quiz-grid">
          {triviaQuizzes.map((quiz) => (
            <article className="sf-trivia-quiz-card" key={quiz.id}>
              <div className="sf-trivia-quiz-cover">
                {quiz.coverImageUrl ? (
                  <img
                    src={quiz.coverImageUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className="sf-trivia-cover-placeholder">
                    <span aria-hidden="true">🏆</span>
                    <strong>SPORTYFANZ TRIVIA</strong>
                  </div>
                )}
              </div>

              <div className="sf-trivia-quiz-content">
                <div className="sf-trivia-quiz-heading">
                  <h3>{quiz.title}</h3>

                  <span
                    className={
                      quiz.isCompleted
                        ? "sf-trivia-status completed"
                        : "sf-trivia-status available"
                    }
                  >
                    {quiz.isCompleted ||
                    getTriviaActivity(
                      `QUIZ:${quiz.id}`, quiz
                    ).sessionStatus === "COMPLETED"
                      ? "Completed"
                      : getTriviaActivity(
                          `QUIZ:${quiz.id}`, quiz
                        ).sessionStatus === "EXPIRED"
                        ? "Expired"
                        : getTriviaActivity(
                            `QUIZ:${quiz.id}`, quiz
                          ).sessionStatus === "ACTIVE"
                          ? "In Progress"
                          : getTriviaActivity(
                              `QUIZ:${quiz.id}`, quiz
                            ).sessionStatus === "CLOSED"
                            ? "Closed"
                            : "Available"}
                  </span>
                </div>

                {quiz.description && (
                  <p className="sf-trivia-quiz-description">
                    {quiz.description}
                  </p>
                )}

                <p className="sf-trivia-quiz-meta">
                  {quiz.questionCount} questions
                  <span aria-hidden="true"> · </span>
                  {formatPoints(quiz.maxPoints)} Fan Points
                  {quiz.durationSeconds !== null && (
                    <>
                      <span aria-hidden="true"> · </span>
                      {formatTriviaDuration(quiz.durationSeconds)}
                    </>
                  )}
                </p>

                {quiz.completedCount !== null && (
                  <p className="sf-trivia-quiz-progress">
                    {quiz.completedCount} of {quiz.questionCount} questions completed
                  </p>
                )}

                <button
                  type="button"
                  className="sf-trivia-quiz-button"
                  disabled={selectedTriviaQuizLoading}
                  onClick={() => void openTriviaQuiz(quiz.id)}
                >
                  {selectedTriviaQuizLoading
                    ? "Opening..."
                    : quiz.isCompleted
                      ? "Review Quiz"
                      : getTriviaActivity(
                          `QUIZ:${quiz.id}`, quiz
                        ).sessionStatus === "EXPIRED"
                        ? "View Quiz"
                        : getTriviaActivity(
                            `QUIZ:${quiz.id}`, quiz
                          ).sessionStatus === "ACTIVE" ||
                          quiz.completedCount
                          ? "Resume Quiz"
                          : "View Quiz"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p>
          No continuous quizzes are available yet.
          Check back for new sports quizzes.
        </p>
      )}

    </section>

    {selectedTriviaQuiz && (
      <section className="question-block" style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={() => {
            setSelectedTriviaQuiz(null);
            setQuizQuestionIndex(0);
            setMessage("");
          }}
        >
          Back to Quizzes
        </button>

        <div style={{ marginTop: 20 }}>
          <span className="question-label">
            CONTINUOUS QUIZ QUESTION
          </span>
          <h2>{selectedTriviaQuiz.quiz.title}</h2>
          {selectedTriviaQuiz.quiz.description && (
            <p>{selectedTriviaQuiz.quiz.description}</p>
          )}
        </div>

        {renderTriviaCountdown(
          "QUIZ",
          selectedTriviaQuiz.quiz.id,
          selectedTriviaQuiz.quiz,
          Boolean(selectedTriviaQuiz.progress?.isCompleted)
        )}

        {quizQuestionIndex >= selectedTriviaQuiz.questions.length ? (
          <div style={{ marginTop: 20 }}>
            <h3>
              {selectedTriviaQuiz.progress?.isCompleted
                ? "Quiz Complete!"
                : "Quiz Questions"}
            </h3>
            <p>
              {selectedTriviaQuiz.progress?.isCompleted
                ? "You have completed every question in this quiz."
                : "You have reached the end of the available questions."}
            </p>
            {selectedTriviaQuiz.progress && (
              <p>
                Questions completed:{" "}
                {selectedTriviaQuiz.progress.completedCount}
                {" / "}
                {selectedTriviaQuiz.quiz.questionCount}
                {" · "}
                Points earned:{" "}
                {formatPoints(selectedTriviaQuiz.progress.earnedPoints)}
              </p>
            )}
          </div>
        ) : (
          (() => {
            const question =
              selectedTriviaQuiz.questions[quizQuestionIndex];

            return (
              <div style={{ marginTop: 20 }}>
                <span className="question-label">
                  QUESTION {quizQuestionIndex + 1} OF{" "}
                  {selectedTriviaQuiz.questions.length}
                </span>

                <h3 style={{ marginTop: 12 }}>
                  {question.question}
                </h3>

                {question.imageUrl && (
                  <img
                    src={question.imageUrl}
                    alt=""
                    loading="lazy"
                    style={{
                      width: "100%",
                      maxHeight: 300,
                      objectFit: "contain",
                      borderRadius: 12,
                      marginTop: 16,
                    }}
                  />
                )}

                <p style={{ marginTop: 12 }}>
                  Earn {formatPoints(question.pointsReward)}{" "}
                  Fan Points for a correct answer.
                </p>

                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  {question.options.map((option) => (
                    <label
                      key={option.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: 14,
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                      }}
                    >
                      <input
                        type="radio"
                        name={`quiz-${question.id}`}
                        checked={
                          triviaAnswers[question.id] === option.value
                        }
                        disabled={
                          question.attempted ||
                          Boolean(triviaResults[question.id]) ||
                          triviaSubmittingId !== null ||
                          isTriviaSubmissionBlocked(
                            `QUIZ:${selectedTriviaQuiz.quiz.id}`
                          )
                        }
                        onChange={() =>
                          setTriviaAnswers((current) => ({
                            ...current,
                            [question.id]: option.value,
                          }))
                        }
                      />
                      <span>
                        <strong>{option.value}.</strong>{" "}
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>

                {triviaResults[question.id] ? (
                  <div
                    role="status"
                    style={{
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 12,
                      background: triviaResults[question.id].isCorrect
                        ? "#ecfdf5"
                        : "#fef2f2",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <strong>
                      {triviaResults[question.id].isCorrect
                        ? "Correct answer!"
                        : "Incorrect answer"}
                    </strong>

                    <p style={{ marginTop: 10 }}>
                      Correct answer:{" "}
                      <strong>
                        {triviaResults[question.id].correctOption}.
                        {" "}
                        {triviaResults[question.id].correctAnswer}
                      </strong>
                    </p>

                    <p>
                      Points earned:{" "}
                      {formatPoints(
                        triviaResults[question.id].pointsAwarded
                      )}
                    </p>

                    {triviaResults[question.id].explanation && (
                      <p style={{ marginTop: 10 }}>
                        {triviaResults[question.id].explanation}
                      </p>
                    )}
                  </div>
                ) : question.attempted ? (
                  <p style={{ marginTop: 16 }}>
                    You have already answered this question.
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={
                      !triviaAnswers[question.id] ||
                      triviaSubmittingId !== null ||
                      isTriviaSubmissionBlocked(
                        `QUIZ:${selectedTriviaQuiz.quiz.id}`
                      )
                    }
                    onClick={() =>
                      void handleTriviaAnswer(question.id)
                    }
                    style={{ marginTop: 16 }}
                  >
                    {triviaSubmittingId === question.id
                      ? "Submitting..."
                      : "Submit Answer"}
                  </button>
                )}

                {(question.attempted ||
                  triviaResults[question.id]) && (
                  <button
                    type="button"
                    style={{ marginTop: 16 }}
                    onClick={() => {
                      const nextIndex =
                        selectedTriviaQuiz.questions.findIndex(
                          (item, index) =>
                            index > quizQuestionIndex &&
                            !item.attempted
                        );

                      const firstUnansweredIndex =
                        selectedTriviaQuiz.questions.findIndex(
                          (item) => !item.attempted
                        );

                      setQuizQuestionIndex(
                        nextIndex >= 0
                          ? nextIndex
                          : firstUnansweredIndex >= 0
                            ? firstUnansweredIndex
                            : selectedTriviaQuiz.questions.length
                      );
                    }}
                  >
                    Next Question
                  </button>
                )}
              </div>
            );
          })()
        )}
      </section>
    )}

    <div className="question-block">
      <span className="question-label">
        SPORTY TRIVIA
      </span>

      <h2>
        Test your sports knowledge.
      </h2>

      <p>
        Answer each question correctly to earn
        Fan Points. Each question can only be
        attempted once.
      </p>

      {participationAuth === "authenticated" &&
        triviaData?.balance != null && (
          <p>
            <strong>
              Your balance:{" "}
              {formatPoints(triviaData.balance)} Fan Points
            </strong>
          </p>
        )}
    </div>

    {triviaLoading ? (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "40px",
        }}
      >
        <Loader2 size={24} className="animate-spin" />
      </div>
    ) : triviaData?.questions.length ? (
      triviaData.questions.map((question, index) => (
        <div
          className="question-block"
          key={question.id}
          style={{ marginTop: "20px" }}
        >
          <span className="question-label">
            QUESTION {index + 1} OF{" "}
            {triviaData.questions.length}
          </span>

          <h2>{question.question}</h2>

          {renderTriviaCountdown(
            "QUESTION",
            question.id,
            question,
            Boolean(triviaResults[question.id])
          )}

          {question.imageUrl && (
            <img
              src={question.imageUrl}
              alt={`Image for trivia question: ${question.question}`}
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                maxHeight: 300,
                objectFit: "contain",
                borderRadius: 12,
                marginTop: 14,
                marginBottom: 16,
              }}
            />
          )}

          <p>
            Earn {formatPoints(question.pointsReward)}{" "}
            Fan Points for a correct answer.
          </p>

          <div
            style={{
              display: "grid",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            {question.options.map((option) => (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  cursor: triviaSubmittingId === question.id
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                <input
                  type="radio"
                  name={`trivia-${question.id}`}
                  value={option.value}
                  checked={
                    triviaAnswers[question.id] ===
                    option.value
                  }
                  disabled={
                    triviaSubmittingId !== null ||
                    Boolean(triviaResults[question.id]) ||
                    isTriviaSubmissionBlocked(
                      `QUESTION:${question.id}`
                    )
                  }
                  onChange={() =>
                    setTriviaAnswers((current) => ({
                      ...current,
                      [question.id]: option.value,
                    }))
                  }
                />

                <span>
                  <strong>{option.value}.</strong>{" "}
                  {option.label}
                </span>
              </label>
            ))}
          </div>

          {triviaResults[question.id] ? (
            <div
              role="status"
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 12,
                background: triviaResults[question.id].isCorrect
                  ? "#ecfdf5"
                  : "#fef2f2",
                border: `1px solid ${
                  triviaResults[question.id].isCorrect
                    ? "#86efac"
                    : "#fca5a5"
                }`,
                color: "#172033",
              }}
            >
              <strong>
                {triviaResults[question.id].isCorrect
                  ? `Correct! +${formatPoints(
                      triviaResults[question.id].pointsAwarded
                    )} Fan Points`
                  : "Incorrect answer. +0 Fan Points"}
              </strong>

              <p style={{ marginTop: 10 }}>
                Correct answer:{" "}
                <strong>
                  {triviaResults[question.id].correctOption}.{" "}
                  {triviaResults[question.id].correctAnswer}
                </strong>
              </p>

              <button
                type="button"
                style={{ marginTop: 12 }}
                onClick={() => {
                  const next = {
                    ...triviaResultsRef.current,
                  };

                  delete next[question.id];

                  triviaResultsRef.current = next;
                  setTriviaResults(next);

                  setTriviaData((current) =>
                    current
                      ? {
                          ...current,
                          questions: current.questions.filter(
                            (item) => item.id !== question.id
                          ),
                        }
                      : current
                  );

                  void loadTrivia();
                }}
              >
                Continue
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={
                !triviaAnswers[question.id] ||
                triviaSubmittingId !== null ||
                isTriviaSubmissionBlocked(
                  `QUESTION:${question.id}`
                )
              }
              onClick={() =>
                handleTriviaAnswer(question.id)
              }
              style={{ marginTop: "16px" }}
            >
              {triviaSubmittingId === question.id
                ? "Submitting..."
                : "Submit Answer"}
            </button>
          )}
        </div>
      ))
    ) : (
      <div className="question-block">
        <span className="question-label">
          SPORTY TRIVIA
        </span>

        <h2>You’re all caught up!</h2>

        <p>
          You have answered all currently available
          Trivia questions, or there are no active
          questions yet. Check back when new questions
          are available.
        </p>
      </div>
    )}
   </>
 )}

        </div>

        {/* =======================================================
            RIGHT SIDEBAR
        ======================================================== */}

        <aside className="participate-side">
          <div className="participate-banner">
            <Sparkles size={27} />

            <h3>Earn while you watch.</h3>

            <p>
              Make predictions, vote in polls and answer
              Trivia questions to enjoy SportyFanz.
              Registered fans can earn Fan Points.
            </p>
          </div>

        </aside>
      </div>

      {participationPrompt && (
        <div
          role="presentation"
          onClick={() => setParticipationPrompt(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(0, 20, 35, 0.65)",
          }}
        >
          <div
            ref={participationDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="participation-auth-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              padding: 28,
              borderRadius: 16,
              background: "#ffffff",
              color: "#062f49",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <h2
              id="participation-auth-title"
              style={{ marginBottom: 12 }}
            >
              Join SportyFanz to Submit
            </h2>

            <p style={{ lineHeight: 1.6, marginBottom: 22 }}>
              {participationPrompt === "prediction"
                ? "Sign in or create an account to submit your prediction and earn eligible Fan Points."
                : "Sign in or create an account to submit your Trivia answer and earn eligible Fan Points."}
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/login"
                style={{
                  padding: "12px 20px",
                  borderRadius: 8,
                  background: "#062f49",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Sign In
              </Link>

              <Link
                href="/register"
                style={{
                  padding: "12px 20px",
                  borderRadius: 8,
                  background: "#7ccf72",
                  color: "#062f49",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Create Account
              </Link>

              <button
                type="button"
                onClick={() => setParticipationPrompt(null)}
                style={{
                  padding: "12px 16px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  background: "#ffffff",
                  color: "#062f49",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
