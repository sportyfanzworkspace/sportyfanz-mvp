import { createHash, randomBytes } from "node:crypto";

export const GUEST_NEWS_COOKIE = "sf_guest_news";

export const GUEST_NEWS_COOKIE_MAX_AGE =
  60 * 60 * 24 * 365;

export function createGuestNewsToken(): string {
  return randomBytes(32).toString("hex");
}

export function isValidGuestNewsToken(
  token: string | undefined
): token is string {
  return typeof token === "string" &&
    /^[a-f0-9]{64}$/.test(token);
}

export function hashGuestNewsToken(
  token: string
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function guestNewsCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: GUEST_NEWS_COOKIE_MAX_AGE,
  };
}
