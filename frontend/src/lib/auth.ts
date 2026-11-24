
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";

const FAN_SESSION_COOKIE = "sportyfanz_session";
const ADMIN_SESSION_COOKIE = "sportyfanz_admin_session";
const SESSION_DURATION = 60 * 60 * 24 * 7;

function getSecret() {
  const value = process.env.AUTH_SECRET;

  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET must be configured with at least 32 characters."
    );
  }

  return new TextEncoder().encode(value);
}

function isValidId(id: unknown): id is number {
  return (
    typeof id === "number" &&
    Number.isSafeInteger(id) &&
    id > 0
  );
}

async function setSession(
  cookieName: string,
  claimName: "userId" | "adminUserId",
  id: number
) {
  if (!isValidId(id)) {
    throw new Error("A valid account ID is required.");
  }

  const token = await new SignJWT({ [claimName]: id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

async function getSessionId(
  cookieName: string,
  claimName: "userId" | "adminUserId"
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieName)?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, getSecret());
    const id = payload[claimName];

    return isValidId(id) ? id : null;
  } catch {
    return null;
  }
}

// Fan sessions — preserve the existing behavior.
export async function createSession(userId: number) {
  await setSession(FAN_SESSION_COOKIE, "userId", userId);
}

export async function getCurrentUserId() {
  return getSessionId(FAN_SESSION_COOKIE, "userId");
}

// Admin sessions — isolated from fan sessions.
export async function createAdminSession(adminUserId: number) {
  await setSession(
    ADMIN_SESSION_COOKIE,
    "adminUserId",
    adminUserId
  );
}

export async function getCurrentAdminUserId() {
  return getSessionId(
    ADMIN_SESSION_COOKIE,
    "adminUserId"
  );
}

export async function logout() {
  const cookieStore = await cookies();

  cookieStore.set(FAN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
}

export async function logoutAdmin() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
}

// Password utilities — unchanged.
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
) {
  return bcrypt.compare(password, hash);
}
