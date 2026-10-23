import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const POLL_VOTE_CHALLENGE = "daily-fan-participation";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to vote." },
        { status: 401 }
      );
    }

    let body: { pollId?: unknown; optionId?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const pollId = Number(body.pollId);
    const optionId = Number(body.optionId);

    if (
      !Number.isSafeInteger(pollId) ||
      pollId <= 0 ||
      !Number.isSafeInteger(optionId) ||
      optionId <= 0
    ) {
      return NextResponse.json(
        { error: "Select a valid poll option." },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User
        .where({ id: userId })
        .first();

      if (!user || user.status !== "ACTIVE") {
        throw new Error("USER_NOT_ACTIVE");
      }

      const profile = await tx.orm.public.FanProfile
        .where({ userId })
        .first();

      if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      const poll = await tx.orm.public.Poll
        .where({ id: pollId })
        .first();

      if (!poll || poll.status !== "ACTIVE") {
        throw new Error("POLL_NOT_AVAILABLE");
      }

      const now = Date.now();

      if (
        (poll.startsAt &&
          now < new Date(poll.startsAt).getTime()) ||
        (poll.endsAt &&
          now >= new Date(poll.endsAt).getTime())
      ) {
        throw new Error("POLL_NOT_OPEN");
      }

      const option = await tx.orm.public.PollOption
        .where({ id: optionId })
        .first();

      if (!option || option.pollId !== pollId) {
        throw new Error("INVALID_OPTION");
      }

      const existingVote = await tx.orm.public.PollVote
        .where({ pollId, userId })
        .first();

      if (existingVote) {
        throw new Error("ALREADY_VOTED");
      }

      // Create the vote first. The database's unique constraint
      // remains the final protection against duplicate votes.
      const vote = await tx.orm.public.PollVote.create({
        pollId,
        optionId,
        userId,
      });

      let balance = profile.currentPoints;
      let totalPoints = profile.totalPoints;
      let challengesCompleted = profile.challengesCompleted;
      const completedChallenges: string[] = [];
      const progressUpdates: {
        title: string;
        progress: number;
        target: number;
        completed: boolean;
        pointsAwarded: number;
      }[] = [];

      // Award the poll reward exactly once for this accepted vote.
      balance += poll.pointsReward;
      totalPoints += poll.pointsReward;

      await tx.orm.public.PointTransaction.create({
        userId,
        type: "PARTICIPATION",
        points: poll.pointsReward,
        description: `Poll vote: ${poll.question}`,
        referenceId: String(vote.id),
        referenceType: "POLL_VOTE",
        balanceAfter: balance,
      });

      // Each accepted vote advances each joined, eligible activity
      // challenge by one. Completed challenges are never rewarded again.
      
    const challenge = await tx.orm.public.Challenge
     .where({
      slug: POLL_VOTE_CHALLENGE,
      status: "ACTIVE",
     })
     .first();

    if (challenge) {
     const participation =
       await tx.orm.public.ChallengeParticipation
        .where({
          challengeId: challenge.id,
          userId,
        })
        .first();

    if (
      participation &&
      participation.status !== "COMPLETED"
     ) {
     const target =
       participation.target ??
       challenge.targetValue ??
       1;

     const newProgress = Math.min(
       participation.progress + 1,
       target
     );

      const completed = newProgress >= target;
      const reward = completed
        ? challenge.pointsReward
        : 0;

       await tx.orm.public.ChallengeParticipation
        .where({ id: participation.id })
        .update({
          progress: newProgress,
          status: completed ? "COMPLETED" : "ACTIVE",
          completedAt: completed
            ? new Date().toISOString()
            : null,
        });

         if (completed) {
         balance += reward;
         totalPoints += reward;
         challengesCompleted += 1;
         completedChallenges.push(challenge.title);

         await tx.orm.public.PointTransaction.create({
           userId,
           type: "CHALLENGE",
           points: reward,
           description: `Completed challenge: ${challenge.title}`,
           referenceId: String(participation.id),
           referenceType: "CHALLENGE_PARTICIPATION",
           balanceAfter: balance,
         });
       }

          progressUpdates.push({
            title: challenge.title,
            progress: newProgress,
            target,
            completed,
            pointsAwarded: reward,
         });
       }
      }

      // Save the combined balance once, after all rewards are calculated.
      await tx.orm.public.FanProfile
        .where({ userId })
        .update({
          currentPoints: balance,
          totalPoints,
          challengesCompleted,
        });

      return {
        pointsEarned: poll.pointsReward,
        balance,
        totalPoints,
        progressUpdates,
        completedChallenges,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Your vote has been submitted!",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { message: string; status: number }> = {
        USER_NOT_ACTIVE: {
          message: "Your account is not active.",
          status: 403,
        },
        PROFILE_NOT_FOUND: {
          message: "Fan profile not found.",
          status: 404,
        },
        POLL_NOT_AVAILABLE: {
          message: "This poll is not available.",
          status: 400,
        },
        POLL_NOT_OPEN: {
          message: "This poll is not currently open for voting.",
          status: 400,
        },
        INVALID_OPTION: {
          message: "That option does not belong to this poll.",
          status: 400,
        },
        ALREADY_VOTED: {
          message: "You have already voted in this poll.",
          status: 409,
        },
      };

      const knownError = errors[error.message];

      if (knownError) {
        return NextResponse.json(
          { error: knownError.message },
          { status: knownError.status }
        );
      }

      const message = error.message.toLowerCase();

      if (
        message.includes("unique constraint") ||
        message.includes("duplicate key") ||
        message.includes("unique violation")
      ) {
        return NextResponse.json(
          { error: "You have already voted in this poll." },
          { status: 409 }
        );
      }
    }

    console.error("POST /api/polls/vote error:", error);

    return NextResponse.json(
      { error: "Failed to submit your vote. Please try again." },
      { status: 500 }
    );
  }
}