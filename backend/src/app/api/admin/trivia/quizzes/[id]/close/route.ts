import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  _request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("trivia:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid Trivia quiz ID." },
        { status: 400 }
      );
    }

    const quiz = await db.orm.public.TriviaQuiz
      .where({ id })
      .first();

    if (!quiz) {
      return NextResponse.json(
        { error: "Trivia quiz not found." },
        { status: 404 }
      );
    }

    if (quiz.status === "CLOSED") {
      return NextResponse.json(
        { error: "This Trivia quiz is already closed." },
        { status: 409 }
      );
    }

    if (quiz.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only active Trivia quizzes can be closed." },
        { status: 409 }
      );
    }

    // The answer endpoint locks and checks the parent quiz.
    // Closing the parent prevents further answer submissions
    // without deleting questions, attempts or earned points.
    const updated = await db.orm.public.TriviaQuiz
      .where({ id, status: "ACTIVE" })
      .update({ status: "CLOSED" });

    if (!updated) {
      return NextResponse.json(
        { error: "This Trivia quiz is no longer active." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Trivia quiz closed successfully.",
      quiz: updated,
    });
  } catch (error) {
    console.error("Close Trivia quiz failed:", error);

    return NextResponse.json(
      { error: "Unable to close Trivia quiz." },
      { status: 500 }
    );
  }
}
