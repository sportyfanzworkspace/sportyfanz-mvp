import { NextResponse } from "next/server";
import { Pool, type PoolClient } from "pg";
import {
  verifyVerificationCode,
  VERIFICATION_MAX_ATTEMPTS,
} from "@/lib/email-verification";
import { getFanLevel } from "@/lib/progression";

export const runtime = "nodejs";

const globalForPg = globalThis as typeof globalThis & {
  sportyFanzVerificationPool?: Pool;
};

function getPool(): Pool {
  if (!globalForPg.sportyFanzVerificationPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured.");
    }

    globalForPg.sportyFanzVerificationPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
  }

  return globalForPg.sportyFanzVerificationPool;
}

export async function POST(request: Request) {
  let client: PoolClient | undefined;

  try {
    const body = await request.json().catch(() => null);

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const code =
      typeof body?.code === "string"
        ? body.code.trim()
        : "";

    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter your email and six-digit verification code." },
        { status: 400 }
      );
    }

    client = await getPool().connect();

    await client.query("BEGIN");

    const userResult = await client.query<{
      id: number;
      emailVerified: boolean;
      status: string;
    }>(
      `SELECT id, "emailVerified", status
       FROM users
       WHERE email = $1
       FOR UPDATE`,
      [email]
    );

    const user = userResult.rows[0];

    if (!user) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    if (user.emailVerified) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: "Invalid or expired verification code.",
        },
        { status: 400 }
      );
    }

    if (user.status !== "ACTIVE") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "This account is not active." },
        { status: 403 }
      );
    }

    const codeResult = await client.query<{
      id: number;
      codeHash: string;
      expiresAt: Date;
      attempts: number;
    }>(
      `SELECT id, "codeHash", "expiresAt", attempts
       FROM email_verification_codes
       WHERE "userId" = $1
       FOR UPDATE`,
      [user.id]
    );

    const record = codeResult.rows[0];

    if (
      !record ||
      new Date(record.expiresAt).getTime() <= Date.now() ||
      record.attempts >= VERIFICATION_MAX_ATTEMPTS
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Code expired or attempts exhausted. Request a new code." },
        { status: 400 }
      );
    }

    const valid = verifyVerificationCode(
      user.id,
      code,
      record.codeHash
    );

    if (!valid) {
      await client.query(
        `UPDATE email_verification_codes
         SET attempts = attempts + 1
         WHERE id = $1`,
        [record.id]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        { error: "Incorrect verification code." },
        { status: 400 }
      );
    }

    await client.query(
      `UPDATE users
       SET "emailVerified" = TRUE
       WHERE id = $1`,
      [user.id]
    );

    const awardResult = await client.query(
      `INSERT INTO progression_awards
         ("userId", "taskKey", points, description)
       VALUES ($1, 'REGISTRATION_COMPLETED', 40,
               'Email verified registration')
       ON CONFLICT ("userId", "taskKey") DO NOTHING
       RETURNING id`,
      [user.id]
    );

    if (awardResult.rowCount === 1) {
      const profileResult = await client.query<{
        progressionPoints: number;
      }>(
        `SELECT "progressionPoints"
         FROM fan_profiles
         WHERE "userId" = $1
         FOR UPDATE`,
        [user.id]
      );

      const profile = profileResult.rows[0];

      if (!profile) {
        throw new Error("Fan profile not found.");
      }

      const newBalance = profile.progressionPoints + 40;

      await client.query(
        `UPDATE fan_profiles
         SET "progressionPoints" = $1,
             "fanLevel" = $2,
             "updatedAt" = NOW()
         WHERE "userId" = $3`,
        [newBalance, getFanLevel(newBalance), user.id]
      );
    }

    await client.query(
      `DELETE FROM email_verification_codes
       WHERE "userId" = $1`,
      [user.id]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Email verified successfully. You can now log in.",
      redirectTo: "/login",
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Email verification error:", error);

    return NextResponse.json(
      { error: "Unable to verify email. Please try again." },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
