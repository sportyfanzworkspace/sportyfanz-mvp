import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/require-admin";
import { createStaffAccessToken } from "@/lib/admin/staff-access-tokens";
import { checkStaffPasswordRateLimit } from "@/lib/admin/staff-password-rate-limit";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const privateHeaders = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
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
        {
          status: 400,
          headers: privateHeaders,
        }
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
        {
          status: 404,
          headers: privateHeaders,
        }
      );
    }

    const rateLimit = await checkStaffPasswordRateLimit(
      `staff-email:${staff.id}`
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many staff access link requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            ...privateHeaders,
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const purpose = staff.mustChangePassword
      ? "INVITATION"
      : "PASSWORD_RESET";

    const { actionUrl, expiresAt } =
      await createStaffAccessToken(staff.id, purpose);

    return NextResponse.json(
      {
        success: true,
        purpose,
        actionUrl,
        expiresAt,
        message:
          purpose === "INVITATION"
            ? "Staff invitation link generated successfully."
            : "Staff password reset link generated successfully.",
      },
      {
        headers: privateHeaders,
      }
    );
  } catch (error) {
    console.error(
      "Staff access link generation failed:",
      error instanceof Error ? error.name : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to generate the staff access link." },
      {
        status: 500,
        headers: privateHeaders,
      }
    );
  }
}
