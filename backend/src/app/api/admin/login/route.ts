
import { NextResponse } from "next/server";
import {
  createAdminSession,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/prisma";
import { checkStaffPasswordRateLimit } from "@/lib/admin/staff-password-rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const identifier =
      typeof body.identifier === "string"
        ? body.identifier.trim().toLowerCase()
        : typeof body.email === "string"
          ? body.email.trim().toLowerCase()
          : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!identifier || !password) {
      return NextResponse.json(
        {
          error:
            "Username or work email and password are required.",
        },
        { status: 400 }
      );
    }

    const globalLoginLimit = await checkStaffPasswordRateLimit(
      "global:staff-login"
    );

    if (!globalLoginLimit.allowed) {
      return NextResponse.json(
        {
          error: "Staff sign-in is temporarily busy. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(globalLoginLimit.retryAfterSeconds),
          },
        }
      );
    }

    const loginRateLimit = await checkStaffPasswordRateLimit(
      `staff-login-account:${identifier}`
    );

    if (!loginRateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many sign-in attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              loginRateLimit.retryAfterSeconds
            ),
          },
        }
      );
    }

    const admin = identifier.includes("@")
      ? await db.orm.public.AdminUser.first({
          email: identifier,
        })
      : await db.orm.public.AdminUser.first({
          username: identifier,
        });

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid username/email or password." },
        { status: 401 }
      );
    }

    if (admin.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This account is not active." },
        { status: 403 }
      );
    }

    const passwordValid = await verifyPassword(
      password,
      admin.passwordHash
    );

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid username/email or password." },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "This account is not authorised for Admin access.",
        },
        { status: 403 }
      );
    }

    await db.orm.public.AdminUser
      .where({ id: admin.id })
      .update({
        lastLoginAt: new Date().toISOString(),
      });

    // Transitional support until the staff-auth migration is applied.
    // Once deployed, every admin session must use the stored version.
    await createAdminSession(
      admin.id,
      typeof admin.sessionVersion === "number"
        ? admin.sessionVersion
        : 0
    );

    return NextResponse.json({
      success: true,
      mustChangePassword: admin.mustChangePassword,
      admin: {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return NextResponse.json(
      { error: "Unable to sign in to Admin." },
      { status: 500 }
    );
  }
}
