import {
  createHash,
  randomBytes,
} from "node:crypto";

export const GUEST_POLL_COOKIE = "sf_guest_poll";

export const GUEST_POLL_COOKIE_MAX_AGE =
  60 * 60 * 24 * 365;

export function createGuestPollToken(): string {
  return randomBytes(32).toString("hex");
}

export function isValidGuestPollToken(
  token: string | undefined
): token is string {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return false;
  }

  return true;
}

export function hashGuestPollToken(
  token: string
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function guestPollCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: GUEST_POLL_COOKIE_MAX_AGE,
  };
}
