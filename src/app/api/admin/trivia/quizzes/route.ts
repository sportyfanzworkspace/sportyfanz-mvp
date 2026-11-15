import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

type QuizStatus = "DRAFT" | "ACTIVE";

type QuizQuestionInput = {
  question?: unknown;
  optionA?: unknown;
  optionB?: unknown;
  optionC?: unknown;
  optionD?: unknown;
  correctOption?: unknown;
  pointsReward?: unknown;
  imageUrl?: unknown;
  explanation?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed.length > maxLength) return undefined;

  return trimmed || null;
}

function imageUrl(value: unknown): string | null | undefined {
  const result = optionalText(value, 2000);
  if (result == null) return result;

  try {
    const url = new URL(result);
    return url.protocol === "https:" ? result : undefined;
  } catch {
    return undefined;
  }
}

function scheduleDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? undefined
    : date.toISOString();
}

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

    const title = text(body.title);
    const description = optionalText(body.description, 2000);
    const coverImageUrl = imageUrl(body.coverImageUrl);
    const startsAt = scheduleDate(body.startsAt);
    const endsAt = scheduleDate(body.endsAt);
    const status = body.status ?? "DRAFT";

    if (title.length < 5 || title.length > 150) {
      return NextResponse.json(
        { error: "Quiz title must be 5–150 characters." },
        { status: 400 }
      );
    }

    if (description === undefined || coverImageUrl === undefined) {
      return NextResponse.json(
        { error: "Invalid description or cover image URL." },
        { status: 400 }
      );
    }

    if (status !== "DRAFT" && status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Select DRAFT or ACTIVE." },
        { status: 400 }
      );
    }

    if (
      !startsAt ||
      !endsAt ||
      new Date(endsAt).getTime() <=
        new Date(startsAt).getTime()
    ) {
      return NextResponse.json(
        { error: "Provide a valid start date and later deadline." },
        { status: 400 }
      );
    }

    if (
      status === "ACTIVE" &&
      new Date(endsAt).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "An active quiz needs a future deadline." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.questions) ||
      body.questions.length < 2 ||
      body.questions.length > 50
    ) {
      return NextResponse.json(
        { error: "A quiz must contain 2–50 questions." },
        { status: 400 }
      );
    }

    const questions: {
      question: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: string;
      pointsReward: number;
      imageUrl: string | null;
      explanation: string | null;
    }[] = [];

    for (const [index, raw] of body.questions.entries()) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json(
          { error: `Question ${index + 1} is invalid.` },
          { status: 400 }
        );
      }

      const item = raw as QuizQuestionInput;

      const question = text(item.question);
      const optionA = text(item.optionA);
      const optionB = text(item.optionB);
      const optionC = text(item.optionC);
      const optionD = text(item.optionD);
      const correctOption = text(item.correctOption).toUpperCase();
      const pointsReward = Number(item.pointsReward);
      const questionImage = imageUrl(item.imageUrl);
      const explanation = optionalText(item.explanation, 2000);

      if (question.length < 5 || question.length > 1000) {
        return NextResponse.json(
          { error: `Question ${index + 1} must be 5–1000 characters.` },
          { status: 400 }
        );
      }

      if (
        [optionA, optionB, optionC, optionD].some(
          (option) => !option || option.length > 300
        )
      ) {
        return NextResponse.json(
          { error: `Question ${index + 1} needs four valid options.` },
          { status: 400 }
        );
      }

      if (!["A", "B", "C", "D"].includes(correctOption)) {
        return NextResponse.json(
          { error: `Question ${index + 1} needs a correct answer.` },
          { status: 400 }
        );
      }

      if (
        !Number.isSafeInteger(pointsReward) ||
        pointsReward < 0 ||
        pointsReward > 100000
      ) {
        return NextResponse.json(
          { error: `Question ${index + 1} has invalid points.` },
          { status: 400 }
        );
      }

      if (
        questionImage === undefined ||
        explanation === undefined
      ) {
        return NextResponse.json(
          { error: `Question ${index + 1} has invalid image or explanation.` },
          { status: 400 }
        );
      }

      questions.push({
        question,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        pointsReward,
        imageUrl: questionImage,
        explanation,
      });
    }

    const created = await db.transaction(async (tx) => {
      const quiz = await tx.orm.public.TriviaQuiz.create({
        title,
        description,
        coverImageUrl,
        status: status as QuizStatus,
        startsAt,
        endsAt,
      });

      for (const [index, item] of questions.entries()) {
        await tx.orm.public.TriviaQuestion.create({
          ...item,
          quizId: quiz.id,
          questionOrder: index + 1,
          status: status as QuizStatus,
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
