import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to view polls." },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User
      .where({ id: userId })
      .first();

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "User account is not active." },
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

    const allPolls = await db.orm.public.Poll
      .where({ status: "ACTIVE" })
      .all();

    const allOptions = await db.orm.public.PollOption.all();
    const allVotes = await db.orm.public.PollVote.all();

    const now = Date.now();

  
    const polls = allPolls
     .filter((poll) => {
       const now = Date.now();

       const hasStarted =
        !poll.startsAt ||
        new Date(poll.startsAt).getTime() <= now;

    const hasNotEnded =
      !poll.endsAt ||
      new Date(poll.endsAt).getTime() > now;

     return hasStarted && hasNotEnded;
   })
   .map((poll) => {
    const options = allOptions.filter(
      (option) => option.pollId === poll.id
    );
 
    const pollVotes = allVotes.filter(
      (vote) => vote.pollId === poll.id
    );

    const myVote = pollVotes.find(
      (vote) => vote.userId === userId
    );

    return {
      id: poll.id,
      question: poll.question,
      description: poll.description,
      pointsReward: poll.pointsReward,
      startsAt: poll.startsAt,
      endsAt: poll.endsAt,
      isOpen: true,
      totalVotes: pollVotes.length,
      myVote: myVote
        ? {
            optionId: myVote.optionId,
          }
        : null,
      options: options.map((option) => {
        const voteCount = pollVotes.filter(
          (vote) => vote.optionId === option.id
        ).length;

        return {
          id: option.id,
          label: option.label,
          votes: voteCount,
          percentage:
            pollVotes.length > 0
              ? Math.round(
                  (voteCount / pollVotes.length) * 100
                )
              : 0,
        };
      }),
    };
  })
  .filter((poll) => poll.options.length >= 2);

    return NextResponse.json({
      success: true,
      balance: profile.currentPoints,
      totalPoints: profile.totalPoints,
      polls,
    });
  } catch (error) {
    console.error("GET /api/polls error:", error);

    return NextResponse.json(
      { error: "Failed to load polls." },
      { status: 500 }
    );
  }
}