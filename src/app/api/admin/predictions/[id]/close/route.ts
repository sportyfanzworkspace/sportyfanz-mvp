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
    const auth = await requirePermission("predictions:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid match ID." },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const match = await tx.orm.public.Match
        .where({ id })
        .first();

      if (!match) {
        throw new Error("MATCH_NOT_FOUND");
      }

      if (match.predictionsClosedAt) {
        throw new Error("PREDICTIONS_ALREADY_CLOSED");
      }

      if (!["SCHEDULED", "LIVE", "HALF_TIME"].includes(match.status)) {
        throw new Error("MATCH_NOT_ELIGIBLE");
      }

      const updated = await tx.orm.public.Match
        .where({
          id,
          status: match.status,
          predictionsClosedAt: null,
        })
        .update({
          predictionsClosedAt: new Date().toISOString(),
        });

      if (!updated) {
        throw new Error("PREDICTIONS_ALREADY_CLOSED");
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Predictions closed successfully.",
      match: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    const errors: Record<
      string,
      { status: number; message: string }
    > = {
      MATCH_NOT_FOUND: {
        status: 404,
        message: "Match not found.",
      },
      PREDICTIONS_ALREADY_CLOSED: {
        status: 409,
        message: "Predictions are already closed.",
      },
      MATCH_NOT_ELIGIBLE: {
        status: 409,
        message:
          "Only scheduled, live or half-time matches can have predictions manually closed.",
      },
    };

    if (errors[message]) {
      return NextResponse.json(
        { error: errors[message].message },
        { status: errors[message].status }
      );
    }

    console.error("Close predictions failed:", error);

    return NextResponse.json(
      { error: "Unable to close predictions." },
      { status: 500 }
    );
  }
}
