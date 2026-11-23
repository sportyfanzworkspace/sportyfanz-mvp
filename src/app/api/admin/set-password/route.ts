import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import {
  hashStaffAccessToken,
  redeemStaffAccessToken,
} from "@/lib/admin/staff-access-tokens";
import { checkStaffPasswordRateLimit } from "@/lib/admin/staff-password-rate-limit";

export async function POST(request: Request) {
  try {
    const globalRateLimit = await checkStaffPasswordRateLimit(
      "global:staff-password-setup"
    );

    if (!globalRateLimit.allowed) {
      return NextResponse.json(
        { error: "Password setup is temporarily busy. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(globalRateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const MAX_BODY_BYTES = 4096;

    const contentLength = request.headers.get("content-length");

    if (
      contentLength !== null &&
      Number(contentLength) > MAX_BODY_BYTES
    ) {
      return NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 }
      );
    }

    const reader = request.body?.getReader();

    if (!reader) {
      return NextResponse.json(
        { error: "A request body is required." },
        { status: 400 }
      );
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();

        return NextResponse.json(
          { error: "Request body is too large." },
          { status: 413 }
        );
      }

      chunks.push(value);
    }

    const bodyBytes = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    let body: unknown;

    try {
      body = JSON.parse(new TextDecoder().decode(bodyBytes));
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;

    const token =
      typeof payload.token === "string"
        ? payload.token
        : "";

    const newPassword =
      typeof payload.newPassword === "string"
        ? payload.newPassword
        : "";

    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return NextResponse.json(
        { error: "This password setup link is invalid or expired." },
        { status: 400 }
      );
    }

    const rateLimit = await checkStaffPasswordRateLimit(
      `token:${hashStaffAccessToken(token)}`
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    if (
      newPassword.length < 12 ||
      newPassword.length > 128
    ) {
      return NextResponse.json(
        { error: "Your password must be 12–128 characters long." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    const result = await redeemStaffAccessToken(
      token,
      passwordHash
    );

    if (result.success === false) {
      return NextResponse.json(
        {
          error:
            result.reason === "INACTIVE_STAFF"
              ? "This staff account is unavailable."
              : "This password setup link is invalid, expired, or already used.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Your staff password has been set successfully. Please sign in.",
    });
  } catch (error) {
    console.error(
      "Staff password setup failed:",
      error instanceof Error ? error.name : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to set your password. Please try again." },
      { status: 500 }
    );
  }
}
