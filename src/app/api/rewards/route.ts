import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.orm.public.User.first({ id: userId });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const profile = await db.orm.public.FanProfile.first({ userId });

    if (!profile) {
      return NextResponse.json(
        { error: "Fan profile not found" },
        { status: 404 }
      );
    }

    const rewards = await db.orm.public.Reward
      .where({ status: "ACTIVE" })
      .all();

    const redemptions = await db.orm.public.RewardRedemption
      .where({ userId })
      .limit(20)
      .all();

    const rewardMap = new Map(
      rewards.map((reward) => [reward.id, reward])
    );

    const history = redemptions.map((redemption) => {
    const reward = rewardMap.get(redemption.rewardId);

    return {
      id: redemption.id,
      rewardId: redemption.rewardId,
      rewardName: reward?.name ?? "Reward",
      pointsSpent: redemption.pointsSpent,
      status: redemption.status,
      rejectionReason: redemption.rejectionReason ?? null,
      referenceCode: redemption.referenceCode,
      createdAt: redemption.createdAt,
      fulfilledAt: redemption.fulfilledAt,
    };
  });

    return NextResponse.json({
      balance: profile.currentPoints,
      totalPoints: profile.totalPoints,
      fanLevel: profile.fanLevel,

      rewards: rewards.map((reward) => ({
        id: reward.id,
        name: reward.name,
        slug: reward.slug,
        description: reward.description,
        imageUrl: reward.imageUrl,
        pointsCost: reward.pointsCost,
        stock: reward.stock,
        status: reward.status,
        category: reward.category,
        expiresAt: reward.expiresAt,
      })),

      history,
    });
  } catch (error) {
    console.error("GET /api/rewards error:", error);

    return NextResponse.json(
      { error: "Failed to load rewards" },
      { status: 500 }
    );
  }
}
