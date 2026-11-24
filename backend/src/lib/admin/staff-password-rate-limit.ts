import { createHmac } from "node:crypto";
import { getFanRoomRateLimitPool } from "@/lib/fanroom-rate-limit-db";

export const STAFF_LOGIN_GLOBAL_MAX_ATTEMPTS = 300;
export const STAFF_LOGIN_ACCOUNT_MAX_ATTEMPTS = 10;
export const STAFF_LOGIN_IP_MAX_ATTEMPTS = 100;
export const STAFF_PASSWORD_MAX_ATTEMPTS = 5;
export const STAFF_PASSWORD_GLOBAL_MAX_ATTEMPTS = 100;
export const STAFF_EMAIL_MAX_REQUESTS = 3;
export const STAFF_CREATION_MAX_REQUESTS = 10;
export const STAFF_PASSWORD_WINDOW_SECONDS = 15 * 60;

export type StaffPasswordRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function hashIdentifier(identifier: string): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("A strong AUTH_SECRET is required.");
  }

  return createHmac("sha256", secret)
    .update(`staff-password-setup:${identifier}`)
    .digest("hex");
}

export async function checkStaffPasswordRateLimit(
  identifier: string
): Promise<StaffPasswordRateLimitResult> {
  if (!identifier) {
    throw new Error("A rate-limit identifier is required.");
  }

  const identifierHash = hashIdentifier(identifier);
  const maxAttempts =
    identifier === "global:staff-login"
      ? STAFF_LOGIN_GLOBAL_MAX_ATTEMPTS
      : identifier.startsWith("staff-login-account:")
      ? STAFF_LOGIN_ACCOUNT_MAX_ATTEMPTS
      : identifier.startsWith("staff-login-ip:")
        ? STAFF_LOGIN_IP_MAX_ATTEMPTS
        : identifier === "global:staff-password-setup"
          ? STAFF_PASSWORD_GLOBAL_MAX_ATTEMPTS
      : identifier.startsWith("staff-email:")
        ? STAFF_EMAIL_MAX_REQUESTS
        : identifier.startsWith("staff-create:")
          ? STAFF_CREATION_MAX_REQUESTS
          : STAFF_PASSWORD_MAX_ATTEMPTS;

  const result = await getFanRoomRateLimitPool().query<{
    requestCount: number;
    retryAfterSeconds: number;
  }>(
    `
    INSERT INTO public.staff_password_rate_limits AS limits
      ("identifierHash", "windowStart", "requestCount", "expiresAt")
    VALUES (
      $1,
      NOW(),
      1,
      NOW() + ($2::integer * INTERVAL '1 second')
    )
    ON CONFLICT ("identifierHash")
    DO UPDATE SET
      "windowStart" =
        CASE
          WHEN limits."expiresAt" <= NOW()
          THEN NOW()
          ELSE limits."windowStart"
        END,
      "requestCount" =
        CASE
          WHEN limits."expiresAt" <= NOW()
          THEN 1
          ELSE limits."requestCount" + 1
        END,
      "expiresAt" =
        CASE
          WHEN limits."expiresAt" <= NOW()
          THEN NOW() + ($2::integer * INTERVAL '1 second')
          ELSE limits."expiresAt"
        END
    RETURNING
      "requestCount",
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM ("expiresAt" - NOW())))
      )::integer AS "retryAfterSeconds"
    `,
    [identifierHash, STAFF_PASSWORD_WINDOW_SECONDS]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Unable to check staff password rate limit.");
  }

  return {
    allowed: row.requestCount <= maxAttempts,
    retryAfterSeconds:
      row.requestCount <= maxAttempts
        ? 0
        : row.retryAfterSeconds,
  };
}
