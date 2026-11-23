import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    // The catalogue is public. Personal data is not.
    const rewards = await db.orm.public.Reward
      .where({ status: "ACTIVE" })
      .all();

    const now = Date.now();

    const publicRewards = rewards
      .filter((reward) => {
        const hasStock =
          reward.stock === null || reward.stock > 0;

        const validPointsCost =
          Number.isSafeInteger(reward.pointsCost) &&
          reward.pointsCost > 0;

        const expiryTime =
          reward.expiresAt === null
            ? null
            : new Date(reward.expiresAt).getTime();

        const isAvailable =
          expiryTime === null ||
          (
            Number.isFinite(expiryTime) &&
            expiryTime > now
          );

        return hasStock && validPointsCost && isAvailable;
      })
      .map((reward) => ({
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
      }));

    let authenticated = false;
    let balance = 0;
    let totalPoints = 0;
    let fanLevel = "NEW_FAN";
    let history: {
      id: number;
      rewardId: number;
      rewardName: string;
      pointsSpent: number;
      status: string;
      rejectionReason: string | null;
      referenceCode: string;
      createdAt: unknown;
      fulfilledAt: unknown;
    }[] = [];

    if (userId) {
      const user = await db.orm.public.User.first({
        id: userId,
      });

      if (user?.status === "ACTIVE") {
        const profile = await db.orm.public.FanProfile.first({
          userId,
        });

        if (profile) {
          authenticated = true;
          balance = profile.currentPoints;
          totalPoints = profile.totalPoints;
          fanLevel = profile.fanLevel;

          const redemptions =
            await db.orm.public.RewardRedemption
              .where({ userId })
              .limit(20)
              .all();

          const historicalRewardIds = [
            ...new Set(
              redemptions.map(
                (redemption) => redemption.rewardId
              )
            ),
          ];

          const historicalRewards = await Promise.all(
            historicalRewardIds.map((rewardId) =>
              db.orm.public.Reward
                .where({ id: rewardId })
                .first()
            )
          );

          const rewardMap = new Map<number, string>();

          for (const reward of historicalRewards) {
            if (reward) {
              rewardMap.set(reward.id, reward.name);
            }
          }

          history = redemptions.map((redemption) => {
            const reward = rewardMap.get(
              redemption.rewardId
            );

            return {
              id: redemption.id,
              rewardId: redemption.rewardId,
              rewardName: reward ?? "Reward",
              pointsSpent: redemption.pointsSpent,
              status: redemption.status,
              rejectionReason:
                redemption.rejectionReason ?? null,
              referenceCode: redemption.referenceCode,
              createdAt: redemption.createdAt,
              fulfilledAt: redemption.fulfilledAt,
            };
          });
        }
      }
    }

    return NextResponse.json({
      authenticated,
      balance,
      totalPoints,
      fanLevel,
      rewards: publicRewards,
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
