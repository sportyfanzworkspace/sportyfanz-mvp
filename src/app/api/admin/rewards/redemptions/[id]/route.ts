import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";
import { lockFanProfile } from "@/lib/accounting/lock-fan-profile";
import { lockReward } from "@/lib/accounting/lock-reward";
import { nextRewardUpdatedAt } from "@/lib/accounting/reward-version";

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

    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      id > 2147483647
    ) {
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
      // Identify the fan before acquiring accounting locks.
      const initialRedemption =
        await tx.orm.public.RewardRedemption
          .where({ id })
          .first();

      if (!initialRedemption) {
        throw new Error("REDEMPTION_NOT_FOUND");
      }

      // Maintain the shared FanProfile-first accounting lock order.
      const profile = await lockFanProfile(
        tx,
        initialRedemption.userId
      );

      if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      // Serialize all administrator transitions for this redemption.
      const redemptionLockPlan = db.raw.sql`
        SELECT "id"
        FROM "public"."reward_redemptions"
        WHERE "id" = ${id}
        FOR UPDATE
      `
        .returnsRow({
          id: "pg/int4@1",
        })
        .build();

      let redemptionLocked = false;

      for await (const row of tx.query(redemptionLockPlan)) {
        if (row.id === id) {
          redemptionLocked = true;
        }
      }

      if (!redemptionLocked) {
        throw new Error("REDEMPTION_NOT_FOUND");
      }

      // Read the latest redemption after acquiring its lock.
      const redemption =
        await tx.orm.public.RewardRedemption
          .where({ id })
          .first();

      if (!redemption) {
        throw new Error("REDEMPTION_NOT_FOUND");
      }

      if (
        redemption.userId !== initialRedemption.userId
      ) {
        throw new Error("INVALID_TRANSITION");
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
        const reward = await lockReward(
          tx,
          redemption.rewardId
        );

        if (!reward) {
          throw new Error("REWARD_NOT_FOUND");
        }

        if (
          !Number.isSafeInteger(redemption.pointsSpent) ||
          redemption.pointsSpent <= 0
        ) {
          throw new Error("INVALID_REFUND_AMOUNT");
        }

        const refundedBalance =
          profile.currentPoints + redemption.pointsSpent;

        if (
          !Number.isSafeInteger(refundedBalance) ||
          refundedBalance > 2147483647 ||
          refundedBalance < 0
        ) {
          throw new Error("INVALID_REFUND_AMOUNT");
        }

        if (
          reward.stock !== null &&
          (reward.stock < 0 || reward.stock >= 2147483647)
        ) {
          throw new Error("INVALID_REWARD_STOCK");
        }

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

        const expiryTime =
          reward.expiresAt === null
            ? null
            : new Date(reward.expiresAt).getTime();

        const rewardExpired =
          expiryTime !== null &&
          (
            !Number.isFinite(expiryTime) ||
            expiryTime <= Date.now()
          );

        const restoredStatus =
          reward.status === "ARCHIVED"
            ? "ARCHIVED"
            : reward.status === "INACTIVE" || rewardExpired
              ? "INACTIVE"
              : restoredStock === 0
                ? "SOLD_OUT"
                : "ACTIVE";

        await tx.orm.public.Reward
          .where({ id: reward.id })
          .update({
            stock: restoredStock,
            updatedAt: nextRewardUpdatedAt(
              reward.updatedAt
            ),
            status: restoredStatus,
          });
      }

      const updated =
        await tx.orm.public.RewardRedemption
         .where({
           id,
           status: redemption.status,
         })
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

      // Force rollback if the expected transition did not occur.
      if (!updated) {
        throw new Error("INVALID_TRANSITION");
      }

      const notificationDetails = {
        APPROVED: {
          title: "Reward redemption approved",
          message: `Your reward redemption ${redemption.referenceCode} has been approved.`,
        },
        FULFILLED: {
          title: "Reward fulfilled",
          message: `Your reward redemption ${redemption.referenceCode} has been fulfilled.`,
        },
        REJECTED: {
          title: "Reward redemption rejected",
          message: `Your reward redemption ${redemption.referenceCode} was rejected. Your Fan Points have been refunded.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
        },
        CANCELLED: {
          title: "Reward redemption cancelled",
          message: `Your reward redemption ${redemption.referenceCode} was cancelled. Your Fan Points have been refunded.`,
        },
      }[nextStatus];

      await tx.orm.public.Notification.create({
        userId: redemption.userId,
        type: "REWARD",
        title: notificationDetails.title,
        message: notificationDetails.message,
        link: "/app/rewards",
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

    if (
      message === "INVALID_REFUND_AMOUNT" ||
      message === "INVALID_REWARD_STOCK"
    ) {
      return NextResponse.json(
        {
          error: "Invalid refund accounting data. No refund was completed.",
        },
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
