import { createHmac } from "node:crypto";
import { getFanRoomRateLimitPool } from "@/lib/fanroom-rate-limit-db";

export const FANROOM_MESSAGE_COOLDOWN_SECONDS = 3;

export type FanRoomRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function senderKey(identifier: string): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("A strong AUTH_SECRET is required.");
  }

  return createHmac("sha256", secret)
    .update(`fanroom-cooldown:${identifier}`)
    .digest("hex");
}

export async function checkFanRoomRateLimit(
  identifier: string
): Promise<FanRoomRateLimitResult> {
  if (!identifier) {
    throw new Error("A sender identifier is required.");
  }

  const result = await getFanRoomRateLimitPool().query<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>(
    `
    INSERT INTO public.fanroom_rate_limits AS limits
      ("senderKey", "windowStart", "requestCount", "expiresAt")
    VALUES (
      $1,
      NOW(),
      1,
      NOW() + ($2::integer * INTERVAL '1 second')
    )
    ON CONFLICT ("senderKey")
    DO UPDATE SET
      "windowStart" = NOW(),
      "requestCount" = 1,
      "expiresAt" =
        NOW() + ($2::integer * INTERVAL '1 second')
    WHERE limits."expiresAt" <= NOW()
    RETURNING TRUE AS "allowed", 0 AS "retryAfterSeconds"
    `,
    [senderKey(identifier), FANROOM_MESSAGE_COOLDOWN_SECONDS]
  );

  if (result.rows.length > 0) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  const remaining = await getFanRoomRateLimitPool().query<{
    retryAfterSeconds: number;
  }>(
    `
    SELECT GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM ("expiresAt" - NOW())))
    )::integer AS "retryAfterSeconds"
    FROM public.fanroom_rate_limits
    WHERE "senderKey" = $1
    `,
    [senderKey(identifier)]
  );

  return {
    allowed: false,
    retryAfterSeconds:
      remaining.rows[0]?.retryAfterSeconds ?? 1,
  };
}
