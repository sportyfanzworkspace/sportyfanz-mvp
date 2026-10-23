import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

const STATUSES = ["DRAFT", "ACTIVE"] as const;

function parseScheduleDate(
  value: unknown
): string | null | undefined {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString();
}

export async function GET() {
  try {
    const auth = await requirePermission("polls:manage");

    if (!auth.authorized) return auth.response;

    // Automatically close active polls whose deadlines have passed.
    const activePolls = await db.orm.public.Poll
      .where({ status: "ACTIVE" })
      .all();

    const now = Date.now();

    for (const poll of activePolls) {
      if (
        poll.endsAt &&
        new Date(poll.endsAt).getTime() <= now
      ) {
        await db.orm.public.Poll
          .where({ id: poll.id })
          .update({ status: "CLOSED" });
      }
    }

    const [polls, options, votes] = await Promise.all([
      db.orm.public.Poll.all(),
      db.orm.public.PollOption.all(),
      db.orm.public.PollVote.all(),
    ]);

    const items = polls
      .map((poll) => {
        const pollOptions = options.filter(
          (option) => option.pollId === poll.id
        );

        const pollVotes = votes.filter(
          (vote) => vote.pollId === poll.id
        );

        const startsAt = poll.startsAt
          ? new Date(poll.startsAt).getTime()
          : null;

        const endsAt = poll.endsAt
          ? new Date(poll.endsAt).getTime()
          : null;

        let scheduleStatus: string = poll.status;

        if (
          poll.status === "ACTIVE" &&
          startsAt !== null &&
          startsAt > now
        ) {
          scheduleStatus = "SCHEDULED";
        }

        return {
          id: poll.id,
          question: poll.question,
          description: poll.description,
          status: poll.status,
          scheduleStatus,
          pointsReward: poll.pointsReward,
          startsAt: poll.startsAt,
          endsAt: poll.endsAt,
          createdAt: poll.createdAt,
          totalVotes: pollVotes.length,
          options: pollOptions.map((option) => {
            const count = pollVotes.filter(
              (vote) => vote.optionId === option.id
            ).length;

            return {
              id: option.id,
              label: option.label,
              votes: count,
              percentage:
                pollVotes.length > 0
                  ? Math.round((count / pollVotes.length) * 100)
                  : 0,
            };
          }),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

    return NextResponse.json({
      success: true,
      polls: items,
      summary: {
        totalPolls: items.length,
        activePolls: items.filter(
          (poll) => poll.status === "ACTIVE"
        ).length,
        totalVotes: votes.length,
        draftPolls: items.filter(
          (poll) => poll.status === "DRAFT"
        ).length,
      },
    });
  } catch (error) {
    console.error("Admin polls list failed:", error);

    return NextResponse.json(
      { error: "Unable to load Polls Management data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("polls:manage");

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
      typeof body.question === "string"
        ? body.question.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const pointsReward = Number(body.pointsReward);
    const status = body.status ?? "DRAFT";

    const startsAt = parseScheduleDate(body.startsAt);
    const endsAt = parseScheduleDate(body.endsAt);

    if (question.length < 5 || question.length > 1000) {
      return NextResponse.json(
        {
          error: "The poll question must be between 5 and 1000 characters.",
        },
        { status: 400 }
      );
    }

    if (description.length > 2000) {
      return NextResponse.json(
        { error: "The description cannot exceed 2000 characters." },
        { status: 400 }
      );
    }

    if (
      startsAt === undefined ||
      endsAt === undefined ||
      startsAt === null ||
      endsAt === null
    ) {
      return NextResponse.json(
        { error: "Both the poll start date and deadline are required and must be valid." },
        { status: 400 }
      );
    }

    if (
      new Date(endsAt).getTime() <= new Date(startsAt).getTime()
    ) {
      return NextResponse.json(
        { error: "The deadline must be later than the start time." },
        { status: 400 }
      );
    }

    if (
      status !== "DRAFT" &&
      status !== "ACTIVE"
    ) {
      return NextResponse.json(
        { error: "A new poll must be saved as DRAFT or ACTIVE." },
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

    if (
      status === "ACTIVE" &&
      endsAt &&
      new Date(endsAt).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "An active poll must have a future deadline." },
        { status: 400 }
      );
    }

    const rawOptions = body.options;

    if (!Array.isArray(rawOptions)) {
      return NextResponse.json(
        { error: "Provide at least two poll options." },
        { status: 400 }
      );
    }

    const optionLabels = rawOptions.map((option) =>
      typeof option === "string" ? option.trim() : ""
    );

    if (
      optionLabels.length < 2 ||
      optionLabels.length > 10 ||
      optionLabels.some(
        (option) => !option || option.length > 200
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Provide between 2 and 10 non-empty options, each no longer than 200 characters.",
        },
        { status: 400 }
      );
    }

    // Create the poll and all its options together.
    const created = await db.transaction(async (tx) => {
      const poll = await tx.orm.public.Poll.create({
        question,
        description: description || null,
        pointsReward,
        status: status as "DRAFT" | "ACTIVE",
        startsAt,
        endsAt,
      });

      for (const label of optionLabels) {
        await tx.orm.public.PollOption.create({
          pollId: poll.id,
          label,
        });
      }

      return poll;
    });

    return NextResponse.json(
      { success: true, poll: created },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin poll creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create the poll." },
      { status: 500 }
    );
  }
}