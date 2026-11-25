import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import { validateTriviaDuration } from "@/lib/trivia/duration-validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    const published = await db.transaction(async (tx) => {
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

      const durationValidation = validateTriviaDuration(
        quiz.durationSeconds,
        "QUIZ"
      );

      if (durationValidation.ok === false) {
        throw new Error("INVALID_QUIZ_DURATION");
      }

      const durationSeconds =
        durationValidation.durationSeconds;

      const startsAt = quiz.startsAt;
      const endsAt = quiz.endsAt;

      if (!startsAt || !endsAt) {
        throw new Error("INVALID_SCHEDULE");
      }

      const startTime = new Date(startsAt).getTime();
      const endTime = new Date(endsAt).getTime();

      if (
        !Number.isFinite(startTime) ||
        !Number.isFinite(endTime) ||
        endTime <= startTime ||
        endTime <= Date.now()
      ) {
        throw new Error("INVALID_SCHEDULE");
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

      if (
        questions.some(
          (question) => question.durationSeconds !== null
        )
      ) {
        throw new Error("INVALID_QUESTION_DURATION");
      }

      const orders = new Set(
        questions.map((question) => question.questionOrder)
      );

      if (
        orders.size !== questions.length ||
        questions.some(
          (question) =>
            !Number.isSafeInteger(question.questionOrder) ||
            question.questionOrder < 1 ||
            question.questionOrder > questions.length
        )
      ) {
        throw new Error("INVALID_QUESTION_ORDER");
      }

      for (const question of questions) {
        if (
          question.question.trim().length < 5 ||
          question.question.trim().length > 1000 ||
          [
            question.optionA,
            question.optionB,
            question.optionC,
            question.optionD,
          ].some(
            (option) =>
              !option.trim() || option.trim().length > 300
          ) ||
          !["A", "B", "C", "D"].includes(
            question.correctOption
          ) ||
          !Number.isSafeInteger(question.pointsReward) ||
          question.pointsReward < 0 ||
          question.pointsReward > 100000
        ) {
          throw new Error("INVALID_QUESTION_CONTENT");
        }
      }

      // Maintain deterministic question locking order.
      // Answer submission also locks the question before
      // acquiring the parent quiz lock.
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
              durationSeconds: null,
              updatedAt: question.updatedAt,
            })
            .update({
              status: "ACTIVE",
              startsAt,
              endsAt,
            });

        if (!updatedQuestion) {
          throw new Error("QUIZ_CHANGED");
        }
      }

      // Activate the parent only after all questions
      // have been successfully updated.
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
          startsAt,
          endsAt,
          durationSeconds,
          updatedAt: expectedUpdatedAt,
        })
        .update({
          status: "ACTIVE",
          updatedAt: nextUpdatedAt,
        });

      if (!updatedQuiz) {
        throw new Error("QUIZ_CHANGED");
      }

      // Recheck the deadline after acquiring row locks.
      if (endTime <= Date.now()) {
        throw new Error("INVALID_SCHEDULE");
      }

      return {
        quiz: updatedQuiz,
        questionCount: questions.length,
        scheduleStatus:
          startTime > Date.now()
            ? "SCHEDULED"
            : "ACTIVE",
      };
    });

    return NextResponse.json({
      success: true,
      message:
        published.scheduleStatus === "SCHEDULED"
          ? "Trivia quiz published and scheduled successfully."
          : "Trivia quiz published successfully.",
      ...published,
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
          message: "Only draft quizzes can be published.",
          status: 409,
        },
        INVALID_QUIZ_DURATION: {
          message:
            "Edit the quiz and configure a valid total countdown between 30 and 3600 seconds before publishing.",
          status: 409,
        },
        INVALID_QUESTION_DURATION: {
          message:
            "Individual quiz questions cannot have separate countdown timers.",
          status: 409,
        },
        INVALID_SCHEDULE: {
          message:
            "The quiz requires a valid schedule with a future deadline.",
          status: 409,
        },
        INVALID_QUESTION_COUNT: {
          message: "A quiz must contain 2 to 50 questions.",
          status: 409,
        },
        INVALID_QUESTION_STATUS: {
          message:
            "All questions must be in draft status before publication.",
          status: 409,
        },
        INVALID_QUESTION_ORDER: {
          message: "The quiz question order is invalid.",
          status: 409,
        },
        INVALID_QUESTION_CONTENT: {
          message:
            "One or more questions contain invalid content or Fan Points.",
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

    console.error("Admin quiz publication failed:", error);

    return NextResponse.json(
      { error: "Unable to publish the Trivia quiz." },
      { status: 500 }
    );
  }
}
