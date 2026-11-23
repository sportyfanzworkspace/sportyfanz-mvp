
import { NextResponse } from "next/server";
import {
  getAdminSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();

    if (!session) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const currentPassword =
      typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";

    const newPassword =
      typeof body.newPassword === "string"
        ? body.newPassword
        : "";

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Enter your current and new passwords." },
        { status: 400 }
      );
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
      return NextResponse.json(
        { error: "Your new password must be 12–128 characters long." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          error:
            "Choose a password different from your temporary password.",
        },
        { status: 400 }
      );
    }

    const admin = await db.orm.public.AdminUser.first({
      id: session.adminUserId,
    });

    if (!admin || admin.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This account is unavailable." },
        { status: 403 }
      );
    }

    if (admin.sessionVersion !== session.sessionVersion) {
      return NextResponse.json(
        { error: "Your staff session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "This endpoint is for staff accounts only." },
        { status: 403 }
      );
    }

    const validCurrentPassword = await verifyPassword(
      currentPassword,
      admin.passwordHash
    );

    if (!validCurrentPassword) {
      return NextResponse.json(
        { error: "Your current password is incorrect." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    const updatedAdmin = await db.orm.public.AdminUser.where({
      id: session.adminUserId,
      sessionVersion: session.sessionVersion,
      passwordHash: admin.passwordHash,
    }).update({
      passwordHash,
      sessionVersion: session.sessionVersion + 1,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    });

    if (!updatedAdmin) {
      return NextResponse.json(
        {
          error:
            "Your account was updated by another request. Please sign in again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Password changed successfully. Please sign in again with your new password.",
    });
  } catch (error) {
    console.error("Staff password change failed:", error);

    return NextResponse.json(
      { error: "Unable to change your password." },
      { status: 500 }
    );
  }
}
