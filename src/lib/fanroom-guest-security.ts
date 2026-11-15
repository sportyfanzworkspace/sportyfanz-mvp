import {
  createHmac,
  randomBytes,
} from "node:crypto";

export const FANROOM_GUEST_COOKIE = "sf_fanroom_guest";

export const FANROOM_GUEST_COOKIE_MAX_AGE =
  60 * 60 * 24 * 365;

export function createFanRoomGuestToken(): string {
  return randomBytes(32).toString("hex");
}

export function isValidFanRoomGuestToken(
  token: string | undefined
): token is string {
  return typeof token === "string" &&
    /^[a-f0-9]{64}$/.test(token);
}

export function hashFanRoomGuestToken(
  token: string
): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "A strong AUTH_SECRET is required for Fan Room security."
    );
  }

  return createHmac("sha256", secret)
    .update(`fanroom-guest:${token}`)
    .digest("hex");
}

export function fanRoomGuestCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: FANROOM_GUEST_COOKIE_MAX_AGE,
  };
}
