import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
  isTriviaQuizFullyAvailable,
} from "@/lib/trivia/quiz-availability";
import { getCurrentUserId } from "@/lib/auth";
import { buildTriviaSessionResponse } from "@/lib/trivia/session-response";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (userId) {
      const user = await db.orm.public.User
        .where({ id: userId })
        .first();

      if (!user || user.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Your account is not active." },
          { status: 403 }
        );
      }
    }

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
          .all()
      : [];

    const availableQuestions = questions.filter(
      (question) =>
        question.quizId !== null &&
        quizIds.has(question.quizId)
    );

    const attempts = userId
      ? await db.orm.public.TriviaAttempt
          .where({ userId })
          .all()
      : [];

    const sessions = userId
      ? await db.orm.public.TriviaSession
          .where({ userId, questionId: null })
          .all()
      : [];

    const sessionsByQuiz = new Map(
      sessions.map((session) => [
        session.quizId,
        session,
      ])
    );

    const responseTime = Date.now();

    const attemptedQuestionIds = new Set(
      attempts.map((attempt) => attempt.questionId)
    );

    const items = availableQuizzes
      .filter((quiz) =>
        isTriviaQuizFullyAvailable(
          availableQuestions.filter(
            (question) => question.quizId === quiz.id
          ),
          responseTime
        )
      )
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
          ...buildTriviaSessionResponse(
            quiz,
            sessionsByQuiz.get(quiz.id) ?? null,
            responseTime,
            Boolean(userId),
            quizQuestions.length > 0 &&
              completedQuestions.length === quizQuestions.length
          ),
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
      viewerUserId: userId ?? null,
      serverNow: new Date(responseTime).toISOString(),
      quizzes: items,
    }, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/trivia/quizzes error:", error);

    return NextResponse.json(
      { error: "Unable to load Trivia quizzes." },
      { status: 500 }
    );
  }
}
