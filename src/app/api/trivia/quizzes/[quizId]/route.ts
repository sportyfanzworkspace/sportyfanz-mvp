import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ quizId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { quizId: rawQuizId } = await context.params;
    const quizId = Number(rawQuizId);

    if (
      !Number.isSafeInteger(quizId) ||
      quizId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid quiz ID." },
        { status: 400 }
      );
    }

    const quiz = await db.orm.public.TriviaQuiz
      .where({ id: quizId })
      .first();

    const now = Date.now();

    if (
      !quiz ||
      quiz.status !== "ACTIVE" ||
      (quiz.startsAt &&
        new Date(quiz.startsAt).getTime() > now) ||
      (quiz.endsAt &&
        new Date(quiz.endsAt).getTime() <= now)
    ) {
      return NextResponse.json(
        { error: "This Trivia quiz is not currently available." },
        { status: 404 }
      );
    }

    const userId = await getCurrentUserId();

    const questions = await db.orm.public.TriviaQuestion
      .where({ quizId, status: "ACTIVE" })
      .all();

    const availableQuestions = questions
      .filter((question) => {
        const started =
          !question.startsAt ||
          new Date(question.startsAt).getTime() <= now;

        const notExpired =
          !question.endsAt ||
          new Date(question.endsAt).getTime() > now;

        return started && notExpired;
      })
      .sort(
        (a, b) =>
          a.questionOrder - b.questionOrder ||
          a.id - b.id
      );

    const attempts = userId
      ? await db.orm.public.TriviaAttempt
          .where({ userId })
          .all()
      : [];

    const quizQuestionIds = new Set(
      availableQuestions.map((question) => question.id)
    );

    const quizAttempts = attempts.filter(
      (attempt) => quizQuestionIds.has(attempt.questionId)
    );

    const attemptsByQuestion = new Map(
      quizAttempts.map((attempt) => [
        attempt.questionId,
        attempt,
      ])
    );

    const completedCount = quizAttempts.length;

    const earnedPoints = quizAttempts.reduce(
      (sum, attempt) => sum + attempt.pointsAwarded,
      0
    );

    return NextResponse.json({
      success: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        coverImageUrl: quiz.coverImageUrl,
        startsAt: quiz.startsAt,
        endsAt: quiz.endsAt,
        questionCount: availableQuestions.length,
        maxPoints: availableQuestions.reduce(
          (sum, question) => sum + question.pointsReward,
          0
        ),
      },
      progress: userId
        ? {
            completedCount,
            earnedPoints,
            isCompleted:
              availableQuestions.length > 0 &&
              completedCount === availableQuestions.length,
          }
        : null,
      questions: availableQuestions.map((question) => {
        const attempt = attemptsByQuestion.get(question.id);

        return {
          id: question.id,
          questionOrder: question.questionOrder,
          question: question.question,
          imageUrl: question.imageUrl,
          pointsReward: question.pointsReward,
          options: [
            { value: "A", label: question.optionA },
            { value: "B", label: question.optionB },
            { value: "C", label: question.optionC },
            { value: "D", label: question.optionD },
          ],
          attempted: Boolean(attempt),
          earnedPoints: attempt
            ? attempt.pointsAwarded
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("GET Trivia quiz details failed:", error);

    return NextResponse.json(
      { error: "Unable to load this Trivia quiz." },
      { status: 500 }
    );
  }
}
