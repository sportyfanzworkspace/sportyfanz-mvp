import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");
}

function verificationSecret(): string {
  const secret =
    process.env.EMAIL_VERIFICATION_SECRET ||
    process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "A strong email verification secret is required."
    );
  }

  return secret;
}

export function hashVerificationCode(
  userId: number,
  code: string
): string {
  return createHmac("sha256", verificationSecret())
    .update(`${userId}:${code}`)
    .digest("hex");
}

export function verifyVerificationCode(
  userId: number,
  code: string,
  storedHash: string
): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  if (!/^[a-f0-9]{64}$/i.test(storedHash)) {
    return false;
  }

  const expected = Buffer.from(
    hashVerificationCode(userId, code),
    "hex"
  );

  const actual = Buffer.from(storedHash, "hex");

  return timingSafeEqual(expected, actual);
}
