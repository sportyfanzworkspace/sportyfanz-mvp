import { db } from "@/lib/prisma";

export type ProgressionTask =
  | "KYC_APPROVED"
  | "FACEBOOK_FOLLOW"
  | "X_FOLLOW"
  | "INSTAGRAM_FOLLOW"
  | "TIKTOK_FOLLOW"
  | "YOUTUBE_FOLLOW"
  | "WHATSAPP_JOIN"
  | "DAILY_CHECKIN"
  | "CHALLENGE_PARTICIPATION";

const FAN_LEVELS = [
  { level: "NEW_FAN", threshold: 0 },
  { level: "RISING_FAN", threshold: 100 },
  { level: "SUPER_FAN", threshold: 200 },
  { level: "CHAMPION_FAN", threshold: 300 },
  { level: "KING_FAN", threshold: 400 },
] as const;

export function getFanLevel(points: number) {
  return [...FAN_LEVELS]
    .reverse()
    .find((item) => points >= item.threshold)!.level;
}

export async function awardProgressionPoints({
  userId,
  taskKey,
  points,
  description,
}: {
  userId: number;
  taskKey: string;
  points: number;
  description: string;
}) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid user ID.");
  }

  if (!taskKey.trim()) {
    throw new Error("A progression task key is required.");
  }

  if (!Number.isInteger(points) || points <= 0) {
    throw new Error("Progression points must be a positive integer.");
  }

  return db.transaction(async (tx) => {
    const existing = await tx.orm.public.ProgressionAward
      .where({ userId, taskKey })
      .first();

    if (existing) {
      return {
        awarded: false,
        reason: "ALREADY_AWARDED",
        pointsAwarded: 0,
      };
    }

    const profile = await tx.orm.public.FanProfile
      .where({ userId })
      .first();

    if (!profile) {
      throw new Error("Fan profile not found.");
    }

    await tx.orm.public.ProgressionAward.create({
      userId,
      taskKey,
      points,
      description,
    });

    const newBalance = profile.progressionPoints + points;
    const newLevel = getFanLevel(newBalance);

    await tx.orm.public.FanProfile
      .where({ userId })
      .update({
        progressionPoints: newBalance,
        fanLevel: newLevel,
        updatedAt: new Date().toISOString(),
      });

    return {
      awarded: true,
      pointsAwarded: points,
      progressionPoints: newBalance,
      previousLevel: profile.fanLevel,
      fanLevel: newLevel,
      levelChanged: profile.fanLevel !== newLevel,
    };
  });
}