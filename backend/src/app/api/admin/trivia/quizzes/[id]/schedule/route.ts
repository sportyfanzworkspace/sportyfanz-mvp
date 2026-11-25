import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("trivia:manage");

    if (!auth.authorized) return auth.response;

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid quiz ID." },
        { status: 400 }
      );
    }

    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("INVALID_BODY");
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const expectedUpdatedAt = body.expectedUpdatedAt;

    if (
      typeof expectedUpdatedAt !== "string" ||
      !Number.isFinite(
        new Date(expectedUpdatedAt).getTime()
      )
    ) {
      return NextResponse.json(
        { error: "A valid quiz version is required." },
        { status: 400 }
      );
    }

    const startsAt = parseDate(body.startsAt);
    const endsAt = parseDate(body.endsAt);

    if (
      !startsAt ||
      !endsAt ||
      new Date(endsAt).getTime() <=
        new Date(startsAt).getTime() ||
      new Date(endsAt).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "Provide a valid start date and a later, future deadline.",
        },
        { status: 400 }
      );
    }

    const updated = await db.transaction(async (tx) => {
      const quiz = await tx.orm.public.TriviaQuiz
        .where({ id })
        .first();

      if (!quiz) {
        throw new Error("QUIZ_NOT_FOUND");
      }

      if (quiz.status !== "DRAFT") {
        throw new Error("QUIZ_NOT_DRAFT");
      }

      if (quiz.updatedAt !== expectedUpdatedAt) {
        throw new Error("QUIZ_CHANGED");
      }

      const questions = await tx.orm.public.TriviaQuestion
        .where({ quizId: id })
        .all();

      if (questions.length < 2 || questions.length > 50) {
        throw new Error("INVALID_QUESTION_COUNT");
      }

      if (
        questions.some(
          (question) => question.status !== "DRAFT"
        )
      ) {
        throw new Error("INVALID_QUESTION_STATUS");
      }

      // Use the same question-before-parent locking
      // order as publication and answer submission.
      const orderedQuestions = [...questions].sort(
        (a, b) => a.id - b.id
      );

      for (const question of orderedQuestions) {
        const updatedQuestion =
          await tx.orm.public.TriviaQuestion
            .where({
              id: question.id,
              quizId: id,
              status: "DRAFT",
              startsAt: question.startsAt,
              endsAt: question.endsAt,
              updatedAt: question.updatedAt,
            })
            .update({
              startsAt,
              endsAt,
            });

        if (!updatedQuestion) {
          throw new Error("QUIZ_CHANGED");
        }
      }

      const nextUpdatedAt = new Date(
        Math.max(
          Date.now(),
          new Date(quiz.updatedAt).getTime() + 1
        )
      ).toISOString();

      const updatedQuiz = await tx.orm.public.TriviaQuiz
        .where({
          id,
          status: "DRAFT",
          startsAt: quiz.startsAt,
          endsAt: quiz.endsAt,
          updatedAt: expectedUpdatedAt,
        })
        .update({
          startsAt,
          endsAt,
          updatedAt: nextUpdatedAt,
        });

      if (!updatedQuiz) {
        throw new Error("QUIZ_CHANGED");
      }

      if (new Date(endsAt).getTime() <= Date.now()) {
        throw new Error("INVALID_SCHEDULE");
      }

      return {
        quiz: updatedQuiz,
        questionCount: questions.length,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Trivia quiz schedule updated successfully.",
      ...updated,
    });

  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<
        string,
        { message: string; status: number }
      > = {
        QUIZ_NOT_FOUND: {
          message: "Trivia quiz not found.",
          status: 404,
        },
        QUIZ_NOT_DRAFT: {
          message: "Only draft quizzes can be rescheduled.",
          status: 409,
        },
        INVALID_QUESTION_COUNT: {
          message: "A quiz must contain 2 to 50 questions.",
          status: 409,
        },
        INVALID_QUESTION_STATUS: {
          message:
            "All associated questions must be in draft status.",
          status: 409,
        },
        INVALID_SCHEDULE: {
          message:
            "The quiz deadline must remain in the future.",
          status: 409,
        },
        QUIZ_CHANGED: {
          message:
            "The quiz has changed. Refresh and try again.",
          status: 409,
        },
      };

      const knownError = errors[error.message];

      if (knownError) {
        return NextResponse.json(
          { error: knownError.message },
          { status: knownError.status }
        );
      }
    }

    console.error("Admin quiz rescheduling failed:", error);

    return NextResponse.json(
      { error: "Unable to update the Trivia quiz schedule." },
      { status: 500 }
    );
  }
}
