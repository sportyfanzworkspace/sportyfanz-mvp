import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { cancelStaffAccessToken, createStaffAccessToken } from "@/lib/admin/staff-access-tokens";
import { sendStaffAccessEmail } from "@/lib/email";
import { checkStaffPasswordRateLimit } from "@/lib/admin/staff-password-rate-limit";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("staff:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (
      !/^[1-9]\d*$/.test(rawId) ||
      !Number.isSafeInteger(id)
    ) {
      return NextResponse.json(
        { error: "Invalid staff account ID." },
        { status: 400 }
      );
    }

    const staff = await db.orm.public.AdminUser.first({
      id,
    });

    if (
      !staff ||
      staff.role !== "ADMIN" ||
      staff.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        { error: "Active staff account not found." },
        { status: 404 }
      );
    }

    if (!staff.mustChangePassword) {
      return NextResponse.json(
        {
          error:
            "This staff member has already completed password setup. Use Reset Password instead.",
        },
        { status: 409 }
      );
    }

    const rateLimit = await checkStaffPasswordRateLimit(
      `staff-email:${staff.id}`
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many staff email requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const { id: tokenId, actionUrl } = await createStaffAccessToken(
      staff.id,
      "INVITATION"
    );

    try {
      await sendStaffAccessEmail(
        staff.email,
        staff.username,
        actionUrl,
        "INVITATION"
      );
    } catch (emailError) {
      try {
        await cancelStaffAccessToken(tokenId, staff.id);
      } catch (cancellationError) {
        console.error(
          "Staff token cancellation failed:",
          cancellationError instanceof Error
            ? cancellationError.name
            : "Unknown error"
        );
      }

      console.error(
        "Staff invitation resend delivery failed:",
        emailError instanceof Error
          ? emailError.name
          : "Unknown error"
      );

      return NextResponse.json(
        {
          error:
            "The invitation email could not be sent. Please try again later.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "A new password setup invitation has been emailed to the staff member.",
    });
  } catch (error) {
    console.error(
      "Staff invitation resend failed:",
      error instanceof Error ? error.name : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to resend the staff invitation." },
      { status: 500 }
    );
  }
}
