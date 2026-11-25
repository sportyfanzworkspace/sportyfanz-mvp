import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import { validateQuizInput } from "@/lib/trivia/quiz-validation";

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

    if (
      body.status !== undefined &&
      body.status !== "DRAFT"
    ) {
      return NextResponse.json(
        { error: "Use Publish Quiz to activate a draft." },
        { status: 400 }
      );
    }

    const validation = validateQuizInput({
      ...body,
      status: "DRAFT",
    });

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      coverImageUrl,
      startsAt,
      endsAt,
      durationSeconds,
      questions,
    } = validation.data;

    const submittedIds: (number | null)[] = [];
    const retainedIds = new Set<number>();

    for (const raw of body.questions as Record<string, unknown>[]) {
      const questionId = raw.id;

      if (questionId == null) {
        submittedIds.push(null);
        continue;
      }

      if (
        typeof questionId !== "number" ||
        !Number.isSafeInteger(questionId) ||
        questionId <= 0 ||
        retainedIds.has(questionId)
      ) {
        return NextResponse.json(
          { error: "Invalid or duplicate question ID." },
          { status: 400 }
        );
      }

      retainedIds.add(questionId);
      submittedIds.push(questionId);
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

      const existingQuestions =
        await tx.orm.public.TriviaQuestion
          .where({ quizId: id })
          .all();

      if (
        existingQuestions.some(
          (question) => question.status !== "DRAFT"
        )
      ) {
        throw new Error("INVALID_QUESTION_STATUS");
      }

      const existingIds = new Set(
        existingQuestions.map((question) => question.id)
      );

      for (const questionId of retainedIds) {
        if (!existingIds.has(questionId)) {
          throw new Error("INVALID_QUESTION_ID");
        }
      }

      // Lock existing questions in deterministic ID order.
      // Preserve the question-before-parent locking strategy.
      const orderedQuestions = [...existingQuestions].sort(
        (a, b) => a.id - b.id
      );

      for (const question of orderedQuestions) {
        const lockedQuestion =
          await tx.orm.public.TriviaQuestion
            .where({
              id: question.id,
              quizId: id,
              status: "DRAFT",
              updatedAt: question.updatedAt,
            })
            .update({
              status: "DRAFT",
            });

        if (!lockedQuestion) {
          throw new Error("QUIZ_CHANGED");
        }
      }

      // Advance the quiz version explicitly.
      const nextUpdatedAt = new Date(
        Math.max(
          Date.now(),
          new Date(quiz.updatedAt).getTime() + 1
        )
      ).toISOString();

      const updatedQuiz =
        await tx.orm.public.TriviaQuiz
          .where({
            id,
            status: "DRAFT",
            updatedAt: expectedUpdatedAt,
          })
          .update({
            title,
            description,
            coverImageUrl,
            startsAt,
            endsAt,
            durationSeconds,
            updatedAt: nextUpdatedAt,
          });

      if (!updatedQuiz) {
        throw new Error("QUIZ_CHANGED");
      }

      // Reject changes if the associated question set
      // changed while acquiring locks.
      const currentQuestions =
        await tx.orm.public.TriviaQuestion
          .where({ quizId: id })
          .all();

      if (
        currentQuestions.length !== existingQuestions.length ||
        currentQuestions.some(
          (question) =>
            !existingIds.has(question.id) ||
            question.status !== "DRAFT"
        )
      ) {
        throw new Error("QUIZ_CHANGED");
      }

      // Protect all existing participation history.
      for (const question of currentQuestions) {
        const attempt = await tx.orm.public.TriviaAttempt
          .where({ questionId: question.id })
          .first();

        if (attempt) {
          throw new Error("QUIZ_HAS_ATTEMPTS");
        }
      }

      // Remove only questions omitted from the edited draft.
      for (const question of orderedQuestions) {
        if (!retainedIds.has(question.id)) {
          await tx.orm.public.TriviaQuestion
            .where({
              id: question.id,
              quizId: id,
              status: "DRAFT",
            })
            .delete();

          const remaining =
            await tx.orm.public.TriviaQuestion
              .where({ id: question.id })
              .first();

          if (remaining) {
            throw new Error("QUIZ_CHANGED");
          }
        }
      }

      // Update retained questions and create new questions.
      for (const [index, item] of questions.entries()) {
        const questionId = submittedIds[index];

        const questionData = {
          ...item,
          questionOrder: index + 1,
          startsAt,
          endsAt,
          status: "DRAFT" as const,
        };

        if (questionId !== null) {
          const updatedQuestion =
            await tx.orm.public.TriviaQuestion
              .where({
                id: questionId,
                quizId: id,
                status: "DRAFT",
              })
              .update(questionData);

          if (!updatedQuestion) {
            throw new Error("QUIZ_CHANGED");
          }
        } else {
          await tx.orm.public.TriviaQuestion.create({
            ...questionData,
            quizId: id,
          });
        }
      }

      const savedQuestions =
        await tx.orm.public.TriviaQuestion
          .where({ quizId: id })
          .all();

      if (
        savedQuestions.length !== questions.length ||
        savedQuestions.some(
          (question) => question.status !== "DRAFT"
        )
      ) {
        throw new Error("QUIZ_CHANGED");
      }

      return {
        quiz: updatedQuiz,
        questionCount: savedQuestions.length,
        questions: savedQuestions.sort(
          (a, b) => a.questionOrder - b.questionOrder
        ),
      };
    });

    return NextResponse.json({
      success: true,
      message: "Trivia quiz updated successfully.",
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
          message: "Only draft quizzes can be edited.",
          status: 409,
        },
        INVALID_QUESTION_STATUS: {
          message: "All associated questions must be drafts.",
          status: 409,
        },
        INVALID_QUESTION_ID: {
          message: "A question does not belong to this quiz.",
          status: 400,
        },
        QUIZ_HAS_ATTEMPTS: {
          message:
            "This quiz contains participation history and cannot be edited.",
          status: 409,
        },
        QUIZ_CHANGED: {
          message:
            "The quiz has changed. Refresh before editing again.",
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

    console.error("Admin quiz editing failed:", error);

    return NextResponse.json(
      { error: "Unable to update the Trivia quiz." },
      { status: 500 }
    );
  }
}
