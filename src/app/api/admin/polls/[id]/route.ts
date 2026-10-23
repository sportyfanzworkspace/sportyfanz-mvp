import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("polls:manage");

    if (!auth.authorized) return auth.response;

    const { id: rawId } = await context.params;
    const pollId = Number(rawId);

    if (!Number.isSafeInteger(pollId) || pollId <= 0) {
      return NextResponse.json(
        { error: "Invalid poll ID." },
        { status: 400 }
      );
    }

    let body: { status?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (
      body.status !== "ACTIVE" &&
      body.status !== "CLOSED"
    ) {
      return NextResponse.json(
        { error: "Select a valid status." },
        { status: 400 }
      );
    }

    const poll = await db.orm.public.Poll
      .where({ id: pollId })
      .first();

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found." },
        { status: 404 }
      );
    }

    if (poll.status === "CLOSED") {
      return NextResponse.json(
        { error: "Closed polls cannot be reopened." },
        { status: 409 }
      );
    }

    if (body.status === "ACTIVE") {
     if (!poll.startsAt || !poll.endsAt) {
       return NextResponse.json(
         {
           error: "Both the poll start date and deadline are required before activation.",
         },
         { status: 400 }
       );
     }

   const startTime = new Date(poll.startsAt).getTime();
   const endTime = new Date(poll.endsAt).getTime();
   const now = Date.now();

    if (
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime <= startTime
     ) {
      return NextResponse.json(
       {
         error: "The poll must have valid dates, and the deadline must be later than the start time.",
       },
       { status: 400 }
      );
    }

      if (endTime <= now) {
         return NextResponse.json(
          { error: "A poll with a past deadline cannot be activated." },
          { status: 400 }
        );
       }

      const options = await db.orm.public.PollOption
        .where({ pollId })
        .all();

      if (options.length < 2) {
        return NextResponse.json(
          { error: "A poll needs at least two options before activation." },
          { status: 400 }
        );
      }

      if (
        poll.endsAt &&
        new Date(poll.endsAt).getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { error: "A poll with a past deadline cannot be activated." },
          { status: 400 }
        );
      }

      if (
        poll.startsAt &&
        poll.endsAt &&
        new Date(poll.endsAt).getTime() <=
          new Date(poll.startsAt).getTime()
      ) {
        return NextResponse.json(
          { error: "The poll deadline must be later than its start time." },
          { status: 400 }
        );
      }
    }

    await db.orm.public.Poll
      .where({ id: pollId })
      .update({
        status: body.status as "ACTIVE" | "CLOSED",
      });

    return NextResponse.json({
      success: true,
      message:
        body.status === "ACTIVE"
          ? "Poll activated successfully."
          : "Poll closed successfully.",
    });
  } catch (error) {
    console.error("Admin poll status update failed:", error);

    return NextResponse.json(
      { error: "Unable to update the poll status." },
      { status: 500 }
    );
  }
}