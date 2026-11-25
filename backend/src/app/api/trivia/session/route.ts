import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
  isTriviaQuizFullyAvailable,
} from "@/lib/trivia/quiz-availability";
import { getCurrentUserId } from "@/lib/auth";
import { lockFanProfile } from "@/lib/accounting/lock-fan-profile";
import {
  calculateTriviaSessionWindow,
  isTriviaActivityAvailable,
  getTriviaSessionStatus,
  getTriviaRemainingSeconds,
} from "@/lib/trivia/session-timing";

type Target = {
  kind: "QUESTION" | "QUIZ";
  id: number;
};

function parseTarget(
  body: unknown
): Target | null {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return null;
  }

  const value = body as Record<string, unknown>;

  const hasQuestion = value.questionId !== undefined;
  const hasQuiz = value.quizId !== undefined;

  if (hasQuestion === hasQuiz) return null;

  const id = hasQuestion
    ? value.questionId
    : value.quizId;

  if (
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    return null;
  }

  return {
    kind: hasQuestion ? "QUESTION" : "QUIZ",
    id,
  };
}

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

async function handleSession(
  request: Request,
  start: boolean
) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return json({
        error: "Please log in to participate in Trivia.",
      }, 401);
    }

    const expectedViewer =
      request.headers.get("X-Trivia-Viewer");

    if (
      expectedViewer !== null &&
      expectedViewer !== String(userId)
    ) {
      return json({
        error: "Your signed-in account has changed.",
        code: "TRIVIA_IDENTITY_CHANGED",
      }, 409);
    }

    let input: unknown;

    if (start) {
      try {
        input = await request.json();
      } catch {
        return json({
          error: "Invalid request body.",
        }, 400);
      }
    } else {
      const params = new URL(request.url).searchParams;

      const questionIds = params.getAll("questionId");
      const quizIds = params.getAll("quizId");

      if (questionIds.length + quizIds.length !== 1) {
        return json({
          error: "Provide exactly one Trivia target.",
        }, 400);
      }

      const raw = questionIds[0] ?? quizIds[0];

      if (!/^\d+$/.test(raw)) {
        return json({
          error: "Invalid Trivia target ID.",
        }, 400);
      }

      input = questionIds.length
        ? { questionId: Number(raw) }
        : { quizId: Number(raw) };
    }

    const target = parseTarget(input);

    if (!target) {
      return json({
        error: "Provide a valid questionId or quizId.",
      }, 400);
    }

    const result = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User
        .where({ id: userId })
        .first();

      if (!user || user.status !== "ACTIVE") {
        throw new Error("USER_NOT_ACTIVE");
      }

      // Match the answer endpoint's accounting lock order.
      const profile = await lockFanProfile(tx, userId);

      if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      // Lock the activity before checking its current status.
      // Quiz starts never lock child questions after the parent.
      const plan = target.kind === "QUESTION"
        ? db.raw.sql`
            SELECT "id"
            FROM "public"."trivia_questions"
            WHERE "id" = ${target.id}
            FOR UPDATE
          `.returnsRow({
            id: "pg/int4@1",
          }).build()
        : db.raw.sql`
            SELECT "id"
            FROM "public"."trivia_quizzes"
            WHERE "id" = ${target.id}
            FOR UPDATE
          `.returnsRow({
            id: "pg/int4@1",
          }).build();

      let found = false;

      for await (const row of tx.query(plan)) {
        if (row.id === target.id) {
          found = true;
        }
      }

      if (!found) {
        throw new Error("TRIVIA_NOT_FOUND");
      }

      const activity = target.kind === "QUESTION"
        ? await tx.orm.public.TriviaQuestion
            .where({
              id: target.id,
              quizId: null,
            })
            .first()
        : await tx.orm.public.TriviaQuiz
            .where({ id: target.id })
            .first();

      if (!activity) {
        throw new Error("TRIVIA_NOT_FOUND");
      }

      const quizQuestions = target.kind === "QUIZ"
        ? await tx.orm.public.TriviaQuestion
            .where({ quizId: target.id })
            .all()
        : [];

      const questionIds = target.kind === "QUESTION"
        ? [target.id]
        : quizQuestions.map((question) => question.id);

      if (questionIds.length === 0) {
        throw new Error("TRIVIA_NOT_AVAILABLE");
      }

      const attempts = await tx.orm.public.TriviaAttempt
        .where({ userId })
        .all();

      const attemptedIds = new Set(
        attempts.map((attempt) => attempt.questionId)
      );

      const alreadyCompleted = questionIds.every(
        (id) => attemptedIds.has(id)
      );

      const sessionTarget = target.kind === "QUESTION"
        ? {
            questionId: target.id,
            quizId: null,
          }
        : {
            questionId: null,
            quizId: target.id,
          };

      let session = await tx.orm.public.TriviaSession
        .where({
          userId,
          ...sessionTarget,
        })
        .first();

      const now = Date.now();

      if (
        target.kind === "QUIZ" &&
        isTriviaActivityAvailable(activity, now) &&
        !isTriviaQuizFullyAvailable(
          quizQuestions,
          now
        )
      ) {
        throw new Error("TRIVIA_NOT_AVAILABLE");
      }

      const initialStatus = getTriviaSessionStatus(
        activity,
        session ?? null,
        now,
        alreadyCompleted
      );

      // Never replace, extend or restart an existing session.
      if (
        start &&
        !session &&
        initialStatus === "NOT_STARTED"
      ) {
        const timing = calculateTriviaSessionWindow(
          activity,
          target.kind,
          now
        );

        session = await tx.orm.public.TriviaSession
          .create({
            userId,
            ...sessionTarget,
            ...timing,
          });
      }

      const responseTime = Date.now();

      const status = getTriviaSessionStatus(
        activity,
        session ?? null,
        responseTime,
        alreadyCompleted
      );

      return {
        status,
        durationSeconds: activity.durationSeconds,
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
        serverNow: new Date(responseTime).toISOString(),
        remainingSeconds: status === "ACTIVE"
          ? getTriviaRemainingSeconds(
              activity,
              session ?? null,
              responseTime
            )
          : 0,
      };
    });

    return json({
      success: true,
      viewerUserId: userId ?? null,
      ...result,
    });

  } catch (error) {
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
      TRIVIA_NOT_FOUND: {
        message: "Trivia activity not found.",
        status: 404,
      },
      TRIVIA_NOT_AVAILABLE: {
        message: "This Trivia activity is not available.",
        status: 409,
      },
      INVALID_TRIVIA_DURATION: {
        message: "This Trivia activity has an invalid time limit.",
        status: 409,
      },
    };

    const known = error instanceof Error
      ? errors[error.message]
      : undefined;

    if (known) {
      return json({
        error: known.message,
      }, known.status);
    }

    console.error("Trivia session error:", error);

    return json({
      error: "Unable to process Trivia session.",
    }, 500);
  }
}

export async function GET(request: Request) {
  return handleSession(request, false);
}

export async function POST(request: Request) {
  return handleSession(request, true);
}
