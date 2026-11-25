import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
  isTriviaQuizFullyAvailable,
} from "@/lib/trivia/quiz-availability";
import { lockFanProfile } from "@/lib/accounting/lock-fan-profile";
import { getCurrentUserId } from "@/lib/auth";
import {
  getTriviaSessionStatus,
  type TriviaActivityTiming,
} from "@/lib/trivia/session-timing";

const VALID_OPTIONS = ["A", "B", "C", "D"] as const;
type TriviaOption = (typeof VALID_OPTIONS)[number];

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to answer Trivia." },
        { status: 401 }
      );
    }

    const expectedViewer =
      request.headers.get("X-Trivia-Viewer");

    if (
      expectedViewer !== null &&
      expectedViewer !== String(userId)
    ) {
      return NextResponse.json(
        {
          error: "Your signed-in account has changed.",
          code: "TRIVIA_IDENTITY_CHANGED",
        },
        {
          status: 409,
          headers: {
            "Cache-Control": "private, no-store",
          },
        }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const questionId = input.questionId;
    const selectedOption = input.selectedOption;

    if (
      typeof questionId !== "number" ||
      !Number.isSafeInteger(questionId) ||
      questionId <= 0 ||
      questionId > 2147483647 ||
      typeof selectedOption !== "string" ||
      !VALID_OPTIONS.includes(
        selectedOption as TriviaOption
      )
    ) {
      return NextResponse.json(
        { error: "Select a valid answer." },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User
        .where({ id: userId })
        .first();

      if (!user || user.status !== "ACTIVE") {
        throw new Error("USER_NOT_ACTIVE");
      }

      const profile = await lockFanProfile(tx, userId);

      if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      // Coordinate answer submission with administrator Close.
      // The conditional UPDATE is intended to hold the question row
      // lock until the transaction commits or rolls back.
      const question = await tx.orm.public.TriviaQuestion
        .where({
          id: questionId,
          status: "ACTIVE",
        })
        .update({ status: "ACTIVE" });

        
        if (!question || question.status !== "ACTIVE") {
          throw new Error("QUESTION_NOT_AVAILABLE");
        }

        const now = Date.now();

       if (
         question.startsAt &&
         new Date(question.startsAt).getTime() > now
       ) {
        throw new Error("QUESTION_NOT_STARTED");
       }

      if (
        question.endsAt &&
        new Date(question.endsAt).getTime() <= now
      ) {
        throw new Error("QUESTION_DEADLINE_PASSED");
      }


      // Quiz questions must also satisfy their parent quiz schedule.
      // Independent Trivia questions have quizId === null.
      if (question.quizId !== null) {
        const quizLockPlan = db.raw.sql`
          SELECT "id"
          FROM "public"."trivia_quizzes"
          WHERE "id" = ${question.quizId}
          FOR UPDATE
        `
          .returnsRow({
            id: "pg/int4@1",
          })
          .build();

        let quizLocked = false;

        for await (const row of tx.query(quizLockPlan)) {
          if (row.id === question.quizId) {
            quizLocked = true;
          }
        }

        if (!quizLocked) {
          throw new Error("QUIZ_NOT_AVAILABLE");
        }

        const quiz = await tx.orm.public.TriviaQuiz
          .where({ id: question.quizId })
          .first();

        if (!quiz || quiz.status !== "ACTIVE") {
          throw new Error("QUIZ_NOT_AVAILABLE");
        }
      }

      let activity: TriviaActivityTiming = question;

      // Recheck all deadlines after acquiring the required locks.
      const submissionTime = Date.now();

      if (
        question.endsAt &&
        new Date(question.endsAt).getTime() <= submissionTime
      ) {
        throw new Error("QUESTION_DEADLINE_PASSED");
      }

      if (question.quizId !== null) {
        const quiz = await tx.orm.public.TriviaQuiz
          .where({ id: question.quizId })
          .first();

        if (!quiz || quiz.status !== "ACTIVE") {
          throw new Error("QUIZ_NOT_AVAILABLE");
        }

        activity = quiz;

        if (
          quiz.startsAt &&
          new Date(quiz.startsAt).getTime() > submissionTime
        ) {
          throw new Error("QUIZ_NOT_STARTED");
        }

        if (
          quiz.endsAt &&
          new Date(quiz.endsAt).getTime() <= submissionTime
        ) {
          throw new Error("QUIZ_DEADLINE_PASSED");
        }
      }

      const existingAttempt = await tx.orm.public.TriviaAttempt
        .where({ questionId, userId })
        .first();

      if (existingAttempt) {
        throw new Error("ALREADY_ATTEMPTED");
      }

      const sessionTarget =
        question.quizId === null
          ? {
              questionId: question.id,
              quizId: null,
            }
          : {
              questionId: null,
              quizId: question.quizId,
            };

      const session = await tx.orm.public.TriviaSession
        .where({
          userId,
          ...sessionTarget,
        })
        .first();

      // Acquire the session row lock after the profile and
      // activity locks, preserving the existing lock order.
      if (session) {
        const sessionLockPlan = db.raw.sql`
          SELECT "id"
          FROM "public"."trivia_sessions"
          WHERE "id" = ${session.id}
            AND "userId" = ${userId}
          FOR UPDATE
        `.returnsRow({
          id: "pg/int4@1",
        }).build();

        let sessionLocked = false;

        for await (
          const row of tx.query(sessionLockPlan)
        ) {
          if (row.id === session.id) {
            sessionLocked = true;
          }
        }

        if (!sessionLocked) {
          throw new Error("TRIVIA_SESSION_REQUIRED");
        }
      }

      const currentSession = session
        ? await tx.orm.public.TriviaSession
            .where({
              id: session.id,
              userId,
              ...sessionTarget,
            })
            .first()
        : null;

      if (session && !currentSession) {
        throw new Error("TRIVIA_SESSION_REQUIRED");
      }

      const quizQuestions =
        question.quizId !== null
          ? await tx.orm.public.TriviaQuestion
              .where({ quizId: question.quizId })
              .all()
          : [];

      // Capture acceptance time after all required
      // session and quiz availability reads.
      // Never trust a client-provided timestamp.
      const acceptedAt = Date.now();

      if (
        question.startsAt &&
        new Date(question.startsAt).getTime() > acceptedAt
      ) {
        throw new Error("QUESTION_NOT_STARTED");
      }

      if (
        question.endsAt &&
        new Date(question.endsAt).getTime() <= acceptedAt
      ) {
        throw new Error("QUESTION_DEADLINE_PASSED");
      }

      if (
        question.quizId !== null &&
        !isTriviaQuizFullyAvailable(
          quizQuestions,
          acceptedAt
        )
      ) {
        throw new Error("TRIVIA_ACTIVITY_CLOSED");
      }

      const sessionStatus = getTriviaSessionStatus(
        activity,
        currentSession ?? null,
        acceptedAt
      );

      if (sessionStatus === "NOT_STARTED") {
        throw new Error("TRIVIA_SESSION_REQUIRED");
      }

      if (sessionStatus === "EXPIRED") {
        throw new Error("TRIVIA_SESSION_EXPIRED");
      }

      if (sessionStatus === "COMPLETED") {
        throw new Error("TRIVIA_SESSION_COMPLETED");
      }

      if (sessionStatus === "CLOSED") {
        throw new Error("TRIVIA_ACTIVITY_CLOSED");
      }

      if (
        sessionStatus !== "ACTIVE" &&
        sessionStatus !== "UNTIMED"
      ) {
        throw new Error("TRIVIA_SESSION_REQUIRED");
      }

      const isCorrect =
        question.correctOption === selectedOption;

      const pointsAwarded = isCorrect
        ? question.pointsReward
        : 0;

      const balance =
        profile.currentPoints + pointsAwarded;

      const totalPoints =
        profile.totalPoints + pointsAwarded;

      const attempt = await tx.orm.public.TriviaAttempt.create({
        questionId,
        userId,
        selectedOption,
        isCorrect,
        pointsAwarded,
      });

      if (isCorrect && pointsAwarded > 0) {
        await tx.orm.public.PointTransaction.create({
          userId,
          type: "PARTICIPATION",
          points: pointsAwarded,
          description: `Correct Trivia answer: ${question.question}`,
          referenceId: String(attempt.id),
          referenceType: "TRIVIA_ATTEMPT",
          balanceAfter: balance,
        });
      }

      if (pointsAwarded > 0) {
        await tx.orm.public.FanProfile
          .where({ userId })
          .update({
            currentPoints: balance,
            totalPoints,
          });
      }

      let sessionCompleted = false;

      if (currentSession) {
        if (question.quizId === null) {
          // A standalone question is completed once answered,
          // whether the selected answer is correct or incorrect.
          sessionCompleted = true;
        } else {
          const quizQuestions =
            await tx.orm.public.TriviaQuestion
              .where({
                quizId: question.quizId,
              })
              .all();

          const userAttempts =
            await tx.orm.public.TriviaAttempt
              .where({ userId })
              .all();

          const attemptedIds = new Set(
            userAttempts.map(
              (item) => item.questionId
            )
          );

          sessionCompleted =
            quizQuestions.length > 0 &&
            quizQuestions.every(
              (item) => attemptedIds.has(item.id)
            );
        }

        if (sessionCompleted) {
          const completedSession =
            await tx.orm.public.TriviaSession
              .where({
                id: currentSession.id,
                userId,
                completedAt: null,
              })
              .update({
                completedAt:
                  new Date(acceptedAt).toISOString(),
              });

          if (!completedSession) {
            throw new Error(
              "TRIVIA_SESSION_CHANGED"
            );
          }
        }
      }

      const correctAnswers: Record<string, string> = {
        A: question.optionA,
        B: question.optionB,
        C: question.optionC,
        D: question.optionD,
      };

      return {
        isCorrect,
        selectedOption,
        correctOption: question.correctOption,
        correctAnswer:
          correctAnswers[question.correctOption] ?? "",
        explanation: question.explanation,
        pointsAwarded,
        balance,
        totalPoints,
        questionId: question.id,
        attemptId: attempt.id,
        sessionCompleted,
        sessionStatus: sessionCompleted
          ? "COMPLETED"
          : sessionStatus,
        sessionExpiresAt:
          currentSession?.expiresAt ?? null,
        serverNow: new Date().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      viewerUserId: userId ?? null,
      message: result.isCorrect
        ? `Correct answer! You earned ${result.pointsAwarded} points.`
        : "Not quite! No points were awarded.",
      ...result,
    }, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<
        string,
        { message: string; status: number }
      > = {
        USER_NOT_ACTIVE: {
          message: "Your account is not active.",
          status: 403,
        },
        PROFILE_NOT_FOUND: {
          message: "Fan profile not found.",
          status: 404,
        },
        QUESTION_NOT_AVAILABLE: {
          message: "This Trivia question is not available.",
          status: 404,
        },
        QUIZ_NOT_AVAILABLE: {
          message: "This Trivia quiz is not available.",
          status: 404,
        },
        QUIZ_NOT_STARTED: {
          message: "This Trivia quiz has not started yet.",
          status: 409,
        },
        QUIZ_DEADLINE_PASSED: {
          message: "This Trivia quiz has closed.",
          status: 409,
        },
        TRIVIA_SESSION_REQUIRED: {
          message: "Start this Trivia activity before submitting an answer.",
          status: 409,
        },
        TRIVIA_SESSION_EXPIRED: {
          message: "Time is up! Your Trivia countdown has expired.",
          status: 409,
        },
        TRIVIA_SESSION_COMPLETED: {
          message: "You have already completed this Trivia activity.",
          status: 409,
        },
        TRIVIA_ACTIVITY_CLOSED: {
          message: "This Trivia activity is now closed.",
          status: 409,
        },
        TRIVIA_SESSION_CHANGED: {
          message: "Your Trivia session changed. Refresh and try again.",
          status: 409,
        },
        ALREADY_ATTEMPTED: {
          message: "You have already answered this question.",
          status: 409,
        },
        QUESTION_NOT_STARTED: {
          message: "This Trivia question is not available yet.",
          status: 409,
        },
        QUESTION_DEADLINE_PASSED: {
          message: "The deadline has passed. This Trivia question is now closed.",
        status: 409,
        },
      };

      const knownError = errors[error.message];

      if (knownError) {
        return NextResponse.json(
          {
            error: knownError.message,
            code: error.message,
          },
          { status: knownError.status }
        );
      }
    }

    console.error("POST /api/trivia/answer error:", error);

    return NextResponse.json(
      { error: "Failed to submit your Trivia answer." },
      { status: 500 }
    );
  }
}