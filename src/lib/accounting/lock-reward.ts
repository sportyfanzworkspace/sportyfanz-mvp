import { db } from "@/lib/prisma";
import type { DbTransaction } from "./lock-fan-profile";

/**
 * Lock a reward inventory row within an existing transaction.
 *
 * Acquire the FanProfile lock first when an operation affects
 * both a fan's accounting balance and reward inventory.
 *
 * The reward lock remains held until the surrounding
 * transaction commits or rolls back.
 */
export async function lockReward(
  tx: DbTransaction,
  rewardId: number
) {
  if (
    !Number.isSafeInteger(rewardId) ||
    rewardId <= 0 ||
    rewardId > 2147483647
  ) {
    throw new Error("INVALID_REWARD_ID");
  }

  const plan = db.raw.sql`
    SELECT "id"
    FROM "public"."rewards"
    WHERE "id" = ${rewardId}
    FOR UPDATE
  `
    .returnsRow({
      id: "pg/int4@1",
    })
    .build();

  let found = false;

  for await (const row of tx.query(plan)) {
    if (row.id === rewardId) {
      found = true;
    }
  }

  if (!found) {
    return null;
  }

  return tx.orm.public.Reward
    .where({ id: rewardId })
    .first();
}
