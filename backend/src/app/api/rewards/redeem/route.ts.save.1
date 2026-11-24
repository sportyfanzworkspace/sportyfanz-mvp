import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

function generateReferenceCode() {
  const random = randomBytes(4).toString("hex").toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();

  return `SFZ-${timestamp}-${random}`;
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rewardId = Number(body?.rewardId);

    if (!Number.isInteger(rewardId) || rewardId <= 0) {
      return NextResponse.json(
        { error: "Invalid reward" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const user = await tx.orm.public.User.first({
        id: userId,
      });

      if (!user || user.status !== "ACTIVE") {
        throw new Error("UNAUTHORIZED");
      }

      const profile = await tx.orm.public.FanProfile.first({
        userId,
      });

      if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      const reward = await tx.orm.public.Reward.first({
        id: rewardId,
      });

      if (!reward) {
        throw new Error("REWARD_NOT_FOUND");
      }

      if (reward.status !== "ACTIVE") {
        throw new Error("REWARD_UNAVAILABLE");
      }

      if (reward.stock !== null && reward.stock <= 0) {
        throw new Error("SOLD_OUT");
      }

      if (profile.currentPoints < reward.pointsCost) {
        throw new Error("INSUFFICIENT_POINTS");
      }

      const newBalance =
        profile.currentPoints - reward.pointsCost;

      const newStock =
        reward.stock === null
          ? null
          : reward.stock - 1;

      const newRewardStatus =
        newStock === 0
          ? "SOLD_OUT"
          : "ACTIVE";

      const referenceCode =
        generateReferenceCode();

      const redemption =
        await tx.orm.public.RewardRedemption.create({
          userId,
          rewardId: reward.id,
          pointsSpent: reward.pointsCost,
          status: "PENDING",
          referenceCode,
        });

      await tx.orm.public.FanProfile
        .where({ userId })
        .update({
          currentPoints: newBalance,
        });

      await tx.orm.public.Reward
        .where({ id: reward.id })
        .update({
          stock: newStock,
          status: newRewardStatus,
        });

      await tx.orm.public.PointTransaction.create({
        userId,
        type: "REWARD",
        points: -reward.pointsCost,
        description: `Redeemed reward: ${reward.name}`,
        referenceId: String(redemption.id),
        referenceType: "REWARD_REDEMPTION",
        balanceAfter: newBalance,
      });

      return {
        redemptionId: redemption.id,
        referenceCode,
        rewardName: reward.name,
        pointsSpent: reward.pointsCost,
        balance: newBalance,
        stock: newStock,
        status: redemption.status,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Reward redeemed successfully",
      redemption: result,
    });
  } catch (error) {
    console.error(
      "POST /api/rewards/redeem error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (message === "PROFILE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Fan profile not found" },
        { status: 404 }
      );
    }

    if (message === "REWARD_NOT_FOUND") {
      return NextResponse.json(
        { error: "Reward not found" },
        { status: 404 }
      );
    }

    if (message === "REWARD_UNAVAILABLE") {
      return NextResponse.json(
        {
          error:
            "This reward is no longer available",
        },
        { status: 409 }
      );
    }

    if (message === "SOLD_OUT") {
      return NextResponse.json(
        { error: "This reward is sold out" },
        { status: 409 }
      );
    }

    if (message === "INSUFFICIENT_POINTS") {
      return NextResponse.json(
        {
          error:
            "You do not have enough Sporty Points",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to redeem reward" },
      { status: 500 }
    );
  }
}
