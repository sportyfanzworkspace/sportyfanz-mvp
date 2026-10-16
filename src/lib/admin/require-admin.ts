import { NextResponse } from "next/server";
import { getCurrentAdminUserId } from "@/lib/auth";
import { db } from "@/lib/prisma";

export type StaffRole =
  | "SUPER_ADMIN"
  | "OPERATIONS"
  | "CONTENT_MODERATION"
  | "SUPPORT";

export type AdminPermission =
  | "staff:read"
  | "staff:manage"
  | "rewards:manage"
  | "predictions:manage"
  | "trivia:manage"
  | "polls:manage"
  | "content:moderate"
  | "fans:support";

const ROLE_PERMISSIONS: Record<StaffRole, AdminPermission[]> = {
  SUPER_ADMIN: [
    "staff:read",
    "staff:manage",
    "rewards:manage",
    "predictions:manage",
    "trivia:manage",
    "polls:manage",
    "content:moderate",
    "fans:support",
  ],
  OPERATIONS: [
    "rewards:manage",
    "predictions:manage",
  ],
  CONTENT_MODERATION: [
    "trivia:manage",
    "polls:manage",
    "content:moderate",
  ],
  SUPPORT: [
    "fans:support",
  ],
};

function isStaffRole(value: string): value is StaffRole {
  return (
    value === "SUPER_ADMIN" ||
    value === "OPERATIONS" ||
    value === "CONTENT_MODERATION" ||
    value === "SUPPORT"
  );
}

export function hasPermission(
  role: string,
  permission: AdminPermission
): boolean {
  if (!isStaffRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export async function requireAdmin() {
  const adminUserId = await getCurrentAdminUserId();

  if (!adminUserId) {
    return {
      authorized: false as const,
      reason: "unauthenticated" as const,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  const admin = await db.orm.public.AdminUser.first({
    id: adminUserId,
  });

  if (!admin || admin.status !== "ACTIVE") {
    return {
      authorized: false as const,
      reason: "inactive" as const,
      response: NextResponse.json(
        { error: "Your account is not active." },
        { status: 403 }
      ),
    };
  }

  if (admin.role !== "ADMIN") {
    return {
      authorized: false as const,
      reason: "not_admin" as const,
      response: NextResponse.json(
        { error: "Admin access is restricted." },
        { status: 403 }
      ),
    };
  }

  if (admin.mustChangePassword) {
    return {
      authorized: false as const,
      reason: "password_change_required" as const,
      response: NextResponse.json(
        {
          error:
            "Change your temporary password before accessing the Admin workspace.",
          code: "PASSWORD_CHANGE_REQUIRED",
        },
        { status: 403 }
      ),
    };
  }

  const staffRole = isStaffRole(admin.staffRole)
    ? admin.staffRole
    : null;

  if (!staffRole) {
    return {
      authorized: false as const,
      reason: "invalid_staff_role" as const,
      response: NextResponse.json(
        { error: "Your staff role is invalid. Contact a Super Admin." },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true as const,
    user: {
      id: admin.id,
      email: admin.email,
      username: admin.username,
      name: admin.name,
      role: admin.role,
      staffRole,
      mustChangePassword: admin.mustChangePassword,
    },
  };
}

export async function requirePermission(
  permission: AdminPermission
) {
  const auth = await requireAdmin();

  if (!auth.authorized) {
    return auth;
  }

  if (!hasPermission(auth.user.staffRole, permission)) {
    return {
      authorized: false as const,
      reason: "forbidden" as const,
      response: NextResponse.json(
        {
          error: "You do not have permission to perform this action.",
          code: "INSUFFICIENT_PERMISSIONS",
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}
