
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

const STATUSES = ["DRAFT", "ACTIVE", "CLOSED"] as const;
const OPTIONS = ["A", "B", "C", "D"] as const;

function parseScheduleDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString();
}



export async function GET() {
  try {
    const auth = await requirePermission("trivia:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const now = Date.now();

    // 1. Find active questions and close those past their deadline.
    const activeQuestions = await db.orm.public.TriviaQuestion
      .where({ status: "ACTIVE" })
      .all();

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

    // 2. Reload all questions so the admin sees every status.
    const questions = await db.orm.public.TriviaQuestion
      .all();

    // 3. Load attempts for all questions.
    const attempts = await db.orm.public.TriviaAttempt.all();

    // 4. Build the admin response with schedule status and statistics.
    const items = questions.map((question) => {
      const questionAttempts = attempts.filter(
        (attempt) => attempt.questionId === question.id
      );
       
      const startsAt = question.startsAt
        ? new Date(question.startsAt).getTime()
        : null;

      const endsAt = question.endsAt
        ? new Date(question.endsAt).getTime()
        : null;

      let scheduleStatus: string = question.status;

      if (
        question.status === "ACTIVE" &&
        startsAt !== null &&
        startsAt > now
      ) {
        scheduleStatus = "SCHEDULED";
      } else if (
        question.status === "ACTIVE" &&
        endsAt !== null &&
        endsAt <= now
      ) {
        scheduleStatus = "CLOSED";
      }

      return {
        ...question,
        startsAt: question.startsAt,
        endsAt: question.endsAt,
        scheduleStatus,
        attemptCount: questionAttempts.length,
        correctCount: questionAttempts.filter(
          (attempt) => attempt.isCorrect
        ).length,
      };
    });

    return NextResponse.json({
      success: true,
      questions: items,
    });
  } catch (error) {
    console.error("Admin trivia list failed:", error);

    return NextResponse.json(
      { error: "Unable to load Trivia Management data." },
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
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    const optionA =
      typeof body.optionA === "string" ? body.optionA.trim() : "";
    const optionB =
      typeof body.optionB === "string" ? body.optionB.trim() : "";
    const optionC =
      typeof body.optionC === "string" ? body.optionC.trim() : "";
    const optionD =
      typeof body.optionD === "string" ? body.optionD.trim() : "";

    const correctOption =
      typeof body.correctOption === "string"
        ? body.correctOption.trim().toUpperCase()
        : "";

    const pointsReward = Number(body.pointsReward);
    const status = body.status ?? "DRAFT";
    const startsAt = parseScheduleDate(body.startsAt);
    const endsAt = parseScheduleDate(body.endsAt);

    if (!startsAt || !endsAt) {
      return NextResponse.json(
      { error: "Start date and deadline are required." },
      { status: 400 }
     );
    }

   if (new Date(startsAt).getTime() <= Date.now()) {
     return NextResponse.json(
      { error: "The start date and time must be in the future." },
      { status: 400 }
    );
   }

  if (
    new Date(endsAt).getTime() <=
    new Date(startsAt).getTime()
   ) {
    return NextResponse.json(
      { error: "The deadline must be later than the start time." },
      { status: 400 }
    );
   }

    if (question.length < 5 || question.length > 1000) {
      return NextResponse.json(
        { error: "The question must be between 5 and 1000 characters." },
        { status: 400 }
      );
    }

    if (
      [optionA, optionB, optionC, optionD].some(
        (option) => !option || option.length > 300
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Enter all four answer options (maximum 300 characters each).",
        },
        { status: 400 }
      );
    }

    if (!OPTIONS.includes(correctOption as (typeof OPTIONS)[number])) {
      return NextResponse.json(
        { error: "Select the correct answer." },
        { status: 400 }
      );
    }

    if (
      !Number.isSafeInteger(pointsReward) ||
      pointsReward < 0 ||
      pointsReward > 100000
    ) {
      return NextResponse.json(
        { error: "Points must be a whole number between 0 and 100000." },
        { status: 400 }
      );
    }

    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      return NextResponse.json(
        { error: "Select a valid Trivia status." },
        { status: 400 }
      );
    }

    if (
      status === "ACTIVE" &&
      endsAt &&
      new Date(endsAt).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "An active question must have a future deadline." },
        { status: 400 }
      );
    }

    const created = await db.orm.public.TriviaQuestion.create({
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      pointsReward,
      status: status as "DRAFT" | "ACTIVE" | "CLOSED",
      startsAt,
      endsAt,
    });

    return NextResponse.json(
      { success: true, question: created },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin trivia creation failed:", error);
    return NextResponse.json(
      { error: "Unable to create the Trivia question." },
      { status: 500 }
    );
  }
}
