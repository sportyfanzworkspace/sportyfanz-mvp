import { validateTriviaDuration } from "./duration-validation";

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
  durationSeconds?: unknown;
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

    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.sportyfanz.com" ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      !/^\/uploads\/sportyfanz\/trivia\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(
        url.pathname
      )
    ) {
      return undefined;
    }

    return result;
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

export function validateQuizInput(
  body: Record<string, unknown>
) {
  const title = text(body.title);
  const description = optionalText(body.description, 2000);
  const coverImageUrl = imageUrl(body.coverImageUrl);
  const startsAt = scheduleDate(body.startsAt);
  const endsAt = scheduleDate(body.endsAt);
  const status = body.status ?? "DRAFT";

  const durationValidation = validateTriviaDuration(
    body.durationSeconds,
    "QUIZ"
  );

  if (durationValidation.ok === false) {
    return {
      ok: false as const,
      error: durationValidation.error,
    };
  }

  const durationSeconds =
    durationValidation.durationSeconds;

  if (title.length < 5 || title.length > 150) {
    return { ok: false as const, error: "Quiz title must be 5–150 characters." };
  }

  if (description === undefined || coverImageUrl === undefined) {
    return { ok: false as const, error: "Invalid description or cover image URL." };
  }

  if (status !== "DRAFT" && status !== "ACTIVE") {
    return { ok: false as const, error: "Select DRAFT or ACTIVE." };
  }

  if (
    !startsAt ||
    !endsAt ||
    new Date(endsAt).getTime() <=
      new Date(startsAt).getTime()
  ) {
    return { ok: false as const, error: "Provide a valid start date and later deadline." };
  }

  if (
    status === "ACTIVE" &&
    new Date(endsAt).getTime() <= Date.now()
  ) {
    return { ok: false as const, error: "An active quiz needs a future deadline." };
  }

  if (
    !Array.isArray(body.questions) ||
    body.questions.length < 2 ||
    body.questions.length > 50
  ) {
    return { ok: false as const, error: "A quiz must contain 2–50 questions." };
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
      return { ok: false as const, error: `Question ${index + 1} is invalid.` };
    }

    const item = raw as QuizQuestionInput;

    if (
      item.durationSeconds !== undefined &&
      item.durationSeconds !== null
    ) {
      return {
        ok: false as const,
        error:
          `Question ${index + 1} cannot have an individual timer. ` +
          "The countdown applies to the entire quiz.",
      };
    }

    const question = text(item.question);
    const optionA = text(item.optionA);
    const optionB = text(item.optionB);
    const optionC = text(item.optionC);
    const optionD = text(item.optionD);
    const correctOption = text(item.correctOption).toUpperCase();
    const pointsReward =
      typeof item.pointsReward === "number"
        ? item.pointsReward
        : typeof item.pointsReward === "string" &&
            item.pointsReward.trim() !== ""
          ? Number(item.pointsReward)
          : NaN;
    const questionImage = imageUrl(item.imageUrl);
    const explanation = optionalText(item.explanation, 2000);

    if (question.length < 5 || question.length > 1000) {
      return { ok: false as const, error: `Question ${index + 1} must be 5–1000 characters.` };
    }

    if (
      [optionA, optionB, optionC, optionD].some(
        (option) => !option || option.length > 300
      )
    ) {
      return { ok: false as const, error: `Question ${index + 1} needs four valid options.` };
    }

    if (!["A", "B", "C", "D"].includes(correctOption)) {
      return { ok: false as const, error: `Question ${index + 1} needs a correct answer.` };
    }

    if (
      !Number.isSafeInteger(pointsReward) ||
      pointsReward < 0 ||
      pointsReward > 100000
    ) {
      return { ok: false as const, error: `Question ${index + 1} has invalid points.` };
    }

    if (
      questionImage === undefined ||
      explanation === undefined
    ) {
      return { ok: false as const, error: `Question ${index + 1} has invalid image or explanation.` };
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

  return {
    ok: true as const,
    data: {
      title,
      description,
      coverImageUrl,
      startsAt,
      endsAt,
      durationSeconds,
      status: status as QuizStatus,
      questions,
    },
  };
}
