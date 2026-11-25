import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import { validateQuizInput } from "@/lib/trivia/quiz-validation";

export async function GET() {
  try {
    const auth = await requirePermission("trivia:manage");
    if (!auth.authorized) return auth.response;

    const [quizzes, questions, attempts] = await Promise.all([
      db.orm.public.TriviaQuiz.all(),
      db.orm.public.TriviaQuestion.all(),
      db.orm.public.TriviaAttempt.all(),
    ]);

    const now = Date.now();

    const items = quizzes
      .map((quiz) => {
        const quizQuestions = questions
          .filter((question) => question.quizId === quiz.id)
          .sort(
            (a, b) => a.questionOrder - b.questionOrder
          );

        const questionIds = new Set(
          quizQuestions.map((question) => question.id)
        );

        const quizAttempts = attempts.filter(
          (attempt) => questionIds.has(attempt.questionId)
        );

        const startsAt = quiz.startsAt
          ? new Date(quiz.startsAt).getTime()
          : null;

        const endsAt = quiz.endsAt
          ? new Date(quiz.endsAt).getTime()
          : null;

        let scheduleStatus: string = quiz.status;

        if (
          quiz.status === "ACTIVE" &&
          startsAt !== null &&
          startsAt > now
        ) {
          scheduleStatus = "SCHEDULED";
        } else if (
          quiz.status === "ACTIVE" &&
          endsAt !== null &&
          endsAt <= now
        ) {
          scheduleStatus = "CLOSED";
        }

        return {
          ...quiz,
          scheduleStatus,
          questionCount: quizQuestions.length,
          attemptCount: quizAttempts.length,
          correctCount: quizAttempts.filter(
            (attempt) => attempt.isCorrect
          ).length,
          questions: quizQuestions.map((question) => ({
            ...question,
            attemptCount: quizAttempts.filter(
              (attempt) =>
                attempt.questionId === question.id
            ).length,
          })),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

    return NextResponse.json({
      success: true,
      quizzes: items,
      summary: {
        totalQuizzes: items.length,
        activeQuizzes: items.filter(
          (quiz) => quiz.status === "ACTIVE" &&
            quiz.scheduleStatus !== "CLOSED"
        ).length,
        draftQuizzes: items.filter(
          (quiz) => quiz.status === "DRAFT"
        ).length,
        totalQuestions: items.reduce(
          (sum, quiz) => sum + quiz.questionCount,
          0
        ),
      },
    });
  } catch (error) {
    console.error("Admin quiz listing failed:", error);

    return NextResponse.json(
      { error: "Unable to load Trivia quizzes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("trivia:manage");
    if (!auth.authorized) return auth.response;

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

    const validation = validateQuizInput(body);

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
      status,
      questions,
    } = validation.data;

    const created = await db.transaction(async (tx) => {
      const quiz = await tx.orm.public.TriviaQuiz.create({
        title,
        description,
        coverImageUrl,
        status,
        startsAt,
        endsAt,
        durationSeconds,
      });

      for (const [index, item] of questions.entries()) {
        await tx.orm.public.TriviaQuestion.create({
          ...item,
          quizId: quiz.id,
          questionOrder: index + 1,
          status,
          startsAt,
          endsAt,
        });
      }

      return quiz;
    });

    return NextResponse.json(
      {
        success: true,
        quiz: created,
        questionCount: questions.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin quiz creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create the Trivia quiz." },
      { status: 500 }
    );
  }
}
