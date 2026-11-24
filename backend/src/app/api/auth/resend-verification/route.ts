import { NextResponse } from "next/server";
import { Pool, type PoolClient } from "pg";
import { sendVerificationEmail } from "@/lib/email";
import {
  generateVerificationCode,
  hashVerificationCode,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "@/lib/email-verification";

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

    if (!email || email.length > 254 || !email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
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

    // Do not reveal whether the email exists or is verified.
    if (!user || user.emailVerified || user.status !== "ACTIVE") {
      await client.query("ROLLBACK");

      return NextResponse.json({
        success: true,
        message:
          "If this account requires verification, a code will be sent.",
      });
    }

    const recordResult = await client.query<{
      createdAt: Date;
    }>(
      `SELECT "createdAt"
       FROM email_verification_codes
       WHERE "userId" = $1`,
      [user.id]
    );

    const record = recordResult.rows[0];

    if (
      record &&
      Date.now() - new Date(record.createdAt).getTime() <
        VERIFICATION_RESEND_COOLDOWN_MS
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { error: "Please wait 60 seconds before requesting another code." },
        { status: 429 }
      );
    }

    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(user.id, code);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + VERIFICATION_CODE_TTL_MS
    );

    await client.query(
      `INSERT INTO email_verification_codes
         ("userId", "codeHash", "expiresAt", attempts, "createdAt")
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT ("userId")
       DO UPDATE SET
         "codeHash" = EXCLUDED."codeHash",
         "expiresAt" = EXCLUDED."expiresAt",
         attempts = 0,
         "createdAt" = EXCLUDED."createdAt"`,
      [user.id, codeHash, expiresAt, now]
    );

    await client.query("COMMIT");
    client.release();
    client = undefined;

    await sendVerificationEmail(email, code);

    return NextResponse.json({
      success: true,
      message: "If this account requires verification, a code will be sent.",
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Resend verification error:", error);

    return NextResponse.json(
      { error: "Unable to process verification request. Try again later." },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
