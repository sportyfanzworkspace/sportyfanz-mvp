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
        { error: "Invalid Trivia question ID." },
        { status: 400 }
      );
    }

    const question = await db.orm.public.TriviaQuestion
      .where({ id })
      .first();

    if (!question) {
      return NextResponse.json(
        { error: "Trivia question not found." },
        { status: 404 }
      );
    }

    if (question.status === "CLOSED") {
      return NextResponse.json(
        { error: "Trivia question is already closed." },
        { status: 409 }
      );
    }

    if (question.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only active Trivia questions can be closed." },
        { status: 409 }
      );
    }

    const updated = await db.orm.public.TriviaQuestion
      .where({ id, status: "ACTIVE" })
      .update({ status: "CLOSED" });

    if (!updated) {
      return NextResponse.json(
        { error: "Trivia question is already closed." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Trivia question closed successfully.",
      question: updated,
    });
  } catch (error) {
    console.error("Close Trivia question failed:", error);

    return NextResponse.json(
      { error: "Unable to close Trivia question." },
      { status: 500 }
    );
  }
}
