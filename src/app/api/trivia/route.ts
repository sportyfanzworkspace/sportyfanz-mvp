import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to play Trivia." },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User
      .where({ id: userId })
      .first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      );
    }

    const profile = await db.orm.public.FanProfile
      .where({ userId })
      .first();

    if (!profile) {
      return NextResponse.json(
        { error: "Fan profile not found." },
        { status: 404 }
      );
    }

    const now = Date.now();

    const activeQuestions = await db.orm.public.TriviaQuestion
      .where({ status: "ACTIVE" })
      .all();

    // Close expired questions when the fan Trivia API is requested.
    for (const question of activeQuestions) {
      if (
        question.endsAt &&
        new Date(question.endsAt).getTime() <= now
      ) {
        await db.orm.public.TriviaQuestion
          .where({ id: question.id })
          .update({ status: "CLOSED" });
      }
    }

     // Only questions that have started and have not expired are available.
      const availableQuestions = activeQuestions
        .filter((question) => {
        const now = Date.now();

        const hasStarted =
          !question.startsAt ||
          new Date(question.startsAt).getTime() <= now;

        const deadlineNotPassed =
          !question.endsAt ||
          new Date(question.endsAt).getTime() > now;

        return (
          question.status === "ACTIVE" &&
          hasStarted &&
          deadlineNotPassed
        );
     })
     .sort(
       (a, b) =>
       new Date(b.createdAt).getTime() -
       new Date(a.createdAt).getTime()
     );
    const attempts = await db.orm.public.TriviaAttempt
      .where({ userId })
      .all();

    const attemptedQuestionIds = new Set(
      attempts.map((attempt) => attempt.questionId)
    );

    const unansweredQuestions = availableQuestions
      .filter((question) => !attemptedQuestionIds.has(question.id))
      .sort(
        (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );

    return NextResponse.json({
      success: true,
      balance: profile.currentPoints,
      totalPoints: profile.totalPoints,
      roundSize: unansweredQuestions.length,
      questions: unansweredQuestions.map((question) => ({
        id: question.id,
        question: question.question,
        options: [
          { value: "A", label: question.optionA },
          { value: "B", label: question.optionB },
          { value: "C", label: question.optionC },
          { value: "D", label: question.optionD },
        ],
        pointsReward: question.pointsReward,
        attempted: false,
      })),
      attemptedCount: attempts.length,
    });
  } catch (error) {
    console.error("GET /api/trivia error:", error);

    return NextResponse.json(
      { error: "Failed to load Trivia questions." },
      { status: 500 }
    );
  }
}