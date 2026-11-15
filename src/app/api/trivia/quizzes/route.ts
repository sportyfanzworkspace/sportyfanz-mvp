import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const now = Date.now();

    const activeQuizzes = await db.orm.public.TriviaQuiz
      .where({ status: "ACTIVE" })
      .all();

    const availableQuizzes = activeQuizzes.filter((quiz) => {
      const hasStarted =
        !quiz.startsAt ||
        new Date(quiz.startsAt).getTime() <= now;

      const hasNotEnded =
        !quiz.endsAt ||
        new Date(quiz.endsAt).getTime() > now;

      return hasStarted && hasNotEnded;
    });

    const quizIds = new Set(
      availableQuizzes.map((quiz) => quiz.id)
    );

    const questions = quizIds.size
      ? await db.orm.public.TriviaQuestion
          .where({ status: "ACTIVE" })
          .all()
      : [];

    const availableQuestions = questions.filter((question) => {
      if (
        question.quizId === null ||
        !quizIds.has(question.quizId)
      ) {
        return false;
      }

      const hasStarted =
        !question.startsAt ||
        new Date(question.startsAt).getTime() <= now;

      const hasNotEnded =
        !question.endsAt ||
        new Date(question.endsAt).getTime() > now;

      return hasStarted && hasNotEnded;
    });

    const attempts = userId
      ? await db.orm.public.TriviaAttempt
          .where({ userId })
          .all()
      : [];

    const attemptedQuestionIds = new Set(
      attempts.map((attempt) => attempt.questionId)
    );

    const items = availableQuizzes
      .map((quiz) => {
        const quizQuestions = availableQuestions.filter(
          (question) => question.quizId === quiz.id
        );

        const completedQuestions = quizQuestions.filter(
          (question) => attemptedQuestionIds.has(question.id)
        );

        const earnedPoints = attempts
          .filter((attempt) =>
            quizQuestions.some(
              (question) => question.id === attempt.questionId
            )
          )
          .reduce(
            (sum, attempt) => sum + attempt.pointsAwarded,
            0
          );

        return {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          coverImageUrl: quiz.coverImageUrl,
          startsAt: quiz.startsAt,
          endsAt: quiz.endsAt,
          questionCount: quizQuestions.length,
          maxPoints: quizQuestions.reduce(
            (sum, question) => sum + question.pointsReward,
            0
          ),
          completedCount: userId
            ? completedQuestions.length
            : null,
          earnedPoints: userId ? earnedPoints : null,
          isCompleted: userId
            ? quizQuestions.length > 0 &&
              completedQuestions.length === quizQuestions.length
            : null,
        };
      })
      .filter((quiz) => quiz.questionCount > 0)
      .sort(
        (a, b) =>
          new Date(a.endsAt ?? 0).getTime() -
          new Date(b.endsAt ?? 0).getTime()
      );

    return NextResponse.json({
      success: true,
      quizzes: items,
    });
  } catch (error) {
    console.error("GET /api/trivia/quizzes error:", error);

    return NextResponse.json(
      { error: "Unable to load Trivia quizzes." },
      { status: 500 }
    );
  }
}
