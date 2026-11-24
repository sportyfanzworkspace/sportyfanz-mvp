import { NextResponse } from "next/server";
import {
  requirePermission,
  type StaffRole,
} from "@/lib/admin/require-admin";
import { db } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_STAFF_ROLES: StaffRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "CONTENT_MODERATION",
  "SUPPORT",
];

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await requirePermission("staff:manage");

    if (!auth.authorized) {
      return auth.response;
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json(
        { error: "Invalid staff account ID." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const staff = await db.orm.public.AdminUser.first({ id });

    if (!staff || staff.status === "DELETED") {
      return NextResponse.json(
        { error: "Staff account not found." },
        { status: 404 }
      );
    }

    const status = body.status;
    const requestedRole = body.staffRole;

    if (
      status !== undefined &&
      status !== "ACTIVE" &&
      status !== "SUSPENDED"
    ) {
      return NextResponse.json(
        { error: "Status must be ACTIVE or SUSPENDED." },
        { status: 400 }
      );
    }

    if (
      requestedRole !== undefined &&
      (typeof requestedRole !== "string" ||
        !VALID_STAFF_ROLES.includes(requestedRole as StaffRole))
    ) {
      return NextResponse.json(
        { error: "Select a valid staff role." },
        { status: 400 }
      );
    }

    if (status === undefined && requestedRole === undefined) {
      return NextResponse.json(
        { error: "Provide a status or staff role to update." },
        { status: 400 }
      );
    }

    if (
      id === auth.user.id &&
      (status === "SUSPENDED" ||
        (requestedRole !== undefined &&
          requestedRole !== "SUPER_ADMIN"))
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot suspend yourself or remove your own Super Admin role.",
        },
        { status: 400 }
      );
    }

    const removesSuperAdmin =
      staff.staffRole === "SUPER_ADMIN" &&
      staff.status === "ACTIVE" &&
      (status === "SUSPENDED" ||
        (requestedRole !== undefined &&
          requestedRole !== "SUPER_ADMIN"));

    if (removesSuperAdmin) {
      const allStaff = await db.orm.public.AdminUser
        .select("id", "staffRole", "status")
        .all();

      const activeSuperAdmins = allStaff.filter(
        (member) =>
          member.staffRole === "SUPER_ADMIN" &&
          member.status === "ACTIVE"
      );

      if (activeSuperAdmins.length <= 1) {
        return NextResponse.json(
          {
            error:
              "You cannot suspend or demote the last active Super Admin.",
          },
          { status: 400 }
        );
      }
    }

    const updates: {
      updatedAt: string;
      status?: "ACTIVE" | "SUSPENDED";
      staffRole?: StaffRole;
    } = {
      updatedAt: new Date().toISOString(),
    };

    if (status !== undefined) {
      updates.status = status;
    }

    if (requestedRole !== undefined) {
      updates.staffRole = requestedRole as StaffRole;
    }

    await db.orm.public.AdminUser.where({ id }).update(updates);

    return NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        username: staff.username,
        status: updates.status ?? staff.status,
        staffRole: updates.staffRole ?? staff.staffRole,
      },
    });
  } catch (error) {
    console.error("Staff update failed:", error);

    return NextResponse.json(
      { error: "Unable to update the staff account." },
      { status: 500 }
    );
  }
}
