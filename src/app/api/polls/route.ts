import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { cookies } from "next/headers";
import {
  GUEST_POLL_COOKIE,
  hashGuestPollToken,
  isValidGuestPollToken,
} from "@/lib/guest-poll-vote";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    let profile = null;

    if (userId) {
      const user = await db.orm.public.User
        .where({ id: userId })
        .first();

      if (!user || user.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "User account is not active." },
          { status: 403 }
        );
      }

      profile = await db.orm.public.FanProfile
        .where({ userId })
        .first();

      if (!profile) {
        return NextResponse.json(
          { error: "Fan profile not found." },
          { status: 404 }
        );
      }
    }

    const allPolls = await db.orm.public.Poll
      .where({ status: "ACTIVE" })
      .all();

    const allOptions = await db.orm.public.PollOption.all();
    const allVotes = await db.orm.public.PollVote.all();
    const allGuestVotes =
      await db.orm.public.GuestPollVote.all();

    const cookieStore = await cookies();
    const guestToken =
      cookieStore.get(GUEST_POLL_COOKIE)?.value;

    const guestTokenHash =
      isValidGuestPollToken(guestToken)
        ? hashGuestPollToken(guestToken)
        : null;

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

    const guestVotes = allGuestVotes.filter(
      (vote) => vote.pollId === poll.id
    );

    const totalVotes = pollVotes.length + guestVotes.length;

    const myVote = userId
      ? pollVotes.find((vote) => vote.userId === userId)
      : guestTokenHash
        ? guestVotes.find(
            (vote) =>
              vote.guestTokenHash === guestTokenHash
          )
        : null;

    return {
      id: poll.id,
      question: poll.question,
      description: poll.description,
      pointsReward: poll.pointsReward,
      startsAt: poll.startsAt,
      endsAt: poll.endsAt,
      isOpen: true,
      totalVotes,
      myVote: myVote
        ? {
            optionId: myVote.optionId,
          }
        : null,
      options: options.map((option) => {
        const voteCount =
          pollVotes.filter(
            (vote) => vote.optionId === option.id
          ).length +
          guestVotes.filter(
            (vote) => vote.optionId === option.id
          ).length;

        return {
          id: option.id,
          label: option.label,
          votes: voteCount,
          percentage:
            totalVotes > 0
              ? Math.round(
                  (voteCount / totalVotes) * 100
                )
              : 0,
        };
      }),
    };
  })
  .filter((poll) => poll.options.length >= 2);

    return NextResponse.json({
      success: true,
      balance: profile?.currentPoints ?? null,
      totalPoints: profile?.totalPoints ?? null,
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