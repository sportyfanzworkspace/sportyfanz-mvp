import { db } from "@/lib/prisma";

export type DbTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/**
 * Lock a fan profile within an existing database transaction.
 *
 * All accounting operations must acquire this lock before reading
 * balances, checking awards, or calculating profile counter changes.
 *
 * The lock remains held until the surrounding transaction commits
 * or rolls back.
 */
export async function lockFanProfile(
  tx: DbTransaction,
  userId: number
) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("INVALID_USER_ID");
  }

  const plan = db.raw.sql`
    SELECT "id"
    FROM "public"."fan_profiles"
    WHERE "userId" = ${userId}
    FOR UPDATE
  `
    .returnsRow({
      id: "pg/int4@1",
    })
    .build();

  let found = false;

  for await (const row of tx.query(plan)) {
    if (row.id > 0) {
      found = true;
    }
  }

  if (!found) {
    return null;
  }

  return tx.orm.public.FanProfile
    .where({ userId })
    .first();
}
