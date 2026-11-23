import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createInvitedStaff } from "@/lib/admin/create-invited-staff";
import { sendStaffAccessEmail } from "@/lib/email";
import { cancelStaffAccessToken } from "@/lib/admin/staff-access-tokens";
import { checkStaffPasswordRateLimit } from "@/lib/admin/staff-password-rate-limit";
import {
  requirePermission,
  type StaffRole,
} from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

const VALID_STAFF_ROLES: StaffRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "CONTENT_MODERATION",
  "SUPPORT",
];

function generateUsername(name: string) {
  const base =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 20) || "staff";

  return `${base}.${randomBytes(3).toString("hex")}`;
}

export async function GET() {
  try {
    const auth = await requirePermission("staff:read");

    if (!auth.authorized) {
      return auth.response;
    }

    const staff = await db.orm.public.AdminUser
      .select(
        "id",
        "name",
        "email",
        "username",
        "role",
        "staffRole",
        "status",
        "mustChangePassword",
        "lastLoginAt",
        "createdAt"
      )
      .all();

    return NextResponse.json({ success: true, staff });
  } catch (error) {
    console.error("Staff list failed:", error);

    return NextResponse.json(
      { error: "Unable to load staff accounts." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission("staff:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const staffRole =
      typeof body.staffRole === "string"
        ? body.staffRole
        : "SUPPORT";

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: "Enter a name between 2 and 100 characters." },
        { status: 400 }
      );
    }

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "Enter a valid staff email address." },
        { status: 400 }
      );
    }

    if (!VALID_STAFF_ROLES.includes(staffRole as StaffRole)) {
      return NextResponse.json(
        { error: "Select a valid staff role." },
        { status: 400 }
      );
    }

    const existing = await db.orm.public.AdminUser.first({ email });

    if (existing) {
      return NextResponse.json(
        { error: "A staff account with this email already exists." },
        { status: 409 }
      );
    }

    // Only a Super Admin can assign the Super Admin role.
    if (
      staffRole === "SUPER_ADMIN" &&
      auth.user.staffRole !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only a Super Admin can assign this role." },
        { status: 403 }
      );
    }

    const rateLimit = await checkStaffPasswordRateLimit(
      `staff-create:${auth.user.id}`
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many staff creation requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const username = generateUsername(name);

    const { admin, tokenId, actionUrl } = await createInvitedStaff({
      name,
      email,
      username,
      staffRole: staffRole as StaffRole,
    });

    let invitationEmailSent = false;

    try {
      await sendStaffAccessEmail(
        admin.email,
        admin.username,
        actionUrl,
        "INVITATION"
      );

      invitationEmailSent = true;
    } catch (emailError) {
      try {
        await cancelStaffAccessToken(tokenId, admin.id);
      } catch (cancellationError) {
        console.error(
          "Initial staff invitation token cancellation failed:",
          cancellationError instanceof Error
            ? cancellationError.name
            : "Unknown error"
        );
      }

      console.error(
        "Staff invitation email delivery failed:",
        emailError instanceof Error
          ? emailError.name
          : "Unknown error"
      );
    }

    return NextResponse.json(
      {
        success: true,
        staff: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          username: admin.username,
          role: admin.role,
          staffRole: admin.staffRole,
          status: admin.status,
          mustChangePassword: admin.mustChangePassword,
        },
        invitationEmailSent,
        message: invitationEmailSent
          ? "Staff account created. A password setup invitation was emailed."
          : "Staff account created, but the invitation email could not be sent. Resend the invitation from Staff Management.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin staff creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create the staff account." },
      { status: 500 }
    );
  }
}
