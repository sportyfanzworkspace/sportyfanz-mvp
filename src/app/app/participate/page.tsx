"use client";

import {
  CheckCircle2,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";

type Participation = {
  id: number;
  progress: number;
  target: number | null;
  status: string;
  completedAt: string | null;
};

type Challenge = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  type: string;
  pointsReward: number;
  targetValue: number | null;
  targetLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl: string | null;
  participation: Participation | null;
};

type ChallengesResponse = {
  balance: number;
  totalPoints: number;
  challenges: Challenge[];
};

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
  balance: number;
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
  balance: number;
  totalPoints: number;
  polls: FanPoll[];
};

type TriviaOption = {
  value: "A" | "B" | "C" | "D";
  label: string;
};

type TriviaQuestion = {
  id: number;
  question: string;
  options: TriviaOption[];
  pointsReward: number;
  attempted: boolean;
};

type TriviaResponse = {
  success: boolean;
  balance: number;
  totalPoints: number;
  roundSize: number;
  questions: TriviaQuestion[];
  attemptedCount: number;
};

type TriviaAnswerResponse = {
  success: boolean;
  message: string;
  isCorrect: boolean;
  pointsAwarded: number;
  balance: number;
  totalPoints: number;
  questionId: number;
  attemptId: number;
};

type ParticipateTab =
  | "predictions"
  | "polls"
  | "trivia"
  | "challenges";

function formatPoints(points: number) {
  return new Intl.NumberFormat("en-US").format(points);
}

function formatChallengeType(type: string) {
  return type.replace(/_/g, " ");
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

  /*
   * ============================================================
   * CHALLENGES STATE
   * ============================================================
   */

  const [data, setData] =
    useState<ChallengesResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [joiningId, setJoiningId] =
    useState<number | null>(null);

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

  /*
   * ============================================================
   * GLOBAL UI STATE
   * ============================================================
   */

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  /*
   * ============================================================
   * LOAD CHALLENGES
   * ============================================================
   */

  async function loadChallenges() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/challenges", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load challenges"
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load challenges"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ============================================================
   * LOAD PREDICTIONS
   * ============================================================
   */

  async function loadPredictions() {
    try {
      setPredictionsLoading(true);
      setError("");

      const response = await fetch("/api/predictions", {
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

    const response = await fetch("/api/polls", {
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
 * LOAD TRIVIA
 * ============================================================
 */

async function loadTrivia() {
  try {
    setTriviaLoading(true);
    setError("");

    const response = await fetch("/api/trivia", {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Failed to load Trivia."
      );
    }

    setTriviaData(result);
    setTriviaAnswers({});
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to load Trivia."
    );
  } finally {
    setTriviaLoading(false);
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
      const responsePromise = fetch("/api/polls", {
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
 * LOAD AND REFRESH TRIVIA WHILE TAB IS OPEN
 * ============================================================
 */

useEffect(() => {
  if (activeTab !== "trivia") return;

  let cancelled = false;
  let isFirstLoad = true;
  let requestInProgress = false;

  async function fetchTrivia() {
    if (requestInProgress || cancelled) return;

    requestInProgress = true;

    if (isFirstLoad) {
      setTriviaLoading(true);
      isFirstLoad = false;
    }

    try {
      const response = await fetch("/api/trivia", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load Trivia."
        );
      }

      if (!cancelled) {
        setTriviaData(result);
        setError("");
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load Trivia."
        );
      }
    } finally {
      requestInProgress = false;

      if (!cancelled && !isFirstLoad) {
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
}, [activeTab]);

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

    const response = await fetch("/api/polls/vote", {
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
      `${result.message} You earned ${formatPoints(
        result.pointsEarned
      )} Sporty Points.`
    );

    await Promise.all([
      loadPolls(),
      loadChallenges(),
    ]);
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
  const selectedOption = triviaAnswers[questionId];

  if (!selectedOption) {
    setError("Please select an answer first.");
    return;
  }

  try {
    setTriviaSubmittingId(questionId);
    setError("");
    setMessage("");

    const response = await fetch("/api/trivia/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questionId,
        selectedOption,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Unable to submit your answer."
      );
    }

    const answerResult =
      result as TriviaAnswerResponse;

    setMessage(
      answerResult.isCorrect
        ? `Correct! You earned ${formatPoints(
            answerResult.pointsAwarded
          )} Sporty Points.`
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

    await loadTrivia();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to submit your answer."
    );
  } finally {
    setTriviaSubmittingId(null);
  }
}

  /*
   * ============================================================
   * INITIAL CHALLENGE LOAD
   * ============================================================
   */

  useEffect(() => {
  let cancelled = false;

  async function fetchChallenges() {
    try {
      const responsePromise = fetch("/api/challenges", {
        cache: "no-store",
      });

      await Promise.resolve();

      if (cancelled) return;

      setLoading(true);
      setError("");

      const response = await responsePromise;
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load challenges"
        );
      }

      if (!cancelled) {
        setData(result);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load challenges"
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void fetchChallenges();

   return () => {
    cancelled = true;
   };
  }, []);

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
      const responsePromise = fetch("/api/predictions", {
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
   * JOIN CHALLENGE
   * ============================================================
   */

  async function handleJoinChallenge(
    challengeId: number
  ) {
    try {
      setJoiningId(challengeId);
      setError("");
      setMessage("");

      const response = await fetch(
        "/api/challenges/participate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            challengeId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to join challenge"
        );
      }

      setMessage(
        result.message ||
          "Challenge joined successfully."
      );

      await loadChallenges();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to join challenge"
      );
    } finally {
      setJoiningId(null);
    }
  }

  /*
   * ============================================================
   * SUBMIT PREDICTION
   * ============================================================
   */

  async function handleSubmitPrediction(
    matchId: number
  ) {
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

      const response = await fetch(
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

      /*
       * Reload both predictions and challenges.
       *
       * This is important because submitting the prediction
       * can complete the "Predict the Match" challenge and
       * award the user's Sporty Points.
       */

      await Promise.all([
        loadPredictions(),
        loadChallenges(),
      ]);
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
   * DERIVED CHALLENGE DATA
   * ============================================================
   */

  const challenges = data?.challenges ?? [];

  const joinedChallenges = challenges.filter(
    (challenge) =>
      challenge.participation !== null
  );

  const completedChallenges = challenges.filter(
    (challenge) =>
      challenge.participation?.status ===
      "COMPLETED"
  );

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span>PLAY • PREDICT • EARN</span>

          <h1>Participate</h1>

          <p>
            Put your sports knowledge to work and earn
            Sporty Points.
          </p>
        </div>
      </div>

      <div className="participate-grid">
        <div className="white-panel prediction-card">
          {/* =====================================================
              TABS
          ====================================================== */}

          <div className="participate-tabs">
            <button
              type="button"
              className={
                activeTab === "predictions"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setActiveTab("predictions");
                setMessage("");
                setError("");
              }}
            >
              Predictions
            </button>

            <button
              type="button"
              className={
                activeTab === "polls"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setActiveTab("polls");
                setMessage("");
                setError("");
              }}
            >
              Polls
            </button>

            <button
              type="button"
              className={
                activeTab === "trivia"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setActiveTab("trivia");
                setMessage("");
                setError("");
              }}
            >
              Trivia
            </button>

            <button
              type="button"
              className={
                activeTab === "challenges"
                  ? "active"
                  : ""
              }
              onClick={() => {
                setActiveTab("challenges");
                setMessage("");
                setError("");
              }}
            >
              Challenges
            </button>
          </div>

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
                  the match starts and earn Sporty
                  Points.
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
                          onClick={() =>
                            handleSubmitPrediction(
                              match.id
                            )
                          }
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

                              <span>
                                +50 pts
                              </span>
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
                sports. Cast your vote and earn Sporty Points.
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
              <strong>
                +{formatPoints(poll.pointsReward)} pts
              </strong>

              <span>
                {formatPoints(poll.totalVotes)}{" "}
                {poll.totalVotes === 1 ? "vote" : "votes"}
              </span>
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
                          {option.percentage}%
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
    <div className="question-block">
      <span className="question-label">
        SPORTY TRIVIA
      </span>

      <h2>
        Test your sports knowledge.
      </h2>

      <p>
        Answer each question correctly to earn
        Sporty Points. Each question can only be
        attempted once.
      </p>

      {triviaData && (
        <p>
          <strong>
            Your balance:{" "}
            {formatPoints(triviaData.balance)} Sporty Points
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

          <p>
            Earn {formatPoints(question.pointsReward)}{" "}
            Sporty Points for a correct answer.
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
                    triviaSubmittingId === question.id
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

          <button
            type="button"
            disabled={
              !triviaAnswers[question.id] ||
              triviaSubmittingId === question.id
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

          {/* =====================================================
              CHALLENGES
          ====================================================== */}

          {activeTab === "challenges" && (
            <>
              <div className="question-block">
                <span className="question-label">
                  SPORTYFANZ CHALLENGES
                </span>

                <h2>
                  Complete challenges. Earn points.
                </h2>

                <p>
                  Take part in fan activities and
                  build your progress toward SportyFanz
                  rewards.
                </p>
              </div>

              {loading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "50px",
                  }}
                >
                  <Loader2
                    size={28}
                    className="animate-spin"
                  />
                </div>
              ) : challenges.length === 0 ? (
                <div className="question-block">
                  <Target size={28} />

                  <h2>
                    No active challenges
                  </h2>

                  <p>
                    Check back soon for new SportyFanz
                    challenges.
                  </p>
                </div>
              ) : (
                challenges.map((challenge) => {
                  const participation =
                    challenge.participation;

                  const joined =
                    participation !== null;

                  const completed =
                    participation?.status ===
                    "COMPLETED";

                  const joining =
                    joiningId === challenge.id;

                  const progress =
                    participation?.progress ?? 0;

                  const target =
                    participation?.target ??
                    challenge.targetValue ??
                    0;

                  const progressPercent =
                    target > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (progress /
                              target) *
                              100
                          )
                        )
                      : 0;

                  return (
                    <div
                      className="question-block"
                      key={challenge.id}
                    >
                      <span className="question-label">
                        {formatChallengeType(
                          challenge.type
                        )}
                      </span>

                      <h2>
                        {challenge.title}
                      </h2>

                      {challenge.description && (
                        <p>
                          {challenge.description}
                        </p>
                      )}

                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap: "16px",
                          marginTop: "12px",
                        }}
                      >
                        <strong>
                          +
                          {formatPoints(
                            challenge.pointsReward
                          )}{" "}
                          pts
                        </strong>

                        {challenge.targetLabel && (
                          <span>
                            {
                              challenge.targetLabel
                            }
                          </span>
                        )}
                      </div>

                      {/* ===============================
                          PROGRESS
                      ================================ */}

                      {joined && (
                        <div
                          style={{
                            marginTop: "18px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "space-between",
                              marginBottom: "8px",
                            }}
                          >
                            <span>
                              Progress
                            </span>

                            <strong>
                              {progress} /{" "}
                              {target}
                            </strong>
                          </div>

                          <div className="progress-track">
                            <span
                              style={{
                                width: `${progressPercent}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* ===============================
                          JOIN BUTTON
                      ================================ */}

                      <button
                        type="button"
                        className="green-button"
                        disabled={
                          joining ||
                          completed
                        }
                        onClick={() =>
                          handleJoinChallenge(
                            challenge.id
                          )
                        }
                        style={{
                          marginTop: "18px",
                        }}
                      >
                        {joining ? (
                          <>
                            <Loader2
                              size={15}
                              className="animate-spin"
                            />

                            Joining...
                          </>
                        ) : completed ? (
                          <>
                            <CheckCircle2
                              size={15}
                            />

                            Completed
                          </>
                        ) : joined ? (
                          <>
                            <CheckCircle2
                              size={15}
                            />

                            Joined
                          </>
                        ) : (
                          <>
                            <Target
                              size={15}
                            />

                            Join Challenge
                          </>
                        )}
                      </button>

                      {/* ===============================
                          CHALLENGE DATES
                      ================================ */}

                      {(challenge.startsAt ||
                        challenge.endsAt) && (
                        <small
                          style={{
                            display: "block",
                            marginTop: "12px",
                          }}
                        >
                          {challenge.startsAt &&
                            `Starts ${formatDate(
                              challenge.startsAt
                            )}`}

                          {challenge.startsAt &&
                            challenge.endsAt &&
                            " • "}

                          {challenge.endsAt &&
                            `Ends ${formatDate(
                              challenge.endsAt
                            )}`}
                        </small>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* =======================================================
            RIGHT SIDEBAR
        ======================================================== */}

        <aside className="participate-side">
          {/* =====================================================
              PARTICIPATE BANNER
          ====================================================== */}

          <div className="participate-banner">
            <Sparkles size={27} />

            <h3>
              Earn while you watch.
            </h3>

            <p>
              Every prediction, poll and challenge
              brings you closer to your next reward.
            </p>
          </div>

          {/* =====================================================
              YOUR PROGRESS
          ====================================================== */}

          <div className="white-panel">
            <div className="panel-title">
              <h3>Your Progress</h3>
            </div>

            {/* SPORTY POINTS */}

            <div className="progress-stat">
              <span>
                Sporty Points
              </span>

              <strong>
                {loading
                  ? "..."
                  : formatPoints(
                      data?.balance ?? 0
                    )}
              </strong>
            </div>

            <div className="progress-track">
              <span
                style={{
                  width: "100%",
                }}
              />
            </div>

            {/* CHALLENGES JOINED */}

            <div className="progress-stat">
              <span>
                Challenges Joined
              </span>

              <strong>
                {joinedChallenges.length}
              </strong>
            </div>

            <div className="progress-track">
              <span
                style={{
                  width:
                    challenges.length > 0
                      ? `${Math.min(
                          100,
                          Math.round(
                            (joinedChallenges.length /
                              challenges.length) *
                              100
                          )
                        )}%`
                      : "0%",
                }}
              />
            </div>

            {/* CHALLENGES COMPLETED */}

            <div className="progress-stat">
              <span>
                Challenges Completed
              </span>

              <strong>
                {completedChallenges.length}
              </strong>
            </div>

            <div className="progress-track">
              <span
                style={{
                  width:
                    challenges.length > 0
                      ? `${Math.min(
                          100,
                          Math.round(
                            (completedChallenges.length /
                              challenges.length) *
                              100
                          )
                        )}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}