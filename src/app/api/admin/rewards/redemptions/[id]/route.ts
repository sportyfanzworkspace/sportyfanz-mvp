import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const TERMINAL_STATUSES = [
  "FULFILLED",
  "CANCELLED",
  "REJECTED",
] as const;

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("rewards:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "Invalid redemption ID." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const requestedStatus = body?.status;

    const rejectionReason =
       typeof body?.rejectionReason === "string"
       ? body.rejectionReason.trim()
       : "";

    if (requestedStatus === "REJECTED") {
      if (!rejectionReason) {
        return NextResponse.json(
        { error: "Please provide a reason for rejecting this redemption." },
        { status: 400 }
      );
    }

    if (rejectionReason.length > 1000) {
      return NextResponse.json(
       { error: "The rejection reason must be 1000 characters or fewer." },
       { status: 400 }
      );
     }
    }

    const allowedStatuses = [
      "APPROVED",
      "FULFILLED",
      "CANCELLED",
      "REJECTED",
    ] as const;

    if (
      !allowedStatuses.includes(
        requestedStatus as (typeof allowedStatuses)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Select a valid redemption status." },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const redemption =
        await tx.orm.public.RewardRedemption
          .where({ id })
          .first();

      if (!redemption) {
        throw new Error("REDEMPTION_NOT_FOUND");
      }

      if (
        TERMINAL_STATUSES.includes(
          redemption.status as (typeof TERMINAL_STATUSES)[number]
        )
      ) {
        throw new Error("REDEMPTION_CLOSED");
      }

      const nextStatus = requestedStatus as
        | "APPROVED"
        | "FULFILLED"
        | "CANCELLED"
        | "REJECTED";

      if (
        nextStatus === "APPROVED" &&
        redemption.status !== "PENDING"
      ) {
        throw new Error("INVALID_TRANSITION");
      }

      if (
        nextStatus === "FULFILLED" &&
        redemption.status !== "APPROVED"
      ) {
        throw new Error("APPROVAL_REQUIRED");
      }

      if (
        (nextStatus === "REJECTED" ||
          nextStatus === "CANCELLED") &&
        redemption.status !== "PENDING" &&
        redemption.status !== "APPROVED"
      ) {
        throw new Error("INVALID_TRANSITION");
      }

      if (
        nextStatus === "CANCELLED" ||
        nextStatus === "REJECTED"
      ) {
        const profile =
          await tx.orm.public.FanProfile
            .where({ userId: redemption.userId })
            .first();

        if (!profile) {
          throw new Error("PROFILE_NOT_FOUND");
        }

        const reward =
          await tx.orm.public.Reward
            .where({ id: redemption.rewardId })
            .first();

        if (!reward) {
          throw new Error("REWARD_NOT_FOUND");
        }

        const refundedBalance =
          profile.currentPoints + redemption.pointsSpent;

        await tx.orm.public.FanProfile
          .where({ userId: redemption.userId })
          .update({
            currentPoints: refundedBalance,
          });

        await tx.orm.public.PointTransaction.create({
          userId: redemption.userId,
          type: "ADJUSTMENT",
          points: redemption.pointsSpent,
          description:
            `Refund for reward redemption ${redemption.referenceCode}`,
          referenceId: String(redemption.id),
          referenceType: "REWARD_REFUND",
          balanceAfter: refundedBalance,
        });

        const restoredStock =
          reward.stock === null
            ? null
            : reward.stock + 1;

        await tx.orm.public.Reward
          .where({ id: reward.id })
          .update({
            stock: restoredStock,
            status:
              restoredStock === 0
                ? "SOLD_OUT"
                : reward.status === "ARCHIVED"
                  ? "ARCHIVED"
                  : reward.status === "INACTIVE"
                    ? "INACTIVE"
                    : "ACTIVE",
          });
      }

      const updated =
        await tx.orm.public.RewardRedemption
         .where({ id })
         .update({
         status: nextStatus,
         rejectionReason:
         nextStatus === "REJECTED"
           ? rejectionReason
           : null,
        fulfilledAt:
         nextStatus === "FULFILLED"
          ? new Date().toISOString()
           : null,
       });

      return updated;
    });

    return NextResponse.json({
      success: true,
      redemption: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "";

    if (message === "REDEMPTION_NOT_FOUND") {
      return NextResponse.json(
        { error: "Redemption request not found." },
        { status: 404 }
      );
    }

    if (
      message === "REDEMPTION_CLOSED" ||
      message === "INVALID_TRANSITION"
    ) {
      return NextResponse.json(
        { error: "This redemption status transition is not allowed." },
        { status: 409 }
      );
    }

    if (message === "APPROVAL_REQUIRED") {
      return NextResponse.json(
        { error: "Approve the redemption before fulfilling it." },
        { status: 409 }
      );
    }

    if (message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Fan profile not found; no refund was completed." },
        { status: 409 }
      );
    }

    if (message === "REWARD_NOT_FOUND") {
      return NextResponse.json(
        { error: "Reward not found; no refund was completed." },
        { status: 409 }
      );
    }

    console.error("Admin redemption update failed:", error);

    return NextResponse.json(
      { error: "Unable to update this redemption." },
      { status: 500 }
    );
  }
}
