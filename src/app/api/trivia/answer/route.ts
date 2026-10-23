import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

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

    let body: {
      questionId?: unknown;
      selectedOption?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const questionId = Number(body.questionId);
    const selectedOption = body.selectedOption;

    if (
      !Number.isSafeInteger(questionId) ||
      questionId <= 0 ||
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

      const profile = await tx.orm.public.FanProfile
        .where({ userId })
        .first();

      if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      const question = await tx.orm.public.TriviaQuestion
        .where({ id: questionId })
        .first();

        
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


      const existingAttempt = await tx.orm.public.TriviaAttempt
        .where({ questionId, userId })
        .first();

      if (existingAttempt) {
        throw new Error("ALREADY_ATTEMPTED");
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

      return {
        isCorrect,
        pointsAwarded,
        balance,
        totalPoints,
        questionId: question.id,
        attemptId: attempt.id,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.isCorrect
        ? `Correct answer! You earned ${result.pointsAwarded} points.`
        : "Not quite! No points were awarded.",
      ...result,
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
          { error: knownError.message },
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